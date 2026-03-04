import { useGame, PLANT_STAGES } from "@/contexts/GameContext";
import { Heart, Timer, Flame } from "lucide-react";

const STAGE_ICONS: Record<string, string> = {
  seed: "🌰", sprout: "🌱", grass: "🌿", bush: "🪴", small_tree: "🌳", flower_tree: "🌸",
};

const STAGE_NAMES: Record<string, string> = {
  seed: "种子", sprout: "嫩芽", grass: "幼苗", bush: "灌木", small_tree: "小树", flower_tree: "花树",
};

// 好感度等级系统 - 与 PLANT_STAGES 对应
const AFFECTION_LEVELS = [
  { min: 0, name: "初识", color: "text-gray-500", icon: "🌱", desc: "一颗等待发芽的种子" },
  { min: 30, name: "萌芽", color: "text-emerald-500", icon: "🌿", desc: "嫩芽破土而出" },
  { min: 120, name: "成长", color: "text-teal-500", icon: "🌲", desc: "正在茁壮成长" },
  { min: 480, name: "茂盛", color: "text-blue-500", icon: "🌳", desc: "枝繁叶茂" },
  { min: 1920, name: "绽放", color: "text-purple-500", icon: "🌸", desc: "即将开花" },
  { min: 7680, name: "永恒", color: "text-amber-500", icon: "⭐", desc: "你们的羁绊已根深蒂固" },
];

// ============ 主组件 ============
export default function PlantInfo() {
  const { state } = useGame();
  
  // 计算当前阶段索引
  const currentIndex = PLANT_STAGES.findIndex((s, i) => 
    state.affection >= s.minAffection && 
    (i === PLANT_STAGES.length - 1 || state.affection < PLANT_STAGES[i + 1].minAffection)
  );
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;
  
  const currentStage = PLANT_STAGES[safeCurrentIndex];
  
  // 计算当前等级
  const currentLevel = AFFECTION_LEVELS.slice().reverse().find(l => state.affection >= l.min) || AFFECTION_LEVELS[0];
  
  // 计算下一等级所需好感度
  const nextLevel = AFFECTION_LEVELS.find(l => l.min > state.affection);
  const progressToNextLevel = nextLevel 
    ? ((state.affection - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100
    : 100;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
      {/* 头部 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md">
          <span className="text-2xl">{STAGE_ICONS[currentStage.image]}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-800">{currentStage.name}</h3>
            <span className="text-sm">{currentLevel.icon}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span>阶段 {safeCurrentIndex + 1}/{PLANT_STAGES.length}</span>
            <span>·</span>
            <span className={`${currentLevel.color} font-medium`}>{currentLevel.name}</span>
          </div>
        </div>
      </div>

      {/* 等级进度条 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">{currentLevel.name}</span>
          <span className="font-bold text-emerald-600">{state.affection} 好感度</span>
          {nextLevel && <span className="text-gray-400">{nextLevel.name}</span>}
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-500" style={{ width: `${Math.min(progressToNextLevel, 100)}%` }} />
        </div>
        {nextLevel && (
          <div className="text-[10px] text-gray-400 mt-1 text-right">
            距离 {nextLevel.name} 还需 {nextLevel.min - state.affection} 好感度
          </div>
        )}
      </div>

      {/* 描述 */}
      <p className="text-sm text-gray-600 mb-3 leading-relaxed">
        {currentStage.description}
      </p>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-xl bg-pink-50">
          <Heart size={14} className="mx-auto mb-0.5 text-pink-500 fill-pink-500" />
          <div className="text-base font-bold text-gray-800" style={{ fontFamily: "var(--font-mono)" }}>{state.affection}</div>
          <div className="text-[9px] text-gray-500">好感度</div>
        </div>
        <div className="text-center p-2 rounded-xl bg-blue-50">
          <Timer size={14} className="mx-auto mb-0.5 text-blue-500" />
          <div className="text-base font-bold text-gray-800" style={{ fontFamily: "var(--font-mono)" }}>{Math.floor(state.totalFocusMinutes)}</div>
          <div className="text-[9px] text-gray-500">专注分钟数</div>
        </div>
        <div className="text-center p-2 rounded-xl bg-orange-50">
          <Flame size={14} className="mx-auto mb-0.5 text-orange-500" />
          <div className="text-base font-bold text-gray-800" style={{ fontFamily: "var(--font-mono)" }}>{state.currentStreak}</div>
          <div className="text-[9px] text-gray-500">连续天数</div>
        </div>
      </div>

    </div>
  );
}
