.PHONY: help up down restart logs clean status ps nuke test-infra test-structural test-structural-local check-env extract extract-dry transform test-transform transform-select elt import-legacy extract-docker extract-docker-dry dev-api rebuild-api rebuild-portal dev-portal test-api test-api-cov test-api-e2e dev-docs-dbt dev-docs-schema dev-docs-api migrate migrate-status migrate-dry seed init init-env setup test-all build-all typecheck-portal build-api build-portal verify-api-only verify-portal check-logs-volume dev-local prod-local verify-local test-pipeline

define HELP_TEXT
HeroBM Makefile Help:
=========================================
Environment:
  make init-env       - Generate .env from .env.example
  make dev-local      - Start hot-reloading dev environment
  make prod-local     - Start production-like local environment

Containers (Podman):
  make up             - Start full stack (Portal + API + DB)
  make down           - Stop full stack
  make logs           - View container logs
  make clean          - Stop containers and remove volumes
  make nuke           - Complete teardown (containers, volumes, images)

Database & Migrations:
  make migrate        - Apply SQL migrations
  make migrate-status - Show migration status
  make seed           - Seed database with application data
  make init           - Full DB initialization (schema, migrate, seed, ELT)

Code Generation:
  make dev-generate-sdk - Regenerate OpenAPI spec and TypeScript SDK client
  make dev-db-generate NAME=name - Generate Drizzle SQL migration from schema

Cleanup & Rebuild:
  make clean-dev      - Wipe node_modules, caches, reinstall, and build shared
  make clean-build    - Full deep clean, reinstall, and build all workspaces

Verification & Testing:
  make verify-fast    - Run linting, typechecks, structural tests, unit tests
  make test-all       - Run all tests (unit, e2e, data, structural, heavy)
  make test-heavy     - Run heavy/long-running tests
  make test-structural- Run structural architecture and safety checks
  make test-single TEST=name - Run a single test file
  make test-api-e2e   - Run end-to-end API tests against real Postgres
  make check-all      - Run typechecks and linting
=========================================
endef
export HELP_TEXT

help:
	@node -e "console.log(process.env.HELP_TEXT)"
# Environment Profile Resolution
# 1. Command Line explicit (make ... PROFILE=staging)
# 2. Directory context file (.active_profile)
# 3. Fallback default (.env)
# NOTE: PROFILE is only honoured from the command line, never from the
#       shell environment. This prevents stray $env:PROFILE from silently
#       poisoning Make targets.
ifeq ($(OS),Windows_NT)
  ACTIVE_PROFILE := $(strip $(shell type .active_profile 2>nul))
  COMPOSE_OVERRIDE =
  DBT ?= $(CURDIR)/.venv/Scripts/dbt
  VENV_PYTHON ?= $(CURDIR)/.venv/Scripts/python
  PYTHON_CMD = python
  INIT_ENV_CMD = $(PYTHON_CMD) scripts/init_env.py
  DEV_LOCAL_CMD = powershell -ExecutionPolicy Bypass -File scripts/dev-local.ps1
  PROD_LOCAL_CMD = powershell -ExecutionPolicy Bypass -File scripts/prod-local.ps1
  CLEAN_BUILD_CMD = powershell -ExecutionPolicy Bypass -File scripts/clean-build.ps1
  COMPOSE_CMD = podman compose -f docker-compose.yml $(COMPOSE_OVERRIDE)
  BIND_IP ?= 127.0.0.1
else
  ACTIVE_PROFILE := $(strip $(shell cat .active_profile 2>/dev/null))
  COMPOSE_OVERRIDE =
  DBT ?= $(CURDIR)/.venv/bin/dbt
  VENV_PYTHON ?= $(CURDIR)/.venv/bin/python
  PYTHON_CMD = python3
  INIT_ENV_CMD = $(PYTHON_CMD) scripts/init_env.py
  DEV_LOCAL_CMD = bash scripts/dev-local.sh
  PROD_LOCAL_CMD = bash scripts/prod-local.sh
  CLEAN_BUILD_CMD = bash scripts/clean-build.sh
  COMPOSE_CMD = podman-compose -f docker-compose.yml $(COMPOSE_OVERRIDE)
  BIND_IP ?= 0.0.0.0
