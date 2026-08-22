package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/uptimekit/worker/internal/monitor"
)

type eventSpool struct {
	path string
}

func newEventSpool(path string) *eventSpool {
	return &eventSpool{path: path}
}

func defaultEventSpoolPath() string {
	if path := os.Getenv("WORKER_EVENT_SPOOL_PATH"); path != "" {
		return path
	}

	dashboardURL := os.Getenv("DASHBOARD_URL")
	if dashboardURL == "" {
		dashboardURL = "http://localhost:3000"
	}
	apiKey := os.Getenv("WORKER_API_KEY")
	digest := sha256.Sum256([]byte(dashboardURL + "\x00" + apiKey))
	identity := hex.EncodeToString(digest[:8])

	return filepath.Join(os.TempDir(), "uptimekit-worker-events-"+identity+".json")
}

func (s *eventSpool) load() ([]monitor.Result, error) {
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("reading event spool: %w", err)
	}
	if len(data) == 0 {
		return nil, nil
	}

	var results []monitor.Result
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, fmt.Errorf("decoding event spool: %w", err)
	}

	return results, nil
}

func (s *eventSpool) replace(results []monitor.Result) error {
	if len(results) == 0 {
		return s.clear()
	}

	data, err := json.Marshal(results)
	if err != nil {
		return fmt.Errorf("encoding event spool: %w", err)
	}

	directory := filepath.Dir(s.path)
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return fmt.Errorf("creating event spool directory: %w", err)
	}

	temporary, err := os.CreateTemp(directory, ".uptimekit-worker-events-*.tmp")
	if err != nil {
		return fmt.Errorf("creating temporary event spool: %w", err)
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)

	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		return fmt.Errorf("setting event spool permissions: %w", err)
	}
	if _, err := temporary.Write(data); err != nil {
		temporary.Close()
		return fmt.Errorf("writing event spool: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		temporary.Close()
		return fmt.Errorf("syncing event spool: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("closing event spool: %w", err)
	}

	if err := os.Rename(temporaryPath, s.path); err != nil {
		return fmt.Errorf("installing event spool: %w", err)
	}

	return nil
}

func (s *eventSpool) clear() error {
	if err := os.Remove(s.path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("removing event spool: %w", err)
	}

	return nil
}
