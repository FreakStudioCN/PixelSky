import { EMPTY, emptyFrame, type Frame } from "./pixel";

export type BasicDisplay = "time" | "temperature" | "weather";
export type WeatherKind = "sunny" | "partly-cloudy" | "cloudy" | "rain" | "thunderstorm" | "snow" | "fog";

export interface BasicColors {
  primary: string;
  accent: string;
  background: string;
}

export const WEATHER_LABELS: Record<WeatherKind, string> = {
  sunny: "晴", "partly-cloudy": "多云", cloudy: "阴", rain: "雨", thunderstorm: "雷阵雨", snow: "雪", fog: "雾",
};

export const classifyWeather = (code: number): WeatherKind => {
  if (code === 0) return "sunny";
  if (code === 1 || code === 2) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunderstorm";
  return "rain";
};

const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "001", "010", "010"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
  ":": ["0", "1", "0", "1", "0"], "-": ["000", "000", "111", "000", "000"],
  "°": ["11", "11", "00", "00", "00"], C: ["111", "100", "100", "100", "111"],
};

const makeFrame = (background: string) => Array.from({ length: 128 }, () => background || EMPTY);
const set = (frame: Frame, x: number, y: number, color: string) => { if (x >= 0 && x < 16 && y >= 0 && y < 8) frame[y * 16 + x] = color; };
const points = (frame: Frame, values: Array<[number, number]>, color: string) => values.forEach(([x, y]) => set(frame, x, y, color));

const drawText = (text: string, colors: BasicColors): Frame => {
  const frame = makeFrame(colors.background);
  const glyphs = [...text].map((char) => GLYPHS[char] ?? GLYPHS["0"]);
  const rawWidth = glyphs.reduce((sum, glyph) => sum + glyph[0].length, 0);
  const spacedGaps = Math.min(Math.max(0, glyphs.length - 1), Math.max(0, 16 - rawWidth));
  const width = rawWidth + spacedGaps;
  let x = Math.max(0, Math.floor((16 - width) / 2));
  glyphs.forEach((glyph, index) => {
    glyph.forEach((row, y) => [...row].forEach((value, offset) => { if (value === "1") set(frame, x + offset, y + 1, colors.primary); }));
    x += glyph[0].length + (index < spacedGaps ? 1 : 0);
  });
  return frame;
};

const cloud = [[4,3],[5,2],[6,2],[7,3],[8,2],[9,2],[10,3],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4]] as Array<[number, number]>;

export const renderWeather = (kind: WeatherKind, colors: BasicColors): Frame => {
  const frame = makeFrame(colors.background);
  if (kind === "sunny") {
    points(frame, [[7,2],[8,2],[6,3],[7,3],[8,3],[9,3],[6,4],[7,4],[8,4],[9,4],[7,5],[8,5]], colors.primary);
    points(frame, [[7,0],[8,0],[7,7],[8,7],[3,3],[3,4],[12,3],[12,4],[4,0],[11,0],[4,7],[11,7]], colors.accent);
  } else if (kind === "partly-cloudy") {
    points(frame, [[10,0],[11,0],[9,1],[10,1],[11,1],[12,1],[10,2],[11,2],[13,1]], colors.accent);
    points(frame, cloud, colors.primary);
  } else if (kind === "fog") {
    points(frame, [[2,2],[3,2],[4,2],[5,2],[6,2],[8,2],[9,2],[10,2],[11,2],[12,2],[13,2],[3,4],[4,4],[5,4],[6,4],[7,4],[9,4],[10,4],[11,4],[12,4],[2,6],[3,6],[4,6],[5,6],[7,6],[8,6],[9,6],[10,6],[11,6],[12,6],[13,6]], colors.primary);
  } else {
    points(frame, cloud, kind === "cloudy" ? colors.primary : colors.accent);
    if (kind === "cloudy") points(frame, [[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]], colors.accent);
    if (kind === "rain") points(frame, [[4,6],[7,6],[10,6],[5,7],[8,7],[11,7]], colors.primary);
    if (kind === "snow") points(frame, [[4,6],[7,6],[10,6],[4,7],[7,7],[10,7]], colors.primary);
    if (kind === "thunderstorm") points(frame, [[7,5],[9,5],[8,6],[7,7],[9,7]], colors.primary);
  }
  return frame;
};

export const renderBasicFrame = (display: BasicDisplay, now: Date, temperature: number | null, weather: WeatherKind, colors: BasicColors): Frame => {
  if (display === "weather") return renderWeather(weather, colors);
  if (display === "temperature") {
    const rounded = Math.max(-99, Math.min(99, Math.round(temperature ?? 0)));
    return drawText(`${rounded}°C`, colors);
  }
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return drawText(`${hour}:${minute}`, colors);
};

export const blankBasicFrame = () => emptyFrame(16, 8);