endif
export BIND_IP

# Only use PROFILE if it was passed on the command line (origin=command line),
# ignore it if it leaked in from the shell environment (origin=environment).
ifeq ($(origin PROFILE),command line)
  EFFECTIVE_PROFILE := $(PROFILE)
else
  EFFECTIVE_PROFILE := $(ACTIVE_PROFILE)
endif
ifeq ($(OS),Windows_NT)
  DEV_LOCAL_PROFILE_ARG = $(if $(EFFECTIVE_PROFILE),-TargetProfile $(EFFECTIVE_PROFILE))
else
  DEV_LOCAL_PROFILE_ARG = $(if $(EFFECTIVE_PROFILE),-Profile $(EFFECTIVE_PROFILE))
endif

ENV_FILE := $(if $(EFFECTIVE_PROFILE),.env.$(EFFECTIVE_PROFILE),.env)
-include $(ENV_FILE)
export
export PYTHONUTF8=1
export ENV_FILE

DBT_DIR = pipelines/$(SOURCE)_transform

# --- Container Stack (Podman) ---



# Ensure PostgreSQL log directory has correct permissions for rootless podman.
# Map UID 70 (postgres inside) correctly on host.
# This only runs on Linux/macOS to avoid impacting Windows hosts.
check-postgres-logs:
ifneq ($(OS),Windows_NT)
	@mkdir -p ./logs
	@podman unshare chown -R 70:70 ./logs
endif

# --------------------------------------------------------------------------
# Containerized Stacks
# --------------------------------------------------------------------------

# DB Backend Core (Local FE + API run path)
up-db: check-postgres-logs
	$(COMPOSE_CMD) up -d $(ARGS) postgres-custom redis-broker

down-db:
	$(COMPOSE_CMD) stop postgres-custom
	-podman rm -f postgres-custom

# Portal + API Core (The standard full-container app stack)
up-portal-api: check-postgres-logs
	$(COMPOSE_CMD) up -d $(ARGS) custom-api ops-portal postgres-custom redis-broker outbox-worker pipeline-runner

down-portal-api:
	$(COMPOSE_CMD) stop custom-api ops-portal postgres-custom redis-broker outbox-worker pipeline-runner
	-podman rm -f custom-api ops-portal postgres-custom redis-broker outbox-worker pipeline-runner



# Queue Worker (Outbox relay)
build-worker:
	podman build -t localhost/outbox-worker:latest -f apps/worker/Dockerfile .

up-redis: build-worker check-postgres-logs
	$(COMPOSE_CMD) --profile queue up -d outbox-worker

down-redis:
	$(COMPOSE_CMD) stop outbox-worker
	$(COMPOSE_CMD) rm -f outbox-worker

# Run absolutely everything
up-all: build-worker check-postgres-logs
	$(COMPOSE_CMD) --profile "*" up -d

down-all:
	$(COMPOSE_CMD) --profile "*" down

# Legacy aliases pointing to default Portal+API core
up: up-portal-api
down: down-portal-api
restart: down-all up-portal-api

logs:
	$(COMPOSE_CMD) logs -f

status:
	$(COMPOSE_CMD) ps

ps: status

clean:
	$(COMPOSE_CMD) down -v

nuke:
	$(COMPOSE_CMD) down -v --remove-orphans --rmi local

# Setup from scratch (Headless/CI): build API, apply schema migrations (DDL only),
# import ABM data via ELT, then seed application data (users, inventory).
# Prerequisites: 'make up' running, .env populated with all passwords.
# (init target defined further down alongside init-no-extract)



# Create the active profile database and base schemas on a running container
init-db:
	@echo "Initializing database: $(POSTGRES_DB)"
	@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -f /docker-entrypoint-initdb.d/init-schemas.sql

# Generate .env from .env.example with auto-generated local secrets.
init-env:
	$(INIT_ENV_CMD) $(if $(EFFECTIVE_PROFILE),--profile $(EFFECTIVE_PROFILE))

