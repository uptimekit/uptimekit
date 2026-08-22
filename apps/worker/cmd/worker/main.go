package main

import (
	"context"
	"hash/fnv"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/uptimekit/worker/internal/api"
	"github.com/uptimekit/worker/internal/config"
	"github.com/uptimekit/worker/internal/monitor"
)

const (
	schedulerTickInterval = time.Second
	workerShutdownTimeout = 30 * time.Second
)

type monitorState struct {
	config   monitor.Config
	nextDue  time.Time
	phase    time.Duration
	firstRun bool
	running  bool
	present  bool
}

type monitorScheduler struct {
	states map[string]*monitorState
}

func newMonitorScheduler() *monitorScheduler {
	return &monitorScheduler{
		states: make(map[string]*monitorState),
	}
}

func (s *monitorScheduler) sync(monitors []monitor.Config, now time.Time) {
	for _, state := range s.states {
		state.present = false
	}

	for _, cfg := range monitors {
		if cfg.ID == "" {
			continue
		}

		if state, ok := s.states[cfg.ID]; ok {
			state.config = cfg
			state.phase = monitorPhase(cfg.ID, checkInterval(cfg))
			state.present = true
			continue
		}

		s.states[cfg.ID] = &monitorState{
			config:   cfg,
			nextDue:  now,
			phase:    monitorPhase(cfg.ID, checkInterval(cfg)),
			firstRun: true,
			present:  true,
		}
	}

	for id, state := range s.states {
		if !state.present && !state.running {
			delete(s.states, id)
		}
	}
}

func (s *monitorScheduler) claimDue(now time.Time, limit int) []monitor.Config {
	due := make([]monitor.Config, 0)
	if limit <= 0 {
		return due
	}

	for _, state := range s.states {
		if len(due) >= limit {
			break
		}
		if !state.present {
			continue
		}

		if now.Before(state.nextDue) {
			continue
		}

		interval := checkInterval(state.config)
		if state.running {
			state.nextDue = nextDueAfter(now, state.nextDue, interval)
			continue
		}

		state.running = true
		if state.firstRun {
			state.nextDue = nextDueAtPhase(now, interval, state.phase)
			state.firstRun = false
		} else {
			state.nextDue = nextDueAfter(now, state.nextDue, interval)
		}
		due = append(due, state.config)
	}

	return due
}

func (s *monitorScheduler) runningCount() int {
	count := 0
	for _, state := range s.states {
		if state.running {
			count++
		}
	}
	return count
}

func (s *monitorScheduler) complete(id string) {
	if state, ok := s.states[id]; ok {
		state.running = false
		if !state.present {
			delete(s.states, id)
		}
	}
}

func nextDueAfter(now, due time.Time, interval time.Duration) time.Time {
	if due.IsZero() {
		due = now
	}

	for !due.After(now) {
		due = due.Add(interval)
	}

	return due
}

func nextDueAtPhase(now time.Time, interval, phase time.Duration) time.Time {
	if interval <= 0 {
		return now
	}

	base := now.Truncate(interval)
	next := base.Add(phase)
	if !next.After(now) {
		next = next.Add(interval)
	}

	return next
}

func monitorPhase(id string, interval time.Duration) time.Duration {
	if interval <= 0 || id == "" {
		return 0
	}

	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(id))
	return time.Duration(hasher.Sum64() % uint64(interval))
}

func checkInterval(cfg monitor.Config) time.Duration {
	if cfg.Interval <= 0 {
		return 60 * time.Second
	}

	return time.Duration(cfg.Interval) * time.Second
}

func retryInterval(cfg monitor.Config) time.Duration {
	if cfg.RetryInterval <= 0 {
		return 20 * time.Second
	}

	return time.Duration(cfg.RetryInterval) * time.Second
}

type runner struct {
	client         *api.Client
	registry       *monitor.Registry
	scheduler      *monitorScheduler
	events         *eventBatcher
	maxConcurrency int
	mu             sync.Mutex
	wg             sync.WaitGroup
}

func newRunner(
	client *api.Client,
	registry *monitor.Registry,
	maxConcurrency int,
) *runner {
	return &runner{
		client:         client,
		registry:       registry,
		scheduler:      newMonitorScheduler(),
		events:         newEventBatcher(client),
		maxConcurrency: maxConcurrency,
	}
}

func (r *runner) syncMonitors() {
	monitors, err := r.client.Heartbeat()
	if err != nil {
		log.Printf("Heartbeat failed: %v", err)
		return
	}

	r.mu.Lock()
	r.scheduler.sync(monitors, time.Now())
	r.mu.Unlock()

	log.Printf("Received %d monitors.", len(monitors))
}

