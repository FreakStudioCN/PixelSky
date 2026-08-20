$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
$Python=Join-Path $Root '.venv\Scripts\python.exe'
if(-not(Test-Path $Python)){throw '缺少 Python 环境，请先运行 scripts\setup.ps1'}
& $Python -c "import fastapi,serial,mpremote,esptool,multipart;print('工具链：OK')"
$health=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 5
Write-Host ("Helper：{0} v{1}" -f $health.service,$health.version) -ForegroundColor Green
$ports=(Invoke-RestMethod -Uri 'http://127.0.0.1:8765/api/ports' -TimeoutSec 5).ports
if(-not $ports){Write-Warning '未发现串口，请检查数据线和驱动';exit 1}
$ports | Select-Object device,description,hwid | Format-Table -AutoSize
Write-Host '环境检查完成。请在 Web 页选择目标串口，执行一键设备检查和 RGB 灯板测试。' -ForegroundColor Green
