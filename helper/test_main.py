import unittest
from main import Project, animation, config, firmware_target

class MainTests(unittest.TestCase):
    def project(self):
        return Project(width=8, height=8, frames=[['#000000'] * 64], pin=4, pixel_order='RGB', flip_h=True, rotate=90, gamma=2.2, r_balance=.9)

    def test_hardware_config(self):
        data = config(self.project())
        self.assertEqual(data['pin'], 4)
        self.assertEqual(data['pixel_order'], 'RGB')
        self.assertTrue(data['flip_h'])
        self.assertEqual(data['rotate'], 90)
        self.assertEqual(data['gamma'], 2.2)

    def test_firmware_offsets(self):
        self.assertEqual(firmware_target('esp32'), ('esp32', '0x1000'))
        self.assertEqual(firmware_target('esp32s2'), ('esp32s2', '0x1000'))
        self.assertEqual(firmware_target('esp32s3'), ('esp32s3', '0x0'))
        self.assertEqual(firmware_target('esp32c3'), ('esp32c3', '0x0'))

    def test_animation_durations(self):
        project = self.project()
        data = animation(project)
        self.assertTrue(data['loop'])
        self.assertEqual(data['brightness'], .2)
        self.assertEqual(data['frames'][0]['name'], '帧 01')
        self.assertEqual(data['frames'][0]['duration_ms'], 200)
        self.assertEqual(len(data['frames'][0]['pixels']), 64)

    def test_animation_keeps_frame_names_and_limits_brightness(self):
        project = Project(width=8, height=8, brightness=.8, frames=[['#ffffff'] * 64], frame_names=['眨眼'])
        data = animation(project)
        self.assertEqual(data['brightness'], .2)
        self.assertEqual(data['frames'][0]['name'], '眨眼')

    def test_minimum_frame_duration(self):
        project = Project(width=8, height=8, fps=10, frames=[['#000000'] * 64], frame_durations=[20], loop=False)
        self.assertEqual(project.frame_durations, [100])
        self.assertFalse(project.loop)

if __name__ == '__main__': unittest.main()
