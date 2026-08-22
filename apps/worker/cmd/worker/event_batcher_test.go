package main

import (
	"errors"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/uptimekit/worker/internal/monitor"
)

type recordingEventPusher struct {
	mu        sync.Mutex
	batches   [][]monitor.Result
	pushed    chan struct{}
	attempted chan struct{}
	failures  int
	attempts  int
}

func testSpoolPath(t *testing.T) string {
	t.Helper()
	return filepath.Join(t.TempDir(), "events.json")
}

func (p *recordingEventPusher) PushEvents(results []monitor.Result) error {
	p.mu.Lock()
	p.attempts++
	attempted := p.attempted
	if p.failures > 0 {
		p.failures--
		p.mu.Unlock()
		if attempted != nil {
			select {
			case attempted <- struct{}{}:
			default:
			}
		}
		return errors.New("temporary event delivery failure")
	}
	p.batches = append(p.batches, append([]monitor.Result(nil), results...))
	p.mu.Unlock()
	if attempted != nil {
		select {
		case attempted <- struct{}{}:
		default:
		}
	}

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
	batcher := newEventBatcherWithSpool(
		pusher,
		2,
		time.Hour,
		eventBatchPushAttempts,
		eventBatchRetryDelay,
		testSpoolPath(t),
	)

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
	batcher := newEventBatcherWithSpool(
		pusher,
		10,
		time.Hour,
		eventBatchPushAttempts,
		eventBatchRetryDelay,
		testSpoolPath(t),
	)

	batcher.Enqueue(monitor.Result{MonitorID: "monitor-1"})
	batcher.Close()

	batches := pusher.snapshot()
	if len(batches) != 1 || len(batches[0]) != 1 {
		t.Fatalf("batches = %#v, want one pending result flushed on close", batches)
	}
}

func TestEventBatcherDurablyQueuesBeforeReturning(t *testing.T) {
	spoolPath := testSpoolPath(t)
	pusher := &recordingEventPusher{pushed: make(chan struct{}, 1)}
	batcher := newEventBatcherWithSpool(
		pusher,
		10,
		time.Hour,
		eventBatchPushAttempts,
		eventBatchRetryDelay,
		spoolPath,
	)

	if err := batcher.Enqueue(monitor.Result{MonitorID: "durable-monitor"}); err != nil {
		t.Fatalf("Enqueue() error = %v", err)
	}

	persisted, err := newEventSpool(spoolPath).load()
	if err != nil {
		t.Fatalf("load() error = %v", err)
	}
	if len(persisted) != 1 || persisted[0].MonitorID != "durable-monitor" {
		t.Fatalf("persisted = %#v, want the accepted result", persisted)
	}

	if err := batcher.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
}

