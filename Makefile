.PHONY: help help-install fast-install check-postgres-logs up-db down-db up-portal-api down-portal-api up-portal-api-nginx down-portal-api-nginx up-nginx down-nginx build-worker up-redis down-redis up-maildev down-maildev up-all down-all up down restart logs status ps clean nuke clean-legacy-containers clean-db rebuild-db-keep-raw clean-db-keep-extract init-db init-env extract extract-dry extract-table sync-table transform transform-seed test-transform transform-dry transform-select transform-select-dry transform-refresh elt elt-no-extract elt-report report import-legacy import-legacy-shipments dev-docs-schema dev-docs-api dev-docs-webhooks dev-docs-all dev-docs-audit check-docs dev-generate-sdk dev-db-generate generate-extensions extract-docker extract-docker-dry dev-local prod-local dev-api dev-mcp dev-pipeline rebuild-api rebuild-portal rebuild-pipeline rebuild-worker build-images rebuild-apps pre-push test-api-unit test-portal-unit test-api-cov test-api-e2e test-portal-e2e dev-portal migrate check-schema-drift migrate-status migrate-dry seed seed-demo init typecheck-portal build-api build-mcp build-portal build-shared build-db-schema build-sdk check-types check-lint lint-portal verify-i18n clean-build install-prereqs setup-python install-npm bootstrap verify-db verify-all verify-fast verify-api verify-portal verify-pipeline test-pipeline test-abm test-odoo check-all test-deps test-unit test-single test-changed test-structural query-drizzle query-postgres test-heavy test-data test-all build-all clean-dev


define HELP_TEXT
HeroBM Makefile Help:
=========================================
Environment:
  make fast-install   - Automated full installation for current OS
  make init-env       - Generate .env from .env.example
  make dev-local      - Start hot-reloading dev environment
  make prod-local     - Start production-like local environment

Containers (Podman):
  make up             - Start full stack (Portal + API + DB)
  make up-portal-api-nginx - Start full stack with Nginx reverse proxy
  make up-nginx       - Start standalone Nginx proxy container
  make down           - Stop full stack
  make logs           - View container logs
  make clean          - Stop containers (volumes are preserved)
  make clean-legacy-containers - Stop and remove legacy container instances
  make nuke           - Complete teardown (containers, volumes, images)

Database & Migrations:
  make clean-db       - Drop and rebuild herobm_core while preserving raw extracted data (runs migrate & seed)
  make migrate        - Apply SQL migrations
  make migrate-status - Show migration status
  make seed           - Seed database with application data
  make init           - Full DB initialization (schema, migrate, seed, ELT)
  make rebuild-db-keep-raw - Alias for clean-db

Code Generation:
  make dev-generate-sdk - Regenerate OpenAPI spec and TypeScript SDK client
  make dev-db-generate NAME=name - Generate Drizzle SQL migration from schema
  make generate-extensions - Generate extension registry bindings

Cleanup & Rebuild:
  make clean-dev      - Wipe node_modules, caches, reinstall, and build shared
  make clean-build    - Full deep clean, reinstall, and build all workspaces

Data Pipeline & ELT:
  make elt SOURCE=abm        - Full pipeline: extract, transform, import & audit report
  make elt-no-extract SOURCE=abm - Fast pipeline: transform, import & audit report
  make elt-report SOURCE=abm - Run data verification audit and output reconciliation summary

