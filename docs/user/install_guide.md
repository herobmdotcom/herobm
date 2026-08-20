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

## 1. Quick Start (Fast Install — Recommended)

The primary and recommended way to install and configure HeroBM on any machine (Linux, macOS, Windows) is using `make fast-install`.

1. Clone the repository and navigate to the project root:
   ```bash
   git clone <repo-url> herobm
   cd herobm
   ```

2. Run the automated Fast Install command:
   ```bash
   make fast-install
   ```

   > [!TIP]
   > On Windows without `make` pre-installed, you can run `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` once to install Make, then run `make fast-install`.

The Fast Install target automatically:
1. **Installs OS Prerequisites** (`make install-prereqs`): Checks and installs Node.js (>=20), Podman, Python 3, Typst, and Make.
2. **Generates Environment Configuration** (`make init-env`): Creates `.env` with secure auto-generated credentials.
3. **Installs Dependencies** (`make install-npm`): Installs all workspace npm packages and native bindings.
4. **Starts Database Services** (`make up-db`): Boots PostgreSQL and Redis containers.
5. **Initializes Database Schemas** (`make init-db`): Waits for PostgreSQL readiness and initializes schemas.
6. **Applies Migrations** (`make migrate`): Applies all Drizzle SQL database migrations.
7. **Bootstraps Data & Admin User** (`make bootstrap`): Seeds master data and outputs your secure admin password.
8. **Launches Applications** (`make up` or selected profile): Starts the Ops Portal and API backend.

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
