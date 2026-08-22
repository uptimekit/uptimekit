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
)

type eventPusher interface {
	PushEvents([]monitor.Result) error
}

type eventBatcher struct {
	pusher        eventPusher
	results       chan monitor.Result
	maxBatchSize  int
	flushInterval time.Duration

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
	batcher := &eventBatcher{
		pusher:        pusher,
		results:       make(chan monitor.Result, eventBatchQueueCapacity),
		maxBatchSize:  maxBatchSize,
		flushInterval: flushInterval,
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

func (b *eventBatcher) run() {
	defer b.wg.Done()

	ticker := time.NewTicker(b.flushInterval)
	defer ticker.Stop()

	batch := make([]monitor.Result, 0, b.maxBatchSize)
	flush := func() {
		if len(batch) == 0 {
			return
		}

		if err := b.pusher.PushEvents(batch); err != nil {
			log.Printf("Push events failed for batch of %d: %v", len(batch), err)
		}
		batch = batch[:0]
	}

	for {
		select {
		case result, ok := <-b.results:
			if !ok {
				flush()
				return
			}

			batch = append(batch, result)
			if len(batch) >= b.maxBatchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}
