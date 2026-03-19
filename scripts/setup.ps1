# ==============================================================================
# Antigravity Platform — Prerequisite Installer
# ==============================================================================
# Checks for and installs required development tools via winget.
# Run once per machine. Requires admin privileges for some installs.
#
# Usage: .\scripts\setup.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

# --- Prerequisite definitions ---
# Each entry: [winget ID, command name, display name]
$prereqs = @(
    @{ Id = "RedHat.Podman";          Cmd = "podman";  Name = "Podman" },
    @{ Id = "OpenJS.NodeJS.LTS";      Cmd = "node";    Name = "Node.js LTS" },
    @{ Id = "Python.Python.3.12";     Cmd = "python";  Name = "Python 3.12" },
    @{ Id = "Typst.Typst";            Cmd = "typst";   Name = "Typst" }
)

$installed = @()
$skipped = @()
$failed = @()

Write-Host "`n=== Antigravity Platform Setup ===" -ForegroundColor Cyan
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
    if ($cmd) {
        Write-Host "  [OK] $($prereq.Name) -- $($cmd.Source)" -ForegroundColor Green
        $skipped += $prereq.Name
    } else {
        Write-Host "  [MISSING] $($prereq.Name) -- installing via winget..." -ForegroundColor Yellow
        try {
            winget install --id $prereq.Id --accept-source-agreements --accept-package-agreements --silent
            if ($LASTEXITCODE -eq 0) {
                $installed += $prereq.Name
                Write-Host "  [INSTALLED] $($prereq.Name)" -ForegroundColor Green
            } else {
                $failed += $prereq.Name
                Write-Host "  [FAILED] $($prereq.Name) -- winget exit code $LASTEXITCODE" -ForegroundColor Red
            }
        } catch {
            $failed += $prereq.Name
            Write-Host "  [FAILED] $($prereq.Name) -- $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# --- Check Make (special case: not reliably on winget) ---
$makeCmd = Get-Command make -ErrorAction SilentlyContinue
if ($makeCmd) {
    Write-Host "  [OK] Make -- $($makeCmd.Source)" -ForegroundColor Green
    $skipped += "Make"
} else {
    Write-Host "  [MISSING] Make -- install manually:" -ForegroundColor Yellow
    Write-Host "           choco install make" -ForegroundColor Yellow
    Write-Host "        or scoop install make" -ForegroundColor Yellow
    $failed += "Make"
}

# --- Install podman-compose via pip ---
Write-Host "`n--- Python packages ---" -ForegroundColor Cyan
$pcCmd = Get-Command podman-compose -ErrorAction SilentlyContinue
if ($pcCmd) {
    Write-Host "  [OK] podman-compose -- $($pcCmd.Source)" -ForegroundColor Green
} else {
    Write-Host "  [MISSING] podman-compose -- installing via pip..." -ForegroundColor Yellow
    pip install podman-compose 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [INSTALLED] podman-compose" -ForegroundColor Green
        $installed += "podman-compose"
    } else {
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
        } else {
            Write-Host "  [FAILED] Podman machine init failed" -ForegroundColor Red
        }
    } else {
        Write-Host "  [OK] Podman machine exists: $machineList" -ForegroundColor Green
    }

    # Configure global k8s-file log driver inside the VM
    Write-Host "  Configuring Podman log driver (k8s-file)..." -ForegroundColor Yellow
    podman machine ssh "mkdir -p /home/user/.config/containers && echo '[containers]' > /home/user/.config/containers/containers.conf && echo 'log_driver = `"k8s-file`"' >> /home/user/.config/containers/containers.conf" 2>$null
    
    # Pre-create the named volume for Promtail log scraping
    Write-Host "  Creating podman_logs shared volume..." -ForegroundColor Yellow
    podman volume create --opt type=none --opt o=bind --opt device=/home/user/.local/share/containers/storage/overlay-containers podman_logs 2>$null | Out-Null
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
} else {
    Write-Host "`n  All prerequisites installed!" -ForegroundColor Green
    Write-Host "  Next step: .\scripts\init-env.ps1  (if no .env yet)" -ForegroundColor White
    Write-Host "  Then:      make setup" -ForegroundColor White
}
