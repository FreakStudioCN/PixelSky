"""Small WS2812 matrix driver for PixelSky's MicroPython runtime."""


def rgb565_to_rgb888(value):
    value = max(0, min(65535, int(value)))
    r5 = (value >> 11) & 0x1F
    g6 = (value >> 5) & 0x3F
    b5 = value & 0x1F
    return (r5 * 255 // 31, g6 * 255 // 63, b5 * 255 // 31)


def physical_index(x, y, width, module_width=8, layout="column-major-rtl"):
    """Map a coordinate to the selected wiring layout inside each module."""
    module_x = x // module_width
    module_y = y // module_width
    modules_per_row = (width + module_width - 1) // module_width
    local_x = x % module_width
    local_y = y % module_width
    module_index = module_y * modules_per_row + module_x
    if layout == "row-serpentine":
        if local_y % 2:
            local_x = module_width - 1 - local_x
        module_pixel = local_y * module_width + local_x
    else:
        # The target 8x8 board starts at its top-right LED and runs down
        # each column before continuing with the column to its left.
        module_pixel = (module_width - 1 - local_x) * module_width + local_y
    return module_index * module_width * module_width + module_pixel


class NeoPixelMatrix:
    def __init__(self, width, height, pin=2, module_width=8,
                 layout="column-major-rtl",
                 pixel_order="GRB", brightness=0.2, flip_h=False,
                 flip_v=False, rotate=0, gamma=1.0,
                 r_balance=1.0, g_balance=1.0, b_balance=1.0):
        from machine import Pin
        import neopixel

        self.width = int(width)
        self.height = int(height)
        self.count = self.width * self.height
        self.module_width = int(module_width)
        self.layout = layout if layout in ("column-major-rtl", "row-serpentine") else "column-major-rtl"
        self.flip_h = bool(flip_h)
        self.flip_v = bool(flip_v)
        self.rotate = int(rotate) if int(rotate) in (0, 90, 180, 270) else 0
        self.gamma = max(0.1, min(3.0, float(gamma)))
        self.brightness = max(0.0, min(0.2, float(brightness)))
        self.balance = (
            max(0.0, min(2.0, float(r_balance))),
            max(0.0, min(2.0, float(g_balance))),
            max(0.0, min(2.0, float(b_balance))),
        )
        order = str(pixel_order).upper()
        if sorted(order) != ["B", "G", "R"]:
            order = "GRB"
        self.pixels = neopixel.NeoPixel(Pin(int(pin), Pin.OUT), self.count)
        self.pixels.ORDER = tuple("RGB".index(channel) for channel in order)

    def _transform(self, x, y):
        if self.flip_h:
            x = self.width - 1 - x
        if self.flip_v:
            y = self.height - 1 - y
        physical_width = self.width
        if self.rotate == 90:
            x, y = self.height - 1 - y, x
            physical_width = self.height
        elif self.rotate == 180:
            x, y = self.width - 1 - x, self.height - 1 - y
        elif self.rotate == 270:
            x, y = y, self.width - 1 - x
            physical_width = self.height
        return x, y, physical_width

    def _correct(self, color):
        corrected = []
        for index, channel in enumerate(color):
            normalized = max(0.0, min(1.0, float(channel) / 255.0))
            value = int((normalized ** self.gamma) * 255 * self.brightness * self.balance[index])
            corrected.append(max(0, min(255, value)))
        return tuple(corrected)

    def show_rgb565(self, values):
        for logical_index in range(self.count):
            value = values[logical_index] if logical_index < len(values) else 0
            x = logical_index % self.width
            y = logical_index // self.width
            px, py, physical_width = self._transform(x, y)
            index = physical_index(px, py, physical_width, self.module_width, self.layout)
            if 0 <= index < self.count:
                self.pixels[index] = self._correct(rgb565_to_rgb888(value))
        self.pixels.write()

    def clear(self):
        self.pixels.fill((0, 0, 0))
        self.pixels.write()
