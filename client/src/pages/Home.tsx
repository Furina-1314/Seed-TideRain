import { useEffect, useState, lazy, Suspense, useMemo, useRef, useCallback } from "react";
import { useGame, type StickyNote as StickyNoteEntry } from "@/contexts/GameContext";
import TimerPanel from "@/components/TimerPanel";
import SoundPanel from "@/components/SoundPanel";
import PlantInfo from "@/components/PlantInfo";
import NotesPanel from "@/components/NotesPanel";
import NotesTextPanel from "@/components/NotesTextPanel";
import HabitsPanel from "@/components/HabitsPanel";
import SystemClock from "@/components/SystemClock";

import ProfilePage from "@/components/ProfilePage";
import CalendarView from "@/components/CalendarView";
import FloatingParticles from "@/components/FloatingParticles";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FileText,
  BookText,
  Target,

  Leaf,
  ChevronLeft,
  ChevronRight,
  Timer,
  Volume2,
  Sprout,
  X,
  User,
  Calendar,
} from "lucide-react";

const PlantScene = lazy(() => import("@/components/PlantScene"));

const ASSET_BASE = import.meta.env.BASE_URL;
const CLOUDS_BG = `${ASSET_BASE}assets/clouds-bg.png`;
const HERO_BG = `${ASSET_BASE}assets/hero-bg.png`;

// 随机选择背景图（50%概率）
const RANDOM_BG = Math.random() < 0.5 ? CLOUDS_BG : HERO_BG;
const IS_CLOUDS = RANDOM_BG === CLOUDS_BG;

type RightTab = "todos" | "notes" | "habits";
type MobilePanel = "timer" | "sounds" | "plant" | "todos" | "notes" | "habits" | null;
type PlantDialogQuote = { id: number; type: string; hitokoto: string; from: string | null };
type PlantDialogData = { quote: string; from: string };
type GuideStep = {
  title: string;
  description: string;
  targetClassName: string;
  setup?: () => void;
};

const quoteModules = import.meta.glob("/src/components/DailyQuotes/*.json");

// 自定义背景组件
function CustomBackground() {
  const { state } = useGame();
  if (!state.customBackground) return null;
  return (
    <div 
      className="absolute inset-0 opacity-70" 
      style={{ 
        backgroundImage: `url(${state.customBackground})`, 
        backgroundSize: "cover", 
        backgroundPosition: "center" 
      }} 
    />
  );
}


function StickyNotesOverlay({
  stickyNotes,
  noteMap,
  onMove,
  onUpdate,
  onClose,
  onColor,
  onResize,
}: {
  stickyNotes: StickyNoteEntry[];
  noteMap: Map<string, { id: string; content: string }>;
  onMove: (id: string, x: number, y: number) => void;
  onUpdate: (id: string, content: string) => void;
  onClose: (id: string) => void;
  onColor: (id: string, color: string) => void;
  onResize: (id: string, width: number, height: number) => void;
}) {
  return (
    <>
      {stickyNotes.map((sticky) => {
        const note = noteMap.get(sticky.noteId);
        if (!note) return null;

        return (
          <div
            key={sticky.id}
            className="absolute z-30 rounded-2xl border border-white/30 shadow-2xl backdrop-blur-md overflow-hidden"
            style={{
              left: sticky.x,
              top: sticky.y,
              width: sticky.width || 224,
              height: sticky.height || 192,
              backgroundColor: sticky.color || "#fffef8",
            }}
          >
            <div
              className="flex items-center justify-between px-2.5 py-1.5 bg-white/75 border-b border-white/40 cursor-move"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const originX = sticky.x;
                const originY = sticky.y;

                const handleMove = (moveEvent: MouseEvent) => {
                  onMove(sticky.id, originX + moveEvent.clientX - startX, originY + moveEvent.clientY - startY);
                };
                const handleUp = () => {
                  document.removeEventListener("mousemove", handleMove);
                  document.removeEventListener("mouseup", handleUp);
                };
                document.addEventListener("mousemove", handleMove);
                document.addEventListener("mouseup", handleUp);
              }}
            >
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-emerald-600 font-semibold">便利贴</span>
                {["#ffffff", "#fff4b2", "#ffd9e8", "#d9f0ff", "#e6ffd9"].map((color) => (
                  <button
                    key={color}
                    onClick={() => onColor(sticky.id, color)}
                  className={`w-3.5 h-3.5 rounded-full border ${sticky.color === color ? "border-emerald-600" : "border-gray-300"}`}
                    style={{ backgroundColor: color }}
                    title="设置便利贴颜色"
                  />
                ))}
                <input
                  type="color"
                  value={sticky.color || "#ffffff"}
                  onChange={(e) => onColor(sticky.id, e.target.value)}
                  className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer"
                  title="自定义颜色"
                />
              </div>
              <button onClick={() => onClose(sticky.id)} className="p-1 rounded-lg hover:bg-white/70 text-gray-700">
                <X size={12} />
              </button>
            </div>
            <textarea
              value={note.content}
              onChange={(e) => onUpdate(note.id, e.target.value)}
              className="w-full resize-none bg-transparent p-2.5 text-xs text-gray-700 focus:outline-none leading-relaxed"
              style={{ height: (sticky.height || 192) - 40 }}
            />
            <div
              className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize bg-white/70 hover:bg-white/90 rounded-tl-lg border-l border-t border-white/50"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const originWidth = sticky.width || 224;
                const originHeight = sticky.height || 192;

                const handleMove = (moveEvent: MouseEvent) => {
                  const nextWidth = Math.max(180, originWidth + moveEvent.clientX - startX);
                  const nextHeight = Math.max(120, originHeight + moveEvent.clientY - startY);
                  onResize(sticky.id, nextWidth, nextHeight);
                };

                const handleUp = () => {
                  document.removeEventListener("mousemove", handleMove);
                  document.removeEventListener("mouseup", handleUp);
                };

                document.addEventListener("mousemove", handleMove);
                document.addEventListener("mouseup", handleUp);
              }}
            />
          </div>
        );
      })}
    </>
  );
}

