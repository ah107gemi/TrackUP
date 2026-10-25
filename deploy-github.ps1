# ==============================================================================
# TrackUp - One-Click GitHub Sync & Deployment Script
# Description: Automates staging, committing, and pushing TrackUp to GitHub.
# ==============================================================================

[CmdletBinding()]
param (
    [string]$CommitMessage = "",
    [string]$RemoteUrl = ""
)

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "          TrackUp — GitHub Deployment Automation         " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Verify Git is available
try {
    $gitVersion = git --version
    Write-Host "[OK] Git detected: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Git is not installed or not in your PATH." -ForegroundColor Red
    exit 1
}

# 2. Check repository root
$repoRoot = $PSScriptRoot
Set-Location -Path $repoRoot
Write-Host "[INFO] Repository directory: $repoRoot" -ForegroundColor Cyan

# 3. Verify Remote Origin
$existingRemote = git remote get-url origin 2>$null
if (-not $existingRemote) {
    if (-not $RemoteUrl) {
        Write-Host ""
        Write-Host "[ACTION REQUIRED] No remote 'origin' detected." -ForegroundColor Yellow
        $RemoteUrl = Read-Host "Paste your GitHub Repository URL (e.g. https://github.com/username/trackup.git)"
    }

    if ($RemoteUrl) {
        git remote add origin $RemoteUrl.Trim()
        Write-Host "[OK] Remote origin configured: $RemoteUrl" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Remote URL cannot be empty. Aborting deployment." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[OK] Remote origin detected: $existingRemote" -ForegroundColor Green
}

# 4. Check for unstaged changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host ""
    Write-Host "[INFO] Uncommitted changes detected:" -ForegroundColor Cyan
    git status -s

    if (-not $CommitMessage) {
        Write-Host ""
        $userMsg = Read-Host "Enter commit message (Press ENTER for default: 'chore: sync TrackUp project')"
        if ($userMsg) {
            $CommitMessage = $userMsg.Trim()
        } else {
            $CommitMessage = "chore: sync TrackUp project - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        }
    }

    Write-Host "[INFO] Staging all changes..." -ForegroundColor Cyan
    git add .
    git commit -m "$CommitMessage"
    Write-Host "[OK] Committed changes: $CommitMessage" -ForegroundColor Green
} else {
    Write-Host "[INFO] Working tree clean. No local uncommitted changes." -ForegroundColor Cyan
}

# 5. Ensure branch is main
git branch -M main

# 6. Push to remote origin
Write-Host ""
Write-Host "[INFO] Syncing with remote origin (main branch)..." -ForegroundColor Cyan

# Try rebase pull first in case remote has commits (e.g. initial README)
git pull --rebase origin main 2>$null

Write-Host "[INFO] Pushing commits to GitHub..." -ForegroundColor Cyan
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  SUCCESS: TrackUp successfully synced and pushed!       " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Branch: main" -ForegroundColor Cyan
    Write-Host "Remote: $(git remote get-url origin)" -ForegroundColor Cyan
    Write-Host "Latest Commit: $(git rev-parse --short HEAD)" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[FAILED] Git push encountered an error." -ForegroundColor Red
    Write-Host "Tip: Check your GitHub credentials / SSH keys, or verify the remote URL." -ForegroundColor Yellow
    exit 1
}
