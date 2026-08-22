package main

import (
	"fmt"
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
	spool         *eventSpool
	stop          chan struct{}

	closeMu     sync.RWMutex
	stopOnce    sync.Once
	closed      bool
	shutdownErr error
	wg          sync.WaitGroup
}

func newEventBatcher(pusher eventPusher) *eventBatcher {
	return newEventBatcherWithSpool(
		pusher,
		eventBatchMaxSize,
		eventBatchFlushInterval,
		eventBatchPushAttempts,
		eventBatchRetryDelay,
		defaultEventSpoolPath(),
	)
}

func newEventBatcherWithConfig(
	pusher eventPusher,
	maxBatchSize int,
	flushInterval time.Duration,
) *eventBatcher {
	return newEventBatcherWithSpool(
		pusher,
		maxBatchSize,
		flushInterval,
		eventBatchPushAttempts,
		eventBatchRetryDelay,
		defaultEventSpoolPath(),
	)
}

func newEventBatcherWithOptions(
	pusher eventPusher,
	maxBatchSize int,
	flushInterval time.Duration,
	pushAttempts int,
	retryDelay time.Duration,
) *eventBatcher {
	return newEventBatcherWithSpool(
		pusher,
		maxBatchSize,
		flushInterval,
		pushAttempts,
		retryDelay,
		defaultEventSpoolPath(),
	)
}

func newEventBatcherWithSpool(
	pusher eventPusher,
	maxBatchSize int,
	flushInterval time.Duration,
	pushAttempts int,
	retryDelay time.Duration,
	spoolPath string,
) *eventBatcher {
	batcher := &eventBatcher{
		pusher:        pusher,
		results:       make(chan monitor.Result, eventBatchQueueCapacity),
		maxBatchSize:  maxBatchSize,
		flushInterval: flushInterval,
		pushAttempts:  pushAttempts,
		retryDelay:    retryDelay,
		spool:         newEventSpool(spoolPath),
		stop:          make(chan struct{}),
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

	select {
	case b.results <- result:
	case <-b.stop:
	}
}

func (b *eventBatcher) Close() error {
	// Closing stop before taking closeMu lets a blocked producer escape its
	// send. Otherwise a full queue could hold the read lock forever while
	// shutdown waits for the write lock.
	b.stopOnce.Do(func() {
		close(b.stop)
	})

	b.closeMu.Lock()
	if !b.closed {
		b.closed = true
		close(b.results)
	}
	b.closeMu.Unlock()

	b.wg.Wait()
	return b.shutdownErr
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

func (b *eventBatcher) persistUnsent(
	retryBatch []monitor.Result,
	batch []monitor.Result,
) error {
	if b.spool == nil {
		return fmt.Errorf("event spool is not configured")
	}

	pending := make([]monitor.Result, 0, len(retryBatch)+len(batch))
	pending = append(pending, retryBatch...)
	pending = append(pending, batch...)
	if len(pending) == 0 {
		return nil
	}

	if err := b.spool.replace(pending); err != nil {
		return fmt.Errorf("persisting unsent event batch: %w", err)
	}

	log.Printf(
		"Persisted %d unsent monitor events to %s",
		len(pending),
		b.spool.path,
	)
	return nil
}

func (b *eventBatcher) run() {
	defer b.wg.Done()

	ticker := time.NewTicker(b.flushInterval)
	defer ticker.Stop()

	batch := make([]monitor.Result, 0, b.maxBatchSize)
	var retryBatch []monitor.Result
	retryAt := time.Time{}

	if b.spool != nil {
		persisted, err := b.spool.load()
		if err != nil {
			log.Printf("Could not load persisted monitor events: %v", err)
		} else if len(persisted) > 0 {
			retryBatch = persisted
			retryAt = time.Now()
			log.Printf(
				"Loaded %d persisted monitor events for retry",
				len(retryBatch),
			)
		}
	}

	flush := func() {
		if len(batch) == 0 || len(retryBatch) > 0 {
			return
		}

		candidate := append([]monitor.Result(nil), batch...)
		if err := b.pushBatch(candidate); err != nil {
			retryBatch = candidate
			retryAt = time.Now().Add(b.retryDelay)
			if b.spool != nil {
				if spoolErr := b.spool.replace(retryBatch); spoolErr != nil {
					log.Printf(
						"Could not persist failed event batch for retry: %v",
						spoolErr,
					)
				}
			}
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
		if b.spool != nil {
			if err := b.spool.clear(); err != nil {
				log.Printf("Could not clear delivered event spool: %v", err)
			}
		}
	}

	finish := func() error {
		for result := range b.results {
			batch = append(batch, result)
		}

		// Deliver the failed batch before newer results to preserve event order.
		if len(retryBatch) > 0 {
			if err := b.pushBatch(retryBatch); err != nil {
				log.Printf(
					"Could not deliver pending event batch during shutdown; preserving %d results: %v",
					len(retryBatch),
					err,
				)
				return b.persistUnsent(retryBatch, batch)
			}

			retryBatch = nil
			if b.spool != nil {
				if err := b.spool.clear(); err != nil {
					log.Printf("Could not clear delivered event spool: %v", err)
				}
			}
		}

		if len(batch) > 0 {
			if err := b.pushBatch(batch); err != nil {
				log.Printf(
					"Could not deliver event batch during shutdown; preserving %d results: %v",
					len(batch),
					err,
				)
				return b.persistUnsent(nil, batch)
			}
		}

		return nil
	}

	for {
		if len(retryBatch) > 0 && !time.Now().Before(retryAt) {
			retryPending(false)
			continue
		}

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
				b.shutdownErr = finish()
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
		case <-b.stop:
			// Close closes results after all producers have observed stop. The
			// finish function can therefore drain the channel before returning.
			b.shutdownErr = finish()
			return
		}
	}
}
