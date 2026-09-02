from __future__ import annotations
import json
import hashlib
import html
import importlib.util
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from urllib.parse import urljoin

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
import serial.tools.list_ports

from core import fallback_frames, hex_to_rgb565, validate_frames, validate_size

ROOT = Path(__file__).resolve().parents[1]
DEVICE = ROOT / 'device'
CACHE_ROOT = Path(os.getenv('PIXELSKY_CACHE_DIR') or (Path(os.getenv('LOCALAPPDATA', Path.home())) / 'PixelSkyHelper' / 'cache'))
FIRMWARE_BOARDS = {
    'esp32': {'board': 'ESP32_GENERIC', 'page_url': 'https://micropython.org/download/ESP32_GENERIC/', 'esptool_chip': 'esp32', 'fallback_offset': '0x1000'},
    'esp32s2': {'board': 'ESP32_GENERIC_S2', 'page_url': 'https://micropython.org/download/ESP32_GENERIC_S2/', 'esptool_chip': 'esp32s2', 'fallback_offset': '0x1000'},
    'esp32s3': {'board': 'ESP32_GENERIC_S3', 'page_url': 'https://micropython.org/download/ESP32_GENERIC_S3/', 'esptool_chip': 'esp32s3', 'fallback_offset': '0x0'},
    'esp32c3': {'board': 'ESP32_GENERIC_C3', 'page_url': 'https://micropython.org/download/ESP32_GENERIC_C3/', 'esptool_chip': 'esp32c3', 'fallback_offset': '0x0'},
}
FirmwareChip = Literal['esp32', 'esp32s2', 'esp32s3', 'esp32c3']
app = FastAPI(title='PixelSky Local Helper', version='0.7.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://127.0.0.1:5173', 'http://localhost:5173', 'https://pixelsky.pages.dev'],
    allow_origin_regex=r'https://([a-z0-9-]+\.)?pixelsky\.pages\.dev',
    allow_methods=['GET', 'POST'],
    allow_headers=['*'],
    allow_private_network=True,
)

class Project(BaseModel):
    version: int = 1
    name: str = Field(default='PixelSky', max_length=100)
    width: int = 16
    height: int = 8
    fps: int = Field(default=5, ge=1, le=10)
    brightness: float = Field(default=.2, ge=.01, le=1)
    frames: list[list[str]]
    frame_durations: list[int] = Field(default_factory=list)
    frame_names: list[str] = Field(default_factory=list)
    loop: bool = True
    board: Literal['xiao_esp32c3', 'esp32c3_supermini', 'esp32_wroom'] = 'xiao_esp32c3'
    pin: int = Field(default=2, ge=0, le=48)
    pixel_order: Literal['RGB', 'GRB', 'BGR', 'BRG', 'RBG', 'GBR'] = 'GRB'
    matrix_layout: Literal['column-major-rtl', 'row-serpentine', 'row-major'] = 'column-major-rtl'
    flip_h: bool = False
    flip_v: bool = False
    rotate: Literal[0, 90, 180, 270] = 0
    gamma: float = Field(default=1, ge=.1, le=3)
    r_balance: float = Field(default=1, ge=0, le=2)
    g_balance: float = Field(default=1, ge=0, le=2)
    b_balance: float = Field(default=1, ge=0, le=2)

    @model_validator(mode='after')
    def valid_project(self):
        validate_size(self.width, self.height)
        self.frames = validate_frames(self.frames, self.width, self.height)
        fallback = max(100, round(1000 / self.fps))
        self.frame_durations = [max(100, round(self.frame_durations[index])) if index < len(self.frame_durations) else fallback for index in range(len(self.frames))]
        self.frame_names = [(self.frame_names[index].strip()[:24] if index < len(self.frame_names) and self.frame_names[index].strip() else f'帧 {index + 1:02d}') for index in range(len(self.frames))]
        return self

class UploadRequest(BaseModel):
    port: str = Field(min_length=3, max_length=100)
    project: Project

class PortRequest(BaseModel):
    port: str = Field(min_length=3, max_length=100)

class LedTestRequest(PortRequest):
    pin: int = Field(default=2, ge=0, le=48)
    count: int = Field(default=128, ge=1, le=256)

