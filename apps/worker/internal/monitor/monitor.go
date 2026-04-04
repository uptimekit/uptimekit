package monitor

// Monitor is the interface that all monitor types must implement.
// Each monitor type (HTTP, TCP, ICMP, etc.) implements this interface.
type Monitor interface {
	// Check performs a single check and returns the result.
	Check(config Config) Result
}

// Config represents a monitor configuration received from the API.
// Fields are optional depending on monitor type - use what you need.
type Config struct {
	ID                  string      `json:"id"`
	Type                string      `json:"type"`
	URL                 string      `json:"url,omitempty"`
	Hostname            string      `json:"hostname,omitempty"` // For TCP, Ping monitors
	Port                int         `json:"port,omitempty"`     // For TCP monitor
	Timeout             int         `json:"timeout"`            // seconds
	Interval            int         `json:"interval"`           // seconds
	Method              string      `json:"method,omitempty"`   // HTTP method
	Headers             interface{} `json:"headers,omitempty"`  // HTTP headers (can be map or empty array)
	Body                string      `json:"body,omitempty"`     // Request body
	AcceptedStatusCodes string      `json:"acceptedStatusCodes,omitempty"`
	Keyword             string      `json:"keyword,omitempty"`       // For keyword monitor
	JSONPath            string      `json:"jsonPath,omitempty"`      // For JSON monitor
	ExpectedValue       string      `json:"expectedValue,omitempty"` // For JSON value validation
}

// GetHeaders returns headers as map[string]string, handling various API formats.
func (c *Config) GetHeaders() map[string]string {
	if c.Headers == nil {
		return nil
	}
	// Try to convert to map
	if m, ok := c.Headers.(map[string]interface{}); ok {
		result := make(map[string]string)
		for k, v := range m {
			if str, ok := v.(string); ok {
				result[k] = str
			}
		}
		return result
	}
	return nil
}

// Timings contains detailed timing breakdown for HTTP requests.
// All values are in milliseconds.
type Timings struct {
	DNSLookup    int64 `json:"dnsLookup"`    // DNS resolution time
	TCPConnect   int64 `json:"tcpConnect"`   // TCP connection time
	TLSHandshake int64 `json:"tlsHandshake"` // TLS handshake time (0 for HTTP)
	TTFB         int64 `json:"ttfb"`         // Time to first byte
	Transfer     int64 `json:"transfer"`     // Content transfer time
	Total        int64 `json:"total"`        // Total request time
}

// CertificateInfo contains SSL certificate details.
type CertificateInfo struct {
	Domain          string `json:"domain"`
	Issuer          string `json:"issuer"`
	ValidFrom       string `json:"validFrom"`
	ValidTo         string `json:"validTo"`
	DaysUntilExpiry int    `json:"daysUntilExpiry"`
	IsValid         bool   `json:"isValid"`
	Error           string `json:"error,omitempty"`
}

// Result represents the outcome of a monitor check.
type Result struct {
	MonitorID       string           `json:"monitorId"`
	Status          string           `json:"status"` // "up" or "down"
	Latency         int64            `json:"latency"`
	Timings         *Timings         `json:"timings,omitempty"`
	StatusCode      int              `json:"statusCode,omitempty"`
	Error           string           `json:"error,omitempty"`
	Timestamp       string           `json:"timestamp"`
	CertificateInfo *CertificateInfo `json:"certificateInfo,omitempty"`
}

// Status constants
const (
	StatusUp   = "up"
	StatusDown = "down"
)
