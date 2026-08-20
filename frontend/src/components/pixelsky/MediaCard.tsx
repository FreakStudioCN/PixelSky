import { useRef, useState } from "react";
import { FileImage, Film, Loader2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertMedia, convertText, type ColorAdjustments } from "@/lib/media";
import { MAX_FRAMES, type Frame } from "@/lib/pixel";

interface MediaCardProps { width: number; height: number; color: string; onFrames: (frames: Frame[], name: string) => void }

export function MediaCard({ width, height, color, onFrames }: MediaCardProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("像素");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<ColorAdjustments>({ brightness: 1, contrast: 1, saturation: 1 });
  const update = (key: keyof ColorAdjustments, value: number) => setSettings((current) => ({ ...current, [key]: value }));
  const load = async (file?: File) => { if (!file) return; setBusy(true); setError(""); try { onFrames(await convertMedia(file, width, height, settings), file.name.replace(/\.[^.]+$/, "")); } catch (reason) { setError(reason instanceof Error ? reason.message : "媒体转换失败"); } finally { setBusy(false); } };
  return <section className="panel p-4">
    <div className="flex flex-wrap items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-md bg-ai/15 text-ai"><FileImage className="h-4 w-4" /></span><div><p className="panel-label">Media Converter</p><h2 className="text-sm font-semibold">图片 / 视频 / GIF / 字符转 RGB565</h2></div><span className="ml-auto font-mono text-[10px] text-muted-foreground">目标 {width}×{height} · 最多 {MAX_FRAMES} 帧</span></div>
    <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_2fr]">
      <div className="flex gap-2"><Button className="flex-1" variant="outline" disabled={busy} onClick={() => picker.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <Film />}选择媒体文件</Button><input ref={picker} hidden type="file" accept="image/*,video/*,.gif" onChange={(event) => void load(event.target.files?.[0])} /></div>
      <div className="flex gap-2"><input value={text} onChange={(event) => setText(event.target.value)} maxLength={4} placeholder="输入 1–4 个字符" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" /><Button variant="outline" onClick={() => onFrames(convertText(text || "像", width, height, color, settings), text || "字符")}><Type />生成字符</Button></div>
      <div className="grid grid-cols-3 gap-3 rounded-md border border-border bg-background px-3 py-2">
        {([['brightness','亮度'],['contrast','对比度'],['saturation','饱和度']] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-[10px] text-muted-foreground"><span className="flex justify-between"><span>{label}</span><b className="font-mono text-primary">{settings[key].toFixed(1)}</b></span><input type="range" min="0.2" max="2" step="0.1" value={settings[key]} onChange={(event) => update(key, Number(event.target.value))} className="accent-[var(--primary)]" /></label>)}
      </div>
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground">图片按高质量缩放后分块取平均色；视频和 GIF 最多抽取 {MAX_FRAMES} 帧；转换结果可继续手绘编辑。</p>
    {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
  </section>;
}
