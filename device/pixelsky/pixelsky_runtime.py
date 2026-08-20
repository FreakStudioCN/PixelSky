import gc
import json
import time
from pixelsky.neopixel_matrix import NeoPixelMatrix

def load(path):
    with open(path, 'r') as source:
        return json.load(source)

def run():
    config = load('pixelsky/config.json')
    animation = load('pixelsky/animation.json')
    matrix = NeoPixelMatrix(
        config.get('width', 16), config.get('height', 8), config.get('pin', 2),
        config.get('snake', True), config.get('pixel_order', 'GRB'), config.get('module_width', 8),
        config.get('flip_h', False), config.get('flip_v', False), config.get('rotate', 0),
        config.get('gamma', 1.0), config.get('r_balance', 1.0),
        config.get('g_balance', 1.0), config.get('b_balance', 1.0),
    )
    frames = animation.get('frames', [])
    fps = max(1, animation.get('fps', config.get('fps', 5)))
    brightness = animation.get('brightness', config.get('brightness', .2))
    loop = animation.get('loop', True)
    if not frames:
        matrix.clear()
        return
    while True:
        for item in frames:
            frame = item.get('pixels', []) if isinstance(item, dict) else item
            duration_ms = max(100, item.get('duration_ms', 1000 // fps)) if isinstance(item, dict) else max(100, 1000 // fps)
            if len(frame) == matrix.width * matrix.height:
                matrix.show_frame(frame, brightness)
            time.sleep_ms(duration_ms)
        if not loop:
            break
        gc.collect()
