import { decompressFrames, parseGIF } from "gifuct-js";
import { EMPTY, MAX_FRAMES, type Frame } from "./pixel";

export interface ColorAdjustments { brightness: number; contrast: number; saturation: number }

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const adjust = (r: number, g: number, b: number, settings: ColorAdjustments) => {
  const gray = .299 * r + .587 * g + .114 * b;
  r = gray + (r - gray) * settings.saturation;
  g = gray + (g - gray) * settings.saturation;
  b = gray + (b - gray) * settings.saturation;
  return [((r - 128) * settings.contrast + 128) * settings.brightness, ((g - 128) * settings.contrast + 128) * settings.brightness, ((b - 128) * settings.contrast + 128) * settings.brightness];
};

const sample = (source: CanvasImageSource, width: number, height: number, settings: ColorAdjustments): Frame => {
  const scale = 10;
  const canvas = document.createElement("canvas"); canvas.width = width * scale; canvas.height = height * scale;
  const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("浏览器 Canvas 不可用");
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high"; context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const frame: Frame = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let r = 0, g = 0, b = 0, alpha = 0;
    for (let by = 0; by < scale; by++) for (let bx = 0; bx < scale; bx++) { const index = ((y * scale + by) * canvas.width + x * scale + bx) * 4; const a = data[index + 3] / 255; r += data[index] * a; g += data[index + 1] * a; b += data[index + 2] * a; alpha += a; }
    if (alpha < 1) frame.push(EMPTY); else { const out = adjust(r / alpha, g / alpha, b / alpha, settings); frame.push(hex(out[0], out[1], out[2])); }
  }
  return frame;
};

const waitEvent = (target: HTMLMediaElement, event: string) => new Promise<void>((resolve, reject) => { const done = () => { cleanup(); resolve(); }; const fail = () => { cleanup(); reject(new Error("媒体文件读取失败")); }; const cleanup = () => { target.removeEventListener(event, done); target.removeEventListener("error", fail); }; target.addEventListener(event, done, { once: true }); target.addEventListener("error", fail, { once: true }); });

export const convertImage = async (file: File, width: number, height: number, settings: ColorAdjustments) => {
  const url = URL.createObjectURL(file); const image = new Image(); image.src = url;
  try { await image.decode(); return [sample(image, width, height, settings)]; } finally { URL.revokeObjectURL(url); }
};

export const convertVideo = async (file: File, width: number, height: number, settings: ColorAdjustments) => {
  const url = URL.createObjectURL(file); const video = document.createElement("video"); video.muted = true; video.preload = "auto"; video.src = url;
  try {
    await waitEvent(video, "loadedmetadata"); if (video.readyState < 2) await waitEvent(video, "loadeddata"); const count = MAX_FRAMES; const frames: Frame[] = [];
    for (let index = 0; index < count; index++) { const target = Math.min(Math.max(0, video.duration - .01), (video.duration * index) / count); if (Math.abs(video.currentTime - target) > .001) { video.currentTime = target; await waitEvent(video, "seeked"); } frames.push(sample(video, width, height, settings)); }
    return frames;
  } finally { URL.revokeObjectURL(url); }
};

export const convertGif = async (file: File, width: number, height: number, settings: ColorAdjustments) => {
  const parsed = parseGIF(await file.arrayBuffer()); const decoded = decompressFrames(parsed, true); if (!decoded.length) throw new Error("GIF 没有可用帧");
  const source = document.createElement("canvas"); source.width = parsed.lsd.width; source.height = parsed.lsd.height;
  const context = source.getContext("2d"); if (!context) throw new Error("浏览器 Canvas 不可用");
  const selected = new Set(decoded.length <= MAX_FRAMES ? decoded.map((_, index) => index) : Array.from({ length: MAX_FRAMES }, (_, index) => Math.floor(index * decoded.length / MAX_FRAMES)));
  const result: Frame[] = [];
  for (let index = 0; index < decoded.length; index++) {
    const frame = decoded[index];
    const previous = frame.disposalType === 3 ? context.getImageData(0, 0, source.width, source.height) : null;
    const patch = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
    context.putImageData(patch, frame.dims.left, frame.dims.top); if (selected.has(index)) result.push(sample(source, width, height, settings));
    if (frame.disposalType === 2) context.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    else if (previous) context.putImageData(previous, 0, 0);
  }
  return result;
};

export const convertText = (text: string, width: number, height: number, color: string, settings: ColorAdjustments) => {
  const scale = 16; const canvas = document.createElement("canvas"); canvas.width = width * scale; canvas.height = height * scale;
  const context = canvas.getContext("2d"); if (!context) throw new Error("浏览器 Canvas 不可用");
  context.fillStyle = EMPTY; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = color; context.textAlign = "center"; context.textBaseline = "middle"; context.font = `bold ${Math.floor(canvas.height * .78)}px "Noto Sans SC", sans-serif`; context.fillText(text.slice(0, 4), canvas.width / 2, canvas.height / 2);
  return [sample(canvas, width, height, settings)];
};

export const convertMedia = async (file: File, width: number, height: number, settings: ColorAdjustments) => {
  if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) return convertGif(file, width, height, settings);
  if (file.type.startsWith("video/")) return convertVideo(file, width, height, settings);
  if (file.type.startsWith("image/")) return convertImage(file, width, height, settings);
  throw new Error("仅支持图片、GIF 和视频文件");
};
