if (-not $env:DGT_ALLOW_LEGACY_DEPLOY) { Write-Host "DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate (scripts/production/dgt-deploy-gate.sh) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. (Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.)"; exit 1 }
# deploy-prod.ps1
# Clean Git Push & Non-Interactive VPS Deployment Runner
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRoot

Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host "   DIGITAL DOCK ERP - PRODUCTION VPS AUTOMATED DEPLOYMENT" -ForegroundColor Yellow
Write-Host "=================================================================`n" -ForegroundColor Yellow

# Execute Node script for full deployment pipeline
node deploy-and-verify.js