Verification & Quality Gates:
  make verify-fast    - Fast pre-commit gate (<25s): types, lint, unit tests, deps, schema drift
  make verify-api     - API subsystem verification: types, lint, unit + E2E against Postgres
  make verify-portal  - Portal subsystem verification: types, lint, unit tests, Next.js build
  make verify-pipeline- Data pipeline verification: ELT runner & data counts
  make verify-all     - Full monorepo verification before merge/release
  make pre-push       - Pre-push gate (verify-all + build container images)
  make check-all      - Fast static analysis: typecheck and linting across all workspaces
  make test-unit      - Run all fast unit tests (API PGlite + Ops Portal components)
  make test-single [TEST=name] - Run a single test file (or target from .test_target)
  make test-api-unit  - Run API unit tests (PGlite)
  make test-portal-unit - Run Ops Portal unit tests (Jest/RTL)
  make test-portal-e2e- Run Playwright E2E against running dev host (PORTAL_URL=http://localhost:4301)
  make test-api-e2e   - Run end-to-end API tests against real Postgres
  make test-structural- Run structural architecture, security & knip checks
  make test-heavy [FLAGS] - Run containerized test stack
     TEST=<name>          - Run single backend heavy test
     UI_ONLY=1            - Run only Playwright UI E2E tests
     E2E=<pattern>        - Target specific Playwright E2E test file or pattern
     SKIP_UI=1            - Run only backend heavy tests
     SKIP_CRAWL=1         - Skip 200-page crawl during UI tests
     REUSE=1              - Reuse already-running test containers (fast iteration)
     NO_TEARDOWN=1        - Keep test containers alive after tests pass
     SKIP_STRUCTURAL=1    - Skip AST invariant checks
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
  DBT := $(shell if exist "$(CURDIR)\.venv\Scripts\dbt.exe" (echo $(CURDIR)/.venv/Scripts/dbt) else (echo dbt))
  VENV_PYTHON := $(shell if exist "$(CURDIR)\.venv\Scripts\python.exe" (echo $(CURDIR)/.venv/Scripts/python) else (echo python))
  PYTHON_CMD = python
  INIT_ENV_CMD = $(PYTHON_CMD) scripts/init_env.py
  DEV_LOCAL_CMD = node scripts/dev-local.mjs
  PROD_LOCAL_CMD = node scripts/prod-local.mjs
  CLEAN_BUILD_CMD = node scripts/clean-build.mjs
  TEST_PIPELINE_CMD = node scripts/test-pipeline.mjs
  TEST_HEAVY_CMD = node scripts/run-heavy.mjs $(if $(SKIP_UI),--skip-ui) $(if $(UI_ONLY),--ui-only) $(if $(SKIP_BACKEND),--skip-backend) $(if $(TEST),--test "$(TEST)") $(if $(E2E),--e2e "$(E2E)") $(if $(NO_TEARDOWN),--no-teardown) $(if $(REUSE),--reuse) $(if $(SKIP_CRAWL),--skip-crawl)
  COMPOSE_CMD = podman compose -f docker-compose.yml $(COMPOSE_OVERRIDE)
  BIND_IP ?= 127.0.0.1
  NODE ?= node
  NPX ?= npx
  NPM ?= npm
  GIT_VERSION := $(shell git log -1 --format="%cd.%h" --date=format:%Y%m%d 2>nul)
  BUILD_TIMESTAMP := $(shell node -e "console.log(new Date().toISOString().replace(/\.[0-9]{3}Z$$/, 'Z'))" 2>nul)
else
  export PATH := $(PATH):/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin
  ACTIVE_PROFILE := $(strip $(shell cat .active_profile 2>/dev/null))
  COMPOSE_OVERRIDE =
  DBT := $(shell if [ -x $(CURDIR)/.venv/bin/dbt ]; then echo "$(CURDIR)/.venv/bin/dbt"; else echo "dbt"; fi)
  VENV_PYTHON := $(shell if [ -x $(CURDIR)/.venv/bin/python ]; then echo "$(CURDIR)/.venv/bin/python"; else echo "python3"; fi)
  NODE ?= $(shell which node 2>/dev/null || if [ -x /opt/homebrew/bin/node ]; then echo "/opt/homebrew/bin/node"; else echo "node"; fi)
  NPX ?= $(shell which npx 2>/dev/null || if [ -x /opt/homebrew/bin/npx ]; then echo "/opt/homebrew/bin/npx"; else echo "npx"; fi)
  NPM ?= $(shell which npm 2>/dev/null || if [ -x /opt/homebrew/bin/npm ]; then echo "/opt/homebrew/bin/npm"; else echo "npm"; fi)
  PYTHON_CMD = python3
  INIT_ENV_CMD = $(PYTHON_CMD) scripts/init_env.py
  DEV_LOCAL_CMD = $(NODE) scripts/dev-local.mjs
  PROD_LOCAL_CMD = $(NODE) scripts/prod-local.mjs
  CLEAN_BUILD_CMD = $(NODE) scripts/clean-build.mjs
  TEST_PIPELINE_CMD = $(NODE) scripts/test-pipeline.mjs
  TEST_HEAVY_CMD = $(NODE) scripts/run-heavy.mjs $(if $(SKIP_UI),--skip-ui) $(if $(UI_ONLY),--ui-only) $(if $(SKIP_BACKEND),--skip-backend) $(if $(TEST),--test "$(TEST)") $(if $(E2E),--e2e "$(E2E)") $(if $(NO_TEARDOWN),--no-teardown) $(if $(REUSE),--reuse) $(if $(SKIP_CRAWL),--skip-crawl)
  COMPOSE_CMD := $(shell if command -v podman-compose >/dev/null 2>&1; then echo "podman-compose"; elif [ -x ~/.local/bin/podman-compose ]; then echo "~/.local/bin/podman-compose"; else echo "podman compose"; fi) -f docker-compose.yml $(COMPOSE_OVERRIDE)
  BIND_IP ?= 0.0.0.0
  GIT_VERSION := $(shell git log -1 --format="%cd.%h" --date=format:%Y%m%d 2>/dev/null || true)
  BUILD_TIMESTAMP := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || true)
