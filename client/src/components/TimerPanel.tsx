import { usePomodoro } from "@/hooks/usePomodoro";
import { useGame, FocusSession } from "@/contexts/GameContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Pause, RotateCcw, Settings, X, History, ChevronDown, ChevronUp, Heart, SkipForward } from "lucide-react";
import { playCompleteSound } from "@/lib/sound";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

interface TimerPanelProps {
  compact?: boolean;
}

// 庆祝动画
function Celebration({ show, onComplete }: { show: boolean; onComplete: () => void }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm rounded-2xl">
      <div className="text-6xl animate-bounce">🎉</div>
    </div>
  );
}

// 历史记录弹窗 - 紧凑列表 + 展开详情
function HistoryModal({ sessions, totalMinutes, totalAffection, onClose }: { 
  sessions: FocusSession[]; 
  totalMinutes: number;
  totalAffection: number;
  onClose: () => void; 
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // 按时间倒序
  const recentSessions = [...sessions].reverse();
  
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  
  const formatFullDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
      
      {/* 统计概览 */}
      <div className="flex items-center justify-around mb-2 pb-2 border-b border-gray-100 shrink-0 text-sm">
        <div className="text-center">
          <span className="font-bold text-emerald-600">{sessions.length}</span>
          <span className="text-gray-500 text-xs ml-1">个</span>
        </div>
        <div className="text-center">
          <span className="font-bold text-blue-600">{totalMinutes}</span>
          <span className="text-gray-500 text-xs ml-1">分钟</span>
        </div>
        <div className="text-center">
          <span className="font-bold text-pink-600">{totalAffection}</span>
          <span className="text-gray-500 text-xs ml-1">好感</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-0.5 -mx-1 px-1 pt-1">
        {recentSessions.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">
            还没有专注记录，开始你的第一个番茄钟吧！
          </div>
        ) : (
          <div className="space-y-1">
            {recentSessions.map((s, i) => {
              const isExpanded = expandedId === s.id;
              // 好感度基础计算：floor(分钟/2)，连续天数奖励未计入
              const affectionGain = Math.floor(s.duration / 2);
              return (
                <div 
                  key={s.id} 
                  className={`rounded-lg transition-all ${isExpanded ? "bg-purple-50 ring-1 ring-purple-200" : "bg-gray-50 hover:bg-gray-100"}`}
                >
                  {/* 紧凑主行 */}
                  <button 
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="w-full flex items-center justify-between py-1.5 px-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[9px] font-bold">
                        {sessions.length - i}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(s.startTime)}</span>
                      <span className="text-xs font-medium text-gray-700">{formatTime(s.startTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-pink-500 flex items-center gap-0.5">
                        <Heart size={10} />+{affectionGain}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600">{s.duration} 分钟</span>
                      {isExpanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                    </div>
                  </button>
                  
                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="px-2 pb-2 pt-0 text-xs space-y-1">
                      <div className="flex justify-between text-gray-500">
                        <span>开始时间</span>
                        <span className="text-gray-700">{formatFullDateTime(s.startTime)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>结束时间</span>
                        <span className="text-gray-700">{formatFullDateTime(s.endTime || new Date(new Date(s.startTime).getTime() + s.duration * 60000).toISOString())}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>专注时长</span>
                        <span className="text-emerald-600 font-medium">{s.duration} 分钟</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>获得好感</span>
                        <span className="text-pink-500 font-medium">+{affectionGain} ❤️</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>完成状态</span>
                        <span className="text-emerald-600">{s.completed ? "✓ 已完成" : "未完成"}</span>
                      </div>
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
  const { formattedTime, isRunning, mode, progress, start, pause, reset } = usePomodoro();
  const { state, dispatch } = useGame();
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // 监听专注完成 - 只处理庆祝动画，提示音在 usePomodoro 中处理
  useEffect(() => {
    if ((mode === "break" || mode === "longBreak") && state.sessionsCompleted > 0) {
      const lastCelebrated = sessionStorage.getItem("last-celebrated-session");
      if (lastCelebrated !== String(state.sessionsCompleted)) {
        setShowCelebration(true);
        sessionStorage.setItem("last-celebrated-session", String(state.sessionsCompleted));
      }
    }
  }, [mode, state.sessionsCompleted]);

  // 计算设置按钮是否禁用（使用 useMemo 避免频繁重计算）
  const settingsDisabled = useMemo(() => {
    return mode === "focus" && state.timeRemaining < state.pomodoroMinutes * 60;
  }, [mode, state.timeRemaining, state.pomodoroMinutes]);

  // 计算按钮标题
  const focusButtonTitle = useMemo(() => {
    if (isRunning) return "暂停专注";
    if (state.timeRemaining < state.pomodoroMinutes * 60) return "继续专注";
    return "开始专注";
  }, [isRunning, state.timeRemaining, state.pomodoroMinutes]);

  const breakButtonTitle = useMemo(() => {
    if (isRunning) return "暂停休息";
    const breakMinutes = mode === "longBreak" ? state.longBreakMinutes : state.breakMinutes;
    if (state.timeRemaining < breakMinutes * 60) return "继续休息";
    return "开始休息";
  }, [isRunning, state.timeRemaining, mode, state.longBreakMinutes, state.breakMinutes]);

  // AudioContext 引用
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 获取或创建 AudioContext
  const getAudioContext = useCallback(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContextClass();
    }
    // 如果上下文被挂起，尝试恢复
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // 提示音函数 - 仅用于开始/暂停
  const playNotificationSound = useCallback((type: "start" | "pause") => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (type === "start") {
        // 开始提示音 - 清脆高音
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === "pause") {
        // 暂停提示音 - 低沉音
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // 忽略音频播放错误
    }
  }, [getAudioContext]);

  const handleCelebrationComplete = useCallback(() => {
    setShowCelebration(false);
  }, []);

  // 圆圈尺寸：紧凑模式也保证足够大，让数字能在圆圈内
  const circleSize = compact ? 75 : 85; // 半径
  const circumference = 2 * Math.PI * circleSize;
  const strokeDashoffset = circumference * (1 - progress);
  const progressColor = mode === "focus" ? "#10b981" : mode === "longBreak" ? "#3b82f6" : "#f59e0b";

  const setPomodoroMinutes = (mins: number) => dispatch({ type: "SET_POMODORO_MINUTES", payload: mins });
  const setBreakMinutes = (mins: number) => dispatch({ type: "SET_BREAK_MINUTES", payload: mins });
  const setLongBreakMinutes = (mins: number) => dispatch({ type: "SET_LONG_BREAK_MINUTES", payload: mins });

  // 计算历史数据
  const totalFocusMinutesFromHistory = state.sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalAffectionFromHistory = state.sessions.reduce((sum, s) => sum + Math.floor(s.duration / 2), 0);

  // 历史记录弹窗
  if (showHistory) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg flex flex-col relative ${compact ? "h-[340px]" : "h-[400px]"}`}>
        <HistoryModal 
          sessions={state.sessions} 
          totalMinutes={totalFocusMinutesFromHistory}
          totalAffection={totalAffectionFromHistory}
          onClose={() => setShowHistory(false)} 
        />
      </div>
    );
  }

  // 设置界面
  if (showSettings) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-lg flex flex-col ${compact ? "h-[340px]" : "h-[400px]"}`}>
        {/* 头部 */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-base font-bold text-gray-800">计时设置</h3>
          <button onClick={() => setShowSettings(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* 内容区域 - 紧凑布局 */}
        <div className="flex-1 flex flex-col justify-start gap-2 -mt-2">
          {/* 专注时长 */}
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-600">专注时长</span>
              <span className="text-xs font-bold text-emerald-600">{state.pomodoroMinutes} min</span>
            </div>
            <div className="flex gap-1 mb-1.5">
              {[15, 25, 30, 45, 60].map((m) => (
                <button key={m} onClick={() => setPomodoroMinutes(m)} className={`flex-1 py-1 rounded text-xs font-medium transition-all ${state.pomodoroMinutes === m ? "bg-emerald-500 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
                  {m}
                </button>
              ))}
            </div>
            <input 
              type="number" 
              min="1" 
              max="999" 
              key={`pomo-${state.pomodoroMinutes}`}
              defaultValue={state.pomodoroMinutes}
              onBlur={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val) || val < 1) val = 1;
                else if (val > 999) val = 999;
                setPomodoroMinutes(val);
                e.target.value = String(val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="1-999" 
              className="w-full px-2 py-0.5 rounded bg-white text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-300" 
            />
          </div>

          {/* 休息时长 */}
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-600">短休息</span>
              <span className="text-xs font-bold text-amber-600">{state.breakMinutes} min</span>
            </div>
            <div className="flex gap-1 mb-1.5">
              {[3, 5, 10, 15].map((m) => (
                <button key={m} onClick={() => setBreakMinutes(m)} className={`flex-1 py-1 rounded text-xs font-medium transition-all ${state.breakMinutes === m ? "bg-amber-500 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
                  {m}
                </button>
              ))}
            </div>
            <input 
              type="number" 
              min="1" 
              max="999" 
              key={`break-${state.breakMinutes}`}
              defaultValue={state.breakMinutes}
              onBlur={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val) || val < 1) val = 1;
                else if (val > 999) val = 999;
                setBreakMinutes(val);
                e.target.value = String(val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="1-999" 
              className="w-full px-2 py-0.5 rounded bg-white text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-300" 
            />
          </div>

          {/* 长休息时长 */}
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-600">长休息（4 番茄后）</span>
              <span className="text-xs font-bold text-blue-600">{state.longBreakMinutes} min</span>
            </div>
            <div className="flex gap-1 mb-1.5">
              {[10, 15, 20, 30].map((m) => (
                <button key={m} onClick={() => setLongBreakMinutes(m)} className={`flex-1 py-1 rounded text-xs font-medium transition-all ${state.longBreakMinutes === m ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
                  {m}
                </button>
              ))}
            </div>
            <input 
              type="number" 
              min="1" 
              max="999" 
              key={`longbreak-${state.longBreakMinutes}`}
              defaultValue={state.longBreakMinutes}
              onBlur={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val) || val < 1) val = 1;
                else if (val > 999) val = 999;
                setLongBreakMinutes(val);
                e.target.value = String(val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="1-999" 
              className="w-full px-2 py-0.5 rounded bg-white text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300" 
            />
          </div>

        </div>
      </div>
    );
  }

  // 主界面
  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg flex flex-col relative ${compact ? "h-[340px]" : "h-[400px]"}`}>
      <Celebration show={showCelebration} onComplete={handleCelebrationComplete} />

      {/* 模式指示器 */}
      <div className="flex items-center justify-center gap-2 mb-3 shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${mode === "focus" ? "bg-emerald-500" : mode === "longBreak" ? "bg-blue-500" : "bg-amber-500"} ${isRunning ? "animate-pulse" : ""}`} />
        <span className="text-sm font-medium text-gray-700">
          {mode === "focus" ? "专注时间" : mode === "longBreak" ? "长休息 🌿" : "短休息 ☕"}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => setShowHistory(true)} 
              className="text-[10px] text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-full ml-1 transition-colors flex items-center gap-1 border border-purple-200"
            >
              <History size={10} />
              已完成 {state.sessionsCompleted}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>查看专注记录</TooltipContent>
        </Tooltip>
      </div>

      {/* 计时器圆环 - 确保数字在圆圈内 */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="relative w-[200px] h-[200px]">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={circleSize} fill="none" stroke="#e5e7eb" strokeWidth="10" />
            <circle cx="100" cy="100" r={circleSize} fill="none" stroke={progressColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: "stroke-dashoffset 0.3s ease" }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pt-4">
            <div className="text-center">
              <div 
                className={`font-bold tracking-wider text-gray-800 transition-all duration-300 h-14 flex items-center justify-center ${
                  formattedTime.length <= 4 ? "text-[48px]" : formattedTime.length <= 5 ? "text-[42px]" : "text-[36px]"
                }`} 
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {formattedTime}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                第 {state.currentSessionCount + 1}/4 个番茄
              </div>
              {/* 重置组计数和跳过按钮 */}
              <div className="flex items-center justify-center gap-3 mt-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => dispatch({ type: "RESET_SESSION_COUNT" })}
                      className="p-2 -m-1 text-gray-300 hover:text-gray-500 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>重置组计数</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => {
                        playCompleteSound();
                        dispatch({ type: "COMPLETE_SESSION" });
                      }}
                      disabled={mode === "focus" && state.skipButtonLocked}
                      className={`p-2 -m-1 transition-colors ${mode === "focus" && state.skipButtonLocked ? 'text-gray-200 cursor-not-allowed' : 'text-gray-300 hover:text-gray-500'}`}
                    >
                      <SkipForward size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    {mode === "focus" && state.skipButtonLocked ? "跳过已锁定，请在个人中心解锁" : "跳过当前阶段"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* 控制按钮 */}
      <div className="flex items-center justify-center gap-4 shrink-0 mt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={reset} className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <RotateCcw size={20} className="text-gray-600" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>重置计时</TooltipContent>
        </Tooltip>

        {mode === "focus" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => {
                  if (isRunning) {
                    pause();
                    playNotificationSound("pause");
                  } else {
                    start();
                    playNotificationSound("start");
                  }
                }} 
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${isRunning ? "bg-amber-400 hover:bg-amber-500 text-white" : "bg-emerald-500 hover:bg-emerald-600 text-white"}`}
              >
                {isRunning ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>{focusButtonTitle}</TooltipContent>
          </Tooltip>
        ) : mode === "longBreak" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => {
                  if (isRunning) {
                    pause();
                    playNotificationSound("pause");
                  } else {
                    start();
                    playNotificationSound("start");
                  }
                }} 
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${isRunning ? "bg-blue-400 hover:bg-blue-500 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}`}
              >
                {isRunning ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>{breakButtonTitle}</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => {
                  if (isRunning) {
                    pause();
                    playNotificationSound("pause");
                  } else {
                    start();
                    playNotificationSound("start");
                  }
                }} 
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${isRunning ? "bg-amber-400 hover:bg-amber-500 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}`}
              >
                {isRunning ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>{breakButtonTitle}</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => setShowSettings(true)} 
              disabled={settingsDisabled}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                settingsDisabled
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              <Settings size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            {settingsDisabled ? "专注已开始，无法修改设置" : "计时设置"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
