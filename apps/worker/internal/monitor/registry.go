package monitor

import "sync"

// Registry manages available monitor implementations.
type Registry struct {
	mu       sync.RWMutex
	monitors map[string]Monitor
}

// NewRegistry creates a new monitor registry.
func NewRegistry() *Registry {
	return &Registry{
		monitors: make(map[string]Monitor),
	}
}

// Register adds a monitor implementation for a given type.
func (r *Registry) Register(monitorType string, m Monitor) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.monitors[monitorType] = m
}

// Get returns the monitor for a given type, or nil if not found.
func (r *Registry) Get(monitorType string) Monitor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.monitors[monitorType]
}

// DefaultRegistry creates a registry with all default monitors registered.
func DefaultRegistry() *Registry {
	r := NewRegistry()
	r.Register("http", NewHTTPMonitor())
	r.Register("tcp", NewTCPMonitor())
	r.Register("ping", NewPingMonitor())
	r.Register("keyword", NewKeywordMonitor())
	r.Register("http-json", NewJSONMonitor())
	return r
}