endif
export BIND_IP

# Only use PROFILE if it was passed on the command line (origin=command line),
# ignore it if it leaked in from the shell environment (origin=environment).
ifeq ($(origin PROFILE),command line)
  EFFECTIVE_PROFILE := $(PROFILE)
else
  EFFECTIVE_PROFILE := $(ACTIVE_PROFILE)
endif
DEV_LOCAL_PROFILE_ARG = $(if $(EFFECTIVE_PROFILE),--profile $(EFFECTIVE_PROFILE))

ENV_FILE := $(if $(EFFECTIVE_PROFILE),.env.$(EFFECTIVE_PROFILE),.env)
-include $(ENV_FILE)
export
export PYTHONUTF8=1
export ENV_FILE

DBT_DIR = pipelines/$(SOURCE)_transform

# --- Container Stack (Podman) ---



# Ensure log and storage directories have permissive permissions across container runtimes and host.
# This only runs on Linux/macOS to avoid impacting Windows hosts.
check-postgres-logs:
ifneq ($(OS),Windows_NT)
	@mkdir -p ./logs ./data/storage/products/uploads
	-@chmod -R 777 ./logs 2>/dev/null || chmod -R a+rwx ./logs 2>/dev/null || true
	-@chmod -R a+rX ./data/storage 2>/dev/null || true
	-@podman unshare chmod -R 777 ./logs 2>/dev/null || true
	-@podman unshare chmod -R a+rX ./data/storage 2>/dev/null || true
endif

# --------------------------------------------------------------------------
# Containerized Stacks
# --------------------------------------------------------------------------

# DB Backend Core (Local FE + API run path)
up-db: check-postgres-logs
	$(COMPOSE_CMD) up -d $(ARGS) postgres-custom redis-broker

down-db:
	$(COMPOSE_CMD) stop postgres-custom redis-broker
	-podman rm -f postgres-custom redis-broker

# Portal + API Core (The standard full-container app stack)
up-portal-api: check-postgres-logs
	$(COMPOSE_CMD) up -d $(ARGS) herobm-api herobm-ui postgres-custom redis-broker herobm-outbox herobm-pipeline

down-portal-api:
	$(COMPOSE_CMD) stop herobm-api herobm-ui postgres-custom redis-broker herobm-outbox herobm-pipeline
	-podman rm -f herobm-api herobm-ui postgres-custom redis-broker herobm-outbox herobm-pipeline

# Portal + API + Nginx Proxy Core
up-portal-api-nginx: check-postgres-logs
	$(COMPOSE_CMD) up -d $(ARGS) herobm-api herobm-ui postgres-custom redis-broker herobm-outbox herobm-pipeline herobm-nginx

down-portal-api-nginx:
	$(COMPOSE_CMD) stop herobm-api herobm-ui postgres-custom redis-broker herobm-outbox herobm-pipeline herobm-nginx
	-podman rm -f herobm-api herobm-ui postgres-custom redis-broker herobm-outbox herobm-pipeline herobm-nginx

# Nginx Reverse Proxy (Standalone UI proxy)
up-nginx: check-postgres-logs
	$(COMPOSE_CMD) up -d $(ARGS) herobm-nginx

down-nginx:
	$(COMPOSE_CMD) stop herobm-nginx
	-podman rm -f herobm-nginx

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

clean-legacy-containers:
	@echo "Stopping and removing legacy container instances (ignoring errors for missing ones)..."
ifeq ($(OS),Windows_NT)
	-podman rm -f ops-portal
	-podman rm -f custom-api
	-podman rm -f outbox-worker
	-podman rm -f pipeline-runner
	-podman rm -f api-gateway
	-podman rm -f api-rs
	-podman rm -f herobm-nginx
