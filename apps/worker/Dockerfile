# Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum first for better caching
COPY go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o worker ./cmd/worker

# Runtime stage
FROM alpine:3.19

WORKDIR /app

# Add CA certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN addgroup -S worker && adduser -S worker -G worker
USER worker

# Copy binary from builder
COPY --from=builder /app/worker .

# Run
CMD ["./worker"]
