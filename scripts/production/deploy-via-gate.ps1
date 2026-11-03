param(
  [string]$CommitSha = "5a01011",
  [switch]$Migrations,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$VPS = "root@72.60.209.121"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  DGT ERP CONTROLLED GATE DEPLOYMENT: $CommitSha" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Push to production branch
Write-Host "`n[1/3] Promoting $CommitSha to origin/production..." -ForegroundColor Yellow
git push origin "$($CommitSha):refs/heads/production"

# 2. Check SSH connectivity
Write-Host "`n[2/3] Checking SSH connection to VPS $VPS..." -ForegroundColor Yellow
$migArg = if ($Migrations) { "--migrations" } else { "" }
$dryArg = if ($DryRun) { "--dry-run" } else { "" }

$remoteCmd = "dgt-approve-deploy $CommitSha $migArg && dgt-deploy $dryArg"

Write-Host "Connecting to VPS to run approval and deployment gate..." -ForegroundColor Yellow
ssh -o BatchMode=yes -o ConnectTimeout=10 $VPS $remoteCmd

Write-Host "`n[3/3] Deployment initiated successfully!" -ForegroundColor Green

