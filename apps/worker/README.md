> [!CAUTION]
> This project is no longer continued, because of lack of time for actively maintaining it. Checkout similar projects like [pongo](https://www.pongo.sh/) or [openstatus](https://www.openstatus.dev/), they did better job than I do, and are actively maintained

# UptimeKit Worker (Go)

The **UptimeKit Worker** is a high-performance, lightweight monitoring agent built in Go. It acts as the "distributed" part of the **UptimeKit** ecosystem, responsible for executing health checks and reporting performance metrics back to the UptimeKit Dashboard.

## What is UptimeKit?

[UptimeKit](https://github.com/uptimekit/uptimekit) is an open-source, self-hosted uptime monitoring platform. It provides a beautiful dashboard to track the availability and response times of your websites, APIs, and servers in real-time.

## The Role of the Worker

While the dashboard provides the UI and data storage, the **Worker** does the heavy lifting:

- **Distributed Checks**: Deploy multiple workers in different geographic regions to monitor latency and availability from multiple perspectives.
- **High Performance**: Written in Go, the worker uses goroutines to perform hundreds of concurrent checks with minimal resource footprint.
- **Heartbeat Protocol**: Automatically pulls monitor configurations from the dashboard and pushes results back securely.

## Supported Monitors

The worker supports a variety of check types:

- [x] **HTTP/HTTPS**: Standard website and API availability checks.
- [x] **TCP**: Connect to any port (e.g., SMTP, SSH, Redis).
- [x] **ICMP/Ping**: Network-level connectivity testing.
- [x] **Keyword Detection**: Search for specific text in the response body.
- [x] **HTTP JSON**: Validate specific JSON fields in the response.

## Getting Started

### 1. Requirements

- Go 1.25 or later (if building from source)
- An active [UptimeKit Dashboard](https://github.com/uptimekit/uptimekit) instance.

### 2. Configuration

The worker is configured via environment variables or a `.env` file.

| Variable | Description | Default |
|----------|-------------|---------|
| `WORKER_API_KEY` | API key generated in your UptimeKit Dashboard. | (required) |
| `DASHBOARD_URL` | The URL of your UptimeKit instance. | `http://localhost:3000` |
| `CHECK_INTERVAL` | Frequency (in seconds) to pull new monitor updates. | `60` |

### 3. Run with Docker

```bash
docker run -d \
  -e WORKER_API_KEY=your_key \
  -e DASHBOARD_URL=https://your-uptimekit.com \
  uptimekit/worker:latest
```

### 4. Build from Source

```bash
# Clone the repository
git clone https://github.com/uptimekit/worker.git
cd worker

# Run directly
go run ./cmd/worker

# Or build the binary
go build -o worker ./cmd/worker
./worker
```

## Architecture

1. **Dashboard** publishes monitoring tasks.
2. **Worker** fetches tasks via the `/heartbeat` API.
3. **Worker** executes checks (HTTP, TCP, etc.) concurrently.
4. **Worker** sends performance data and status changes back via the `/push-events` API.

---
Part of the [UptimeKit](https://github.com/uptimekit/uptimekit) project.
