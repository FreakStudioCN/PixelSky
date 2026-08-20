import { useMemo, useState } from "react";
import { Check, Clipboard, Code2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadJson, toAnimationJson, toReferenceImageJson, type PixelProject } from "@/lib/pixel";

interface CodePanelProps {
  project: PixelProject;
}

export function CodePanel({ project }: CodePanelProps) {
  const [file, setFile] = useState<"animation" | "config" | "reference">("animation");
  const [copied, setCopied] = useState(false);
  const animation = useMemo(() => toAnimationJson(project), [project]);
  const reference = useMemo(() => toReferenceImageJson(project), [project]);
  const config = useMemo(() => ({
    pin: project.pin,
    pixel_order: project.pixel_order,
    width: project.width,
    height: project.height,
    matrix_layout: project.matrix_layout,
    module_width: 8,
    module_order: "row-major",
    flip_h: project.flip_h,
    flip_v: project.flip_v,
    rotate: project.rotate,
    gamma: project.gamma,
    r_balance: project.r_balance,
    g_balance: project.g_balance,
    b_balance: project.b_balance,
    brightness: project.brightness / 100,
    fps: project.fps,
  }), [project]);
  const value = file === "animation" ? animation : file === "config" ? config : reference;
  const code = JSON.stringify(value, null, 2);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Code2 className="h-4 w-4" />
        </span>
        <div>
          <p className="panel-label">Live Code</p>
          <h2 className="text-sm font-semibold">设备代码实时预览</h2>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-background p-1">
            <button type="button" onClick={() => setFile("animation")} className={`rounded px-3 py-1.5 font-mono text-[11px] ${file === "animation" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>animation.json</button>
            <button type="button" onClick={() => setFile("config")} className={`rounded px-3 py-1.5 font-mono text-[11px] ${file === "config" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>config.json</button>
            <button type="button" onClick={() => setFile("reference")} className={`rounded px-3 py-1.5 font-mono text-[11px] ${file === "reference" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>pixels.json</button>
          </div>
          <Button variant="outline" size="sm" onClick={() => void copy()}>{copied ? <Check /> : <Clipboard />}{copied ? "已复制" : "复制"}</Button>
          <Button size="sm" onClick={() => downloadJson(`${file}.json`, value)}><Download />下载</Button>
        </div>
      </div>
      <div className="max-h-[28rem] overflow-auto bg-[#030b08] p-4">
        <pre className="whitespace-pre font-mono text-[11px] leading-5 text-[#9debd4]"><code>{code}</code></pre>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">在上方手绘、增删帧或调节亮度后，此处代码会立即更新。</p>
    </section>
  );
}
