.PHONY: up down restart logs clean status ps nuke test-infra check-env extract extract-dry transform test-transform elt extract-docker extract-docker-dry

check-env:
	@if [ ! -f .env ]; then echo "FATAL: .env file not found. Copy .env.example to .env and fill in credentials." && exit 1; fi

up: check-env
	docker compose up -d

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

status:
	docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

ps: status

clean:
	docker compose down -v

nuke:
	docker compose down -v --remove-orphans --rmi local

# --- Infrastructure Tests ---

test-infra:
	powershell -ExecutionPolicy Bypass -File infra/tests/test_stack_health.ps1

# --- ELT Pipeline ---

extract:
	python pipelines/abm_extract/pipeline.py

extract-dry:
	python pipelines/abm_extract/pipeline.py --dry-run

transform:
	cd pipelines/abm_transform && dbt run --profiles-dir .

test-transform:
	cd pipelines/abm_transform && dbt test --profiles-dir .

elt: extract transform

# --- ELT Pipeline (Docker) ---

extract-docker:
	docker compose --profile pipeline run --rm abm-extract

extract-docker-dry:
	docker compose --profile pipeline run --rm abm-extract --dry-run
