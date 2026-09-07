---
id: tech-observability
title: "Observability, Logging & Health Checks"
description: "Structured JSON logging, Docker log rotation, audit logging standards, and system health endpoints."
category: "Architecture & Engineering"
order: 12
resource: "system"
action: "read"
routes:
  - "/admin/event-queue"
tags: ["observability", "logging", "health", "metrics", "monitoring", "audit"]
---

# Observability Guide

HeroBM employs a local setup for observability: applications emit strictly formatted JSON logs directly to the Docker logging daemon, and simultaneously persist human-readable logs to an internal volume. This approach allows the system to remain lightweight while guaranteeing high-quality, structured logs can be ingested by any centralized monitoring platform (e.g. Datadog, Splunk) that a deployer chooses to attach to the Docker socket.

## Architecture

```text
HeroBM API, Worker, PostgreSQL
  │
  ├─► stdout/stderr ───────► Docker json-file driver (max-size 20m) ──► (Available to host / 3rd-party forwarders)
  │
  └─► File outputs ────────► /app/logs/*.log ──► admin/system-logs API ──► HeroBM Ops Portal UI
```

## Local File Logging

The application is optimized for small to mid-sized installations without requiring a heavy suite of monitoring containers (like Prometheus or Loki).

### How it works

1. **Dual Output**: The `FileLoggerService` inside the NestJS API and the `pino.multistream` configuration in the outbox worker emit formatted logs to both `stdout` and local files simultaneously. PostgreSQL behaves similarly via its native `logging_collector`.
2. **Persistent Logs**: Files are written to a mounted `./logs` volume (`api.log`, `worker.log`, and `postgres.log`), ensuring they survive container restarts.
3. **Container Safeguards**: In `docker-compose.yml`, the core services are restricted using Docker's native `json-file` logging driver (`max-size: 20m`, `max-file: 3`), ensuring a runaway loop won't exhaust the host's disk space.
4. **Ops Portal Integration**: The logs are exposed directly within the HeroBM UI over a secure REST endpoint.

### System Logs UI

Admins can view logs directly in the **System Logs** tab within the Ops Portal (`/admin/system-logs`).
The endpoint `GET /api/admin/system-logs?service=x` uses the Casbin DAS (requiring `read` on the `system_logs` resource) to securely parse and return the last *N* lines from the selected log file (API, Worker, or Postgres). It strictly validates file targets and line limits to prevent path traversal and memory exhaustion.

## Running

```bash
make up
# or
podman compose up -d
```
The core application layer (API, Worker, Frontend), PostgreSQL database, and Redis cache will start, with native Docker logging active immediately.
