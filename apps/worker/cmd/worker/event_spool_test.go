package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/uptimekit/worker/internal/monitor"
)

func TestEventSpoolLoadsAndAppendsLegacyArray(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.json")
	if err := os.WriteFile(
		path,
		[]byte(`[{"monitorId":"legacy-monitor"}]`),
		0o600,
	); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	spool := newEventSpool(path)
	if err := spool.append(monitor.Result{MonitorID: "new-monitor"}); err != nil {
		t.Fatalf("append() error = %v", err)
	}

	results, err := spool.load()
	if err != nil {
		t.Fatalf("load() error = %v", err)
	}
	if len(results) != 2 ||
		results[0].MonitorID != "legacy-monitor" ||
		results[1].MonitorID != "new-monitor" {
		t.Fatalf("results = %#v, want legacy and appended results", results)
	}
}
