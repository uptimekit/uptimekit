package monitor

import (
	"crypto/tls"
	"io"
	"net/http"
	"net/http/httptrace"
	"strconv"
	"strings"
	"time"
)

// HTTPMonitor implements HTTP/HTTPS monitoring with detailed timing.
type HTTPMonitor struct{}

// NewHTTPMonitor creates a new HTTP monitor.
func NewHTTPMonitor() *HTTPMonitor {
	return &HTTPMonitor{}
}

// Check performs an HTTP request and returns timing details.
func (m *HTTPMonitor) Check(cfg Config) Result {
	result := Result{
		MonitorID: cfg.ID,
		Status:    StatusDown,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	if cfg.URL == "" {
		result.Error = "missing URL"
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

	// Timing variables
	var (
		dnsStart, dnsDone   time.Time
		connStart, connDone time.Time
		tlsStart, tlsDone   time.Time
		gotFirstByte        time.Time
		requestStart        time.Time
		tlsState            *tls.ConnectionState
	)

	// Create HTTP trace for detailed timing
	trace := &httptrace.ClientTrace{
		DNSStart: func(_ httptrace.DNSStartInfo) {
			dnsStart = time.Now()
		},
		DNSDone: func(_ httptrace.DNSDoneInfo) {
			dnsDone = time.Now()
		},
		ConnectStart: func(_, _ string) {
			connStart = time.Now()
		},
		ConnectDone: func(_, _ string, _ error) {
			connDone = time.Now()
		},
		TLSHandshakeStart: func() {
			tlsStart = time.Now()
		},
		TLSHandshakeDone: func(state tls.ConnectionState, _ error) {
			tlsDone = time.Now()
			tlsState = &state
		},
		GotFirstResponseByte: func() {
			gotFirstByte = time.Now()
		},
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

	// Add custom headers first
	for key, value := range cfg.GetHeaders() {
		req.Header.Set(key, value)
	}

	// Set UptimeKit User-Agent AFTER custom headers to prevent override
	req.Header.Set("User-Agent", "UptimeKit-Worker/1.0 (+https://uptimekit.dev)")

	// Add trace to request
	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))

	// Create client with timeout
	client := &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Follow redirects but limit to 10
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	// Execute request
	requestStart = time.Now()
	resp, err := client.Do(req)
	requestEnd := time.Now()

	if err != nil {
		result.Latency = requestEnd.Sub(requestStart).Milliseconds()
		result.Error = err.Error()
		return result
	}
	defer resp.Body.Close()

	// Read body to complete transfer timing
	_, _ = io.Copy(io.Discard, resp.Body)
	transferDone := time.Now()

	// Calculate timings
	timings := &Timings{
		Total: transferDone.Sub(requestStart).Milliseconds(),
	}

	if !dnsDone.IsZero() && !dnsStart.IsZero() {
		timings.DNSLookup = dnsDone.Sub(dnsStart).Milliseconds()
	}
	if !connDone.IsZero() && !connStart.IsZero() {
		timings.TCPConnect = connDone.Sub(connStart).Milliseconds()
	}
	if !tlsDone.IsZero() && !tlsStart.IsZero() {
		timings.TLSHandshake = tlsDone.Sub(tlsStart).Milliseconds()
	}
	if !gotFirstByte.IsZero() {
		timings.TTFB = gotFirstByte.Sub(requestStart).Milliseconds()
	}
	if !gotFirstByte.IsZero() {
		timings.Transfer = transferDone.Sub(gotFirstByte).Milliseconds()
	}

	result.Latency = timings.Total
	result.Timings = timings
	result.StatusCode = resp.StatusCode

	// Check if status code is acceptable
	isUp := m.isStatusAcceptable(resp.StatusCode, cfg.AcceptedStatusCodes)

	if isUp {
		result.Status = StatusUp
	} else {
		result.Error = "HTTP " + strconv.Itoa(resp.StatusCode) + " " + resp.Status
	}

	// Extract certificate information for HTTPS connections
	if tlsState != nil && len(tlsState.PeerCertificates) > 0 {
		result.CertificateInfo = m.extractCertificateInfo(tlsState, cfg.URL)
	}

	return result
}

// extractCertificateInfo extracts SSL certificate details from TLS connection state.
func (m *HTTPMonitor) extractCertificateInfo(state *tls.ConnectionState, url string) *CertificateInfo {
	if len(state.PeerCertificates) == 0 {
		return &CertificateInfo{
			Error: "no peer certificates found",
		}
	}

	cert := state.PeerCertificates[0]
	now := time.Now()

	// Extract domain from URL
	domain := url
	if strings.HasPrefix(url, "https://") {
		domain = strings.TrimPrefix(url, "https://")
	} else if strings.HasPrefix(url, "http://") {
		domain = strings.TrimPrefix(url, "http://")
	}
	// Remove path and query
	if idx := strings.Index(domain, "/"); idx != -1 {
		domain = domain[:idx]
	}
	if idx := strings.Index(domain, "?"); idx != -1 {
		domain = domain[:idx]
	}

	// Calculate days until expiry
	daysUntilExpiry := int(cert.NotAfter.Sub(now).Hours() / 24)

	// Check if certificate is valid
	isValid := now.After(cert.NotBefore) && now.Before(cert.NotAfter)

	// Extract issuer
	issuer := cert.Issuer.CommonName
	if issuer == "" && len(cert.Issuer.Organization) > 0 {
		issuer = cert.Issuer.Organization[0]
	}

	return &CertificateInfo{
		Domain:          domain,
		Issuer:          issuer,
		ValidFrom:       cert.NotBefore.Format(time.RFC3339),
		ValidTo:         cert.NotAfter.Format(time.RFC3339),
		DaysUntilExpiry: daysUntilExpiry,
		IsValid:         isValid,
	}
}

// isStatusAcceptable checks if the status code matches accepted codes.
// Format: "200-299,301,302" or empty for default (200-299).
func (m *HTTPMonitor) isStatusAcceptable(code int, accepted string) bool {
	if accepted == "" {
		return code >= 200 && code < 300
	}

	ranges := strings.Split(accepted, ",")
	for _, r := range ranges {
		r = strings.TrimSpace(r)
		if strings.Contains(r, "-") {
			parts := strings.Split(r, "-")
			if len(parts) == 2 {
				min, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
				max, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
				if err1 == nil && err2 == nil && code >= min && code <= max {
					return true
				}
			}
		} else {
			if c, err := strconv.Atoi(r); err == nil && code == c {
				return true
			}
		}
	}

	return false
}