else
	-podman rm -f ops-portal >/dev/null 2>&1 || true
	-podman rm -f custom-api >/dev/null 2>&1 || true
	-podman rm -f outbox-worker >/dev/null 2>&1 || true
	-podman rm -f pipeline-runner >/dev/null 2>&1 || true
	-podman rm -f api-gateway >/dev/null 2>&1 || true
	-podman rm -f api-rs >/dev/null 2>&1 || true
	-podman rm -f herobm-nginx >/dev/null 2>&1 || true
endif
	@echo "Pruning unused podman resources..."
	-podman system prune -a

clean-db:
	@$(PYTHON_CMD) tools/confirm.py "WARNING: This will drop and rebuild the herobm_core database while preserving raw extracted data (raw_* schemas). Continue?" $(if $(FORCE),--force,)
	@echo "Resetting herobm_core and dbt transformation schemas..."
	@podman exec -i postgres-custom psql -U $(or $(POSTGRES_USER),postgres) -d $(or $(POSTGRES_DB),herobm) -c "SET client_min_messages = warning; DROP SCHEMA IF EXISTS herobm_core CASCADE; DROP SCHEMA IF EXISTS dbt_abm_transform CASCADE; DROP SCHEMA IF EXISTS dbt_odoo_transform CASCADE; CREATE SCHEMA herobm_core;"
	$(MAKE) migrate
	$(MAKE) seed

rebuild-db-keep-raw: clean-db
clean-db-keep-extract: clean-db

# Setup from scratch (Headless/CI): build API, apply schema migrations (DDL only),
# import source data via ELT, then seed application data (users, inventory).
# Prerequisites: 'make up' running, .env populated with all passwords.
# (init target defined further down alongside elt-no-extract)



# Create the active profile database and base schemas on a running container
init-db:
	@echo "Waiting for database container to be ready..."
	@"$(PYTHON_CMD)" -c "import time, subprocess, sys; sys.exit(0 if any(subprocess.run(['podman', 'exec', '-i', 'postgres-custom', 'pg_isready', '-U', sys.argv[1], '-d', 'postgres', '-q'], capture_output=True).returncode == 0 or time.sleep(1) for _ in range(60)) else 'Timed out waiting for PostgreSQL container')" "$(or $(POSTGRES_USER),postgres)"
	@echo "Ensuring database $(or $(POSTGRES_DB),herobm) exists..."
	@podman exec -i postgres-custom sh -c "psql -U $(or $(POSTGRES_USER),postgres) -d postgres -tc \"SELECT 1 FROM pg_database WHERE datname = '$(or $(POSTGRES_DB),herobm)'\" | grep -q 1 || psql -U $(or $(POSTGRES_USER),postgres) -d postgres -c \"CREATE DATABASE $(or $(POSTGRES_DB),herobm)\""
	@echo "Initializing database: $(or $(POSTGRES_DB),herobm)"
	@podman exec -i postgres-custom psql -U $(or $(POSTGRES_USER),postgres) -d $(or $(POSTGRES_DB),herobm) -f /docker-entrypoint-initdb.d/init-schemas.sql

# Generate .env from .env.example with auto-generated local secrets.
init-env:
	$(INIT_ENV_CMD) $(if $(EFFECTIVE_PROFILE),--profile $(EFFECTIVE_PROFILE))

