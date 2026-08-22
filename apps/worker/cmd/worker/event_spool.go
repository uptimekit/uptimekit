package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/uptimekit/worker/internal/monitor"
)

type eventSpool struct {
	path string
	mu   sync.Mutex
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
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.loadUnlocked()
}

func (s *eventSpool) loadUnlocked() ([]monitor.Result, error) {
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("reading event spool: %w", err)
	}

	return decodeEventSpool(data)
}

func decodeEventSpool(data []byte) ([]monitor.Result, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, nil
	}

	// Read the original JSON-array format so upgrades do not strand an
	// existing spool. New appends use newline-delimited JSON.
	if trimmed[0] == '[' {
		var results []monitor.Result
		if err := json.Unmarshal(trimmed, &results); err != nil {
			return nil, fmt.Errorf("decoding event spool: %w", err)
		}
		return results, nil
	}

	lines := bytes.Split(trimmed, []byte{'\n'})
	results := make([]monitor.Result, 0, len(lines))
	for _, line := range lines {
		line = bytes.TrimSpace(line)
		if len(line) == 0 {
			continue
		}

		var result monitor.Result
		if err := json.Unmarshal(line, &result); err != nil {
			return nil, fmt.Errorf("decoding event spool entry: %w", err)
		}
		results = append(results, result)
	}

	return results, nil
}

func (s *eventSpool) append(result monitor.Result) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) || len(bytes.TrimSpace(data)) == 0 {
		return s.appendLineUnlocked(result)
	}
	if err != nil {
		return fmt.Errorf("reading event spool before append: %w", err)
	}

	trimmed := bytes.TrimSpace(data)
	if trimmed[0] == '[' {
		results, err := decodeEventSpool(trimmed)
		if err != nil {
			return err
		}
		results = append(results, result)
		return s.replaceLinesUnlocked(results)
	}

	if _, err := decodeEventSpool(trimmed); err != nil {
		return err
	}
	if data[len(data)-1] != '\n' {
		results, err := decodeEventSpool(trimmed)
		if err != nil {
			return err
		}
		results = append(results, result)
		return s.replaceLinesUnlocked(results)
	}

	return s.appendLineUnlocked(result)
}

func (s *eventSpool) appendLineUnlocked(result monitor.Result) error {
	if err := s.ensureDirectoryUnlocked(); err != nil {
		return err
	}

	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("encoding event spool entry: %w", err)
	}
	data = append(data, '\n')

	file, err := os.OpenFile(s.path, os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0o600)
	if err != nil {
		return fmt.Errorf("opening event spool for append: %w", err)
	}
	if err := file.Chmod(0o600); err != nil {
		file.Close()
		return fmt.Errorf("setting event spool permissions: %w", err)
	}
	if _, err := file.Write(data); err != nil {
		file.Close()
		return fmt.Errorf("appending event spool entry: %w", err)
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return fmt.Errorf("syncing event spool entry: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("closing event spool after append: %w", err)
	}

	return nil
}

func (s *eventSpool) replace(results []monitor.Result) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(results) == 0 {
		return s.clearUnlocked()
	}

	return s.replaceLinesUnlocked(results)
}

func (s *eventSpool) replaceLinesUnlocked(results []monitor.Result) error {
	var data bytes.Buffer
	for _, result := range results {
		encoded, err := json.Marshal(result)
		if err != nil {
			return fmt.Errorf("encoding event spool: %w", err)
		}
		data.Write(encoded)
		data.WriteByte('\n')
	}

	if err := s.ensureDirectoryUnlocked(); err != nil {
		return err
	}

	temporary, err := os.CreateTemp(filepath.Dir(s.path), ".uptimekit-worker-events-*.tmp")
	if err != nil {
		return fmt.Errorf("creating temporary event spool: %w", err)
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)

	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		return fmt.Errorf("setting event spool permissions: %w", err)
	}
	if _, err := temporary.Write(data.Bytes()); err != nil {
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

func (s *eventSpool) removePrefix(count int) error {
	if count <= 0 {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	results, err := s.loadUnlocked()
	if err != nil {
		return err
	}
	if len(results) < count {
		return fmt.Errorf(
			"event spool contains %d results, cannot remove prefix of %d",
			len(results),
			count,
		)
	}

	return s.replaceLinesUnlocked(results[count:])
}

func (s *eventSpool) clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.clearUnlocked()
}

func (s *eventSpool) clearUnlocked() error {
	if err := os.Remove(s.path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("removing event spool: %w", err)
	}

	return nil
}

func (s *eventSpool) ensureDirectoryUnlocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return fmt.Errorf("creating event spool directory: %w", err)
	}

	return nil
}
