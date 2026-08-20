import unittest

from device.pixelsky.neopixel_matrix import physical_index, rgb565_to_rgb888


class DeviceMatrixTests(unittest.TestCase):
    def test_target_board_column_mapping(self):
        self.assertEqual(physical_index(7, 0, 8), 0)
        self.assertEqual(physical_index(7, 7, 8), 7)
        self.assertEqual(physical_index(6, 0, 8), 8)
        self.assertEqual(physical_index(0, 7, 8), 63)

    def test_horizontal_and_four_module_order(self):
        self.assertEqual(physical_index(15, 0, 16), 64)
        self.assertEqual(physical_index(14, 0, 16), 72)
        self.assertEqual(physical_index(0, 8, 16), 184)

    def test_legacy_row_serpentine_mapping(self):
        self.assertEqual(physical_index(0, 0, 8, layout='row-serpentine'), 0)
        self.assertEqual(physical_index(0, 1, 8, layout='row-serpentine'), 15)

    def test_rgb565_conversion(self):
        self.assertEqual(rgb565_to_rgb888(0xF800), (255, 0, 0))
        self.assertEqual(rgb565_to_rgb888(0x07E0), (0, 255, 0))
        self.assertEqual(rgb565_to_rgb888(0x001F), (0, 0, 255))


if __name__ == '__main__':
    unittest.main()
