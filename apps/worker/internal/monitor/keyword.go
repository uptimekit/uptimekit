package monitor

import (
	"io"
	"net/http"
	"strings"
	"time"
)

// KeywordMonitor implements HTTP monitoring with keyword search.
type KeywordMonitor struct{}

// NewKeywordMonitor creates a new Keyword monitor.
func NewKeywordMonitor() *KeywordMonitor {
	return &KeywordMonitor{}
}

// Check performs an HTTP request and checks for keyword presence.
func (m *KeywordMonitor) Check(cfg Config) Result {
	result := Result{
		MonitorID: cfg.ID,
		Status:    StatusDown,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	if cfg.URL == "" {
		result.Error = "missing URL"
		return result
	}

	if cfg.Keyword == "" {
		result.Error = "missing keyword"
		return result
	}

	timeout := time.Duration(cfg.Timeout) * time.Second
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	method := strings.ToUpper(cfg.Method)
	if method == "" {
		method = http.MethodGet
	}

	// Build request
	var bodyReader io.Reader
	if cfg.Body != "" {
		bodyReader = strings.NewReader(cfg.Body)
	}

	req, err := http.NewRequest(method, cfg.URL, bodyReader)
	if err != nil {
		result.Error = "invalid request: " + err.Error()
		return result
	}

	// Add custom headers
	for key, value := range cfg.GetHeaders() {
		req.Header.Set(key, value)
	}

	req.Header.Set("User-Agent", "UptimeKit-Worker/1.0 (+https://uptimekit.dev)")

	client := &http.Client{
		Timeout: timeout,
	}

	start := time.Now()
	resp, err := client.Do(req)
	elapsed := time.Since(start)

	result.Latency = elapsed.Milliseconds()

	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer resp.Body.Close()

	result.StatusCode = resp.StatusCode

	// Check HTTP status first
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		result.Error = "HTTP " + resp.Status
		return result
	}

	// Read body and search for keyword
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		result.Error = "failed to read response: " + err.Error()
		return result
	}

	if !strings.Contains(string(body), cfg.Keyword) {
		result.Error = "keyword not found"
		return result
	}

	result.Status = StatusUp
	return result
}
