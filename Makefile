.PHONY: up down restart logs clean status ps nuke test-infra test-structural test-structural-local check-env extract extract-dry transform test-transform transform-select elt import-legacy extract-docker extract-docker-dry dev-api rebuild-api rebuild-portal dev-portal test-api test-api-cov test-api-e2e docs-generate schema-ref migrate migrate-status migrate-dry seed init init-env setup test-all build-all typecheck-portal build-api build-portal verify-api-only verify-portal check-logs-volume dev-local prod-local verify-local

# Environment Profile Resolution
# 1. Command Line explicit (make ... PROFILE=staging)
# 2. Directory context file (.active_profile)
# 3. Fallback default (.env)
# NOTE: PROFILE is only honoured from the command line, never from the
#       shell environment. This prevents stray $env:PROFILE from silently
#       poisoning Make targets.
ifeq ($(OS),Windows_NT)
  ACTIVE_PROFILE := $(strip $(shell type .active_profile 2>nul))
  COMPOSE_OVERRIDE = -f docker-compose.windows.yml
  DBT = $(CURDIR)/.venv/Scripts/dbt
  VENV_PYTHON = $(CURDIR)/.venv/Scripts/python
  INIT_ENV_CMD = python scripts/init_env.py
  DEV_LOCAL_CMD = powershell -ExecutionPolicy Bypass -File scripts/dev-local.ps1
  PROD_LOCAL_CMD = powershell -ExecutionPolicy Bypass -File scripts/prod-local.ps1
  COMPOSE_CMD = podman compose -f docker-compose.yml $(COMPOSE_OVERRIDE)
else
  ACTIVE_PROFILE := $(strip $(shell cat .active_profile 2>/dev/null))
  COMPOSE_OVERRIDE = -f docker-compose.linux.yml
  DBT = $(CURDIR)/.venv/bin/dbt
  VENV_PYTHON = $(CURDIR)/.venv/bin/python
  INIT_ENV_CMD = python3 scripts/init_env.py
  DEV_LOCAL_CMD = bash scripts/dev-local.sh
  PROD_LOCAL_CMD = bash scripts/prod-local.sh
  COMPOSE_CMD = podman-compose -f docker-compose.yml $(COMPOSE_OVERRIDE)
endif

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

DBT_DIR = pipelines/abm_transform

# --- Container Stack (Podman) ---

# Ensure the podman_logs volume exists before starting containers.
# Promtail needs this volume to scrape container logs on Windows.
# The volume maps Podman's overlay-containers directory into the container.
check-logs-volume:
ifeq ($(OS),Windows_NT)
	@podman volume inspect podman_logs >nul 2>&1 || ( \
		echo [pre-flight] Creating podman_logs volume... && \
		podman volume create --opt type=none --opt o=bind --opt device=/home/user/.local/share/containers/storage/overlay-containers podman_logs \
	)
endif

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
up-db: check-logs-volume check-postgres-logs
	$(COMPOSE_CMD) up -d postgres-custom redis-broker

down-db:
	$(COMPOSE_CMD) stop postgres-custom redis-broker
	$(COMPOSE_CMD) rm -f postgres-custom redis-broker

# FE + API Core (The standard full-container app stack)
up-fe-api: check-logs-volume check-postgres-logs
	$(COMPOSE_CMD) up -d custom-api ops-portal postgres-custom redis-broker

down-fe-api:
	$(COMPOSE_CMD) stop custom-api ops-portal postgres-custom redis-broker
	$(COMPOSE_CMD) rm -f custom-api ops-portal postgres-custom redis-broker

# PLG (Prometheus, Loki, Grafana)
up-plg: check-logs-volume check-postgres-logs
	$(COMPOSE_CMD) --profile plg up -d

down-plg:
	$(COMPOSE_CMD) --profile plg down

# ERPNext Financial Core
up-erpnext: check-logs-volume check-postgres-logs
	$(COMPOSE_CMD) --profile erpnext --profile finance up -d

