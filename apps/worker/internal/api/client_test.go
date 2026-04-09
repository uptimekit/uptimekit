package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/uptimekit/worker/internal/monitor"
)

func TestHeartbeatRetriesTransientFailures(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempt := attempts.Add(1)
		if attempt < 3 {
			http.Error(w, "temporary failure", http.StatusServiceUnavailable)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"monitors": []map[string]any{},
		})
	}))
	defer server.Close()

	client := newClient(server.URL, "test-key", retryConfig{
		maxAttempts:    4,
		baseDelay:      time.Millisecond,
		maxDelay:       5 * time.Millisecond,
		jitterFraction: 0,
	})

	monitors, err := client.Heartbeat()
	if err != nil {
		t.Fatalf("Heartbeat() error = %v", err)
	}

	if len(monitors) != 0 {
		t.Fatalf("Heartbeat() monitors length = %d, want 0", len(monitors))
	}

	if got := attempts.Load(); got != 3 {
		t.Fatalf("attempt count = %d, want 3", got)
	}
}

func TestPushEventsRetriesRetryableStatusCodes(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempt := attempts.Add(1)
		if attempt == 1 {
			w.Header().Set("Retry-After", "0")
			http.Error(w, "rate limited", http.StatusTooManyRequests)
			return
		}

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := newClient(server.URL, "test-key", retryConfig{
		maxAttempts:    3,
		baseDelay:      time.Millisecond,
		maxDelay:       5 * time.Millisecond,
		jitterFraction: 0,
	})

	err := client.PushEvents([]monitor.Result{{MonitorID: "monitor-1"}})
	if err != nil {
		t.Fatalf("PushEvents() error = %v", err)
	}

	if got := attempts.Load(); got != 2 {
		t.Fatalf("attempt count = %d, want 2", got)
	}
}

func TestPushEventsDoesNotRetryClientErrors(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		http.Error(w, "bad request", http.StatusBadRequest)
	}))
	defer server.Close()

	client := newClient(server.URL, "test-key", retryConfig{
		maxAttempts:    3,
		baseDelay:      time.Millisecond,
		maxDelay:       5 * time.Millisecond,
		jitterFraction: 0,
	})

	err := client.PushEvents([]monitor.Result{{MonitorID: "monitor-1"}})
	if err == nil {
		t.Fatal("PushEvents() error = nil, want error")
	}

	if got := attempts.Load(); got != 1 {
		t.Fatalf("attempt count = %d, want 1", got)
	}
}
