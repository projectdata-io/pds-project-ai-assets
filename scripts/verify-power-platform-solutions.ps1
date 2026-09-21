param(
  [string]$SolutionDirectory = 'dist/solutions',
  [string]$ExpectedVersion = $env:PDS_POWER_PLATFORM_SOLUTION_VERSION
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

if ([string]::IsNullOrWhiteSpace($ExpectedVersion)) {
  throw 'ExpectedVersion or PDS_POWER_PLATFORM_SOLUTION_VERSION is required.'
}

$catalog = Get-Content -LiteralPath 'catalog.json' -Raw | ConvertFrom-Json
$agents = @($catalog.agents | Where-Object { $_.authoringTargets -contains 'standard-agent' })
$solutionFiles = @(Get-ChildItem -LiteralPath $SolutionDirectory -Filter '*.zip' -File)
if ($solutionFiles.Count -ne $agents.Count) {
  throw "Expected $($agents.Count) Standard Agent solution ZIP files, found $($solutionFiles.Count)."
}

foreach ($agent in $agents) {
  $metadata = Get-Content -LiteralPath (Join-Path $agent.path 'agent.json') -Raw | ConvertFrom-Json
  $basePascalName = (($agent.name -split '-') | ForEach-Object {
    $_.Substring(0, 1).ToUpperInvariant() + $_.Substring(1)
  }) -join ''
  $pascalName = "${basePascalName}Standard"
  $agentSchema = "pds_$pascalName"
  $solutionPath = Join-Path $SolutionDirectory "PDS$pascalName.zip"
  if (-not (Test-Path -LiteralPath $solutionPath)) {
    throw "Missing solution ZIP $solutionPath."
  }

  $archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $solutionPath))
  try {
    $entries = @($archive.Entries)
    $entryNames = @($entries | ForEach-Object FullName)
    $textByEntry = @{}
    foreach ($entry in $entries) {
      if ($entry.Length -eq 0 -or $entry.FullName -match '\.(png|jpg|jpeg|gif|ico)$') {
        continue
      }
      $reader = [System.IO.StreamReader]::new($entry.Open())
      try {
        $textByEntry[$entry.FullName] = $reader.ReadToEnd()
      } finally {
        $reader.Dispose()
      }
    }

    $allText = ($textByEntry.Values -join "`n")
    if ($allText -match 'pds_Agentseed|Agent seed' -or $entryNames -match 'pds_Agentseed') {
      throw "$($agent.name) still contains canonical seed identity."
    }
    if ($entryNames -notcontains "bots/$agentSchema/bot.xml") {
      throw "$($agent.name) is missing its bot component."
    }
    if ($entryNames -notcontains "botcomponents/$agentSchema.gpt.default/data") {
      throw "$($agent.name) is missing its GPT instruction component."
    }
    if ($allText -notmatch 'x-ms-agentic-protocol' -or $allText -notmatch 'mcp-streamable-1.0') {
      throw "$($agent.name) is missing the MCP connector OpenAPI definition."
    }
    if ($allText -notmatch '<Managed>0</Managed>') {
      throw "$($agent.name) is not unmanaged."
    }
    $escapedVersion = [regex]::Escape($ExpectedVersion)
    if ($allText -notmatch "<Version>$escapedVersion</Version>") {
      throw "$($agent.name) does not have expected version $ExpectedVersion."
    }

    $taskDialogs = @()
    foreach ($entryName in $textByEntry.Keys) {
      if ($entryName -like "botcomponents/$agentSchema.topic.*/data" -and $textByEntry[$entryName] -match '^kind: TaskDialog' ) {
        $taskDialogs += $entryName
      }
    }
    $expectedTaskDialogs = $metadata.skills.Count + 1
    if ($taskDialogs.Count -ne $expectedTaskDialogs) {
      throw "$($agent.name) has $($taskDialogs.Count) MCP TaskDialogs; expected $expectedTaskDialogs."
    }

    foreach ($taskDialog in $taskDialogs) {
      $data = $textByEntry[$taskDialog]
      if (
        $data -notmatch 'kind: InvokeExternalAgentTaskAction' -or
        $data -notmatch 'kind: ModelContextProtocolMetadata' -or
        $data -notmatch 'operationId: InvokeServer' -or
        $data -notmatch 'connectionReference:'
      ) {
        throw "$($agent.name) has an invalid MCP TaskDialog at $taskDialog."
      }
    }

    $mapping = $textByEntry['Assets/botcomponent_connectionreferenceset.xml']
    if ([string]::IsNullOrWhiteSpace($mapping)) {
      throw "$($agent.name) is missing botcomponent connection-reference mappings."
    }
    foreach ($taskDialog in $taskDialogs) {
      $schema = ($taskDialog -split '/')[1]
      if ($mapping -notmatch [regex]::Escape($schema)) {
        throw "$($agent.name) has no connection-reference mapping for $schema."
      }
    }

    Write-Output "$($agent.name): $($taskDialogs.Count) native MCP tools verified."
  } finally {
    $archive.Dispose()
  }
}
