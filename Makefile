.PHONY: up down restart logs clean status ps nuke test-infra test-structural test-structural-local check-env extract extract-dry transform test-transform transform-select elt import-legacy extract-docker extract-docker-dry dev-api rebuild-api rebuild-portal dev-portal test-api test-api-cov test-api-e2e docs-generate schema-ref migrate migrate-status migrate-dry seed init init-env setup test-all build-all typecheck-portal build-api build-portal verify-api-only verify-portal check-logs-volume dev-local verify-local

# Load .env into Make variables and export to subprocesses (dbt, etc.)
-include .env
export

# --- Platform-specific Compose override ---
# Promtail needs a platform-specific config for container log collection.
ifeq ($(OS),Windows_NT)
  COMPOSE_OVERRIDE = -f docker-compose.windows.yml
  DBT = $(CURDIR)/.venv/Scripts/dbt
  VENV_PYTHON = $(CURDIR)/.venv/Scripts/python
else
  COMPOSE_OVERRIDE = -f docker-compose.linux.yml
  DBT = $(CURDIR)/.venv/bin/dbt
  VENV_PYTHON = $(CURDIR)/.venv/bin/python
endif
COMPOSE_CMD = podman compose -f docker-compose.yml $(COMPOSE_OVERRIDE)
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

# --------------------------------------------------------------------------
# Containerized Stacks
# --------------------------------------------------------------------------

# FE + API Core (The standard app stack)
up-fe-api: check-logs-volume
	$(COMPOSE_CMD) up -d custom-api ops-portal postgres-custom redis-broker

down-fe-api:
	$(COMPOSE_CMD) stop custom-api ops-portal postgres-custom redis-broker
	$(COMPOSE_CMD) rm -f custom-api ops-portal postgres-custom redis-broker

# PLG (Prometheus, Loki, Grafana)
up-plg: check-logs-volume
	$(COMPOSE_CMD) --profile plg up -d

down-plg:
	$(COMPOSE_CMD) --profile plg down

# ERPNext Financial Core
up-erpnext: check-logs-volume
	$(COMPOSE_CMD) --profile erpnext --profile finance up -d

down-erpnext:
	$(COMPOSE_CMD) --profile erpnext --profile finance down

# Queue Worker (Outbox relay)
build-worker:
	podman build -t localhost/outbox-worker:latest -f apps/worker/Dockerfile .

up-queue: build-worker check-logs-volume
	$(COMPOSE_CMD) --profile queue up -d outbox-worker

down-queue:
	$(COMPOSE_CMD) stop outbox-worker
	$(COMPOSE_CMD) rm -f outbox-worker

# Run absolutely everything
up-all: build-worker check-logs-volume
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

# --- Application Initialization ---
# Full init from empty database: build API, apply schema migrations (DDL only),
# import ABM data via ELT, then seed application data (users, inventory).
# Prerequisites: 'make up' running, .env populated with all passwords.

init: build-api migrate elt seed

# Setup from scratch: configure .env, start containers, then full init.
setup: init-env up init

# Generate .env from .env.example with auto-generated local secrets.
init-env:
	powershell -ExecutionPolicy Bypass -File scripts/init-env.ps1

# --- ELT Pipeline ---

extract:
	"$(VENV_PYTHON)" pipelines/abm_extract/pipeline.py

extract-dry:
	"$(VENV_PYTHON)" pipelines/abm_extract/pipeline.py --dry-run

transform:
	"$(DBT)" run --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

test-transform:
	"$(DBT)" test --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

# Rebuild a single model: make transform-select MODEL=mart_sales_order_lines
transform-select:
	"$(DBT)" run --select $(MODEL) --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

elt: extract transform import-legacy schema-ref

import-legacy:
	"$(DBT)" run --select tag:import --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)
	"$(DBT)" run-operation sync_sales_order_lines --project-dir $(DBT_DIR) --profiles-dir $(DBT_DIR)

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
# Hot-reloads FE and API natively, spins up Postgres automatically
dev-fe-api: check-logs-volume
	$(COMPOSE_CMD) up -d postgres-custom
	powershell -ExecutionPolicy Bypass -File scripts/dev-local.ps1
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

test-api:
	cd apps/api && npm test

test-api-cov:
	cd apps/api && npm run test:cov

test-api-e2e:
	cd apps/api && npm run test:e2e

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
	"$(VENV_PYTHON)" tools/seed.py

# --- Typechecks & Builds ---

typecheck-portal:
	cd apps/ops-portal && npm run typecheck

build-api:
	cd apps/api && npm run build

build-portal:
	cd apps/ops-portal && npm run build

# --- Quality Gates & Verification ---

verify-fe-api: typecheck-portal test-api test-api-e2e

test-deps:
	python infra/tests/test_dependency_completeness.py

test-structural:
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
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_unauthenticated_rate_limiting.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_duplicate_context_packages.ps1

test-all: test-api test-deps test-structural typecheck-portal

build-all: build-api build-portal

verify-all: build-api verify-fe-api test-structural test-deps test-transform

test-structural-local:
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
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_unauthenticated_rate_limiting.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_duplicate_context_packages.ps1

verify-local: build-api typecheck-portal test-api test-api-e2e test-structural-local test-deps test-transform
