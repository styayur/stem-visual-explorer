param(
  [ValidateSet('frontend','rust','retrieval')][string]$Suite = 'frontend',
  [ValidatePattern('^[a-z-]+$')][string]$Phase = 'final'
)
$ErrorActionPreference = 'Continue'
$commands = switch ($Suite) {
  frontend { @('npm ci','npm test','npm run build','npm run build:web','npm run test:web','npm run test:web:build') }
  rust { @('cargo fmt --manifest-path src-tauri/Cargo.toml --check','cargo test --manifest-path src-tauri/Cargo.toml --no-default-features','cargo clippy --manifest-path src-tauri/Cargo.toml --no-default-features --all-targets -- -D warnings','cargo check --manifest-path src-tauri/Cargo.toml --locked','cargo test --manifest-path src-tauri/Cargo.toml','cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings') }
  retrieval { @('npm run ontology:validate','npm run index:quality','npm run benchmark','npm run test:parity','npm run ontology:audit') }
}
$directory = Join-Path 'artifacts' $Phase
New-Item -ItemType Directory -Force $directory | Out-Null
$report = @()
foreach ($command in $commands) {
  $log = Join-Path $directory (($command -replace '[^a-zA-Z0-9]+','-') + '.log')
  $started = [DateTime]::UtcNow
  # Commands are the fixed argument lists above; no shell evaluation.
  $commandParts = $command -split ' '
  $commandArguments = $commandParts[1..($commandParts.Length - 1)]
  & $commandParts[0] @commandArguments *> $log
  $code = $LASTEXITCODE
  $report += [pscustomobject]@{command=$command;exit_code=$code;started_at=$started.ToString('o');duration_seconds=([DateTime]::UtcNow-$started).TotalSeconds;log=$log;package_version=(Get-Content package.json -Raw|ConvertFrom-Json).version}
  $report | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $directory "$Suite.json")
  Write-Output "$command => $code"
}
if ($report | Where-Object { $_.exit_code -ne 0 }) { exit 1 }
