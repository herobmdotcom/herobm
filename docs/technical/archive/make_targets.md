---
id: tech-make-targets
title: "Makefile Targets & Commands Catalog"
description: "Reference catalog for all Makefile commands: setup, container management, migrations, verification gates, and testing suites."
category: "Architecture & Engineering"
order: 8
resource: "system"
action: "read"
tags: ["makefile", "commands", "build", "ci", "docker", "testing", "targets"]
---

# Make Targets Guide

This repository uses a `Makefile` to standardize the orchestration of Docker containers, development processes, and the 5-tier verification testing framework that powers the HeroBM platform.

---

## Core Setup & Initialization

- **`make fast-install`**
  Installs npm dependencies across all workspaces (`packages/shared`, `packages/db-schema`, `packages/sdk`, `apps/api`, `apps/ops-portal`, `apps/worker`).

- **`make init`**
  Initializes the platform environment: brings up PostgreSQL (`herobm-db`), runs database migrations, compiles TypeScript packages, and runs database seeds.

- **`make build`** / **`make build-all`**
  Compiles all monorepo packages (`shared`, `db-schema`, `sdk`) and applications.

---

## Containerized Stacks (`up-*` and `down-*`)

HeroBM uses Docker Compose with standardized container names (`herobm-db`, `herobm-redis`, `herobm-api`, `herobm-ui`, `herobm-outbox`):

- **`make up-db`** / **`make down-db`**
  Starts or stops the PostgreSQL container (`herobm-db`). Use this when running the API and Frontend locally with Node.js hot-reloading.

- **`make up-redis`** / **`make down-redis`**
  Starts or stops the Redis cache and message broker container (`herobm-redis`).

- **`make up-portal-api`** / **`make down-portal-api`**
  Starts or stops the containerized backend API (`herobm-api`) and frontend UI (`herobm-ui`).

- **`make up-worker`** / **`make down-worker`**
  Starts or stops the background outbox event and email dispatch worker (`herobm-outbox`).

- **`make up-all`** / **`make down-all`**
  Brings up the entire container stack simultaneously (`herobm-db`, `herobm-redis`, `herobm-api`, `herobm-ui`, `herobm-outbox`).

---

## Local Development Inner Loop

- **`make dev-api`** — Runs the NestJS API in local watch mode (`http://localhost:3000`).
- **`make dev-portal`** — Runs the Next.js Ops Portal in local development mode (`http://localhost:3001`).
- **`make dev-worker`** — Runs the background Outbox & Email worker in local watch mode.

---

## Verification & Quality Gates

HeroBM uses a 5-tier verification hierarchy designed for speed, isolation, and confidence:

### Tier 0: Dev Inner Loop (Sub-second to 5s)
- **`make check-types`** — Typechecks all workspaces without compiling code.
- **`make check-lint`** — Runs cached ESLint and Spectral OpenAPI linting.
- **`make check-docs`** — Audits route coverage and Markdown syntax across `docs/user/`.

### Tier 1: Fast Task / Pre-Commit Gate (< 25s)
- **`make verify-fast`**
  The standard mandatory pre-commit gate. Runs typechecking, cached ESLint, Spectral OpenAPI checks, in-memory unit tests (API PGlite + Ops Portal RTL), and schema drift checks.

### Tier 2: Subsystem Verification Gates (30–60s)
- **`make verify-api`** — Runs API typechecking, linting, OpenAPI checks, and unit tests.
- **`make verify-portal`** — Runs frontend typechecking, ESLint, UI unit tests, and Next.js production build (`build-portal`).
- **`make test-portal-e2e`** — Runs Ops Portal Playwright browser E2E tests against a running portal instance.

### Tier 3: Pre-Push & Release Gates (2–3m)
- **`make pre-push`** / **`make verify-all`**
  Runs full monorepo build, `verify-fast`, structural AST / security checks (`make test-structural`), and End-to-End test suites.
- **`make test-structural`**
  Runs all 121 AST structural architecture, security boundaries, and invariant tests in parallel.

### Tier 4: Heavy Regression (5–10m)
- **`make test-heavy`**
  Boots full isolated container stack and executes GL, inventory, and lifecycle fuzzing suites, email/webhook relay testing, and Playwright browser suites.

---

## Database & Schema Management

- **`make dev-db-generate NAME=<migration_name>`** — Generates Drizzle SQL migrations based on TypeScript schema changes in `packages/db-schema`.
- **`make dev-db-migrate`** — Applies pending SQL migrations to the active database.
- **`make seed`** — Executes database seed routines (`apps/api/src/seeds/run.ts`) to populate base master data and demo records.
