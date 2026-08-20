interface Env {
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  PIXELSKY_AI_BASE_URL?: string;
  PIXELSKY_AI_API_KEY?: string;
  PIXELSKY_AI_MODEL?: string;
}

interface RequestBody {
  prompt?: unknown;
  width?: unknown;
  height?: unknown;
  fps?: unknown;
  brightness?: unknown;
}

type Context = { request: Request; env: Env };
type Frame = string[];

const SIZES = new Set(["8x8", "16x8", "16x16"]);
const COLORS = { bg: "#07130F", mint: "#31F5C3", purple: "#9B7BFF", pink: "#FF5A9D", yellow: "#FFCB5C", blue: "#52B7FF", white: "#FFFFFF" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...corsHeaders } });
const empty = (width: number, height: number): Frame => Array.from({ length: width * height }, () => COLORS.bg);
const setPixel = (frame: Frame, width: number, height: number, x: number, y: number, color: string) => {
  if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = color;
};

function fallbackFrames(prompt: string, width: number, height: number): Frame[] {
  const frames = Array.from({ length: 4 }, () => empty(width, height));
  const low = prompt.toLowerCase();
  if (prompt.includes("猫") || low.includes("cat")) {
    const left = Math.floor(width / 2) - 3;
    const top = Math.max(1, Math.floor((height - 6) / 2));
    frames.forEach((frame, index) => {
      for (let y = top + 1; y <= top + 5; y++) for (let x = left; x <= left + 5; x++) setPixel(frame, width, height, x, y, COLORS.yellow);
      setPixel(frame, width, height, left + 1, top, COLORS.yellow);
      setPixel(frame, width, height, left + 4, top, COLORS.yellow);
      const eyeY = top + (index === 2 ? 4 : 3);
      setPixel(frame, width, height, left + 1, eyeY, COLORS.bg);
      setPixel(frame, width, height, left + 4, eyeY, COLORS.bg);
      setPixel(frame, width, height, left + 2, top + 4, COLORS.pink);
      setPixel(frame, width, height, left + 3, top + 4, COLORS.pink);
    });
  } else if (prompt.includes("爱心") || low.includes("heart")) {
    const points = [[-3,-1],[-2,-2],[-1,-1],[0,-1],[1,-2],[2,-1],[-4,0],[3,0],[-3,1],[2,1],[-2,2],[1,2],[-1,3],[0,3]];
    frames.forEach((frame, index) => points.forEach(([dx, dy]) => setPixel(frame, width, height, Math.floor(width / 2) + dx, Math.floor(height / 2) + dy, index % 2 ? COLORS.purple : COLORS.pink)));
  } else if (prompt.includes("彩虹") || low.includes("rainbow")) {
    const colors = [COLORS.pink, COLORS.yellow, COLORS.mint, COLORS.blue, COLORS.purple];
    frames.forEach((frame, index) => { for (let x = 0; x < width; x++) setPixel(frame, width, height, x, (Math.round(height - 2 - Math.sin(Math.PI * x / Math.max(1, width - 1)) * Math.max(1, height / 3)) + index) % height, colors[x % colors.length]); });
  } else {
    frames.forEach((frame, index) => {
      const head = (index * Math.max(2, Math.floor(width / 4))) % (width + 5) - 4;
      [COLORS.white, COLORS.mint, COLORS.blue, COLORS.purple, COLORS.pink, COLORS.yellow].forEach((color, tail) => setPixel(frame, width, height, head - tail, Math.floor(height / 4) + Math.abs(head - tail) % Math.max(2, Math.floor(height / 2)), color));
    });
  }
  return frames;
}

const validFrames = (value: unknown, width: number, height: number): value is Frame[] => Array.isArray(value) && value.length > 0 && value.length <= 32 && value.every((frame) => Array.isArray(frame) && frame.length === width * height && frame.every((color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)));

