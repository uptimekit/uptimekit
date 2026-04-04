package monitor

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/PaesslerAG/gval"
	"github.com/PaesslerAG/jsonpath"
)

// JSONMonitor implements HTTP JSON response validation monitoring.
type JSONMonitor struct{}

// NewJSONMonitor creates a new JSON monitor.
func NewJSONMonitor() *JSONMonitor {
	return &JSONMonitor{}
}

// Check performs an HTTP request and validates JSON response using JSONPath expression.
// The jsonPath field should contain a full expression like: $.status == "ok"
func (m *JSONMonitor) Check(cfg Config) Result {
	result := Result{
		MonitorID: cfg.ID,
		Status:    StatusDown,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	if cfg.URL == "" {
		result.Error = "missing URL"
		return result
	}

	if cfg.JSONPath == "" {
		result.Error = "missing JSONPath expression"
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

	// Read and parse JSON
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		result.Error = "failed to read response: " + err.Error()
		return result
	}

	var jsonData interface{}
	if err := json.Unmarshal(body, &jsonData); err != nil {
		result.Error = "invalid JSON response: " + err.Error()
		return result
	}

	// Create gval language with JSONPath support
	lang := gval.Full(jsonpath.Language())

	// Evaluate the expression (e.g., "$.status == \"ok\"")
	value, err := lang.Evaluate(cfg.JSONPath, jsonData)
	if err != nil {
		result.Error = "expression evaluation failed: " + err.Error()
		return result
	}

	// Check if result is boolean true
	switch v := value.(type) {
	case bool:
		if v {
			result.Status = StatusUp
		} else {
			result.Error = "expression evaluated to false"
		}
	default:
		// If not boolean, check if value is truthy (not nil/empty)
		if value != nil {
			result.Status = StatusUp
		} else {
			result.Error = "expression returned nil"
		}
	}

	return result
}
