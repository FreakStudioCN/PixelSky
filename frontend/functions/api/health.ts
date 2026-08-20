export const onRequestGet = async () => Response.json({
  ok: true,
  service: "pixelsky-cloud",
  version: "0.4.0",
  features: ["animation-generation", "parameter-validation", "rgb565-projects"],
});
