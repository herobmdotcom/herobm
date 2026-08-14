.PHONY: help check-postgres-logs up-db down-db up-portal-api down-portal-api build-worker up-redis down-redis up-maildev down-maildev up-all down-all up down restart logs status ps clean nuke rebuild-db-keep-raw init-db init-env extract extract-dry extract-table sync-table transform transform-seed test-transform transform-dry transform-select transform-select-dry transform-refresh elt elt-no-extract import-legacy import-legacy-shipments dev-docs-schema dev-docs-api dev-generate-sdk dev-db-generate generate-extensions extract-docker extract-docker-dry dev-local prod-local dev-api dev-mcp dev-pipeline rebuild-api rebuild-portal rebuild-pipeline rebuild-worker build-images rebuild-apps pre-push test-api-unit test-portal-unit test-api-cov test-api-e2e dev-portal migrate check-schema-drift migrate-status migrate-dry seed seed-demo init typecheck-portal build-api build-mcp build-portal build-shared build-db-schema build-sdk check-types check-lint verify-i18n clean-build cli-help cli-install-prereqs cli-init-env cli-setup-python cli-install-npm cli-up-db cli-init-db cli-migrate cli-bootstrap verify-db verify-all verify-fast test-pipeline check-all test-deps test-single test-structural query-drizzle query-postgres test-heavy test-data test-all build-all clean-dev

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
  make clean          - Stop containers (volumes are preserved)
  make nuke           - Complete teardown (containers, volumes, images)

Database & Migrations:
  make migrate        - Apply SQL migrations
  make migrate-status - Show migration status
  make seed           - Seed database with application data
  make init           - Full DB initialization (schema, migrate, seed, ELT)
  make rebuild-db-keep-raw - Rebuild app DB from raw data without re-extracting

Code Generation:
  make dev-generate-sdk - Regenerate OpenAPI spec and TypeScript SDK client
  make dev-db-generate NAME=name - Generate Drizzle SQL migration from schema
  make generate-extensions - Generate extension registry bindings

Cleanup & Rebuild:
  make clean-dev      - Wipe node_modules, caches, reinstall, and build shared
  make clean-build    - Full deep clean, reinstall, and build all workspaces

Verification & Testing:
  make verify-fast    - Run linting, typechecks, unit tests
  make test-all       - Run all tests (unit, e2e, data, structural, heavy)
  make test-heavy     - Run structural tests and heavy/long-running tests
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
  TEST_PIPELINE_CMD = powershell -ExecutionPolicy Bypass -File scripts/test-pipeline.ps1
  TEST_HEAVY_CMD = powershell -ExecutionPolicy Bypass -File scripts/run-heavy.ps1 $(if $(SKIP_UI),-SkipUI) $(if $(TEST),-TestName "$(TEST)")
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
  TEST_PIPELINE_CMD = bash scripts/test-pipeline.sh
  TEST_HEAVY_CMD = bash scripts/run-heavy.sh $(if $(SKIP_UI),--skip-ui) $(if $(TEST),--test "$(TEST)")
  COMPOSE_CMD = $(shell if command -v podman-compose >/dev/null 2>&1; then echo "podman-compose"; elif [ -x ~/.local/bin/podman-compose ]; then echo "~/.local/bin/podman-compose"; else echo "podman compose"; fi) -f docker-compose.yml $(COMPOSE_OVERRIDE)
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
	-@podman unshare chown -R 70:70 ./logs 2>/dev/null || true
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
	$(COMPOSE_CMD) up -d $(ARGS) herobm-api herobm-ui postgres-custom redis-broker herobm-outbox herobm-pipeline

down-portal-api:
	$(COMPOSE_CMD) stop herobm-api herobm-ui postgres-custom redis-broker herobm-outbox herobm-pipeline
	-podman rm -f herobm-api herobm-ui postgres-custom redis-broker herobm-outbox herobm-pipeline





# Queue Worker (Outbox relay)
build-worker:
	podman build -t localhost/outbox-worker:latest -f Dockerfile.worker .

up-redis: build-worker check-postgres-logs
	$(COMPOSE_CMD) --profile queue up -d herobm-outbox

down-redis:
	$(COMPOSE_CMD) stop herobm-outbox
	$(COMPOSE_CMD) rm -f herobm-outbox

up-maildev:
	$(COMPOSE_CMD) --profile dev up -d maildev

down-maildev:
	$(COMPOSE_CMD) --profile dev stop maildev
	-podman rm -f maildev

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
	$(COMPOSE_CMD) down

nuke:
	@$(PYTHON_CMD) tools/confirm.py "WARNING: This will stop all containers and PERMANENTLY DELETE all volumes and local images. Continue?" $(if $(FORCE),--force,)
	$(COMPOSE_CMD) down -v --remove-orphans --rmi local

