# PixelSky MVP

本地优先的 16×8 WS2812 像素动画工作台，包含 React Web 界面、FastAPI Helper 和 ESP32 MicroPython runtime。

## 启动

需要 Node.js 20+、Python 3.11+，ESP32 需预先刷入 MicroPython。本项目当前也包含 `.tools` 下的便携 Node.js，可直接启动。

```powershell
cd C:\Users\14365\Desktop\pixelsky
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

Web：`http://127.0.0.1:5173`；Helper 只监听 `127.0.0.1:8765`。

支持 8×8、16×8 和 16×16 画布，点击/拖拽绘画、创作/硬件双视图、语音或文本创意、RGB565 双向转换与旧文件导入、最多 32 帧播放、拖拽排序、帧操作撤销、单帧时长、循环控制、项目 JSON、串口扫描、固件烧录、设备检查、灯板测试、完整部署和动画快速上传。页面默认显示随画布实时更新的 `animation.json` 与 `config.json`。没有模型密钥时自动使用内置模板。

媒体转换支持图片、视频、动态 GIF 和 1–4 个字符，提供亮度、对比度与饱和度调整，并兼容 NeopixelMatrixTool 的 `{pixels,width,height,description,version}` RGB565 JSON。矩阵校准支持六种颜色顺序、翻转、旋转、Gamma 与 RGB 通道平衡。

Workshop 课前部署见 [WORKSHOP.md](WORKSHOP.md)，环境检查可运行 `scripts\workshop-check.ps1`。固件放置说明见 `firmware\README.md`。

## Cloudflare 部署

`frontend/functions` 提供 Pages Functions 云端 API，线上前端会调用 `/api/generate`；串口、烧录和 `mpremote` 仍由连接设备电脑上的本地 Helper 处理。

```powershell
cd frontend
npm run build
npx wrangler pages deploy dist --project-name pixelsky --branch main
```

云端动画生成在没有模型密钥时使用内置模板。需要接入兼容 Chat Completions 的模型时，可在 Cloudflare 项目中配置 `PIXELSKY_AI_BASE_URL`、`PIXELSKY_AI_API_KEY` 和 `PIXELSKY_AI_MODEL`。

## 技术依据

- NeopixelMatrixTool：https://github.com/FreakStudioCN/NeopixelMatrixTool
- MicroPython neopixel_matrix：https://github.com/FreakStudioCN/micropython-embedded/tree/main/middleware/display/neopixel_matrix
- MicroPython 固件：https://micropython.org/download/
- esptool：https://docs.espressif.com/projects/esptool/
- mpremote：https://docs.micropython.org/en/latest/reference/mpremote.html

可选 AI 环境变量：`PIXELSKY_AI_BASE_URL`、`PIXELSKY_AI_API_KEY`、`PIXELSKY_AI_MODEL`，接口需兼容 Chat Completions。

硬件默认 GPIO2、GRB、逐行蛇形、亮度 0.2。两块 8×8 矩阵按一行串接，独立稳定供电并与 ESP32 共地。

## 验证

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s helper -p 'test_*.py'
cd frontend; npm run build
```

真实串口和 LED 显示需连接硬件后验收；Helper 会拒绝上传到扫描列表之外的端口。
