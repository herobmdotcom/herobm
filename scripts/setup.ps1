# ==============================================================================
# HeroBM Platform — Prerequisite Installer
# ==============================================================================
# Checks for and installs required development tools via winget.
# Run once per machine. Requires admin privileges for some installs.
#
# Usage: .\scripts\setup.ps1
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$SkipRun,
    [switch]$EnableAutostart,
    [switch]$DisableAutostart
)

$ErrorActionPreference = "Stop"

# --- Prerequisite definitions ---
# Each entry: [winget ID, command name, display name]
$prereqs = @(
    @{ Id = "RedHat.Podman"; Cmd = "podman"; Name = "Podman" },
    @{ Id = "OpenJS.NodeJS.LTS"; Cmd = "node"; Name = "Node.js LTS" },
    @{ Id = "Python.Python.3.12"; Cmd = "python"; Name = "Python 3.12" },
    @{ Id = "Typst.Typst"; Cmd = "typst"; Name = "Typst" }
)

$installed = @()
$skipped = @()
$failed = @()

Write-Host "`n=== HEROBM SETUP ===" -ForegroundColor Cyan
Write-Host "Checking prerequisites...`n"

# --- Check winget ---
$wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
if (-not $wingetCmd) {
    Write-Host "ERROR: winget is not available. Install App Installer from the Microsoft Store." -ForegroundColor Red
    exit 1
}

