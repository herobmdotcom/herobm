Push-Location $PSScriptRoot\..

Write-Host "Starting local Dev Environment..." -ForegroundColor Green
Write-Host "API will start on port 3002" -ForegroundColor Cyan
Write-Host "Portal will start on port 4301" -ForegroundColor Cyan

# Use the explicitly declared Node to run local dev securely and reliably.

# Start API in a new window
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd apps/api; `$env:PORT=3002; npm run start:dev"

# Start FE in a new window
# We prefix `next dev` with passing `API_URL`
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd apps/ops-portal; `$env:API_URL='http://localhost:3002'; npm run dev:local"

Pop-Location
