$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$podFile = Join-Path $projectRoot 'output\deviceManager.pod'
$archive = [System.IO.Compression.ZipFile]::OpenRead($podFile)
try {
  foreach ($entryName in @('meta.props','index.props','lib/menu.trio','res/web/dm/index.html')) {
    if (-not $archive.GetEntry($entryName)) { throw "Missing POD entry $entryName" }
  }
  $metaReader = [System.IO.StreamReader]::new($archive.GetEntry('meta.props').Open())
  try { $metadata = $metaReader.ReadToEnd() } finally { $metaReader.Dispose() }
  if ($metadata -notmatch 'pod.name=deviceManager') { throw 'Wrong POD identity' }
  $resources = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'res\web\dm') -File -Recurse
  foreach ($file in $resources) {
    $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\','/')
    $entry = $archive.GetEntry($relative)
    if (-not $entry) { throw "Resource omitted from POD: $relative" }
    $stream = $entry.Open()
    $hash = [System.Security.Cryptography.SHA256]::Create()
    try { $packedHash = (($hash.ComputeHash($stream) | ForEach-Object { $_.ToString('X2') }) -join '') } finally { $hash.Dispose(); $stream.Dispose() }
    if ($packedHash -ne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash) { throw "Stale resource: $relative" }
  }
  Write-Host "POD verified: $($resources.Count) Web resources match the current build."
} finally { $archive.Dispose() }
Get-FileHash -LiteralPath $podFile -Algorithm SHA256 | Select-Object Hash,Path
