# deploy-to-vps.ps1 - One-Click Production VPS Deployer
$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   DIGITAL DOCK ERP - ONE-CLICK PRODUCTION VPS DEPLOYMENT" -ForegroundColor Cyan
Write-Host "=================================================================`n" -ForegroundColor Cyan

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRoot

Write-Host "[1/3] Pushing latest code to GitHub (main & production branches)..." -ForegroundColor Yellow
$env:DGT_PROD_PUSH_APPROVED = "1"
git push origin main
git push origin main:production

$commitSha = (git rev-parse HEAD).Trim()
Write-Host "`n[2/3] Approving and triggering deployment on VPS for commit: $commitSha..." -ForegroundColor Yellow

ssh root@72.60.209.121 "dgt-approve-deploy $commitSha && dgt-deploy"

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "   SUCCESS: Production VPS deployed and restarted successfully!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