down-erpnext:
	$(COMPOSE_CMD) --profile erpnext --profile finance down

# Queue Worker (Outbox relay)
build-worker:
	podman build -t localhost/outbox-worker:latest -f apps/worker/Dockerfile .

up-queue: build-worker check-logs-volume check-postgres-logs
	$(COMPOSE_CMD) --profile queue up -d outbox-worker

down-queue:
	$(COMPOSE_CMD) stop outbox-worker
	$(COMPOSE_CMD) rm -f outbox-worker

# Run absolutely everything
up-all: build-worker check-logs-volume check-postgres-logs
	$(COMPOSE_CMD) --profile "*" up -d

down-all:
	$(COMPOSE_CMD) --profile "*" down

# Legacy aliases pointing to default FE+API core
up: up-fe-api
down: down-fe-api
restart: down-all up-fe-api

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

# Generate setup token and provide URL for frontend setup flow
setup-wizard: init-db migrate
	@"$(VENV_PYTHON)" -c "import os,secrets; from dotenv import load_dotenv; load_dotenv(); t=secrets.token_urlsafe(32); open('.setup-token','w').write(t); p=os.environ.get('FE_PORT', '4300'); print('\n=================================\nHEROBM PLATFORM SETUP\n\nPlease complete the setup wizard to proceed:\n\nhttp://localhost:' + p + '/setup?token=' + t + '\n\n=================================\n')"

# Create the active profile database and base schemas on a running container
init-db:
	@echo "Initializing database: $(POSTGRES_DB)"
	-@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d postgres -c "CREATE DATABASE $(POSTGRES_DB);"
	@podman exec -i postgres-custom psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -f /docker-entrypoint-initdb.d/init-schemas.sql

# Generate .env from .env.example with auto-generated local secrets.
init-env:
	$(INIT_ENV_CMD) $(if $(EFFECTIVE_PROFILE),--profile $(EFFECTIVE_PROFILE))

# --- ELT Pipeline ---

extract:
	"$(VENV_PYTHON)" pipelines/abm_extract/pipeline.py

extract-dry:
	"$(VENV_PYTHON)" pipelines/abm_extract/pipeline.py --dry-run

# Extract a single ABM table: make extract-table TABLE=SGROUPS
extract-table:
	"$(VENV_PYTHON)" pipelines/abm_extract/pipeline.py --table $(TABLE)

transform:
	"$(DBT)" run --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

test-transform:
	"$(DBT)" test --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

