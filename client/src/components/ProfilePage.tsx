import { useGame } from "@/contexts/GameContext";
import { useRef, useMemo } from "react";
import { X, Download, Upload, Trophy, Calendar, Clock, Target, Flame, Award, TrendingUp, ImagePlus, RotateCcw, Lock, Unlock, BarChart3, Zap, CheckSquare, Trash2 } from "lucide-react";

interface ProfilePageProps {
  onClose: () => void;
}

export default function ProfilePage({ onClose }: ProfilePageProps) {
  const { state, dispatch } = useGame();
  const bgInputRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const data = {
      exportDate: new Date().toISOString(),
      stats: {
        totalFocusMinutes: state.totalFocusMinutes,
        sessionsCompleted: state.sessionsCompleted,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        affection: state.affection,
      },
      sessions: state.sessions,
      habits: state.habits,
      memos: state.memos,
      heatmapData: state.heatmapData,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `focus-companion-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAllData = () => {
    if (!confirm("⚠️ 警告：此操作将清空所有数据！\n\n点击确定继续")) {
      return;
    }
    if (!confirm("二次确认：你真的确定要清空所有数据吗？")) {
      return;
    }
    const confirmText = prompt("最终确认：请输入 DELETE 以清空所有数据：");
    if (confirmText !== "DELETE") {
      alert("操作已取消");
      return;
    }
    dispatch({
      type: "LOAD_STATE",
      payload: {
        affection: 0,
        totalFocusMinutes: 0,
        sessionsCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastSessionDate: null,
        sessions: [],
        habits: [],
        memos: [],
        notes: [],
        heatmapData: [],
        memoTags: ["学习", "待查", "论文"],
        diaryEntries: {},
        customBackground: null,
      },
    });
    alert("数据已清空");
  };

  const importData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);

          if (parsed?.stats && parsed?.sessions) {
            dispatch({
              type: "LOAD_STATE",
              payload: {
                affection: Number(parsed.stats.affection || 0),
                totalFocusMinutes: Number(parsed.stats.totalFocusMinutes || 0),
                sessionsCompleted: Number(parsed.stats.sessionsCompleted || 0),
                currentStreak: Number(parsed.stats.currentStreak || 0),
                longestStreak: Number(parsed.stats.longestStreak || 0),
                sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
                habits: Array.isArray(parsed.habits) ? parsed.habits : [],
                memos: Array.isArray(parsed.memos) ? parsed.memos : [],
                heatmapData: Array.isArray(parsed.heatmapData) ? parsed.heatmapData : [],
              },
            });
            alert("数据导入成功");
            return;
          }

          if (parsed && typeof parsed === "object") {
            dispatch({ type: "LOAD_STATE", payload: parsed });
            alert("数据导入成功");
            return;
          }

          alert("文件格式错误");
        } catch {
          alert("文件格式错误");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleBackgroundUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const targetRatio = window.innerWidth / window.innerHeight;
        const imgRatio = img.width / img.height;

        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (imgRatio > targetRatio) {
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / targetRatio;
          sy = (img.height - sh) / 2;
        }

        const canvas = document.createElement("canvas");
        const outW = Math.min(1920, Math.max(1280, window.innerWidth));
        const outH = Math.round(outW / targetRatio);
        canvas.width = outW;
        canvas.height = outH;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        dispatch({ type: "SET_CUSTOM_BACKGROUND", payload: dataUrl });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const totalHours = Math.floor(Math.round(state.totalFocusMinutes) / 60);
  const avgSessionMinutes = state.sessionsCompleted > 0
    ? Math.round(state.totalFocusMinutes / state.sessionsCompleted)
    : 0;

  // 统计数据计算
  const weekData = useMemo(() => {
    const days: { label: string; minutes: number; sessions: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      const daySessions = state.sessions.filter(
        (s) => new Date(s.startTime).toDateString() === dateStr
      );
      days.push({
        label: date.toLocaleDateString("zh-CN", { weekday: "short" }),
        minutes: daySessions.reduce((sum, s) => sum + s.duration, 0),
        sessions: daySessions.length,
      });
    }
    return days;
  }, [state.sessions]);

  const roundedWeekData = weekData.map((d) => ({ ...d, minutes: Math.round(d.minutes) }));
  const maxMinutes = Math.max(...roundedWeekData.map((d) => d.minutes), 1);
  const todayMinutes = roundedWeekData[roundedWeekData.length - 1]?.minutes || 0;
  const todaySessions = roundedWeekData[roundedWeekData.length - 1]?.sessions || 0;
  const weekTotalMinutes = roundedWeekData.reduce((sum, d) => sum + d.minutes, 0);
  const avgMinutes = Math.round(weekTotalMinutes / 7);
  const todayDateStr = new Date().toDateString();
  const todayCompletedTodos = state.memos.filter((m) => m.done && new Date(m.updatedAt).toDateString() === todayDateStr).length;
  const bestDay = roundedWeekData.reduce((best, current) => 
    current.minutes > best.minutes ? current : best
  , roundedWeekData[0]);

  const heatmapDays = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 179; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = state.heatmapData.find(d => d.date === dateStr);
      result.push({
        date: dateStr,
        minutes: Math.round(dayData?.minutes || 0),
      });
    }
    return result;
  }, [state.heatmapData]);

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return "bg-gray-100";
    if (minutes < 30) return "bg-emerald-200";
    if (minutes < 60) return "bg-emerald-300";
    if (minutes < 120) return "bg-emerald-400";
    return "bg-emerald-500";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Trophy size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">个人中心</h2>
              <p className="text-sm text-gray-500">你的专注之旅</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* 统计概览 - 今日数据 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={18} className="text-blue-500" />
              <h3 className="text-base font-bold text-gray-800">今日统计</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <Clock size={16} className="mx-auto mb-1 text-blue-500" />
                <div className="text-xl font-bold text-gray-800">{todayMinutes}</div>
                <div className="text-[10px] text-gray-500">专注分钟数</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <Zap size={16} className="mx-auto mb-1 text-amber-500" />
                <div className="text-xl font-bold text-gray-800">{todaySessions}</div>
                <div className="text-[10px] text-gray-500">完成番茄</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <CheckSquare size={16} className="mx-auto mb-1 text-emerald-500" />
                <div className="text-xl font-bold text-gray-800">{todayCompletedTodos}</div>
                <div className="text-[10px] text-gray-500">完成待办</div>
              </div>
            </div>
          </div>

          <hr className="border-gray-200 my-6" />

          {/* 本周趋势 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">本周趋势</h3>
              </div>
              <span className="text-[10px] text-gray-400">日均 {avgMinutes} 分钟</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-end gap-2 h-28">
                {roundedWeekData.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-gray-500 font-medium">
                      {day.minutes > 0 ? day.minutes : ''}
                    </span>
                    <div className="w-full relative h-16">
                      <div
                        className={`absolute bottom-0 w-full rounded-t transition-all duration-500
                          ${day.minutes > 0 ? "bg-blue-400" : "bg-gray-200"}`}
                        style={{ height: maxMinutes > 0 ? `${Math.min((day.minutes / maxMinutes) * 100, 100)}%` : '0%' }}
                      />
                    </div>
                    <span className={`text-[10px] ${day.minutes > 0 ? "text-blue-500 font-medium" : "text-gray-400"}`}>
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <hr className="border-gray-200 my-6" />

          {/* 近180天热力图 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">近 180 天专注热力图</h3>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-gray-400">少</span>
                <div className="flex gap-0.5">
                  <div className="w-2 h-2 rounded-sm bg-gray-100" />
                  <div className="w-2 h-2 rounded-sm bg-emerald-200" />
                  <div className="w-2 h-2 rounded-sm bg-emerald-300" />
                  <div className="w-2 h-2 rounded-sm bg-emerald-400" />
                  <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                </div>
                <span className="text-[9px] text-gray-400">多</span>
              </div>
            </div>
            {/* 按周排列：每行7天，共约26周 */}
            <div className="overflow-x-auto">
              <div className="grid grid-flow-col grid-rows-[repeat(7,minmax(0,1fr))] gap-1 min-w-max">
                {heatmapDays.map((day) => (
                  <div
                    key={day.date}
                    className={`w-3 h-3 ${getHeatmapColor(day.minutes)}`}
                    title={`${day.date}: ${day.minutes} 分钟`}
                  />
                ))}
              </div>
            </div>
          </div>

          <hr className="border-gray-200 my-6" />

          {/* 页面背景 */}
          <div className="mb-6 p-4 rounded-2xl border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">页面背景</h3>
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBackgroundUpload(file);
                }}
              />
              <div className="flex items-center gap-2">
                <button onClick={() => bgInputRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs flex items-center gap-1">
                  <ImagePlus size={14} /> 上传背景
                </button>
                <button onClick={() => dispatch({ type: "SET_CUSTOM_BACKGROUND", payload: null })} className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs flex items-center gap-1">
                  <RotateCcw size={14} /> 恢复默认
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">上传图片会按窗口比例自动裁切并覆盖背景。</p>
          </div>

          <hr className="border-gray-200 my-6" />

          {/* 累计数据 */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">累计成就</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <Clock size={18} className="mx-auto mb-1 text-emerald-500" />
                <div className="text-lg font-bold text-gray-800">{totalHours}</div>
                <div className="text-[10px] text-gray-500">总小时数</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <Target size={18} className="mx-auto mb-1 text-amber-500" />
                <div className="text-lg font-bold text-gray-800">{state.sessionsCompleted}</div>
                <div className="text-[10px] text-gray-500">总番茄数</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <Flame size={18} className="mx-auto mb-1 text-orange-500" />
                <div className="text-lg font-bold text-gray-800">{state.longestStreak}</div>
                <div className="text-[10px] text-gray-500">最长连续天数</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <Award size={18} className="mx-auto mb-1 text-purple-500" />
                <div className="text-lg font-bold text-gray-800">{avgSessionMinutes}</div>
                <div className="text-[10px] text-gray-500">平均分钟数</div>
              </div>
            </div>
          </div>

          <hr className="border-gray-200 my-6" />

          {/* 等级信息 */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 mb-6 border border-amber-100">
            <div className="flex items-center gap-4">
              <span className="text-4xl">
                {state.totalFocusMinutes < 100 ? "🌱" : 
                 state.totalFocusMinutes < 500 ? "🌿" : 
                 state.totalFocusMinutes < 1000 ? "🌲" : 
                 state.totalFocusMinutes < 2000 ? "⭐" : "👑"}
              </span>
              <div className="flex-1">
                <div className="text-lg font-bold text-gray-800">
                  {state.totalFocusMinutes < 100 ? "专注新手" : 
                   state.totalFocusMinutes < 500 ? "专注学徒" : 
                   state.totalFocusMinutes < 1000 ? "专注达人" : 
                   state.totalFocusMinutes < 2000 ? "专注大师" : "专注传奇"}
                </div>
                <div className="text-sm text-gray-500">
                  累计获得 {state.affection} 好感度
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-200 my-6" />

          {/* 习惯完成情况 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp size={16} /> 习惯完成情况</h3>
            <div className="space-y-3">
              {state.habits.length === 0 ? <p className="text-sm text-gray-400">还没有添加习惯</p> : state.habits.map((habit) => (
                <div key={habit.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{habit.name}</span>
                  <div className="text-xs text-gray-500">连续 {habit.streak} 天</div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-200 my-6" />

          {/* 番茄钟设置 */}
          <div className="mb-6">
            <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Clock size={18} className="text-blue-500" />
              番茄钟设置
            </h3>
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${state.skipButtonLocked ? 'bg-gray-200' : 'bg-emerald-100'}`}>
                    {state.skipButtonLocked ? <Lock size={18} className="text-gray-600" /> : <Unlock size={18} className="text-emerald-600" />}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">跳过按钮</div>
                    <div className="text-xs text-gray-500">
                      {state.skipButtonLocked ? "已锁定，无法跳过专注时间" : "已解锁，可以跳过专注时间"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: "TOGGLE_SKIP_BUTTON_LOCK" })}
                  className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                    state.skipButtonLocked
                      ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  }`}
                >
                  {state.skipButtonLocked ? "解锁" : "锁定"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                锁定跳过按钮可以帮助你保持专注，避免轻易跳过番茄钟
              </p>
            </div>
          </div>

          <hr className="border-gray-200 my-6" />

          {/* 数据管理 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Calendar size={16} /> 数据管理</h3>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={exportData} className="py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2"><Download size={16} />导出数据</button>
              <button onClick={importData} className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium flex items-center justify-center gap-2"><Upload size={16} />导入数据</button>
              <button onClick={clearAllData} className="py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2"><Trash2 size={16} />清空数据</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
