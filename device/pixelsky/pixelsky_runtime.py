"""Load PixelSky JSON files and continuously play them on the LED matrix."""

try:
    import ujson as json
except ImportError:
    import json

import gc
import time

from pixelsky.neopixel_matrix import NeoPixelMatrix


CONFIG_PATH = "/pixelsky/config.json"
ANIMATION_PATH = "/pixelsky/animation.json"


def _load(path):
    with open(path, "r") as handle:
        return json.load(handle)


def _number(value, fallback):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def run():
    config = _load(CONFIG_PATH)
    animation = _load(ANIMATION_PATH)
    width = int(config.get("width", animation.get("width", 16)))
    height = int(config.get("height", animation.get("height", 8)))
    if (width, height) not in ((8, 8), (16, 8), (16, 16)):
        raise ValueError("unsupported PixelSky matrix size")

    # JSON-only updates must be able to change brightness without redeploying
    # config. The animation value is authoritative but remains capped at 20%.
    safe_brightness = min(
        0.2,
        max(0.0, _number(animation.get("brightness", config.get("brightness", 0.04)), 0.04)),
    )
    matrix = NeoPixelMatrix(
        width=width,
        height=height,
        pin=int(config.get("pin", 2)),
        module_width=int(config.get("module_width", 8)),
        # Animation-only uploads include the current Web layout as `mapping`.
        # Prefer it so changing panel type does not require a full redeploy.
        layout=animation.get("mapping", config.get("matrix_layout", "column-major-rtl")),
        pixel_order=config.get("pixel_order", "GRB"),
        brightness=safe_brightness,
        flip_h=config.get("flip_h", False),
        flip_v=config.get("flip_v", False),
        rotate=int(config.get("rotate", 0)),
        gamma=_number(config.get("gamma", 1.0), 1.0),
        r_balance=_number(config.get("r_balance", 1.0), 1.0),
        g_balance=_number(config.get("g_balance", 1.0), 1.0),
        b_balance=_number(config.get("b_balance", 1.0), 1.0),
    )
    frames = animation.get("frames", [])[:32]
    if not frames:
        matrix.clear()
        raise ValueError("animation has no frames")
    fallback_duration = max(100, int(1000 / max(1, int(animation.get("fps", 5)))))
    loop = animation.get("loop", True) is not False
    gc.collect()

    while True:
        for frame in frames:
            pixels = frame.get("pixels", []) if isinstance(frame, dict) else frame
            matrix.show_rgb565(pixels)
            duration = frame.get("duration_ms", fallback_duration) if isinstance(frame, dict) else fallback_duration
            time.sleep_ms(max(100, int(duration)))
        if not loop:
            while True:
                time.sleep_ms(1000)
