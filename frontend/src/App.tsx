import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Grid3X3, Pencil, X } from "lucide-react";
import { AiCard } from "@/components/pixelsky/AiCard";
import { BasicModeCard } from "@/components/pixelsky/BasicModeCard";
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
import { codeFilename, downloadText, toArduinoCode, toMicroPythonCode, type CodeExportFormat } from "@/lib/codegen";
import { classifyWeather, renderBasicFrame, type BasicColors, type BasicDisplay, type WeatherKind } from "@/lib/basic-mode";
import { CANVAS_PRESETS, EMPTY, MAX_FRAMES, createProject, defaultFrameName, downloadJson, emptyFrame, frameDurationForFps, parseProject, resizeFrames, safeFileName, sanitizeFrames, toAnimationJson, type EspChip, type Frame, type PixelProject, type ViewMode } from "@/lib/pixel";

type Notice = { text: string; error?: boolean } | null;
type CreationMode = "basic" | "custom";
type HistoryEntry = { frames: Frame[]; frameDurations: number[]; frameNames: string[]; activeIndex: number };
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
  const [frameNames, setFrameNames] = useState(initial.frame_names);
  const [loop, setLoop] = useState(initial.loop);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(initial.fps);
  const [brightness, setBrightness] = useState(initial.brightness);
  const [hardware, setHardware] = useState(() => ({ board: initial.board, pin: initial.pin, pixel_order: initial.pixel_order, matrix_layout: initial.matrix_layout, flip_h: initial.flip_h, flip_v: initial.flip_v, rotate: initial.rotate, gamma: initial.gamma, r_balance: initial.r_balance, g_balance: initial.g_balance, b_balance: initial.b_balance }));
  const [creationMode, setCreationMode] = useState<CreationMode>("custom");
  const [basicDisplay, setBasicDisplay] = useState<BasicDisplay>("time");
  const [basicColors, setBasicColors] = useState<BasicColors>({ primary: "#31F5C3", accent: "#FFD166", background: EMPTY });
  const [weather, setWeather] = useState<WeatherKind>("sunny");
  const [temperature, setTemperature] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [basicAutoSync, setBasicAutoSync] = useState(false);
  const [now, setNow] = useState(() => new Date());
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
  const [chip, setChip] = useState<EspChip>("esp32c3");
  const [notice, setNotice] = useState<Notice>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const lastBasicSync = useRef("");
  const voiceSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  const project: PixelProject = useMemo(() => ({ version: 1, name, width, height, fps, brightness, frames, frame_durations: frameDurations, frame_names: frameNames, loop, ...hardware }), [name, width, height, fps, brightness, frames, frameDurations, frameNames, loop, hardware]);
  const basicFrame = useMemo(() => renderBasicFrame(basicDisplay, now, temperature, weather, basicColors), [basicDisplay, now, temperature, weather, basicColors]);
  const activeProject: PixelProject = useMemo(() => creationMode === "basic" ? ({ ...project, name: `基本模式-${basicDisplay === "time" ? "时间" : basicDisplay === "temperature" ? "温度" : "天气"}`, width: 16, height: 8, fps: 1, frames: [basicFrame], frame_durations: [1000], frame_names: ["实时显示"], loop: true }) : project, [creationMode, project, basicDisplay, basicFrame]);
  const activeWidth = activeProject.width;
  const activeHeight = activeProject.height;
  const tell = useCallback((text: string, error = false) => { setNotice({ text, error }); if (noticeTimer.current) window.clearTimeout(noticeTimer.current); noticeTimer.current = window.setTimeout(() => setNotice(null), 3500); }, []);
  const refreshWeather = useCallback(() => {
    if (!navigator.geolocation) { setWeatherError("当前浏览器不支持定位，时间仍可正常显示"); return; }
    setWeatherLoading(true); setWeatherError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const query = new URLSearchParams({ latitude: coords.latitude.toFixed(5), longitude: coords.longitude.toFixed(5), current: "temperature_2m,weather_code", timezone: "auto", forecast_days: "1" });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
        if (!response.ok) throw new Error(`天气服务返回 ${response.status}`);
        const data = await response.json() as { current?: { temperature_2m?: number; weather_code?: number }; timezone_abbreviation?: string };
        if (typeof data.current?.temperature_2m !== "number" || typeof data.current.weather_code !== "number") throw new Error("天气数据格式不完整");
        setTemperature(data.current.temperature_2m);
        setWeather(classifyWeather(data.current.weather_code));
        setLocationLabel(`${coords.latitude.toFixed(2)}°, ${coords.longitude.toFixed(2)}°${data.timezone_abbreviation ? ` · ${data.timezone_abbreviation}` : ""}`);
      } catch (error) { setWeatherError(error instanceof Error ? error.message : "天气数据加载失败"); }
      finally { setWeatherLoading(false); }
    }, (error) => { setWeatherLoading(false); setWeatherError(error.code === 1 ? "请允许浏览器访问位置，才能获取当地天气" : "无法获取当前位置，请检查系统定位"); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 });
  }, []);
  const currentSnapshot = useCallback((): HistoryEntry => ({ frames: frames.map((frame) => [...frame]), frameDurations: [...frameDurations], frameNames: [...frameNames], activeIndex }), [frames, frameDurations, frameNames, activeIndex]);
  const snapshot = useCallback(() => { setHistory((items) => [...items.slice(-39), currentSnapshot()]); setFuture([]); }, [currentSnapshot]);
  const replaceFrames = (next: Frame[], nextDurations?: number[], nextNames?: string[]) => {
    snapshot();
    setFrames(next);
    setFrameDurations(next.map((_, index) => nextDurations?.[index] ?? frameDurations[index] ?? frameDurationForFps(fps)));
    setFrameNames(next.map((_, index) => nextNames?.[index] ?? frameNames[index] ?? defaultFrameName(index)));
    setActiveIndex((index) => Math.min(index, next.length - 1));
  };

  const refreshPorts = useCallback(async () => {
    setChecking(true);
    try { await getHealth(); const found = await getPorts(); setOnline(true); setPorts(found); setPort((current) => found.includes(current) ? current : (found[0] ?? "")); tell(found.length ? `发现 ${found.length} 个串口` : "Helper 在线，暂未发现设备"); }
    catch (error) { setOnline(false); setPorts([]); tell(error instanceof Error ? error.message : "无法连接本地 Helper", true); }
    finally { setChecking(false); }
  }, [tell]);

  useEffect(() => { void refreshPorts(); }, [refreshPorts]);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 15_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (creationMode !== "basic") return; refreshWeather(); const timer = window.setInterval(refreshWeather, 15 * 60 * 1000); return () => window.clearInterval(timer); }, [creationMode, refreshWeather]);
  useEffect(() => {
    if (creationMode !== "basic" || !basicAutoSync || !port || !online) return;
    const signature = `${basicDisplay}|${basicFrame.join("")}|${activeProject.pin}|${activeProject.pixel_order}|${activeProject.matrix_layout}`;
    if (signature === lastBasicSync.current) return;
    const timer = window.setTimeout(async () => {
      setUploading("animation");
      try { await uploadAnimation({ port, project: activeProject }); lastBasicSync.current = signature; }
      catch (error) { setBasicAutoSync(false); tell(error instanceof Error ? `自动同步已停止：${error.message}` : "自动同步失败", true); }
      finally { setUploading(null); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [creationMode, basicAutoSync, port, online, basicDisplay, basicFrame, activeProject, tell]);
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

  const restoreSnapshot = (entry: HistoryEntry) => { setFrames(entry.frames.map((frame) => [...frame])); setFrameDurations([...entry.frameDurations]); setFrameNames([...entry.frameNames]); setActiveIndex(Math.min(entry.activeIndex, entry.frames.length - 1)); setPlaying(false); };
  const undo = () => { const previous = history.at(-1); if (!previous) return; setFuture((items) => [currentSnapshot(), ...items]); restoreSnapshot(previous); setHistory((items) => items.slice(0, -1)); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory((items) => [...items, currentSnapshot()]); restoreSnapshot(next); setFuture((items) => items.slice(1)); };
  const reorderFrames = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !frames[fromIndex] || !frames[toIndex]) return;
    const next = [...frames];
    const nextDurations = [...frameDurations];
    const nextNames = [...frameNames];
    const [moved] = next.splice(fromIndex, 1);
    const [movedDuration] = nextDurations.splice(fromIndex, 1);
    const [movedName] = nextNames.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    nextDurations.splice(toIndex, 0, movedDuration);
    nextNames.splice(toIndex, 0, movedName);
    replaceFrames(next, nextDurations, nextNames);
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
  const changeFrameName = (index: number, value: string) => setFrameNames((items) => items.map((item, itemIndex) => itemIndex === index ? value.slice(0, 24) : item));
  const addFrame = () => {
    if (frames.length >= MAX_FRAMES) return;
    const nextIndex = frames.length;
    replaceFrames([...frames, emptyFrame(width, height)], [...frameDurations, frameDurationForFps(fps)], [...frameNames, defaultFrameName(nextIndex)]);
    setActiveIndex(nextIndex);
    setPlaying(false);
  };
  const duplicateFrame = () => {
    if (frames.length >= MAX_FRAMES) return;
    const copyIndex = activeIndex + 1;
    const sourceName = frameNames[activeIndex]?.trim() || defaultFrameName(activeIndex);
    replaceFrames(
      [...frames.slice(0, copyIndex), [...frames[activeIndex]], ...frames.slice(copyIndex)],
      [...frameDurations.slice(0, copyIndex), frameDurations[activeIndex] ?? frameDurationForFps(fps), ...frameDurations.slice(copyIndex)],
      [...frameNames.slice(0, copyIndex), `${sourceName} 副本`.slice(0, 24), ...frameNames.slice(copyIndex)],
    );
    setActiveIndex(copyIndex);
    setPlaying(false);
  };
  const deleteFrame = () => {
    if (frames.length <= 1) return;
    replaceFrames(frames.filter((_, index) => index !== activeIndex), frameDurations.filter((_, index) => index !== activeIndex), frameNames.filter((_, index) => index !== activeIndex));
    setPlaying(false);
  };

  const changeCanvas = (presetId: string) => {
    const preset = CANVAS_PRESETS.find((item) => item.id === presetId); if (!preset || (preset.width === width && preset.height === height)) return;
    setFrames(resizeFrames(frames, width, height, preset.width, preset.height)); setWidth(preset.width); setHeight(preset.height);
    setHistory([]); setFuture([]); setActiveIndex(0); setPlaying(false); tell(`画布已切换为 ${preset.width}×${preset.height}`);
  };

  const openProject = async (file?: File) => {
    if (!file) return;
    try { const opened = parseProject(await file.text()); setName(opened.name); setWidth(opened.width); setHeight(opened.height); setFrames(opened.frames); setFrameDurations(opened.frame_durations); setFrameNames(opened.frame_names); setLoop(opened.loop); setFps(opened.fps); setBrightness(opened.brightness); setHardware({ board: opened.board, pin: opened.pin, pixel_order: opened.pixel_order, matrix_layout: opened.matrix_layout, flip_h: opened.flip_h, flip_v: opened.flip_v, rotate: opened.rotate, gamma: opened.gamma, r_balance: opened.r_balance, g_balance: opened.g_balance, b_balance: opened.b_balance }); setChip(opened.board === "esp32_wroom" ? "esp32" : "esp32c3"); setCreationMode("custom"); setHistory([]); setFuture([]); setActiveIndex(0); setPlaying(false); tell("项目或 RGB565 文件已导入"); }
    catch (error) { tell(error instanceof Error ? error.message : "项目 JSON 格式无效", true); }
  };

  const generate = async () => {
    if (!prompt.trim()) return tell("请先输入创意描述", true); setGenerating(true);
    try { const data = await generateAnimation({ prompt: prompt.trim(), width, height, fps, brightness }); const next = sanitizeFrames(data.project?.frames, width, height); replaceFrames(next, next.map(() => frameDurationForFps(fps)), next.map((_, index) => `AI ${defaultFrameName(index)}`)); setActiveIndex(0); setPlaying(false); tell(data.source === "deepseek" ? `DeepSeek 已生成 ${width}×${height} 像素动画` : "DeepSeek 暂时不可用，已生成匹配主题的备用像素动画", data.source !== "deepseek"); }
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
    try { if (mode === "runtime") await uploadRuntime({ port, project: activeProject }); else await uploadAnimation({ port, project: activeProject }); tell(mode === "runtime" ? "完整运行时上传成功" : "动画已更新，设备正在重启"); }
    catch (error) { tell(error instanceof Error ? error.message : "上传失败", true); }
    finally { setUploading(null); }
  };

  const workshopAction = async (action: "check" | "led" | "flash" | "deploy") => {
    if (!port) return tell("请先选择 ESP32 串口", true); if (action === "flash" && !firmware) return tell("请先选择 MicroPython .bin 固件", true); setWorkshopBusy(action);
    try {
      if (action === "check") { const result = await checkDevice(port); setDeviceResult(result); tell("设备检查全部完成"); }
      if (action === "led") { await testLeds(port, activeWidth * activeHeight, activeProject.pin); tell("灯板红绿蓝测试完成"); }
      if (action === "flash" && firmware) { await flashFirmware(port, firmware, chip); tell("固件烧录完成，请等待设备重启"); }
      if (action === "deploy") { const result = await checkDevice(port); setDeviceResult(result); await uploadRuntime({ port, project: activeProject }); tell("课前检查和课堂部署完成"); }
    } catch (error) { tell(error instanceof Error ? error.message : "设备操作失败", true); }
    finally { setWorkshopBusy(null); }
  };

  const shownFrame = creationMode === "basic" ? basicFrame : (frames[playing ? previewIndex : activeIndex] ?? emptyFrame(width, height));
  const exportFile = (format: CodeExportFormat) => {
    if (format === "json") return downloadJson("animation.json", toAnimationJson(activeProject));
    const code = format === "micropython" ? toMicroPythonCode(activeProject) : toArduinoCode(activeProject);
    downloadText(codeFilename(activeProject, format), code);
    tell(format === "micropython" ? "MicroPython 代码已导出" : "Arduino 代码已导出");
  };
  return <div className="min-h-screen bg-background text-foreground">
    <TopBar name={name} onNameChange={setName} onOpen={() => fileInput.current?.click()} onSave={() => downloadJson(`${safeFileName(name)}.pixelsky.json`, activeProject)} onExport={exportFile} />
    <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={(event) => void openProject(event.target.files?.[0])} />
    <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:p-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="panel min-w-0 p-4 lg:p-5">
        <div className="mb-4 inline-flex rounded-lg border border-border bg-background p-1">
          <button type="button" onClick={() => { setCreationMode("basic"); setPlaying(false); }} className={`rounded-md px-4 py-2 text-xs font-medium ${creationMode === "basic" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>基本模式</button>
          <button type="button" onClick={() => setCreationMode("custom")} className={`rounded-md px-4 py-2 text-xs font-medium ${creationMode === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>自定义绘画</button>
        </div>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div><p className="panel-label">{creationMode === "basic" ? "Locked Live Canvas" : "Manual Pixel Canvas"}</p><h2 className="mt-1 text-lg font-semibold">{creationMode === "basic" ? `基本模式 · ${basicDisplay === "time" ? "时间" : basicDisplay === "temperature" ? "温度" : "天气"}` : "自己绘画"} · {activeWidth} × {activeHeight} 像素画布</h2></div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {creationMode === "custom" ? <select value={`${width}x${height}`} onChange={(event) => changeCanvas(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-xs outline-none">{CANVAS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select> : <span className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">固定 16×8</span>}
            <div className="flex rounded-md border border-border bg-background p-1"><button type="button" onClick={() => setViewMode("creative")} className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs ${viewMode === "creative" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Pencil className="h-3.5 w-3.5" />创作视图</button><button type="button" onClick={() => setViewMode("hardware")} className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs ${viewMode === "hardware" ? "bg-ai text-ai-foreground" : "text-muted-foreground"}`}><Eye className="h-3.5 w-3.5" />硬件视图</button></div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"><Grid3X3 className="h-3.5 w-3.5" />{activeWidth * activeHeight} PIXELS</span>
          </div>
        </div>
        {viewMode === "hardware" && <p className="mb-3 rounded-md border border-ai/30 bg-ai/10 px-3 py-2 text-[11px] text-ai">LED 编号按模块行优先排列，每块 8×8 使用{activeProject.matrix_layout === "column-major-rtl" ? "右起逐列" : "逐行蛇形"}走线；紫色边界表示模块拼接线。硬件视图只读。</p>}
        <PixelCanvas frame={shownFrame} width={activeWidth} height={activeHeight} viewMode={viewMode} readOnly={creationMode === "basic" || viewMode === "hardware"} hardware={activeProject} onStrokeStart={snapshot} onStrokeEnd={() => undefined} onPaint={(index) => setFrames((items) => items.map((frame, frameIndex) => frameIndex === activeIndex ? frame.map((value, pixelIndex) => pixelIndex === index ? (tool === "eraser" ? EMPTY : color) : value) : frame))} />
        {creationMode === "custom" && <div className="mt-4"><ToolStrip tool={tool} onToolChange={setTool} color={color} onColorChange={setColor} onClear={() => replaceFrames(frames.map((frame, index) => index === activeIndex ? emptyFrame(width, height) : frame))} onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={future.length > 0} /></div>}
      </section>
      <aside className="grid content-start gap-4">
        {creationMode === "basic" ? <BasicModeCard display={basicDisplay} colors={basicColors} temperature={temperature} weather={weather} locationLabel={locationLabel} loading={weatherLoading} error={weatherError} autoSync={basicAutoSync} syncDisabled={!online || !port} syncing={uploading === "animation"} onDisplayChange={setBasicDisplay} onColorsChange={setBasicColors} onRefresh={refreshWeather} onAutoSyncChange={(enabled) => { lastBasicSync.current = ""; setBasicAutoSync(enabled); }} /> : <AiCard prompt={prompt} onPromptChange={setPrompt} onGenerate={() => void generate()} loading={generating} listening={listening} voiceSupported={voiceSupported} onToggleVoice={toggleVoice} />}
        <DeviceCard online={online} checking={checking} ports={ports} port={port} onPortChange={setPort} onRefresh={() => void refreshPorts()} onUploadRuntime={() => void sendToDevice("runtime")} onUploadAnimation={() => void sendToDevice("animation")} busy={uploading} />
      </aside>
      {creationMode === "custom" && <><div className="xl:col-span-2"><Timeline frames={frames} frameDurations={frameDurations} frameNames={frameNames} loop={loop} width={width} activeIndex={activeIndex} previewIndex={previewIndex} playing={playing} fps={fps} brightness={brightness} onSelect={(index) => { setActiveIndex(index); setPlaying(false); }} onAdd={addFrame} onDuplicate={duplicateFrame} onDelete={deleteFrame} onUndo={undo} canUndo={history.length > 0} onReorder={reorderFrames} onPrevious={() => { setActiveIndex((index) => (index - 1 + frames.length) % frames.length); setPlaying(false); }} onNext={() => { setActiveIndex((index) => (index + 1) % frames.length); setPlaying(false); }} onLoopChange={setLoop} onDurationChange={changeFrameDuration} onNameChange={changeFrameName} onTogglePlay={() => { if (playing) setActiveIndex(previewIndex); else setPreviewIndex(activeIndex); setPlaying((value) => !value); }} onFpsChange={(nextFps) => { setFps(nextFps); setFrameDurations((items) => items.map(() => frameDurationForFps(nextFps))); }} onBrightnessChange={setBrightness} /></div>
      <div className="xl:col-span-2"><MediaCard width={width} height={height} color={color} onFrames={(next, mediaName) => { replaceFrames(next, next.map(() => frameDurationForFps(fps)), next.map((_, index) => defaultFrameName(index))); setName(mediaName); setActiveIndex(0); setPlaying(false); tell("媒体已转换为可编辑像素动画"); }} /></div></>}
      <div className="xl:col-span-2"><HardwareSettingsCard project={activeProject} onChange={(patch) => { setHardware((current) => ({ ...current, ...patch })); if (patch.board) setChip(patch.board === "esp32_wroom" ? "esp32" : "esp32c3"); }} /></div>
      <div className="xl:col-span-2"><CodePanel project={activeProject} /></div>
      <div className="xl:col-span-2"><WorkshopCard port={port} result={deviceResult} firmwareName={firmware?.name ?? ""} chip={chip} busy={workshopBusy} onChipChange={setChip} onCheck={() => void workshopAction("check")} onLedTest={() => void workshopAction("led")} onFirmware={setFirmware} onFlash={() => void workshopAction("flash")} onDeploy={() => void workshopAction("deploy")} /></div>
    </main>
      <footer className="border-t border-border px-6 py-3 font-mono text-[10px] text-muted-foreground"><div className="mx-auto flex max-w-[1550px] flex-wrap justify-between gap-2"><span>{online ? "● 本地服务已连接" : "○ 离线编辑模式"}</span><span>{activeProject.board === "esp32_wroom" ? "ESP32 WROOM" : "XIAO ESP32-C3"} · GPIO {activeProject.pin} · {activeProject.pixel_order} · {activeProject.matrix_layout === "column-major-rtl" ? "右起逐列" : "逐行蛇形"} · 最多 {MAX_FRAMES} 帧</span><span>PixelSky Studio · v0.5</span></div></footer>
    {notice && <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-2xl ${notice.error ? "border-destructive/60 bg-destructive/20" : "border-primary/50 bg-surface-raised"}`}><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="关闭提示"><X className="h-4 w-4" /></button></div>}
  </div>;
}
