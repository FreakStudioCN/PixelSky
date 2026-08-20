import { Download, FolderOpen, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  name: string;
  onNameChange: (name: string) => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
}

export function TopBar({ name, onNameChange, onOpen, onSave, onExport }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary glow-ring">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <h1 className="font-display text-sm font-semibold tracking-tight">PixelSky</h1>
            <p className="panel-label">像素动画工作台</p>
          </div>
        </div>

        <div className="mx-2 hidden h-6 w-px bg-border sm:block" />

        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          aria-label="项目名称"
          placeholder="项目名称"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium outline-none transition-colors hover:border-border focus:border-primary/60 focus:bg-surface"
        />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpen}>
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">打开项目</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">保存项目</span>
          </Button>
          <Button size="sm" onClick={onExport}>
            <Download className="h-3.5 w-3.5" />
            导出动画
          </Button>
        </div>
      </div>
    </header>
  );
}
