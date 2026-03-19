# ==============================================================================
# Antigravity Platform — Environment Initialisation
# ==============================================================================
# Creates .env from .env.example with auto-generated random passwords for
# local-only secrets. Only prompts for values that cannot be generated
# (ABM SQL Server connection).
#
# Usage: .\scripts\init-env.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$exampleFile = Join-Path $root ".env.example"

if (Test-Path $envFile) {
    Write-Host ".env already exists at $envFile" -ForegroundColor Yellow
    $overwrite = Read-Host "Overwrite? (y/N)"
    if ($overwrite -ne "y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 0
    }
}

if (-not (Test-Path $exampleFile)) {
    Write-Host "ERROR: .env.example not found at $exampleFile" -ForegroundColor Red
    exit 1
}

# --- Helper: generate a random alphanumeric string ---
function New-RandomPassword {
    param([int]$Length = 20)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    -join (1..$Length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

# --- Read the template ---
$content = Get-Content $exampleFile -Raw

# --- Auto-generate local secrets ---
$generatedVars = @(
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
    "GRAFANA_PASSWORD",
    "JWT_SECRET",
    "DEV_ADMIN_PASSWORD",
    "DEV_VIEWER_PASSWORD",
    "DEV_SALES_PASSWORD",
    "DEV_WAREHOUSE_PASSWORD",
    "DEV_PROCUREMENT_PASSWORD"
)

Write-Host "`n=== Generating local secrets ===" -ForegroundColor Cyan
foreach ($var in $generatedVars) {
    $password = New-RandomPassword -Length 20
    $content = $content -replace "$var=<REDACTED>", "$var=$password"
    Write-Host "  Generated: $var"
}

# JWT secret should be longer
$content = $content -replace "JWT_SECRET=.+", "JWT_SECRET=$(New-RandomPassword -Length 32)"

# --- Prompt for ABM SQL Server connection ---
Write-Host "`n=== ABM SQL Server Connection ===" -ForegroundColor Cyan
Write-Host "These connect to the legacy ABM database for data extraction."
Write-Host "Press Enter to skip any field (you can fill it in .env later).`n"

$abmHost = Read-Host "ABM_MSSQL_HOST"
if ($abmHost) { $content = $content -replace "ABM_MSSQL_HOST=<REDACTED>", "ABM_MSSQL_HOST=$abmHost" }

$abmDb = Read-Host "ABM_MSSQL_DATABASE"
if ($abmDb) { $content = $content -replace "ABM_MSSQL_DATABASE=<REDACTED>", "ABM_MSSQL_DATABASE=$abmDb" }

$abmUser = Read-Host "ABM_MSSQL_USER"
if ($abmUser) { $content = $content -replace "ABM_MSSQL_USER=<REDACTED>", "ABM_MSSQL_USER=$abmUser" }

$abmPass = Read-Host "ABM_MSSQL_PASSWORD"
if ($abmPass) { $content = $content -replace "ABM_MSSQL_PASSWORD=<REDACTED>", "ABM_MSSQL_PASSWORD=$abmPass" }

# --- Detect Typst binary ---
$typstCmd = Get-Command typst -ErrorAction SilentlyContinue
if ($typstCmd) {
    $typstPath = $typstCmd.Source
    $content = $content -replace "TYPST_BINARY_PATH=typst", "TYPST_BINARY_PATH=$typstPath"
    Write-Host "`nDetected Typst at: $typstPath" -ForegroundColor Green
}

# --- Write .env ---
$content | Set-Content $envFile -Encoding utf8 -NoNewline
Write-Host "`n=== .env created at $envFile ===" -ForegroundColor Green
Write-Host "Review it and fill in any remaining <REDACTED> values.`n"
