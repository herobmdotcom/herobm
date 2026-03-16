.PHONY: up down restart logs clean status ps nuke test-infra check-env extract extract-dry transform test-transform transform-select elt extract-docker extract-docker-dry dev-api test-api test-api-cov test-api-e2e dev-ops-portal dev-sales-portal dev-supplier-portal docs-generate schema-ref migrate migrate-status migrate-dry

# Load .env into Make variables and export to subprocesses (dbt, etc.)
-include .env
export

# --- Platform-specific Compose override ---
# Promtail needs a platform-specific config for container log collection.
# See ADV-023 for rationale.
ifeq ($(OS),Windows_NT)
  COMPOSE_OVERRIDE = -f docker-compose.windows.yml
  DBT = $(CURDIR)/.venv/Scripts/dbt
  VENV_PYTHON = $(CURDIR)/.venv/Scripts/python
else
  COMPOSE_OVERRIDE = -f docker-compose.linux.yml
  DBT = $(CURDIR)/.venv/bin/dbt
  VENV_PYTHON = $(CURDIR)/.venv/bin/python
endif
COMPOSE_CMD = docker compose -f docker-compose.yml $(COMPOSE_OVERRIDE)
DBT_DIR = pipelines/abm_transform

# --- Docker Stack ---

up:
	$(COMPOSE_CMD) up -d

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

# --- Infrastructure Tests ---

test-infra:
	powershell -ExecutionPolicy Bypass -File infra/tests/test_stack_health.ps1

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

# --- ELT Pipeline (Docker) ---

extract-docker:
	$(COMPOSE_CMD) --profile pipeline run --rm abm-extract

extract-docker-dry:
	$(COMPOSE_CMD) --profile pipeline run --rm abm-extract --dry-run

# --- Custom API ---

dev-api:
	node --env-file=.env apps/api/dist/main.js

test-api:
	cd apps/api && npm test

test-api-cov:
	cd apps/api && npm run test:cov

test-api-e2e:
	cd apps/api && npm run test:e2e

# --- Portals ---

dev-ops-portal:
	cd apps/ops-portal && npm run dev

dev-sales-portal:
	cd apps/sales-portal && npm run dev

dev-supplier-portal:
	cd apps/supplier-portal && npm run dev

# --- Migrations (modbm_core) ---

migrate:
	"$(VENV_PYTHON)" tools/migrate.py

migrate-status:
	"$(VENV_PYTHON)" tools/migrate.py --status

migrate-dry:
	"$(VENV_PYTHON)" tools/migrate.py --dry-run
