Write-Host "Building isolated test images..." -ForegroundColor Cyan
podman build -t localhost/herobm_api-test:latest -f Dockerfile.api .
podman build -t localhost/herobm_pipeline-test:latest -f Dockerfile.pipeline .
podman build -t localhost/herobm_worker-test:latest -f apps/worker/Dockerfile .
podman build --build-arg API_URL=http://custom-api-test:3000 -t localhost/herobm_portal-test:latest -f Dockerfile.portal .

Write-Host "Ensuring network exists..." -ForegroundColor Cyan
$netName = (Split-Path -Leaf (Get-Location)).ToLower() + "_app-net"
$env:APP_NETWORK_NAME = $netName
podman network exists $netName
if ($LASTEXITCODE -ne 0) {
    podman network create $netName
}

Write-Host "Booting up test stack via docker-compose.test.yml and docker-compose.ui.yml..." -ForegroundColor Cyan
podman compose -f docker-compose.test.yml -f docker-compose.ui.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to boot test stack!" -ForegroundColor Red
    exit 1
}

Write-Host "Waiting 20 seconds for Postgres, API, and UI to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

$failed = $false

Write-Host "Running heavy tests..." -ForegroundColor Green
try {
    npx tsx infra/test-utils/run-heavy.ts
    if ($LASTEXITCODE -ne 0) { $failed = $true }
} catch {
    $failed = $true
}

Write-Host "Running UI Playwright tests..." -ForegroundColor Green
try {
    # We pass PORTAL_URL so Playwright config uses the isolated UI container on port 4305
    $env:PORTAL_URL = "http://localhost:4305"
    npm run test:e2e -w apps/ops-portal
    if ($LASTEXITCODE -ne 0) { $failed = $true }
} catch {
    $failed = $true
}

Write-Host "Tearing down test containers to preserve dev-local isolation..." -ForegroundColor Yellow
podman compose -f docker-compose.test.yml -f docker-compose.ui.yml down -v

if ($failed) {
    Write-Host "Heavy tests FAILED!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Heavy tests PASSED!" -ForegroundColor Green
    exit 0
}
