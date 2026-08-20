from __future__ import annotations
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
import serial.tools.list_ports

from core import fallback_frames, hex_to_rgb565, validate_frames, validate_size

ROOT = Path(__file__).resolve().parents[1]
DEVICE = ROOT / 'device'
app = FastAPI(title='PixelSky Local Helper', version='0.4.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://127.0.0.1:5173', 'http://localhost:5173', 'https://pixelsky.pages.dev'],
    allow_origin_regex=r'https://([a-z0-9-]+\.)?pixelsky\.pages\.dev',
    allow_methods=['GET', 'POST'],
    allow_headers=['*'],
)

@app.middleware('http')
async def allow_local_device_bridge(request, call_next):
    response = await call_next(request)
    if request.headers.get('access-control-request-private-network') == 'true':
        response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response

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
    pin: int = Field(default=2, ge=0, le=48)
    pixel_order: Literal['RGB', 'GRB', 'BGR', 'BRG', 'RBG', 'GBR'] = 'GRB'
    matrix_layout: Literal['column-major-rtl', 'row-serpentine'] = 'column-major-rtl'
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
    return {'width': project.width, 'height': project.height, 'pin': project.pin, 'pixel_order': project.pixel_order, 'matrix_layout': project.matrix_layout, 'module_width': 8, 'module_order': 'row-major', 'flip_h': project.flip_h, 'flip_v': project.flip_v, 'rotate': project.rotate, 'gamma': project.gamma, 'r_balance': project.r_balance, 'g_balance': project.g_balance, 'b_balance': project.b_balance, 'brightness': min(.2, project.brightness * .2), 'fps': project.fps}

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

def firmware_target(chip: str):
    targets = {'esp32': ('esp32', '0x1000'), 'esp32s2': ('esp32s2', '0x1000'), 'esp32s3': ('esp32s3', '0x0'), 'esp32c3': ('esp32c3', '0x0')}
    if chip not in targets:
        raise ValueError('unsupported ESP chip')
    return targets[chip]

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
    return {'ok': True, 'service': 'pixelsky-helper', 'version': '0.5.1', 'features': ['flash', 'multi-chip', 'preflight', 'led-test', 'dynamic-canvas', 'matrix-calibration', 'matrix-layout', 'brightness-scale', 'frame-duration', 'frame-reorder']}

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

@app.post('/api/flash-firmware')
async def flash_firmware(port: str = Form(...), chip: Literal['esp32', 'esp32s2', 'esp32s3', 'esp32c3'] = Form('esp32'), firmware: UploadFile = File(...)):
    ensure_port(port)
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
