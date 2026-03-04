import { usePomodoro } from "@/hooks/usePomodoro";
import { useGame, FocusSession } from "@/contexts/GameContext";
import { Play, Pause, FastForward, Settings, X, History, ChevronDown, ChevronUp, Heart, Square } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

interface TimerPanelProps {
  compact?: boolean;
}

function Celebration({ show, onComplete, emoji = "🎉", message = "" }: { show: boolean; onComplete: () => void; emoji?: string; message?: string }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm rounded-2xl">
      <div className="text-center">
        <div className="text-6xl animate-bounce">{emoji}</div>
        {message && <div className="mt-2 text-sm font-semibold text-emerald-700">{message}</div>}
      </div>
    </div>
  );
}

function HistoryModal({ sessions, totalMinutes, totalAffection, onClose }: {
  sessions: FocusSession[];
  totalMinutes: number;
  totalAffection: number;
  onClose: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const recentSessions = [...sessions].reverse();

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-2xl p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <History size={18} className="text-purple-500" />
          专注记录
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      <div className="flex items-center justify-around mb-2 pb-2 border-b border-gray-100 shrink-0 text-sm">
        <div className="text-center"><span className="font-bold text-emerald-600">{sessions.length}</span><span className="text-gray-500 text-xs ml-1">次</span></div>
        <div className="text-center"><span className="font-bold text-blue-600">{totalMinutes}</span><span className="text-gray-500 text-xs ml-1">分钟</span></div>
        <div className="text-center"><span className="font-bold text-pink-600">{totalAffection}</span><span className="text-gray-500 text-xs ml-1">好感</span></div>
      </div>

      <div className="flex-1 overflow-y-auto pr-0.5 -mx-1 px-1">
        {recentSessions.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">还没有专注记录，开始你的第一个番茄钟吧！</div>
        ) : (
          <div className="space-y-1">
            {recentSessions.map((s, i) => {
              const isExpanded = expandedId === s.id;
              const affectionGain = Math.max(1, Math.floor(s.duration * 0.8));
              return (
                <div key={s.id} className={`rounded-lg transition-all ${isExpanded ? "bg-purple-50 ring-1 ring-purple-200" : "bg-gray-50 hover:bg-gray-100"}`}>
                  <button onClick={() => setExpandedId(isExpanded ? null : s.id)} className="w-full flex items-center justify-between py-1.5 px-2">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[9px] font-bold">{recentSessions.length - i}</span>
                      <span className="text-xs text-gray-500">{formatDate(s.startTime)}</span>
                      <span className="text-xs font-medium text-gray-700">{formatTime(s.startTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-pink-500 flex items-center gap-0.5"><Heart size={10} />+{affectionGain}</span>
                      <span className="text-xs font-semibold text-emerald-600">{s.duration}分钟</span>
                      {isExpanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-2 pb-2 pt-0 text-xs space-y-1">
                      <div className="flex justify-between text-gray-500"><span>开始时间</span><span className="text-gray-700">{formatDate(s.startTime)} {formatTime(s.startTime)}</span></div>
                      <div className="flex justify-between text-gray-500"><span>专注时长</span><span className="text-emerald-600 font-medium">{s.duration} 分钟</span></div>
                      <div className="flex justify-between text-gray-500"><span>获得好感</span><span className="text-pink-500 font-medium">+{affectionGain} ❤️</span></div>
                      <div className="flex justify-between text-gray-500"><span>完成状态</span><span className="text-emerald-600">{s.completed ? "✓ 已完成" : "未完成"}</span></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimerPanel({ compact = false }: TimerPanelProps) {
  const { formattedTime, isRunning, mode, progress, start, pause, fastForward, endRound } = usePomodoro();
  const { state, dispatch } = useGame();
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCycleEndCelebration, setShowCycleEndCelebration] = useState(false);
  const lastCycleMarkRef = useRef(state.lastCycleCompletionMark);
  const [customPomodoro, setCustomPomodoro] = useState(String(state.pomodoroMinutes));
  const [customBreak, setCustomBreak] = useState(String(state.breakMinutes));
  const [customCycles, setCustomCycles] = useState(String(state.pomodoroCycles));

  useEffect(() => {
    if (mode === "break" && state.sessionsCompleted > 0) {
      const lastCelebrated = sessionStorage.getItem("last-celebrated-session");
      if (lastCelebrated !== String(state.sessionsCompleted)) {
        setShowCelebration(true);
        sessionStorage.setItem("last-celebrated-session", String(state.sessionsCompleted));
      }
    }
  }, [mode, state.sessionsCompleted]);

  useEffect(() => {
    if (!state.lastCycleCompletionMark) return;
    if (state.lastCycleCompletionMark > lastCycleMarkRef.current) {
      setShowCycleEndCelebration(true);
    }
    lastCycleMarkRef.current = state.lastCycleCompletionMark;
  }, [state.lastCycleCompletionMark]);

  useEffect(() => {
    if (!showSettings) return;
    setCustomPomodoro(String(state.pomodoroMinutes));
    setCustomBreak(String(state.breakMinutes));
    setCustomCycles(String(state.pomodoroCycles));
  }, [showSettings, state.pomodoroMinutes, state.breakMinutes, state.pomodoroCycles]);

  const handleCelebrationComplete = useCallback(() => setShowCelebration(false), []);

  const handleQuickAction = () => {
    if (isRunning && state.skipButtonLocked) return;
    if (mode === "focus") {
      fastForward();
      return;
    }
    dispatch({ type: "COMPLETE_SESSION" });
  };

  const handleSaveSettings = () => {
    const focus = parseInt(customPomodoro, 10);
    const breakMins = parseInt(customBreak, 10);
    const cycles = parseInt(customCycles, 10);
    if (focus >= 1 && focus <= 180) dispatch({ type: "SET_POMODORO_MINUTES", payload: focus });
    if (breakMins >= 1 && breakMins <= 60) dispatch({ type: "SET_BREAK_MINUTES", payload: breakMins });
    if (cycles >= 1 && cycles <= 12) dispatch({ type: "SET_POMODORO_CYCLES", payload: cycles });
    setShowSettings(false);
  };

  const circleSize = compact ? 75 : 85;
  const circumference = 2 * Math.PI * circleSize;
  const strokeDashoffset = circumference * (1 - progress);
  const progressColor = mode === "focus" ? "#10b981" : "#f59e0b";
  const isSkipLocked = isRunning && state.skipButtonLocked;
  const hasRoundStarted = state.timerMode !== "focus"
    || state.isTimerRunning
    || state.timeRemaining < state.pomodoroMinutes * 60
    || state.cycleAccumulatedFocusSeconds > 0
    || state.cycleAccumulatedPomodoros > 0;

  const totalFocusMinutesFromHistory = state.sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalAffectionFromHistory = state.sessions.reduce((sum, s) => sum + Math.max(1, Math.floor(s.duration * 0.8)), 0);

  if (showHistory) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg flex flex-col relative ${compact ? "h-[340px]" : "h-[400px]"}`}>
        <HistoryModal sessions={state.sessions} totalMinutes={totalFocusMinutesFromHistory} totalAffection={totalAffectionFromHistory} onClose={() => setShowHistory(false)} />
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-lg flex flex-col ${compact ? "h-[340px]" : "h-[400px]"}`}>
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="text-sm font-bold text-gray-800">计时设置</h3>
          <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X size={16} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
          <div>
            <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-gray-600">专注时长</span><span className="text-xs font-bold text-emerald-600">{state.pomodoroMinutes} 分钟</span></div>
            <input type="number" min="1" max="180" value={customPomodoro} onChange={(e) => setCustomPomodoro(e.target.value)} placeholder="自定义分钟" className="w-full px-2.5 py-1 rounded-lg bg-gray-100 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          </div>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-gray-600">休息时长</span><span className="text-xs font-bold text-amber-600">{state.breakMinutes} 分钟</span></div>
            <input type="number" min="1" max="60" value={customBreak} onChange={(e) => setCustomBreak(e.target.value)} placeholder="自定义分钟" className="w-full px-2.5 py-1 rounded-lg bg-gray-100 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-gray-600">番茄钟轮数</span><span className="text-xs font-bold text-purple-600">{state.pomodoroCycles} 轮</span></div>
            <input type="number" min="1" max="12" value={customCycles} onChange={(e) => setCustomCycles(e.target.value)} placeholder="自定义轮数" className="w-full px-2.5 py-1 rounded-lg bg-gray-100 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>

          <div className="bg-blue-50 rounded-xl p-2"><p className="text-[11px] text-blue-600 text-center">💡 快进可立即完成当前阶段，自动进入下一阶段</p></div>
        </div>

        <div className="pt-2 mt-2 border-t border-gray-200 shrink-0">
          <button onClick={handleSaveSettings} className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium">保存设置</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg flex flex-col relative ${compact ? "h-[340px]" : "h-[400px]"}`}>
      <Celebration show={showCelebration} onComplete={handleCelebrationComplete} />
      <Celebration show={showCycleEndCelebration} onComplete={() => setShowCycleEndCelebration(false)} emoji="🏆" message="已完成本轮番茄循环！" />

      <div className="flex items-center justify-center gap-2 mb-3 shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${mode === "focus" ? "bg-emerald-500" : "bg-amber-500"} ${isRunning ? "animate-pulse" : ""}`} />
        <span className="text-sm font-medium text-gray-700">{mode === "focus" ? "专注时间" : "休息时间"}</span>
        {state.sessionsCompleted > 0 && (
          <button onClick={() => setShowHistory(true)} className="text-[10px] text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-full ml-1 transition-colors flex items-center gap-1 border border-purple-200">
            <History size={10} />已完成 {state.sessionsCompleted}
          </button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="relative w-[200px] h-[200px]">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={circleSize} fill="none" stroke="#e5e7eb" strokeWidth="10" />
            <circle cx="100" cy="100" r={circleSize} fill="none" stroke={progressColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: "stroke-dashoffset 0.3s ease" }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl font-bold tracking-wider text-gray-800" style={{ fontFamily: "var(--font-mono)" }}>{formattedTime}</div>
              <div className="text-xs text-gray-500 mt-2">{mode === "focus" ? `第 ${state.currentCycle}/${state.pomodoroCycles} 个番茄` : `☕ 第 ${state.currentCycle}/${state.pomodoroCycles} 轮休息`}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 shrink-0 mt-2">
        <button
          onClick={handleQuickAction}
          disabled={isSkipLocked}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isSkipLocked ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"}`}
          title={isSkipLocked ? "已锁定跳过/结束" : mode === "focus" ? "快进当前番茄" : "结束休息"}
        >
          <FastForward size={20} className={isSkipLocked ? "text-gray-300" : "text-gray-600"} />
        </button>

        <button onClick={isRunning ? pause : start} className={`relative z-30 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${isRunning ? "bg-amber-400 hover:bg-amber-500 text-white" : mode === "focus" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}`}>
          {isRunning ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
        </button>

        {isRunning ? (
          <button
            onClick={endRound}
            disabled={isSkipLocked}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isSkipLocked ? "bg-gray-100 cursor-not-allowed" : "bg-red-100 hover:bg-red-200"}`}
            title={isSkipLocked ? "已锁定结束" : "结束本局并结算"}
          >
            <Square size={18} className={isSkipLocked ? "text-gray-300 fill-gray-300" : "text-red-600 fill-red-600"} />
          </button>
        ) : (
          mode === "focus" && !hasRoundStarted && (
            <button onClick={() => setShowSettings(true)} className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" title="设置">
              <Settings size={20} className="text-gray-600" />
            </button>
          )
        )}
      </div>
    </div>
  );
}
