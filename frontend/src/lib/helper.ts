import type { PixelProject } from "./pixel";

export const HELPER_BASE = "http://127.0.0.1:8765";

const HELPER_TIMEOUT = 8000;
const AI_TIMEOUT = 75000;
const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
const CLOUD_BASE = currentHost === "pixelsky.pages.dev" || currentHost.endsWith(".pixelsky.pages.dev")
  ? ""
  : "https://pixelsky.pages.dev";

async function request<T>(path: string, init?: RequestInit, base = HELPER_BASE, timeout = HELPER_TIMEOUT, service = "本地 Helper"): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as unknown) : {};
    if (!res.ok) {
      const message =
        (body as { error?: string; message?: string }).error ??
        (body as { message?: string }).message ??
        `请求失败 (${res.status})`;
      throw new Error(message);
    }
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${service} 响应超时`);
    }
    if (error instanceof TypeError) {
      throw new Error(service === "DeepSeek 云端服务" ? "无法连接 DeepSeek 云端服务" : "无法连接本地 Helper（127.0.0.1:8765）");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const getHealth = () => request<{ status?: string; version?: string }>("/health");

export const getPorts = async (): Promise<string[]> => {
  const data = await request<{ ports?: unknown }>("/api/ports");
  const raw = Array.isArray(data.ports) ? data.ports : Array.isArray(data) ? data : [];
  return raw
    .map((p) =>
      typeof p === "string" ? p : ((p as { device?: string; port?: string })?.device ?? (p as { port?: string })?.port),
    )
    .filter((p): p is string => Boolean(p));
};

export const generateAnimation = (body: { prompt: string; width: number; height: number; fps: number; brightness: number }) =>
  request<{ source?: "deepseek" | "fallback"; provider_status?: string; animation?: { schema: "pixelsky.animation.v1"; width: number; height: number; fps: number; brightness: number; frames: Array<{ name?: string; duration_ms: number; pixels: string[] }> }; project?: Partial<PixelProject> }>("/api/generate", {
    method: "POST",
    body: JSON.stringify({ ...body, brightness: body.brightness / 100 }),
  }, CLOUD_BASE, AI_TIMEOUT, "DeepSeek 云端服务");

export const uploadRuntime = (body: { port: string; project: PixelProject }) =>
  request<{ message?: string }>("/api/upload-runtime", { method: "POST", body: JSON.stringify({ ...body, project: { ...body.project, brightness: body.project.brightness / 100 } }) });

export const uploadAnimation = (body: { port: string; project: PixelProject }) =>
  request<{ message?: string }>("/api/upload-animation", { method: "POST", body: JSON.stringify({ ...body, project: { ...body.project, brightness: body.project.brightness / 100 } }) });

export interface DeviceCheck {
  ok: boolean;
  micropython: string;
  machine: string;
  free_memory: number;
  free_storage: number;
  checks: Record<string, boolean>;
}

export const checkDevice = (port: string) => request<DeviceCheck>("/api/device-check", { method: "POST", body: JSON.stringify({ port }) });
export const testLeds = (port: string, count: number, pin: number) => request<{ message?: string }>("/api/led-test", { method: "POST", body: JSON.stringify({ port, pin, count }) });

export const flashFirmware = async (port: string, firmware: File, chip: "esp32" | "esp32s2" | "esp32s3" | "esp32c3") => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 240_000);
  try {
    const form = new FormData(); form.append("port", port); form.append("chip", chip); form.append("firmware", firmware);
    const response = await fetch(`${HELPER_BASE}/api/flash-firmware`, { method: "POST", body: form, signal: controller.signal });
    const body = await response.json() as { message?: string; detail?: string; log?: string };
    if (!response.ok) throw new Error(body.detail ?? "固件烧录失败");
    return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("固件烧录超时");
    throw error;
  } finally { window.clearTimeout(timer); }
};
