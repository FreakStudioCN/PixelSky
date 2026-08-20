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

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const empty = (width: number, height: number): Frame => Array.from({ length: width * height }, () => COLORS.bg);
const setPixel = (frame: Frame, width: number, height: number, x: number, y: number, color: string) => {
  if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = color;
};

function fallbackFrames(prompt: string, width: number, height: number): Frame[] {
  const frames = Array.from({ length: 4 }, () => empty(width, height));
  const low = prompt.toLowerCase();
  if (prompt.includes("爱心") || low.includes("heart")) {
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

type RemoteResult = { frames: Frame[] | null; status: "ok" | "not_configured" | "request_failed" | "invalid_response" };

const parseModelJson = (content: string): unknown => JSON.parse(
  content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
);

async function remoteFrames(env: Env, prompt: string, width: number, height: number): Promise<RemoteResult> {
  const apiKey = env.DEEPSEEK_API_KEY || env.PIXELSKY_AI_API_KEY;
  if (!apiKey) return { frames: null, status: "not_configured" };
  const baseUrl = (env.PIXELSKY_AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || env.PIXELSKY_AI_MODEL || "deepseek-v4-flash",
        response_format: { type: "json_object" },
        stream: false,
        messages: [
          { role: "system", content: "You design tiny LED pixel animations. Always return one valid JSON object and no Markdown." },
          { role: "user", content: JSON.stringify({ prompt, width, height, max_frames: 32, instruction: `Return JSON only as {\"frames\": string[frame][${width * height}]}. Use 1 to 8 frames. Every color must be #RRGGBB. Each flat frame is row-major from top-left.` }) },
        ],
      }),
    });
    if (!response.ok) return { frames: null, status: "request_failed" };
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = parseModelJson(payload.choices?.[0]?.message?.content || "{}") as { frames?: unknown };
    return validFrames(parsed.frames, width, height)
      ? { frames: parsed.frames, status: "ok" }
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
