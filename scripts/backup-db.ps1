<#
.SYNOPSIS
Backups the modbm_core PostgreSQL database to the user's home directory.
#>

$BackupDir = $HOME
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "modbm_db_backup_$Timestamp.sql"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " MODBM PostgreSQL Database Backup Worker " -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target container : postgres-custom"
Write-Host "Target database  : custom_app"
Write-Host "Export directory : $BackupFile"
Write-Host ""

# We use plain-text SQL format so it survives Windows/Linux cross stdout.
# --clean drops objects before recreating them, making restoration seamless.
# --if-exists suppresses errors if the tables don't exist yet on the restore target.
Write-Host "Executing pg_dump via Podman..." -ForegroundColor DarkGray
podman exec -i postgres-custom pg_dump -U postgres -d custom_app --clean --if-exists > $BackupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully and saved to $HOME!" -ForegroundColor Green
} else {
    Write-Host "Backup encountered a fatal error with exit code $LASTEXITCODE." -ForegroundColor Red
}
