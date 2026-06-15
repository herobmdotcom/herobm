$ErrorActionPreference = "Stop"
Write-Host "Starting Fast Install Sequence..." -ForegroundColor Cyan

# 1. Install prerequisites interactively (preserves choices) but skip auto-run
& .\scripts\setup.ps1 -SkipRun

# 2. Refresh environment variables in case 'make' was just installed
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 3. Proceed through the CLI sequence
make cli-init-env
make cli-install-npm
make cli-up-db
make cli-init-db
make cli-migrate
make cli-bootstrap
if (Test-Path ".startup_choice") {
    $choice = Get-Content ".startup_choice"
    Invoke-Expression "make $choice"
    Remove-Item ".startup_choice"
} else {
    make up
}

Write-Host "Fast Install Complete!" -ForegroundColor Green
