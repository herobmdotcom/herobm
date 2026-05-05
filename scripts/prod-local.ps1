param (
    [string]$TargetProfile = ""
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

$envInjection = "`$env:ENV_FILE='$envFile'; "
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

Write-Host "Starting local Prod Environment..." -ForegroundColor Green
Write-Host "API will start on port $apiPort" -ForegroundColor Cyan
Write-Host "Portal will start on port $fePort" -ForegroundColor Cyan

# Start API in a new window
$apiCmd = $envInjection + "`$env:PORT=$apiPort; `$env:PIPELINE_LOG_DIR='$PSScriptRoot\..\logs'; npm run start:prod -w apps/api"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", $apiCmd

# Start FE in a new window
$feCmd = $envInjection + "`$env:API_URL='http://localhost:$apiPort'; npm run start -w apps/ops-portal -- -p $fePort"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", $feCmd

Pop-Location
