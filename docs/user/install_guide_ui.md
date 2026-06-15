# Installation Guide: Windows UI Wizard (Recommended)

This guide walks you through setting up the HeroBM Platform on Windows using the interactive **Setup Wizard**. This is the recommended path for first-time users.

## 1. Prerequisites

Ensure you have **Git** installed. Then, open a PowerShell terminal and navigate to the project folder:

```powershell
cd path/to/herobm
```

## 2. Environment Setup

Run the automated prerequisite installer. This will check for and install Podman, Node.js, and Python via `winget`.

```powershell
.\scripts\setup.ps1
```

> [!IMPORTANT]
> **Restart your terminal** after this script finishes to ensure the new tools are correctly registered on your PATH.

## 3. Configure Secrets

Create your `.env` file and generate secure random passwords for all local services:

```powershell
make init-env
```

## 4. Launch Setup Wizard

Run the following command to bootstrap your database and generate a secure, one-time setup token:

```powershell
make setup-wizard
```

This will automatically create your base database tables and output a URL. **Click the URL in your terminal** to open the browser:

1. **Configure Region**: Select your currency and regional settings.
2. **Import Data**: The platform will pull in the legacy ABM data directly through the browser.
3. **Log In**: Use the `admin` account with the password generated in your `.env` file.

## 5. Verify & Run

Once setup is complete, you can verify your installation:

```powershell
make verify-all
```

To run the platform in a production-like local environment:
```powershell
make prod-local
```

The **Ops Portal** will be available at `http://localhost:4300`.
