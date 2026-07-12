$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $projectRoot "backend"
$dashboard = Join-Path $projectRoot "dashboard"

function Assert-LastCommandSucceeded {
  param([string]$Step)

  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

Write-Host "Installing backend packages..." -ForegroundColor Cyan
Push-Location $backend
try {
  npm install --no-audit --no-fund
  Assert-LastCommandSucceeded "Backend package installation"

  Write-Host "Checking backend JavaScript syntax..." -ForegroundColor Cyan
  Get-ChildItem -Path . -Recurse -Filter *.js |
    Where-Object { $_.FullName -notmatch "node_modules" } |
    ForEach-Object {
      node --check $_.FullName
      Assert-LastCommandSucceeded "Syntax check for $($_.FullName)"
    }
}
finally {
  Pop-Location
}

Write-Host "Installing dashboard packages..." -ForegroundColor Cyan
Push-Location $dashboard
try {
  npm install --no-audit --no-fund
  Assert-LastCommandSucceeded "Dashboard package installation"

  Write-Host "Linting dashboard..." -ForegroundColor Cyan
  npm run lint
  Assert-LastCommandSucceeded "Dashboard lint"

  Write-Host "Building dashboard..." -ForegroundColor Cyan
  npm run build
  Assert-LastCommandSucceeded "Dashboard build"
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "All validation checks passed." -ForegroundColor Green
Write-Host "Dashboard build: $dashboard\dist" -ForegroundColor Green