rebuild-db-keep-raw:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make rebuild-db-keep-raw SOURCE=<source>))
	@$(PYTHON_CMD) tools/confirm.py "WARNING: This will drop and rebuild the herobm_core database while preserving raw extracted data (raw_* schemas). Continue?" $(if $(FORCE),--force,)
	@echo "Resetting herobm_core and dbt transformation schemas..."
	@podman exec -i postgres-custom psql -U $(or $(POSTGRES_USER),postgres) -d $(or $(POSTGRES_DB),herobm) -c "DROP SCHEMA IF EXISTS herobm_core CASCADE; DROP SCHEMA IF EXISTS dbt_$(SOURCE)_transform CASCADE; CREATE SCHEMA herobm_core;"
	$(MAKE) migrate
	$(MAKE) seed
	$(MAKE) elt-no-extract SOURCE=$(SOURCE)

# Setup from scratch (Headless/CI): build API, apply schema migrations (DDL only),
# import source data via ELT, then seed application data (users, inventory).
# Prerequisites: 'make up' running, .env populated with all passwords.
# (init target defined further down alongside init-no-extract)



# Create the active profile database and base schemas on a running container
init-db:
	@echo "Ensuring database $(POSTGRES_DB) exists..."
	@podman exec -i postgres-custom sh -c "psql -U $(POSTGRES_USER) -d postgres -tc \"SELECT 1 FROM pg_database WHERE datname = '$(POSTGRES_DB)'\" | grep -q 1 || psql -U $(POSTGRES_USER) -d postgres -c \"CREATE DATABASE $(POSTGRES_DB)\""
	@echo "Initializing database: $(POSTGRES_DB)"
	@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -f /docker-entrypoint-initdb.d/init-schemas.sql

# Generate .env from .env.example with auto-generated local secrets.
init-env:
	$(INIT_ENV_CMD) $(if $(EFFECTIVE_PROFILE),--profile $(EFFECTIVE_PROFILE))

# --- ELT Pipeline ---

extract:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract SOURCE=<source>))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py

extract-dry:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-dry SOURCE=<source>))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py --dry-run

# Extract a single table: make extract-table SOURCE=<source> TABLE=<name>
extract-table:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-table SOURCE=<source> TABLE=<name>))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py --table $(TABLE)

# Extract and transform a single table: make sync-table SOURCE=<source> TABLE=<name> MODEL=<name>
sync-table:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make sync-table SOURCE=<source> TABLE=<name> MODEL=<name>))
	$(if $(TABLE),,$(error Error: TABLE is required. Usage: make sync-table SOURCE=<source> TABLE=<name> MODEL=<name>))
	$(if $(MODEL),,$(error Error: MODEL is required. Usage: make sync-table SOURCE=<source> TABLE=<name> MODEL=<name>))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py --table $(TABLE)
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --select +$(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform SOURCE=<source>))
	"$(DBT)" seed $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quotes --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quote_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_order_shipments --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_purchase_order_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform-seed:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-seed SOURCE=<source>))
	"$(DBT)" seed $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

test-transform:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make test-transform SOURCE=<source>))
	"$(DBT)" test $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform-dry:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-dry SOURCE=<source>))
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --empty --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform-select:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-select SOURCE=<source> MODEL=<name>))
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --select $(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform-select-dry:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-select-dry SOURCE=<source> MODEL=<name>))
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --empty --select $(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform-refresh:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-refresh SOURCE=<source> MODEL=<name>))
	"$(DBT)" run --select $(MODEL) --full-refresh --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

elt: extract transform import-legacy dev-docs-schema
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make elt SOURCE=<source>))
	"$(VENV_PYTHON)" tools/elt_report.py --source $(SOURCE)

elt-no-extract: transform import-legacy dev-docs-schema
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make elt-no-extract SOURCE=<source>))
	"$(VENV_PYTHON)" tools/elt_report.py --source $(SOURCE)

import-legacy:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make import-legacy SOURCE=<source>))
	"$(DBT)" run --select tag:import --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quotes --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quote_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_order_shipments --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_purchase_order_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

import-legacy-shipments:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make import-legacy-shipments SOURCE=<source>))
	"$(DBT)" run-operation sync_sales_order_shipments --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

# --- Schema Reference & Docs ---

dev-docs-schema:
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

generate-extensions:
	node apps/api/scripts/generate-extensions.mjs
	node apps/ops-portal/scripts/generate-extensions.mjs
# --- ELT Pipeline (Container) ---

extract-docker:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-docker SOURCE=<source>))
	$(COMPOSE_CMD) --profile pipeline run --rm $(SOURCE)-extract

