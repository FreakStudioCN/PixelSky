# MicroPython 固件目录

PixelSky 默认不捆绑固件。在 Web 页的“连接 ESP32”区域选择实际开发板后，“课前检查与快速部署”会自动匹配固件。点击“获取官方 latest 固件”后，本地 Helper 会从对应的 MicroPython 官方页面解析稳定版 `.bin`、发布日期、baud 和写入 offset，下载到用户缓存并进行 SHA-256 校验。

页面会在烧录前显示固件、串口和写入计划。用户必须明确勾选擦除确认，Helper 才会先擦除 Flash、再使用页面解析出的参数写入固件，并将烧录日志保存到缓存目录。不能联网时仍可展开“离线备用”，手动选择与芯片匹配的 `.bin`。

- XIAO ESP32-C3 → `ESP32_GENERIC_C3`：https://micropython.org/download/ESP32_GENERIC_C3/
- ESP32-C3 SuperMini → `ESP32_GENERIC_C3`：https://micropython.org/download/ESP32_GENERIC_C3/
- ESP32 WROOM / WROOM-32 → `ESP32_GENERIC`：https://micropython.org/download/ESP32_GENERIC/

开发板选项会预设灯板数据 GPIO：XIAO 为 GPIO2、SuperMini 为 GPIO8、WROOM 为 GPIO5。GPIO 并非固定绑定，实际接线不同时可在校准区域修改。

烧录后点击“上传完整运行时”会写入：

- `/main.py`
- `/pixelsky/pixelsky_runtime.py`
- `/pixelsky/neopixel_matrix.py`
- `/pixelsky/config.json`
- `/pixelsky/animation.json`

运行时支持 8×8、16×8、16×16，模块按行优先串联。目标 8×8 板默认采用从右向左逐列、每列从上到下的走线，同时保留逐行蛇形选项；支持 RGB565、多帧时长、亮度上限 0.2、色序、Gamma、通道平衡、翻转和旋转。
