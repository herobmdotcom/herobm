$ErrorActionPreference = "Stop"
Write-Host "Starting Fast Install Sequence..." -ForegroundColor Cyan

# 1. Install prerequisites interactively (preserves choices) but skip auto-run
# (Aligns with: make cli-install-prereqs)
& .\scripts\setup.ps1 -SkipRun

# (Refresh environment variables in case 'make' was just installed)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 2. Create .env and secrets
make init-env

# 3. Install npm dependencies
make install-npm

# 4. Start containers
make up-db

# 5. Initialize schemas (waits for PG)
make init-db

# 6. Apply SQL migrations
make migrate

# 7. Seed data & verify
make bootstrap

# 8. Start FE and API containers (or user's startup choice)
if (Test-Path ".startup_choice") {
    $choice = Get-Content ".startup_choice"
    Invoke-Expression "make $choice"
    Remove-Item ".startup_choice"
} else {
    make up
}

Write-Host "Fast Install Complete!" -ForegroundColor Green