# --- Check and install each prerequisite ---
foreach ($prereq in $prereqs) {
    $cmd = Get-Command $prereq.Cmd -ErrorAction SilentlyContinue
    $needsInstall = $false
    
    if ($cmd) {
        if ($prereq.Cmd -eq "node") {
            $nodeVerStr = & node -v
            $nodeVer = [int]($nodeVerStr -replace "^v","" -replace "\..*","")
            if ($nodeVer -lt 20) {
                Write-Host "  [OUTDATED] $($prereq.Name) (Current: $nodeVerStr) -- requires >= v20" -ForegroundColor Yellow
                $needsInstall = $true
            } else {
                Write-Host "  [OK] $($prereq.Name) -- $nodeVerStr" -ForegroundColor Green
                $skipped += $prereq.Name
            }
        } else {
            Write-Host "  [OK] $($prereq.Name) -- $($cmd.Source)" -ForegroundColor Green
            $skipped += $prereq.Name
        }
    }
    else {
        Write-Host "  [MISSING] $($prereq.Name) -- installing via winget..." -ForegroundColor Yellow
        $needsInstall = $true
    }
    
    if ($needsInstall) {
        try {
            winget install --id $prereq.Id --accept-source-agreements --accept-package-agreements --silent
            if ($LASTEXITCODE -eq 0) {
                $installed += $prereq.Name
                Write-Host "  [INSTALLED/UPDATED] $($prereq.Name)" -ForegroundColor Green
            }
            else {
                $failed += $prereq.Name
                Write-Host "  [FAILED] $($prereq.Name) -- winget exit code $LASTEXITCODE" -ForegroundColor Red
            }
        }
        catch {
            $failed += $prereq.Name
            Write-Host "  [FAILED] $($prereq.Name) -- $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# --- Check Make ---
$makeCmd = Get-Command make -ErrorAction SilentlyContinue
if ($makeCmd) {
    Write-Host "  [OK] Make -- $($makeCmd.Source)" -ForegroundColor Green
    $skipped += "Make"
}
else {
    Write-Host "  [MISSING] Make -- installing via winget..." -ForegroundColor Yellow
    try {
        winget install --id ezwinports.make --accept-source-agreements --accept-package-agreements --silent
        if ($LASTEXITCODE -eq 0) {
            $installed += "Make"
            Write-Host "  [INSTALLED] Make" -ForegroundColor Green
        }
        else {
            $failed += "Make"
            Write-Host "  [FAILED] Make -- winget exit code $LASTEXITCODE" -ForegroundColor Red
        }
    }
    catch {
        $failed += "Make"
        Write-Host "  [FAILED] Make -- $($_.Exception.Message)" -ForegroundColor Red
    }
}

# --- Install podman-compose via pip ---
Write-Host "`n--- Python packages ---" -ForegroundColor Cyan
$pcCmd = Get-Command podman-compose -ErrorAction SilentlyContinue
if ($pcCmd) {
    Write-Host "  [OK] podman-compose -- $($pcCmd.Source)" -ForegroundColor Green
}
else {
    Write-Host "  [MISSING] podman-compose -- installing via pip..." -ForegroundColor Yellow
    pip install podman-compose 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [INSTALLED] podman-compose" -ForegroundColor Green
        $installed += "podman-compose"
    }
    else {
        Write-Host "  [FAILED] podman-compose -- run 'pip install podman-compose' manually" -ForegroundColor Red
        $failed += "podman-compose"
    }
}

# --- Initialise Podman machine if needed ---
Write-Host "`n--- Podman Machine ---" -ForegroundColor Cyan
$podmanCmd = Get-Command podman -ErrorAction SilentlyContinue
if ($podmanCmd) {
    # Windows/WSL2: prevent WSL from killing the Podman VM on idle.
    # By default, WSL2 terminates distro instances after ~8s of inactivity,
    # which kills sshd and the Podman socket. Setting instanceIdleTimeout=-1
    # and vmIdleTimeout=-1 keeps both the distro and the VM alive.
    $wslConfigPath = Join-Path $env:USERPROFILE ".wslconfig"
    $wslConfigNeeded = $true
    if (Test-Path $wslConfigPath) {
        $existing = Get-Content $wslConfigPath -Raw
        if ($existing -match "instanceIdleTimeout" -and $existing -match "vmIdleTimeout") {
            $wslConfigNeeded = $false
        }
    }
    if ($wslConfigNeeded) {
        Write-Host "  Configuring WSL2 idle timeouts (.wslconfig)..." -ForegroundColor Yellow
        @"
[general]
instanceIdleTimeout=-1

[wsl2]
vmIdleTimeout=-1
memory=8GB
"@ | Set-Content -Path $wslConfigPath -Encoding UTF8
        Write-Host "  [OK] Created $wslConfigPath (WSL restart required)" -ForegroundColor Green
    }
    else {
        Write-Host "  [OK] .wslconfig already configured" -ForegroundColor Green
    }

    $machineList = podman machine list --format "{{.Name}}" 2>$null
    if (-not $machineList) {
        Write-Host "  No Podman machine found. Initialising..." -ForegroundColor Yellow
        podman machine init
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Podman machine initialised" -ForegroundColor Green
        }
        else {
            Write-Host "  [FAILED] Podman machine init failed" -ForegroundColor Red
        }
    }
    else {
        Write-Host "  [OK] Podman machine exists: $machineList" -ForegroundColor Green
    }

    # Windows/WSL2: switch to rootful mode.
    # In rootless mode, the SSH tunnel between win-sshproxy and the WSL VM
    # drops whenever systemd-logind tears down the user session, killing the
    # socket at /run/user/1000/podman/podman.sock. Rootful mode uses the
    # system socket (/run/podman/podman.sock) which is not subject to session
    # teardown. This is safe because the WSL2 VM itself provides isolation.
    Write-Host "  Setting rootful mode (required for stable Windows/WSL2 operation)..." -ForegroundColor Yellow
    podman machine set --rootful 2>&1 | Out-Null

    Write-Host "  Ensuring Podman machine is running..." -ForegroundColor Yellow
    try {
        podman machine start 2>&1 | Out-Null
    }
    catch {
        # Ignore "already running" errors
    }

    # Configure global k8s-file log driver inside the VM (rootful: root home)
    Write-Host "  Configuring Podman log driver (k8s-file)..." -ForegroundColor Yellow
    try {
        podman machine ssh "sudo mkdir -p /root/.config/containers && echo '[containers]' | sudo tee /root/.config/containers/containers.conf > /dev/null && echo 'log_driver = ""k8s-file""' | sudo tee -a /root/.config/containers/containers.conf > /dev/null" 2>&1 | Out-Null
    }
    catch {
        # Ignore errors if already configured or SSH fails sporadically
    }
    
    # Pre-create the named volume for Promtail log scraping (rootful storage path)
    Write-Host "  Creating podman_logs shared volume..." -ForegroundColor Yellow
    try {
        podman volume create --opt type=none --opt o=bind --opt device=/var/lib/containers/storage/overlay-containers podman_logs 2>&1 | Out-Null
    }
    catch {
        # Ignore errors if volume already exists
    }
    # Pre-create logs directory
    $projectDir = (Get-Item $PSScriptRoot).Parent.FullName
    $logsDir = Join-Path $projectDir "logs"
    if (-not (Test-Path $logsDir)) {
        New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    }
}

# --- Setup Auto-Start ---
Write-Host "`n--- Installation Profile Selection ---" -ForegroundColor Cyan
Write-Host "Please select how you want to run the application code:"
Write-Host "  1) Local Development (Recommended for active code development)"
Write-Host "     - Runs databases & brokers in containers (PostgreSQL, Redis)"
Write-Host "     - Runs Next.js UI (port 4301/8000) and NestJS API (port 3001/3002) locally with hot reload"
Write-Host "  2) Full Containerization (Recommended for standard evaluation & ops)"
Write-Host "     - Runs all services in containers (API, UI, Database, Redis, Outbox, Pipeline)"
Write-Host "     - Direct access to the Next.js UI at http://localhost:8000"
Write-Host "  3) Full Containerization + Nginx Reverse Proxy (Recommended for staging/edge setups)"
Write-Host "     - Runs all services in containers like Option 2"
Write-Host "     - Adds an Nginx reverse proxy container in front of the UI on http://localhost:8080 (or port 80)"
$pathChoice = Read-Host "Enter option [1, 2, or 3] (Default: 1)"
if (-not $pathChoice) { $pathChoice = "1" }

$makeTargets = @()
if ($pathChoice -eq "1") {
    $makeTargets += "up-db"
    Write-Host "  -> Selected Local Dev path (DBs containerized, FE/API local)" -ForegroundColor Gray
}
elseif ($pathChoice -eq "3") {
    $makeTargets += "up-portal-api-nginx"
    Write-Host "  -> Selected Full Containerization with Nginx Proxy path" -ForegroundColor Gray
    $enableHttps = Read-Host "  Enable HTTPS / SSL on ports 80 & 443? [y/N] (Default: N)"
    if ($enableHttps -eq "y" -or $enableHttps -eq "Y") {
        $domain = Read-Host "  Enter Domain or Public IP (e.g. herobm.example.com or 123.45.67.89)"
        if ($domain -match "^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$") {
            $domain = "$domain.sslip.io"
            Write-Host "  -> Auto-configured Magic Domain: $domain" -ForegroundColor Green
        }
        $sslTemplate = Join-Path $PSScriptRoot "..\configs\nginx\conf.d\ssl.conf.template"
        $sslConf = Join-Path $PSScriptRoot "..\configs\nginx\conf.d\ssl.conf"
        if (Test-Path $sslTemplate) {
            Copy-Item $sslTemplate $sslConf -Force
            Write-Host "  [OK] Activated Nginx HTTPS configuration (ssl.conf)" -ForegroundColor Green
        }
    }
}
else {
    $makeTargets += "up-portal-api"
    Write-Host "  -> Selected Full Containerization path" -ForegroundColor Gray
}
$makeTargets -join " " | Out-File -FilePath ".startup_choice" -Encoding ascii

$makeCmdString = "make " + ($makeTargets -join " ")

Write-Host "`n--- Startup Automation ---" -ForegroundColor Cyan
$shouldAutostart = $true
if ($EnableAutostart) {
    $shouldAutostart = $true
} elseif ($DisableAutostart) {
    $shouldAutostart = $false
} else {
    $autostartChoice = Read-Host "Enable automatic startup on system reboot/login? [Y/n] (Default: Y)"
    if ($autostartChoice -ne "" -and $autostartChoice -notmatch "^[Yy]") {
        $shouldAutostart = $false
    }
}

$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder "HeroBM Podman Autostart.lnk"

if ($shouldAutostart) {
    try {
        $wshShell = New-Object -ComObject WScript.Shell
        $shortcut = $wshShell.CreateShortcut($shortcutPath)
        
        # Target powershell to run hidden, start the machine, poll readiness, and run the constructed make command
        $shortcut.TargetPath = "powershell.exe"
        $projectDir = (Get-Item $PSScriptRoot).Parent.FullName
        $logFile = Join-Path $projectDir "logs\autostart.log"
        $psCommand = "Set-Location '$projectDir'; `$logFile = '$logFile'; '--- Autostart: ' + (Get-Date) | Out-File `$logFile -Encoding utf8; podman machine start 2>&1 | Tee-Object -FilePath `$logFile -Append; `$retries = 30; while (`$retries -gt 0 -and !(podman info 2>`$null)) { Start-Sleep -Seconds 1; `$retries-- }; $makeCmdString 2>&1 | Tee-Object -FilePath `$logFile -Append; '--- Done: ' + (Get-Date) | Out-File `$logFile -Append -Encoding utf8"
        $shortcut.Arguments = "-WindowStyle Hidden -Command `"$psCommand`""
        $shortcut.WorkingDirectory = $projectDir
        $shortcut.Description = "Starts Podman machine and HeroBM containers ($makeCmdString) on boot"
        $shortcut.Save()
        Write-Host "  [OK] Created Windows Startup shortcut: $makeCmdString" -ForegroundColor Green
    }
    catch {
        Write-Host "  [WARNING] Could not create startup shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    if (Test-Path $shortcutPath) {
        Remove-Item -Path $shortcutPath -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Removed existing Windows Startup shortcut" -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Autostart disabled (no startup shortcut created)" -ForegroundColor Gray
    }
}

# --- Summary ---
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($installed.Count -gt 0) {
    Write-Host "  Installed: $($installed -join ', ')" -ForegroundColor Green
}
if ($skipped.Count -gt 0) {
    Write-Host "  Already present: $($skipped -join ', ')" -ForegroundColor Gray
}
if ($failed.Count -gt 0) {
    Write-Host "  Failed/Manual: $($failed -join ', ')" -ForegroundColor Red
    Write-Host "`n  Please install failed items manually, then re-run this script." -ForegroundColor Yellow
}
else {
    Write-Host "`n  All prerequisites installed!" -ForegroundColor Green
    if (-not $SkipRun) {
        Write-Host "  To complete setup and boot your environment, run:" -ForegroundColor Green
        Write-Host "  > make fast-install" -ForegroundColor Cyan
    }
}
