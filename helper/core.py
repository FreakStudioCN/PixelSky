from __future__ import annotations
import math

MAX_FRAMES = 32
SUPPORTED_SIZES = {(8, 8), (16, 8), (16, 16)}

def normalize_hex(value: str) -> str:
    value = value.upper()
    if len(value) != 7 or not value.startswith('#') or any(c not in '0123456789ABCDEF' for c in value[1:]):
        raise ValueError(f'invalid color: {value}')
    return value

def hex_to_rgb565(value: str) -> int:
    n = int(normalize_hex(value)[1:], 16)
    r, g, b = (n >> 16) & 255, (n >> 8) & 255, n & 255
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)

def rgb565_to_hex(value: int) -> str:
    value = max(0, min(0xffff, int(value)))
    r = round(((value >> 11) & 31) * 255 / 31)
    g = round(((value >> 5) & 63) * 255 / 63)
    b = round((value & 31) * 255 / 31)
    return f'#{r:02X}{g:02X}{b:02X}'

def validate_size(width: int, height: int) -> None:
    if (width, height) not in SUPPORTED_SIZES:
        raise ValueError('size must be 8x8, 16x8 or 16x16')

def validate_frames(frames, width: int = 16, height: int = 8) -> list[list[str]]:
    validate_size(width, height)
    out = [list(f) for f in frames]
    if not 1 <= len(out) <= MAX_FRAMES:
        raise ValueError('frames must contain 1..32 frames')
    pixels = width * height
    if any(len(f) != pixels for f in out):
        raise ValueError(f'every frame must contain exactly {pixels} pixels')
    return [[normalize_hex(c) for c in f] for f in out]

def hardware_index(x: int, y: int, width: int, module_size: int = 8, layout: str = 'column-major-rtl') -> int:
    if layout == 'row-major':
        return y * width + x
    modules_per_row = (width + module_size - 1) // module_size
    module_x, module_y = x // module_size, y // module_size
    local_x, local_y = x % module_size, y % module_size
    module_index = module_y * modules_per_row + module_x
    if layout == 'row-serpentine':
        module_pixel = local_y * module_size + (module_size - 1 - local_x if local_y % 2 else local_x)
    else:
        module_pixel = (module_size - 1 - local_x) * module_size + local_y
    return module_index * module_size * module_size + module_pixel

def mapped_hardware_index(x: int, y: int, width: int, height: int, flip_h=False, flip_v=False, rotate=0, layout='column-major-rtl') -> int:
    if flip_h: x = width - 1 - x
    if flip_v: y = height - 1 - y
    physical_width = width
    if rotate == 90:
        x, y, physical_width = height - 1 - y, x, height
    elif rotate == 180:
        x, y = width - 1 - x, height - 1 - y
    elif rotate == 270:
        x, y, physical_width = y, width - 1 - x, height
    return hardware_index(x, y, physical_width, layout=layout)

def fallback_frames(prompt: str, count: int = 4, width: int = 16, height: int = 8) -> list[list[str]]:
    validate_size(width, height)
    pixels = width * height
    bg, mint, purple, pink, yellow, blue = '#000000', '#31F5C3', '#9B7BFF', '#FF5A9D', '#FFCB5C', '#52B7FF'
    frames = [[bg] * pixels for _ in range(max(1, min(MAX_FRAMES, count)))]
    low = prompt.lower()
    if '爱心' in prompt or 'heart' in low:
        cx, cy = width // 2, height // 2
        points = [(-3,-1),(-2,-2),(-1,-1),(0,-1),(1,-2),(2,-1),(-4,0),(3,0),(-3,1),(2,1),(-2,2),(1,2),(-1,3),(0,3)]
        for i, frame in enumerate(frames):
            for dx, dy in points:
                x, y = cx + dx, cy + dy
                if 0 <= x < width and 0 <= y < height: frame[y * width + x] = pink if i % 2 == 0 else purple
    elif '彩虹' in prompt or 'rainbow' in low:
        colors = [pink, yellow, mint, blue, purple]
        for i, frame in enumerate(frames):
            for x in range(width):
                y = (int((height - 2) - max(1, height / 3) * math.sin(math.pi * x / max(1, width - 1))) + i) % height
                frame[y * width + x] = colors[x % 5]
    elif '笑' in prompt or 'smile' in low:
        for frame in frames:
            for x, y in [(width//3,height//3),(width*2//3,height//3),(width//4,height*2//3),(width*3//4,height*2//3),(width//2,height*3//4)]:
                frame[min(height-1,y) * width + min(width-1,x)] = yellow
    else:
        for i, frame in enumerate(frames):
            head = (i * max(2, width // 4)) % (width + 5) - 4
            for tail in range(6):
                x = head - tail
                y = height // 4 + ((x + tail) // 4) % max(2, height // 2)
                if 0 <= x < width and 0 <= y < height: frame[y * width + x] = ['#FFFFFF', mint, blue, purple, pink, yellow][tail]
    return frames
