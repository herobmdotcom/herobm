# Installation Guide

This guide walks you through setting up the Antigravity Platform on a fresh Windows machine. You will need administrator access and a working internet connection.

## What You're Installing

The platform runs as a set of local services on your machine:

| Service | Purpose |
|---|---|
| **PostgreSQL** | Database (orders, accounts, products, etc.) |
| **Redis** | Background job queue |
| **Custom API** | Backend application server |
| **Prometheus** | Metrics collection |
| **Grafana** | Dashboards and monitoring |
| **Loki + Promtail** | Log aggregation |

All services run inside **Podman** containers — lightweight virtual environments that keep everything isolated from your system.

---

## Step 1: Install Prerequisites

### What you need already

The setup script assumes these are already on your machine (they ship with modern Windows):

- **Git** — you probably used it to clone this repo (`git --version` to check)
- **winget** — the Windows package manager (built into Windows 10 1809+ and Windows 11)

If `winget` is not available, install [App Installer from the Microsoft Store](https://apps.microsoft.com/detail/9nblggh4nns1).

### Running the setup script

Open **PowerShell** (right-click the Start menu → "Terminal" or "PowerShell") and navigate to the project folder:

```powershell
cd C:\path\to\modbm
```

Run the setup script:

```powershell
.\scripts\setup.ps1
```

This checks for and installs:
- **Podman** — container runtime (replaces Docker)
- **Node.js** — JavaScript runtime for the API and portals
- **Python** — required for data pipelines and dbt
- **Typst** — report generation engine
- **podman-compose** — orchestrates the containers (installed via `pip`)
- **Make** — task runner (may need manual install, the script will tell you)

### Permissions

Most `winget` installs work without administrator privileges. If any install fails with a permissions error, try running PowerShell **as Administrator** (right-click → "Run as administrator") and re-run the script. The script is safe to re-run — it skips anything already installed.

### If the script fails

If `winget` installs fail (e.g. corporate policy restrictions), you can install the tools manually:

| Tool | Manual install |
|---|---|
| Podman | [podman.io/docs/installation](https://podman.io/docs/installation) — download the Windows `.exe` installer |
| Node.js | [nodejs.org](https://nodejs.org) — download the LTS `.msi` installer |
| Python | [python.org](https://www.python.org/downloads/) — tick "Add to PATH" during install |
| Typst | `winget install Typst.Typst` or download from [github.com/typst/typst/releases](https://github.com/typst/typst/releases) |
| Make | `choco install make` (via [Chocolatey](https://chocolatey.org)) or `scoop install make` (via [Scoop](https://scoop.sh)) |
| podman-compose | `pip install podman-compose` (requires Python) |

### After installing

**Close and reopen PowerShell** so that newly installed tools are available on your PATH.

Then install JavaScript dependencies:

```powershell
cd apps/api && npm install && cd ../..
cd apps/ops-portal && npm install && cd ../..
```

---

## Step 2: Configure Environment Variables

The platform needs a `.env` file with passwords and connection settings. Run:

```powershell
.\scripts\init-env.ps1
```

This will:
1. Create a `.env` file from the template
2. **Automatically generate** random passwords for all local services (PostgreSQL, Redis, Grafana, API, portal users)
3. **Prompt you** for the ABM SQL Server connection — you'll need:
   - **Host** — the ABM server IP address or hostname
   - **Database** — the ABM database name
   - **Username** — your ABM read-only account
   - **Password** — your ABM account password

If you don't have the ABM details yet, press Enter to skip — you can fill them in later by editing the `.env` file in a text editor.

---

## Step 3: Start the Platform

```powershell
make up
```

This starts all 7 core services. The first run will download container images (roughly 1 GB), which takes a few minutes on a typical connection. Subsequent starts are fast.

### Optional: ERPNext Financial Ledger Integration

ModBM supports an optional, headless integration with ERPNext for General Ledger capabilities (Chart of Accounts, Journal Entries, Tax Templates). 

To start the platform **with** ERPNext enabled:

```powershell
make up-erpnext
```
*(Use this instead of just `make up`)*

This will download and run the additional Frappe, MariaDB, and Redis containers.

Check that everything is running:

```powershell
make ps
```

You should see all services listed as `Up` with `(healthy)` next to most of them. Give it about 30 seconds after `make up` for health checks to complete.

---

## Step 4: Initialise the Database

```powershell
make init
```

This runs four steps automatically:

1. **Build** — compiles the API application
2. **Migrate** — creates all database tables
3. **ELT** — imports data from the ABM system (requires ABM connection in `.env`)
4. **Seed** — creates portal user accounts and populates inventory

This takes 2–3 minutes. If the ELT step fails (e.g. ABM not reachable), the tables and users are still created — you can re-run `make elt` and `make seed` later when the connection is available.

---

## Step 5: Verify

```powershell
make test-infra
```

You should see `24/24 passed`. If any tests fail, check `make ps` to ensure all containers are healthy.

---

## Logging In

Once initialisation is complete:

| Portal | URL | Default User | Password |
|---|---|---|---|
| **Ops Portal** | `http://localhost:4300` | `admin` | The value of `DEV_ADMIN_PASSWORD` in your `.env` file |
| **Grafana** | `http://localhost:3000` | `admin` | The value of `GRAFANA_PASSWORD` in your `.env` file |

Other portal accounts: `sales`, `warehouse`, `procurement` — each with their own password from `.env`.

---

## Daily Usage

| Action | Command |
|---|---|
| Start the platform | `make up` |
| Stop the platform | `make down` |
| View logs | `make logs` |
| Check container status | `make ps` |
| Refresh data from ABM | `make elt` |
| Run API in dev mode | `make dev-api` |
| Run portal in dev mode | `make dev-portal` |

---

## Troubleshooting

### "podman: command not found"
Close and reopen PowerShell after running `setup.ps1`. Podman needs to be on your PATH.

### "podman-compose: executable file not found"
Install it with: `pip install podman-compose`, then restart PowerShell.

### Containers won't start
Check that the Podman machine is running: `podman machine list`. If it shows "Stopped", start it with `podman machine start`.

### ELT fails with connection error
Verify the ABM connection settings in your `.env` file. The ABM server must be reachable from your machine.

### "make: command not found"
Make isn't bundled with Windows. Install via `choco install make` (if you have Chocolatey) or `scoop install make` (if you have Scoop).

### Need to start over completely
```powershell
make nuke    # removes all containers, volumes, and local images
make up      # recreate containers with empty database
make init    # rebuild everything from scratch
```

---

## Architecture Overview

For a deeper understanding of how the platform works, see:

- [System Overview](system_overview.md) — high-level architecture
- [System Architecture](system_architecture.md) — detailed component diagram
- [API Layer Guide](api_layer_guide.md) — how the backend API works
- [Schema Reference](schema_reference.md) — database table documentation
