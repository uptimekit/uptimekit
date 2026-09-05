package monitor

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHTTPMonitorResponseTransfer(t *testing.T) {
	for _, truncated := range []bool{false, true} {
		name := "complete"
		if truncated {
			name = "truncated"
		}
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if truncated {
					w.Header().Set("Content-Length", "100")
				}
				_, _ = w.Write([]byte("ok"))
			}))
			defer server.Close()
			result := NewHTTPMonitor().Check(Config{URL: server.URL, Timeout: 1})
			if truncated {
				if result.Status != StatusDown || !strings.Contains(result.Error, "failed to read response") {
					t.Fatalf("expected failed transfer, got %+v", result)
				}
			} else if result.Status != StatusUp {
				t.Fatalf("expected up, got %+v", result)
			}
			if result.StatusCode != 200 || result.Timings == nil {
				t.Fatalf("expected response diagnostics, got %+v", result)
			}
		})
	}
}
