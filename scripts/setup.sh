# ==============================================================================
# HeroBM Platform — Prerequisite Installer (POSIX / Linux & macOS Bash)
# ==============================================================================
# Checks for and installs required development tools via brew, apt, dnf, or fallback.
# Sets up local container runtime and services.
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

echo -e "\n\033[36m=== HEROBM SETUP ===\033[0m"
echo "Checking prerequisites..."

PREREQS=("podman" "node" "python3" "typst" "make")
MISSING=()

for cmd in "${PREREQS[@]}"; do
    if command -v "$cmd" >/dev/null 2>&1; then
        if [ "$cmd" == "node" ]; then
            NODE_VER=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
            if [ "$NODE_VER" -lt 20 ]; then
                echo -e "  \033[33m[OUTDATED]\033[0m node -- v$NODE_VER (requires >= 20)"
                MISSING+=("node")
            else
                echo -e "  \033[32m[OK]\033[0m node -- $(node -v)"
            fi
        else
            echo -e "  \033[32m[OK]\033[0m $cmd -- $(command -v "$cmd")"
        fi
    else
        echo -e "  \033[33m[MISSING]\033[0m $cmd"
        MISSING+=("$cmd")
    fi
done

install_typst_fallback() {
    echo -e "\033[33mAttempting to install Typst via GitHub binary fallback...\033[0m"
    OS=$(uname -s)
    ARCH=$(uname -m)
    case "$OS" in
        Linux)
            case "$ARCH" in
                x86_64)  TYPST_URL="https://github.com/typst/typst/releases/download/v0.12.0/typst-x86_64-unknown-linux-musl.tar.xz" ;;
                aarch64|arm64) TYPST_URL="https://github.com/typst/typst/releases/download/v0.12.0/typst-aarch64-unknown-linux-musl.tar.xz" ;;
                *) echo -e "  \033[31mUnsupported architecture for Linux Typst fallback: $ARCH\033[0m"; return 1 ;;
            esac
            ;;
        Darwin)
            case "$ARCH" in
                x86_64) TYPST_URL="https://github.com/typst/typst/releases/download/v0.12.0/typst-x86_64-apple-darwin.tar.xz" ;;
                arm64|aarch64) TYPST_URL="https://github.com/typst/typst/releases/download/v0.12.0/typst-aarch64-apple-darwin.tar.xz" ;;
                *) echo -e "  \033[31mUnsupported architecture for macOS Typst fallback: $ARCH\033[0m"; return 1 ;;
            esac
            ;;
        *)
            echo -e "  \033[31mUnsupported OS for Typst fallback: $OS\033[0m"; return 1 ;;
    esac

    TMP_DIR=$(mktemp -d)
    if curl -sSL "$TYPST_URL" -o "$TMP_DIR/typst.tar.xz"; then
        tar -xJf "$TMP_DIR/typst.tar.xz" -C "$TMP_DIR"
        TARGET_BIN_DIR="/usr/local/bin"
        if [ ! -w "$TARGET_BIN_DIR" ]; then
            sudo mv "$TMP_DIR"/typst-*/typst "$TARGET_BIN_DIR/"
        else
            mv "$TMP_DIR"/typst-*/typst "$TARGET_BIN_DIR/"
        fi
        rm -rf "$TMP_DIR"
        echo -e "  \033[32m[INSTALLED]\033[0m Typst via GitHub binary"
        return 0
    else
        rm -rf "$TMP_DIR"
        echo -e "  \033[31m[FAILED]\033[0m Could not download Typst binary fallback"
        return 1
    fi
}

