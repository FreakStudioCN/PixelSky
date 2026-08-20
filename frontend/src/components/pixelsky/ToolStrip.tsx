import { Brush, Eraser, Redo2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRESET_SWATCHES, normalizeHex } from "@/lib/pixel";
import { cn } from "@/lib/utils";

export type Tool = "brush" | "eraser";

interface ToolStripProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function ToolStrip({
  tool,
  onToolChange,
  color,
  onColorChange,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-raised/60 p-3">
      <div className="flex items-center rounded-lg border border-border bg-background p-1">
        {(
          [
            { id: "brush" as Tool, label: "画笔", icon: Brush },
            { id: "eraser" as Tool, label: "橡皮", icon: Eraser },
          ]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onToolChange(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tool === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
        <label className="relative h-6 w-6 overflow-hidden rounded-md border border-border">
          <input
            type="color"
            value={color}
            onChange={(event) => onColorChange(event.target.value.toUpperCase())}
            className="absolute -left-2 -top-2 h-12 w-12 cursor-pointer border-0 bg-transparent p-0"
            aria-label="选择颜色"
          />
        </label>
        <input
          value={color}
          onChange={(event) => {
            const hex = normalizeHex(event.target.value);
            onColorChange(hex ?? event.target.value.toUpperCase());
          }}
          onBlur={(event) => onColorChange(normalizeHex(event.target.value) ?? "#31F5C3")}
          className="w-[5.5rem] bg-transparent font-mono text-xs uppercase text-foreground outline-none"
          aria-label="颜色十六进制值"
          maxLength={7}
        />
      </div>

      <div className="flex items-center gap-1.5">
        {PRESET_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            title={swatch}
            onClick={() => onColorChange(swatch)}
            className={cn(
              "h-6 w-6 rounded-md border transition-transform hover:scale-110",
              color.toUpperCase() === swatch ? "border-primary glow-ring" : "border-border",
            )}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="h-3.5 w-3.5" /> 撤销
        </Button>
        <Button variant="outline" size="sm" onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="h-3.5 w-3.5" /> 重做
        </Button>
        <Button variant="outline" size="sm" onClick={onClear}>
          <Trash2 className="h-3.5 w-3.5" /> 清空
        </Button>
      </div>
    </div>
  );
}
