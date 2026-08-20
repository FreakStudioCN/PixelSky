import { useRef } from "react";
import { CheckCircle2, ClipboardCheck, Cpu, HardDrive, Loader2, MemoryStick, Siren, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeviceCheck } from "@/lib/helper";
import type { EspChip } from "@/lib/pixel";

interface WorkshopCardProps {
  port: string;
  result: DeviceCheck | null;
  firmwareName: string;
  chip: EspChip;
  busy: "check" | "led" | "flash" | "deploy" | null;
  onCheck: () => void;
  onChipChange: (chip: EspChip) => void;
  onLedTest: () => void;
  onFirmware: (file: File) => void;
  onFlash: () => void;
  onDeploy: () => void;
}

export function WorkshopCard({ port, result, firmwareName, chip, busy, onCheck, onChipChange, onLedTest, onFirmware, onFlash, onDeploy }: WorkshopCardProps) {
  const picker = useRef<HTMLInputElement>(null);
  const disabled = !port || busy !== null;
  return <section className="panel p-4">
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-warn/15 text-warn"><ClipboardCheck className="h-4 w-4" /></span>
      <div><p className="panel-label">Workshop Deploy</p><h2 className="text-sm font-semibold">课前检查与快速部署</h2></div>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{port || "请先选择串口"}</span>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <Button variant="outline" onClick={onCheck} disabled={disabled}>{busy === "check" ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}一键设备检查</Button>
      <Button variant="outline" onClick={onLedTest} disabled={disabled}>{busy === "led" ? <Loader2 className="animate-spin" /> : <Siren />}红绿蓝灯板测试</Button>
      <select value={chip} onChange={(event) => onChipChange(event.target.value as EspChip)} disabled={busy !== null} className="h-9 rounded-md border border-input bg-background px-3 text-xs"><option value="esp32">ESP32 Generic · 0x1000</option><option value="esp32s2">ESP32-S2 · 0x1000</option><option value="esp32s3">ESP32-S3 · 0x0</option><option value="esp32c3">ESP32-C3 · 0x0</option></select>
      <Button variant="outline" onClick={() => picker.current?.click()} disabled={busy !== null}><Upload />{firmwareName || "选择 .bin 固件"}</Button>
      <Button onClick={onDeploy} disabled={disabled}>{busy === "deploy" ? <Loader2 className="animate-spin" /> : <Zap />}课堂快速部署</Button>
    </div>
    <input ref={picker} hidden type="file" accept=".bin,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFirmware(file); }} />
    <div className="mt-2 flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onFlash} disabled={disabled || !firmwareName}>{busy === "flash" ? <Loader2 className="animate-spin" /> : <Cpu />}擦除并烧录 MicroPython</Button>
      <p className="text-[11px] text-muted-foreground">烧录会清空设备；完成后再执行“课堂快速部署”。</p>
    </div>
    {result && <div className="mt-4 grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-2 xl:grid-cols-4">
      <span className="flex items-center gap-2 text-xs"><CheckCircle2 className="h-4 w-4 text-primary" />MicroPython {result.micropython}</span>
      <span className="flex items-center gap-2 text-xs"><Cpu className="h-4 w-4 text-primary" />{result.machine}</span>
      <span className="flex items-center gap-2 text-xs"><MemoryStick className="h-4 w-4 text-primary" />内存 {Math.round(result.free_memory / 1024)} KB</span>
      <span className="flex items-center gap-2 text-xs"><HardDrive className="h-4 w-4 text-primary" />存储 {Math.round(result.free_storage / 1024)} KB</span>
    </div>}
  </section>;
}
