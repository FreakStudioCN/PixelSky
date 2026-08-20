# MicroPython 固件目录

将适用于目标 ESP32 型号的官方 MicroPython `.bin` 放在本目录。PixelSky 不固定捆绑某个硬件版本的固件，以避免误刷不同芯片。

在 Web 页的 **Workshop Deploy** 区域选择该文件和芯片型号后，可执行擦除和烧录。ESP32 Generic 与 ESP32-S2 使用 `0x1000`，ESP32-S3 与 ESP32-C3 使用 `0x0`。固件必须与所选芯片一致。

- ESP32：https://micropython.org/download/ESP32_GENERIC/
- ESP32-S2：https://micropython.org/download/ESP32_GENERIC_S2/
- ESP32-S3：https://micropython.org/download/ESP32_GENERIC_S3/
- ESP32-C3：https://micropython.org/download/ESP32_GENERIC_C3/

XIAO ESP32-C3 建议使用板级固件：https://micropython.org/download/SEEED_XIAO_ESP32C3/

烧录后点击“上传完整运行时”会写入：

- `/main.py`
- `/pixelsky/pixelsky_runtime.py`
- `/pixelsky/neopixel_matrix.py`
- `/pixelsky/config.json`
- `/pixelsky/animation.json`

运行时支持 8×8、16×8、16×16，模块按行优先串联，每块 8×8 内部蛇形排列；支持 RGB565、多帧时长、亮度上限 0.2、色序、Gamma、通道平衡、翻转和旋转。
