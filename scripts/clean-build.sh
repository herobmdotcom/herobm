#!/bin/bash
echo -e "\e[36mNuking Next.js cache, NestJS dist, and node_modules...\e[0m"

# Find and remove node_modules, .next, and dist directories
find . -type d \( -name "node_modules" -o -name ".next" -o -name "dist" \) -exec rm -rf {} + 2>/dev/null

echo -e "\e[36mRemoving TypeScript build info cache...\e[0m"
find . -type f -name "*.tsbuildinfo" -exec rm -f {} + 2>/dev/null

echo -e "\e[32mWorkspace cache clean.\e[0m"
