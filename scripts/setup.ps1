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
    [switch]$SkipRun
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
    $machineList = podman machine list --format "{{.Name}}" 2>$null
    if (-not $machineList) {
        Write-Host "  No Podman machine found. Initialising..." -ForegroundColor Yellow
        podman machine init --now
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Podman machine initialised and started" -ForegroundColor Green
        }
        else {
            Write-Host "  [FAILED] Podman machine init failed" -ForegroundColor Red
        }
    }
    else {
        Write-Host "  [OK] Podman machine exists: $machineList" -ForegroundColor Green
        Write-Host "  Ensuring Podman machine is running..." -ForegroundColor Yellow
        try {
            podman machine start 2>&1 | Out-Null
        }
        catch {
            # Ignore "already running" errors
        }
    }

    # Configure global k8s-file log driver inside the VM
    Write-Host "  Configuring Podman log driver (k8s-file)..." -ForegroundColor Yellow
    try {
        podman machine ssh 'mkdir -p ~/.config/containers && printf "[containers]\nlog_driver = \"k8s-file\"\n" > ~/.config/containers/containers.conf' 2>&1 | Out-Null
    }
    catch {
        # Ignore errors if already configured or SSH fails sporadically
    }
    
    # Pre-create the named volume for Promtail log scraping
    Write-Host "  Creating podman_logs shared volume..." -ForegroundColor Yellow
    try {
        podman volume create --opt type=none --opt o=bind --opt device=/home/user/.local/share/containers/storage/overlay-containers podman_logs 2>&1 | Out-Null
    }
    catch {
        # Ignore if volume already exists
    }
}

# --- Setup Auto-Start ---
Write-Host "`n--- Installation Profile Selection ---" -ForegroundColor Cyan
Write-Host "Please select how you want to run the application code:"
Write-Host "  1) Local native Node.js (Recommended for fullstack developers)"
Write-Host "  2) Full Containerization (Recommended for pure evaluation/ops)"
$pathChoice = Read-Host "Enter option [1 or 2]"

$makeTargets = @()
if ($pathChoice -eq "1") {
    $makeTargets += "up-db"
    Write-Host "  -> Selected Local Dev path (DBs containerized, FE/API local)" -ForegroundColor Gray
}
else {
    $makeTargets += "up-fe-api"
    Write-Host "  -> Selected Full Containerization path" -ForegroundColor Gray
}

$makeCmdString = "make " + ($makeTargets -join " ")

Write-Host "`n--- Startup Automation ---" -ForegroundColor Cyan
try {
    $startupFolder = [Environment]::GetFolderPath('Startup')
    $shortcutPath = Join-Path $startupFolder "HeroBM Podman Autostart.lnk"
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    
    # Target powershell to run hidden, start the machine, and run the constructed make command
    $shortcut.TargetPath = "powershell.exe"
    $projectDir = (Get-Item $PSScriptRoot).Parent.FullName
    $logFile = Join-Path $projectDir "logs\autostart.log"
    $shortcut.Arguments = "-WindowStyle Hidden -Command `"Set-Location '$projectDir'; `$logFile = '$logFile'; '--- Autostart: ' + (Get-Date) | Out-File `$logFile; podman machine start 2>&1 | Tee-Object -FilePath `$logFile -Append; $makeCmdString 2>&1 | Tee-Object -FilePath `$logFile -Append; '--- Done: ' + (Get-Date) | Out-File `$logFile -Append`""
    $shortcut.WorkingDirectory = $projectDir
    $shortcut.Description = "Starts Podman machine and HeroBM containers ($makeCmdString) on boot"
    $shortcut.Save()
    Write-Host "  [OK] Created Windows Startup shortcut: $makeCmdString" -ForegroundColor Green
}
catch {
    Write-Host "  [WARNING] Could not create startup shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
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
        Write-Host "  Starting your chosen environment..." -ForegroundColor Green
        $initCmd = "make init-env " + ($makeTargets -join " ")
        Write-Host "  Running: $initCmd" -ForegroundColor Cyan
        Invoke-Expression $initCmd
    }
}
