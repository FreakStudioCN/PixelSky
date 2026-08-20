$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
$Python=Join-Path $Root '.venv\Scripts\python.exe'
$PortableNode=Join-Path $Root '.tools\node-v22.23.2-win-x64'
if(Test-Path $PortableNode){$env:Path=$PortableNode+';'+$env:Path}
if(-not(Test-Path $Python)){throw '请先运行 scripts\setup.ps1'}
if(-not(Get-Command npm.cmd -ErrorAction SilentlyContinue)){throw '未找到 Node.js 运行环境'}
Start-Process -FilePath $Python -ArgumentList @('-m','uvicorn','main:app','--app-dir',(Join-Path $Root 'helper'),'--host','127.0.0.1','--port','8765') -WindowStyle Hidden
Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev') -WorkingDirectory (Join-Path $Root 'frontend') -WindowStyle Hidden
Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:5173'
Write-Host 'PixelSky 已启动：Web 5173 · Helper 8765' -ForegroundColor Green
