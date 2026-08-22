package main

import (
	"context"
	"errors"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/uptimekit/worker/internal/monitor"
)

type fakeMonitor struct {
	results []monitor.Result
	calls   int
}

type blockingEventPusher struct {
	started     chan struct{}
	release     chan struct{}
	startOnce   sync.Once
	releaseOnce sync.Once
}

func (p *blockingEventPusher) PushEvents([]monitor.Result) error {
	p.startOnce.Do(func() {
		close(p.started)
	})
	<-p.release
	return nil
}

func (p *blockingEventPusher) unblock() {
	p.releaseOnce.Do(func() {
		close(p.release)
	})
}

func (m *fakeMonitor) Check(cfg monitor.Config) monitor.Result {
	m.calls++

	if m.calls <= len(m.results) {
		result := m.results[m.calls-1]
		result.MonitorID = cfg.ID
		return result
	}

	return monitor.Result{
		MonitorID: cfg.ID,
		Status:    monitor.StatusDown,
	}
}

func TestCheckWithRetriesStopsAfterSuccess(t *testing.T) {
	checker := &fakeMonitor{
		results: []monitor.Result{
			{Status: monitor.StatusDown},
			{Status: monitor.StatusUp},
			{Status: monitor.StatusDown},
		},
	}
	sleeps := make([]time.Duration, 0)

	result := checkWithRetries(
		checker,
		monitor.Config{ID: "monitor-1", Retries: 2, RetryInterval: 20},
		func(delay time.Duration) {
			sleeps = append(sleeps, delay)
		},
	)

	if result.Status != monitor.StatusUp {
		t.Fatalf("status = %q, want %q", result.Status, monitor.StatusUp)
	}
	if checker.calls != 2 {
		t.Fatalf("calls = %d, want 2", checker.calls)
	}
	if len(sleeps) != 1 || sleeps[0] != 20*time.Second {
		t.Fatalf("sleeps = %v, want [20s]", sleeps)
	}
}

func TestCheckWithRetriesExhaustsRetryBudget(t *testing.T) {
	checker := &fakeMonitor{
		results: []monitor.Result{
			{Status: monitor.StatusDown},
			{Status: monitor.StatusDown},
			{Status: monitor.StatusDown},
		},
	}
	sleeps := make([]time.Duration, 0)

	result := checkWithRetries(
		checker,
		monitor.Config{ID: "monitor-1", Retries: 2, RetryInterval: 5},
		func(delay time.Duration) {
			sleeps = append(sleeps, delay)
		},
	)

	if result.Status != monitor.StatusDown {
		t.Fatalf("status = %q, want %q", result.Status, monitor.StatusDown)
	}
	if checker.calls != 3 {
		t.Fatalf("calls = %d, want 3", checker.calls)
	}
	if len(sleeps) != 2 {
		t.Fatalf("sleeps = %v, want 2 retry sleeps", sleeps)
	}
}

func TestRunnerWaitHonorsShutdownDeadline(t *testing.T) {
	pusher := &blockingEventPusher{
		started: make(chan struct{}),
		release: make(chan struct{}),
	}
	events := newEventBatcherWithSpool(
		pusher,
		1,
		time.Hour,
		1,
		time.Hour,
		filepath.Join(t.TempDir(), "events.json"),
	)
	r := &runner{events: events}
	t.Cleanup(func() {
		pusher.unblock()
		_ = events.Close()
	})

	if err := events.Enqueue(monitor.Result{MonitorID: "monitor-1"}); err != nil {
		t.Fatalf("Enqueue() error = %v", err)
	}
	select {
	case <-pusher.started:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for blocked event delivery")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	if err := r.wait(shutdownCtx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("wait() error = %v, want context deadline exceeded", err)
	}
}

func TestMonitorSchedulerClaimsOnlyDueMonitors(t *testing.T) {
	start := time.Date(2026, 5, 26, 10, 0, 0, 0, time.UTC)
	scheduler := newMonitorScheduler()
	scheduler.sync([]monitor.Config{
		{ID: "fast", Interval: 30},
		{ID: "slow", Interval: 120},
	}, start)
	scheduler.states["fast"].phase = 0
	scheduler.states["slow"].phase = 90 * time.Second

	initial := scheduler.claimDue(start, 10)
	if len(initial) != 2 {
		t.Fatalf("initial due count = %d, want 2", len(initial))
	}
	scheduler.complete("fast")
	scheduler.complete("slow")

	afterThirtySeconds := scheduler.claimDue(start.Add(30*time.Second), 10)
	if len(afterThirtySeconds) != 1 || afterThirtySeconds[0].ID != "fast" {
		t.Fatalf("due after 30s = %#v, want only fast", afterThirtySeconds)
	}
}

func TestMonitorSchedulerSkipsOverlappingStrictCadenceSlot(t *testing.T) {
	start := time.Date(2026, 5, 26, 10, 0, 0, 0, time.UTC)
	scheduler := newMonitorScheduler()
	scheduler.sync([]monitor.Config{{ID: "monitor-1", Interval: 60}}, start)

	initial := scheduler.claimDue(start, 10)
	if len(initial) != 1 {
		t.Fatalf("initial due count = %d, want 1", len(initial))
	}

	firstNextDue := scheduler.states["monitor-1"].nextDue
	if !firstNextDue.After(start) || !firstNextDue.Before(start.Add(60*time.Second)) {
		t.Fatalf("first nextDue = %s, want a time within the next interval", firstNextDue)
	}

	overlap := scheduler.claimDue(firstNextDue, 10)
	if len(overlap) != 0 {
		t.Fatalf("overlap due count = %d, want 0", len(overlap))
	}

	nextDue := scheduler.states["monitor-1"].nextDue
	wantNextDue := firstNextDue.Add(60 * time.Second)
	if !nextDue.Equal(wantNextDue) {
		t.Fatalf("nextDue = %s, want %s", nextDue, wantNextDue)
	}

	scheduler.complete("monitor-1")

	beforeNextSlot := scheduler.claimDue(firstNextDue.Add(1*time.Second), 10)
	if len(beforeNextSlot) != 0 {
		t.Fatalf("before next slot due count = %d, want 0", len(beforeNextSlot))
	}

	nextSlot := scheduler.claimDue(wantNextDue, 10)
	if len(nextSlot) != 1 {
		t.Fatalf("next slot due count = %d, want 1", len(nextSlot))
	}
}

func TestMonitorSchedulerRespectsConcurrencyLimit(t *testing.T) {
	start := time.Date(2026, 5, 26, 10, 0, 0, 0, time.UTC)
	scheduler := newMonitorScheduler()
	scheduler.sync([]monitor.Config{
		{ID: "monitor-1", Interval: 60},
		{ID: "monitor-2", Interval: 60},
		{ID: "monitor-3", Interval: 60},
	}, start)

	claimed := scheduler.claimDue(start, 2)
	if len(claimed) != 2 {
		t.Fatalf("claimed %d monitors, want 2", len(claimed))
	}
	if scheduler.runningCount() != 2 {
		t.Fatalf("running count = %d, want 2", scheduler.runningCount())
	}

	remaining := scheduler.claimDue(start, 1)
	if len(remaining) != 1 {
		t.Fatalf("remaining count = %d, want 1", len(remaining))
	}
}
