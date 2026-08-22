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

	closeMu      sync.RWMutex
	enqueueMu    sync.Mutex
	retryMu      sync.Mutex
	retryBlocked bool
	retryReady   chan struct{}
	ready        chan struct{}
	stopOnce     sync.Once
	closed       bool
	shutdownErr  error
	wg           sync.WaitGroup
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
		retryBlocked:  true,
		retryReady:    make(chan struct{}),
		ready:         make(chan struct{}),
	}
	batcher.wg.Add(1)
	go batcher.run()
	return batcher
}

func (b *eventBatcher) Enqueue(result monitor.Result) error {
	b.closeMu.RLock()
	defer b.closeMu.RUnlock()
	b.enqueueMu.Lock()
	defer b.enqueueMu.Unlock()

	select {
	case <-b.ready:
	case <-b.stop:
		return nil
	}

	if b.closed {
		return nil
	}
	if b.spool == nil {
		return fmt.Errorf("event spool is not configured")
	}
	if err := b.spool.append(result); err != nil {
		return fmt.Errorf("durably queuing monitor event: %w", err)
	}

	for {
		b.retryMu.Lock()
		if b.retryBlocked {
			retryReady := b.retryReady
			b.retryMu.Unlock()

			select {
			case <-retryReady:
				continue
			case <-b.stop:
				return nil
			}
		}
		b.retryMu.Unlock()

		select {
		case b.results <- result:
			return nil
		case <-b.stop:
			return nil
		}
	}
}

func (b *eventBatcher) blockNewEvents() {
	b.retryMu.Lock()
	defer b.retryMu.Unlock()

	if b.retryBlocked {
		return
	}

	b.retryBlocked = true
	b.retryReady = make(chan struct{})
}

func (b *eventBatcher) allowNewEvents() {
	b.retryMu.Lock()
	defer b.retryMu.Unlock()

	if !b.retryBlocked {
		return
	}

	b.retryBlocked = false
	close(b.retryReady)
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

func (b *eventBatcher) verifyDurableSpool() error {
	if b.spool == nil {
		return fmt.Errorf("event spool is not configured")
	}

	if _, err := b.spool.load(); err != nil {
		return fmt.Errorf("verifying unsent event spool: %w", err)
	}

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
			b.allowNewEvents()
		} else if len(persisted) > 0 {
			retryBatch = persisted
			retryAt = time.Now()
			log.Printf(
				"Loaded %d persisted monitor events for retry",
				len(retryBatch),
			)
		} else {
			b.allowNewEvents()
		}
	} else {
		b.allowNewEvents()
	}
	close(b.ready)

	flush := func() {
		if len(batch) == 0 || len(retryBatch) > 0 {
			return
		}

		candidate := append([]monitor.Result(nil), batch...)
		b.blockNewEvents()
		if err := b.pushBatch(candidate); err != nil {
			retryBatch = candidate
			retryAt = time.Now().Add(b.retryDelay)
			batch = batch[:0]
			log.Printf(
				"Push events failed for batch of %d; will retry: %v",
				len(candidate),
				err,
			)
			return
		}
		batch = batch[:0]
		if b.spool != nil {
			if spoolErr := b.spool.removePrefix(len(candidate)); spoolErr != nil {
				log.Printf("Could not remove delivered event batch from spool: %v", spoolErr)
			}
		}
		b.allowNewEvents()
	}

	retryPending := func(force bool) {
		if len(retryBatch) == 0 || (!force && time.Now().Before(retryAt)) {
			return
		}

		deliveredCount := len(retryBatch)
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
			if err := b.spool.removePrefix(deliveredCount); err != nil {
				log.Printf("Could not remove delivered retry batch from spool: %v", err)
			}
		}
		b.allowNewEvents()
	}

	finish := func() error {
		for result := range b.results {
			batch = append(batch, result)
		}

		// Deliver the failed batch before newer results to preserve event order.
		if len(retryBatch) > 0 {
			deliveredCount := len(retryBatch)
			if err := b.pushBatch(retryBatch); err != nil {
				log.Printf(
					"Could not deliver pending event batch during shutdown; durable spool retained %d results: %v",
					len(retryBatch),
					err,
				)
				return b.verifyDurableSpool()
			}

			if b.spool != nil {
				if err := b.spool.removePrefix(deliveredCount); err != nil {
					log.Printf("Could not remove delivered retry batch from spool: %v", err)
				}
			}
			retryBatch = nil
		}

		if len(batch) > 0 {
			if err := b.pushBatch(batch); err != nil {
				log.Printf(
					"Could not deliver event batch during shutdown; durable spool retained %d results: %v",
					len(batch),
					err,
				)
				return b.verifyDurableSpool()
			}
			if b.spool != nil {
				if err := b.spool.removePrefix(len(batch)); err != nil {
					log.Printf("Could not remove delivered event batch from spool: %v", err)
				}
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
		if len(retryBatch) > 0 {
			// Enqueue applies the same gate to producers. Keep the receive
			// disabled so an already-buffered suffix is drained and spooled
			// before retry delivery can be acknowledged.
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
