# Make Targets Guide

This repository uses a `Makefile` to simplify and standardize the orchestration of the various Docker containers, development scripts, and verification tests that make up the HeroBM platform.

Below is an overview of the primary commands available.

## Core Setup & Fast Initialization

- **`make setup-wizard`**
  The primary entry point. Triggers backend database schema initialization and generates your secure, one-time setup token, outputting a direct link to the Ops Portal web application. The frontend interactive wizard controls application settings, database extractions (`dlt`), schema compilation, and config payloads cleanly.
  
- **`make init`** / **`make init-no-extract`**
  Primarily utilized for headless/CI workflows or advanced developer rebuilds. Safely executes the old sequential initializations (`migrate elt seed`), bypassing the GUI. The `no-extract` variant safely skips the lengthy ABM `dlt` extraction phase for quick Drizzle DDL migration resets.

## Containerized Stacks (`up-*` and `down-*`)

HeroBM utilizes Docker Compose profiles to logically isolate different operational domains. The `make` commands cleanly wrap these targets.

- **`make up-db`** / **`make down-db`**
  The "Local Native" path. Starts only `postgres-custom` and `redis-broker`. Use this when you intend to run the API and Frontend locally via Node.js for maximum hot-reloading developer performance.

- **`make up-fe-api`** / **`make down-fe-api`**
  The "Full Containerization" path. Starts the `custom-api`, `ops-portal`, `postgres-custom`, and `redis-broker` fully containerized. Recommended for evaluation and ops.

- **`make up-external`** / **`make down-external`**
  Spins up the entire external suite (mock external backend, dedicated Redis caches, schedulers, and workers). This stack connects to the `app-net` to allow the HeroBM Worker to relay data, but otherwise operates independently.

- **`make up-queue`** / **`make down-queue`**
  Starts the `outbox-worker` container (which requires `redis-broker` and External systems to be running). The worker polls the HeroBM database and processes domain events via BullMQ.

- **`make up-all`** / **`make down-all`**
  A wildcard command that brings up absolutely every service across all profiles simultaneously (FE, API, Postgres, Redis, Queue, and External).

## Verification & Quality Gates

HeroBM uses a 4-tier verification hierarchy designed for speed, isolation, and confidence:

### Tier 1: Fast Pre-Commit Gate (< 25s)
- **`make verify-fast`**
  The standard task completion and pre-commit gate. Runs typechecking across all workspaces, cached ESLint, Spectral OpenAPI checks, fast unit tests (API PGlite + Ops Portal components), schema drift checks, and dependency completeness without requiring external Docker containers or live database provisioning.

### Tier 2: Subsystem Verification Gates (30–60s)
- **`make verify-api`**
  Runs backend typechecking, linting, OpenAPI checks, PGlite unit tests, and full End-to-End (`test-api-e2e`) integration tests against real PostgreSQL. Run this whenever modifying API controllers, services, DTOs, or database schemas.
- **`make verify-portal`**
  Runs frontend typechecking, ESLint, i18n/forms linting, UI unit tests, and Next.js production build (`build-portal`).
- **`make verify-pipeline`**
  Runs ELT extract/transform validation and data count reconciliation checks.

### Tier 3: Pre-Push & Release Gates (2–3m)
- **`make pre-push`** / **`make verify-all`**
  Runs full monorepo build (`build-all`), `verify-fast`, `test-api-e2e`, structural AST / security checks (`test-structural`), Knip dead-code checks, and database verification (`verify-db`).

### Tier 4: Heavy Regression (5–10m)
- **`make test-heavy`**
  Boots full isolated container stack and executes GL, inventory, and lifecycle fuzzing suites, webhook relay testing, and Playwright browser tests.

### Individual Fast Test Runners
- **`make check-all`** — Fast static analysis (typechecking + linting).
- **`make test-unit`** — Runs all unit tests (API PGlite + Ops Portal).
- **`make test-single`** / **`make test-single TEST=<name>`** — Runs a single test file by name or path. If `TEST` is omitted, reads the test target from `.test_target` (or `tmp/.test_target`).
- **`make test-structural`** — Runs structural architecture and security invariants.

## ELT Pipeline Commands

The pipeline orchestrating data integration from legacy MSSQL systems into the `herobm_core` database uses several targets:

- **`make extract`** — Runs the Python `dlt` pipeline locally to extract state.
- **`make transform`** — Executes `dbt run` locally to build the data marts.
- **`make elt`** — Runs full extraction, transformation, and schema generation chronologically.
- **`make elt-no-extract`** — Runs transformation and schema generation only, bypassing the Python extraction step.