if [ ${#MISSING[@]} -ne 0 ]; then
    echo -e "\n\033[33mAttempting to install missing prerequisites...\033[0m"
    if command -v brew >/dev/null 2>&1; then
        echo "Detected macOS / Homebrew (brew). Installing missing packages..."
        for pkg in "${MISSING[@]}"; do
            if [ "$pkg" == "node" ]; then
                brew install node
            elif [ "$pkg" == "typst" ]; then
                brew install typst || install_typst_fallback || true
            else
                brew install "$pkg" || true
            fi
        done
    elif command -v apt-get >/dev/null 2>&1; then
        echo "Detected Debian/Ubuntu (apt-get). Asking for sudo..."
        sudo apt-get update
        for pkg in "${MISSING[@]}"; do
            if [ "$pkg" == "node" ]; then
                curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
                sudo -E bash nodesource_setup.sh
                sudo apt-get install -y nodejs
                rm -f nodesource_setup.sh
            elif [ "$pkg" == "typst" ]; then
                sudo apt-get install -y typst || install_typst_fallback || true
            else
                sudo apt-get install -y "$pkg"
            fi
        done
    elif command -v dnf >/dev/null 2>&1; then
        echo "Detected Fedora/RHEL (dnf). Asking for sudo..."
        for pkg in "${MISSING[@]}"; do
            if [ "$pkg" == "node" ]; then
                curl -fsSL https://rpm.nodesource.com/setup_22.x -o nodesource_setup.sh
                sudo bash nodesource_setup.sh
                sudo dnf install -y nodejs
                rm -f nodesource_setup.sh
            elif [ "$pkg" == "typst" ]; then
                sudo dnf install -y typst || install_typst_fallback || true
            else
                sudo dnf install -y "$pkg"
            fi
        done
    else
        echo -e "\033[31mNo supported package manager (brew, apt-get, dnf) found automatically.\033[0m"
        if [ "$(uname -s)" = "Darwin" ]; then
            echo -e "\033[33mTo install Homebrew on macOS, run:\033[0m"
            echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        fi
        # Try typst fallback anyway if missing
        if [[ " ${MISSING[*]} " == *" typst "* ]]; then
            install_typst_fallback || true
        fi
    fi
fi

# Re-check mandatory prerequisites before proceeding
CRITICAL_MISSING=()
for cmd in "podman" "node" "python3" "make"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        CRITICAL_MISSING+=("$cmd")
    fi
done

if [ ${#CRITICAL_MISSING[@]} -ne 0 ]; then
    echo -e "\n\033[31m[ERROR] Required tools are missing: ${CRITICAL_MISSING[*]}\033[0m"
    if [ "$(uname -s)" = "Darwin" ]; then
        if command -v brew >/dev/null 2>&1; then
            echo -e "\033[33mInstall them with Homebrew:\033[0m"
            echo "  brew install ${CRITICAL_MISSING[*]}"
        else
            echo -e "\033[33mInstall Homebrew (https://brew.sh) and run:\033[0m"
            echo "  brew install podman node typst podman-compose"
        fi
    else
        echo -e "\033[33mPlease install missing tools using your system package manager.\033[0m"
    fi
    exit 1
fi

echo -e "\n\033[36m--- Python packages ---\033[0m"
if command -v podman-compose >/dev/null 2>&1; then
    echo -e "  \033[32m[OK]\033[0m podman-compose -- $(command -v podman-compose)"
else
    echo -e "  \033[33m[MISSING]\033[0m podman-compose -- installing..."
    if command -v brew >/dev/null 2>&1; then
        brew install podman-compose >/dev/null 2>&1 || true
    elif command -v apt-get >/dev/null 2>&1; then
        sudo apt-get install -y podman-compose >/dev/null 2>&1 || true
    elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y podman-compose >/dev/null 2>&1 || true
    fi
    
    if ! command -v podman-compose >/dev/null 2>&1; then
        pip3 install podman-compose --user --break-system-packages >/dev/null 2>&1 || pip3 install podman-compose --user >/dev/null 2>&1 || true
    fi
    if command -v podman-compose >/dev/null 2>&1; then
        echo -e "  \033[32m[INSTALLED]\033[0m podman-compose"
    else
        echo -e "  \033[33m[WARNING]\033[0m podman-compose could not be installed automatically. Please install it manually if needed."
    fi
fi

echo -e "\n\033[36m--- Podman Setup ---\033[0m"
echo -e "  Creating logs directory..."
mkdir -p ./logs
chmod -R 777 ./logs 2>/dev/null || chmod -R a+rwx ./logs 2>/dev/null || true
if [ "$(uname -s)" = "Linux" ]; then
    podman unshare chmod -R 777 ./logs 2>/dev/null || true
elif [ "$(uname -s)" = "Darwin" ] && command -v podman >/dev/null 2>&1; then
    MACHINE_LIST=$(podman machine list --format "{{.Name}}" 2>/dev/null || true)
    if [ -z "$MACHINE_LIST" ]; then
        echo -e "  \033[33mNo Podman machine found. Initialising...\033[0m"
        podman machine init --now || true
    else
        echo -e "  \033[32m[OK]\033[0m Podman machine exists: $MACHINE_LIST"
        echo -e "  Ensuring Podman machine is running..."
        podman machine start 2>/dev/null || true
    fi
fi

if [ "$NON_INTERACTIVE" = false ]; then
    echo -e "\n\033[36m--- Installation Profile Selection ---\033[0m"
    echo "Please select how you want to run the application code:"
    echo "  1) Local Development (Recommended for active code development)"
    echo "     - Runs databases & brokers in containers (PostgreSQL, Redis)"
    echo "     - Runs Next.js UI (port 4301/8000) and NestJS API (port 3001/3002) locally with hot reload"
    echo "  2) Full Containerization (Recommended for standard evaluation & ops)"
    echo "     - Runs all services in containers (API, UI, Database, Redis, Outbox, Pipeline)"
    echo "     - Direct access to the Next.js UI at http://localhost:8000"
    echo "  3) Full Containerization + Nginx Reverse Proxy (Recommended for staging/edge setups)"
    echo "     - Runs all services in containers like Option 2"
    echo "     - Adds an Nginx reverse proxy container in front of the UI on http://localhost:8080 (or port 80)"
    read -p "Enter option [1, 2, or 3] (Default: 1): " pathChoice
    pathChoice="${pathChoice:-1}"
else
    pathChoice="1"
fi

makeTargets=()
if [ "$pathChoice" == "1" ]; then
    makeTargets+=("up-db")
elif [ "$pathChoice" == "3" ]; then
    makeTargets+=("up-portal-api-nginx")
else
    makeTargets+=("up-portal-api")
fi
echo "${makeTargets[*]}" > .startup_choice

MAKE_CMD_STRING="make ${makeTargets[*]}"

if [ "$(uname -s)" = "Linux" ] && command -v systemctl >/dev/null 2>&1; then
    echo -e "\n\033[36m--- Startup Automation ---\033[0m"
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
    echo -e "  \033[32m[OK]\033[0m Created systemd user config: herobm.service"
fi

echo -e "\n\033[36m=== Summary ===\033[0m"
echo -e "\n  All prerequisites verified!\n"
if [ "$NON_INTERACTIVE" = false ]; then
    echo -e "  To boot your environment, run:"
    echo -e "  \033[36m> make init-env ${makeTargets[*]}\033[0m"
fi