extract-docker-dry:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-docker-dry SOURCE=<source>))
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

dev-pipeline:
	"$(VENV_PYTHON)" -m uvicorn pipelines.runner.server:app --port 8001 --reload

rebuild-api:
	podman build -t localhost/herobm_custom-api:latest -f Dockerfile.api .
	-$(COMPOSE_CMD) stop herobm-api custom-api
	-$(COMPOSE_CMD) rm -f herobm-api custom-api
	-podman stop herobm-api custom-api
	-podman rm -f herobm-api custom-api
	$(COMPOSE_CMD) up -d --no-build --no-deps herobm-api
	$(COMPOSE_CMD) ps

rebuild-portal:
	podman build -t localhost/herobm_ops-portal:latest -f Dockerfile.portal .
	-$(COMPOSE_CMD) stop herobm-ui ops-portal
	-$(COMPOSE_CMD) rm -f herobm-ui ops-portal
	-podman stop herobm-ui ops-portal
	-podman rm -f herobm-ui ops-portal
	$(COMPOSE_CMD) up -d --no-build --no-deps herobm-ui
	$(COMPOSE_CMD) ps

rebuild-pipeline:
	podman build -t localhost/herobm_pipeline-runner:latest -f Dockerfile.pipeline .
	-$(COMPOSE_CMD) stop herobm-pipeline pipeline-runner
	-$(COMPOSE_CMD) rm -f herobm-pipeline pipeline-runner
	-podman stop herobm-pipeline pipeline-runner
	-podman rm -f herobm-pipeline pipeline-runner
	$(COMPOSE_CMD) up -d --no-build --no-deps herobm-pipeline
	$(COMPOSE_CMD) ps

rebuild-worker:
	podman build -t localhost/outbox-worker:latest -f Dockerfile.worker .
	-$(COMPOSE_CMD) stop herobm-outbox outbox-worker
	-$(COMPOSE_CMD) rm -f herobm-outbox outbox-worker
	-podman stop herobm-outbox outbox-worker
	-podman rm -f herobm-outbox outbox-worker
	$(COMPOSE_CMD) up -d --no-build --no-deps herobm-outbox
	$(COMPOSE_CMD) ps

build-images:
	podman build -t localhost/herobm_custom-api:latest -f Dockerfile.api .
	podman build -t localhost/herobm_ops-portal:latest -f Dockerfile.portal .
	podman build -t localhost/herobm_pipeline-runner:latest -f Dockerfile.pipeline .
	podman build -t localhost/outbox-worker:latest -f Dockerfile.worker .

rebuild-apps: build-images
	-$(COMPOSE_CMD) stop herobm-api herobm-ui herobm-pipeline herobm-outbox custom-api ops-portal pipeline-runner outbox-worker
	-$(COMPOSE_CMD) rm -f herobm-api herobm-ui herobm-pipeline herobm-outbox custom-api ops-portal pipeline-runner outbox-worker
	-podman stop herobm-api herobm-ui herobm-pipeline herobm-outbox custom-api ops-portal pipeline-runner outbox-worker
	-podman rm -f herobm-api herobm-ui herobm-pipeline herobm-outbox custom-api ops-portal pipeline-runner outbox-worker
	-podman system prune -f
	$(MAKE) migrate
	$(COMPOSE_CMD) up -d --no-build --no-deps herobm-api herobm-ui herobm-pipeline herobm-outbox
	$(COMPOSE_CMD) ps

pre-push: verify-all build-images

TEST_API_TARGET = test:pglite

# E2E tests always run against real Postgres.
# PGlite (WASM) is too slow for multi-step transactional workflows
# (order → pick → ship → invoice → return) that execute dozens of
# queries per request. Unit tests use PGlite for fast isolation.
TEST_E2E_TARGET = test:e2e

test-api-unit:
	npm run $(TEST_API_TARGET) -w apps/api

test-portal-unit:
	npm run test -w apps/ops-portal

test-api-cov:
	npm run test:cov -w apps/api

test-api-e2e:
	@echo "[e2e-preflight] ENV_FILE=$(ENV_FILE) EFFECTIVE_PROFILE=$(EFFECTIVE_PROFILE) POSTGRES_DB=$(POSTGRES_DB) USE_PGLITE=$(USE_PGLITE) TEST_API_URL=$(TEST_API_URL)"
	npm run $(TEST_E2E_TARGET) -w apps/api

# --- Portal (unified, containerised) ---

# Debug build: runs next dev inside a container for unminified errors.
# Use when the production portal crashes with cryptic minified errors.
dev-portal:
	podman build -t localhost/herobm_ops-portal:dev -f Dockerfile.portal.dev .
	-podman stop herobm-ui ops-portal
	-podman rm herobm-ui ops-portal
	podman run -d --name herobm-ui --network herobm_default -p 127.0.0.1:4300:3000 --env-file .env localhost/herobm_ops-portal:dev
	@echo "Portal running in DEV mode at http://localhost:4300 (unminified errors)"

