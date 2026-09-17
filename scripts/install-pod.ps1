$ErrorActionPreference = 'Stop'
$dmRoot = Split-Path -Parent $PSScriptRoot
$dmSource = Join-Path $dmRoot 'output\deviceManager.pod'
$dmTarget = 'C:\Program Files (x86)\FIN\FIN 5.3.0.2761\lib\fan\deviceManager.pod'
$dmLog = Join-Path $dmRoot 'output\install-result.json'
try {
  $dmHash = (Get-FileHash -LiteralPath $dmSource -Algorithm SHA256).Hash
  if (Test-Path -LiteralPath $dmTarget) {
    if ((Get-FileHash -LiteralPath $dmTarget -Algorithm SHA256).Hash -ne $dmHash) {
      throw 'A different deviceManager POD is already installed. Inspect before replacing.'
    }
  } else {
    Copy-Item -LiteralPath $dmSource -Destination $dmTarget
  }
  if ((Get-FileHash -LiteralPath $dmTarget -Algorithm SHA256).Hash -ne $dmHash) {
    throw 'Installed POD hash mismatch.'
  }
  @{status='installed';path=$dmTarget;sha256=$dmHash;restarted=$false} | ConvertTo-Json | Set-Content -LiteralPath $dmLog -Encoding UTF8
} catch {
  @{status='failed';error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath $dmLog -Encoding UTF8
  throw
}
