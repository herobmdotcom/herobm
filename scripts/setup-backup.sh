#!/usr/bin/env bash
# ==============================================================================
# HEROBM - Interactive Backup Setup Script
# ==============================================================================
# Sets up a cron job for automated database backups and configures cloud sync.
# ==============================================================================

set -e

cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_SCRIPT="${PROJECT_DIR}/scripts/backup-db.sh"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/backup.log"

mkdir -p "$LOG_DIR"

echo -e "\n\e[36m=== HEROBM Backup Configuration ===\e[0m"
echo "This script will help you set up automated, recurring backups for your database."

# 1. Frequency
echo -e "\n\e[33m1. Backup Frequency\e[0m"
echo "When should the backup run?"
echo "  1) Daily at 2:00 AM"
echo "  2) Weekly (Sunday at 2:00 AM)"
echo "  3) Custom Cron Expression"
read -p "Select an option [1-3]: " freqChoice

CRON_EXP=""
case $freqChoice in
    1) CRON_EXP="0 2 * * *" ;;
    2) CRON_EXP="0 2 * * 0" ;;
    3) 
        read -p "Enter custom cron expression (e.g. '0 2 * * *'): " CRON_EXP
        ;;
    *) 
        echo -e "\e[31mInvalid option. Defaulting to Daily.\e[0m"
        CRON_EXP="0 2 * * *"
        ;;
esac

# 2. Cloud Sync (rclone)
echo -e "\n\e[33m2. Cloud Sync (Optional)\e[0m"
read -p "Do you want to sync backups to external cloud storage using rclone? (y/N): " rcloneChoice

if [[ "$rcloneChoice" =~ ^[Yy]$ ]]; then
    if ! command -v rclone >/dev/null 2>&1; then
        echo -e "\e[33mrclone is not installed.\e[0m"
        echo "Please install it first (e.g. 'sudo apt install rclone') and run this script again."
        exit 1
    fi
    
    echo -e "\n\e[36mTriggering rclone config...\e[0m"
    echo "If you haven't configured a remote yet, type 'n' for new remote and follow the prompts."
    rclone config

    echo ""
    read -p "Enter the rclone destination (e.g., gdrive:herobm_backups): " RCLONE_DEST
    
    if [ -n "$RCLONE_DEST" ]; then
        if grep -q "^BACKUP_RCLONE_DEST=" "$ENV_FILE" 2>/dev/null; then
            # Replace existing
            sed -i "s|^BACKUP_RCLONE_DEST=.*|BACKUP_RCLONE_DEST=${RCLONE_DEST}|" "$ENV_FILE"
        else
            # Append new
            echo "BACKUP_RCLONE_DEST=${RCLONE_DEST}" >> "$ENV_FILE"
        fi
        echo -e "\e[32mUpdated .env with BACKUP_RCLONE_DEST=${RCLONE_DEST}\e[0m"
    fi
fi

# 3. Email Alerts
echo -e "\n\e[33m3. Email Alerts (Optional)\e[0m"
read -p "Do you want to receive an email with the backup log? (Enter email or leave blank): " EMAIL_DEST

MAIL_CMD=""
if [ -n "$EMAIL_DEST" ]; then
    if ! command -v mail >/dev/null 2>&1; then
        echo -e "\e[33mWarning: 'mail' command not found.\e[0m"
        echo "You will need to install a mail utility (e.g., 'sudo apt install mailutils') for emails to work."
    fi
    MAIL_CMD=" | mail -s \"HeroBM DB Backup Log\" ${EMAIL_DEST}"
fi

# 4. Install Cron Job
echo -e "\n\e[33m4. Installing Cron Job\e[0m"

# Ensure the backup script is executable
chmod +x "$BACKUP_SCRIPT" 2>/dev/null || true

# Build the command string
if [ -n "$MAIL_CMD" ]; then
    CRON_CMD="${BACKUP_SCRIPT} 2>&1 | tee -a ${LOG_FILE}${MAIL_CMD}"
else
    CRON_CMD="${BACKUP_SCRIPT} >> ${LOG_FILE} 2>&1"
fi

CRON_LINE="${CRON_EXP} ${CRON_CMD}"

# Check if job already exists to avoid duplicates
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo -e "\e[33mA backup cron job already exists.\e[0m"
    echo "Replacing the existing HeroBM backup job..."
    # Remove old job and add new one
    (crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT"; echo "$CRON_LINE") | crontab -
else
    # Append new job safely
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
fi

echo -e "\n\e[32m=== Setup Complete! ===\e[0m"
echo -e "The following job has been added to your crontab:\e[36m"
echo "$CRON_LINE"
echo -e "\e[0m"
echo "Logs will be written to: $LOG_FILE"
echo "You can view your active scheduled tasks anytime by running 'crontab -l'."
echo ""

# 5. Run Test Backup
echo -e "\n\e[33m5. Test Configuration\e[0m"
read -p "Would you like to run a backup now to verify everything works? (y/N): " runNowChoice
if [[ "$runNowChoice" =~ ^[Yy]$ ]]; then
    echo -e "\n\e[36mRunning backup...\e[0m"
    bash "$BACKUP_SCRIPT"
fi
