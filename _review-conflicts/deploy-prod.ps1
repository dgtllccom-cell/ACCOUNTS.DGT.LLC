# deploy-prod.ps1
# Clean Git Push & Non-Interactive VPS Deployment Runner
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRoot

Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host "   DIGITAL DOCK ERP - PRODUCTION VPS AUTOMATED DEPLOYMENT" -ForegroundColor Yellow
Write-Host "=================================================================`n" -ForegroundColor Yellow

# Execute Node script for full deployment pipeline
node deploy-and-verify.js

