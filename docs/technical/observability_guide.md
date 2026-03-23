# Observability Guide

ModBM employs a dual-stack approach to observability: a **Local Setup** for lightweight, default deployments, and a comprehensive **PLG Stack** (Prometheus, Loki, Grafana) for advanced monitoring. Both approaches are maintained simultaneously and can be toggled via Docker Compose profiles.

## Architecture

```text
ModBM API, Worker, PostgreSQL
  │
  ├─► stdout/stderr ───────► Docker json-file driver (max-size 20m) ──► Promtail (if PLG enabled) ──► Loki
  │                                                                                                     │
  └─► File outputs ────────► /app/logs/*.log ──► admin/system-logs API ──► ModBM Ops Portal UI          ▼
                                                                                                     Grafana
```

## Local File Logging (Default)

By default, the application runs without the heavy PLG stack. This is optimized for smaller installations where dedicating resources to 4 extra monitoring containers is overkill.

### How it works

1. **Dual Output**: The `FileLoggerService` inside the NestJS API and the `pino.multistream` configuration in the outbox worker emit formatted logs to both `stdout` and local files simultaneously. PostgreSQL behaves similarly via its native `logging_collector`.
2. **Persistent Logs**: Files are written to a mounted `./logs` volume (`api.log`, `worker.log`, and `postgres.log`), ensuring they survive container restarts.
3. **Container Safeguards**: In `docker-compose.yml`, the core services are restricted using Docker's native `json-file` logging driver (`max-size: 20m`, `max-file: 3`), ensuring a runaway loop won't exhaust the host's disk space.
4. **Ops Portal Integration**: The logs are exposed directly within the ModBM UI over a secure REST endpoint.

### System Logs UI

Admins can view logs directly in the **System Logs** tab within the Ops Portal (`/admin/system-logs`).
The endpoint `GET /api/admin/system-logs?service=x` uses the Casbin DAS (requiring `read` on the `system_logs` resource) to securely parse and return the last *N* lines from the selected log file (API, Worker, or Postgres). It strictly validates file targets and line limits to prevent path traversal and memory exhaustion.

## PLG Stack (Opt-in)

For larger deployments requiring aggregate metrics, centralized alerting, and long-term log retention, ModBM seamlessly integrates the PLG stack:
- **Prometheus**: Scrapes metrics from `/metrics` endpoints (API, Worker, Node exporter).
- **Loki**: Aggregates and indexes structured logs.
- **Promtail**: Scrapes Docker container stdout and pipeline output, forwarding it to Loki.
- **Grafana**: Visualizes metrics and logs.

### How it works

When the PLG stack is active, it relies on the exact same `stdout` stream that the applications emit by default. No code changes or application reconfigurations are required for the apps to "know" they are being monitored. 

The Constitution mandates that business logic never directly calls out to an external observability platform; it simply logs to stdout and local metrics endpoints, leaving the infrastructure layer responsible for scraping and parsing.

## How to switch between setups

The PLG services (`prometheus`, `loki`, `promtail`, `grafana`) are isolated under the `plg` Docker Compose profile.

### Run with Local Logging ONLY (Default)

```bash
make up
# or
podman compose up -d
```
Only the core application layer (API, Worker, Frontend), PostgreSQL database, and Redis cache will start.

### Run WITH the PLG Stack

```bash
make up-plg
# or
podman compose --profile plg up -d
```
All core services plus the 4 monitoring containers will start. You can immediately access Grafana at `http://localhost:3000`.
