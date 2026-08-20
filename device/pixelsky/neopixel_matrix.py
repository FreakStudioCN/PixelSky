from machine import Pin
import framebuf
import json
import neopixel

class NeoPixelMatrix(framebuf.FrameBuffer):
    ORDERS = ('RGB', 'GRB', 'BGR', 'BRG', 'RBG', 'GBR')

    def __init__(self, width=16, height=8, pin=2, snake=True, order='GRB', module_width=8,
                 flip_h=False, flip_v=False, rotate=0, gamma=1.0,
                 r_balance=1.0, g_balance=1.0, b_balance=1.0):
        if width < 1 or height < 1:
            raise ValueError('invalid matrix size')
        if order not in self.ORDERS:
            raise ValueError('invalid pixel order')
        if rotate not in (0, 90, 180, 270):
            raise ValueError('invalid rotation')
        self.width = width
        self.height = height
        self.snake = snake
        self.order = order
        self.module_width = module_width
        self.flip_h = flip_h
        self.flip_v = flip_v
        self.rotate = rotate
        self.gamma = max(.1, gamma)
        self.r_balance = r_balance
        self.g_balance = g_balance
        self.b_balance = b_balance
        self.buffer = bytearray(width * height * 2)
        self.strip = neopixel.NeoPixel(Pin(pin, Pin.OUT), width * height)
        super().__init__(self.buffer, width, height, framebuf.RGB565)

    def index(self, x, y):
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
        size = self.module_width
        modules_per_row = (physical_width + size - 1) // size
        module_x, module_y = x // size, y // size
        local_x, local_y = x % size, y % size
        module_index = module_y * modules_per_row + module_x
        if self.snake and local_y % 2:
            local_x = size - 1 - local_x
        return module_index * size * size + local_y * size + local_x

    def rgb(self, value, brightness):
        r = ((value >> 11) & 31) * 255 / 31
        g = ((value >> 5) & 63) * 255 / 63
        b = (value & 31) * 255 / 31
        exponent = 1.0 / self.gamma
        r = max(0, min(255, int(255 * ((r / 255) ** exponent) * brightness * self.r_balance)))
        g = max(0, min(255, int(255 * ((g / 255) ** exponent) * brightness * self.g_balance)))
        b = max(0, min(255, int(255 * ((b / 255) ** exponent) * brightness * self.b_balance)))
        values = {'R': r, 'G': g, 'B': b}
        return tuple(values[channel] for channel in self.order)

    def show(self, brightness=.2, x1=0, y1=0, x2=None, y2=None):
        x2 = self.width - 1 if x2 is None else x2
        y2 = self.height - 1 if y2 is None else y2
        if not (0 <= x1 <= x2 < self.width and 0 <= y1 <= y2 < self.height):
            raise ValueError('invalid refresh area')
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                self.strip[self.index(x, y)] = self.rgb(self.pixel(x, y), brightness)
        self.strip.write()

    def show_frame(self, values, brightness=.2):
        if len(values) != self.width * self.height:
            raise ValueError('invalid frame length')
        for index, value in enumerate(values):
            self.pixel(index % self.width, index // self.width, value)
        self.show(brightness)

    def show_rgb565_image(self, data, offset_x=0, offset_y=0, brightness=.2):
        if isinstance(data, str):
            data = json.loads(data)
        pixels = data.get('pixels')
        image_width = data.get('width', self.width)
        if not isinstance(pixels, list) or image_width < 1:
            raise ValueError('invalid RGB565 image')
        for index, color in enumerate(pixels):
            x, y = index % image_width + offset_x, index // image_width + offset_y
            if 0 <= x < self.width and 0 <= y < self.height and 0 <= color <= 0xffff:
                self.pixel(x, y, color)
        self.show(brightness)

    def load_rgb565_image(self, filename, offset_x=0, offset_y=0, brightness=.2):
        with open(filename, 'r') as source:
            self.show_rgb565_image(json.load(source), offset_x, offset_y, brightness)

    def clear(self):
        self.fill(0)
        self.show(0)
