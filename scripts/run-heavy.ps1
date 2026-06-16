Write-Host "Building isolated test images..." -ForegroundColor Cyan
podman build -t localhost/herobm_api-test:latest -f Dockerfile.api .
podman build -t localhost/herobm_pipeline-test:latest -f Dockerfile.pipeline .
podman build -t localhost/herobm_worker-test:latest -f apps/worker/Dockerfile .

Write-Host "Booting up test stack via docker-compose.test.yml..." -ForegroundColor Cyan
podman compose -f docker-compose.test.yml up -d

Write-Host "Waiting 15 seconds for Postgres and API to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "Running heavy tests..." -ForegroundColor Green
try {
    npx tsx infra/test-utils/run-heavy.ts
    $testExitCode = $LASTEXITCODE
} catch {
    $testExitCode = 1
}

Write-Host "Tearing down test containers to preserve dev-local isolation..." -ForegroundColor Yellow
podman compose -f docker-compose.test.yml down -v

if ($testExitCode -ne 0) {
    Write-Host "Heavy tests FAILED!" -ForegroundColor Red
    exit $testExitCode
} else {
    Write-Host "Heavy tests PASSED!" -ForegroundColor Green
    exit 0
}