# Rebuild a single model: make transform-select MODEL=import_accounts
transform-select:
	"$(DBT)" run --select $(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

transform-refresh:
	"$(DBT)" run --select $(MODEL) --full-refresh --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

elt: extract transform import-legacy schema-ref
	"$(VENV_PYTHON)" tools/elt_report.py

elt-no-extract: transform import-legacy schema-ref
	"$(VENV_PYTHON)" tools/elt_report.py

import-legacy:
	"$(DBT)" run --select tag:import --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quotes --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_quote_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_purchase_order_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" test --select tag:import --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

# --- Schema Reference ---

docs-generate:
	"$(VENV_PYTHON)" tools/dbt_docs_generate.py

schema-ref: docs-generate
	"$(VENV_PYTHON)" tools/generate_schema_reference.py

# --- ELT Pipeline (Container) ---

extract-docker:
	$(COMPOSE_CMD) --profile pipeline run --rm abm-extract

extract-docker-dry:
	$(COMPOSE_CMD) --profile pipeline run --rm abm-extract --dry-run

# --- Local Development ---
# Hot-reloads FE and API natively, assuming database containers are running.
dev-local:
	$(DEV_LOCAL_CMD) $(DEV_LOCAL_PROFILE_ARG)

# Production-like local environment. Builds both FE and API and runs them locally.
prod-local: build-api build-portal
	$(PROD_LOCAL_CMD) $(DEV_LOCAL_PROFILE_ARG)

dev-api:
	node --env-file=.env apps/api/dist/main.js

rebuild-api:
	podman build -t localhost/modbm_custom-api:latest -f Dockerfile.api .
	-podman stop custom-api
	-podman rm custom-api
	$(COMPOSE_CMD) up -d --no-build --no-deps custom-api
	$(COMPOSE_CMD) ps

rebuild-portal:
	podman build -t localhost/modbm_ops-portal:latest -f Dockerfile.portal .
	-podman stop ops-portal
	-podman rm ops-portal
	$(COMPOSE_CMD) up -d --no-build --no-deps ops-portal
	$(COMPOSE_CMD) ps

USE_PGLITE ?= true

ifeq ($(USE_PGLITE),true)
  TEST_API_TARGET = test:pglite
  TEST_E2E_TARGET = test:e2e:fast
else
  TEST_API_TARGET = test
  TEST_E2E_TARGET = test:e2e
endif

test-api:
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
	podman build -t localhost/modbm_ops-portal:dev -f Dockerfile.portal.dev .
	-podman stop ops-portal
	-podman rm ops-portal
	podman run -d --name ops-portal --network modbm_default -p 127.0.0.1:4300:3000 --env-file .env localhost/modbm_ops-portal:dev
	@echo "Portal running in DEV mode at http://localhost:4300 (unminified errors)"

# --- Migrations (modbm_core) ---

migrate:
	"$(VENV_PYTHON)" tools/migrate.py

migrate-status:
	"$(VENV_PYTHON)" tools/migrate.py --status

migrate-dry:
	"$(VENV_PYTHON)" tools/migrate.py --dry-run

seed:
	npm run seed

init: init-db migrate seed elt

init-no-extract: init-db migrate seed elt-no-extract

# --- Typechecks & Builds ---

typecheck-portal:
	npm run typecheck -w apps/ops-portal

build-api:
	npm run build -w apps/api

build-portal:
	npm run build -w apps/ops-portal

build-shared:
	npm run build -w packages/shared

# --- Quality Gates & Verification ---

verify-fe-api: typecheck-portal test-api test-api-e2e

test-deps:
	python infra/tests/test_dependency_completeness.py

test-structural:
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_drizzle_schema_sync.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_docker_socket.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_docker_log_shipping.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_port_binding.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_weak_defaults.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_hardcoded_secrets.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_wildcard_cors.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_print_in_pipelines.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_imports_pinned.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_pipeline_observability.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_business_event_logging.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_controller_authz.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_drizzle_typed_injection.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_global_exception_filter.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_duplicate_context_packages.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_report_seeding_internal.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_report_hooks_frontend.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_singleton_settings_integrity.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_config_drift.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_hardcoded_currency.ps1

test-data:
	"$(VENV_PYTHON)" infra/tests/test_data_counts.py

test-all: test-api test-deps test-structural typecheck-portal test-data

build-all:
	npm run build --workspaces --if-present

clean-dev:
	@powershell -ExecutionPolicy Bypass -File scripts/clean-build.ps1
	npm install
	$(MAKE) build-shared

clean-build:
	@powershell -ExecutionPolicy Bypass -File scripts/clean-build.ps1
	npm install
	$(MAKE) build-all

verify-all: build-api verify-fe-api test-structural test-deps test-transform test-data

test-structural-local:
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_drizzle_schema_sync.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_docker_socket.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_docker_log_shipping.ps1 -SkipLive
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_port_binding.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_weak_defaults.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_hardcoded_secrets.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_wildcard_cors.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_print_in_pipelines.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_imports_pinned.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_pipeline_observability.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_business_event_logging.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_controller_authz.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_drizzle_typed_injection.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_global_exception_filter.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_duplicate_context_packages.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_report_seeding_internal.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_singleton_settings_integrity.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_config_drift.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_hardcoded_currency.ps1
verify-local: build-api typecheck-portal test-api test-api-e2e test-structural-local test-deps test-transform
