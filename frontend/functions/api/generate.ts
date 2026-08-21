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
    const left = Math.floor(width / 2) - 4;
    const right = left + 7;
    const top = Math.max(0, Math.floor((height - 7) / 2));
    frames.forEach((frame, index) => {
      // Triangular ears with pink inner ears.
      setPixel(frame, width, height, left, top, COLORS.white);
      setPixel(frame, width, height, right, top, COLORS.white);
      for (let x = left; x <= left + 2; x++) setPixel(frame, width, height, x, top + 1, COLORS.white);
      for (let x = right - 2; x <= right; x++) setPixel(frame, width, height, x, top + 1, COLORS.white);
      setPixel(frame, width, height, left + 1, top + 1, COLORS.pink);
      setPixel(frame, width, height, right - 1, top + 1, COLORS.pink);

      // White outline and purple face make the silhouette readable on LEDs.
      for (let x = left; x <= right; x++) {
        setPixel(frame, width, height, x, top + 2, COLORS.white);
        setPixel(frame, width, height, x, top + 6, COLORS.white);
      }
      for (let y = top + 3; y <= top + 5; y++) {
        setPixel(frame, width, height, left, y, COLORS.white);
        setPixel(frame, width, height, right, y, COLORS.white);
        for (let x = left + 1; x < right; x++) setPixel(frame, width, height, x, y, COLORS.purple);
      }

      // Cat eyes blink on frame three; nose, mouth, and whiskers stay fixed.
      const blinking = index === 2;
      setPixel(frame, width, height, left + 2, top + 3, blinking ? COLORS.bg : COLORS.yellow);
      setPixel(frame, width, height, right - 2, top + 3, blinking ? COLORS.bg : COLORS.yellow);
      setPixel(frame, width, height, left + 3, top + 4, COLORS.pink);
      setPixel(frame, width, height, left + 4, top + 4, COLORS.pink);
      setPixel(frame, width, height, left + 3, top + 5, COLORS.bg);
      setPixel(frame, width, height, left + 4, top + 5, COLORS.bg);
      for (let x = Math.max(0, left - 2); x < left; x++) {
        setPixel(frame, width, height, x, top + 4, COLORS.white);
        setPixel(frame, width, height, x, top + 5, COLORS.white);
      }
      for (let x = right + 1; x <= Math.min(width - 1, right + 2); x++) {
        setPixel(frame, width, height, x, top + 4, COLORS.white);
        setPixel(frame, width, height, x, top + 5, COLORS.white);
      }
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

const normalizeAiColor = (value: unknown): string | null => {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) return value.toUpperCase();
  if (Array.isArray(value) && value.length >= 3) {
    const rgb = value.slice(0, 3).map(Number);
    if (rgb.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      return `#${rgb.map((part) => part.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    }
  }
  return null;
};

const normalizeModelFrames = (value: unknown, paletteValue: unknown, width: number, height: number): Frame[] | null => {
  const paletteEntries = Array.isArray(paletteValue)
    ? paletteValue.map((entry, index) => [String(index), entry] as const)
    : paletteValue && typeof paletteValue === "object"
      ? Object.entries(paletteValue as Record<string, unknown>)
      : [];
  const palette = new Map<string, string>();
  paletteEntries.forEach(([symbol, entry]) => {
    const color = typeof entry === "string" ? entry : entry && typeof entry === "object" ? (entry as { color?: unknown; hex?: unknown }).color ?? (entry as { hex?: unknown }).hex : null;
    const normalized = normalizeAiColor(color);
    if (normalized) palette.set(symbol, normalized);
  });
  const frameSource = Array.isArray(value)
    ? value.slice(0, 32)
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>).slice(0, 32)
      : [];
  if (frameSource.length < 1) return null;
  const frames: Frame[] = [];
  for (const entry of frameSource) {
    const data = Array.isArray(entry) ? entry : entry && typeof entry === "object" ? (entry as { rows?: unknown; grid?: unknown; pixels?: unknown; data?: unknown }).pixels ?? (entry as { rows?: unknown }).rows ?? (entry as { grid?: unknown }).grid ?? (entry as { data?: unknown }).data : null;
    if (Array.isArray(data) && data.length >= width * height) {
      const direct = data.slice(0, width * height).map((color) => normalizeAiColor(color) ?? palette.get(String(color)) ?? null);
      if (direct.every((color): color is string => color !== null)) {
        frames.push(direct);
        continue;
      }
    }
    const rows = data;
    if (!Array.isArray(rows) || rows.length !== height) return null;
    if (palette.size < 2 || palette.size > 16) return null;
    const frame: Frame = [];
    for (const row of rows) {
      const symbols = typeof row === "string" ? [...row.replace(/[\s,]/g, "")] : Array.isArray(row) ? row : [];
      if (symbols.length !== width) return null;
      for (const symbol of symbols) {
        const color = normalizeAiColor(symbol) ?? palette.get(String(symbol)) ?? null;
        if (!color) return null;
        frame.push(color);
      }
    }
    frames.push(frame);
  }
  return frames;
};

type RemoteResult = { frames: Frame[] | null; status: "ok" | "not_configured" | "request_failed" | "invalid_response" };

const hasVisibleSubject = (frame: Frame, width: number, height: number) => {
  const counts = new Map<string, number>();
  frame.forEach((color) => counts.set(color, (counts.get(color) || 0) + 1));
  const largestArea = Math.max(...counts.values());
  const foregroundPixels = width * height - largestArea;
  return counts.size >= 2 && foregroundPixels >= Math.max(4, Math.floor(width * height * .08));
};

const parseModelJson = (content: string): unknown => {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
};

async function remoteFrames(env: Env, prompt: string, width: number, height: number): Promise<RemoteResult> {
  const apiKey = env.DEEPSEEK_API_KEY || env.PIXELSKY_AI_API_KEY;
  if (!apiKey) return { frames: null, status: "not_configured" };
  const baseUrl = (env.PIXELSKY_AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const maxGeneratedFrames = width * height <= 64 ? 6 : width * height <= 128 ? 4 : 2;
  const exampleRows = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    return Math.abs(x - centerX) + Math.abs(y - centerY) <= 1 ? "1" : "0";
  }).join(""));
  const subjectGuidance = prompt.includes("猫") || prompt.toLowerCase().includes("cat")
    ? "The cat must visibly have two triangular ears, two separated eyes, a small nose, a mouth, and left/right whiskers. Animate the eyelids only for blinking; do not draw a bird or chicken."
    : "Use the subject's most distinctive silhouette and features so it is recognizable without explanation.";
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(40000),
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || env.PIXELSKY_AI_MODEL || "deepseek-v4-pro",
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        max_tokens: 4096,
        stream: false,
        messages: [
          { role: "system", content: `You are a professional pixel-art animator for a physical LED matrix. Understand Simplified Chinese instructions as the primary input language. Create the exact requested subject, colors, setting, and action. Never substitute an unrelated subject or return blank/solid-color frames. The canvas is exactly ${width}x${height}; use hard pixel edges, a centered readable silhouette, no antialiasing, and a limited high-contrast palette. Preserve the same subject between frames and change only the requested motion. Return one valid JSON object with palette and frames, and no Markdown.` },
          { role: "user", content: JSON.stringify({ user_request: prompt, selected_canvas: `${width}x${height}`, frame_count: `2 to ${maxGeneratedFrames}`, recognition_guidance: subjectGuidance, retry_instruction: attempt ? "The previous result was blank or lacked a visible subject. Redesign it with a clear foreground silhouette and distinctive requested features." : undefined, structural_example_do_not_copy: { palette: ["#07130F", "#FFFFFF"], frames: [exampleRows] }, output_rules: [`palette must be a JSON array of 2-10 #RRGGBB strings`, `frames must be an array of frames`, `each frame must contain exactly ${height} row strings`, `each row string must contain exactly ${width} palette-index digits`, "palette index 0 is the background", "use at least two palette indices in every frame"], requirements: ["Match the user's subject and requested colors instead of copying the structural example", "Foreground must occupy 15%-65% of the canvas", "Include the subject's distinctive features", "Keep every frame inside the selected canvas", "Use the same palette for all frames"] }) },
        ],
      }),
      });
      if (!response.ok) {
        if (attempt === 1) return { frames: null, status: "request_failed" };
        continue;
      }
      const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
      const parsed = parseModelJson(payload.choices?.[0]?.message?.content || "{}") as Record<string, unknown>;
      const candidate = (parsed.animation ?? parsed.project ?? parsed.data ?? parsed.result ?? parsed) as Record<string, unknown>;
      const frames = normalizeModelFrames(candidate.frames ?? candidate.pixels, candidate.palette ?? parsed.palette, width, height);
      const visibleFrames = frames?.filter((frame) => hasVisibleSubject(frame, width, height)) ?? [];
      if (visibleFrames.length) return { frames: visibleFrames, status: "ok" };
    }
    return { frames: null, status: "invalid_response" };
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
  const frames = (remote.frames || fallbackFrames(prompt, width, height)).slice(0, 32);
  const duration = Math.max(100, Math.round(1000 / fps));
  const animation = { schema: "pixelsky.animation.v1", width, height, fps, brightness, frames: frames.map((pixels, index) => ({ name: `帧 ${String(index + 1).padStart(2, "0")}`, duration_ms: duration, pixels })) };
  return json({ source: remote.frames ? "deepseek" : "fallback", provider_status: remote.status, animation, project: { version: 1, name: "AI 创意", width, height, fps, brightness, frames, frame_durations: frames.map(() => duration), frame_names: animation.frames.map((frame) => frame.name), loop: true } });
};

export const onRequestOptions = async () => new Response(null, { status: 204, headers: corsHeaders });
