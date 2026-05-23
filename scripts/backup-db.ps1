<#
.SYNOPSIS
Backups the PostgreSQL database to the user's home directory.
Reads configuration from .env or .env.<PROFILE>.
#>

param (
    [string]$Profile = $null
)

$BackupDir = $HOME
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "modbm_db_backup_$Timestamp.sql"

# Determine which .env file to load
$EnvFile = ".env"
if ($Profile) {
    $EnvFile = ".env.$Profile"
} elseif ($env:PROFILE) {
    $EnvFile = ".env.$env:PROFILE"
} elseif (Test-Path ".active_profile") {
    $ActiveProfile = Get-Content ".active_profile" | Select-Object -First 1
    if ($ActiveProfile) {
        $EnvFile = ".env.$ActiveProfile"
    }
}

Write-Host "Loading environment from $EnvFile" -ForegroundColor DarkGray
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match '^([^#=]+)=(.*)$' } | ForEach-Object {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim(" `"'")
        [Environment]::SetEnvironmentVariable($name, $value)
    }
} else {
    Write-Host "Warning: $EnvFile not found, falling back to existing environment variables." -ForegroundColor Yellow
}

$DbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
$DbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "custom_app" }

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " MODBM PostgreSQL Database Backup Worker " -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target container : postgres-custom"
Write-Host "Target database  : $DbName"
Write-Host "Target user      : $DbUser"
Write-Host "Export directory : $BackupFile"
Write-Host ""

# We use cmd.exe /c to bypass PowerShell's default UTF-16 LE encoding when piping output.
# --clean drops objects before recreating them, making restoration seamless.
# --if-exists suppresses errors if the tables don't exist yet on the restore target.
Write-Host "Executing pg_dump via Podman..." -ForegroundColor DarkGray
cmd.exe /c "podman exec -i postgres-custom pg_dump -U $DbUser -d $DbName --clean --if-exists > ""$BackupFile"""

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully and saved to $BackupFile!" -ForegroundColor Green
} else {
    Write-Host "Backup encountered a fatal error with exit code $LASTEXITCODE." -ForegroundColor Red
}
