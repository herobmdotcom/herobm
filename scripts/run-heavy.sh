#!/usr/bin/env bash
set -e

SKIP_UI=false
TEST_NAME=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-ui|-SkipUI)
      SKIP_UI=true
      shift
      ;;
    --test|-TestName)
      TEST_NAME="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

echo "Tearing down any existing test containers to ensure a clean run..."
podman compose -f docker-compose.test.yml -f docker-compose.ui.yml down -v || true

echo "Building isolated test images..."
podman build -t localhost/herobm_api-test:latest -f Dockerfile.api .
podman build -t localhost/herobm_pipeline-test:latest -f Dockerfile.pipeline .
podman build -t localhost/herobm_worker-test:latest -f Dockerfile.worker .
podman build --no-cache --build-arg API_URL=http://custom-api-test:3000 -t localhost/herobm_portal-test:latest -f Dockerfile.portal .

echo "Ensuring network exists..."
export APP_NETWORK_NAME="herobm_app-net"
if ! podman network exists "$APP_NETWORK_NAME" 2>/dev/null; then
    podman network create "$APP_NETWORK_NAME"
fi

echo "Booting up test databases..."
podman compose -f docker-compose.test.yml -f docker-compose.ui.yml up -d postgres-test redis-test maildev-test webhook-catcher

echo "Waiting 20 seconds for Postgres and Redis to initialize..."
sleep 20

echo "Initializing Test Database..."
export POSTGRES_CONTAINER="postgres-test"
export POSTGRES_HOST="127.0.0.1"
export POSTGRES_PORT="5434"
export REDIS_HOST="127.0.0.1"
export REDIS_PORT="6380"

python3 tools/migrate.py || python tools/migrate.py
npm run seed:test -w apps/api

echo "Booting up app containers..."
podman compose -f docker-compose.test.yml -f docker-compose.ui.yml up -d custom-api-test worker-test pipeline-runner-test ops-portal-test

echo "Waiting 15 seconds for apps to initialize..."
sleep 15

FAILED=false

echo "Running heavy tests..."
set +e
if [ -z "$TEST_NAME" ]; then
    npx tsx infra/test-utils/run-heavy.ts
else
    npx tsx infra/test-utils/run-single.ts "$TEST_NAME"
fi
if [ $? -ne 0 ]; then FAILED=true; fi

if [ "$SKIP_UI" = false ]; then
    echo "Running UI Playwright tests..."
    export PORTAL_URL="http://localhost:4305"
    npm run test:e2e -w apps/ops-portal
    if [ $? -ne 0 ]; then FAILED=true; fi
fi
set -e

if [ "$FAILED" = true ]; then
    echo "Heavy tests FAILED! Leaving containers up for debugging."
    exit 1
else
    echo "Tearing down test containers to preserve dev-local isolation..."
    podman compose -f docker-compose.test.yml -f docker-compose.ui.yml down -v
    echo "Heavy tests PASSED!"
    exit 0
fi