# --- ELT Pipeline ---

extract:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract SOURCE=abm|odoo))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py

extract-dry:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-dry SOURCE=abm|odoo))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py --dry-run

# Extract a single table: make extract-table SOURCE=abm TABLE=SGROUPS
extract-table:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-table SOURCE=abm|odoo TABLE=name))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py --table $(TABLE)

# Extract and transform a single table: make sync-table SOURCE=abm TABLE=SGROUPS MODEL=import_abm_customer_groups
sync-table:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make sync-table SOURCE=abm TABLE=name MODEL=name))
	$(if $(TABLE),,$(error Error: TABLE is required. Usage: make sync-table SOURCE=abm TABLE=name MODEL=name))
	$(if $(MODEL),,$(error Error: MODEL is required. Usage: make sync-table SOURCE=abm TABLE=name MODEL=name))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py --table $(TABLE)
	"$(DBT)" run --select +$(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform SOURCE=abm|odoo))
	"$(DBT)" run --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform-seed:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-seed SOURCE=abm|odoo))
	"$(DBT)" seed --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

test-transform:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make test-transform SOURCE=abm|odoo))
	"$(DBT)" test --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

# Rebuild a single model: make transform-select SOURCE=abm MODEL=import_accounts
transform-select:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-select SOURCE=abm|odoo MODEL=name))
	"$(DBT)" run --select $(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform-refresh:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-refresh SOURCE=abm|odoo MODEL=name))
	"$(DBT)" run --select $(MODEL) --full-refresh --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

elt: extract transform import-legacy dev-docs-schema
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make elt SOURCE=abm|odoo))
	"$(VENV_PYTHON)" tools/elt_report.py --source $(SOURCE)

elt-no-extract: transform import-legacy dev-docs-schema
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make elt-no-extract SOURCE=abm|odoo))
	"$(VENV_PYTHON)" tools/elt_report.py --source $(SOURCE)

import-legacy:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make import-legacy SOURCE=abm|odoo))
	"$(DBT)" run --select tag:import --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quotes --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quote_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_purchase_order_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

# --- Schema Reference & Docs ---

dev-docs-dbt:
	"$(VENV_PYTHON)" tools/dbt_docs_generate.py

dev-docs-schema: dev-docs-dbt
	"$(VENV_PYTHON)" tools/generate_schema_reference.py

dev-docs-api: build-api
	@echo "Generating OpenAPI spec from source..."
	node apps/api/dist/scripts/generate-openapi.js

dev-generate-sdk: dev-docs-api
	@echo "Generating TypeScript SDK..."
	npm run generate --workspace=@herobm/sdk
	@echo "Building TypeScript SDK..."
	npm run build --workspace=@herobm/sdk

dev-db-generate:
	$(if $(NAME),,$(error Error: NAME is required. Usage: make dev-db-generate NAME=migration_name))
	npx tsx tools/generate_migration.ts $(NAME)
# --- ELT Pipeline (Container) ---

extract-docker:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-docker SOURCE=abm|odoo))
	$(COMPOSE_CMD) --profile pipeline run --rm $(SOURCE)-extract

extract-docker-dry:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-docker-dry SOURCE=abm|odoo))
	$(COMPOSE_CMD) --profile pipeline run --rm $(SOURCE)-extract --dry-run

# --- Local Development ---
# Hot-reloads FE and API natively, assuming database containers are running.
dev-local:
	$(DEV_LOCAL_CMD) $(DEV_LOCAL_PROFILE_ARG) $(ARGS)

# Production-like local environment. Builds both FE and API and runs them locally.
prod-local: build-api build-portal
	$(PROD_LOCAL_CMD) $(DEV_LOCAL_PROFILE_ARG) $(ARGS)

dev-api:
	node --env-file=.env apps/api/dist/main.js

dev-mcp:
	node --env-file=.env apps/mcp-server/dist/index.js

rebuild-api:
	podman build -t localhost/herobm_custom-api:latest -f Dockerfile.api .
	-podman stop custom-api
	-podman rm custom-api
	$(COMPOSE_CMD) up -d --no-build --no-deps custom-api
	$(COMPOSE_CMD) ps

