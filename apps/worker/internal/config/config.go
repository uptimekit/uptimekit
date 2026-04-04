package config

import (
	"errors"
	"os"
	"strconv"
)

// Config holds the worker configuration from environment variables.
type Config struct {
	APIKey        string
	DashboardURL  string
	CheckInterval int // seconds
}

// Load reads configuration from environment variables.
func Load() *Config {
	interval := 60
	if v := os.Getenv("CHECK_INTERVAL"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			interval = parsed
		}
	}

	dashboardURL := os.Getenv("DASHBOARD_URL")
	if dashboardURL == "" {
		dashboardURL = "http://localhost:3000"
	}

	return &Config{
		APIKey:        os.Getenv("WORKER_API_KEY"),
		DashboardURL:  dashboardURL,
		CheckInterval: interval,
	}
}

// Validate checks if required configuration is present.
func (c *Config) Validate() error {
	if c.APIKey == "" {
		return ErrMissingAPIKey
	}
	return nil
}

// ErrMissingAPIKey is returned when WORKER_API_KEY is not set.
var ErrMissingAPIKey = errors.New("missing WORKER_API_KEY environment variable")
