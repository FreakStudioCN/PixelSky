import { useRef } from "react";
import { CheckCircle2, ClipboardCheck, Cpu, HardDrive, Loader2, MemoryStick, Siren, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeviceCheck, FirmwareInfo, FirmwarePlan } from "@/lib/helper";

interface WorkshopCardProps {
  port: string;
  result: DeviceCheck | null;
  firmwareName: string;
  firmwareInfo: FirmwareInfo | null;
  firmwarePlan: FirmwarePlan | null;
  firmwareConfirmed: boolean;
  firmwareTarget: string;
  busy: "check" | "led" | "firmware" | "flash" | "manual" | "deploy" | null;
  onCheck: () => void;
  onLedTest: () => void;
  onFirmware: (file: File) => void;
  onPrepareFirmware: () => void;
  onFirmwareConfirmed: (confirmed: boolean) => void;
  onOfficialFlash: () => void;
  onManualFlash: () => void;
  onDeploy: () => void;
}

export function WorkshopCard({ port, result, firmwareName, firmwareInfo, firmwarePlan, firmwareConfirmed, firmwareTarget, busy, onCheck, onLedTest, onFirmware, onPrepareFirmware, onFirmwareConfirmed, onOfficialFlash, onManualFlash, onDeploy }: WorkshopCardProps) {
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
      <div aria-label="自动匹配的 MicroPython 固件" className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 font-mono text-xs" title="由上方开发板自动匹配">{firmwareTarget}</div>
      <Button variant="outline" onClick={onPrepareFirmware} disabled={disabled}>{busy === "firmware" ? <Loader2 className="animate-spin" /> : <Upload />}获取官方 latest 固件</Button>
      <Button onClick={onDeploy} disabled={disabled}>{busy === "deploy" ? <Loader2 className="animate-spin" /> : <Zap />}课堂快速部署</Button>
    </div>
    {firmwareInfo && firmwarePlan && <div className="mt-3 rounded-lg border border-warn/40 bg-warn/5 p-3 text-xs">
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
        <span>固件：{firmwareInfo.board} {firmwareInfo.version}</span><span>发布日期：{firmwareInfo.release_date}</span>
        <span>串口：{firmwarePlan.port}</span><span>写入：{firmwarePlan.write_offset} · {firmwarePlan.baud} baud</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">计划：{firmwarePlan.erase_command} → {firmwarePlan.write_command}；成功后保存烧录日志。</p>
      <p className="mt-2 break-all text-[11px] text-muted-foreground">来源：{firmwareInfo.url}</p>
      <label className="mt-3 flex items-start gap-2"><input className="mt-0.5" type="checkbox" checked={firmwareConfirmed} onChange={(event) => onFirmwareConfirmed(event.target.checked)} disabled={busy !== null} /><span>我已核对串口、板卡和烧录计划，并确认擦除该设备的全部 Flash 数据。</span></label>
      <Button className="mt-3" variant="outline" size="sm" onClick={onOfficialFlash} disabled={disabled || !firmwareConfirmed}>{busy === "flash" ? <Loader2 className="animate-spin" /> : <Cpu />}确认并烧录官方固件</Button>
    </div>}
    <details className="mt-3 rounded-lg border border-border bg-background p-3 text-xs">
      <summary className="cursor-pointer text-muted-foreground">离线备用：手动选择本地 .bin 固件</summary>
      <input ref={picker} hidden type="file" accept=".bin,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFirmware(file); }} />
      <div className="mt-3 flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => picker.current?.click()} disabled={busy !== null}><Upload />{firmwareName || "选择本地 .bin"}</Button><Button variant="outline" size="sm" onClick={onManualFlash} disabled={disabled || !firmwareName}>{busy === "manual" ? <Loader2 className="animate-spin" /> : <Cpu />}烧录本地固件</Button></div>
    </details>
    <p className="mt-2 text-[11px] text-muted-foreground">官方固件由 Helper 从 MicroPython 下载页解析并缓存；烧录完成后再执行“课堂快速部署”。</p>
    {result && <div className="mt-4 grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-2 xl:grid-cols-4">
      <span className="flex items-center gap-2 text-xs"><CheckCircle2 className="h-4 w-4 text-primary" />MicroPython {result.micropython}</span>
      <span className="flex items-center gap-2 text-xs"><Cpu className="h-4 w-4 text-primary" />{result.machine}</span>
      <span className="flex items-center gap-2 text-xs"><MemoryStick className="h-4 w-4 text-primary" />内存 {Math.round(result.free_memory / 1024)} KB</span>
      <span className="flex items-center gap-2 text-xs"><HardDrive className="h-4 w-4 text-primary" />存储 {Math.round(result.free_storage / 1024)} KB</span>
    </div>}
  </section>;
}
