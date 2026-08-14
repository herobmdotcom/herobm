Write-Host "Booting up containerized API and Pipeline Runner for integration tests..." -ForegroundColor Cyan
podman compose up -d --no-build herobm-api herobm-pipeline postgres-custom redis-broker

Write-Host "Waiting 15 seconds for Postgres and API to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "Running pipeline tests..." -ForegroundColor Green
try {
    npx tsx infra/pipeline_tests/test_pipeline_cancellation.ts
    $testExitCode = $LASTEXITCODE
} catch {
    $testExitCode = 1
}

Write-Host "Tearing down containers to preserve dev-local isolation..." -ForegroundColor Yellow
podman compose stop herobm-api herobm-pipeline postgres-custom redis-broker

if ($testExitCode -ne 0) {
    Write-Host "Pipeline tests FAILED!" -ForegroundColor Red
    exit $testExitCode
} else {
    Write-Host "Pipeline tests PASSED!" -ForegroundColor Green
    exit 0
}
