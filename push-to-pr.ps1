if (-not $env:DGT_ALLOW_LEGACY_DEPLOY) { Write-Host "DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate (scripts/production/dgt-deploy-gate.sh) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. (Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.)"; exit 1 }
# push-to-pr.ps1
# Run this script to bypass the repository rules on `main` 
# by pushing your recent commits to a new branch for a Pull Request.

Set-Location $PSScriptRoot

$branchName = "update-feature-branch-" + (Get-Date -Format "yyyyMMdd-HHmmss")

Write-Host "=== Creating New Branch: $branchName ===" -ForegroundColor Cyan
git checkout -b $branchName

Write-Host ""
Write-Host "=== Pushing changes to origin/$branchName ===" -ForegroundColor Cyan
git push -u origin $branchName

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Please check the terminal output above."
Write-Host "If successful, go to GitHub to open a Pull Request." -ForegroundColor Green
Read-Host "Press Enter to exit"
