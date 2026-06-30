param (
    [string]$TargetProfile = "",
    [switch]$NoSwagger,
    [switch]$NoMcp,
    [switch]$WithDbt
)

Push-Location $PSScriptRoot\..

$activeProfile = $TargetProfile
if (-not $activeProfile -and (Test-Path ".active_profile")) {
    $activeProfile = (Get-Content ".active_profile" | Select-Object -First 1).Trim()
}

$envFile = ".env"
if ($activeProfile) {
    $envFile = ".env.$activeProfile"
    Write-Host "Targeting Environment Profile: $activeProfile" -ForegroundColor Magenta
} else {
    Write-Host "Targeting Default Environment" -ForegroundColor Magenta
}

$enableSwagger = if ($NoSwagger) { 'false' } else { 'true' }
$enableMcp = if ($NoMcp) { 'false' } else { 'true' }

$envInjection = "`$env:ENV_FILE='$envFile'; `$env:ENABLE_SWAGGER='$enableSwagger'; `$env:ENABLE_MCP='$enableMcp'; "
$apiPort = 3002
$fePort = 4301
if (Test-Path $envFile) {
    Write-Host "Loading configuration from: $envFile" -ForegroundColor DarkGray
    foreach ($line in (Get-Content $envFile | Where-Object { $_ -match '^[a-zA-Z_][a-zA-Z0-9_]*=' })) {
        $name, $value = $line.Split('=', 2)
        $name = $name.Trim()
        $value = $value.Trim()
        if ($name -eq "API_PORT") { $apiPort = $value }
        if ($name -eq "FE_PORT") { $fePort = $value }
        $valueEscaped = $value.Replace("'", "''")
        $envInjection += "`$env:$name='$valueEscaped'; "
    }
} else {
    Write-Host "Warning: $envFile not found!" -ForegroundColor Yellow
}

$proxyPort = [int]$apiPort - 1
$rustPort = [int]$apiPort + 1

Write-Host "Starting local Dev Environment..." -ForegroundColor Green
Write-Host "API will start on port $apiPort" -ForegroundColor Cyan
Write-Host "Portal will start on port $fePort" -ForegroundColor Cyan

function Kill-Port {
    param([int]$Port)
    $netstat = netstat -ano | findstr ":$Port "
    if ($netstat) {
        $lines = $netstat -split "`n"
        foreach ($line in $lines) {
            if ($line -match "LISTENING\s+(\d+)") {
                $pidToKill = $matches[1]
                Write-Host "Freeing up port $Port (Killing orphaned PID $pidToKill)..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
Kill-Port $apiPort
Kill-Port $fePort
Kill-Port 9092

# Start API in a new window
$apiCmd = $envInjection + "`$env:PORT=$apiPort; `$env:PIPELINE_LOG_DIR='$PSScriptRoot\..\logs'; npm run start:dev -w apps/api"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "`"$apiCmd`""

# Start FE in a new window
$feCmd = $envInjection + "`$env:API_URL='http://localhost:$apiPort'; npm run dev:local -w apps/ops-portal -- -p $fePort"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "`"$feCmd`""

# Start Worker in a new window
$workerCmd = $envInjection + "`$env:PORT=9092; npm run dev -w apps/worker"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "`"$workerCmd`""




Pop-Location
