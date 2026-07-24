# commit-changes.ps1
# Run this script from the ACCOUNTS.DGT.LLC directory to commit all pending changes.
# Double-click or run: powershell -ExecutionPolicy Bypass -File commit-changes.ps1

Set-Location $PSScriptRoot

Write-Host "=== Staging all changes ===" -ForegroundColor Cyan
git add -A

Write-Host ""
Write-Host "=== Commit message ===" -ForegroundColor Cyan
$commitMsg = @"
feat: Custom PDF Print Preview Modal

- Replaced window.open with a new global PrintStore
- Created beautiful full-screen PdfPreviewModal component with page thumbnails, paper size, and orientation controls
- Integrated Share, Email, Download and Print action buttons
- Fixed Module Not Found error by replacing zustand with a lightweight custom React state manager
- Updated RootLayout to globally mount the new print modal
"@

git commit -m $commitMsg

Write-Host ""
Write-Host "=== Pushing to origin/main ===" -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "All changes committed and pushed. The worktree blocking issue should now be resolved." -ForegroundColor Green
Read-Host "Press Enter to exit"
