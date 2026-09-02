---
id: install-guide
title: "Installation & Setup Guide"
description: "Universal fast-install setup guide, startup run profiles, autostart resilience, and network configuration for Windows, Linux, and macOS."
category: "Overview"
order: 1
routes:
  - "/admin/version"
tags: ["installation", "setup", "fast-install", "deployment", "prerequisites", "startup-options", "autostart", "systemd", "firewall", "networking", "ports", "system-requirements", "hardware"]
fields:
  requirements:
    title: "Machine & System Requirements"
    summary: "Hardware specifications, supported operating systems, and container/software prerequisites."
  fast_install:
    title: "Fast Install"
    summary: "One-step automated setup target: `make fast-install`."
  startup_options:
    title: "Startup Options"
    summary: "Three application execution profiles: Local Development, Full Containerization, and Full Containerization with Nginx Reverse Proxy."
  firewall_config:
    title: "Firewall & Network Configuration"
    summary: "Host network binding (`BIND_IP`) and port rules for LAN/external access."
  autostart_config:
    title: "Autostart & Reboot Resilience"
    summary: "Automatic startup management, systemd user service with linger, Windows startup shortcuts, and macOS LaunchAgents."
  env_config:
    title: "Environment Configuration"
    summary: "Local credentials and secrets configured in `.env`."
related:
  - "overview"
  - "technical-operations"
  - "admin-settings"
---

# Installation & Setup Guide

HeroBM uses a universal automated **Fast Install** sequence to configure prerequisites, containers, database migrations, and initial seed data across Windows, Linux, and macOS.

---

## 1. Machine & System Requirements

Before running the installer, ensure your host machine or virtual server meets the following specifications:

### Hardware Specifications

| Component | Minimum (Evaluation / Development) | Recommended (Production / 10+ Concurrent Users) |
| :--- | :--- | :--- |
| **CPU** | 2 vCPUs / Cores (x86_64 or ARM64) | 4+ vCPUs / Cores (x86_64 or ARM64) |
| **Memory (RAM)** | 4 GB RAM | 8 GB – 16 GB RAM |
| **Disk Storage** | 10 GB available SSD space | 50+ GB high-speed SSD / NVMe |
| **Architecture** | 64-bit (`x86_64` / `amd64` or `aarch64` / `arm64`) | 64-bit (`x86_64` or `arm64`) |

### Supported Operating Systems

