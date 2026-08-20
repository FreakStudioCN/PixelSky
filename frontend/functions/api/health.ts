interface Env { DEEPSEEK_API_KEY?: string; DEEPSEEK_MODEL?: string }

export const onRequestGet = async ({ env }: { env: Env }) => Response.json({
  ok: true,
  service: "pixelsky-cloud",
  version: "0.5.0",
  ai: {
    provider: "deepseek",
    configured: Boolean(env.DEEPSEEK_API_KEY),
    model: env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  },
  features: ["animation-generation", "parameter-validation", "rgb565-projects"],
});
