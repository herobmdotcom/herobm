<#
.SYNOPSIS
Restores a modbm_core PostgreSQL database from a given backup file.
#>

param (
    [Parameter(Mandatory=$true, HelpMessage="Absolute path to the .sql backup file to ingest")]
    [ValidateScript({Test-Path $_})]
    [string]$BackupFile
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " MODBM PostgreSQL Database Restore Worker " -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target container : postgres-custom"
Write-Host "Target database  : herobm"
Write-Host "Source file      : $BackupFile"
Write-Host ""
Write-Host "WARNING: This will absolutely overwrite the existing database content inside the container." -ForegroundColor Yellow

$response = Read-Host "Are you absolutely sure you want to proceed? [Y/N]"
if ($response -notmatch "^[Yy]$") {
    Write-Host "Restore sequence manually aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host "Executing psql ingestion natively via Podman..." -ForegroundColor DarkGray

# We use cmd.exe to inject the file strictly bypassing PowerShell's slow 
# Get-Content Object pipe mapping, which averts catastrophic RAM overflow on large DBs.
cmd.exe /c "podman exec -i postgres-custom psql -q -U postgres -d herobm < `"$BackupFile`""

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restore successfully completed!" -ForegroundColor Green
} else {
    Write-Host "Restore finished but reported issues (Exit code $LASTEXITCODE)." -ForegroundColor Red
}