- **Linux**: Ubuntu 22.04 LTS+, Debian 12+, RHEL 9+, Rocky Linux, Arch Linux.
- **macOS**: macOS 13+ (Ventura, Sonoma, Sequoia) on Apple Silicon (M1/M2/M3/M4) or Intel.
- **Windows**: Windows 10/11 (via WSL2 or Native PowerShell 7+).
- **Cloud / VPS**: Works seamlessly on [exe.dev](https://exe.dev), AWS, GCP, DigitalOcean, Hetzner, or bare-metal servers.

### Container & Software Prerequisites

The automated installer (`make fast-install`) will automatically detect, install, and configure missing prerequisites. If configuring in an offline or air-gapped environment:
- **Container Engine**: [Podman](https://podman.io) 4.5+ (recommended, rootless) or [Docker](https://docker.com) 24+ / Docker Compose v2.
- **Node.js**: `v20.12.0` or higher (Active LTS).
- **Python**: Python `3.10`+ (for data ingestion pipelines).
- **Typst**: `v0.11.0`+ (for high-speed PDF rendering).
- **Make**: GNU Make 4.0+ (standard on Linux/macOS, installed via `scripts\setup.ps1` on Windows).

---

## 2. Quick Start (Fast Install — Recommended)

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

> [!TIP]
> **Optional Demo Data**: To populate the database with sample products, customers, suppliers, inventory, and transactions for evaluation, run `make seed-demo`.

> [!NOTE]
> We recommend installing HeroBM on a self-service VM provider like [exe.dev](https://exe.dev). We work on exe.dev daily, and `make fast-install` will get you up and running without issues. In particular, the firewall is already configured to allow traffic to the HeroBM UI for users who you share the VM with.

---

## 3. Step-by-Step Manual Sequence

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
| **8** | `make bootstrap` | Seeds master data and outputs your secure `admin` credentials. *(Optional: run `make seed-demo` for sample demo data).* |
| **9** | `make up` | Launches the Ops Portal and API backend. |

---

## 4. Startup Profiles & Run Options

HeroBM provides **three distinct startup profiles** tailored for different stages of the development lifecycle, evaluation, and production deployment:

### Option 1: Local Development (`make up-db` + `make dev-local` / `make prod-local`)
- **Primary Use Case**: Active software development, debugging, and rapid UI/API code iteration.
- **How It Works**:
  - Stateful services (PostgreSQL on port `5432` and Redis on port `6379`) run in lightweight background containers.
  - The Next.js Ops Portal (UI) and NestJS API backend run natively on the host machine using Node.js.
  - Enables full **Hot Module Replacement (HMR)** and fast TypeScript compilation watchers for instant code reload upon saving files.
- **Commands**:
  ```bash
  # 1. Start background database & cache containers:
  make up-db

  # 2. Run API and UI locally with hot reload:
  make dev-local
  # (Alternatively, run standalone build locally with 'make prod-local')
  ```
- **Access URLs**:
  - Ops Portal UI: `http://localhost:4301` (or `http://localhost:8000`)
  - API Backend & Swagger Docs: `http://localhost:3002/api` / `http://localhost:3002/api/docs`

### Option 2: Full Containerization (`make up` / `make up-portal-api`)
- **Primary Use Case**: Standard system evaluation, isolated integration testing, on-premise single-host deployments, and standard operational mode.
- **How It Works**:
  - **All application services** run in isolated Podman/Docker containers: Next.js Ops Portal (`herobm-ui`), NestJS API (`herobm-api`), PostgreSQL (`postgres-custom`), Redis (`redis-broker`), Outbox Worker (`herobm-outbox`), and Pipeline Runner (`herobm-pipeline`).
  - No host Node.js / Python runtime needed after containers are built.
- **Commands**:
  ```bash
  # Launch all containerized services in background:
  make up
  # (Equivalent to 'make up-portal-api')
  ```
- **Access URLs**:
  - Ops Portal UI: `http://localhost:8000`
  - API Backend: `http://localhost:3001/api`

### Option 3: Full Containerization + Nginx Reverse Proxy (`make up-portal-api-nginx`)
- **Primary Use Case**: Production staging, edge/gateway deployments, multi-client LAN access, custom domain routing, and SSL/TLS HTTPS termination.
- **How It Works**:
  - Runs all containerized services from Option 2 and places an **Nginx reverse proxy container** (`herobm-nginx`) in front of the application.
  - Exposes standard web ports (`8080` or `80` for HTTP, `8443` or `443` for HTTPS).
  - Handles SSL/TLS certificate termination (via Let's Encrypt / Certbot or custom certificates) and routes incoming HTTP traffic cleanly to the portal and API.
- **Commands**:
  ```bash
  # Launch all containers including Nginx reverse proxy:
  make up-portal-api-nginx
  ```
- **Access URLs**:
  - Ops Portal UI (HTTP): `http://localhost:8080` (or `http://localhost`)
  - Ops Portal UI (HTTPS): `https://<domain-or-ip>` (if SSL configured)

### Profile Comparison Matrix

| Feature / Aspect | Option 1: Local Dev | Option 2: Full Containerization | Option 3: Containerization + Nginx |
| :--- | :--- | :--- | :--- |
| **Make Target** | `make up-db` + `make dev-local` | `make up` (`make up-portal-api`) | `make up-portal-api-nginx` |
| **Execution Environment** | Host Node.js + Container DBs | 100% Containers | 100% Containers + Nginx Proxy |
| **Hot Reload (HMR)** | Yes (Instant) | No (Requires container rebuild) | No (Requires container rebuild) |
| **Default Web UI Port** | `4301` / `8000` | `8000` | `8080` / `80` (or `443` HTTPS) |
| **API Port** | `3002` (or `3001`) | `3001` | Proxied via Nginx / `3001` |
| **SSL / HTTPS Support** | No (Local HTTP) | No (Local HTTP) | Yes (Automated / Custom TLS) |
| **Recommended For** | Developers writing code | On-prem evaluation & simple host | Production, staging & LAN multi-user |

---

## 5. Network Access & Firewall Configuration

When hosting HeroBM on a server or workstation that needs to be accessed by other devices across your local area network (LAN) or intranet:

### 1. Configure Host Binding (`BIND_IP`)
By default, container port bindings in `.env` use `127.0.0.1` (loopback only) to prevent unintended network exposure.
To allow external connections from other computers on your network:
1. Open `.env` in your project root.
2. Set `BIND_IP` to `0.0.0.0` (bind to all host network interfaces) or to your server's static LAN IP (e.g. `192.168.1.100`):
   ```env
   BIND_IP=0.0.0.0
   ```
3. Restart your services (`make down && make up` or your chosen profile).

### 2. Required Port Rules

| Port | Protocol | Purpose | When to Open |
| :---: | :---: | :--- | :--- |
| **8000** | TCP | Ops Portal Web UI | Option 2 (Full Containerization) |
| **8080** | TCP | Nginx Web Proxy (HTTP) | Option 3 (Containerization + Nginx) |
| **80** / **443** | TCP | Standard HTTP / HTTPS Web Ports | Option 3 with custom domain / SSL |
| **4301** | TCP | Local Dev Web UI | Option 1 (if testing from external LAN device) |

> [!CAUTION]
> **Keep Internal Ports Protected**: Do **NOT** expose database ports (`5432` for PostgreSQL, `6379` for Redis) to untrusted networks. They should remain accessible only to localhost or within the container bridge network.

### 3. Firewall Configuration Commands

#### Windows Defender Firewall (PowerShell as Administrator)
```powershell
# For Full Containerization (Option 2 - Port 8000):
New-NetFirewallRule -DisplayName "HeroBM Ops Portal (Port 8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow

# For Nginx Reverse Proxy (Option 3 - Ports 8080, 80, 443):
New-NetFirewallRule -DisplayName "HeroBM Nginx Proxy (HTTP/HTTPS)" -Direction Inbound -LocalPort 8080,80,443 -Protocol TCP -Action Allow
```

#### Linux — UFW (Ubuntu / Debian)
```bash
# Allow Ops Portal (Option 2):
sudo ufw allow 8000/tcp comment "HeroBM Ops Portal"

# Allow Nginx Reverse Proxy (Option 3):
sudo ufw allow 8080/tcp comment "HeroBM Nginx HTTP"
sudo ufw allow 80/tcp comment "HTTP"
sudo ufw allow 443/tcp comment "HTTPS"

# Reload firewall:
sudo ufw reload
```

#### Linux — Firewalld (RHEL / Rocky / Fedora / AlmaLinux)
```bash
# Allow Ops Portal (Option 2):
sudo firewall-cmd --permanent --add-port=8000/tcp

# Allow Nginx Reverse Proxy (Option 3):
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Reload firewall:
sudo firewall-cmd --reload
```

---

## 6. Daily Operations & Verification

- **Start Services**: `make up` (or `make prod-local` for standalone testing)
- **Stop Services**: `make down`
- **Update Code & Rebuild**: Pull the latest changes and cleanly rebuild application containers:
  ```bash
  git pull
  make rebuild-apps
  ```
  *(Takes the application containers down, runs pending database migrations via `make migrate`, and rebuilds with the latest code).*
- **View Container Logs**: `make logs`
- **Run Fast Test Verification**: `make verify-fast`
- **Access Ops Portal**: `http://localhost:8000` (Option 2) or `http://localhost:8080` (Option 3) or `http://localhost:4301` (Option 1)

---

## 7. Autostart & Server Reboot Resilience

HeroBM provides built-in system-level startup automation to ensure that if the host machine or virtual server reboots, the Podman machine and application container stack automatically initialize and recover without requiring manual intervention.

### Configuration During Installation
During `make fast-install` or `make install-prereqs`, the installer prompts:
```text
Enable automatic startup on system reboot/login? [Y/n] (Default: Y)
```
- Choosing **Yes** (or pressing Enter) configures native OS startup services.
- Choosing **No** disables autostart and cleans up any existing startup service definitions.

### Platform-Specific Startup Architecture

#### Linux (Systemd User Service + Lingering)
- **Service Unit**: Created at `~/.config/systemd/user/herobm.service`.
- **Target**: Bound to `network-online.target` and executes `make <chosen-profile>`.
- **Headless & Cloud Server Reboot (Lingering)**:
  On headless cloud VPS instances (e.g. Ubuntu, Debian, RHEL, exe.dev) where the server reboots without an interactive GUI login, user services require lingering to run at boot. The installer automatically activates lingering:
  ```bash
  loginctl enable-linger $USER
  ```
- **Service Management Commands**:
  ```bash
  # Check status of the autostart service:
  systemctl --user status herobm.service

  # View startup logs:
  journalctl --user -u herobm.service -b

  # Disable autostart:
  systemctl --user disable herobm.service

  # Re-enable autostart:
  systemctl --user enable herobm.service
  ```

#### Windows (Startup Automation with Engine Readiness Polling)
- **Startup Shortcut**: Created in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\HeroBM Podman Autostart.lnk`.
- **Startup Sequence**:
  1. Boots the Podman virtual machine (`podman machine start`).
  2. Polls `podman info` until the WSL2 Podman engine socket is responsive (up to 30 retries).
  3. Launches the selected application stack (`make up`, `make up-portal-api-nginx`, or `make up-db`).
  4. Writes startup timestamps and logs to `logs\autostart.log`.
- **Headless Windows Server Consideration**: The Startup shortcut triggers on user logon. For dedicated Windows servers running unattended, configure auto-logon or create a Windows Scheduled Task triggered "At system startup".

#### macOS (LaunchAgent)
- **LaunchAgent Plist**: Generated at `~/Library/LaunchAgents/com.herobm.autostart.plist`.
- **Behavior**: Automatically starts the Podman machine, polls for engine readiness, and executes the configured Make target on login.
- **Log Destination**: `logs/autostart.log`.