class FirmwareRequest(BaseModel):
    chip: FirmwareChip = 'esp32'

class FirmwarePlanRequest(FirmwareRequest, PortRequest):
    pass

class FirmwareFlashRequest(FirmwarePlanRequest):
    confirmed: bool = False

class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=180)
    width: int = 16
    height: int = 8
    fps: int = Field(default=5, ge=1, le=10)
    brightness: float = Field(default=.2, ge=.01, le=1)

    @model_validator(mode='after')
    def valid_size(self):
        validate_size(self.width, self.height)
        return self

def animation(project: Project):
    return {'version': 1, 'width': project.width, 'height': project.height, 'fps': project.fps, 'brightness': min(.2, project.brightness * .2), 'brightness_scale': 'safe-20-percent', 'loop': project.loop, 'format': 'RGB565', 'module_width': 8, 'mapping': project.matrix_layout, 'frames': [{'name': project.frame_names[index], 'duration_ms': project.frame_durations[index], 'pixels': [hex_to_rgb565(color) for color in frame]} for index, frame in enumerate(project.frames)]}

def config(project: Project):
    return {'board': project.board, 'width': project.width, 'height': project.height, 'pin': project.pin, 'pixel_order': project.pixel_order, 'matrix_layout': project.matrix_layout, 'module_width': 8, 'module_order': 'row-major', 'flip_h': project.flip_h, 'flip_v': project.flip_v, 'rotate': project.rotate, 'gamma': project.gamma, 'r_balance': project.r_balance, 'g_balance': project.g_balance, 'b_balance': project.b_balance, 'brightness': min(.2, project.brightness * .2), 'fps': project.fps}

def available_ports():
    return {port.device: port for port in serial.tools.list_ports.comports()}

def ensure_port(port: str):
    if port not in available_ports():
        raise HTTPException(400, '所选串口不存在，请重新扫描')

def run_process(args: list[str], timeout: int = 90):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, '设备操作超时，请检查 USB 连接')
    output = '\n'.join(part.strip() for part in (result.stdout, result.stderr) if part and part.strip())
    if result.returncode:
        raise HTTPException(500, output[-1200:] or '设备命令执行失败')
    return output

def firmware_board(chip: str):
    if chip not in FIRMWARE_BOARDS:
        raise ValueError('unsupported ESP chip')
    return FIRMWARE_BOARDS[chip]

