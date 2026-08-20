$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
$PortableNode=Join-Path $Root '.tools\node-v22.23.2-win-x64'
if(Test-Path $PortableNode){$env:Path=$PortableNode+';'+$env:Path}
if(-not(Get-Command npm.cmd -ErrorAction SilentlyContinue)){throw '未找到 Node.js，请安装 Node.js 20+ 或保留项目内 .tools 目录'}
python -m venv (Join-Path $Root '.venv')
& (Join-Path $Root '.venv\Scripts\python.exe') -m pip install -r (Join-Path $Root 'helper\requirements.txt')
Push-Location (Join-Path $Root 'frontend');npm install;Pop-Location
Write-Host '依赖安装完成，请运行 scripts\start.ps1' -ForegroundColor Green
