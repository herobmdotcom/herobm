# Installation Guide

This guide walks you through setting up the HeroBM Platform on a fresh Windows or Linux machine. You will need administrator access and a working internet connection.

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

The setup script assumes these are already on your machine:

- **Windows**: **Git** and **winget** (built into Windows 10 1809+ and Windows 11). If `winget` is missing, install the App Installer from the Microsoft Store.
- **Linux**: **Git** and a standard package manager like `apt-get` or `dnf`.

### Running the setup script

Open your terminal (**PowerShell** on Windows or **Bash** on Linux) and navigate to the project folder:

```shell
cd path/to/modbm
```

Run the setup script for your operating system:

**Windows**:
```powershell
.\scripts\setup.ps1
```

**Linux**:
```bash
bash scripts/setup.sh
```

This checks for and installs:
- **Podman** — container runtime (replaces Docker)
- **Node.js** — JavaScript runtime for the API and portals
- **Python** — required for data pipelines and dbt
- **Typst** — report generation engine
- **podman-compose** — orchestrates the containers (installed via `pip`)
- **Make** — task runner (may need manual install on Windows, the script will tell you)

During installation, the script will interactively prompt you to choose your **Installation Profile**:
1. **Local Native (FE + API)**: Runs the databases in containers, but assumes you will run the UI and API locally via Node.js. (Best for developers).
2. **Full Containerization**: Runs everything, including the UI and API, inside containers. (Best for ops/evaluation).

It will also ask if you want to explicitly enable the **PLG Stack** (Observability) or the **ERPNext Integration** (Financial core). Based on your choices, it generates a custom **Windows Startup shortcut** or **Linux systemd user service** to automatically start your chosen configuration whenever you boot!

### Permissions

On Linux, the script will ask for `sudo` to use `apt-get` or `dnf`.
On Windows, most `winget` installs work without administrator privileges. If any install fails with a permissions error, try running PowerShell **as Administrator** (right-click → "Run as administrator") and re-run the script. The script is safe to re-run — it skips anything already installed.

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

**Close and reopen your terminal window** so that newly installed tools are available on your PATH.

Then install the JavaScript dependencies. This project uses NPM Workspaces, so you only need to run this once at the root directory:

```shell
npm install
```

---

## Step 2: Configure Environment Variables

The platform needs a `.env` file with passwords and connection settings. Run our automated OS-agnostic initializer:

```shell
make init-env
```

This will run the Python setup tool and:
1. Create a `.env` file from the template
2. **Automatically generate** random passwords for all local services (PostgreSQL, Redis, Grafana, API, portal users)

You can manually edit the `.env` file in a text editor later if you wish to override these secrets.

---

## Step 3: Start the Platform

Depending on what you chose during the `setup.ps1` script, your platform configurations might already be starting in the background if you reboot. To start them manually (or if you don't want to reboot):

**Path 1: Full Containerization (Options: none)**
```shell
make up-fe-api
```
*(Starts the DB, Redis, App API, and Ops Portal containers).*

**Path 2: Local Native FE + API (Options: none)**
```shell
make up-db
```
*(Starts only the DB and Redis containers. You must run `make dev-local` to start the frontend and API from source).*

### Optional Modules

If you want to run the optional modules (like PLG or ERPNext) independently, or add them on top of your base layer, you can stack commands!

For example, to run the Local DB layer + PLG observability + ERPNext integration:
```shell
make up-db up-plg up-erpnext
```

To run Full Containerization + ERPNext:
```shell
make up-fe-api up-erpnext
```

Check that everything is running:

```shell
make ps
```

You should see your chosen services listed as `Up` with `(healthy)` next to most of them. Give it about 30 seconds after `make up-...` for health checks to complete.

---

## Step 4: Provision the Database

You must bootstrap the database with system records, a Chart of Accounts, and core settings. You can do this via the **Setup Wizard (UI)** or the **CLI**.

### Option A: Interactive Setup Wizard (Recommended)

HeroBM Platform features an interactive, two-phase user interface to bootstrap your environment securely.

Run the following command to generate your secure, one-time setup token:

```shell
make setup-wizard
```

This will automatically create your base database tables and output a URL to your terminal. Click the URL to open your browser and follow the initialization process:

**Phase 1: Base Initialization**
1. Follow the interactive wizard to configure your region, currency, and data source.
2. Upon confirming the execution, the platform provisions the base settings and securely creates the administrative user accounts. This atomic action instantaneously detonates the one-time setup token for security.
3. You will be redirected to the Login page.

**Phase 2: Data Import**
4. Log in using the `admin` username and the password generated inside your `.env` file.
5. The platform will automatically intercept your first login and direct you to a secure Data Import screen.
6. The ELT (Extract-Load-Transform) pipeline will execute natively within your authenticated administrative session, pulling in the legacy ABM data.

### Option B: Unified CLI Setup (Fast Path)

For developers who prefer the command line or are working in a remote environment without browser access, you can run the unified setup logic via NPM. This script handles database seeding, Chart of Accounts loading, and configuration in a single step:

```shell
cd apps/api
npm run setup
```

> [!NOTE]
> The CLI setup uses defaults from your `.env` file (e.g., `INVENTORY_VALUATION_METHOD`). The base currency is configured during setup and stored in the database — it is not an environment variable.

---

## Step 5: Verify

```shell
make verify-all
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
Close and reopen your terminal after running the setup script. Podman needs to be on your PATH.

### "podman-compose: executable file not found"
Install it with: `pip install podman-compose` or `pip3 install podman-compose --user`, then restart your terminal.

### Containers won't start
Check that the Podman machine is running: `podman machine list`. If it shows "Stopped", start it with `podman machine start`.

### ELT fails with connection error
Verify the ABM connection settings in your `.env` file. The ABM server must be reachable from your machine.

### "make: command not found"
Make isn't bundled with Windows. Install via `choco install make` (if you have Chocolatey) or `scoop install make` (if you have Scoop).

### Need to start over completely
```shell
make nuke    # removes all containers, volumes, and local images
make up      # recreate containers with empty database
```

---

## Architecture Overview

For a deeper understanding of how the platform works, see:

- [System Overview](system_overview.md) — high-level architecture
- [System Architecture](system_architecture.md) — detailed component diagram
- [API Layer Guide](api_layer_guide.md) — how the backend API works
- [Schema Reference](schema_reference.md) — database table documentation