rebuild-portal:
	podman build -t localhost/herobm_ops-portal:latest -f Dockerfile.portal .
	-podman stop ops-portal
	-podman rm ops-portal
	$(COMPOSE_CMD) up -d --no-build --no-deps ops-portal
	$(COMPOSE_CMD) ps

rebuild-pipeline:
	podman build -t localhost/herobm_pipeline-runner:latest -f Dockerfile.pipeline .
	-podman stop pipeline-runner
	-podman rm pipeline-runner
	$(COMPOSE_CMD) up -d --no-build --no-deps pipeline-runner
	$(COMPOSE_CMD) ps

USE_PGLITE ?= true

ifeq ($(USE_PGLITE),true)
  TEST_API_TARGET = test:pglite
else
  TEST_API_TARGET = test
endif

# E2E tests always run against real Postgres.
# PGlite (WASM) is too slow for multi-step transactional workflows
# (order → pick → ship → invoice → return) that execute dozens of
# queries per request. Unit tests use PGlite for fast isolation.
TEST_E2E_TARGET = test:e2e

test-api-unit:
	npm run $(TEST_API_TARGET) -w apps/api

test-api-cov:
	npm run test:cov -w apps/api

test-api-e2e:
	@echo "[e2e-preflight] ENV_FILE=$(ENV_FILE) EFFECTIVE_PROFILE=$(EFFECTIVE_PROFILE) POSTGRES_DB=$(POSTGRES_DB) USE_PGLITE=$(USE_PGLITE)"
	npm run $(TEST_E2E_TARGET) -w apps/api

# --- Portal (unified, containerised) ---

# Debug build: runs next dev inside a container for unminified errors.
# Use when the production portal crashes with cryptic minified errors.
dev-portal:
	podman build -t localhost/herobm_ops-portal:dev -f Dockerfile.portal.dev .
	-podman stop ops-portal
	-podman rm ops-portal
	podman run -d --name ops-portal --network herobm_default -p 127.0.0.1:4300:3000 --env-file .env localhost/herobm_ops-portal:dev
	@echo "Portal running in DEV mode at http://localhost:4300 (unminified errors)"

# --- Migrations (herobm_core) ---

migrate:
	$(PYTHON_CMD) tools/migrate.py

migrate-status:
	$(PYTHON_CMD) tools/migrate.py --status

migrate-dry:
	$(PYTHON_CMD) tools/migrate.py --dry-run

seed:
	npm run seed

seed-demo:
	@echo "Running demo seed script..."
	npm run seed:demo -w apps/api

init: init-db migrate seed elt

init-no-extract: init-db migrate seed elt-no-extract

# --- Typechecks & Builds ---

typecheck-portal:
	npm run typecheck -w apps/ops-portal

build-api:
	npm run build -w apps/api

build-mcp:
	npm run build -w apps/mcp-server

build-portal:
	npm run build -w apps/ops-portal
ifeq ($(OS),Windows_NT)
	if exist apps\ops-portal\public xcopy /E /I /Y apps\ops-portal\public apps\ops-portal\.next\standalone\apps\ops-portal\public
	if exist apps\ops-portal\.next\static xcopy /E /I /Y apps\ops-portal\.next\static apps\ops-portal\.next\standalone\apps\ops-portal\.next\static
else
	[ -d apps/ops-portal/public ] && cp -r apps/ops-portal/public apps/ops-portal/.next/standalone/apps/ops-portal/public || true
	[ -d apps/ops-portal/.next/static ] && cp -r apps/ops-portal/.next/static apps/ops-portal/.next/standalone/apps/ops-portal/.next/static || true
endif

build-shared:
	npm run build -w packages/shared

build-sdk:
	npm run build -w packages/sdk

# --- Quality Gates & Verification ---

check-types: build-shared build-sdk
	@npm run typecheck -w apps/api
	@npm run typecheck -w apps/ops-portal

check-lint:
	@npm run lint -w apps/api
	@npm run lint -w apps/ops-portal
	@npm run lint:oas -w apps/api

	npm install
	$(MAKE) build-shared

