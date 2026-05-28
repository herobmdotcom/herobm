#!/usr/bin/env bash
# Start API in background and FE in foreground (Production mode)
cd "$(dirname "$0")/.."

PROFILE=""
ENABLE_SWAGGER="false"
ENABLE_MCP="false"
ENABLE_DBT_DOCS="false"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -Profile) PROFILE="$2"; shift ;;
        -WithSwagger|--with-swagger) ENABLE_SWAGGER="true" ;;
        -Mcp|--mcp) ENABLE_MCP="true" ;;
        -WithDbt|--with-dbt) ENABLE_DBT_DOCS="true" ;;
    esac
    shift
done

ACTIVE_PROFILE="$PROFILE"
if [ -z "$ACTIVE_PROFILE" ] && [ -f ".active_profile" ]; then
    ACTIVE_PROFILE=$(head -n 1 ".active_profile" | tr -d '[:space:]')
fi

ENV_FILE=".env"
if [ -n "$ACTIVE_PROFILE" ]; then
    ENV_FILE=".env.$ACTIVE_PROFILE"
    echo -e "\e[35mTargeting Environment Profile: $ACTIVE_PROFILE\e[0m"
else
    echo -e "\e[35mTargeting Default Environment\e[0m"
fi

ENV_EXPORTS=""
if [ -f "$ENV_FILE" ]; then
    echo -e "\e[90mLoading configuration from: $ENV_FILE\e[0m"
    API_PORT=${API_PORT:-3001}
    FE_PORT=${FE_PORT:-4301}
    while IFS='=' read -r name value || [ -n "$name" ]; do
        if [[ $name =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
            # Clean up the value by removing trailing comments or quotes if needed
            # For simplicity, just export exactly as-is securely
            clean_value=$(echo "$value" | tr -d '\r')
            if [ "$name" == "API_PORT" ]; then API_PORT="$clean_value"; fi
            if [ "$name" == "FE_PORT" ]; then FE_PORT="$clean_value"; fi
            ENV_EXPORTS="$ENV_EXPORTS $name='$clean_value'"
        fi
    done < <(grep -v '^#' "$ENV_FILE" | grep '=')
else
    echo -e "\e[33mWarning: $ENV_FILE not found!\e[0m"
fi

ENV_EXPORTS="$ENV_EXPORTS ENABLE_SWAGGER='$ENABLE_SWAGGER'"

echo -e "\e[32mStarting local Prod Environment...\e[0m"
echo -e "\e[36mAPI will start on port $API_PORT\e[0m"
echo -e "\e[36mPortal will start on port $FE_PORT\e[0m"

# The pipeline log dir Needs to be absolute or relative correctly
LOG_DIR="$(pwd)/logs"

# Start API in background
eval "env ENV_FILE='$ENV_FILE' $ENV_EXPORTS PORT=$API_PORT PIPELINE_LOG_DIR='$LOG_DIR' npm run start:prod -w apps/api &"
API_PID=$!

# Start FE in foreground
echo -e "\e[32mPortal connecting to API at: http://localhost:$API_PORT\e[0m"
eval "env ENV_FILE='$ENV_FILE' $ENV_EXPORTS API_URL='http://localhost:$API_PORT' PORT=$FE_PORT npm run start:prod -w apps/ops-portal &"
FE_PID=$!

if [ "$ENABLE_MCP" == "true" ]; then
    echo -e "\e[36mMCP Server will start in prod mode\e[0m"
    eval "env ENV_FILE='$ENV_FILE' $ENV_EXPORTS npm run start -w apps/mcp-server &"
    MCP_PID=$!
fi

if [ "$ENABLE_DBT_DOCS" == "true" ]; then
    echo -e "\e[36mdbt docs will be served\e[0m"
    (cd pipelines/abm_transform && ../../.venv/bin/dbt docs serve) &
    DBT_PID=$!
fi

# Cleanup when user terminates the script
trap "kill $API_PID $FE_PID $MCP_PID $DBT_PID 2>/dev/null" EXIT
wait
