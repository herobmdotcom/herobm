#!/usr/bin/env bash
set -e

echo -e "\e[36mStarting Fast Install Sequence...\e[0m"

# 1. Install prerequisites interactively (preserves choices)
# (Aligns with: make cli-install-prereqs)
bash scripts/setup.sh

# 2. Create .env and secrets
make cli-init-env

# 3. Install npm dependencies
make cli-install-npm

# 4. Start containers
make cli-up-db

# 5. Initialize schemas (waits for PG)
make cli-init-db

# 6. Apply SQL migrations
make cli-migrate

# 7. Seed data & verify
make cli-bootstrap

# 8. Start FE and API containers (or user's startup choice)
if [ -f .startup_choice ]; then
    CHOICE=$(cat .startup_choice)
    make $CHOICE
    rm .startup_choice
else
    make up
fi

echo -e "\e[32mFast Install Complete!\e[0m"