func (r *runner) startDueChecks() {
	r.mu.Lock()
	available := r.maxConcurrency - r.scheduler.runningCount()
	due := r.scheduler.claimDue(time.Now(), available)
	r.mu.Unlock()

	if len(due) == 0 {
		return
	}

	log.Printf("Starting %d due monitor checks.", len(due))

	for _, cfg := range due {
		r.wg.Add(1)
		go r.checkAndPush(cfg)
	}
}

func (r *runner) checkAndPush(cfg monitor.Config) {
	defer r.wg.Done()
	defer func() {
		r.mu.Lock()
		r.scheduler.complete(cfg.ID)
		r.mu.Unlock()
	}()

	log.Printf("[DEBUG] Monitor ID=%s Type=%s URL=%q Hostname=%q Port=%d Timeout=%d Retries=%d RetryInterval=%d",
		cfg.ID, cfg.Type, cfg.URL, cfg.Hostname, cfg.Port, cfg.Timeout, cfg.Retries, cfg.RetryInterval)

	m := r.registry.Get(cfg.Type)
	if m == nil {
		log.Printf("No checker found for type: %s", cfg.Type)
		return
	}

	result := checkWithRetries(m, cfg, time.Sleep)
	log.Printf("[DEBUG] Result: ID=%s Status=%s Latency=%dms Error=%q",
		result.MonitorID, result.Status, result.Latency, result.Error)

	if err := r.events.Enqueue(result); err != nil {
		log.Printf("Could not durably queue event for monitor %s: %v", result.MonitorID, err)
	} else {
		log.Printf("Queued event for monitor %s.", result.MonitorID)
	}

	if result.CertificateInfo != nil {
		if err := r.client.PushCertificateInfo(result.MonitorID, result.CertificateInfo); err != nil {
			log.Printf("Push certificate info failed for monitor %s: %v", result.MonitorID, err)
		} else {
			log.Printf("Pushed certificate info for monitor %s (expires in %d days)",
				result.MonitorID, result.CertificateInfo.DaysUntilExpiry)
		}
	}
}

func (r *runner) wait(ctx context.Context) error {
	checksDone := make(chan struct{})
	go func() {
		r.wg.Wait()
		close(checksDone)
	}()

	select {
	case <-checksDone:
	case <-ctx.Done():
		return ctx.Err()
	}

	if r.events == nil {
		return nil
	}

	eventsDone := make(chan error, 1)
	go func() {
		eventsDone <- r.events.Close()
	}()

	select {
	case err := <-eventsDone:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func checkWithRetries(m monitor.Monitor, cfg monitor.Config, sleep func(time.Duration)) monitor.Result {
	attempts := cfg.Retries + 1
	if attempts < 1 {
		attempts = 1
	}

	var result monitor.Result
	for attempt := 1; attempt <= attempts; attempt++ {
		result = m.Check(cfg)
		if result.Status != monitor.StatusDown || attempt == attempts {
			return result
		}

		sleep(retryInterval(cfg))
	}

	return result
}

func main() {
	// Load .env file if it exists (ignore error if not found)
	_ = godotenv.Load()

	// Load configuration
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	// Create API client
	client := api.NewClient(cfg.DashboardURL, cfg.APIKey)

	// Create monitor registry
	registry := monitor.DefaultRegistry()
	runner := newRunner(client, registry, cfg.MaxConcurrency)

	log.Printf("Worker started. Dashboard: %s, Heartbeat sync interval: %ds, Max concurrency: %d", cfg.DashboardURL, cfg.CheckInterval, cfg.MaxConcurrency)

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutting down...")
		cancel()
	}()

	runner.syncMonitors()
	runner.startDueChecks()

	syncTicker := time.NewTicker(time.Duration(cfg.CheckInterval) * time.Second)
	defer syncTicker.Stop()

	schedulerTicker := time.NewTicker(schedulerTickInterval)
	defer schedulerTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Worker stopped.")
			shutdownCtx, shutdownCancel := context.WithTimeout(
				context.Background(),
				workerShutdownTimeout,
			)
			if err := runner.wait(shutdownCtx); err != nil {
				log.Printf("Worker shutdown did not complete: %v", err)
			}
			shutdownCancel()
			return
		case <-syncTicker.C:
			runner.syncMonitors()
			runner.startDueChecks()
		case <-schedulerTicker.C:
			runner.startDueChecks()
		}
	}
}
