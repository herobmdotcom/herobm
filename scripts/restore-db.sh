#!/usr/bin/env bash
set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Error: BackupFile path is required."
  echo "Usage: ./scripts/restore-db.sh /path/to/backup.sql"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' does not exist."
  exit 1
fi

echo "========================================="
echo " HEROBM PostgreSQL Database Restore Worker "
echo "========================================="
echo ""
echo "Target container : postgres-custom"
echo "Target database  : herobm"
echo "Source file      : $BACKUP_FILE"
echo ""
echo "WARNING: This will absolutely overwrite the existing database content inside the container."
read -p "Are you absolutely sure you want to proceed? [Y/N] " response

case "$response" in
    [Yy]*)
        ;;
    *)
        echo "Restore sequence manually aborted."
        exit 0
        ;;
esac

echo "Executing psql ingestion natively via Podman..."
podman exec -i postgres-custom psql -q -U postgres -d herobm < "$BACKUP_FILE"

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "Restore successfully completed!"
else
    echo "Restore finished but reported issues (Exit code $EXIT_CODE)."
fi
exit $EXIT_CODE