export default function Home() {
  const [rightTab, setRightTab] = useState<RightTab>("todos");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [clockTextClassName, setClockTextClassName] = useState("text-gray-700");
  const [plantDialog, setPlantDialog] = useState<PlantDialogData | null>(null);
  const [showPlantDialog, setShowPlantDialog] = useState(false);
  const [isPlantDialogFading, setIsPlantDialogFading] = useState(false);
  const [quotePools, setQuotePools] = useState<Record<string, PlantDialogQuote[]>>({});
  const [maxIdByType, setMaxIdByType] = useState<Record<string, number>>({});
  const [showGuide, setShowGuide] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const hasShownStartupDialogRef = useRef(false);
  const { state, dispatch } = useGame();

  const currentPlantDialogType = useMemo(
    // 明确判断：番茄钟未工作 => type "a"；番茄钟工作中 => type "b"
    () => (state.isTimerRunning ? "i" : "a"),
    [state.isTimerRunning]
  );

  useEffect(() => {
    const imageUrl = state.customBackground || RANDOM_BG;
    const img = new Image();
    img.src = imageUrl;
    img.onerror = () => setClockTextClassName("text-gray-700");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] / 255;
        const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        total += luminance * alpha;
      }
      const avgLuminance = total / (data.length / 4);
      setClockTextClassName(avgLuminance < 140 ? "text-gray-100 drop-shadow-sm" : "text-gray-700");
    };
  }, [state.customBackground]);

  useEffect(() => {
    let mounted = true;

    const loadAllQuotePools = async () => {
      const pools: Record<string, PlantDialogQuote[]> = {};
      const maxMap: Record<string, number> = {};

      const entries = Object.entries(quoteModules);
      for (const [, loadModule] of entries) {
        const loaded = await loadModule();
        const quotes = ((loaded as { default?: unknown }).default ?? []) as PlantDialogQuote[];
        if (!Array.isArray(quotes) || quotes.length === 0) continue;

        const poolType = quotes[0]?.type;
        if (!poolType) continue;
        pools[poolType] = quotes;

        const maxId = quotes.reduce((maxIdValue, item) => Math.max(maxIdValue, item.id ?? 0), 0);
        maxMap[poolType] = maxId;
      }

      if (!mounted) return;
      setQuotePools(pools);
      setMaxIdByType(maxMap);
    };

    void loadAllQuotePools();

    return () => {
      mounted = false;
    };
  }, []);

  const getDialogTextByType = useCallback((poolType: string): PlantDialogData => {
    const pool = quotePools[poolType];
    const maxId = maxIdByType[poolType] ?? 0;

    if (!pool || maxId <= 0) {
      return { quote: `当前还没有 type="${poolType}" 的语句库。`, from: "" };
    }

    // 规则：先拿到该语句库 id 最大值，再随机生成 [1, maxId] 的整数，按 id 精确匹配
    let randomId = Math.floor(Math.random() * maxId) + 1;
    let selected = pool.find((item) => item.id === randomId);

    // 处理 id 不连续场景：最多重试 12 次，仍失败则回退到第 1 条
    for (let attempt = 0; !selected && attempt < 12; attempt++) {
      randomId = Math.floor(Math.random() * maxId) + 1;
      selected = pool.find((item) => item.id === randomId);
    }
    if (!selected) selected = pool[0];

    return { quote: `"${selected.hitokoto}"`, from: `———${selected.from ?? "未知来源"}` };
  }, [maxIdByType, quotePools]);

  const handlePlantClick = () => {
    const poolType = currentPlantDialogType;
    const dialogText = getDialogTextByType(poolType);
    setPlantDialog(dialogText);
    setIsPlantDialogFading(false);
    setShowPlantDialog(true);
  };

  useEffect(() => {
    // 每次应用首次启动后自动弹出一次 type="a" 语句
    if (hasShownStartupDialogRef.current) return;
    if (!quotePools.a || (maxIdByType.a ?? 0) <= 0) return;
    hasShownStartupDialogRef.current = true;
    setPlantDialog(getDialogTextByType("a"));
    setIsPlantDialogFading(false);
    setShowPlantDialog(true);
  }, [getDialogTextByType, maxIdByType.a, quotePools.a]);

  useEffect(() => {
    if (!showPlantDialog) return;
    const fadeTimer = setTimeout(() => setIsPlantDialogFading(true), 5200);
    const hideTimer = setTimeout(() => setShowPlantDialog(false), 5600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [showPlantDialog, plantDialog]);

  const rightTabs: { id: RightTab; label: string; icon: typeof FileText }[] = [
    { id: "todos", label: "待办", icon: FileText },
    { id: "habits", label: "习惯", icon: Target },
    { id: "notes", label: "笔记", icon: BookText },
  ];

  const mobileTabs = [
    { id: "timer" as MobilePanel, label: "计时", icon: Timer },
    { id: "sounds" as MobilePanel, label: "音效", icon: Volume2 },
    { id: "plant" as MobilePanel, label: "植物", icon: Sprout },
    { id: "todos" as MobilePanel, label: "待办", icon: FileText },
    { id: "habits" as MobilePanel, label: "习惯", icon: Target },
    { id: "notes" as MobilePanel, label: "笔记", icon: BookText },

  ];

  const noteMap = new Map(state.notes.map((n) => [n.id, n]));

  const startGuide = useCallback(() => {
    setLeftCollapsed(false);
    setRightCollapsed(false);
    setMobilePanel(null);
    setShowCalendar(false);
    setShowProfile(false);
    setRightTab("todos");
    setGuideStepIndex(0);
    setShowGuide(true);
  }, []);

  const finishGuide = useCallback(() => {
    setShowGuide(false);
    localStorage.setItem("seed-tiderain-guide-completed", "true");
  }, []);

  const guideSteps: GuideStep[] = useMemo(
    () => [
      {
        title: "日历与个人中心",
        description: "此处可快速打开日历和个人中心，查看计划与个人数据。",
        targetClassName: "top-16 left-1/2 -translate-x-1/2",
      },
      {
        title: "专注计时",
        description: "此处为专注计时区，用于启动番茄钟、查看当前专注阶段与剩余时间。",
        targetClassName: "top-6 left-[360px] max-w-sm",
      },
      {
        title: "环境音乐",
        description: "此处环境音乐区，可以播放/暂停并切换环境音，营造专注氛围。",
        targetClassName: "top-[372px] left-[360px] max-w-sm",
      },
      {
        title: "数据统计",
        description: "此处展示植物成长和统计信息，帮助你了解专注进展。",
        targetClassName: "top-6 right-[400px] max-w-sm",
      },
      {
        title: "待办处理",
        description: "切换到“待办”，创建、勾选与整理当天任务。",
        targetClassName: "top-[248px] right-[400px] max-w-sm",
        setup: () => setRightTab("todos"),
      },
      {
        title: "习惯记录",
        description: "切换到“习惯”，可记录打卡并追踪连续完成天数。",
        targetClassName: "top-[248px] right-[400px] max-w-sm",
        setup: () => setRightTab("habits"),
      },
      {
        title: "笔记",
        description: "切换到“笔记”，可编辑笔记并拖拽到主界面生成便利贴。",
        targetClassName: "top-[248px] right-[400px] max-w-sm",
        setup: () => setRightTab("notes"),
      },
    ],
    []
  );

  useEffect(() => {
    const hasCompletedGuide = localStorage.getItem("seed-tiderain-guide-completed") === "true";
    if (!hasCompletedGuide) {
      startGuide();
    }
  }, [startGuide]);

  useEffect(() => {
    if (!showGuide) return;
    guideSteps[guideStepIndex]?.setup?.();
  }, [guideStepIndex, guideSteps, showGuide]);

  const handleGuideNext = () => {
    if (guideStepIndex >= guideSteps.length - 1) {
      finishGuide();
      return;
    }
    setGuideStepIndex((prev) => prev + 1);
  };

  const renderRightContent = () => {
    switch (rightTab) {
      case "todos": return <NotesPanel />;
      case "notes": return <NotesTextPanel />;
      case "habits": return <HabitsPanel />;
      default: return <NotesPanel />;
    }
  };

  const getGuideFocusClass = (steps: number[]) =>
    showGuide && steps.includes(guideStepIndex) ? "relative z-[75]" : "";

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* 背景层 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* 随机背景图（50%概率显示 clouds-bg 或 hero-bg）*/}
        {!state.customBackground && (
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage: `url(${RANDOM_BG})`,
              backgroundSize: "cover",
              backgroundPosition: IS_CLOUDS ? "center" : "center bottom",
              maskImage: undefined,
            }}
          />
        )}
        {/* 自定义背景（如果有）*/}
        <CustomBackground />
      </div>

      <FloatingParticles />

      {/* 顶部中间工具栏 */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 ${showGuide && guideStepIndex === 0 ? "z-[75]" : "z-40"}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => setShowCalendar(true)} className="p-2.5 rounded-xl bg-white/80 shadow-lg hover:bg-white transition-colors text-gray-600">
              <Calendar size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>日历</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => setShowProfile(true)} className="p-2.5 rounded-xl bg-white/80 shadow-lg hover:bg-white transition-colors text-gray-600">
              <User size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>个人中心</TooltipContent>
        </Tooltip>
      </div>

      {/* 桌面端布局 */}
      <div className="relative h-full hidden lg:flex">
        {/* 左侧面板 */}
        <div className={`shrink-0 h-full flex flex-col transition-all duration-300 ${leftCollapsed ? "w-0 opacity-0" : "w-[340px] opacity-100"}`}>
          <div className="h-full p-4 flex flex-col gap-3 overflow-hidden">
            <div className={`shrink-0 ${getGuideFocusClass([1])}`}>
              <TimerPanel compact />
            </div>
            <div className={`flex-1 min-h-0 ${getGuideFocusClass([2])}`}>
              <SoundPanel />
            </div>
          </div>
        </div>

        {/* 时钟保持独立：左侧收起时也可见，并移动到页面左侧 */}
        <div
          className={`absolute top-4 z-20 transition-all duration-300 ${
            leftCollapsed ? "left-4" : "left-[344px]"
          }`}
        >
          <div className="w-[220px] h-[120px]">
            <SystemClock textClassName={clockTextClassName} />
          </div>
        </div>

        {/* 左侧切换按钮 */}
        <button 
          onClick={() => setLeftCollapsed(!leftCollapsed)} 
          className="absolute left-0 top-1/2 -translate-y-1/2 z-50 h-14 w-6 
                     bg-gradient-to-r from-emerald-100/90 via-emerald-50/70 to-transparent
                     hover:from-emerald-100 hover:via-emerald-50/90 hover:to-emerald-50/40
                     shadow-lg shadow-emerald-900/10
                     border-r border-emerald-200/60
                     backdrop-blur-sm
                     rounded-r-xl 
                     flex items-center justify-center 
                     transition-all duration-200 ease-out
                     group"
        >
          <div className="relative">
            <ChevronLeft 
              size={20} 
              strokeWidth={2.5}
              className={`text-emerald-700 group-hover:text-emerald-600 transition-all duration-200 ${leftCollapsed ? 'opacity-0 rotate-180' : 'opacity-100'}`} 
            />
            <ChevronRight 
              size={20} 
              strokeWidth={2.5}
              className={`absolute top-0 left-0 text-emerald-700 group-hover:text-emerald-600 transition-all duration-200 ${leftCollapsed ? 'opacity-100' : 'opacity-0 -rotate-180'}`} 
            />
          </div>
        </button>

        {/* 中间 */}
        <div
          className="flex-1 relative z-20 flex items-center justify-center p-4"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/x-note-id")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            const noteId = e.dataTransfer.getData("application/x-note-id");
            if (!noteId) return;
            e.preventDefault();
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            dispatch({
              type: "ADD_STICKY_NOTE",
              payload: {
                noteId,
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
              },
            });
          }}
        >
          <div className="w-full h-full max-w-2xl relative">
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><Leaf size={40} className="text-emerald-400 animate-pulse" /></div>}>
              <PlantScene onPlantClick={handlePlantClick} />
            </Suspense>
            {showPlantDialog && plantDialog && (
              <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300 transition-opacity ${isPlantDialogFading ? "opacity-0" : "opacity-100"}`}>
                <div className="glass-strong rounded-2xl px-5 py-4 relative shadow-xl">
                  <div className="absolute -top-2 left-4 w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-[10px]">
                    ✨
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-md">
                      <Leaf size={18} className="text-white" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm font-medium leading-relaxed">{plantDialog.quote}</p>
                      {plantDialog.from && (
                        <p className="text-xs text-muted-foreground mt-2 text-right">{plantDialog.from}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <StickyNotesOverlay
            stickyNotes={state.stickyNotes}
            noteMap={noteMap}
            onMove={(id, x, y) => dispatch({ type: "MOVE_STICKY_NOTE", payload: { id, x, y } })}
            onUpdate={(id, content) => dispatch({ type: "UPDATE_NOTE", payload: { id, content } })}
            onClose={(id) => dispatch({ type: "CLOSE_STICKY_NOTE", payload: id })}
            onColor={(id, color) => dispatch({ type: "SET_STICKY_NOTE_COLOR", payload: { id, color } })}
            onResize={(id, width, height) => dispatch({ type: "RESIZE_STICKY_NOTE", payload: { id, width, height } })}
          />
        </div>

        {/* 右侧切换按钮 */}
        <button 
          onClick={() => setRightCollapsed(!rightCollapsed)} 
          className="absolute right-0 top-1/2 -translate-y-1/2 z-50 h-14 w-6 
                     bg-gradient-to-l from-purple-100/90 via-purple-50/70 to-transparent
                     hover:from-purple-100 hover:via-purple-50/90 hover:to-purple-50/40
                     shadow-lg shadow-purple-900/10
                     border-l border-purple-200/60
                     backdrop-blur-sm
                     rounded-l-xl 
                     flex items-center justify-center 
                     transition-all duration-200 ease-out
                     group"
        >
          <div className="relative">
            <ChevronRight 
              size={20} 
              strokeWidth={2.5}
              className={`text-purple-700 group-hover:text-purple-600 transition-all duration-200 ${rightCollapsed ? 'opacity-0 -rotate-180' : 'opacity-100'}`} 
            />
            <ChevronLeft 
              size={20} 
              strokeWidth={2.5}
              className={`absolute top-0 left-0 text-purple-700 group-hover:text-purple-600 transition-all duration-200 ${rightCollapsed ? 'opacity-100' : 'opacity-0 rotate-180'}`} 
            />
          </div>
        </button>

        {/* 右侧面板 */}
        <div className={`shrink-0 h-full transition-all duration-300 ${rightCollapsed ? "w-0 opacity-0" : "w-[380px] opacity-100"}`}>
          <div className="h-full p-4 flex flex-col gap-4 overflow-hidden">
            <div className={`shrink-0 ${getGuideFocusClass([3])}`}>
              <PlantInfo />
            </div>
            {/* 标签页添加图标 */}
            <div className="flex gap-1 bg-white/50 rounded-xl p-1 shrink-0">
              {rightTabs.map((tab) => (
                <button key={tab.id} onClick={() => setRightTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${rightTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"}`}>
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className={`flex-1 min-h-0 overflow-hidden ${getGuideFocusClass([4, 5, 6])}`}>
              {renderRightContent()}
            </div>
          </div>
        </div>
      </div>

      {/* 移动端布局 */}
      <div className="relative z-10 h-full flex flex-col lg:hidden">

        <div
          className="flex-1 relative min-h-0"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/x-note-id")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            const noteId = e.dataTransfer.getData("application/x-note-id");
            if (!noteId) return;
            e.preventDefault();
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            dispatch({ type: "ADD_STICKY_NOTE", payload: { noteId, x: e.clientX - rect.left, y: e.clientY - rect.top } });
          }}
        >
          <div className="w-full h-full">
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><Leaf size={32} className="text-emerald-400 animate-pulse" /></div>}>
              <PlantScene onPlantClick={handlePlantClick} />
            </Suspense>
          </div>
          {showPlantDialog && plantDialog && (
            <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300 transition-opacity ${isPlantDialogFading ? "opacity-0" : "opacity-100"}`}>
              <div className="glass-strong rounded-2xl px-5 py-4 relative shadow-xl">
                <div className="absolute -top-2 left-4 w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-[10px]">
                  ✨
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-md">
                    <Leaf size={18} className="text-white" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm font-medium leading-relaxed">{plantDialog.quote}</p>
                    {plantDialog.from && (
                      <p className="text-xs text-muted-foreground mt-2 text-right">{plantDialog.from}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <StickyNotesOverlay
            stickyNotes={state.stickyNotes}
            noteMap={noteMap}
            onMove={(id, x, y) => dispatch({ type: "MOVE_STICKY_NOTE", payload: { id, x, y } })}
            onUpdate={(id, content) => dispatch({ type: "UPDATE_NOTE", payload: { id, content } })}
            onClose={(id) => dispatch({ type: "CLOSE_STICKY_NOTE", payload: id })}
            onColor={(id, color) => dispatch({ type: "SET_STICKY_NOTE_COLOR", payload: { id, color } })}
            onResize={(id, width, height) => dispatch({ type: "RESIZE_STICKY_NOTE", payload: { id, width, height } })}
          />
        </div>

        {mobilePanel && (
          <div className={`absolute inset-x-0 bottom-16 z-30 bg-white/95 backdrop-blur-xl p-4 overflow-y-auto ${mobilePanel === "notes" ? "top-[45%]" : "top-0"}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">
                  {mobilePanel === "timer" && "番茄钟"}
                  {mobilePanel === "sounds" && "环境音效"}
                  {mobilePanel === "plant" && "植物信息"}
                  {mobilePanel === "todos" && "待办"}
                  {mobilePanel === "notes" && "笔记"}
                  {mobilePanel === "habits" && "习惯"}
                </h2>
                {mobilePanel === "notes" && <p className="text-xs text-gray-500 mt-1">将笔记拖到上方主界面即可生成便利贴</p>}
              </div>
              <button onClick={() => setMobilePanel(null)} className="p-2 rounded-full hover:bg-gray-100">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {mobilePanel === "timer" && <TimerPanel />}
            {mobilePanel === "sounds" && <SoundPanel />}
            {mobilePanel === "plant" && <PlantInfo />}
            {mobilePanel === "todos" && <NotesPanel />}
            {mobilePanel === "notes" && <NotesTextPanel />}
            {mobilePanel === "habits" && <HabitsPanel />}
            
          </div>
        )}

        <div className="shrink-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 px-2 py-2 flex items-center justify-around">
          {mobileTabs.map((tab) => (
            <button key={tab.id} onClick={() => setMobilePanel(mobilePanel === tab.id ? null : tab.id)} className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${mobilePanel === tab.id ? "text-emerald-600 bg-emerald-50" : "text-gray-500"}`}>
              <tab.icon size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 弹窗 */}
      {showProfile && <ProfilePage onClose={() => setShowProfile(false)} onStartGuide={startGuide} />}
      {showCalendar && <CalendarView onClose={() => setShowCalendar(false)} />}

      {showGuide && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[1px]" />
          <div className={`fixed z-[80] ${guideSteps[guideStepIndex]?.targetClassName}`}>
            <div className="w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/20 bg-white/95 shadow-2xl p-4">
              <div className="text-[11px] text-emerald-600 font-semibold mb-1">
                新手引导 {guideStepIndex + 1}/{guideSteps.length}
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">{guideSteps[guideStepIndex]?.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{guideSteps[guideStepIndex]?.description}</p>
              <div className="flex items-center justify-between">
                <button
                  onClick={finishGuide}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  跳过引导
                </button>
                <button
                  onClick={handleGuideNext}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
                >
                  {guideStepIndex >= guideSteps.length - 1 ? "完成" : "下一步"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
