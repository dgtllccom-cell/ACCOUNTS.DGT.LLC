# fix-secret.ps1
# This script amends your last commit to remove the secret and pushes the branch.

Set-Location $PSScriptRoot

Write-Host "=== Amending the previous commit to remove the secret ===" -ForegroundColor Cyan
git add query.js
git commit --amend --no-edit

$branchName = git rev-parse --abbrev-ref HEAD

Write-Host ""
Write-Host "=== Pushing changes to origin/$branchName ===" -ForegroundColor Cyan
git push -u origin $branchName

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Please check the terminal output above."
Write-Host "If successful, go to GitHub to open a Pull Request." -ForegroundColor Green
Read-Host "Press Enter to exit"
