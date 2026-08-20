import { Loader2, Mic, MicOff, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AiCardProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  loading: boolean;
  listening: boolean;
  voiceSupported: boolean;
  onToggleVoice: () => void;
}

const EXAMPLES = ["流星雨划过夜空", "跳动的心跳线", "彩虹波浪循环"];

export function AiCard({ prompt, onPromptChange, onGenerate, loading, listening, voiceSupported, onToggleVoice }: AiCardProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ai/20 text-ai">
          <Wand2 className="h-3.5 w-3.5" />
        </span>
        <div className="leading-tight">
          <p className="panel-label">Pixel AI</p>
          <h2 className="text-sm font-semibold">描述你的创意</h2>
        </div>
      </div>

      <div className="relative mt-3">
        <Textarea value={prompt} onChange={(event) => onPromptChange(event.target.value)} placeholder="例如：一只小猫在屏幕上眨眼，薄荷绿主色，4 帧循环" rows={4} className="resize-none bg-background pr-11 text-sm" />
        <button type="button" onClick={onToggleVoice} disabled={!voiceSupported} title={voiceSupported ? "语音输入" : "当前浏览器不支持语音识别"} className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md border ${listening ? "border-ai bg-ai/25 text-ai" : "border-border text-muted-foreground"} disabled:opacity-30`}>
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onPromptChange(example)}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-ai/60 hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>

      <Button
        onClick={onGenerate}
        disabled={loading}
        className="mt-3 w-full bg-ai text-ai-foreground hover:bg-ai/90"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {loading ? "生成中…" : "生成像素动画"}
      </Button>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        生成由 DeepSeek 云端处理，结果会直接替换当前所有帧。
      </p>
    </section>
  );
}
