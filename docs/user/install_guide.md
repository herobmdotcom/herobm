---
id: install-guide
title: "Installation & Setup Guide"
description: "Universal fast-install setup guide for Windows, Linux, and macOS."
category: "Technical"
order: 31
resource: "system"
action: "read"
routes:
  - "/admin/version"
tags: ["installation", "setup", "fast-install", "deployment", "prerequisites"]
fields:
  fast_install:
    title: "Fast Install"
    summary: "One-step automated setup target: `make fast-install`."
  env_config:
    title: "Environment Configuration"
    summary: "Local credentials and secrets configured in `.env`."
related:
  - "technical-operations"
  - "admin-settings"
---

# Installation & Setup Guide

HeroBM uses a universal automated **Fast Install** sequence to configure prerequisites, containers, database migrations, and initial seed data across Windows, Linux, and macOS.

---

## 1. Quick Start (Fast Install)

1. Clone the repository and navigate to the project root:
   ```bash
   git clone <repo-url> herobm
   cd herobm
   ```

2. Run the automated Fast Install command:
   - **Windows (PowerShell)**:
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
     make fast-install
     ```
   - **Linux / macOS**:
     ```bash
     make fast-install
     ```

The Fast Install script automatically:
- Installs OS prerequisites (Node.js, Podman/Docker, Python, Typst).
- Generates a secure `.env` file with random secret keys.
- Installs all JavaScript and Python dependencies.
- Starts database containers (PostgreSQL & Redis) and waits for health checks.
- Runs Drizzle schema migrations and seeds default Chart of Accounts and Admin accounts.
- Launches the application containers.

---

## 2. Step-by-Step Manual Sequence

If you prefer executing each step individually or are configuring a custom CI/CD runner:

| Step | Command | Description |
| :---: | :--- | :--- |
| **1** | `make install-prereqs` | Installs OS-level package dependencies (Node, Podman, Typst, Python). |
| **2** | `make init-env` | Generates `.env` and secure application secrets. |
| **3** | `make setup-python` | Creates `.venv` and installs pipeline dependencies. |
| **4** | `make install-npm` | Installs NPM packages and compiles native bindings. |
| **5** | `make up-db` | Starts background PostgreSQL and Redis containers. |
| **6** | `make init-db` | Initializes PostgreSQL schemas and waits for database readiness. |
| **7** | `make migrate` | Applies all Drizzle SQL database migrations. |
| **8** | `make bootstrap` | Seeds master data and outputs your secure `admin` credentials. |
| **9** | `make up` | Launches the Ops Portal and API backend. |

---

## 3. Daily Operations & Verification

- **Start Services**: `make up` (or `make prod-local` for standalone testing)
- **Stop Services**: `make down`
- **View Container Logs**: `make logs`
- **Run Fast Test Verification**: `make verify-fast`
- **Access Ops Portal**: `http://localhost:4300` (or `http://localhost:4301` in standalone mode)
