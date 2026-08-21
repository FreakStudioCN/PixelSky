import { CloudSun, LocateFixed, Loader2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WEATHER_LABELS, type BasicColors, type BasicDisplay, type WeatherKind } from "@/lib/basic-mode";

interface BasicModeCardProps {
  display: BasicDisplay;
  colors: BasicColors;
  temperature: number | null;
  weather: WeatherKind;
  locationLabel: string;
  loading: boolean;
  error: string;
  autoSync: boolean;
  syncDisabled: boolean;
  syncing: boolean;
  onDisplayChange: (display: BasicDisplay) => void;
  onColorsChange: (colors: BasicColors) => void;
  onRefresh: () => void;
  onAutoSyncChange: (enabled: boolean) => void;
}

const displays: Array<{ value: BasicDisplay; label: string }> = [
  { value: "time", label: "时间" }, { value: "temperature", label: "温度" }, { value: "weather", label: "天气" },
];

export function BasicModeCard({ display, colors, temperature, weather, locationLabel, loading, error, autoSync, syncDisabled, syncing, onDisplayChange, onColorsChange, onRefresh, onAutoSyncChange }: BasicModeCardProps) {
  const colorField = (key: keyof BasicColors, label: string) => <label className="grid gap-1 text-[10px] text-muted-foreground">
    <span>{label}</span><span className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2"><input type="color" value={colors[key]} onChange={(event) => onColorsChange({ ...colors, [key]: event.target.value.toUpperCase() })} className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" /><span className="font-mono text-[10px] text-foreground">{colors[key]}</span></span>
  </label>;
  return <section className="panel p-4">
    <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-md bg-ai/15 text-ai"><CloudSun className="h-4 w-4" /></span><div><p className="panel-label">Live Basic Mode</p><h2 className="text-sm font-semibold">联网时间、温度与天气</h2></div></div>
    <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">{displays.map((item) => <button key={item.value} type="button" onClick={() => onDisplayChange(item.value)} className={`rounded-md px-2 py-2 text-xs ${display === item.value ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}</div>
    <div className="mt-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-xs"><LocateFixed className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate">{locationLabel || "等待定位"}</span><Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "刷新"}</Button></div>
      <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground"><span>天气：{WEATHER_LABELS[weather]}</span><span>温度：{temperature === null ? "--" : `${Math.round(temperature)}°C`}</span></div>
      {error && <p className="mt-2 text-[10px] text-destructive">{error}</p>}
    </div>
    <div className="mt-4 flex items-center gap-2 text-xs font-medium"><Palette className="h-4 w-4 text-primary" />只允许调整颜色</div>
    <div className="mt-2 grid grid-cols-2 gap-2">{colorField("primary", "太阳内色")}{colorField("cloud", "云 / 文字")}{colorField("precipitation", "雨雪色")}{colorField("accent", "阳光 / 闪电")}{colorField("background", "背景")}</div>
    <label className={`mt-4 flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-xs ${syncDisabled ? "opacity-50" : ""}`}><input type="checkbox" checked={autoSync} disabled={syncDisabled} onChange={(event) => onAutoSyncChange(event.target.checked)} /><span className="flex-1">自动同步到已连接的 ESP32</span><span className="font-mono text-[10px] text-muted-foreground">{syncing ? "同步中" : autoSync ? "已开启" : "关闭"}</span></label>
    <p className="mt-3 text-[10px] leading-5 text-muted-foreground">图案和数字字形已锁定，画布固定为 16×8。时间每分钟更新，天气每 15 分钟联网刷新。首次使用请先上传完整运行时，再开启自动同步。天气数据由 Open-Meteo 提供。</p>
  </section>;
}
