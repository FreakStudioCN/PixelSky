import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Grid3X3, Pencil, X } from "lucide-react";
import { AiCard } from "@/components/pixelsky/AiCard";
import { CodePanel } from "@/components/pixelsky/CodePanel";
import { DeviceCard } from "@/components/pixelsky/DeviceCard";
import { HardwareSettingsCard } from "@/components/pixelsky/HardwareSettingsCard";
import { MediaCard } from "@/components/pixelsky/MediaCard";
import { PixelCanvas } from "@/components/pixelsky/PixelCanvas";
import { Timeline } from "@/components/pixelsky/Timeline";
import { ToolStrip, type Tool } from "@/components/pixelsky/ToolStrip";
import { TopBar } from "@/components/pixelsky/TopBar";
import { WorkshopCard } from "@/components/pixelsky/WorkshopCard";
import { checkDevice, flashFirmware, generateAnimation, getHealth, getPorts, testLeds, uploadAnimation, uploadRuntime, type DeviceCheck } from "@/lib/helper";
import { CANVAS_PRESETS, EMPTY, MAX_FRAMES, createProject, downloadJson, emptyFrame, frameDurationForFps, parseProject, resizeFrames, safeFileName, sanitizeFrames, toAnimationJson, type EspChip, type Frame, type PixelProject, type ViewMode } from "@/lib/pixel";

type Notice = { text: string; error?: boolean } | null;
type HistoryEntry = { frames: Frame[]; frameDurations: number[]; activeIndex: number };
type SpeechResultEvent = Event & { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: SpeechResultEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void };
type SpeechConstructor = new () => SpeechRecognitionLike;
declare global { interface Window { SpeechRecognition?: SpeechConstructor; webkitSpeechRecognition?: SpeechConstructor } }

