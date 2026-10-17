# Load Visual Studio C++ environment, then run the remaining arguments.
# Required so electron-builder / node-gyp can rebuild @serialport/bindings-cpp on CI.
$ErrorActionPreference = "Stop"

# Capture Python BEFORE vcvars — VS often prepends a Python 3.12+ without distutils
$pythonExe = $null
if ($env:PYTHON -and (Test-Path $env:PYTHON)) {
  $pythonExe = $env:PYTHON
} elseif ($env:pythonLocation) {
  $candidate = Join-Path $env:pythonLocation "python.exe"
  if (Test-Path $candidate) { $pythonExe = $candidate }
}
if (-not $pythonExe) {
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -notmatch "WindowsApps") {
    $pythonExe = $cmd.Source
  }
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) {
  throw "vswhere.exe not found — install Visual Studio Build Tools with C++ workload."
}

$installPath = & $vswhere -latest -products * `
  -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  -property installationPath

if (-not $installPath) {
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
$cmdLine = "`"$vcvars`" >nul && set"
cmd.exe /c $cmdLine | ForEach-Object {
  if ($_ -match '^(.*?)=(.*)$') {
    $name = $Matches[1]
    $value = $Matches[2]
    [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

$env:GYP_MSVS_VERSION = "2022"
$env:npm_config_msvs_version = "2022"

# Restore setup-python / pre-vcvars Python so node-gyp has distutils
if ($pythonExe) {
  $env:PYTHON = $pythonExe
  $env:npm_config_python = $pythonExe
  $pyDir = Split-Path -Parent $pythonExe
  $env:PATH = "$pyDir;$env:PATH"
  Write-Host "Pinned Python for node-gyp: $pythonExe"
  & $pythonExe -c "import distutils; print('distutils OK')"
} else {
  Write-Host "WARNING: No Python pinned — node-gyp may fail with ModuleNotFoundError: distutils"
}

if ($args.Count -eq 0) {
  throw "Usage: with-msvc.ps1 <command> [args...]"
}

Write-Host "Running: $($args -join ' ')"
& $args[0] $args[1..($args.Count - 1)]
if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
  exit $LASTEXITCODE
}
