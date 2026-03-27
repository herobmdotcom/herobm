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

During installation, the script will interactive prompt you to choose your **Installation Profile**:
1. **Local Native (FE + API)**: Runs the databases in containers, but assumes you will run the UI and API locally via Node.js. (Best for developers).
2. **Full Containerization**: Runs everything, including the UI and API, inside containers. (Best for ops/evaluation).

It will also ask if you want to explicitly enable the **PLG Stack** (Observability) or the **ERPNext Integration** (Financial core). Based on your choices, it generates a custom Windows Startup shortcut to automatically start your chosen configuration whenever you log into Windows!

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

Then install the JavaScript dependencies. This project uses NPM Workspaces, so you only need to run this once at the root directory:

```powershell
npm install
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

Depending on what you chose during the `setup.ps1` script, your platform configurations might already be starting in the background if you reboot. To start them manually (or if you don't want to reboot):

**Path 1: Full Containerization (Options: none)**
```powershell
make up-fe-api
```
*(Starts the DB, Redis, App API, and Ops Portal containers).*

**Path 2: Local Native FE + API (Options: none)**
```powershell
make up-db
```
*(Starts only the DB and Redis containers. You must run `make dev-local` to start the frontend and API from source).*

### Optional Modules

If you want to run the optional modules (like PLG or ERPNext) independently, or add them on top of your base layer, you can stack commands!

For example, to run the Local DB layer + PLG observability + ERPNext integration:
```powershell
make up-db up-plg up-erpnext
```

To run Full Containerization + ERPNext:
```powershell
make up-fe-api up-erpnext
```

Check that everything is running:

```powershell
make ps
```

You should see your chosen services listed as `Up` with `(healthy)` next to most of them. Give it about 30 seconds after `make up-...` for health checks to complete.

---

## Step 4: Initialise the Database

```powershell
make init
```

> [!TIP]
> **Resuming a Failed Setup**
> If your setup fails *after* the initial 15-minute ABM extraction completes (e.g., during DB transformation or seeding), do not run `make init` again as it will re-download the ABM snapshot from scratch. 
> Instead, safely resume by running:
> ```powershell
> make init-no-extract
> ```

This runs four steps automatically:

1. **Build** — compiles the API application
2. **Migrate** — creates all database tables (using a unified Drizzle schema)
3. **ELT** — imports data from the ABM system (requires ABM connection in `.env`). This step concludes by printing a **Pipeline Summary Report** to verify data alignment between systems.
4. **Seed** — creates portal user accounts and populates inventory

This takes 2–3 minutes. If the ELT step fails (e.g. ABM not reachable), the tables and users are still created — you can re-run `make elt` and `make seed` later when the connection is available.

---

## Step 5: Verify

```powershell
make test-all
```

You should see tests passing across the API endpoints, structural architecture policies, and data synchronization checks. If any tests fail, check `make ps` to ensure all containers are healthy.

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

> [!NOTE]
> **Auto-Start:** The setup script automatically configures Windows to boot the Podman machine and bring up all ModBM containers (`make up`) in the background whenever you log in. You shouldn't normally need to run `make up` manually unless you've explicitly stopped them.

| Action | Command |
|---|---|
| Start chosen configuration | Your designated `make up-...` commands! |
| Stop all containers | `make down-all` |
| View logs | `make logs` |
| Check container status | `make ps` |
| Refresh data from ABM | `make elt` |
| View ELT pipeline report | `python tools/elt_report.py` |
| Run API in dev mode | `make dev-api` |
| Rebuild portal after changes | `make rebuild-portal` |
| Rebuild API after changes | `make rebuild-api` |

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
