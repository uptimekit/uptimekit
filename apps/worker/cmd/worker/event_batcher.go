package main

import (
	"log"
	"sync"
	"time"

	"github.com/uptimekit/worker/internal/monitor"
)

const (
	eventBatchMaxSize       = 25
	eventBatchQueueCapacity = eventBatchMaxSize * 4
	eventBatchFlushInterval = 250 * time.Millisecond
	eventBatchPushAttempts  = 3
	eventBatchRetryDelay    = time.Second
)

type eventPusher interface {
	PushEvents([]monitor.Result) error
}

type eventBatcher struct {
	pusher        eventPusher
	results       chan monitor.Result
	maxBatchSize  int
	flushInterval time.Duration
	pushAttempts  int
	retryDelay    time.Duration

	closeMu sync.RWMutex
	closed  bool
	wg      sync.WaitGroup
}

func newEventBatcher(pusher eventPusher) *eventBatcher {
	return newEventBatcherWithConfig(
		pusher,
		eventBatchMaxSize,
		eventBatchFlushInterval,
	)
}

func newEventBatcherWithConfig(
	pusher eventPusher,
	maxBatchSize int,
	flushInterval time.Duration,
) *eventBatcher {
	return newEventBatcherWithOptions(
		pusher,
		maxBatchSize,
		flushInterval,
		eventBatchPushAttempts,
		eventBatchRetryDelay,
	)
}

func newEventBatcherWithOptions(
	pusher eventPusher,
	maxBatchSize int,
	flushInterval time.Duration,
	pushAttempts int,
	retryDelay time.Duration,
) *eventBatcher {
	batcher := &eventBatcher{
		pusher:        pusher,
		results:       make(chan monitor.Result, eventBatchQueueCapacity),
		maxBatchSize:  maxBatchSize,
		flushInterval: flushInterval,
		pushAttempts:  pushAttempts,
		retryDelay:    retryDelay,
	}
	batcher.wg.Add(1)
	go batcher.run()
	return batcher
}

func (b *eventBatcher) Enqueue(result monitor.Result) {
	b.closeMu.RLock()
	defer b.closeMu.RUnlock()

	if b.closed {
		return
	}

	b.results <- result
}

func (b *eventBatcher) Close() {
	b.closeMu.Lock()
	if !b.closed {
		b.closed = true
		close(b.results)
	}
	b.closeMu.Unlock()

	b.wg.Wait()
}

func (b *eventBatcher) pushBatch(results []monitor.Result) error {
	attempts := b.pushAttempts
	if attempts < 1 {
		attempts = 1
	}

	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		if err := b.pusher.PushEvents(results); err == nil {
			return nil
		} else {
			lastErr = err
		}

		if attempt < attempts && b.retryDelay > 0 {
			time.Sleep(b.retryDelay)
		}
	}

	return lastErr
}

func (b *eventBatcher) run() {
	defer b.wg.Done()

	ticker := time.NewTicker(b.flushInterval)
	defer ticker.Stop()

	batch := make([]monitor.Result, 0, b.maxBatchSize)
	var retryBatch []monitor.Result
	retryAt := time.Time{}

	flush := func() {
		if len(batch) == 0 || len(retryBatch) > 0 {
			return
		}

		candidate := append([]monitor.Result(nil), batch...)
		if err := b.pushBatch(candidate); err != nil {
			retryBatch = candidate
			retryAt = time.Now().Add(b.retryDelay)
			log.Printf(
				"Push events failed for batch of %d; will retry: %v",
				len(candidate),
				err,
			)
		}
		batch = batch[:0]
	}

	retryPending := func(force bool) {
		if len(retryBatch) == 0 || (!force && time.Now().Before(retryAt)) {
			return
		}

		if err := b.pushBatch(retryBatch); err != nil {
			retryAt = time.Now().Add(b.retryDelay)
			log.Printf(
				"Retrying events failed for batch of %d; will retry again: %v",
				len(retryBatch),
				err,
			)
			return
		}

		retryBatch = nil
		retryAt = time.Time{}
	}

	finish := func() {
		// Deliver the failed batch before newer results to preserve event order.
		if len(retryBatch) > 0 {
			if err := b.pushBatch(retryBatch); err != nil {
				log.Printf(
					"Could not deliver pending event batch during shutdown; %d results remain unsent: %v",
					len(retryBatch),
					err,
				)
				return
			}
		}

		if len(batch) > 0 {
			if err := b.pushBatch(batch); err != nil {
				log.Printf(
					"Could not deliver event batch during shutdown; %d results remain unsent: %v",
					len(batch),
					err,
				)
			}
		}
	}

	for {
		if len(batch) >= b.maxBatchSize && len(retryBatch) == 0 {
			flush()
			continue
		}

		results := (<-chan monitor.Result)(b.results)
		if len(batch) >= b.maxBatchSize && len(retryBatch) > 0 {
			// Apply backpressure while an older failed batch is pending.
			results = nil
		}

		select {
		case result, ok := <-results:
			if !ok {
				finish()
				return
			}

			batch = append(batch, result)
			if len(batch) >= b.maxBatchSize && len(retryBatch) == 0 {
				flush()
			}
		case <-ticker.C:
			if len(retryBatch) > 0 {
				retryPending(false)
			} else {
				flush()
			}
		}
	}
}
