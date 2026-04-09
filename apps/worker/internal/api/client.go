package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/uptimekit/worker/internal/monitor"
)

const (
	defaultHTTPTimeout   = 30 * time.Second
	defaultMaxAttempts   = 4
	defaultBaseBackoff   = 500 * time.Millisecond
	defaultMaxBackoff    = 5 * time.Second
	defaultBackoffJitter = 0.2
)

// Client handles communication with the UptimeKit dashboard API.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	retry      retryConfig
	rng        *rand.Rand
}

type retryConfig struct {
	maxAttempts             int
	baseDelay               time.Duration
	maxDelay                time.Duration
	jitterFraction          float64
	retryTransportForUnsafe bool
}

type retryPolicy struct {
	retryTransportErrors bool
}

// NewClient creates a new API client.
func NewClient(baseURL, apiKey string) *Client {
	return newClient(baseURL, apiKey, retryConfig{
		maxAttempts:             defaultMaxAttempts,
		baseDelay:               defaultBaseBackoff,
		maxDelay:                defaultMaxBackoff,
		jitterFraction:          defaultBackoffJitter,
		retryTransportForUnsafe: false,
	})
}

func newClient(baseURL, apiKey string, retry retryConfig) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: defaultHTTPTimeout,
		},
		retry: retry,
		rng:   rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// HeartbeatResponse represents the response from heartbeat endpoint.
type HeartbeatResponse struct {
	Monitors []monitor.Config `json:"monitors"`
}

// Heartbeat sends a heartbeat to the dashboard and retrieves monitors to check.
func (c *Client) Heartbeat() ([]monitor.Config, error) {
	url := c.baseURL + "/api/worker/heartbeat"
	resp, err := c.doJSONRequest(
		context.Background(),
		http.MethodPost,
		url,
		[]byte("{}"),
		retryPolicy{retryTransportErrors: true},
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

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
	resp, err := c.doJSONRequest(
		context.Background(),
		http.MethodPost,
		url,
		body,
		retryPolicy{retryTransportErrors: c.retry.retryTransportForUnsafe},
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

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
	resp, err := c.doJSONRequest(
		context.Background(),
		http.MethodPost,
		url,
		body,
		retryPolicy{retryTransportErrors: c.retry.retryTransportForUnsafe},
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (c *Client) doJSONRequest(
	ctx context.Context,
	method string,
	url string,
	body []byte,
	policy retryPolicy,
) (*http.Response, error) {
	var lastErr error

	for attempt := 1; attempt <= c.retry.maxAttempts; attempt++ {
		req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("creating request: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			if !policy.retryTransportErrors || !shouldRetryError(err) || attempt == c.retry.maxAttempts {
				return nil, fmt.Errorf("sending request: %w", err)
			}

			lastErr = err
			if err := c.sleepBeforeRetry(ctx, attempt, 0); err != nil {
				return nil, fmt.Errorf("waiting to retry request: %w", err)
			}
			continue
		}

		if !shouldRetryStatus(resp.StatusCode) {
			if resp.StatusCode != http.StatusOK {
				respBody, _ := io.ReadAll(resp.Body)
				resp.Body.Close()
				return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
			}
			return resp, nil
		}

		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		lastErr = fmt.Errorf("unexpected status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
		if attempt == c.retry.maxAttempts {
			return nil, lastErr
		}

		retryAfter := parseRetryAfter(resp.Header.Get("Retry-After"))
		if err := c.sleepBeforeRetry(ctx, attempt, retryAfter); err != nil {
			return nil, fmt.Errorf("waiting to retry request: %w", err)
		}
	}

	if lastErr != nil {
		return nil, lastErr
	}

	return nil, errors.New("request failed without response")
}

func (c *Client) sleepBeforeRetry(ctx context.Context, attempt int, retryAfter time.Duration) error {
	delay := retryAfter
	if delay <= 0 {
		delay = c.backoffDelay(attempt)
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (c *Client) backoffDelay(attempt int) time.Duration {
	delay := c.retry.baseDelay
	for i := 1; i < attempt; i++ {
		delay *= 2
		if delay >= c.retry.maxDelay {
			delay = c.retry.maxDelay
			break
		}
	}

	jitterWindow := int64(float64(delay) * c.retry.jitterFraction)
	if jitterWindow <= 0 {
		return delay
	}

	jitterOffset := c.rng.Int63n((jitterWindow * 2) + 1)
	jittered := int64(delay) - jitterWindow + jitterOffset
	if jittered < 0 {
		return 0
	}

	return time.Duration(jittered)
}

func shouldRetryStatus(statusCode int) bool {
	switch statusCode {
	case http.StatusRequestTimeout, http.StatusTooEarly, http.StatusTooManyRequests,
		http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return true
	default:
		return statusCode >= 500
	}
}

func shouldRetryError(err error) bool {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}

	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return shouldRetryError(urlErr.Err)
	}

	var netErr interface{ Timeout() bool }
	if errors.As(err, &netErr) {
		return true
	}

	return true
}

func parseRetryAfter(value string) time.Duration {
	if value == "" {
		return 0
	}

	if seconds, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
		if seconds <= 0 {
			return 0
		}
		return time.Duration(seconds) * time.Second
	}

	if when, err := http.ParseTime(value); err == nil {
		delay := time.Until(when)
		if delay > 0 {
			return delay
		}
	}

	return 0
}
