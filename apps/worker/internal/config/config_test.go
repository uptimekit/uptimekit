package config

import "testing"

func TestLoadUsesDefaultMaxConcurrency(t *testing.T) {
	t.Setenv("WORKER_MAX_CONCURRENCY", "")

	cfg := Load()
	if cfg.MaxConcurrency != 20 {
		t.Fatalf("MaxConcurrency = %d, want 20", cfg.MaxConcurrency)
	}
}

func TestLoadReadsMaxConcurrency(t *testing.T) {
	t.Setenv("WORKER_MAX_CONCURRENCY", "7")

	cfg := Load()
	if cfg.MaxConcurrency != 7 {
		t.Fatalf("MaxConcurrency = %d, want 7", cfg.MaxConcurrency)
	}
}

func TestLoadRejectsInvalidMaxConcurrency(t *testing.T) {
	t.Setenv("WORKER_MAX_CONCURRENCY", "0")

	cfg := Load()
	if cfg.MaxConcurrency != 20 {
		t.Fatalf("MaxConcurrency = %d, want default 20", cfg.MaxConcurrency)
	}
}