func TestEventBatcherRetriesFailedBatch(t *testing.T) {
	pusher := &recordingEventPusher{
		pushed:   make(chan struct{}, 1),
		failures: 1,
	}
	batcher := newEventBatcherWithSpool(
		pusher,
		2,
		time.Hour,
		3,
		time.Millisecond,
		testSpoolPath(t),
	)

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
	batcher := newEventBatcherWithSpool(
		pusher,
		2,
		10*time.Millisecond,
		3,
		time.Millisecond,
		testSpoolPath(t),
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

func TestEventBatcherPersistsUnsentEventsOnShutdown(t *testing.T) {
	spoolPath := filepath.Join(t.TempDir(), "events.json")
	pusher := &recordingEventPusher{
		pushed:   make(chan struct{}, 1),
		failures: 1000,
	}
	batcher := newEventBatcherWithSpool(
		pusher,
		2,
		time.Hour,
		1,
		time.Millisecond,
		spoolPath,
	)

	batcher.Enqueue(monitor.Result{MonitorID: "monitor-1"})
	batcher.Enqueue(monitor.Result{MonitorID: "monitor-2"})

	if err := batcher.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	persisted, err := newEventSpool(spoolPath).load()
	if err != nil {
		t.Fatalf("load() error = %v", err)
	}
	if len(persisted) != 2 {
		t.Fatalf("persisted = %#v, want two unsent results", persisted)
	}
}

func TestEventBatcherLoadsPersistedEvents(t *testing.T) {
	spoolPath := filepath.Join(t.TempDir(), "events.json")
	spool := newEventSpool(spoolPath)
	if err := spool.replace([]monitor.Result{{MonitorID: "persisted-monitor"}}); err != nil {
		t.Fatalf("replace() error = %v", err)
	}

	pusher := &recordingEventPusher{pushed: make(chan struct{}, 1)}
	batcher := newEventBatcherWithSpool(
		pusher,
		2,
		time.Hour,
		1,
		0,
		spoolPath,
	)

	select {
	case <-pusher.pushed:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for persisted event retry")
	}
	if err := batcher.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	batches := pusher.snapshot()
	if len(batches) != 1 || len(batches[0]) != 1 {
		t.Fatalf("batches = %#v, want one persisted event", batches)
	}
	if batches[0][0].MonitorID != "persisted-monitor" {
		t.Fatalf("monitor id = %q, want persisted-monitor", batches[0][0].MonitorID)
	}
	persisted, err := spool.load()
	if err != nil {
		t.Fatalf("load() after delivery error = %v", err)
	} else if len(persisted) != 0 {
		t.Fatalf("spool still contains delivered events: %#v", persisted)
	}
}

func TestEventBatcherCloseUnblocksBackpressure(t *testing.T) {
	spoolPath := filepath.Join(t.TempDir(), "events.json")
	pusher := &recordingEventPusher{
		attempted: make(chan struct{}, 1),
		failures:  1000,
	}
	batcher := newEventBatcherWithSpool(
		pusher,
		1,
		time.Hour,
		1,
		time.Hour,
		spoolPath,
	)

	batcher.Enqueue(monitor.Result{MonitorID: "monitor-1"})
	select {
	case <-pusher.attempted:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for failed batch")
	}

	enqueueDone := make(chan struct{})
	go func() {
		batcher.Enqueue(monitor.Result{MonitorID: "monitor-2"})
		close(enqueueDone)
	}()

	select {
	case <-enqueueDone:
		t.Fatal("producer unexpectedly completed while retry backpressure was active")
	case <-time.After(25 * time.Millisecond):
	}
	persistedBeforeClose, err := newEventSpool(spoolPath).load()
	if err != nil {
		t.Fatalf("load() before close error = %v", err)
	}
	if len(persistedBeforeClose) != 2 ||
		persistedBeforeClose[0].MonitorID != "monitor-1" ||
		persistedBeforeClose[1].MonitorID != "monitor-2" {
		t.Fatalf("persisted before close = %#v, want both ordered results", persistedBeforeClose)
	}

	closeDone := make(chan error, 1)
	go func() {
		closeDone <- batcher.Close()
	}()

	select {
	case err := <-closeDone:
		if err != nil {
			t.Fatalf("Close() error = %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("Close() did not terminate under retry backpressure")
	}

	select {
	case <-enqueueDone:
	case <-time.After(time.Second):
		t.Fatal("blocked producer did not observe shutdown")
	}

	persisted, err := newEventSpool(spoolPath).load()
	if err != nil {
		t.Fatalf("load() error = %v", err)
	}
	if len(persisted) != 2 ||
		persisted[0].MonitorID != "monitor-1" ||
		persisted[1].MonitorID != "monitor-2" {
		t.Fatalf("persisted = %#v, want both durable results", persisted)
	}
}

func TestEventBatcherReportsSpoolFailure(t *testing.T) {
	pusher := &recordingEventPusher{failures: 1000}
	batcher := newEventBatcherWithSpool(
		pusher,
		1,
		time.Hour,
		1,
		time.Millisecond,
		t.TempDir(),
	)

	if err := batcher.Enqueue(monitor.Result{MonitorID: "monitor-1"}); err == nil {
		t.Fatal("Enqueue() error = nil, want durable queue failure")
	}
	if err := batcher.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
}
