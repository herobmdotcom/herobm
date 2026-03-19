.PHONY: up down restart logs clean status ps nuke test-infra test-structural check-env extract extract-dry transform test-transform transform-select elt extract-docker extract-docker-dry dev-api rebuild-api test-api test-api-cov test-api-e2e dev-portal docs-generate schema-ref migrate migrate-status migrate-dry seed init init-env setup test-all build-all typecheck-portal build-api build-portal verify-api-only verify-portal

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

up:
	$(COMPOSE_CMD) up -d

build-worker:
	podman build -t localhost/outbox-worker:latest -f apps/worker/Dockerfile .

up-erpnext: build-worker
	$(COMPOSE_CMD) --profile erpnext --profile finance up -d

down:
	$(COMPOSE_CMD) down

restart: down up

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

# --- Infrastructure Tests ---

test-infra:
	powershell -ExecutionPolicy Bypass -File infra/tests/test_stack_health.ps1

test-structural:
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_docker_socket.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_docker_log_shipping.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_port_binding.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_weak_defaults.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_hardcoded_secrets.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_wildcard_cors.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_print_in_pipelines.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_imports_pinned.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_no_inline_api_client.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_pipeline_observability.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_business_event_logging.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_controller_authz.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_drizzle_typed_injection.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_global_exception_filter.ps1
	@powershell -ExecutionPolicy Bypass -File infra/tests/test_unauthenticated_rate_limiting.ps1

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

elt: extract transform schema-ref

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

# --- Custom API ---

dev-api:
	node --env-file=.env apps/api/dist/main.js

rebuild-api:
	$(COMPOSE_CMD) up -d --build --no-deps custom-api
	$(COMPOSE_CMD) ps

test-api:
	cd apps/api && npm test

test-api-cov:
	cd apps/api && npm run test:cov

test-api-e2e:
	cd apps/api && npm run test:e2e

# --- Portal (unified) ---

dev-portal:
	cd apps/ops-portal && npm run dev

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

# --- Quality Gates ---

# Scoped: API-only (unit tests + build)
verify-api-only: test-api build-api

# Scoped: portal typecheck
verify-portal: typecheck-portal

# Full API verification (unit + e2e)
verify-api: test-api test-api-e2e

test-deps:
	python infra/tests/test_dependency_completeness.py

test-all: test-api test-deps test-structural typecheck-portal

build-all: build-api build-portal

# Full verification — use before deployment, not after every change
verify-all: test-all build-all test-api-e2e test-infra
