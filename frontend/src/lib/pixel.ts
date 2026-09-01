export const MAX_FRAMES = 32;
export const MIN_FRAME_DURATION = 100;
export const EMPTY = "#07130F";
export const MODULE_SIZE = 8;

export type Frame = string[];
export type CanvasPreset = "8x8" | "16x8" | "16x16";
export type ViewMode = "creative" | "hardware";
export type PixelOrder = "RGB" | "GRB" | "BGR" | "BRG" | "RBG" | "GBR";
export type MatrixLayout = "column-major-rtl" | "row-serpentine" | "row-major";
export type EspChip = "esp32" | "esp32s2" | "esp32s3" | "esp32c3";
export type BoardProfile = "xiao_esp32c3" | "esp32_wroom";

export interface PixelProject {
  version: 1;
  name: string;
  width: number;
  height: number;
  fps: number;
  brightness: number;
  frames: Frame[];
  frame_durations: number[];
  frame_names: string[];
  loop: boolean;
  board: BoardProfile;
  pin: number;
  pixel_order: PixelOrder;
  matrix_layout: MatrixLayout;
  flip_h: boolean;
  flip_v: boolean;
  rotate: 0 | 90 | 180 | 270;
  gamma: number;
  r_balance: number;
  g_balance: number;
  b_balance: number;
}

export const CANVAS_PRESETS: Array<{ id: CanvasPreset; width: number; height: number; label: string }> = [
  { id: "8x8", width: 8, height: 8, label: "8×8 单模块" },
  { id: "16x8", width: 16, height: 8, label: "16×8 双模块" },
  { id: "16x16", width: 16, height: 16, label: "16×16 四模块" },
];

export const PRESET_SWATCHES = ["#31F5C3", "#7DF9FF", "#8B5CF6", "#FF4FA3", "#FFD166", "#FF7A45", "#F8FAFC", EMPTY];

export const emptyFrame = (width = 16, height = 8): Frame => Array.from({ length: width * height }, () => EMPTY);

export const normalizeHex = (value: string): string | null => {
  let v = value.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
};

export const hexToRgb565 = (hex: string): number => {
  const clean = normalizeHex(hex) ?? EMPTY;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
};

