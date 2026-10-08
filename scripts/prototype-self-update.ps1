$ErrorActionPreference = "Stop"
$RepoOwner = "dgtllccom-cell"
$RepoName = "ACCOUNTS.DGT.LLC"
$Branch = "prototype-full-erp-20261008"
$Root = Split-Path -Parent $PSScriptRoot
$StampFile = Join-Path $Root ".prototype-last-sync"

function Write-Info($Text) {
  Write-Host "[DGT Prototype] $Text"
}

try {
  $Headers = @{ "User-Agent" = "DGT-ERP-Prototype-Updater"; "Accept" = "application/vnd.github+json" }
  $BranchApi = "https://api.github.com/repos/$RepoOwner/$RepoName/branches/$Branch"
  $Latest = Invoke-RestMethod -Uri $BranchApi -Headers $Headers -UseBasicParsing
  $LatestSha = [string]$Latest.commit.sha

  $CurrentSha = ""
  if (Test-Path $StampFile) {
    $CurrentSha = (Get-Content $StampFile -Raw).Trim()
  }

  if ($CurrentSha -eq $LatestSha -and $CurrentSha) {
    Write-Info "Already up to date: $($LatestSha.Substring(0,12))"
    exit 0
  }

  Write-Info "New prototype update found."
  Write-Info "Current: $CurrentSha"
  Write-Info "Latest : $LatestSha"

  $TempRoot = Join-Path $env:TEMP ("DGT-ERP-PROTOTYPE-" + [guid]::NewGuid().ToString("N"))
  $Zip = Join-Path $TempRoot "prototype.zip"
  $Extract = Join-Path $TempRoot "extract"
  New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
  New-Item -ItemType Directory -Force -Path $Extract | Out-Null

  $ArchiveUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/$Branch.zip"
  Write-Info "Downloading latest prototype source..."
  Invoke-WebRequest -Uri $ArchiveUrl -Headers $Headers -OutFile $Zip -UseBasicParsing
  $Tar = Join-Path $env:SystemRoot "System32\tar.exe"
  if (Test-Path $Tar) {
    & $Tar -xf $Zip -C $Extract
    if ($LASTEXITCODE -ne 0) { throw "tar extraction failed with exit code $LASTEXITCODE." }
  } else {
    Expand-Archive -Path $Zip -DestinationPath $Extract -Force
  }

  $Source = Get-ChildItem -Path $Extract -Directory | Select-Object -First 1
  if (-not $Source) { throw "Downloaded prototype archive is empty." }

  Write-Info "Applying update..."
  $Robo = Join-Path $env:SystemRoot "System32\robocopy.exe"
  & $Robo $Source.FullName $Root /E /R:1 /W:1 /XD node_modules .next .git /XF .env .env.local .prototype-last-sync | Out-Null
  $Code = $LASTEXITCODE
  if ($Code -ge 8) { throw "Robocopy failed with exit code $Code." }

  Set-Content -Path $StampFile -Value $LatestSha -Encoding ASCII
  Remove-Item -Path $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
  Write-Info "Updated successfully to $($LatestSha.Substring(0,12))."
  exit 0
}
catch {
  Write-Warning ("Update check failed: " + $_.Exception.Message)
  Write-Warning "The existing prototype will still open."
  exit 0
}
