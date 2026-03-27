#!/usr/bin/env bash
# Start API in background and FE in foreground
cd "$(dirname "$0")/.."

echo -e "\e[32mStarting local Dev Environment...\e[0m"
echo -e "\e[36mAPI will start on port 3002\e[0m"
echo -e "\e[36mPortal will start on port 4301\e[0m"

# The pipeline log dir Needs to be absolute or relative correctly
LOG_DIR="$(pwd)/logs"

# Start API in background
PORT=3002 PIPELINE_LOG_DIR="$LOG_DIR" npm run start:dev -w apps/api &
API_PID=$!

# Start FE in foreground
API_URL='http://localhost:3002' npm run dev:local -w apps/ops-portal

# Cleanup API when user terminates the script
trap "kill $API_PID" EXIT
