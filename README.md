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

支持 8×8、16×8 和 16×16 画布，点击/拖拽绘画、创作/硬件双视图、语音或文本创意、RGB565 双向转换与旧文件导入、最多 32 帧播放、拖拽排序、帧操作撤销、单帧时长、循环控制、项目 JSON、串口扫描、固件烧录、设备检查、灯板测试、完整部署和动画快速上传。页面可实时预览并导出 `animation.json`、设备配置、独立 MicroPython `main.py` 和 Arduino `.ino`。没有模型密钥时自动使用内置模板。

媒体转换支持图片、视频、动态 GIF 和 1–4 个字符，提供亮度、对比度与饱和度调整，并兼容 NeopixelMatrixTool 的 `{pixels,width,height,description,version}` RGB565 JSON。矩阵校准支持六种颜色顺序、翻转、旋转、Gamma 与 RGB 通道平衡。

Workshop 课前部署见 [WORKSHOP.md](WORKSHOP.md)，环境检查可运行 `scripts\workshop-check.ps1`。固件放置说明见 `firmware\README.md`。

## Cloudflare 部署

`frontend/functions` 提供 Pages Functions 云端 API，线上前端会调用 `/api/generate`；串口、烧录和 `mpremote` 仍由连接设备电脑上的本地 Helper 处理。

```powershell
cd frontend
npm run build
npx wrangler pages deploy dist --project-name pixelsky --branch main
```

云端动画生成使用 DeepSeek Chat Completions；没有密钥或接口暂时不可用时自动使用内置模板。密钥只写入 Cloudflare Secret，不提交到仓库：

```powershell
cd frontend
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name pixelsky
```

默认模型为 `deepseek-v4-flash`，可用 `DEEPSEEK_MODEL` 覆盖。本地 Helper 使用同名环境变量，也兼容原有的 `PIXELSKY_AI_BASE_URL`、`PIXELSKY_AI_API_KEY` 和 `PIXELSKY_AI_MODEL`。

`POST /api/generate` 优先理解中文自然语言，并返回 `pixelsky.animation.v1` 结构化动画。后端接受 AI 生成的 `#RRGGBB` 或 `[r,g,b]` 颜色，校验 RGB 范围，将每帧裁剪到所选画布像素数、最多保留 32 帧，并把亮度限制在 `0.2` 以内。响应同时保留前端直接使用的 `project` 字段；AI 不可用时返回可继续手绘编辑的备用像素帧。

## 技术依据

- NeopixelMatrixTool：https://github.com/FreakStudioCN/NeopixelMatrixTool
- MicroPython neopixel_matrix：https://github.com/FreakStudioCN/micropython-embedded/tree/main/middleware/display/neopixel_matrix
- MicroPython 固件：https://micropython.org/download/
- esptool：https://docs.espressif.com/projects/esptool/
- mpremote：https://docs.micropython.org/en/latest/reference/mpremote.html

AI 环境变量：`DEEPSEEK_API_KEY`；可选 `DEEPSEEK_MODEL`。高级兼容配置仍支持 `PIXELSKY_AI_BASE_URL`、`PIXELSKY_AI_API_KEY`、`PIXELSKY_AI_MODEL`。

硬件默认 GPIO2、GRB、右起逐列、亮度 0.2。两块 8×8 矩阵按一行串接，独立稳定供电并与 ESP32 共地；校准面板也可切换为逐行蛇形走线。

XIAO ESP32-C3 接线：`D0/GPIO2 → 首块 DI`，首块 `DO → 次块 DI`；两块矩阵的 `V` 接外置 5V，两块 `G`、电源负极和 XIAO `GND` 必须共地。完整运行时位于 `device/`，由本地 Helper 通过 `mpremote` 上传。

## 验证

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s helper -p 'test_*.py'
cd frontend; npm run build
```

真实串口和 LED 显示需连接硬件后验收；Helper 会拒绝上传到扫描列表之外的端口。
