import { useGame } from "@/contexts/GameContext";
import { useState, useEffect, useCallback, useRef } from "react";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, CheckCircle2, Circle, Target, Flame, Trophy, Calendar, ChevronUp, X, Edit2, Check } from "lucide-react";

function Celebration({ show, onComplete }: { show: boolean; onComplete: () => void }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="text-4xl animate-bounce">✨</div>
    </div>
  );
}

export default function HabitsPanel() {
  const { state, dispatch } = useGame();
  const [newHabit, setNewHabit] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitName, setEditingHabitName] = useState("");
  const addFormRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    if (!newHabit.trim()) return;
    dispatch({ type: "ADD_HABIT", payload: { name: newHabit.trim() } });
    setNewHabit("");
    setIsAdding(false);
  };

  const handleToggle = (habitId: string, completed: boolean) => {
    if (!completed) setCelebratingId(habitId);
    dispatch({ type: "TOGGLE_HABIT", payload: habitId });
  };

  const startEditHabit = (id: string, name: string) => {
    setEditingHabitId(id);
    setEditingHabitName(name);
  };

  const saveEditHabit = () => {
    if (!editingHabitId) return;
    if (!editingHabitName.trim()) {
      setEditingHabitId(null);
      setEditingHabitName("");
      return;
    }
    dispatch({ type: "UPDATE_HABIT", payload: { id: editingHabitId, name: editingHabitName } });
    setEditingHabitId(null);
    setEditingHabitName("");
  };

  const handleCelebrationComplete = useCallback(() => setCelebratingId(null), []);

  // 删除确认
  const { requestDelete, confirmDelete, cancelDelete, isConfirming } = useDeleteConfirm({
    onDelete: (id) => dispatch({ type: "DELETE_HABIT", payload: id }),
    confirmText: "确定删除这个习惯？",
  });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const isCompletedToday = (habit: typeof state.habits[0]) => habit.completedDates.includes(todayStr);

  const completedCount = state.habits.filter((h) => isCompletedToday(h)).length;
  const totalCount = state.habits.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  // 生成最近7天的日期
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date,
      dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      label: date.toLocaleDateString("zh-CN", { weekday: "short" }),
      day: date.getDate(),
    };
  });

  // 检查某天是否完成了习惯
  const isCompletedOnDate = (habit: typeof state.habits[0], dateStr: string) => habit.completedDates.includes(dateStr);

  const suggestedHabits = ["阅读", "喝水", "早睡", "运动", "冥想"];
  const unusedSuggestions = suggestedHabits.filter((s) => !state.habits.some((h) => h.name === s));

  // 点击外部取消添加
  useEffect(() => {
    if (!isAdding) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addFormRef.current && !addFormRef.current.contains(e.target as Node)) {
        setIsAdding(false);
        setNewHabit("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAdding]);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg h-full flex flex-col relative">
      {celebratingId && <Celebration show={true} onComplete={handleCelebrationComplete} />}

      {/* 头部 */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Target size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">习惯</h3>
            <p className="text-[10px] text-gray-500">{completedCount}/{totalCount} 已完成{allCompleted && " · 全部完成！"}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setShowHistory(!showHistory)} className={`p-2 rounded-xl transition-colors ${showHistory ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                <Calendar size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>历史记录</TooltipContent>
          </Tooltip>
          <button onClick={() => setIsAdding(true)} className="p-2 rounded-xl bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 进度条 */}
      {totalCount > 0 && (
        <div className="mb-3 shrink-0">
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${allCompleted ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-gradient-to-r from-emerald-400 to-teal-500"}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* 添加表单 */}
      {isAdding && (
        <div ref={addFormRef} className="mb-3 shrink-0">
          <div className="flex gap-2 mb-2">
            <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setIsAdding(false); }} placeholder="习惯名称..." autoFocus
              className="flex-1 px-3 py-2 rounded-xl bg-gray-100 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            <button onClick={handleAdd} disabled={!newHabit.trim()} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium disabled:opacity-40">添加</button>
            <button onClick={() => setIsAdding(false)} className="px-3 py-2 rounded-xl bg-gray-200 text-gray-600 text-sm">取消</button>
          </div>
          {/* 建议习惯 */}
          {unusedSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {unusedSuggestions.slice(0, 4).map((suggestion) => (
                <button 
                  key={suggestion} 
                  type="button"
                  onClick={() => setNewHabit(suggestion)} 
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-xs text-gray-600 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 历史记录表格 */}
      {showHistory && state.habits.length > 0 && (
        <div className="mb-3 bg-gray-50 rounded-xl p-3 overflow-x-auto overflow-y-auto max-h-50.5 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">近 7 天完成情况</span>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><ChevronUp size={16} /></button>
          </div>
          <table className="w-full text-xs overflow-y-auto">
            <thead>
              <tr>
                <th className="text-left py-1 text-gray-500 font-medium">习惯</th>
                {last7Days.map((day, i) => (
                  <th key={i} className="text-center py-1 text-gray-400 w-8">
                    <div>{day.label}</div>
                    <div className="text-[9px]">{day.day}</div>
                  </th>
                ))}
                <th className="text-center py-1 text-gray-500 font-medium w-10">🔥</th>
                <th className="text-center py-1 text-gray-500 font-medium w-10">🏆</th>
              </tr>
            </thead>
            <tbody className="overflow-y-auto">
              {state.habits.map((habit) => (
                <tr key={habit.id} className="border-t border-gray-200">
                  <td className="py-1.5 pr-2 truncate max-w-[80px]" data-tooltip={habit.name}>{habit.name}</td>
                  {last7Days.map((day, i) => (
                    <td key={i} className="text-center py-1.5">
                      {isCompletedOnDate(habit, day.dateStr) ? (
                        <div className="w-5 h-5 mx-auto rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 size={12} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 mx-auto rounded-full bg-gray-200" />
                      )}
                    </td>
                  ))}
                  <td className="text-center py-1.5">
                    {habit.streak > 0 ? (
                      <span className="flex items-center justify-center gap-0.5 text-orange-500">
                        <Flame size={10} className="fill-orange-500" />
                        {habit.streak}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="text-center py-1.5">
                    <span className="flex items-center justify-center gap-0.5 text-amber-600">
                      <Trophy size={10} />
                      {habit.accumulate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 习惯列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {state.habits.length === 0 && !isAdding ? (
          <div className="text-center py-8 text-gray-400">
            <Target size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">添加每日习惯，培养好的生活节奏</p>
          </div>
        ) : (
          state.habits.map((habit) => (
            <div key={habit.id} className={`group flex items-center gap-3 p-3 rounded-xl transition-colors ${isCompletedToday(habit) ? "bg-emerald-50" : "bg-gray-50 hover:bg-gray-100"}`}>
              <button onClick={() => handleToggle(habit.id, isCompletedToday(habit))} className="shrink-0">
                {isCompletedToday(habit) ? (
                  <CheckCircle2 size={22} className="text-emerald-500" />
                ) : (
                  <Circle size={22} className="text-gray-300 hover:text-gray-400 transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                {editingHabitId === habit.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={editingHabitName}
                      onChange={(e) => setEditingHabitName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditHabit();
                        if (e.key === "Escape") {
                          setEditingHabitId(null);
                          setEditingHabitName("");
                        }
                      }}
                      autoFocus
                      className="w-full px-2 py-1 rounded-lg bg-white border border-emerald-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                    <button onClick={saveEditHabit} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
                    <button onClick={() => { setEditingHabitId(null); setEditingHabitName(""); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={14} /></button>
                  </div>
                ) : (
                  <span className={`text-sm ${isCompletedToday(habit) ? "line-through text-gray-400" : "text-gray-700"}`}>{habit.name}</span>
                )}
              </div>
              {isConfirming(habit.id) ? (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-gray-500">确定？</span>
                  <button onClick={confirmDelete} className="p-1 rounded text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
                  <button onClick={cancelDelete} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={12} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEditHabit(habit.id, habit.name)} className="text-gray-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => requestDelete(habit.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 shrink-0">
                {habit.accumulate > 0 && (
                  <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600">
                    <Trophy size={14} />
                    {habit.accumulate}
                  </span>
                )}
                {habit.streak > 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${habit.streak >= 7 ? "text-orange-500" : "text-amber-500"}`}>
                    <Flame size={14} className={habit.streak >= 7 ? "fill-orange-500" : "fill-amber-500"} />
                    {habit.streak}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {totalCount > 0 && (
        <p className="text-[10px] text-gray-400 text-center mt-2 shrink-0">
          连续完成习惯可以积累 🔥 streak！
        </p>
      )}
    </div>
  );
}
