#!/usr/bin/env bash
# ==============================================================================
# Antigravity Platform — Environment Initialisation (Linux Bash)
# ==============================================================================
# Creates .env from .env.example with auto-generated random passwords for
# local-only secrets. Only prompts for values that cannot be generated
# (ABM SQL Server connection).
#
# Usage: bash scripts/init-env.sh [-Profile <name>]
# ==============================================================================

set -e

# Change to repo root
cd "$(dirname "$0")/.."

PROFILE=""
if [ "$1" == "-Profile" ] && [ -n "$2" ]; then
    PROFILE="$2"
fi

ACTIVE_PROFILE="$PROFILE"
if [ -z "$ACTIVE_PROFILE" ] && [ -f ".active_profile" ]; then
    ACTIVE_PROFILE=$(head -n 1 ".active_profile" | tr -d '[:space:]')
fi

ENV_FILE=".env"
if [ -n "$ACTIVE_PROFILE" ]; then
    ENV_FILE=".env.$ACTIVE_PROFILE"
    echo -e "\e[35mTargeting Environment Profile: $ACTIVE_PROFILE\e[0m"
fi

EXAMPLE_FILE=".env.example"

if [ -f "$ENV_FILE" ]; then
    echo -e "\e[33m$ENV_FILE already exists at $ENV_FILE\e[0m"
    read -p "Overwrite? (y/N): " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        echo -e "\e[31mAborted.\e[0m"
        exit 0
    fi
fi

if [ ! -f "$EXAMPLE_FILE" ]; then
    echo -e "\e[31mERROR: .env.example not found at $EXAMPLE_FILE\e[0m"
    exit 1
fi

# --- Helper: generate a random alphanumeric string ---
generate_pwd() {
    local len="${1:-20}"
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$len" || true
}

# --- Read and copy the template ---
cp "$EXAMPLE_FILE" "$ENV_FILE"

# --- Auto-generate local secrets ---
GENERATED_VARS=(
    "POSTGRES_PASSWORD"
    "REDIS_PASSWORD"
    "GRAFANA_PASSWORD"
    "DEV_ADMIN_PASSWORD"
    "DEV_VIEWER_PASSWORD"
    "DEV_SALES_PASSWORD"
    "DEV_WAREHOUSE_PASSWORD"
    "DEV_PROCUREMENT_PASSWORD"
)

echo -e "\n\e[36m=== Generating local secrets ===\e[0m"
for VAR in "${GENERATED_VARS[@]}"; do
    pwd=$(generate_pwd 20)
    sed -i "s/^$VAR=<REDACTED>/$VAR=$pwd/g" "$ENV_FILE"
    echo "  Generated: $VAR"
done

# JWT secret should be longer (32 chars)
sed -i "s/^JWT_SECRET=.*$/JWT_SECRET=$(generate_pwd 32)/g" "$ENV_FILE"
echo "  Generated: JWT_SECRET"

# --- If profiling, pre-fill POSTGRES_DB to match profile ---
if [ -n "$ACTIVE_PROFILE" ]; then
    postgresDb="modbm_$ACTIVE_PROFILE"
    sed -i "s/^POSTGRES_DB=custom_app/POSTGRES_DB=$postgresDb/g" "$ENV_FILE"
    echo -e "\n\e[32m=== Auto-Configured ===\n  POSTGRES_DB=$postgresDb\e[0m"
fi

# --- Prompt for ABM SQL Server connection ---
echo -e "\n\e[36m=== ABM SQL Server Connection ===\e[0m"
echo -e "These connect to the legacy ABM database for data extraction."
echo -e "Press Enter to skip any field (you can fill it in $ENV_FILE later).\n"

read -p "ABM_MSSQL_HOST: " abmHost
if [ -n "$abmHost" ]; then sed -i "s/^ABM_MSSQL_HOST=<REDACTED>/ABM_MSSQL_HOST=$abmHost/g" "$ENV_FILE"; fi

read -p "ABM_MSSQL_DATABASE: " abmDb
if [ -n "$abmDb" ]; then sed -i "s/^ABM_MSSQL_DATABASE=<REDACTED>/ABM_MSSQL_DATABASE=$abmDb/g" "$ENV_FILE"; fi

read -p "ABM_MSSQL_USER: " abmUser
if [ -n "$abmUser" ]; then sed -i "s/^ABM_MSSQL_USER=<REDACTED>/ABM_MSSQL_USER=$abmUser/g" "$ENV_FILE"; fi

read -s -p "ABM_MSSQL_PASSWORD: " abmPass
echo ""
if [ -n "$abmPass" ]; then sed -i "s/^ABM_MSSQL_PASSWORD=<REDACTED>/ABM_MSSQL_PASSWORD=$abmPass/g" "$ENV_FILE"; fi

# --- Detect Typst binary ---
if command -v typst >/dev/null 2>&1; then
    TYPST_PATH=$(command -v typst)
    # Escape slashes for sed
    ESCAPED_PATH=$(echo "$TYPST_PATH" | sed 's/\//\\\//g')
    sed -i "s/^TYPST_BINARY_PATH=typst/TYPST_BINARY_PATH=$ESCAPED_PATH/g" "$ENV_FILE"
    echo -e "\n\e[32mDetected Typst at: $TYPST_PATH\e[0m"
fi

echo -e "\n\e[32m=== $ENV_FILE created at $ENV_FILE ===\e[0m"
echo -e "Review it and fill in any remaining <REDACTED> values.\n"
