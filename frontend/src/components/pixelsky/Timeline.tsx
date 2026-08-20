import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, GripVertical, Pause, Play, Plus, Repeat2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { EMPTY, MAX_FRAMES, type Frame } from "@/lib/pixel";
import { cn } from "@/lib/utils";

interface TimelineProps {
  frames: Frame[];
  activeIndex: number;
  previewIndex: number;
  playing: boolean;
  fps: number;
  brightness: number;
  frameDurations: number[];
  loop: boolean;
  width: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onLoopChange: (loop: boolean) => void;
  onDurationChange: (index: number, duration: number) => void;
  onTogglePlay: () => void;
  onFpsChange: (fps: number) => void;
  onBrightnessChange: (value: number) => void;
}

function FrameThumb({ frame, width }: { frame: Frame; width: number }) {
  return (
    <div
      className="grid w-full gap-px"
      style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
    >
      {frame.map((color, index) => (
        <span
          key={index}
          className="aspect-square rounded-[1px]"
          style={{ backgroundColor: color ?? EMPTY }}
        />
      ))}
    </div>
  );
}

export function Timeline({
  frames,
  activeIndex,
  previewIndex,
  playing,
  fps,
  brightness,
  frameDurations,
  loop,
  width,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onUndo,
  canUndo,
  onReorder,
  onPrevious,
  onNext,
  onLoopChange,
  onDurationChange,
  onTogglePlay,
  onFpsChange,
  onBrightnessChange,
}: TimelineProps) {
  const duration = (frameDurations.reduce((total, value) => total + value, 0) / 1000).toFixed(2);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="leading-tight">
          <p className="panel-label">Timeline</p>
          <h2 className="text-sm font-semibold">
            动画帧 <span className="text-muted-foreground">{frames.length} / {MAX_FRAMES}</span>
          </h2>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onUndo} disabled={!canUndo}>
            <Undo2 className="h-3.5 w-3.5" /> 撤销
          </Button>
          <Button variant="outline" size="sm" onClick={onPrevious} aria-label="上一帧">
            <ChevronLeft className="h-3.5 w-3.5" /> 上一帧
          </Button>
          <Button variant="outline" size="sm" onClick={onNext} aria-label="下一帧">
            <ChevronRight className="h-3.5 w-3.5" /> 下一帧
          </Button>
          <Button variant={loop ? "secondary" : "outline"} size="sm" onClick={() => onLoopChange(!loop)} aria-pressed={loop}>
            <Repeat2 className="h-3.5 w-3.5" /> {loop ? "循环开" : "循环关"}
          </Button>
          <Button variant="outline" size="sm" onClick={onAdd} disabled={frames.length >= MAX_FRAMES}>
            <Plus className="h-3.5 w-3.5" /> 添加帧
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            disabled={frames.length >= MAX_FRAMES}
          >
            <Copy className="h-3.5 w-3.5" /> 复制帧
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} disabled={frames.length <= 1}>
            <Trash2 className="h-3.5 w-3.5" /> 删除帧
          </Button>
          <Button size="sm" onClick={onTogglePlay} disabled={frames.length < 2}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "暂停" : "播放"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {frames.map((frame, index) => (
            <div
              key={index}
              draggable={frames.length > 1}
              onDragStart={(event) => {
                setDragIndex(index);
                setDropIndex(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const fromIndex = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
                if (Number.isInteger(fromIndex) && fromIndex !== index) onReorder(fromIndex, index);
                setDragIndex(null);
                setDropIndex(null);
              }}
              onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
              className={cn(
                "relative shrink-0 rounded-lg transition-all",
                frames.length > 1 && "cursor-grab active:cursor-grabbing",
                dragIndex === index && "opacity-40",
                dropIndex === index && dragIndex !== index && "translate-x-1 ring-2 ring-primary/60",
              )}
              style={{ width: "8.5rem" }}
            >
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`帧 ${String(index + 1).padStart(2, "0")}，拖动可排序`}
                className={cn(
                  "w-full rounded-lg border bg-background p-1.5 text-left transition-colors",
                  index === activeIndex ? "border-primary glow-ring" : "border-border hover:border-primary/40",
                  playing && index === previewIndex && "border-primary/70",
                )}
              >
                <FrameThumb frame={frame} width={width} />
                <span className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>帧 {String(index + 1).padStart(2, "0")}</span>
                  {frames.length > 1 && <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
              </button>
              <label className="mt-1 flex items-center justify-end gap-1 px-1 font-mono text-[9px] text-muted-foreground" onClick={(event) => event.stopPropagation()}>
                <span className="sr-only">帧 {String(index + 1).padStart(2, "0")} 时长</span>
                <input
                  draggable={false}
                  type="number"
                  min={100}
                  step={50}
                  value={frameDurations[index] ?? Math.max(100, Math.round(1000 / fps))}
                  onChange={(event) => onDurationChange(index, Math.max(100, Number(event.target.value) || 100))}
                  className="h-5 w-14 rounded border border-border bg-surface-raised px-1 text-right text-[9px] text-foreground outline-none focus:border-primary"
                />
                <span>ms</span>
              </label>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-lg border border-border bg-surface-raised/50 p-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="panel-label">帧率 FPS</span>
              <span className="font-mono text-xs text-primary">{fps}</span>
            </div>
            <Slider
              className="mt-2"
              min={1}
              max={10}
              step={1}
              value={[fps]}
              onValueChange={(value) => onFpsChange(value[0] ?? fps)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="panel-label">亮度</span>
              <span className="font-mono text-xs text-primary">{brightness}%</span>
            </div>
            <Slider
              className="mt-2"
              min={1}
              max={100}
              step={1}
              value={[brightness]}
              onValueChange={(value) => onBrightnessChange(value[0] ?? brightness)}
            />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            循环时长 {duration}s · {frames.length} 帧 @ {fps}fps
          </p>
        </div>
      </div>
    </section>
  );
}
