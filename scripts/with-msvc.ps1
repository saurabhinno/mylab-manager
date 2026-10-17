# Load Visual Studio C++ environment, then run the remaining arguments.
# Required so electron-builder / node-gyp can rebuild @serialport/bindings-cpp on CI.
$ErrorActionPreference = "Stop"

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) {
  throw "vswhere.exe not found — install Visual Studio Build Tools with C++ workload."
}

$installPath = & $vswhere -latest -products * `
  -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  -property installationPath

if (-not $installPath) {
  # Fallback: any VS with MSBuild
  $installPath = & $vswhere -latest -products * -property installationPath
}

if (-not $installPath) {
  throw "No Visual Studio installation found for native module rebuild."
}

$vcvars = Join-Path $installPath "VC\Auxiliary\Build\vcvars64.bat"
if (-not (Test-Path $vcvars)) {
  throw "vcvars64.bat not found at $vcvars"
}

Write-Host "Using MSVC from: $installPath"

# Import env vars from vcvars into this PowerShell session
$cmd = "`"$vcvars`" >nul && set"
cmd.exe /c $cmd | ForEach-Object {
  if ($_ -match '^(.*?)=(.*)$') {
    $name = $Matches[1]
    $value = $Matches[2]
    [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

$env:GYP_MSVS_VERSION = "2022"
$env:npm_config_msvs_version = "2022"

if ($args.Count -eq 0) {
  throw "Usage: with-msvc.ps1 <command> [args...]"
}

Write-Host "Running: $($args -join ' ')"
& $args[0] $args[1..($args.Count - 1)]
if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
  exit $LASTEXITCODE
}
