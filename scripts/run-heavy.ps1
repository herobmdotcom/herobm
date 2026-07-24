param(
    [switch]$SkipUI,
    [string]$TestName
)

Write-Host "Tearing down any existing test containers to ensure a clean run..." -ForegroundColor Yellow
podman compose -f docker-compose.test.yml -f docker-compose.ui.yml down -v

Write-Host "Building isolated test images..." -ForegroundColor Cyan
podman build -t localhost/herobm_api-test:latest -f Dockerfile.api .
podman build -t localhost/herobm_pipeline-test:latest -f Dockerfile.pipeline .
podman build -t localhost/herobm_worker-test:latest -f apps/worker/Dockerfile .
podman build --no-cache --build-arg API_URL=http://custom-api-test:3000 -t localhost/herobm_portal-test:latest -f Dockerfile.portal .

Write-Host "Ensuring network exists..." -ForegroundColor Cyan
$netName = "herobm_app-net"
$env:APP_NETWORK_NAME = $netName
podman network exists $netName
if ($LASTEXITCODE -ne 0) {
    podman network create $netName
}

Write-Host "Booting up test databases..." -ForegroundColor Cyan
podman compose -f docker-compose.test.yml -f docker-compose.ui.yml up -d postgres-test redis-test maildev-test webhook-catcher
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to boot test databases!" -ForegroundColor Red
    exit 1
}

Write-Host "Waiting 20 seconds for Postgres and Redis to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

Write-Host "Initializing Test Database..." -ForegroundColor Cyan
$env:POSTGRES_CONTAINER = "postgres-test"
$env:POSTGRES_HOST = "127.0.0.1"
$env:POSTGRES_PORT = "5434"
$env:REDIS_HOST = "127.0.0.1"
$env:REDIS_PORT = "6380"

# Run migrations
python tools/migrate.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to run migrations!" -ForegroundColor Red
    exit 1
}

# Run seed
npm run seed:test -w apps/api
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to seed test database!" -ForegroundColor Red
    exit 1
}

Write-Host "Booting up app containers..." -ForegroundColor Cyan
podman compose -f docker-compose.test.yml -f docker-compose.ui.yml up -d custom-api-test worker-test pipeline-runner-test ops-portal-test
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to boot test app containers!" -ForegroundColor Red
    exit 1
}

Write-Host "Waiting 15 seconds for apps to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

$failed = $false

Write-Host "Running heavy tests..." -ForegroundColor Green
try {
    if ([string]::IsNullOrWhiteSpace($TestName)) {
        npx tsx infra/test-utils/run-heavy.ts
    } else {
        npx tsx infra/test-utils/run-single.ts $TestName
    }
    if ($LASTEXITCODE -ne 0) { $failed = $true }
} catch {
    $failed = $true
}

if (-not $SkipUI) {
    Write-Host "Running UI Playwright tests..." -ForegroundColor Green
    try {
        # We pass PORTAL_URL so Playwright config uses the isolated UI container on port 4305
        $env:PORTAL_URL = "http://localhost:4305"
        npm run test:e2e -w apps/ops-portal
        if ($LASTEXITCODE -ne 0) { $failed = $true }
    } catch {
        $failed = $true
    }
}

if ($failed) {
    Write-Host "Heavy tests FAILED! Leaving containers up for debugging." -ForegroundColor Red
    exit 1
} else {
    Write-Host "Tearing down test containers to preserve dev-local isolation..." -ForegroundColor Yellow
    podman compose -f docker-compose.test.yml -f docker-compose.ui.yml down -v
    Write-Host "Heavy tests PASSED!" -ForegroundColor Green
    exit 0
}