export default function App() {
  const initial = useMemo(() => createProject("我的像素作品"), []);
  const [name, setName] = useState(initial.name);
  const [width, setWidth] = useState(initial.width);
  const [height, setHeight] = useState(initial.height);
  const [frames, setFrames] = useState<Frame[]>(initial.frames);
  const [frameDurations, setFrameDurations] = useState(initial.frame_durations);
  const [loop, setLoop] = useState(initial.loop);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(initial.fps);
  const [brightness, setBrightness] = useState(initial.brightness);
  const [hardware, setHardware] = useState(() => ({ pin: initial.pin, pixel_order: initial.pixel_order, flip_h: initial.flip_h, flip_v: initial.flip_v, rotate: initial.rotate, gamma: initial.gamma, r_balance: initial.r_balance, g_balance: initial.g_balance, b_balance: initial.b_balance }));
  const [viewMode, setViewMode] = useState<ViewMode>("creative");
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#31F5C3");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [prompt, setPrompt] = useState("让一颗薄荷绿流星划过紫色夜空");
  const [generating, setGenerating] = useState(false);
  const [listening, setListening] = useState(false);
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [ports, setPorts] = useState<string[]>([]);
  const [port, setPort] = useState("");
  const [uploading, setUploading] = useState<"runtime" | "animation" | null>(null);
  const [workshopBusy, setWorkshopBusy] = useState<"check" | "led" | "flash" | "deploy" | null>(null);
  const [deviceResult, setDeviceResult] = useState<DeviceCheck | null>(null);
  const [firmware, setFirmware] = useState<File | null>(null);
  const [chip, setChip] = useState<EspChip>("esp32");
  const [notice, setNotice] = useState<Notice>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const voiceSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  const project: PixelProject = useMemo(() => ({ version: 1, name, width, height, fps, brightness, frames, frame_durations: frameDurations, loop, ...hardware }), [name, width, height, fps, brightness, frames, frameDurations, loop, hardware]);
  const tell = useCallback((text: string, error = false) => { setNotice({ text, error }); if (noticeTimer.current) window.clearTimeout(noticeTimer.current); noticeTimer.current = window.setTimeout(() => setNotice(null), 3500); }, []);
  const currentSnapshot = useCallback((): HistoryEntry => ({ frames: frames.map((frame) => [...frame]), frameDurations: [...frameDurations], activeIndex }), [frames, frameDurations, activeIndex]);
  const snapshot = useCallback(() => { setHistory((items) => [...items.slice(-39), currentSnapshot()]); setFuture([]); }, [currentSnapshot]);
  const replaceFrames = (next: Frame[], nextDurations?: number[]) => {
    snapshot();
    setFrames(next);
    setFrameDurations(next.map((_, index) => nextDurations?.[index] ?? frameDurations[index] ?? frameDurationForFps(fps)));
    setActiveIndex((index) => Math.min(index, next.length - 1));
  };

  const refreshPorts = useCallback(async () => {
    setChecking(true);
    try { await getHealth(); const found = await getPorts(); setOnline(true); setPorts(found); setPort((current) => found.includes(current) ? current : (found[0] ?? "")); tell(found.length ? `发现 ${found.length} 个串口` : "Helper 在线，暂未发现设备"); }
    catch (error) { setOnline(false); setPorts([]); tell(error instanceof Error ? error.message : "无法连接本地 Helper", true); }
    finally { setChecking(false); }
  }, [tell]);

  useEffect(() => { void refreshPorts(); }, [refreshPorts]);
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setTimeout(() => {
      if (previewIndex < frames.length - 1) setPreviewIndex(previewIndex + 1);
      else if (loop) setPreviewIndex(0);
      else { setActiveIndex(previewIndex); setPlaying(false); }
    }, frameDurations[previewIndex] ?? frameDurationForFps(fps));
    return () => window.clearTimeout(timer);
  }, [playing, frames.length, fps, previewIndex, frameDurations, loop]);
  useEffect(() => setPreviewIndex(activeIndex), [activeIndex]);
  useEffect(() => () => recognition.current?.stop(), []);

  const restoreSnapshot = (entry: HistoryEntry) => { setFrames(entry.frames.map((frame) => [...frame])); setFrameDurations([...entry.frameDurations]); setActiveIndex(Math.min(entry.activeIndex, entry.frames.length - 1)); setPlaying(false); };
  const undo = () => { const previous = history.at(-1); if (!previous) return; setFuture((items) => [currentSnapshot(), ...items]); restoreSnapshot(previous); setHistory((items) => items.slice(0, -1)); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory((items) => [...items, currentSnapshot()]); restoreSnapshot(next); setFuture((items) => items.slice(1)); };
  const reorderFrames = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !frames[fromIndex] || !frames[toIndex]) return;
    const next = [...frames];
    const nextDurations = [...frameDurations];
    const [moved] = next.splice(fromIndex, 1);
    const [movedDuration] = nextDurations.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    nextDurations.splice(toIndex, 0, movedDuration);
    replaceFrames(next, nextDurations);
    setActiveIndex((index) => {
      if (index === fromIndex) return toIndex;
      if (fromIndex < index && index <= toIndex) return index - 1;
      if (toIndex <= index && index < fromIndex) return index + 1;
      return index;
    });
    setPlaying(false);
  };
  const changeFrameDuration = (index: number, value: number) => {
    const duration = Math.max(100, Math.round(value));
    if (frameDurations[index] === duration) return;
    snapshot();
    setFrameDurations((items) => items.map((item, itemIndex) => itemIndex === index ? duration : item));
  };

  const changeCanvas = (presetId: string) => {
    const preset = CANVAS_PRESETS.find((item) => item.id === presetId); if (!preset || (preset.width === width && preset.height === height)) return;
    setFrames(resizeFrames(frames, width, height, preset.width, preset.height)); setWidth(preset.width); setHeight(preset.height);
    setHistory([]); setFuture([]); setActiveIndex(0); setPlaying(false); tell(`画布已切换为 ${preset.width}×${preset.height}`);
  };

  const openProject = async (file?: File) => {
    if (!file) return;
    try { const opened = parseProject(await file.text()); setName(opened.name); setWidth(opened.width); setHeight(opened.height); setFrames(opened.frames); setFrameDurations(opened.frame_durations); setLoop(opened.loop); setFps(opened.fps); setBrightness(opened.brightness); setHardware({ pin: opened.pin, pixel_order: opened.pixel_order, flip_h: opened.flip_h, flip_v: opened.flip_v, rotate: opened.rotate, gamma: opened.gamma, r_balance: opened.r_balance, g_balance: opened.g_balance, b_balance: opened.b_balance }); setHistory([]); setFuture([]); setActiveIndex(0); setPlaying(false); tell("项目或 RGB565 文件已导入"); }
    catch (error) { tell(error instanceof Error ? error.message : "项目 JSON 格式无效", true); }
  };

  const generate = async () => {
    if (!prompt.trim()) return tell("请先输入创意描述", true); setGenerating(true);
    try { const data = await generateAnimation({ prompt: prompt.trim(), width, height, fps, brightness }); const next = sanitizeFrames(data.project?.frames, width, height); replaceFrames(next, next.map(() => frameDurationForFps(fps))); setActiveIndex(0); setPlaying(false); tell("像素动画已生成"); }
    catch (error) { tell(error instanceof Error ? error.message : "生成失败", true); }
    finally { setGenerating(false); }
  };

  const toggleVoice = () => {
    if (listening) { recognition.current?.stop(); return; }
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Constructor) return tell("当前浏览器不支持语音识别", true);
    const instance = new Constructor(); recognition.current = instance; instance.lang = "zh-CN"; instance.continuous = false; instance.interimResults = false;
    instance.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript ?? ""; if (transcript) setPrompt((current) => current ? `${current}，${transcript}` : transcript); };
    instance.onend = () => setListening(false); instance.onerror = () => { setListening(false); tell("语音识别失败，请检查麦克风权限", true); };
    instance.start(); setListening(true);
  };

  const sendToDevice = async (mode: "runtime" | "animation") => {
    if (!port) return tell("请先选择 ESP32 串口", true); setUploading(mode);
    try { if (mode === "runtime") await uploadRuntime({ port, project }); else await uploadAnimation({ port, project }); tell(mode === "runtime" ? "完整运行时上传成功" : "动画已更新，设备正在重启"); }
    catch (error) { tell(error instanceof Error ? error.message : "上传失败", true); }
    finally { setUploading(null); }
  };

  const workshopAction = async (action: "check" | "led" | "flash" | "deploy") => {
    if (!port) return tell("请先选择 ESP32 串口", true); if (action === "flash" && !firmware) return tell("请先选择 MicroPython .bin 固件", true); setWorkshopBusy(action);
    try {
      if (action === "check") { const result = await checkDevice(port); setDeviceResult(result); tell("设备检查全部完成"); }
      if (action === "led") { await testLeds(port, width * height); tell("灯板红绿蓝测试完成"); }
      if (action === "flash" && firmware) { await flashFirmware(port, firmware, chip); tell("固件烧录完成，请等待设备重启"); }
      if (action === "deploy") { const result = await checkDevice(port); setDeviceResult(result); await uploadRuntime({ port, project }); tell("课前检查和课堂部署完成"); }
    } catch (error) { tell(error instanceof Error ? error.message : "设备操作失败", true); }
    finally { setWorkshopBusy(null); }
  };

  const shownFrame = frames[playing ? previewIndex : activeIndex] ?? emptyFrame(width, height);
  return <div className="min-h-screen bg-background text-foreground">
    <TopBar name={name} onNameChange={setName} onOpen={() => fileInput.current?.click()} onSave={() => downloadJson(`${safeFileName(name)}.pixelsky.json`, project)} onExport={() => downloadJson("animation.json", toAnimationJson(project))} />
    <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={(event) => void openProject(event.target.files?.[0])} />
    <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:p-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="panel min-w-0 p-4 lg:p-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div><p className="panel-label">Manual Pixel Canvas</p><h2 className="mt-1 text-lg font-semibold">自己绘画 · {width} × {height} 像素画布</h2></div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select value={`${width}x${height}`} onChange={(event) => changeCanvas(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-xs outline-none">{CANVAS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select>
            <div className="flex rounded-md border border-border bg-background p-1"><button type="button" onClick={() => setViewMode("creative")} className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs ${viewMode === "creative" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Pencil className="h-3.5 w-3.5" />创作视图</button><button type="button" onClick={() => setViewMode("hardware")} className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs ${viewMode === "hardware" ? "bg-ai text-ai-foreground" : "text-muted-foreground"}`}><Eye className="h-3.5 w-3.5" />硬件视图</button></div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"><Grid3X3 className="h-3.5 w-3.5" />{width * height} PIXELS</span>
          </div>
        </div>
        {viewMode === "hardware" && <p className="mb-3 rounded-md border border-ai/30 bg-ai/10 px-3 py-2 text-[11px] text-ai">LED 编号按模块行优先排列，每块 8×8 内部蛇形走线；紫色边界表示模块拼接线。硬件视图只读。</p>}
        <PixelCanvas frame={shownFrame} width={width} height={height} viewMode={viewMode} readOnly={viewMode === "hardware"} hardware={project} onStrokeStart={snapshot} onStrokeEnd={() => undefined} onPaint={(index) => setFrames((items) => items.map((frame, frameIndex) => frameIndex === activeIndex ? frame.map((value, pixelIndex) => pixelIndex === index ? (tool === "eraser" ? EMPTY : color) : value) : frame))} />
        <div className="mt-4"><ToolStrip tool={tool} onToolChange={setTool} color={color} onColorChange={setColor} onClear={() => replaceFrames(frames.map((frame, index) => index === activeIndex ? emptyFrame(width, height) : frame))} onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={future.length > 0} /></div>
      </section>
      <aside className="grid content-start gap-4">
        <AiCard prompt={prompt} onPromptChange={setPrompt} onGenerate={() => void generate()} loading={generating} listening={listening} voiceSupported={voiceSupported} onToggleVoice={toggleVoice} />
        <DeviceCard online={online} checking={checking} ports={ports} port={port} onPortChange={setPort} onRefresh={() => void refreshPorts()} onUploadRuntime={() => void sendToDevice("runtime")} onUploadAnimation={() => void sendToDevice("animation")} busy={uploading} />
      </aside>
      <div className="xl:col-span-2"><Timeline frames={frames} frameDurations={frameDurations} loop={loop} width={width} activeIndex={activeIndex} previewIndex={previewIndex} playing={playing} fps={fps} brightness={brightness} onSelect={(index) => { setActiveIndex(index); setPlaying(false); }} onAdd={() => frames.length < MAX_FRAMES && replaceFrames([...frames, emptyFrame(width, height)], [...frameDurations, frameDurationForFps(fps)])} onDuplicate={() => frames.length < MAX_FRAMES && replaceFrames([...frames.slice(0, activeIndex + 1), [...frames[activeIndex]], ...frames.slice(activeIndex + 1)], [...frameDurations.slice(0, activeIndex + 1), frameDurations[activeIndex] ?? frameDurationForFps(fps), ...frameDurations.slice(activeIndex + 1)])} onDelete={() => frames.length > 1 && replaceFrames(frames.filter((_, index) => index !== activeIndex), frameDurations.filter((_, index) => index !== activeIndex))} onUndo={undo} canUndo={history.length > 0} onReorder={reorderFrames} onPrevious={() => { setActiveIndex((index) => (index - 1 + frames.length) % frames.length); setPlaying(false); }} onNext={() => { setActiveIndex((index) => (index + 1) % frames.length); setPlaying(false); }} onLoopChange={setLoop} onDurationChange={changeFrameDuration} onTogglePlay={() => { if (playing) setActiveIndex(previewIndex); else setPreviewIndex(activeIndex); setPlaying((value) => !value); }} onFpsChange={(nextFps) => { setFps(nextFps); setFrameDurations((items) => items.map(() => frameDurationForFps(nextFps))); }} onBrightnessChange={setBrightness} /></div>
      <div className="xl:col-span-2"><MediaCard width={width} height={height} color={color} onFrames={(next, mediaName) => { replaceFrames(next, next.map(() => frameDurationForFps(fps))); setName(mediaName); setActiveIndex(0); setPlaying(false); tell("媒体已转换为可编辑像素动画"); }} /></div>
      <div className="xl:col-span-2"><HardwareSettingsCard project={project} onChange={(patch) => setHardware((current) => ({ ...current, ...patch }))} /></div>
      <div className="xl:col-span-2"><CodePanel project={project} /></div>
      <div className="xl:col-span-2"><WorkshopCard port={port} result={deviceResult} firmwareName={firmware?.name ?? ""} chip={chip} busy={workshopBusy} onChipChange={setChip} onCheck={() => void workshopAction("check")} onLedTest={() => void workshopAction("led")} onFirmware={setFirmware} onFlash={() => void workshopAction("flash")} onDeploy={() => void workshopAction("deploy")} /></div>
    </main>
    <footer className="border-t border-border px-6 py-3 font-mono text-[10px] text-muted-foreground"><div className="mx-auto flex max-w-[1550px] flex-wrap justify-between gap-2"><span>{online ? "● 本地服务已连接" : "○ 离线编辑模式"}</span><span>GPIO {project.pin} · {project.pixel_order} · 8×8 模块内部 Snake · 最多 {MAX_FRAMES} 帧</span><span>PixelSky Studio · v0.4</span></div></footer>
    {notice && <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-2xl ${notice.error ? "border-destructive/60 bg-destructive/20" : "border-primary/50 bg-surface-raised"}`}><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="关闭提示"><X className="h-4 w-4" /></button></div>}
  </div>;
}
