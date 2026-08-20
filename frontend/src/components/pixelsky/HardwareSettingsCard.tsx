import { SlidersHorizontal } from "lucide-react";
import type { MatrixLayout, PixelOrder, PixelProject } from "@/lib/pixel";

interface HardwareSettingsCardProps { project: PixelProject; onChange: (patch: Partial<PixelProject>) => void }
const ORDERS: PixelOrder[] = ["RGB", "GRB", "BGR", "BRG", "RBG", "GBR"];

export function HardwareSettingsCard({ project, onChange }: HardwareSettingsCardProps) {
  const range = (key: "gamma" | "r_balance" | "g_balance" | "b_balance", label: string, min: number, max: number) => <label className="grid gap-1 text-[10px] text-muted-foreground"><span className="flex justify-between"><span>{label}</span><b className="font-mono text-primary">{project[key].toFixed(1)}</b></span><input type="range" min={min} max={max} step="0.1" value={project[key]} onChange={(event) => onChange({ [key]: Number(event.target.value) })} className="accent-[var(--primary)]" /></label>;
  return <section className="panel p-4">
    <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary"><SlidersHorizontal className="h-4 w-4" /></span><div><p className="panel-label">Matrix Calibration</p><h2 className="text-sm font-semibold">矩阵方向与色彩校准</h2></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="grid gap-1 text-[10px] text-muted-foreground">GPIO<input type="number" min="0" max="48" value={project.pin} onChange={(event) => onChange({ pin: Number(event.target.value) })} className="h-9 rounded-md border border-input bg-background px-3 font-mono text-xs text-foreground" /></label>
      <label className="grid gap-1 text-[10px] text-muted-foreground">颜色顺序<select value={project.pixel_order} onChange={(event) => onChange({ pixel_order: event.target.value as PixelOrder })} className="h-9 rounded-md border border-input bg-background px-3 font-mono text-xs text-foreground">{ORDERS.map((order) => <option key={order}>{order}</option>)}</select></label>
      <label className="grid gap-1 text-[10px] text-muted-foreground">矩阵走线<select value={project.matrix_layout} onChange={(event) => onChange({ matrix_layout: event.target.value as MatrixLayout })} className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"><option value="column-major-rtl">右起逐列（当前板）</option><option value="row-serpentine">逐行蛇形</option></select></label>
      <label className="grid gap-1 text-[10px] text-muted-foreground">旋转<select value={project.rotate} onChange={(event) => onChange({ rotate: Number(event.target.value) as 0 | 90 | 180 | 270 })} className="h-9 rounded-md border border-input bg-background px-3 font-mono text-xs text-foreground"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>
      <div className="grid grid-cols-2 gap-2 pt-4"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={project.flip_h} onChange={(event) => onChange({ flip_h: event.target.checked })} />水平翻转</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={project.flip_v} onChange={(event) => onChange({ flip_v: event.target.checked })} />垂直翻转</label></div>
    </div>
    <div className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-2 xl:grid-cols-4">{range("gamma", "Gamma", .2, 3)}{range("r_balance", "红通道", 0, 2)}{range("g_balance", "绿通道", 0, 2)}{range("b_balance", "蓝通道", 0, 2)}</div>
  </section>;
}