export const rgb565ToHex = (value: number): string => {
  const safe = Math.max(0, Math.min(0xffff, Math.round(value)));
  const r5 = (safe >> 11) & 0x1f;
  const g6 = (safe >> 5) & 0x3f;
  const b5 = safe & 0x1f;
  const r = Math.round((r5 * 255) / 31);
  const g = Math.round((g6 * 255) / 63);
  const b = Math.round((b5 * 255) / 31);
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

export const starterFrame = (width = 16, height = 8): Frame => {
  const frame = emptyFrame(width, height);
  const set = (x: number, y: number, color: string) => {
    if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = color;
  };
  for (let x = 0; x < width; x++) {
    const y = Math.round((height - 1) / 2 + Math.sin((x / width) * Math.PI * 2) * Math.max(1, height / 3));
    set(x, y, "#31F5C3"); set(x, y + 1, "#149C82");
  }
  set(1, 1, "#8B5CF6"); set(2, 1, "#C4B5FD"); set(width - 2, height - 2, "#8B5CF6");
  set(Math.floor(width / 2), 0, "#FFD166");
  return frame;
};

export const frameDurationForFps = (fps: number) => Math.max(MIN_FRAME_DURATION, Math.round(1000 / Math.max(1, fps)));

export const sanitizeFrameDurations = (input: unknown, count: number, fps = 5): number[] => {
  const values = Array.isArray(input) ? input : [];
  const fallback = frameDurationForFps(fps);
  return Array.from({ length: count }, (_, index) => {
    const value = Number(values[index]);
    return Number.isFinite(value) ? Math.max(MIN_FRAME_DURATION, Math.round(value)) : fallback;
  });
};

export const defaultFrameName = (index: number) => `帧 ${String(index + 1).padStart(2, "0")}`;

export const sanitizeFrameNames = (input: unknown, count: number): string[] => {
  const values = Array.isArray(input) ? input : [];
  return Array.from({ length: count }, (_, index) => {
    const value = typeof values[index] === "string" ? values[index].trim().slice(0, 24) : "";
    return value || defaultFrameName(index);
  });
};

export const createProject = (name = "未命名动画", width = 16, height = 8): PixelProject => ({ version: 1, name, width, height, fps: 5, brightness: 20, frames: [emptyFrame(width, height)], frame_durations: [200], frame_names: [defaultFrameName(0)], loop: true, board: "xiao_esp32c3", pin: 2, pixel_order: "GRB", matrix_layout: "column-major-rtl", flip_h: false, flip_v: false, rotate: 0, gamma: 1, r_balance: 1, g_balance: 1, b_balance: 1 });

export const sanitizeFrame = (input: unknown, width: number, height: number): Frame => {
  const base = emptyFrame(width, height);
  if (Array.isArray(input)) for (let i = 0; i < base.length; i++) base[i] = normalizeHex(String(input[i] ?? "")) ?? EMPTY;
  return base;
};

export const sanitizeFrames = (input: unknown, width = 16, height = 8): Frame[] => {
  const frames = Array.isArray(input) ? input.slice(0, MAX_FRAMES) : [];
  const out = frames.map((frame) => sanitizeFrame(frame, width, height));
  return out.length ? out : [emptyFrame(width, height)];
};

const inferSize = (length: number, width?: number, height?: number) => {
  if (width && height && width * height === length) return { width, height };
  if (length === 64) return { width: 8, height: 8 };
  if (length === 128) return { width: 16, height: 8 };
  if (length === 256) return { width: 16, height: 16 };
  throw new Error("仅支持 8×8、16×8 或 16×16 像素数据");
};

export const parseProject = (raw: string): PixelProject => {
  const data = JSON.parse(raw) as Record<string, unknown> | unknown[];
  if (!data || typeof data !== "object") throw new Error("文件格式不正确");
  const object = Array.isArray(data) ? {} : data;
  let rawFrames: unknown = Array.isArray(data) ? [data] : object.frames;
  let rawDurations: unknown = object.frame_durations;
  let rawNames: unknown = object.frame_names;
  if (!rawFrames && Array.isArray(object.frame)) rawFrames = [object.frame];
  if (!rawFrames && Array.isArray(object.pixels)) rawFrames = [object.pixels];
  if (Array.isArray(rawFrames) && rawFrames.length && rawFrames[0] && typeof rawFrames[0] === "object" && !Array.isArray(rawFrames[0])) {
    const entries = rawFrames as Array<Record<string, unknown>>;
    rawDurations = entries.map((entry) => entry.duration_ms);
    rawNames = entries.map((entry) => entry.name);
    rawFrames = entries.map((entry) => entry.pixels);
  }
  if (!Array.isArray(rawFrames) || !rawFrames.length || !Array.isArray(rawFrames[0])) throw new Error("没有找到像素帧数据");
  const first = rawFrames[0] as unknown[];
  const size = inferSize(first.length, Number(object.width) || undefined, Number(object.height) || undefined);
  const numeric = first.every((value) => typeof value === "number");
  const converted = numeric ? (rawFrames as number[][]).map((frame) => frame.map(rgb565ToHex)) : rawFrames;
  const fps = Number(object.fps);
  const rawBrightness = Number(object.brightness);
  const brightness = Number.isFinite(rawBrightness)
    ? (object.brightness_scale === "safe-20-percent" ? rawBrightness * 500 : rawBrightness <= 1 ? rawBrightness * 100 : rawBrightness)
    : 20;
  const sanitized = sanitizeFrames(converted, size.width, size.height);
  const safeFps = Number.isFinite(fps) ? Math.min(10, Math.max(1, Math.round(fps))) : 5;
  const rawMatrixLayout = object.matrix_layout ?? object.mapping;
  return {
    version: 1,
    name: typeof object.name === "string" && object.name.trim() ? object.name : numeric ? "导入的 RGB565 动画" : "导入的动画",
    width: size.width,
    height: size.height,
    fps: safeFps,
    brightness: Math.min(100, Math.max(1, Math.round(brightness))),
    frames: sanitized,
    frame_durations: sanitizeFrameDurations(rawDurations, sanitized.length, safeFps),
    frame_names: sanitizeFrameNames(rawNames, sanitized.length),
    loop: object.loop !== false,
    board: object.board === "esp32_wroom" ? "esp32_wroom" : "xiao_esp32c3",
    pin: Number.isFinite(Number(object.pin)) ? Number(object.pin) : 2,
    pixel_order: (["RGB", "GRB", "BGR", "BRG", "RBG", "GBR"].includes(String(object.pixel_order)) ? String(object.pixel_order) : "GRB") as PixelOrder,
    matrix_layout: (["column-major-rtl", "row-serpentine", "row-major"].includes(String(rawMatrixLayout)) ? String(rawMatrixLayout) : "column-major-rtl") as MatrixLayout,
    flip_h: Boolean(object.flip_h),
    flip_v: Boolean(object.flip_v),
    rotate: ([0, 90, 180, 270].includes(Number(object.rotate)) ? Number(object.rotate) : 0) as 0 | 90 | 180 | 270,
    gamma: Math.min(3, Math.max(.1, Number(object.gamma) || 1)),
    r_balance: Math.min(2, Math.max(0, Number(object.r_balance) || 1)),
    g_balance: Math.min(2, Math.max(0, Number(object.g_balance) || 1)),
    b_balance: Math.min(2, Math.max(0, Number(object.b_balance) || 1)),
  };
};

export const resizeFrames = (frames: Frame[], oldWidth: number, oldHeight: number, width: number, height: number): Frame[] => frames.map((frame) => {
  const next = emptyFrame(width, height);
  for (let y = 0; y < Math.min(oldHeight, height); y++) for (let x = 0; x < Math.min(oldWidth, width); x++) next[y * width + x] = frame[y * oldWidth + x] ?? EMPTY;
  return next;
});

export const hardwareIndex = (x: number, y: number, width: number, moduleSize = MODULE_SIZE, layout: MatrixLayout = "column-major-rtl"): number => {
  // One-piece panels use a single continuous row-major LED chain. Unlike the
  // modular layouts below, their numbering must not restart at each 8x8 seam.
  if (layout === "row-major") return y * width + x;
  const modulesPerRow = Math.ceil(width / moduleSize);
  const moduleX = Math.floor(x / moduleSize);
  const moduleY = Math.floor(y / moduleSize);
  const localX = x % moduleSize;
  const localY = y % moduleSize;
  const moduleIndex = moduleY * modulesPerRow + moduleX;
  const modulePixel = layout === "row-serpentine"
    ? localY * moduleSize + (localY % 2 ? moduleSize - 1 - localX : localX)
    : (moduleSize - 1 - localX) * moduleSize + localY;
  return moduleIndex * moduleSize * moduleSize + modulePixel;
};

export const mappedHardwareIndex = (x: number, y: number, project: Pick<PixelProject, "width" | "height" | "matrix_layout" | "flip_h" | "flip_v" | "rotate">): number => {
  if (project.flip_h) x = project.width - 1 - x;
  if (project.flip_v) y = project.height - 1 - y;
  let physicalWidth = project.width;
  if (project.rotate === 90) { const nextX = project.height - 1 - y; y = x; x = nextX; physicalWidth = project.height; }
  else if (project.rotate === 180) { x = project.width - 1 - x; y = project.height - 1 - y; }
  else if (project.rotate === 270) { const nextX = y; y = project.width - 1 - x; x = nextX; physicalWidth = project.height; }
  return hardwareIndex(x, y, physicalWidth, MODULE_SIZE, project.matrix_layout);
};

export const toAnimationJson = (project: PixelProject) => ({
  version: 1, name: project.name, width: project.width, height: project.height, fps: project.fps,
  brightness: project.brightness / 500, brightness_scale: "safe-20-percent", loop: project.loop, format: "RGB565", module_width: 8, mapping: project.matrix_layout,
  frames: project.frames.map((frame, index) => ({
    name: project.frame_names[index] ?? defaultFrameName(index),
    duration_ms: Math.max(MIN_FRAME_DURATION, project.frame_durations[index] ?? frameDurationForFps(project.fps)),
    pixels: sanitizeFrame(frame, project.width, project.height).map(hexToRgb565),
  })),
});

export const toReferenceImageJson = (project: PixelProject, frameIndex = 0) => ({
  pixels: sanitizeFrame(project.frames[frameIndex], project.width, project.height).map(hexToRgb565),
  width: project.width,
  height: project.height,
  description: project.name,
  version: 1.0,
});

export const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
};
export const safeFileName = (name: string) => (name.trim() || "pixelsky").replace(/[^\w\u4e00-\u9fa5-]+/g, "_");
