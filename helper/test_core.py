import unittest
from core import fallback_frames, hardware_index, mapped_hardware_index, hex_to_rgb565, rgb565_to_hex, validate_frames

class Tests(unittest.TestCase):
    def test_rgb565(self):
        self.assertEqual(hex_to_rgb565('#FF0000'), 0xF800)
        self.assertEqual(hex_to_rgb565('#00FF00'), 0x07E0)
        self.assertEqual(hex_to_rgb565('#0000FF'), 0x001F)
        self.assertEqual(rgb565_to_hex(0xF800), '#FF0000')

    def test_dynamic_frames(self):
        for width, height in ((8, 8), (16, 8), (16, 16)):
            frames = fallback_frames('一颗爱心', width=width, height=height)
            self.assertEqual(len(frames), 4)
            self.assertTrue(all(len(frame) == width * height for frame in frames))
            self.assertEqual(validate_frames(frames, width, height), frames)

    def test_module_mapping(self):
        self.assertEqual(hardware_index(7, 0, 16), 0)
        self.assertEqual(hardware_index(7, 7, 16), 7)
        self.assertEqual(hardware_index(6, 0, 16), 8)
        self.assertEqual(hardware_index(15, 0, 16), 64)
        self.assertEqual(hardware_index(14, 0, 16), 72)
        self.assertEqual(hardware_index(0, 8, 16), 184)
        self.assertEqual(mapped_hardware_index(0, 0, 16, 8, flip_h=True), 64)
        self.assertEqual(mapped_hardware_index(0, 0, 8, 8, rotate=90), 0)

    def test_invalid(self):
        with self.assertRaises(ValueError):
            validate_frames([['#000000']], 16, 8)

    def test_supports_32_frames(self):
        frame = ['#000000'] * 64
        self.assertEqual(len(validate_frames([frame] * 32, 8, 8)), 32)
        with self.assertRaises(ValueError):
            validate_frames([frame] * 33, 8, 8)

if __name__ == '__main__':
    unittest.main()