const normalizeModelFrames = (value: unknown, paletteValue: unknown, width: number, height: number): Frame[] | null => {
  if (validFrames(value, width, height)) return value;
  const paletteSource = Array.isArray(paletteValue)
    ? paletteValue
    : paletteValue && typeof paletteValue === "object"
      ? Object.entries(paletteValue as Record<string, unknown>).sort(([a], [b]) => Number(a) - Number(b)).map(([, color]) => color)
      : [];
  if (paletteSource.length < 2 || paletteSource.length > 10) return null;
  const palette = paletteSource.map((entry) => {
    const color = typeof entry === "string" ? entry : entry && typeof entry === "object" ? (entry as { color?: unknown; hex?: unknown }).color ?? (entry as { hex?: unknown }).hex : null;
    return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : null;
  });
  const frameSource = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : [];
  if (palette.some((color) => color === null) || frameSource.length < 1 || frameSource.length > 32) return null;
  const frames: Frame[] = [];
  for (const entry of frameSource) {
    const rows = Array.isArray(entry) ? entry : entry && typeof entry === "object" ? (entry as { rows?: unknown; grid?: unknown; pixels?: unknown }).rows ?? (entry as { grid?: unknown }).grid ?? (entry as { pixels?: unknown }).pixels : null;
    if (!Array.isArray(rows) || rows.length !== height) return null;
    const frame: Frame = [];
    for (const row of rows) {
      const symbols = typeof row === "string" ? [...row.replace(/\s/g, "")] : Array.isArray(row) ? row : [];
      if (symbols.length !== width) return null;
      for (const symbol of symbols) {
        const index = Number(symbol);
        const color = Number.isInteger(index) ? palette[index] : null;
        if (!color) return null;
        frame.push(color);
      }
    }
    frames.push(frame);
  }
  return frames;
};

type RemoteResult = { frames: Frame[] | null; status: "ok" | "not_configured" | "request_failed" | "invalid_response" };

const parseModelJson = (content: string): unknown => JSON.parse(
  content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
);

async function remoteFrames(env: Env, prompt: string, width: number, height: number): Promise<RemoteResult> {
  const apiKey = env.DEEPSEEK_API_KEY || env.PIXELSKY_AI_API_KEY;
  if (!apiKey) return { frames: null, status: "not_configured" };
  const baseUrl = (env.PIXELSKY_AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const maxGeneratedFrames = width * height <= 64 ? 6 : width * height <= 128 ? 4 : 2;
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(40000),
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || env.PIXELSKY_AI_MODEL || "deepseek-v4-flash",
        response_format: { type: "json_object" },
        max_tokens: 3000,
        stream: false,
        messages: [
          { role: "system", content: `You are a professional pixel-art animator for a physical LED matrix. Create a recognizable subject that faithfully matches the user's request. Never replace it with an unrelated comet, line, dots, or abstract pattern. The canvas is exactly ${width}x${height}; design specifically for this tiny resolution with hard pixel edges, a centered readable silhouette, no antialiasing, and a limited high-contrast palette. Animation frames must preserve the same subject and change only the requested motion. Return one valid JSON object and no Markdown.` },
          { role: "user", content: JSON.stringify({ user_request: prompt, selected_canvas: `${width}x${height}`, frame_count: `2 to ${maxGeneratedFrames}`, exact_output_example: { palette: ["#07130F", "#FFFFFF", "#FFCB5C"], frames: [Array.from({ length: height }, () => "0".repeat(width))] }, output_rules: [`palette must be a JSON array of 2-10 #RRGGBB strings`, `frames must be an array of frames`, `each frame must contain exactly ${height} row strings`, `each row string must contain exactly ${width} digits`, "each digit is the zero-based palette index"], requirements: ["Replace the blank example with recognizable pixel art matching the requested subject and action", "Fill enough pixels to make the subject recognizable", "Keep every frame inside the exact selected canvas", "Use the same palette for all frames"] }) },
        ],
      }),
    });
    if (!response.ok) return { frames: null, status: "request_failed" };
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = parseModelJson(payload.choices?.[0]?.message?.content || "{}") as { palette?: unknown; frames?: unknown };
    const frames = normalizeModelFrames(parsed.frames, parsed.palette, width, height);
    return frames
      ? { frames, status: "ok" }
      : { frames: null, status: "invalid_response" };
  } catch { return { frames: null, status: "request_failed" }; }
}

export const onRequestPost = async ({ request, env }: Context) => {
  let body: RequestBody;
  try { body = await request.json() as RequestBody; }
  catch { return json({ detail: "请求 JSON 格式无效" }, 400); }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 180) : "";
  const width = Number(body.width);
  const height = Number(body.height);
  const fps = Math.min(10, Math.max(1, Math.round(Number(body.fps) || 5)));
  const brightness = Math.min(.2, Math.max(.01, Number(body.brightness) || .2));
  if (!prompt) return json({ detail: "请输入创意描述" }, 422);
  if (!SIZES.has(`${width}x${height}`)) return json({ detail: "仅支持 8×8、16×8 或 16×16" }, 422);
  const remote = await remoteFrames(env, prompt, width, height);
  const frames = remote.frames || fallbackFrames(prompt, width, height);
  const duration = Math.max(100, Math.round(1000 / fps));
  return json({ source: remote.frames ? "deepseek" : "fallback", provider_status: remote.status, project: { version: 1, name: "AI 创意", width, height, fps, brightness, frames, frame_durations: frames.map(() => duration), loop: true } });
};

export const onRequestOptions = async () => new Response(null, { status: 204, headers: corsHeaders });
