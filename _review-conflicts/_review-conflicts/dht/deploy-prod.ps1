# deploy-prod.ps1
# Run this script to commit, push, and deploy all pending changes to the production server.
# Run in PowerShell: powershell -ExecutionPolicy Bypass -File deploy-prod.ps1

Set-Location $PSScriptRoot

Write-Host "=== Staging and Committing Changes ===" -ForegroundColor Cyan
git add -A
git commit -m "fix: Super Admin Branch validation, picker matching, and Live Preview updates"

Write-Host ""
Write-Host "=== Pushing to origin/main ===" -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "=== Deploying to Remote Server (72.60.209.121) ===" -ForegroundColor Cyan
ssh root@72.60.209.121 "cd /var/www/dgt-nextjs && git fetch origin main && git reset --hard origin/main && npm install && npm run build && pm2 restart dgt-nextjs"

Write-Host ""
Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
Read-Host "Press Enter to exit"
