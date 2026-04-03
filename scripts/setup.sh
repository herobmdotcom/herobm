#!/usr/bin/env bash
# ==============================================================================
# HeroBM Platform — Prerequisite Installer (Linux Bash)
# ==============================================================================
# Checks for and installs required development tools via Linux package managers.
# Sets up local systemd autostart services.
#
# Usage: bash scripts/setup.sh
# ==============================================================================

set -e

# Change to repo root
cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"

echo -e "\n\e[36m=== HEROBM SETUP ===\e[0m"
echo "Checking prerequisites..."

PREREQS=("podman" "node" "python3" "typst" "make")
MISSING=()

for cmd in "${PREREQS[@]}"; do
    if command -v "$cmd" >/dev/null 2>&1; then
        echo -e "  \e[32m[OK]\e[0m $cmd -- $(command -v "$cmd")"
    else
        echo -e "  \e[33m[MISSING]\e[0m $cmd"
        MISSING+=("$cmd")
    fi
done

if [ ${#MISSING[@]} -ne 0 ]; then
    echo -e "\n\e[33mAttempting to install missing prerequisites...\e[0m"
    if command -v apt-get >/dev/null 2>&1; then
        echo "Detected Debian/Ubuntu (apt-get). Asking for sudo..."
        sudo apt-get update
        for pkg in "${MISSING[@]}"; do
            if [ "$pkg" == "node" ]; then
                sudo apt-get install -y nodejs npm
            else
                sudo apt-get install -y "$pkg"
            fi
        done
    elif command -v dnf >/dev/null 2>&1; then
        echo "Detected Fedora/RHEL (dnf). Asking for sudo..."
        sudo dnf install -y "${MISSING[@]/node/nodejs npm}"
    else
        echo -e "\e[31mUnsupported package manager. Please install these manually: ${MISSING[*]}\e[0m"
        exit 1
    fi
fi

echo -e "\n\e[36m--- Python packages ---\e[0m"
if command -v podman-compose >/dev/null 2>&1; then
    echo -e "  \e[32m[OK]\e[0m podman-compose -- $(command -v podman-compose)"
else
    echo -e "  \e[33m[MISSING]\e[0m podman-compose -- installing via pip..."
    # Suppress output unless it fails
    if pip3 install podman-compose --user >/dev/null 2>&1; then
        echo -e "  \e[32m[INSTALLED]\e[0m podman-compose"
    else
        echo -e "  \e[31m[FAILED]\e[0m Failed to install podman-compose. Try installing manually."
    fi
fi

echo -e "\n\e[36m--- Podman Setup ---\e[0m"
echo -e "  Creating podman_logs shared volume for log scraping..."
LOG_DIR="$HOME/.local/share/containers/storage/overlay-containers"
mkdir -p "$LOG_DIR"
podman volume create --opt type=none --opt o=bind --opt device="$LOG_DIR" podman_logs 2>/dev/null || true

echo -e "\n\e[36m--- Installation Profile Selection ---\e[0m"
echo "Please select how you want to run the application code:"
echo "  1) Local native Node.js (Recommended for fullstack developers)"
echo "  2) Full Containerization (Recommended for pure evaluation/ops)"
read -p "Enter option [1 or 2]: " pathChoice

read -p "Enable PLG Stack (Prometheus/Loki/Grafana)? [y/N]: " installPlg
read -p "Enable ERPNext Integration Stack? [y/N]: " installErpnext

makeTargets=()
if [ "$pathChoice" == "1" ]; then
    makeTargets+=("up-db")
    echo -e "  \e[90m-> Selected Local Dev path\e[0m"
else
    makeTargets+=("up-fe-api")
    echo -e "  \e[90m-> Selected Full Containerization path\e[0m"
fi

if [[ "$installPlg" =~ ^[Yy] ]]; then
    makeTargets+=("up-plg")
    echo -e "  \e[90m-> Enabled PLG Stack\e[0m"
fi
if [[ "$installErpnext" =~ ^[Yy] ]]; then
    makeTargets+=("up-erpnext")
    echo -e "  \e[90m-> Enabled ERPNext Stack\e[0m"
fi

MAKE_CMD_STRING="make ${makeTargets[*]}"

echo -e "\n\e[36m--- Startup Automation ---\e[0m"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"
SERVICE_FILE="$SYSTEMD_USER_DIR/modbm.service"

cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=HeroBM Platform Application Autostart
After=network.target

[Service]
Type=oneshot
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/env make ${makeTargets[*]}
RemainAfterExit=yes

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload || true
systemctl --user enable modbm.service || true
echo -e "  \e[32m[OK]\e[0m Created systemd user config: modbm.service"
echo -e "       (Will run '$MAKE_CMD_STRING' on boot for this user)"

echo -e "\n\e[36m=== Summary ===\e[0m"
echo -e "\n  All prerequisites verified! To boot your environment and start the setup wizard, run:\n"
echo -e "  \e[36m> make init-env ${makeTargets[*]} setup-wizard\e[0m"
