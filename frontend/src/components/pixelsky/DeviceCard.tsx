import { Cpu, Loader2, RefreshCw, UploadCloud, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HELPER_BASE } from "@/lib/helper";
import type { BoardProfile } from "@/lib/pixel";
import { cn } from "@/lib/utils";

interface DeviceCardProps {
  online: boolean;
  checking: boolean;
  ports: string[];
  port: string;
  board: BoardProfile;
  onPortChange: (port: string) => void;
  onBoardChange: (board: BoardProfile) => void;
  onRefresh: () => void;
  onUploadRuntime: () => void;
  onUploadAnimation: () => void;
  busy: "runtime" | "animation" | null;
}

export function DeviceCard({
  online,
  checking,
  ports,
  port,
  board,
  onPortChange,
  onBoardChange,
  onRefresh,
  onUploadRuntime,
  onUploadAnimation,
  busy,
}: DeviceCardProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Cpu className="h-3.5 w-3.5" />
        </span>
        <div className="leading-tight">
          <p className="panel-label">Device Bridge</p>
          <h2 className="text-sm font-semibold">连接 ESP32</h2>
        </div>
        <span
          className={cn(
            "ml-auto flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px]",
            online ? "border-primary/40 text-primary" : "border-border text-muted-foreground",
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", online ? "dot-live" : "bg-muted-foreground")}
          />
          {checking ? "检测中" : online ? "Helper 在线" : "Helper 离线"}
        </span>
      </div>

      <label className="mt-3 grid gap-1 text-[10px] font-medium text-muted-foreground">开发板
        <select value={board} onChange={(event) => onBoardChange(event.target.value as BoardProfile)} className="h-10 rounded-md border border-primary/35 bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary">
          <option value="xiao_esp32c3">XIAO ESP32-C3（GPIO2）</option>
          <option value="esp32_wroom">ESP32 WROOM / WROOM-32（GPIO5）</option>
        </select>
      </label>

      <div className="mt-3 flex items-center gap-2">
        <Select value={port} onValueChange={onPortChange} disabled={!ports.length}>
          <SelectTrigger className="flex-1 bg-background font-mono text-xs">
            <SelectValue placeholder={ports.length ? "选择串口" : "未检测到串口"} />
          </SelectTrigger>
          <SelectContent>
            {ports.map((item) => (
              <SelectItem key={item} value={item} className="font-mono text-xs">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={onRefresh} aria-label="刷新串口">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="mt-3 grid gap-2">
        <Button variant="outline" onClick={onUploadRuntime} disabled={busy !== null}>
          {busy === "runtime" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          上传完整运行时
        </Button>
        <Button onClick={onUploadAnimation} disabled={busy !== null}>
          {busy === "animation" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileJson className="h-4 w-4" />
          )}
          仅更新 animation.json
        </Button>
      </div>

      <p className="mt-3 font-mono text-[10px] text-muted-foreground">{HELPER_BASE}</p>
    </section>
  );
}
