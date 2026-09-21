param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDirectory,

  [Parameter(Mandatory = $true)]
  [string]$DestinationZip
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$source = (Resolve-Path -LiteralPath $SourceDirectory).Path
$destination = [System.IO.Path]::GetFullPath($DestinationZip)
$destinationDirectory = [System.IO.Path]::GetDirectoryName($destination)

[System.IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null
if ([System.IO.File]::Exists($destination)) {
  [System.IO.File]::Delete($destination)
}

$archive = [System.IO.Compression.ZipFile]::Open(
  $destination,
  [System.IO.Compression.ZipArchiveMode]::Create
)
try {
  foreach ($file in Get-ChildItem -LiteralPath $source -File -Recurse) {
    $relativePath = $file.FullName.Substring($source.Length).TrimStart('\', '/').Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $file.FullName,
      $relativePath,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $archive.Dispose()
}
