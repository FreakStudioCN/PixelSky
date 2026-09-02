import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
from fastapi.middleware.cors import CORSMiddleware
import main as helper_main
from main import Project, animation, app, build_firmware_plan, config, firmware_target, parse_firmware_page, save_firmware

class MainTests(unittest.TestCase):
    def project(self):
        return Project(width=8, height=8, frames=[['#000000'] * 64], pin=4, pixel_order='RGB', flip_h=True, rotate=90, gamma=2.2, r_balance=.9)

    def test_hardware_config(self):
        data = config(self.project())
        self.assertEqual(data['board'], 'xiao_esp32c3')
        self.assertEqual(data['pin'], 4)
        self.assertEqual(data['pixel_order'], 'RGB')
        self.assertTrue(data['flip_h'])
        self.assertEqual(data['rotate'], 90)
        self.assertEqual(data['gamma'], 2.2)

    def test_row_major_layout_is_accepted_and_exported(self):
        project = Project(width=16, height=8, frames=[['#000000'] * 128], matrix_layout='row-major')
        self.assertEqual(config(project)['matrix_layout'], 'row-major')
        self.assertEqual(animation(project)['mapping'], 'row-major')

    def test_esp32_wroom_profile(self):
        project = Project(width=8, height=8, frames=[['#000000'] * 64], board='esp32_wroom', pin=5)
        data = config(project)
        self.assertEqual(data['board'], 'esp32_wroom')
        self.assertEqual(data['pin'], 5)
        self.assertEqual(firmware_target('esp32'), ('esp32', '0x1000'))

    def test_esp32c3_supermini_profile(self):
        project = Project(width=8, height=8, frames=[['#000000'] * 64], board='esp32c3_supermini', pin=8)
        data = config(project)
        self.assertEqual(data['board'], 'esp32c3_supermini')
        self.assertEqual(data['pin'], 8)
        self.assertEqual(firmware_target('esp32c3'), ('esp32c3', '0x0'))

    def test_firmware_offsets(self):
        self.assertEqual(firmware_target('esp32'), ('esp32', '0x1000'))
        self.assertEqual(firmware_target('esp32s2'), ('esp32s2', '0x1000'))
        self.assertEqual(firmware_target('esp32s3'), ('esp32s3', '0x0'))
        self.assertEqual(firmware_target('esp32c3'), ('esp32c3', '0x0'))

    def test_official_firmware_page_is_parsed(self):
        page = '''
        <code>esptool.py --baud 460800 write_flash 0 ESP32_BOARD_NAME-DATE-VERSION.bin</code>
        <a href="/resources/firmware/ESP32_GENERIC_C3-20260901-v1.30.0-preview.1.bin">preview</a>
        <a href="/resources/firmware/ESP32_GENERIC_C3-20260824-v1.29.0.bin">latest stable</a>
        '''
        data = parse_firmware_page('esp32c3', page)
        self.assertEqual(data['version'], 'v1.29.0')
        self.assertEqual(data['release_date'], '2026-08-24')
        self.assertEqual(data['write_offset'], '0x0')
        self.assertEqual(data['baud'], 460800)
        self.assertTrue(data['url'].endswith('/ESP32_GENERIC_C3-20260824-v1.29.0.bin'))

    def test_cached_firmware_builds_plan_from_parsed_metadata(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(helper_main, 'CACHE_ROOT', Path(folder)), patch.object(helper_main, 'esptool_command_names', return_value=('erase-flash', 'write-flash')):
            metadata = {
                'chip': 'esp32c3', 'board': 'ESP32_GENERIC_C3', 'page_url': 'https://micropython.org/download/ESP32_GENERIC_C3/',
                'url': 'https://micropython.org/resources/firmware/test.bin', 'filename': 'test.bin', 'version': 'v1.29.0',
                'release_date': '2026-08-24', 'baud': 460800, 'write_offset': '0x0',
            }
            saved = save_firmware('esp32c3', metadata, b'firmware-data')
            plan = build_firmware_plan('COM88', 'esp32c3')
            self.assertTrue(saved['cached'])
            self.assertEqual(plan['port'], 'COM88')
            self.assertEqual(plan['write_offset'], '0x0')
            self.assertTrue(plan['confirmed_required'])
            self.assertEqual(plan['write_command'], 'write-flash')

    def test_cloud_page_can_reach_private_network_helper(self):
        cors = next(middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware)
        self.assertTrue(cors.kwargs['allow_private_network'])
        self.assertIn('https://pixelsky.pages.dev', cors.kwargs['allow_origins'])

    def test_animation_durations(self):
        project = self.project()
        data = animation(project)
        self.assertTrue(data['loop'])
        self.assertAlmostEqual(data['brightness'], .04)
        self.assertEqual(data['frames'][0]['name'], '帧 01')
        self.assertEqual(data['frames'][0]['duration_ms'], 200)
        self.assertEqual(len(data['frames'][0]['pixels']), 64)

    def test_animation_keeps_frame_names_and_limits_brightness(self):
        project = Project(width=8, height=8, brightness=.8, frames=[['#ffffff'] * 64], frame_names=['眨眼'])
        data = animation(project)
        self.assertAlmostEqual(data['brightness'], .16)
        self.assertEqual(data['frames'][0]['name'], '眨眼')

    def test_minimum_frame_duration(self):
        project = Project(width=8, height=8, fps=10, frames=[['#000000'] * 64], frame_durations=[20], loop=False)
        self.assertEqual(project.frame_durations, [100])
        self.assertFalse(project.loop)

if __name__ == '__main__': unittest.main()
