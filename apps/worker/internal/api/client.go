package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/uptimekit/worker/internal/monitor"
)

// Client handles communication with the UptimeKit dashboard API.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new API client.
func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// HeartbeatResponse represents the response from heartbeat endpoint.
type HeartbeatResponse struct {
	Monitors []monitor.Config `json:"monitors"`
}

// Heartbeat sends a heartbeat to the dashboard and retrieves monitors to check.
func (c *Client) Heartbeat() ([]monitor.Config, error) {
	url := c.baseURL + "/api/worker/heartbeat"

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader([]byte("{}")))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response - REST API returns { monitors: [...] } directly
	var response struct {
		Monitors []monitor.Config `json:"monitors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	return response.Monitors, nil
}

// PushEventsRequest represents the request body for pushing events.
type PushEventsRequest struct {
	Events []monitor.Result `json:"events"`
}

// PushEvents sends monitor check results to the dashboard.
func (c *Client) PushEvents(results []monitor.Result) error {
	if len(results) == 0 {
		return nil
	}

	url := c.baseURL + "/api/worker/events"

	// REST API expects direct events array
	payload := PushEventsRequest{Events: results}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshaling events: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// PushCertificateInfo sends SSL certificate information to the dashboard.
func (c *Client) PushCertificateInfo(monitorID string, certInfo *monitor.CertificateInfo) error {
	if certInfo == nil {
		return nil
	}

	url := fmt.Sprintf("%s/api/worker/cert/%s", c.baseURL, monitorID)

	body, err := json.Marshal(certInfo)
	if err != nil {
		return fmt.Errorf("marshaling certificate info: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}
