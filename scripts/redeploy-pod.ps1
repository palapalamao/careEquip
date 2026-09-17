$ErrorActionPreference = 'Stop'
$dmRoot = Split-Path -Parent $PSScriptRoot
$dmSource = Join-Path $dmRoot 'output\deviceManager.pod'
$dmTarget = 'C:\Program Files (x86)\FIN\FIN 5.3.0.2761\lib\fan\deviceManager.pod'
$dmBackup = Join-Path $dmRoot ('output\deviceManager-before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.pod')
$dmLog = Join-Path $dmRoot 'output\redeploy-result.json'
$dmHash = (Get-FileHash -LiteralPath $dmSource -Algorithm SHA256).Hash
Copy-Item -LiteralPath $dmTarget -Destination $dmBackup
try {
  Stop-Service -Name FIN5
  (Get-Service FIN5).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(45))
  Copy-Item -LiteralPath $dmSource -Destination $dmTarget -Force
  if ((Get-FileHash -LiteralPath $dmTarget -Algorithm SHA256).Hash -ne $dmHash) { throw 'POD hash mismatch' }
  Start-Service -Name FIN5
  (Get-Service FIN5).WaitForStatus('Running', [TimeSpan]::FromSeconds(45))
  @{status='installed-service-running';hash=$dmHash;backup=$dmBackup} | ConvertTo-Json | Set-Content -LiteralPath $dmLog -Encoding UTF8
} catch {
  @{status='failed';error=$_.Exception.Message;backup=$dmBackup} | ConvertTo-Json | Set-Content -LiteralPath $dmLog -Encoding UTF8
  if ((Get-Service FIN5).Status -eq 'Stopped') { Start-Service FIN5 }
  throw
}
