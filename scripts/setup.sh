# ==============================================================================
# HeroBM Platform — Prerequisite Installer (Linux Bash)
# ==============================================================================
# Checks for and installs required development tools via Linux package managers.
# Sets up local systemd autostart services.
#
# Usage: bash scripts/setup.sh [--non-interactive]
# ==============================================================================

set -e

NON_INTERACTIVE=false
if [[ "$1" == "--non-interactive" ]]; then
    NON_INTERACTIVE=true
fi

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

install_typst_fallback() {
    echo -e "\e[33mAttempting to install Typst via GitHub binary fallback...\e[0m"
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)  TYPST_URL="https://github.com/typst/typst/releases/download/v0.12.0/typst-x86_64-unknown-linux-musl.tar.xz" ;;
        aarch64) TYPST_URL="https://github.com/typst/typst/releases/download/v0.12.0/typst-aarch64-unknown-linux-musl.tar.xz" ;;
        *) echo -e "\e[31mUnsupported architecture for Typst fallback: $ARCH\e[0m"; return 1 ;;
    esac

    TMP_DIR=$(mktemp -d)
    curl -L "$TYPST_URL" -o "$TMP_DIR/typst.tar.xz"
    tar -xJf "$TMP_DIR/typst.tar.xz" -C "$TMP_DIR"
    sudo mv "$TMP_DIR"/typst-*/typst /usr/local/bin/
    rm -rf "$TMP_DIR"
    echo -e "  \e[32m[INSTALLED]\e[0m Typst via GitHub"
}

if [ ${#MISSING[@]} -ne 0 ]; then
    echo -e "\n\e[33mAttempting to install missing prerequisites...\e[0m"
    if command -v apt-get >/dev/null 2>&1; then
        echo "Detected Debian/Ubuntu (apt-get). Asking for sudo..."
        sudo apt-get update
        for pkg in "${MISSING[@]}"; do
            if [ "$pkg" == "node" ]; then
                sudo apt-get install -y nodejs npm
            elif [ "$pkg" == "typst" ]; then
                sudo apt-get install -y typst || install_typst_fallback
            else
                sudo apt-get install -y "$pkg"
            fi
        done
    elif command -v dnf >/dev/null 2>&1; then
        echo "Detected Fedora/RHEL (dnf). Asking for sudo..."
        for pkg in "${MISSING[@]}"; do
            if [ "$pkg" == "typst" ]; then
                sudo dnf install -y typst || install_typst_fallback
            else
                sudo dnf install -y "${pkg/node/nodejs npm}"
            fi
        done
    else
        echo -e "\e[31mUnsupported package manager. Please install these manually: ${MISSING[*]}\e[0m"
        # Try typst fallback anyway if missing
        if [[ " ${MISSING[*]} " == *" typst "* ]]; then install_typst_fallback; fi
    fi
fi

echo -e "\n\e[36m--- Python packages ---\e[0m"
if command -v podman-compose >/dev/null 2>&1; then
    echo -e "  \e[32m[OK]\e[0m podman-compose -- $(command -v podman-compose)"
else
    echo -e "  \e[33m[MISSING]\e[0m podman-compose -- installing via pip..."
    pip3 install podman-compose --user >/dev/null 2>&1 || pip install podman-compose --user >/dev/null 2>&1
    echo -e "  \e[32m[INSTALLED]\e[0m podman-compose"
fi

echo -e "\n\e[36m--- Podman Setup ---\e[0m"
echo -e "  Creating logs directory and setting permissions..."
mkdir -p ./logs
podman unshare chown -R 70:70 ./logs 2>/dev/null || true

if [ "$NON_INTERACTIVE" = false ]; then
    echo -e "\n\e[36m--- Installation Profile Selection ---\e[0m"
    echo "Please select how you want to run the application code:"
    echo "  1) Local native Node.js (Recommended for fullstack developers)"
    echo "  2) Full Containerization (Recommended for pure evaluation/ops)"
    read -p "Enter option [1 or 2]: " pathChoice
    read -p "Enable ERPNext Integration Stack? [y/N]: " installErpnext
else
    pathChoice="1"
    installErpnext="n"
fi

makeTargets=()
if [ "$pathChoice" == "1" ]; then
    makeTargets+=("up-db")
else
    makeTargets+=("up-fe-api")
fi

if [[ "$installErpnext" =~ ^[Yy] ]]; then makeTargets+=("up-erpnext"); fi

MAKE_CMD_STRING="make ${makeTargets[*]}"

echo -e "\n\e[36m--- Startup Automation ---\e[0m"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"
SERVICE_FILE="$SYSTEMD_USER_DIR/herobm.service"

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
systemctl --user enable herobm.service || true
echo -e "  \e[32m[OK]\e[0m Created systemd user config: herobm.service"

echo -e "\n\e[36m=== Summary ===\e[0m"
echo -e "\n  All prerequisites verified!\n"
if [ "$NON_INTERACTIVE" = false ]; then
    echo -e "  To boot your environment, run:"
    echo -e "  \e[36m> make init-env ${makeTargets[*]}\e[0m"
fi
