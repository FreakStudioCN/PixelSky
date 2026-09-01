import { useCallback, useEffect, useRef } from "react";
import { EMPTY, mappedHardwareIndex, type PixelProject, type ViewMode } from "@/lib/pixel";
import { cn } from "@/lib/utils";

interface PixelCanvasProps {
  frame: string[];
  width: number;
  height: number;
  viewMode: ViewMode;
  readOnly?: boolean;
  hardware: Pick<PixelProject, "width" | "height" | "matrix_layout" | "flip_h" | "flip_v" | "rotate">;
  onPaint: (index: number) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
}

export function PixelCanvas({ frame, width, height, viewMode, readOnly = false, hardware, onPaint, onStrokeStart, onStrokeEnd }: PixelCanvasProps) {
  const painting = useRef(false);
  const lastIndex = useRef(-1);

  const end = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    lastIndex.current = -1;
    onStrokeEnd();
  }, [onStrokeEnd]);

  useEffect(() => {
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [end]);

  const paintAt = (index: number) => {
    if (lastIndex.current === index) return;
    lastIndex.current = index;
    onPaint(index);
  };

  const indexFromEvent = (event: React.PointerEvent) => {
    const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const attr = el?.dataset?.["cell"];
    return attr ? Number(attr) : -1;
  };

  return (
    <div
      className="relative mx-auto w-full select-none rounded-xl border border-border bg-background p-2 sm:p-3"
      style={{
        touchAction: "none",
        maxWidth: width === 8 && height === 8 ? "38rem" : height === 16 ? "48rem" : undefined,
      }}
    >
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
        onPointerDown={(event) => {
          if (readOnly) return;
          event.preventDefault();
          const index = indexFromEvent(event);
          if (index < 0) return;
          painting.current = true;
          onStrokeStart();
          paintAt(index);
        }}
        onPointerMove={(event) => {
          if (readOnly) return;
          if (!painting.current) return;
          const index = indexFromEvent(event);
          if (index >= 0) paintAt(index);
        }}
      >
        {Array.from({ length: width * height }, (_, index) => {
          const color = frame[index] ?? EMPTY;
          const isEmpty = color.toUpperCase() === EMPTY;
          const x = index % width;
          const y = Math.floor(index / width);
          const deviceIndex = mappedHardwareIndex(x, y, hardware);
          return (
            <button
              key={index}
              type="button"
              data-cell={index}
              aria-label={`像素 ${x + 1},${y + 1}${viewMode === "hardware" ? `，LED ${deviceIndex}` : ""}`}
              className={cn(
                "relative aspect-square rounded-[3px] transition-shadow duration-150",
                isEmpty ? "border border-grid" : "border border-transparent",
                viewMode === "hardware" && hardware.matrix_layout !== "row-major" && (x % 8 === 0 || y % 8 === 0) && "ring-1 ring-inset ring-ai/50",
              )}
              style={{
                backgroundColor: color,
                boxShadow: isEmpty ? undefined : `0 0 10px -1px ${color}`,
              }}
            >
              {viewMode === "hardware" && <span className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-[7px] text-white/55">{deviceIndex}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
