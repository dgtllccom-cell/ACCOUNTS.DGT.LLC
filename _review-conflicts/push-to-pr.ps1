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
