package main

import (
	"context"
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

	log.Printf("Worker started. Dashboard: %s, Interval: %ds", cfg.DashboardURL, cfg.CheckInterval)

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

	// Run initial tick
	tick(client, registry)

	// Start ticker
	ticker := time.NewTicker(time.Duration(cfg.CheckInterval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Worker stopped.")
			return
		case <-ticker.C:
			tick(client, registry)
		}
	}
}

// tick performs a single check cycle.
func tick(client *api.Client, registry *monitor.Registry) {
	log.Println("Starting tick...")

	// Get monitors from dashboard
	monitors, err := client.Heartbeat()
	if err != nil {
		log.Printf("Heartbeat failed: %v", err)
		return
	}

	log.Printf("Received %d monitors.", len(monitors))

	if len(monitors) == 0 {
		return
	}

	// Check monitors concurrently
	var wg sync.WaitGroup
	results := make([]monitor.Result, 0, len(monitors))
	resultsChan := make(chan monitor.Result, len(monitors))

	for _, cfg := range monitors {
		wg.Add(1)
		go func(cfg monitor.Config) {
			defer wg.Done()

			// Debug: log full config
			log.Printf("[DEBUG] Monitor ID=%s Type=%s URL=%q Hostname=%q Port=%d Timeout=%d",
				cfg.ID, cfg.Type, cfg.URL, cfg.Hostname, cfg.Port, cfg.Timeout)

			m := registry.Get(cfg.Type)
			if m == nil {
				log.Printf("No checker found for type: %s", cfg.Type)
				return
			}

			result := m.Check(cfg)
			log.Printf("[DEBUG] Result: ID=%s Status=%s Latency=%dms Error=%q",
				result.MonitorID, result.Status, result.Latency, result.Error)
			resultsChan <- result
		}(cfg)
	}

	// Wait for all checks to complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	for result := range resultsChan {
		results = append(results, result)
	}

	// Push events
	if len(results) > 0 {
		if err := client.PushEvents(results); err != nil {
			log.Printf("Push events failed: %v", err)
		} else {
			log.Printf("Pushed %d events.", len(results))
		}

		// Push certificate information for HTTPS monitors
		for _, result := range results {
			if result.CertificateInfo != nil {
				if err := client.PushCertificateInfo(result.MonitorID, result.CertificateInfo); err != nil {
					log.Printf("Push certificate info failed for monitor %s: %v", result.MonitorID, err)
				} else {
					log.Printf("Pushed certificate info for monitor %s (expires in %d days)",
						result.MonitorID, result.CertificateInfo.DaysUntilExpiry)
				}
			}
		}
	}
}
