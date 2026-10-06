# fix-git-secret-push.ps1
# Squashes local unpushed commits into a clean single commit to remove old secret history

Set-Location $PSScriptRoot

Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host "   CLEANING GIT COMMIT HISTORY & REMOVING SECRET FROM PUSH" -ForegroundColor Yellow
Write-Host "=================================================================`n" -ForegroundColor Yellow

# Fetch origin status
git fetch origin main

# Soft reset unpushed commits relative to origin/main
git reset --soft origin/main

# Stage current clean codebase
git add -A

# Create fresh clean commit without secret history
git commit -m "Clean production ERP release updates"

# Push clean main branch to GitHub
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n================================================================" -ForegroundColor Green
    Write-Host "   SUCCESS: Clean code pushed to GitHub origin main successfully!" -ForegroundColor Green
    Write-Host "================================================================`n" -ForegroundColor Green
} else {
    Write-Host "`n================================================================" -ForegroundColor Red
    Write-Host "   PUSH FAILED: Please check GitHub unblock link if required." -ForegroundColor Red
    Write-Host "================================================================`n" -ForegroundColor Red
}
