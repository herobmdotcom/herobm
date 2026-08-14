#!/usr/bin/env bash
set -e

echo "Booting up containerized API and Pipeline Runner for integration tests..."
podman compose up -d --no-build herobm-api herobm-pipeline postgres-custom redis-broker

echo "Waiting 15 seconds for Postgres and API to initialize..."
sleep 15

echo "Running pipeline tests..."
set +e
npx tsx infra/pipeline_tests/test_pipeline_cancellation.ts
TEST_EXIT_CODE=$?
set -e

echo "Tearing down containers to preserve dev-local isolation..."
podman compose stop herobm-api herobm-pipeline postgres-custom redis-broker

if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo "Pipeline tests FAILED!"
    exit $TEST_EXIT_CODE
else
    echo "Pipeline tests PASSED!"
    exit 0
fi
