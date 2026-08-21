import { EMPTY, emptyFrame, type Frame } from "./pixel";

export type BasicDisplay = "time" | "temperature" | "weather";
export type WeatherKind = "sunny" | "partly-cloudy" | "cloudy" | "rain" | "thunderstorm" | "snow" | "fog";

export interface BasicColors {
  primary: string;
  cloud: string;
  precipitation: string;
  accent: string;
  background: string;
}

export const WEATHER_LABELS: Record<WeatherKind, string> = {
  sunny: "晴", "partly-cloudy": "多云", cloudy: "阴", rain: "雨", thunderstorm: "雷阵雨", snow: "雪", fog: "雾霾",
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

const TIME_GLYPHS: Record<string, string[]> = {
  "0": ["11", "10", "10", "10", "11"], "1": ["01", "11", "01", "01", "11"],
  "2": ["11", "01", "11", "10", "11"], "3": ["11", "01", "11", "01", "11"],
  "4": ["10", "10", "11", "01", "01"], "5": ["11", "10", "11", "01", "11"],
  "6": ["10", "10", "11", "10", "11"], "7": ["11", "01", "01", "01", "01"],
  "8": ["11", "11", "11", "11", "11"], "9": ["11", "10", "11", "01", "01"],
  ":": ["0", "1", "0", "1", "0"],
};

const makeFrame = (background: string) => Array.from({ length: 128 }, () => background || EMPTY);
const set = (frame: Frame, x: number, y: number, color: string) => { if (x >= 0 && x < 16 && y >= 0 && y < 8) frame[y * 16 + x] = color; };

const drawText = (text: string, colors: BasicColors, glyphSet = GLYPHS): Frame => {
  const frame = makeFrame(colors.background);
  const glyphs = [...text].map((char) => glyphSet[char] ?? glyphSet["0"]);
  const rawWidth = glyphs.reduce((sum, glyph) => sum + glyph[0].length, 0);
  const spacedGaps = Math.min(Math.max(0, glyphs.length - 1), Math.max(0, 16 - rawWidth));
  const width = rawWidth + spacedGaps;
  let x = Math.max(0, Math.floor((16 - width) / 2));
  glyphs.forEach((glyph, index) => {
    glyph.forEach((row, y) => [...row].forEach((value, offset) => { if (value === "1") set(frame, x + offset, y + 1, colors.cloud); }));
    x += glyph[0].length + (index < spacedGaps ? 1 : 0);
  });
  return frame;
};

export const WEATHER_TEMPLATES: Record<WeatherKind, string[]> = {
  sunny: [
    "................", "......HHHH......", ".....HPPPPH.....", ".....HPPPPH.....",
    ".....HPPPPH.....", ".....HPPPPH.....", "......HHHH......", "................",
  ],
  "partly-cloudy": [
    "................", ".....CCCC.......", "....CCCCCC......", "....CCCCCCCC....",
    "...CCCCCCCCCC...", "..CCCCCCCCCCCC..", "..CCCCCCCCCCCC..", "................",
  ],
  cloudy: [
    "................", ".....CCCC.......", "....CCCCCC......", "....CCCCCCCC....",
    "...CCCCCCCCCC...", "..CCCCCCCCCCCC..", "..CCCCCCCCCCCC..", "................",
  ],
  rain: [
    ".....CCCC.......", "....CCCCCCC.....", "...CCCCCCCCC....", "...R...R...R....",
    "...R.R...R......", ".....R...R.R....", "...R...R...R....", ".......R........",
  ],
  thunderstorm: [
    ".....CCCC.......", "....CCCCCCC.....", "...CCCCCCCCC....", ".....H.R...R....",
    "....H....R......", ".....H...R.R....", "....H..R...R....", ".......R........",
  ],
  snow: [
    ".....CCCC.......", "....CCCCCCC.....", "...CCCCCCCCC....", ".......S...S....",
    "...S.S...S......", "................", "...S...S...S....", ".....S...S......",
  ],
  fog: [
    "................", "......CCCC......", "....CCCCCCC.....", "...CCCCCCCCC....",
    "................", "..M.M.M.M.M.M...", "...M.M.M.M.M....", "................",
  ],
};

const dimHex = (hex: string, factor: number) => {
  const clean = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => Math.round(parseInt(clean.slice(index, index + 2), 16) * factor));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

export const renderWeather = (kind: WeatherKind, colors: BasicColors): Frame => {
  const frame = makeFrame(colors.background);
  const roleColors: Record<string, string> = {
    P: colors.primary,
    H: colors.accent,
    C: kind === "cloudy" ? dimHex(colors.cloud, .56) : colors.cloud,
    R: colors.precipitation,
    S: colors.cloud,
    M: colors.cloud,
  };
  WEATHER_TEMPLATES[kind].forEach((row, y) => [...row].forEach((role, x) => { if (role !== ".") set(frame, x, y, roleColors[role]); }));
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
  return drawText(`${hour}:${minute}`, colors, TIME_GLYPHS);
};

export const blankBasicFrame = () => emptyFrame(16, 8);