def fetch_url(url: str) -> bytes:
    request = urllib.request.Request(url, headers={'User-Agent': 'PixelSky-Helper/0.7'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read(32 * 1024 * 1024 + 1)
    except Exception as error:
        raise HTTPException(502, f'无法访问 MicroPython 官方服务：{error}')
    if not payload or len(payload) > 32 * 1024 * 1024:
        raise HTTPException(502, '官方固件响应为空或超过 32MB')
    return payload

def parse_firmware_page(chip: str, page_html: str):
    target = firmware_board(chip)
    decoded = html.unescape(page_html)
    command = re.search(r'--baud\s+(\d+)\s+write[_-]flash\s+(0x[0-9a-fA-F]+|\d+)\s+', decoded)
    if not command:
        raise ValueError('官方页面中未找到固件烧录命令')
    board = target['board']
    link = re.search(r'href=["\']([^"\']*/resources/firmware/' + re.escape(board) + r'-([0-9]{8})-(v[0-9]+\.[0-9]+(?:\.[0-9]+)?)\.bin)["\']', decoded)
    if not link:
        raise ValueError('官方页面中未找到 latest 稳定版 .bin 固件')
    release_date = datetime.strptime(link.group(2), '%Y%m%d').date().isoformat()
    return {
        'chip': chip,
        'board': board,
        'page_url': target['page_url'],
        'url': urljoin(target['page_url'], link.group(1)),
        'filename': Path(link.group(1)).name,
        'version': link.group(3),
        'release_date': release_date,
        'baud': int(command.group(1)),
        'write_offset': hex(int(command.group(2), 0)),
    }

def resolve_firmware(chip: str):
    target = firmware_board(chip)
    try:
        return parse_firmware_page(chip, fetch_url(target['page_url']).decode('utf-8'))
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(502, f'无法解析 MicroPython 官方固件页：{error}')

def firmware_metadata_path(chip: str):
    return CACHE_ROOT / 'firmware' / f'{chip}.json'

def save_firmware(chip: str, metadata: dict, payload: bytes):
    folder = CACHE_ROOT / 'firmware'
    folder.mkdir(parents=True, exist_ok=True)
    firmware_path = folder / metadata['filename']
    firmware_path.write_bytes(payload)
    saved = {**metadata, 'size': len(payload), 'sha256': hashlib.sha256(payload).hexdigest(), 'cached': True}
    firmware_metadata_path(chip).write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding='utf-8')
    return saved

def cached_firmware(chip: str):
    metadata_file = firmware_metadata_path(chip)
    if not metadata_file.is_file():
        raise HTTPException(409, '尚未缓存该芯片的官方固件，请先下载')
    try:
        metadata = json.loads(metadata_file.read_text(encoding='utf-8'))
        firmware_path = metadata_file.parent / Path(metadata['filename']).name
    except Exception:
        raise HTTPException(500, '固件缓存元数据损坏，请重新下载')
    if not firmware_path.is_file() or firmware_path.stat().st_size != metadata.get('size'):
        raise HTTPException(409, '固件缓存不完整，请重新下载')
    if hashlib.sha256(firmware_path.read_bytes()).hexdigest() != metadata.get('sha256'):
        raise HTTPException(409, '固件缓存校验失败，请重新下载')
    return metadata, firmware_path

def esptool_command_names():
    result = subprocess.run([sys.executable, '-m', 'esptool', '--help'], capture_output=True, text=True, timeout=20, check=False)
    output = f'{result.stdout}\n{result.stderr}'
    if result.returncode:
        raise HTTPException(500, output[-1200:] or '无法检查 esptool 命令')
    erase = 'erase-flash' if 'erase-flash' in output else 'erase_flash'
    write = 'write-flash' if 'write-flash' in output else 'write_flash'
    return erase, write

def build_firmware_plan(port: str, chip: str):
    metadata, firmware_path = cached_firmware(chip)
    erase, write = esptool_command_names()
    target = firmware_board(chip)
    return {
        **metadata,
        'port': port,
        'tool': 'python -m esptool',
        'esptool_chip': target['esptool_chip'],
        'erase_first': True,
        'erase_command': erase,
        'write_command': write,
        'firmware_path': str(firmware_path),
        'confirmed_required': True,
    }

def firmware_target(chip: str):
    """Compatibility helper retained for the manual/offline upload endpoint."""
    target = firmware_board(chip)
    return target['esptool_chip'], target['fallback_offset']

def mpremote(port: str, args: list[str], timeout: int = 45):
    return run_process([sys.executable, '-m', 'mpremote', 'connect', port, *args], timeout)

def write_runtime(port: str, project: Project):
    with tempfile.TemporaryDirectory(prefix='pixelsky-') as folder:
        temp = Path(folder)
        (temp / 'config.json').write_text(json.dumps(config(project)), encoding='utf-8')
        (temp / 'animation.json').write_text(json.dumps(animation(project)), encoding='utf-8')
        mpremote(port, ['exec', "import os\ntry: os.mkdir('pixelsky')\nexcept OSError: pass"])
        files = [
            (DEVICE / 'main.py', ':main.py'),
            (DEVICE / 'pixelsky' / '__init__.py', ':pixelsky/__init__.py'),
            (DEVICE / 'pixelsky' / 'pixelsky_runtime.py', ':pixelsky/pixelsky_runtime.py'),
            (DEVICE / 'pixelsky' / 'neopixel_matrix.py', ':pixelsky/neopixel_matrix.py'),
            (temp / 'config.json', ':pixelsky/config.json'),
            (temp / 'animation.json', ':pixelsky/animation.json'),
        ]
        for source, target in files:
            mpremote(port, ['fs', 'cp', str(source), target])
        mpremote(port, ['reset'])

@app.get('/health')
def health():
    return {'ok': True, 'service': 'pixelsky-helper', 'version': '0.7.0', 'features': ['flash', 'firmware-resolve', 'firmware-download', 'firmware-cache', 'flash-plan', 'multi-chip', 'esp32-wroom', 'esp32c3-supermini', 'preflight', 'led-test', 'dynamic-canvas', 'matrix-calibration', 'matrix-layout', 'brightness-scale', 'frame-duration', 'frame-reorder']}

@app.get('/api/ports')
def ports():
    return {'ports': [{'device': p.device, 'description': p.description, 'hwid': p.hwid} for p in available_ports().values()]}

@app.post('/api/upload-animation')
def upload_animation(req: UploadRequest):
    ensure_port(req.port)
    with tempfile.TemporaryDirectory(prefix='pixelsky-') as folder:
        target = Path(folder) / 'animation.json'
        target.write_text(json.dumps(animation(req.project)), encoding='utf-8')
        mpremote(req.port, ['fs', 'cp', str(target), ':pixelsky/animation.json'])
        mpremote(req.port, ['reset'])
    return {'ok': True, 'message': '动画已更新'}

@app.post('/api/upload-runtime')
def upload_runtime(req: UploadRequest):
    ensure_port(req.port)
    write_runtime(req.port, req.project)
    return {'ok': True, 'message': '运行时部署完成'}

@app.post('/api/device-check')
def device_check(req: PortRequest):
    ensure_port(req.port)
    code = "import sys,os,gc;u=os.uname();print('PIXELSKY|%s|%s|%s|%s'%('.'.join(map(str,sys.implementation.version[:3])),u.machine,gc.mem_free(),os.statvfs('/')[0]*os.statvfs('/')[3]))"
    output = mpremote(req.port, ['exec', code])
    line = next((line for line in output.splitlines() if line.startswith('PIXELSKY|')), '')
    if not line:
        raise HTTPException(500, '设备有响应，但无法读取 MicroPython 信息')
    _, version, machine, free_memory, free_storage = line.split('|', 4)
    return {'ok': True, 'micropython': version, 'machine': machine, 'free_memory': int(free_memory), 'free_storage': int(free_storage), 'checks': {'serial': True, 'micropython': True, 'memory': int(free_memory) > 10000, 'storage': int(free_storage) > 20000}}

@app.post('/api/led-test')
def led_test(req: LedTestRequest):
    ensure_port(req.port)
    code = f"from machine import Pin;import neopixel,time;n=neopixel.NeoPixel(Pin({req.pin},Pin.OUT),{req.count});colors=((32,0,0),(0,32,0),(0,0,32),(0,0,0));[(n.fill(c),n.write(),time.sleep_ms(350)) for c in colors]"
    mpremote(req.port, ['exec', code], timeout=20)
    return {'ok': True, 'message': '红绿蓝灯板测试完成'}

@app.get('/api/toolchain/status')
def toolchain_status():
    modules = {name: importlib.util.find_spec(name) is not None for name in ('esptool', 'mpremote', 'serial')}
    return {
        'ok': all(modules.values()),
        'python': sys.version.split()[0],
        'modules': modules,
        'cache_dir': str(CACHE_ROOT),
    }

@app.post('/api/toolchain/install')
def install_toolchain():
    log = run_process([sys.executable, '-m', 'pip', 'install', 'esptool>=4.8,<6', 'mpremote>=1.25,<2', 'pyserial>=3.5,<4'], 300)
    return {'ok': True, 'message': '设备工具链安装完成', 'log': log[-3000:]}

@app.post('/api/firmware/resolve')
def firmware_resolve(req: FirmwareRequest):
    metadata = resolve_firmware(req.chip)
    try:
        cached, _ = cached_firmware(req.chip)
        metadata['cached'] = cached.get('url') == metadata['url']
    except HTTPException:
        metadata['cached'] = False
    return metadata

@app.post('/api/firmware/download')
def firmware_download(req: FirmwareRequest):
    metadata = resolve_firmware(req.chip)
    payload = fetch_url(metadata['url'])
    return save_firmware(req.chip, metadata, payload)

@app.post('/api/firmware/flash-plan')
def firmware_flash_plan(req: FirmwarePlanRequest):
    ensure_port(req.port)
    return build_firmware_plan(req.port, req.chip)

@app.post('/api/firmware/flash')
def firmware_flash(req: FirmwareFlashRequest):
    ensure_port(req.port)
    if not req.confirmed:
        raise HTTPException(400, '烧录会擦除设备，请先确认烧录计划')
    plan = build_firmware_plan(req.port, req.chip)
    erase = run_process([
        sys.executable, '-m', 'esptool', '--chip', plan['esptool_chip'], '--port', req.port, plan['erase_command'],
    ], 120)
    flash = run_process([
        sys.executable, '-m', 'esptool', '--chip', plan['esptool_chip'], '--port', req.port,
        '--baud', str(plan['baud']), plan['write_command'], '-z', plan['write_offset'], plan['firmware_path'],
    ], 180)
    log_dir = CACHE_ROOT / 'logs'
    log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    log_path = log_dir / f'flash-{req.chip}-{timestamp}.log'
    combined = f'{erase}\n{flash}'.strip()
    log_path.write_text(combined, encoding='utf-8')
    return {
        'ok': True,
        'message': 'MicroPython 官方固件烧录完成',
        'chip': req.chip,
        'version': plan['version'],
        'offset': plan['write_offset'],
        'log_file': str(log_path),
        'log': combined[-3000:],
    }

@app.post('/api/flash-firmware')
async def flash_firmware(port: str = Form(...), chip: FirmwareChip = Form('esp32'), confirmed: bool = Form(False), firmware: UploadFile = File(...)):
    ensure_port(port)
    if not confirmed:
        raise HTTPException(400, '烧录会擦除设备，请先确认')
    if not firmware.filename or not firmware.filename.lower().endswith('.bin'):
        raise HTTPException(400, '请选择 MicroPython .bin 固件')
    payload = await firmware.read(32 * 1024 * 1024 + 1)
    if not payload or len(payload) > 32 * 1024 * 1024:
        raise HTTPException(400, '固件为空或超过 32MB')
    with tempfile.TemporaryDirectory(prefix='pixelsky-firmware-') as folder:
        target = Path(folder) / 'firmware.bin'
        target.write_bytes(payload)
        esptool_chip, offset = firmware_target(chip)
        erase = run_process([sys.executable, '-m', 'esptool', '--chip', esptool_chip, '--port', port, 'erase-flash'], 120)
        flash = run_process([sys.executable, '-m', 'esptool', '--chip', esptool_chip, '--port', port, 'write-flash', '-z', offset, str(target)], 180)
    return {'ok': True, 'message': 'MicroPython 固件烧录完成', 'chip': chip, 'offset': offset, 'log': (erase + '\n' + flash)[-3000:]}

def remote(data: GenerateRequest):
    base = os.getenv('PIXELSKY_AI_BASE_URL', 'https://api.deepseek.com').rstrip('/')
    key = os.getenv('DEEPSEEK_API_KEY') or os.getenv('PIXELSKY_AI_API_KEY', '')
    if not key:
        return None
    spec = {'prompt': data.prompt, 'width': data.width, 'height': data.height, 'max_frames': 32, 'instruction': f'Return JSON only: {{frames: string[frame][{data.width * data.height}]}}, colors are #RRGGBB.'}
    body = {
        'model': os.getenv('DEEPSEEK_MODEL') or os.getenv('PIXELSKY_AI_MODEL', 'deepseek-v4-flash'),
        'messages': [
            {'role': 'system', 'content': 'You design tiny LED pixel animations. Always return one valid JSON object and no Markdown.'},
            {'role': 'user', 'content': json.dumps(spec, ensure_ascii=False)},
        ],
        'response_format': {'type': 'json_object'},
        'stream': False,
    }
    request = urllib.request.Request(base + '/chat/completions', data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            reply = json.load(response)
        return validate_frames(json.loads(reply['choices'][0]['message']['content'])['frames'], data.width, data.height)
    except Exception:
        return None

@app.post('/api/generate')
def generate(data: GenerateRequest):
    frames = remote(data)
    source = 'deepseek' if frames else 'fallback'
    frames = frames or fallback_frames(data.prompt, width=data.width, height=data.height)
    return {'source': source, 'project': {'version': 1, 'name': 'AI 创意', 'width': data.width, 'height': data.height, 'fps': data.fps, 'brightness': data.brightness, 'loop': True, 'frame_durations': [max(100, round(1000 / data.fps)) for _ in frames], 'frames': frames}}