# --- Migrations (herobm_core) ---

migrate: check-schema-drift
	$(PYTHON_CMD) tools/migrate.py

check-schema-drift: build-shared
	npx tsx tools/check_schema_drift.ts

migrate-status:
	$(PYTHON_CMD) tools/migrate.py --status

migrate-dry:
	$(PYTHON_CMD) tools/migrate.py --dry-run

seed:
	npm run seed

seed-demo:
	@echo "Running demo seed script..."
	npm run seed:demo -w apps/api

init: init-db migrate seed

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

build-db-schema:
	npm run build -w packages/db-schema

build-sdk:
	npm run build -w packages/sdk

# --- Quality Gates & Verification ---

check-types: build-shared build-sdk build-db-schema
	@npm run typecheck -w apps/api
	@npm run typecheck -w apps/ops-portal

check-lint:
	@npm run lint -w apps/api
	@npm run lint -w apps/ops-portal
	@npm run lint:oas -w apps/api

verify-i18n:
	@npm run lint:i18n -w apps/ops-portal

clean-build:
	$(CLEAN_BUILD_CMD)
	npm install
	node scripts/install-native-deps.js
	$(MAKE) build-shared
	$(MAKE) build-db-schema
	$(MAKE) build-sdk
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
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make cli-setup-python SOURCE=<source>))
ifeq ($(OS),Windows_NT)
	if not exist .venv python -m venv .venv
	.venv\Scripts\pip install -r pipelines\$(SOURCE)_extract\requirements.txt
else
	[ ! -d .venv ] && python3 -m venv .venv || true
	.venv/bin/pip install -r pipelines/$(SOURCE)_extract/requirements.txt
endif

cli-install-npm:
	npm install
	node scripts/install-native-deps.js

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
	$(MAKE) build-db-schema
	$(MAKE) build-api
	npm run seed
	$(MAKE) verify-db
	@"$(PYTHON_CMD)" -c "import os; env_file = os.environ.get('ENV_FILE', '.env'); env=dict(line.strip().split('=',1) for line in open(env_file) if '=' in line and not line.strip().startswith('#')) if os.path.exists(env_file) else {}; print('\n=============================================================\n  [SECURE] Admin Password:\n  ' + env.get('ADMIN_PASSWORD', 'UNKNOWN') + '\n  (This is also saved securely in your ' + env_file + ' file)\n=============================================================\n') if env.get('ADMIN_PASSWORD') else None"

verify-db: migrate-status
	@echo "Verifying seeded system records..."
	@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -t -A -c "SELECT 'Admin User: ' || count(*) FROM herobm_core.users WHERE username = 'admin';"
	@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -t -A -c "SELECT 'Organization: ' || count(*) FROM herobm_core.organization;"

verify-all: build-all check-all verify-db test-all

# Supports skipping phases using environment variables, e.g. make verify-fast SKIP_CHECK=1 SKIP_UNIT=1
verify-fast: generate-extensions check-schema-drift $(if $(SKIP_CHECK),,check-all) $(if $(SKIP_UNIT),,test-api-unit test-portal-unit) $(if $(SKIP_DEPS),,test-deps) $(if $(SKIP_E2E),,test-api-e2e)

test-pipeline:
	@$(TEST_PIPELINE_CMD)

check-all: check-types check-lint

test-deps:
	python infra/tests/test_dependency_completeness.py

test-single:
	@npx tsx infra/test-utils/run-single.ts $(TEST)

test-structural:
	@$(MAKE) build-shared
	@$(MAKE) build-db-schema
	@python infra/tests/test_docker_env_alignment.py
	@npx tsx infra/test-utils/run-structural.ts
	@npx knip

query-drizzle:
	cd apps/api && npx tsx tools/query_drizzle.ts ../../tmp/test_query.ts

query-postgres:
	cd apps/api && npx tsx tools/query_pg.ts ../../tmp/query.sql

test-heavy: $(if $(SKIP_STRUCTURAL),,test-structural)
	@$(TEST_HEAVY_CMD)

test-data:
	"$(VENV_PYTHON)" infra/tests/test_data_counts.py

test-all: test-api-unit test-portal-unit test-api-e2e test-deps test-structural test-heavy test-data

build-all:
	npm run build -w apps/api -w apps/ops-portal -w packages/shared -w packages/db-schema -w packages/sdk --if-present
	node scripts/run-on-enabled-extensions.mjs build

clean-dev:
	$(CLEAN_BUILD_CMD)
