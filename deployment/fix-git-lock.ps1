# Fix Git Lock & Stale IPC Socket Errors
Write-Host "================================================================" -ForegroundColor Yellow
Write-Host "  Clearing Stale Git Locks & Resetting Git Index" -ForegroundColor Yellow
Write-Host "================================================================`n" -ForegroundColor Yellow

if (Test-Path ".git/index.lock") {
    Remove-Item -Path ".git/index.lock" -Force
    Write-Host "[✓] Removed .git/index.lock" -ForegroundColor Green
} else {
    Write-Host "[i] No .git/index.lock file found." -ForegroundColor Cipher
}

git status
