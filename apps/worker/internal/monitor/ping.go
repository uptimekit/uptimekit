package monitor

import (
	"runtime"
	"time"

	probing "github.com/prometheus-community/pro-bing"
)

// PingMonitor implements ICMP ping monitoring.
type PingMonitor struct{}

// NewPingMonitor creates a new Ping monitor.
func NewPingMonitor() *PingMonitor {
	return &PingMonitor{}
}

// Check performs an ICMP ping to the specified host.
func (m *PingMonitor) Check(cfg Config) Result {
	result := Result{
		MonitorID: cfg.ID,
		Status:    StatusDown,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	if cfg.Hostname == "" {
		result.Error = "missing hostname"
		return result
	}

	timeout := time.Duration(cfg.Timeout) * time.Second
	if timeout == 0 {
		timeout = 10 * time.Second
	}

	pinger, err := probing.NewPinger(cfg.Hostname)
	if err != nil {
		result.Error = "failed to create pinger: " + err.Error()
		return result
	}

	// Configure pinger
	pinger.Count = 3
	pinger.Timeout = timeout

	// On Windows, we need privileged mode (requires admin)
	// On Linux/Mac, unprivileged mode works
	if runtime.GOOS == "windows" {
		pinger.SetPrivileged(true)
	} else {
		pinger.SetPrivileged(false)
	}

	start := time.Now()
	err = pinger.Run()
	elapsed := time.Since(start)

	if err != nil {
		// Provide helpful error message for Windows users
		if runtime.GOOS == "windows" {
			result.Error = "ping failed (run as Administrator): " + err.Error()
		} else {
			result.Error = err.Error()
		}
		result.Latency = elapsed.Milliseconds()
		return result
	}

	stats := pinger.Statistics()

	// Check if we received any replies
	if stats.PacketsRecv == 0 {
		result.Error = "no reply received"
		result.Latency = elapsed.Milliseconds()
		return result
	}

	// Use average RTT as latency
	result.Latency = stats.AvgRtt.Milliseconds()
	result.Status = StatusUp

	return result
}