PIPELINES_EXIST := $(if $(wildcard pipelines/*),1,0)
INFRA_EXIST := $(if $(wildcard infra/tests/*),1,0)

# --- ELT Pipeline ---

extract:
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract SOURCE=<source>))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py
endif

extract-dry:
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-dry SOURCE=<source>))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py --dry-run
endif

# Extract a single table: make extract-table SOURCE=<source> TABLE=<name>
extract-table:
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-table SOURCE=<source> TABLE=<name>))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py --table $(TABLE)
endif

# Extract and transform a single table: make sync-table SOURCE=<source> TABLE=<name> MODEL=<name>
sync-table:
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make sync-table SOURCE=<source> TABLE=<name> MODEL=<name>))
	$(if $(TABLE),,$(error Error: TABLE is required. Usage: make sync-table SOURCE=<source> TABLE=<name> MODEL=<name>))
	$(if $(MODEL),,$(error Error: MODEL is required. Usage: make sync-table SOURCE=<source> TABLE=<name> MODEL=<name>))
	"$(VENV_PYTHON)" pipelines/$(SOURCE)_extract/pipeline.py --table $(TABLE)
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --select +$(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
endif

transform: check-postgres-logs
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform SOURCE=<source>))
	"$(DBT)" seed $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
ifeq ($(SOURCE),abm)
	"$(DBT)" run-operation sync_sales_quotes --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quote_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_order_shipments --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_purchase_order_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
endif
endif

transform-seed:
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-seed SOURCE=<source>))
	"$(DBT)" seed $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
endif

test-transform:
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make test-transform SOURCE=<source>))
	"$(DBT)" test $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
endif

transform-dry:
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-dry SOURCE=<source>))
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --empty --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
endif

transform-select: check-postgres-logs
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-select SOURCE=<source> MODEL=<name>))
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --select $(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
endif

transform-select-dry:
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-select-dry SOURCE=<source> MODEL=<name>))
	"$(DBT)" run $(if $(EXTRA_DBT_VARS),--vars '$(EXTRA_DBT_VARS)',) --empty --select $(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
endif

transform-refresh: check-postgres-logs
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make transform-refresh SOURCE=<source> MODEL=<name>))
	"$(DBT)" run --select $(MODEL) --full-refresh --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
endif

elt: check-postgres-logs extract transform import-legacy
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make elt SOURCE=<source>))
	"$(VENV_PYTHON)" tools/elt_report.py --source $(SOURCE) $(if $(EFFECTIVE_PROFILE),--profile $(EFFECTIVE_PROFILE))
endif

elt-no-extract: check-postgres-logs transform import-legacy
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make elt-no-extract SOURCE=<source>))
	"$(VENV_PYTHON)" tools/elt_report.py --source $(SOURCE) $(if $(EFFECTIVE_PROFILE),--profile $(EFFECTIVE_PROFILE))
endif

elt-report: check-postgres-logs
ifeq ($(PIPELINES_EXIST),0)
	@echo "Pipeline targets require the herobm-ext repository. See documentation."
else
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make elt-report SOURCE=<source>))
	"$(VENV_PYTHON)" tools/elt_report.py --source $(SOURCE) $(if $(EFFECTIVE_PROFILE),--profile $(EFFECTIVE_PROFILE))
endif

report: elt-report

import-legacy: check-postgres-logs
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make import-legacy SOURCE=<source>))
	"$(DBT)" run --select tag:import --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
ifeq ($(SOURCE),abm)
	"$(DBT)" run-operation sync_sales_quotes --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quote_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_order_shipments --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_purchase_order_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
endif

import-legacy-shipments:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make import-legacy-shipments SOURCE=<source>))
	"$(DBT)" run-operation sync_sales_order_shipments --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

# --- Schema Reference & Docs ---

dev-docs-schema:
	$(NPX) tsx tools/generate_schema_docs.ts

dev-docs-webhooks:
	$(NPX) tsx tools/generate_webhook_docs.ts

dev-docs-api: build-api
	@echo "Generating OpenAPI spec from source..."
	$(NODE) apps/api/dist/scripts/generate-openapi.js
	$(NPX) tsx tools/generate_api_docs.ts

dev-docs-audit:
	$(NPX) tsx tools/audit_docs_sync.ts

check-docs: dev-docs-audit

dev-docs-all: dev-docs-schema dev-docs-api dev-docs-webhooks dev-docs-audit

dev-generate-sdk: dev-docs-api
	@echo "Generating TypeScript SDK..."
	$(NPM) run generate --workspace=@herobm/sdk
	@echo "Building TypeScript SDK..."
	$(NPM) run build --workspace=@herobm/sdk

dev-db-generate:
	$(if $(NAME),,$(error Error: NAME is required. Usage: make dev-db-generate NAME=migration_name))
	$(NPX) tsx tools/generate_migration.ts $(NAME)

generate-extensions:
	$(NODE) apps/api/scripts/generate-extensions.mjs
	$(NODE) apps/ops-portal/scripts/generate-extensions.mjs
# --- ELT Pipeline (Container) ---

extract-docker:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-docker SOURCE=<source>))
	$(COMPOSE_CMD) --profile pipeline run --rm $(SOURCE)-extract

extract-docker-dry:
	$(if $(SOURCE),,$(error Error: SOURCE is required. Usage: make extract-docker-dry SOURCE=<source>))
	$(COMPOSE_CMD) --profile pipeline run --rm $(SOURCE)-extract --dry-run

# --- Local Development ---
# Hot-reloads FE and API natively, assuming database containers are running.
dev-local: build-shared build-db-schema build-sdk
	$(DEV_LOCAL_CMD) $(DEV_LOCAL_PROFILE_ARG) $(ARGS)

# Production-like local environment. Builds both FE and API and runs them locally.
prod-local: build-api build-portal
	$(PROD_LOCAL_CMD) $(DEV_LOCAL_PROFILE_ARG) $(ARGS)

dev-api:
	node --env-file=.env apps/api/dist/main.js

dev-mcp:
	node --env-file=.env apps/mcp-server/dist/index.js

dev-pipeline:
ifeq ($(OS),Windows_NT)
	if not exist .venv\Scripts\uvicorn.exe $(MAKE) setup-python
	.venv\Scripts\python -m uvicorn pipelines.runner.server:app --port 8001 --reload
else
	[ ! -x .venv/bin/uvicorn ] && $(MAKE) setup-python || true
	.venv/bin/python -m uvicorn pipelines.runner.server:app --port 8001 --reload
endif

rebuild-api:
	podman build -t localhost/herobm_custom-api:latest -f Dockerfile.api .
	-$(COMPOSE_CMD) stop herobm-api
	-$(COMPOSE_CMD) rm -f herobm-api
	-podman stop herobm-api
	-podman rm -f herobm-api
	$(COMPOSE_CMD) up -d --no-build --no-deps herobm-api
	$(COMPOSE_CMD) ps

rebuild-portal:
	podman build -t localhost/herobm_ops-portal:latest -f Dockerfile.portal .
	-$(COMPOSE_CMD) stop herobm-ui
	-$(COMPOSE_CMD) rm -f herobm-ui
	-podman stop herobm-ui
	-podman rm -f herobm-ui
	$(COMPOSE_CMD) up -d --no-build --no-deps herobm-ui
	$(COMPOSE_CMD) ps

rebuild-pipeline:
	podman build -t localhost/herobm_pipeline-runner:latest -f Dockerfile.pipeline .
	-$(COMPOSE_CMD) stop herobm-pipeline
	-$(COMPOSE_CMD) rm -f herobm-pipeline
	-podman stop herobm-pipeline
	-podman rm -f herobm-pipeline
	$(COMPOSE_CMD) up -d --no-build --no-deps herobm-pipeline
	$(COMPOSE_CMD) ps

rebuild-worker:
	podman build -t localhost/outbox-worker:latest -f Dockerfile.worker .
	-$(COMPOSE_CMD) stop herobm-outbox
	-$(COMPOSE_CMD) rm -f herobm-outbox
	-podman stop herobm-outbox
	-podman rm -f herobm-outbox
	$(COMPOSE_CMD) up -d --no-build --no-deps herobm-outbox
	$(COMPOSE_CMD) ps

build-images:
	podman build $(if $(GIT_VERSION),--build-arg APP_VERSION="v0.0.1-$(GIT_VERSION)") $(if $(BUILD_TIMESTAMP),--build-arg BUILD_TIME="$(BUILD_TIMESTAMP)") -t localhost/herobm_custom-api:latest -f Dockerfile.api .
	podman build $(if $(GIT_VERSION),--build-arg APP_VERSION="v0.1.0-$(GIT_VERSION)") $(if $(BUILD_TIMESTAMP),--build-arg BUILD_TIME="$(BUILD_TIMESTAMP)") -t localhost/herobm_ops-portal:latest -f Dockerfile.portal .
	podman build -t localhost/herobm_pipeline-runner:latest -f Dockerfile.pipeline .
	podman build -t localhost/outbox-worker:latest -f Dockerfile.worker .

rebuild-apps: build-images
	-$(COMPOSE_CMD) stop herobm-api herobm-ui herobm-pipeline herobm-outbox
	-$(COMPOSE_CMD) rm -f herobm-api herobm-ui herobm-pipeline herobm-outbox
	-podman stop herobm-api herobm-ui herobm-pipeline herobm-outbox
	-podman rm -f herobm-api herobm-ui herobm-pipeline herobm-outbox
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
	@$(NPX) turbo run test:unit --filter=api

test-portal-unit:
	@$(NPX) turbo run test:unit --filter=ops-portal

test-portal-e2e:
	@echo "Running Ops Portal Playwright E2E tests against $(or $(PORTAL_URL),http://localhost:4301)..."
	$(NPM) run test:e2e -w apps/ops-portal

test-api-cov:
	$(NPM) run test:cov -w apps/api

test-api-e2e:
	@echo "[e2e-preflight] ENV_FILE=$(ENV_FILE) EFFECTIVE_PROFILE=$(EFFECTIVE_PROFILE) POSTGRES_DB=$(POSTGRES_DB) USE_PGLITE=$(USE_PGLITE) TEST_API_URL=$(TEST_API_URL)"
	$(NPM) run $(TEST_E2E_TARGET) -w apps/api

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
	$(NPX) tsx tools/check_schema_drift.ts

migrate-status:
	$(PYTHON_CMD) tools/migrate.py --status

migrate-dry:
	$(PYTHON_CMD) tools/migrate.py --dry-run

seed: build-shared build-db-schema
	npm run seed

seed-demo:
	@echo "Running demo seed script..."
	npm run seed:demo -w apps/api

init: init-db migrate seed

# --- Typechecks & Builds ---

typecheck-portal: build-shared build-sdk
	$(NPM) run typecheck -w apps/ops-portal

build-api: build-shared build-db-schema
	$(NPM) run build -w apps/api

build-mcp:
	$(NPM) run build -w apps/mcp-server

build-portal: build-shared build-sdk
	node -e "const fs = require('fs'); if (fs.existsSync('apps/ops-portal/.next')) fs.rmSync('apps/ops-portal/.next', { recursive: true, force: true, maxRetries: 5 });"
	$(NPM) run build -w apps/ops-portal
ifeq ($(OS),Windows_NT)
	if exist apps\ops-portal\public xcopy /E /I /Y apps\ops-portal\public apps\ops-portal\.next\standalone\apps\ops-portal\public
	if exist apps\ops-portal\.next\static xcopy /E /I /Y apps\ops-portal\.next\static apps\ops-portal\.next\standalone\apps\ops-portal\.next\static
else
	[ -d apps/ops-portal/public ] && cp -r apps/ops-portal/public apps/ops-portal/.next/standalone/apps/ops-portal/public || true
	[ -d apps/ops-portal/.next/static ] && cp -r apps/ops-portal/.next/static apps/ops-portal/.next/standalone/apps/ops-portal/.next/static || true
endif

build-shared:
	$(NPM) run build -w packages/shared

build-db-schema:
	$(NPM) run build -w packages/db-schema

build-sdk:
	$(NPM) run build -w packages/sdk

# --- Quality Gates & Verification ---

check-types:
	@$(NPX) turbo run typecheck

check-lint:
	@$(NPX) turbo run lint lint:oas

lint-portal:
	@$(NPM) run lint -w apps/ops-portal

verify-i18n:
	@$(NPM) run lint:i18n -w apps/ops-portal

clean-build:
	$(CLEAN_BUILD_CMD)
	npm install
	node scripts/install-native-deps.js
	$(MAKE) build-shared
	$(MAKE) build-db-schema
	$(MAKE) build-sdk
	$(MAKE) build-all

# --- Installation & Setup Sequence ---

help-install:
	@echo "HeroBM Installation Sequence:"
	@echo "  make fast-install        - One-step automated installation (Recommended)"
	@echo "  1. make install-prereqs  - Install OS-level tools"
	@echo "  2. make init-env         - Create .env and secrets"
	@echo "  3. make install-npm      - Install npm dependencies"
	@echo "  4. make up-db            - Start database containers"
	@echo "  5. make init-db          - Initialize database schema (waits for PG)"
	@echo "  6. make migrate          - Apply SQL migrations"
	@echo "  7. make bootstrap        - Seed base data & verify installation"
	@echo "  8. make up               - Start application containers (UI + API)"

fast-install: install-prereqs
	$(MAKE) init-env
	$(MAKE) install-npm
	$(MAKE) up-db
	$(MAKE) init-db
	$(MAKE) migrate
	$(MAKE) bootstrap
ifeq ($(OS),Windows_NT)
	@powershell -NoProfile -Command "if (Test-Path '.startup_choice') { $$c = (Get-Content '.startup_choice').Trim(); Remove-Item '.startup_choice'; & make $$c } else { & make up }"
else
	@if [ -f .startup_choice ]; then \
		CHOICE=$$(cat .startup_choice); \
		rm -f .startup_choice; \
		$(MAKE) $$CHOICE; \
	else \
		$(MAKE) up; \
	fi
endif

install-prereqs:
ifeq ($(OS),Windows_NT)
	powershell -ExecutionPolicy Bypass -File scripts/setup.ps1 -SkipRun
else
	bash scripts/setup.sh
endif

setup-python:
ifeq ($(OS),Windows_NT)
	if not exist .venv $(PYTHON_CMD) -m venv .venv
	.venv\Scripts\pip install -r pipelines\runner\requirements.txt $(if $(SOURCE),-r pipelines\$(SOURCE)_extract\requirements.txt)
else
	[ ! -d .venv ] && $(PYTHON_CMD) -m venv .venv || true
	.venv/bin/pip install -r pipelines/runner/requirements.txt $(if $(SOURCE),-r pipelines/$(SOURCE)_extract/requirements.txt)
endif

install-npm:
	npm install
	node scripts/install-native-deps.js

bootstrap:
	$(MAKE) build-shared
	$(MAKE) build-db-schema
	$(MAKE) build-sdk
	$(MAKE) build-api
	npm run seed
	$(MAKE) verify-db
	@"$(PYTHON_CMD)" -c "import os; env_file = os.environ.get('ENV_FILE', '.env'); env=dict(line.strip().split('=',1) for line in open(env_file) if '=' in line and not line.strip().startswith('#')) if os.path.exists(env_file) else {}; print('\n=============================================================\n  [SECURE] Admin Password:\n  ' + env.get('ADMIN_PASSWORD', 'UNKNOWN') + '\n  (This is also saved securely in your ' + env_file + ' file)\n=============================================================\n') if env.get('ADMIN_PASSWORD') else None"

verify-db: migrate-status
	@echo "Verifying seeded system records..."
	@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -t -A -c "SELECT 'Admin User: ' || count(*) FROM herobm_core.users WHERE username = 'admin';"
	@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -t -A -c "SELECT 'Organization: ' || count(*) FROM herobm_core.organization;"

verify-all: build-all check-all verify-db test-all

# Tier 1: Fast Task / Pre-Commit Verification Gate (< 25s, No external DB containers required)
# Supports skipping phases using environment variables, e.g. make verify-fast SKIP_CHECK=1 SKIP_UNIT=1
verify-fast: generate-extensions check-schema-drift $(if $(SKIP_CHECK),,check-all) $(if $(SKIP_UNIT),,test-unit) $(if $(SKIP_DEPS),,test-deps)

# Unit Tests (Fast in-memory & PGlite tests, no live Postgres required)
test-unit:
	@$(NPX) turbo run test:unit

# Tier 2: Subsystem Verification Gates
verify-api: build-shared build-db-schema
	@npm run typecheck -w apps/api
	@npm run lint -w apps/api
	@npm run lint:oas -w apps/api
	$(MAKE) test-api-unit
	$(MAKE) test-api-e2e

verify-portal: build-shared build-sdk
	@npm run typecheck -w apps/ops-portal
	@npm run lint -w apps/ops-portal
	$(MAKE) test-portal-unit
	$(MAKE) build-portal

verify-pipeline: test-pipeline test-abm test-odoo test-data

test-pipeline:
	@$(TEST_PIPELINE_CMD)

test-abm:
	@$(NPX) tsx pipelines/abm_transform/test/run-abm-tests.ts

test-odoo:
	@$(NPX) tsx pipelines/odoo_transform/test/run-odoo-tests.ts

check-all: check-types check-lint

test-deps:
	@"$(PYTHON_CMD)" infra/tests/test_dependency_completeness.py

test-single:
	@$(NPX) tsx infra/test-utils/run-single.ts $(TEST)

test-changed:
	@$(NPM) run test:changed -w apps/api --if-present
	@$(NPM) run test:changed -w apps/ops-portal --if-present

test-structural:
ifeq ($(INFRA_EXIST),0)
	@echo "Structural tests require the herobm-pro repository. See documentation."
else
	@$(MAKE) build-shared
	@$(MAKE) build-db-schema
	@"$(PYTHON_CMD)" infra/tests/test_docker_env_alignment.py
	@$(NPX) tsx infra/test-utils/run-structural.ts
	@$(NPX) knip
endif

query-drizzle:
	cd apps/api && $(NPX) tsx tools/query_drizzle.ts ../tmp/test_query.ts

query-postgres:
	cd apps/api && $(NPX) tsx tools/query_pg.ts ../tmp/query.sql

test-heavy: $(if $(or $(SKIP_STRUCTURAL),$(UI_ONLY),$(REUSE)),,test-structural)
	@$(TEST_HEAVY_CMD)

test-all: test-api-unit test-portal-unit test-api-e2e test-deps test-structural test-data
	@$(MAKE) test-heavy SKIP_STRUCTURAL=1

build-all:
	@$(NPX) turbo run build
	node scripts/run-on-enabled-extensions.mjs build

clean-dev: clean-build

