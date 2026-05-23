#!/usr/bin/env bash
# ==============================================================================
# MODBM PostgreSQL Database Backup Worker (Linux/cron-ready)
# ==============================================================================
# Backups the custom_app PostgreSQL database from the podman container.
# Suitable for execution via cron.
# Optional: Integrates with rclone for external storage (e.g., Google Drive).
#
# SETUP INSTRUCTIONS:
# 1. Install dependencies: `sudo apt update && sudo apt install rclone`
# 2. Configure Google Drive: Run `rclone config`, type "n", name it "gdrive", 
#    select "drive", and follow the interactive prompts.
# 3. Update .env: Add `BACKUP_RCLONE_DEST=gdrive:modbm_backups` to your .env file
# 4. Set up Cron: Make this script executable (`chmod +x scripts/backup-db.sh`),
#    then run `crontab -e` and add the following line (update paths as needed):
#    0 2 * * * /path/to/modbm/scripts/backup-db.sh >> /path/to/modbm/logs/backup.log 2>&1
# ==============================================================================

set -e

# ================= Configuration =================
BACKUP_DIR="${HOME}/modbm_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/modbm_db_backup_${TIMESTAMP}.sql"
GZ_BACKUP_FILE="${BACKUP_FILE}.gz"
RETENTION_DAYS=14 # How many days to keep local backups
# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --profile|-p) PROFILE="$2"; shift ;;
    esac
    shift
done
# =================================================

# Load environment variables to get BACKUP_RCLONE_DEST, POSTGRES_DB, and POSTGRES_USER
ENV_FILE="$(dirname "$0")/../.env"
if [ -n "$PROFILE" ] && [ -f "${ENV_FILE}.${PROFILE}" ]; then
    ENV_FILE="${ENV_FILE}.${PROFILE}"
elif [ -f "$(dirname "$0")/../.active_profile" ]; then
    ACTIVE_PROFILE=$(cat "$(dirname "$0")/../.active_profile")
    if [ -f "${ENV_FILE}.${ACTIVE_PROFILE}" ]; then
        ENV_FILE="${ENV_FILE}.${ACTIVE_PROFILE}"
    fi
fi

if [ -f "$ENV_FILE" ]; then
    # Load env safely
    set -a
    source <(grep -v '^#' "$ENV_FILE" | sed -e '/^$/d')
    set +a
fi

DB_USER=${POSTGRES_USER:-postgres}
DB_NAME=${POSTGRES_DB:-custom_app}

echo -e "\e[36m=========================================\e[0m"
echo -e "\e[97m MODBM PostgreSQL Database Backup Worker \e[0m"
echo -e "\e[36m=========================================\e[0m"
echo ""
echo "Target container : postgres-custom"
echo "Target database  : $DB_NAME"
echo "Target user      : $DB_USER"
echo "Export directory : $BACKUP_DIR"
echo ""

mkdir -p "$BACKUP_DIR"

echo -e "\e[90mExecuting pg_dump via Podman...\e[0m"
# --clean drops objects before recreating them, making restoration seamless.
# --if-exists suppresses errors if the tables don't exist yet on the restore target.
# Note: we use -i without -t so it doesn't fail when run in a non-TTY cron environment.
podman exec -i postgres-custom pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists > "$BACKUP_FILE"

# Compress the backup to save disk space and network bandwidth
echo -e "\e[90mCompressing backup...\e[0m"
gzip -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "\e[32mBackup completed successfully and saved to ${GZ_BACKUP_FILE}!\e[0m"
else
    echo -e "\e[31mBackup encountered an error.\e[0m"
    exit 1
fi

# ================= External Storage Sync =================
if [ -n "$BACKUP_RCLONE_DEST" ]; then
    echo -e "\e[36mUploading to external storage via rclone ($BACKUP_RCLONE_DEST)...\e[0m"
    if command -v rclone >/dev/null 2>&1; then
        # Use rclone copy so we don't delete things on the remote unless intended
        rclone copy "$GZ_BACKUP_FILE" "$BACKUP_RCLONE_DEST"
        echo -e "\e[32mUpload to external storage complete.\e[0m"
    else
        echo -e "\e[33mWARNING: rclone is not installed. Skipping external upload.\e[0m"
        echo "To install rclone on Ubuntu: sudo apt install rclone"
    fi
else
    echo -e "\e[90mInfo: BACKUP_RCLONE_DEST not set in .env. Skipping external upload.\e[0m"
    echo -e "\e[90m      To enable Google Drive upload, install rclone and add 'BACKUP_RCLONE_DEST=remote_name:path' to .env.\e[0m"
fi

# ================= Cleanup Old Backups =================
echo -e "\e[90mCleaning up local backups older than ${RETENTION_DAYS} days...\e[0m"
find "$BACKUP_DIR" -name "modbm_db_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "Done."
