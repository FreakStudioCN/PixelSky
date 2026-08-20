# MicroPython 固件目录

将适用于目标 ESP32 型号的官方 MicroPython `.bin` 放在本目录。PixelSky 不固定捆绑某个硬件版本的固件，以避免误刷不同芯片。

在 Web 页的 **Workshop Deploy** 区域选择该文件和芯片型号后，可执行擦除和烧录。ESP32 Generic 与 ESP32-S2 使用 `0x1000`，ESP32-S3 与 ESP32-C3 使用 `0x0`。固件必须与所选芯片一致。

- ESP32：https://micropython.org/download/ESP32_GENERIC/
- ESP32-S2：https://micropython.org/download/ESP32_GENERIC_S2/
- ESP32-S3：https://micropython.org/download/ESP32_GENERIC_S3/
- ESP32-C3：https://micropython.org/download/ESP32_GENERIC_C3/
