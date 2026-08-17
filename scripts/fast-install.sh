#!/usr/bin/env bash
set -e

echo -e "\033[36mStarting Fast Install Sequence...\033[0m"

# 1. Install prerequisites interactively (preserves choices)
# (Aligns with: make cli-install-prereqs)
bash scripts/setup.sh

# 2. Create .env and secrets
make init-env

# 3. Install npm dependencies
make install-npm

# 4. Start containers
make up-db

# 5. Initialize schemas (waits for PG)
make init-db

# 6. Apply SQL migrations
make migrate

# 7. Seed data & verify
make bootstrap

# 8. Start FE and API containers (or user's startup choice)
if [ -f .startup_choice ]; then
    CHOICE=$(cat .startup_choice)
    make $CHOICE
    rm -f .startup_choice
else
    make up
fi

echo -e "\033[32mFast Install Complete!\033[0m"