clean-build:
	$(CLEAN_BUILD_CMD)
	npm install
	$(MAKE) build-shared
	$(MAKE) build-all

# --- CLI Specific Workflow (Granular & Explicit) ---

cli-help:
	@echo "HeroBM CLI Installation Sequence:"
	@echo "  1. make cli-install-prereqs  - Install OS-level tools"
	@echo "  2. make cli-init-env         - Create .env and secrets"
	@echo "  3. make cli-install-npm       - Install npm dependencies"
	@echo "  4. make cli-up-db            - Start containers"
	@echo "  5. make cli-init-db          - Initialize schemas (waits for PG)"
	@echo "  6. make cli-migrate          - Apply SQL migrations"
	@echo "  7. make cli-bootstrap        - Seed data & verify"
	@echo "  8. make up                   - Start FE and API containers"

cli-install-prereqs:
ifeq ($(OS),Windows_NT)
	powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
else
	bash scripts/setup.sh --non-interactive
endif

cli-init-env: init-env

cli-setup-python:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make cli-setup-python SOURCE=abm|odoo))
ifeq ($(OS),Windows_NT)
	if not exist .venv python -m venv .venv
	.venv\Scripts\pip install -r pipelines\$(SOURCE)_extract\requirements.txt
else
	[ ! -d .venv ] && python3 -m venv .venv || true
	.venv/bin/pip install -r pipelines/$(SOURCE)_extract/requirements.txt
endif

cli-install-npm:
	npm install

cli-up-db: up-db

cli-init-db:
	@echo "Waiting for Postgres to be ready..."
ifeq ($(OS),Windows_NT)
	@powershell -Command "for ($$i=1; $$i -le 30; $$i++) { if (podman exec postgres-custom pg_isready -U $(POSTGRES_USER)) { break } else { Write-Host \"Postgres is not ready yet... ($$i/30)\"; Start-Sleep -s 2 } }"
else
	@for i in $$(seq 1 30); do \
		podman exec postgres-custom pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1 && break || \
		(echo "Postgres is not ready yet... ($$i/30)" && sleep 2); \
	done
endif
	$(MAKE) init-db

cli-migrate: migrate

cli-bootstrap:
	$(MAKE) build-shared
	$(MAKE) build-api
	npm run seed
	$(MAKE) verify-db
	@"$(PYTHON_CMD)" -c "import os; env=dict(line.strip().split('=',1) for line in open('.env') if '=' in line and not line.strip().startswith('#')) if os.path.exists('.env') else {}; print('\n=============================================================\n  [SECURE] Admin Password:\n  ' + env.get('ADMIN_PASSWORD', 'UNKNOWN') + '\n  (This is also saved securely in your .env file)\n=============================================================\n') if env.get('ADMIN_PASSWORD') else None"

verify-db: migrate-status
	@echo "Verifying seeded system records..."
	@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -t -A -c "SELECT 'Admin User: ' || count(*) FROM herobm_core.users WHERE username = 'admin';"
	@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -t -A -c "SELECT 'Organization: ' || count(*) FROM herobm_core.organization;"

verify-all: build-all check-all verify-db test-all

verify-fast: check-all test-api-unit test-deps test-structural test-api-e2e

test-pipeline:
	@powershell -ExecutionPolicy Bypass -File scripts/test-pipeline.ps1

check-all: check-types check-lint

test-deps:
	python infra/tests/test_dependency_completeness.py

test-single:
	@npx tsx infra/test-utils/run-single.ts $(TEST)

test-structural:
	@python infra/tests/test_docker_env_alignment.py
	@npx tsx infra/test-utils/run-structural.ts

test-heavy:
	@npm run test:e2e -w apps/ops-portal
	@powershell -ExecutionPolicy Bypass -File scripts/run-heavy.ps1

test-data:
	"$(VENV_PYTHON)" infra/tests/test_data_counts.py

test-all: test-api-unit test-api-e2e test-deps test-structural test-heavy test-data

build-all:
	npm run build --workspaces --if-present

clean-dev:
	$(CLEAN_BUILD_CMD)
