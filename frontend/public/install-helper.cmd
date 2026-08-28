@echo off
setlocal
set "PIXELSKY_INSTALLER=%TEMP%\pixelsky-install-helper.ps1"
echo Downloading PixelSky Helper installer...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://pixelsky.pages.dev/install-helper.ps1' -OutFile '%PIXELSKY_INSTALLER%'"
if errorlevel 1 (
  echo Download failed. Please check your network and try again.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PIXELSKY_INSTALLER%"
if errorlevel 1 (
  echo Installation failed. Copy the error above when asking for help.
  pause
  exit /b 1
)
endlocal
