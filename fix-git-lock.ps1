# fix-git-lock.ps1
# Terminates hanging background Git processes and removes stale .git/index.lock file

Set-Location $PSScriptRoot

Write-Host "1. Terminating background Git processes..." -ForegroundColor Yellow
try {
    Stop-Process -Name "git" -Force -ErrorAction SilentlyContinue
    taskkill /F /IM git.exe /T 2>$null
} catch {}

Start-Sleep -Milliseconds 500

$lockPath = Join-Path $PSScriptRoot ".git\index.lock"

if (Test-Path $lockPath) {
    try {
        Remove-Item -Force $lockPath -ErrorAction Stop
        Write-Host "SUCCESS: Stale .git/index.lock file unlocked and deleted!" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: File still locked by external editor or OneDrive. Retrying..." -ForegroundColor Yellow
        Start-Sleep -Seconds 1
        Remove-Item -Force $lockPath -ErrorAction SilentlyContinue
        if (-not (Test-Path $lockPath)) {
            Write-Host "SUCCESS: .git/index.lock successfully removed on retry!" -ForegroundColor Green
        } else {
            Write-Host "ERROR: File locked by OneDrive or editor. Close VS Code or pause OneDrive sync." -ForegroundColor Red
        }
    }
} else {
    Write-Host "No .git/index.lock file found. Git repository is unlocked." -ForegroundColor Green
}
