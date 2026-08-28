$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'PixelSkyHelper'
$venvPython = Join-Path $installRoot '.venv\Scripts\python.exe'
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('pixelsky-helper-' + [guid]::NewGuid().ToString('N'))
$archive = Join-Path $tempRoot 'pixelsky.zip'
$sourceRoot = Join-Path $tempRoot 'PixelSky-main'

Write-Host 'PixelSky Helper installer' -ForegroundColor Cyan
Write-Host 'This local service lets pixelsky.pages.dev access the ESP32 connected to this PC.'

try {
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    Write-Host '[1/4] Downloading the latest helper...'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/erkou111/PixelSky/archive/refs/heads/main.zip' -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $tempRoot -Force

    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
    $helperTarget = Join-Path $installRoot 'helper'
    $deviceTarget = Join-Path $installRoot 'device'
    New-Item -ItemType Directory -Path $helperTarget, $deviceTarget -Force | Out-Null
    Copy-Item -Path (Join-Path $sourceRoot 'helper\*') -Destination $helperTarget -Recurse -Force
    Copy-Item -Path (Join-Path $sourceRoot 'device\*') -Destination $deviceTarget -Recurse -Force

    Write-Host '[2/4] Preparing Python...'
    if (Get-Command py.exe -ErrorAction SilentlyContinue) {
        & py.exe -3 -m venv (Join-Path $installRoot '.venv')
    } elseif (Get-Command python.exe -ErrorAction SilentlyContinue) {
        & python.exe -m venv (Join-Path $installRoot '.venv')
    } else {
        throw 'Python 3.11 or newer is required. Install Python from https://www.python.org/downloads/ and run this installer again.'
    }

    Write-Host '[3/4] Installing device tools...'
    & $venvPython -m pip install --disable-pip-version-check -r (Join-Path $installRoot 'helper\requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }

    $startScript = Join-Path $installRoot 'Start PixelSky Helper.cmd'
    $startContent = @"
@echo off
start "PixelSky Helper" /min "$venvPython" -m uvicorn main:app --app-dir "$installRoot\helper" --host 127.0.0.1 --port 8765
timeout /t 2 /nobreak >nul
start "" "https://pixelsky.pages.dev/"
"@
    Set-Content -LiteralPath $startScript -Value $startContent -Encoding ASCII

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'PixelSky Helper.lnk'))
    $shortcut.TargetPath = $startScript
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.Description = 'Start the PixelSky local hardware bridge'
    $shortcut.Save()

    Write-Host '[4/4] Starting the helper...'
    Start-Process -FilePath $venvPython -ArgumentList @('-m', 'uvicorn', 'main:app', '--app-dir', (Join-Path $installRoot 'helper'), '--host', '127.0.0.1', '--port', '8765') -WindowStyle Hidden
    Start-Sleep -Seconds 2
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 8
    if (-not $health.ok) { throw 'The helper started but did not pass its health check.' }

    Write-Host 'PixelSky Helper is ready. A desktop shortcut was created.' -ForegroundColor Green
    Start-Process 'https://pixelsky.pages.dev/'
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
