package main

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/uptimekit/worker/internal/monitor"
)

type recordingEventPusher struct {
	mu       sync.Mutex
	batches  [][]monitor.Result
	pushed   chan struct{}
	failures int
	attempts int
}

func (p *recordingEventPusher) PushEvents(results []monitor.Result) error {
	p.mu.Lock()
	p.attempts++
	if p.failures > 0 {
		p.failures--
		p.mu.Unlock()
		return errors.New("temporary event delivery failure")
	}
	p.batches = append(p.batches, append([]monitor.Result(nil), results...))
	p.mu.Unlock()

	select {
	case p.pushed <- struct{}{}:
	default:
	}
	return nil
}

func (p *recordingEventPusher) snapshot() [][]monitor.Result {
	p.mu.Lock()
	defer p.mu.Unlock()

	return append([][]monitor.Result(nil), p.batches...)
}

func (p *recordingEventPusher) attemptCount() int {
	p.mu.Lock()
	defer p.mu.Unlock()

	return p.attempts
}

func TestEventBatcherFlushesAtMaximumBatchSize(t *testing.T) {
	pusher := &recordingEventPusher{pushed: make(chan struct{}, 1)}
	batcher := newEventBatcherWithConfig(pusher, 2, time.Hour)

	batcher.Enqueue(monitor.Result{MonitorID: "monitor-1"})
	batcher.Enqueue(monitor.Result{MonitorID: "monitor-2"})

	select {
	case <-pusher.pushed:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for full batch")
	}
	batcher.Close()

	batches := pusher.snapshot()
	if len(batches) != 1 || len(batches[0]) != 2 {
		t.Fatalf("batches = %#v, want one batch of two results", batches)
	}
}

func TestEventBatcherFlushesPendingResultsOnClose(t *testing.T) {
	pusher := &recordingEventPusher{pushed: make(chan struct{}, 1)}
	batcher := newEventBatcherWithConfig(pusher, 10, time.Hour)

	batcher.Enqueue(monitor.Result{MonitorID: "monitor-1"})
	batcher.Close()

	batches := pusher.snapshot()
	if len(batches) != 1 || len(batches[0]) != 1 {
		t.Fatalf("batches = %#v, want one pending result flushed on close", batches)
	}
}

func TestEventBatcherRetriesFailedBatch(t *testing.T) {
	pusher := &recordingEventPusher{
		pushed:   make(chan struct{}, 1),
		failures: 1,
	}
	batcher := newEventBatcherWithOptions(pusher, 2, time.Hour, 3, time.Millisecond)

	batcher.Enqueue(monitor.Result{MonitorID: "monitor-1"})
	batcher.Enqueue(monitor.Result{MonitorID: "monitor-2"})

	select {
	case <-pusher.pushed:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for retried batch")
	}
	batcher.Close()

	batches := pusher.snapshot()
	if len(batches) != 1 || len(batches[0]) != 2 {
		t.Fatalf("batches = %#v, want one delivered batch of two results", batches)
	}
	if attempts := pusher.attemptCount(); attempts != 2 {
		t.Fatalf("attempts = %d, want one retry after the transient failure", attempts)
	}
}

func TestEventBatcherRequeuesAfterRetryExhaustion(t *testing.T) {
	pusher := &recordingEventPusher{
		pushed:   make(chan struct{}, 1),
		failures: 3,
	}
	batcher := newEventBatcherWithOptions(
		pusher,
		2,
		time.Millisecond,
		3,
		time.Millisecond,
	)

	batcher.Enqueue(monitor.Result{MonitorID: "monitor-1"})
	batcher.Enqueue(monitor.Result{MonitorID: "monitor-2"})

	select {
	case <-pusher.pushed:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for requeued batch")
	}
	batcher.Close()

	batches := pusher.snapshot()
	if len(batches) != 1 || len(batches[0]) != 2 {
		t.Fatalf("batches = %#v, want one requeued batch of two results", batches)
	}
	if attempts := pusher.attemptCount(); attempts != 4 {
		t.Fatalf("attempts = %d, want three initial attempts plus one requeue", attempts)
	}
}
