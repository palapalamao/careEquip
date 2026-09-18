[CmdletBinding()]
param([string]$FanHome = 'C:\Program Files (x86)\FIN\FIN 5.3.0.2761')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$fanBin = Join-Path $FanHome 'bin\fan.bat'
if (-not (Test-Path -LiteralPath $fanBin)) { throw "Fantom executable missing: $fanBin" }
$dependencyDir = Join-Path $FanHome 'lib\fan'
foreach ($dependency in @('finBuild','skyarc','skyarcd','haystack','axon','finStackCoreExt')) {
  if (-not (Test-Path -LiteralPath (Join-Path $dependencyDir "$dependency.pod"))) { throw "Missing dependency: $dependency" }
}
$bump = $env:DM_BUMP
if (-not $bump) { $bump = 'patch' }
& node (Join-Path $PSScriptRoot 'bump-version.mjs') $bump
if ($LASTEXITCODE -ne 0) { throw 'Version bump failed' }
Push-Location (Join-Path $projectRoot 'ts')
try {
  & npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
  & npm test
  if ($LASTEXITCODE -ne 0) { throw 'Unit tests failed' }
} finally { Pop-Location }
Push-Location $projectRoot
try {
  & node scripts/prepare-seed.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic data preview generation failed' }
  & node scripts/prepare-seed-v2.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic records v2 preview generation failed' }
  & node scripts/prepare-seed-v3.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic plans v3 preview generation failed' }
  & $fanBin scripts/validate-axon.fan ($projectRoot.Replace('\','/') + '/')
  if ($LASTEXITCODE -ne 0) { throw 'Menu or seed Axon syntax validation failed' }
  & $fanBin build.fan
  if ($LASTEXITCODE -ne 0) { throw 'POD build failed' }
  & (Join-Path $PSScriptRoot 'check-pod.ps1')
} finally { Pop-Location }
Write-Host 'Built output\deviceManager.pod. No FIN installation, restart or data mutation was performed.'

