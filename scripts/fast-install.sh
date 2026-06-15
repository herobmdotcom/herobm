#!/usr/bin/env bash
set -e

echo -e "\e[36mStarting Fast Install Sequence...\e[0m"

# 1. Install prerequisites interactively (preserves choices)
bash scripts/setup.sh

# 2. Proceed through the CLI sequence
make cli-init-env
make cli-install-npm
make cli-up-db
make cli-init-db
make cli-migrate
make cli-bootstrap
make up

echo -e "\e[32mFast Install Complete!\e[0m"
