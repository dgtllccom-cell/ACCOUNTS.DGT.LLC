# fix-history.ps1
# This script squashes your recent commits to completely remove the secret from your git history.

Set-Location $PSScriptRoot

Write-Host "=== Rewriting history to remove the secret ===" -ForegroundColor Cyan
# Reset to the commit BEFORE the secret was introduced
git reset --soft 2fd7c05e722eeb058cd85cecbad509f07593652a

# Ensure all current, clean files are staged
git add -A

# Create a new, clean commit
git commit -m "feat: combined updates (secrets removed)"

$branchName = git rev-parse --abbrev-ref HEAD

Write-Host ""
Write-Host "=== Pushing changes to origin/$branchName ===" -ForegroundColor Cyan
git push -u origin $branchName

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Check the output above. You should now be able to open a Pull Request!" -ForegroundColor Green
Read-Host "Press Enter to exit"
