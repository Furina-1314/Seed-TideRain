import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  saveMusicFile,
  getMusicFileUrl,
  deleteMusicFile,
  hasMusicFile,
  cleanupOrphanedFiles,
  getAllMusicFilesInfo,
} from "@/lib/musicStorage";

// ============ Types ============
export interface PlantStage {
  name: string;
  minAffection: number;
  image: string;
  description: string;
}

export interface MemoEntry {
  id: string;
  content: string;
  tag: string;
  priority: "low" | "medium" | "high";
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteEntry {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitEntry {
  id: string;
  name: string;
  completed: boolean;
  streak: number;
  lastCompleted: string | null;
}

export interface FocusSession {
  id: string;
  startTime: string;
  duration: number;
  completed: boolean;
}

export interface DialogMessage {
  id: string;
  text: string;
  minAffection: number;
  type: "encouragement" | "rest" | "milestone" | "greeting";
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  minutes: number;
  sessions: number;
}

export interface MusicTrack {
  id: string;
  name: string;
  url: string; // blob URL (temporary, will be refreshed on load)
  createdAt: string;
  status: "valid" | "missing" | "loading"; // file availability status
  size?: number; // file size in bytes
  duration?: number; // 歌曲时长（秒）
}

export interface GameState {
  // Affection / Plant growth
  affection: number;
  totalFocusMinutes: number;
  sessionsCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastSessionDate: string | null;

  // Pomodoro
  pomodoroMinutes: number;
  breakMinutes: number;
  pomodoroCycles: number;
  currentCycle: number;
  isTimerRunning: boolean;
  timerMode: "focus" | "break";
  timeRemaining: number;
  lastCycleCompletionMark: number;
  cycleAccumulatedFocusSeconds: number;
  cycleAccumulatedPomodoros: number;

  // Legacy settings
  skipButtonLocked: boolean; // 跳过按钮是否锁定

  // Sound — scene-based
  activeScene: string | null;
  customMix: Record<string, number>; // soundId -> volume (0-1)
  masterVolume: number;

  // Custom Music
  musicTracks: MusicTrack[];
  currentMusicId: string | null;
  isMusicPlaying: boolean;
  musicVolume: number;
  musicRepeatMode: "none" | "all" | "one"; // 顺序播放, 列表循环, 单曲循环
  isMusicLoading: boolean; // 音乐加载中标志
  musicCurrentTime: number; // 当前播放时间（秒）
  musicDuration: number; // 音乐总时长（秒）
  musicProgress: Record<string, number>; // 每首歌的播放进度（秒）

  // Memos (was notes)
  memos: MemoEntry[];
  memoTags: string[];
  showDoneMemos: boolean;

  // Notes
  notes: NoteEntry[];

  // Habits
  habits: HabitEntry[];

  // Calendar Diary
  diaryEntries: Record<string, string>;

  // Focus history
  sessions: FocusSession[];

  // Heatmap cache
  heatmapData: HeatmapDay[];

  // Dialog
  lastDialogShown: string | null;

  // UI
  activePanel: string | null;
  customBackground: string | null;
}

// ============ Plant Stages ============
export const PLANT_STAGES: PlantStage[] = [
  {
    name: "种子",
    minAffection: 0,
    image: "seed",
    description: "一颗充满希望的种子，等待你的专注来浇灌它。",
  },
  {
    name: "嫩芽",
    minAffection: 30,
    image: "sprout",
    description: "小小的嫩芽破土而出，你的专注正在生效！",
  },
  {
    name: "幼苗",
    minAffection: 120,
    image: "grass",
    description: "绿色的叶片在阳光下舒展，继续加油！",
  },
  {
    name: "灌木",
    minAffection: 480,
    image: "bush",
    description: "枝叶茂盛的小灌木，你的陪伴让它茁壮成长。",
  },
  {
    name: "小树",
    minAffection: 1920,
    image: "small_tree",
    description: "一棵挺拔的小树，它因你的坚持而充满生机。",
  },
  {
    name: "花树",
    minAffection: 7680,
    image: "flower_tree",
    description: "繁花盛开的大树，你们之间的羁绊已经很深了！",
  },
];

// ============ Dialog Messages ============
export const DIALOG_MESSAGES: DialogMessage[] = [
  // ===== 问候语 Greetings =====
  { id: "g1", text: "欢迎回来！今天也一起加油吧～", minAffection: 0, type: "greeting" },
  { id: "g2", text: "又见面了呢，准备好开始专注了吗？", minAffection: 30, type: "greeting" },
  { id: "g3", text: "你来了！我一直在等你呢～", minAffection: 100, type: "greeting" },
  { id: "g4", text: "最喜欢和你一起度过的专注时光了！", minAffection: 250, type: "greeting" },
  { id: "g5", text: "新的一天开始了，让我们创造美好吧！", minAffection: 0, type: "greeting" },
  { id: "g6", text: "早安！今天也要元气满满哦～", minAffection: 0, type: "greeting" },
  { id: "g7", text: "嗨！准备好开始今天的专注之旅了吗？", minAffection: 30, type: "greeting" },
  { id: "g8", text: "你的到来让这里变得更加温暖了～", minAffection: 100, type: "greeting" },
  { id: "g9", text: "每次见到你，我的叶子都会开心地摇摆！", minAffection: 250, type: "greeting" },
  { id: "g10", text: "欢迎来到我们的小温室，今天想专注什么呢？", minAffection: 0, type: "greeting" },
  { id: "g11", text: "呀，你来啦！我正想着你呢～", minAffection: 100, type: "greeting" },
  { id: "g12", text: "看见你的笑容，我就觉得今天会是美好的一天！", minAffection: 250, type: "greeting" },
  
  // ===== 鼓励 Encouragement =====
  { id: "e1", text: "你做得很好，继续保持！", minAffection: 0, type: "encouragement" },
  { id: "e2", text: "专注的你最棒了！我在这里陪着你。", minAffection: 30, type: "encouragement" },
  { id: "e3", text: "看到你这么努力，我也充满了力量！", minAffection: 100, type: "encouragement" },
  { id: "e4", text: "有你在身边，连阳光都变得更温暖了呢。", minAffection: 250, type: "encouragement" },
  { id: "e5", text: "你的每一分钟专注，都让这个温室更加美丽。", minAffection: 500, type: "encouragement" },
  { id: "e6", text: "深呼吸，放慢节奏，你可以做到的！", minAffection: 0, type: "encouragement" },
  { id: "e7", text: "别忘了，即使是小进步也值得庆祝！", minAffection: 30, type: "encouragement" },
  { id: "e8", text: "你的坚持就像阳光一样，让梦想慢慢发芽。", minAffection: 100, type: "encouragement" },
  { id: "e9", text: "专注不是一件容易的事，但你做得很出色！", minAffection: 100, type: "encouragement" },
  { id: "e10", text: "每一次你坐下来专注，都是对自己的一份礼物。", minAffection: 250, type: "encouragement" },
  { id: "e11", text: "你知道吗？你的努力让周围的一切都变得更加美好。", minAffection: 250, type: "encouragement" },
  { id: "e12", text: "不管多难的任务，只要一步一步来，总能完成的！", minAffection: 30, type: "encouragement" },
  { id: "e13", text: "相信自己，就像我相信你一样！", minAffection: 100, type: "encouragement" },
  { id: "e14", text: "累了就看看我，我会一直在这里为你加油！", minAffection: 250, type: "encouragement" },
  { id: "e15", text: "你的专注时光，是我成长最好的养分～", minAffection: 500, type: "encouragement" },
  
  // ===== 休息 Rest =====
  { id: "r1", text: "辛苦了！休息一下，喝杯水吧。", minAffection: 0, type: "rest" },
  { id: "r2", text: "休息时间到了～伸个懒腰，看看窗外的云吧。", minAffection: 30, type: "rest" },
  { id: "r3", text: "你刚才好专注啊！现在放松一下眼睛吧。", minAffection: 100, type: "rest" },
  { id: "r4", text: "休息也是很重要的呢，我帮你泡了一杯花茶～", minAffection: 250, type: "rest" },
  { id: "r5", text: "看，因为你的努力，花又开了一朵呢！", minAffection: 500, type: "rest" },
  { id: "r6", text: "站起来走走吧，让你的身体也舒展一下～", minAffection: 0, type: "rest" },
  { id: "r7", text: "闭上眼睛，听一首喜欢的歌，让心情放松下来。", minAffection: 30, type: "rest" },
  { id: "r8", text: "休息是为了走更长远的路，你做得很好！", minAffection: 100, type: "rest" },
  { id: "r9", text: "去吃点点心吧，补充能量才能继续战斗！", minAffection: 100, type: "rest" },
  { id: "r10", text: "深呼吸三次，感受空气流入肺部的清新感觉～", minAffection: 0, type: "rest" },
  { id: "r11", text: "你知道吗？适当的休息能让效率提高好多倍呢！", minAffection: 250, type: "rest" },
  { id: "r12", text: "休息时光也是成长的一部分，享受这一刻吧～", minAffection: 250, type: "rest" },
  { id: "r13", text: "你的专注让小花开得更灿烂了，谢谢你！", minAffection: 500, type: "rest" },
  { id: "r14", text: "休息好了吗？我随时准备陪你开始下一段专注时光！", minAffection: 100, type: "rest" },
  { id: "r15", text: "嗯～休息时的你看起来好放松，真好～", minAffection: 250, type: "rest" },
  
  // ===== 里程碑 Milestone =====
  { id: "m1", text: "你的第一次专注！这颗种子因你而发芽了！", minAffection: 0, type: "milestone" },
  { id: "m2", text: "好感度提升了！小苗在向你招手呢～", minAffection: 30, type: "milestone" },
  { id: "m3", text: "连续专注真厉害！植物长大了好多！", minAffection: 100, type: "milestone" },
  { id: "m4", text: "我们的羁绊越来越深了，谢谢你一直陪着我。", minAffection: 250, type: "milestone" },
  { id: "m5", text: "满树繁花为你绽放！你是最棒的专注伙伴！", minAffection: 1000, type: "milestone" },
  { id: "m6", text: "哇！你又进步了，我的叶子都在为你鼓掌！", minAffection: 30, type: "milestone" },
  { id: "m7", text: "看，这就是坚持的力量！我们一起成长了好多！", minAffection: 100, type: "milestone" },
  { id: "m8", text: "不知不觉间，我们已经一起度过了这么多专注时光～", minAffection: 250, type: "milestone" },
  { id: "m9", text: "每一滴汗水都没有白费，看我现在长得多好！", minAffection: 100, type: "milestone" },
  { id: "m10", text: "你的努力让这个温室充满了生机，谢谢你！", minAffection: 250, type: "milestone" },
  { id: "m11", text: "里程碑达成！这就是坚持的力量！", minAffection: 30, type: "milestone" },
  { id: "m12", text: "我为你感到骄傲！继续保持这份热情！", minAffection: 100, type: "milestone" },
  { id: "m13", text: "我们的友谊和这棵树一样，越长越茂盛了～", minAffection: 500, type: "milestone" },
  { id: "m14", text: "你是最棒的园丁，而我是最幸福的植物！", minAffection: 500, type: "milestone" },
  { id: "m15", text: "这一刻值得纪念，谢谢你一直以来的陪伴！", minAffection: 1000, type: "milestone" },
];

// ============ Daily Quotes ============
export const DAILY_QUOTES = [
  { text: "学如逆水行舟，不进则退。", author: "《增广贤文》" },
  { text: "千里之行，始于足下。", author: "老子" },
  { text: "博学之，审问之，慎思之，明辨之，笃行之。", author: "《中庸》" },
  { text: "不积跬步，无以至千里。", author: "荀子" },
  { text: "业精于勤，荒于嬉。", author: "韩愈" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  { text: "知之者不如好之者，好之者不如乐之者。", author: "孔子" },
  { text: "读书破万卷，下笔如有神。", author: "杜甫" },
  { text: "天才是百分之一的灵感加百分之九十九的汗水。", author: "爱迪生" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "路漫漫其修远兮，吾将上下而求索。", author: "屈原" },
  { text: "宝剑锋从磨砺出，梅花香自苦寒来。", author: "《警世贤文》" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "书山有路勤为径，学海无涯苦作舟。", author: "韩愈" },
];

export function getDailyQuote() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

// ============ Sound Scenes ============
export interface SoundScene {
  id: string;
  name: string;
  icon: string;
  description: string;
  sounds: { id: string; volume: number }[];
}

export const SOUND_SCENES: SoundScene[] = [
  {
    id: "late_night_study",
    name: "深夜自习室",
    icon: "🌙",
    description: "夜深人静，书写声与虫鸣相伴",
    sounds: [
      { id: "night", volume: 0.6 },
      { id: "library", volume: 0.3 },
    ],
  },
  {
    id: "rainy_cafe",
    name: "雨天咖啡馆",
    icon: "☕",
    description: "窗外雨声淅沥，室内温暖宜人",
    sounds: [
      { id: "rain", volume: 0.5 },
      { id: "cafe", volume: 0.4 },
    ],
  },
  {
    id: "morning_garden",
    name: "清晨花园",
    icon: "🌸",
    description: "鸟鸣婉转，微风轻拂",
    sounds: [
      { id: "birds", volume: 0.5 },
      { id: "wind", volume: 0.3 },
    ],
  },
  {
    id: "campfire",
    name: "篝火夜话",
    icon: "🔥",
    description: "篝火噼啪作响，虫鸣声声入耳",
    sounds: [
      { id: "fire", volume: 0.6 },
      { id: "night", volume: 0.3 },
    ],
  },
  {
    id: "ocean_breeze",
    name: "海边小屋",
    icon: "🌊",
    description: "海浪轻拍沙滩，微风缓缓吹过",
    sounds: [
      { id: "ocean", volume: 0.6 },
      { id: "wind", volume: 0.2 },
    ],
  },
  {
    id: "thunderstorm",
    name: "暴风雨夜",
    icon: "⛈️",
    description: "雷声轰鸣，大雨倾盆而下",
    sounds: [
      { id: "thunder", volume: 0.5 },
      { id: "rain", volume: 0.5 },
    ],
  },
];

export const INDIVIDUAL_SOUNDS = [
  { id: "rain", name: "雨声", icon: "🌧️" },
  { id: "thunder", name: "雷雨", icon: "⛈️" },
  { id: "ocean", name: "海浪", icon: "🌊" },
  { id: "wind", name: "微风", icon: "🍃" },
  { id: "birds", name: "鸟鸣", icon: "🐦" },
  { id: "fire", name: "篝火", icon: "🔥" },
  { id: "white", name: "白噪音", icon: "📻" },
  { id: "brown", name: "棕噪音", icon: "🎵" },
  { id: "pink", name: "粉噪音", icon: "🎶" },
  { id: "cafe", name: "咖啡馆", icon: "☕" },
  { id: "library", name: "图书馆", icon: "📚" },
  { id: "night", name: "夜虫鸣", icon: "🌙" },
];

// ============ Actions ============
type GameAction =
  | { type: "START_TIMER" }
  | { type: "PAUSE_TIMER" }
  | { type: "RESET_TIMER" }
  | { type: "TICK" }
  | { type: "COMPLETE_SESSION"; payload?: { completedFocusSeconds?: number; endRound?: boolean } }
  | { type: "SET_POMODORO_MINUTES"; payload: number }
  | { type: "SET_BREAK_MINUTES"; payload: number }
  | { type: "SET_POMODORO_CYCLES"; payload: number }
  | { type: "TOGGLE_SKIP_BUTTON_LOCK" }
  | { type: "SET_SCENE"; payload: string | null }
  | { type: "SET_CUSTOM_MIX"; payload: Record<string, number> }
  | { type: "SET_MASTER_VOLUME"; payload: number }
  | { type: "ADD_MEMO"; payload: { content: string; tag: string; priority: MemoEntry["priority"] } }
  | { type: "UPDATE_MEMO"; payload: { id: string; content?: string; tag?: string; priority?: MemoEntry["priority"]; done?: boolean } }
  | { type: "DELETE_MEMO"; payload: string }
  | { type: "ADD_MEMO_TAG"; payload: string }
  | { type: "DELETE_MEMO_TAG"; payload: string }
  | { type: "SET_SHOW_DONE_MEMOS"; payload: boolean }
  | { type: "ADD_NOTE"; payload: { content: string } }
  | { type: "UPDATE_NOTE"; payload: { id: string; content: string } }
  | { type: "DELETE_NOTE"; payload: string }
  | { type: "ADD_HABIT"; payload: { name: string } }
  | { type: "TOGGLE_HABIT"; payload: string }
  | { type: "DELETE_HABIT"; payload: string }
  | { type: "SET_DIARY_ENTRY"; payload: { date: string; content: string } }
  | { type: "SET_ACTIVE_PANEL"; payload: string | null }
  | { type: "SET_CUSTOM_BACKGROUND"; payload: string | null }
  | { type: "LOAD_STATE"; payload: Partial<GameState> }
  // Music actions
  | { type: "ADD_MUSIC_TRACK"; payload: { file: File; id: string; name: string } }
  | { type: "UPDATE_MUSIC_TRACK"; payload: { id: string; name: string } }
  | { type: "DELETE_MUSIC_TRACK"; payload: string }
  | { type: "REORDER_MUSIC_TRACKS"; payload: MusicTrack[] }
  | { type: "PLAY_MUSIC"; payload: string | null }
  | { type: "PAUSE_MUSIC" }
  | { type: "SET_CURRENT_MUSIC"; payload: string | null } // 只设置当前音乐，不自动播放
  | { type: "SET_MUSIC_VOLUME"; payload: number }
  | { type: "SET_MUSIC_REPEAT_MODE"; payload: "none" | "all" | "one" }
  | { type: "UPDATE_MUSIC_TRACK_STATUS"; payload: { id: string; status: MusicTrack["status"]; url?: string } }
  | { type: "REUPLOAD_MUSIC_TRACK"; payload: { id: string; file: File } }
  | { type: "SET_MUSIC_PROGRESS"; payload: { currentTime: number; duration: number } }
  | { type: "SEEK_MUSIC"; payload: number };

// ============ Initial State ============
const initialState: GameState = {
  affection: 0,
  totalFocusMinutes: 0,
  sessionsCompleted: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastSessionDate: null,
  pomodoroMinutes: 25,
  breakMinutes: 5,
  pomodoroCycles: 4,
  currentCycle: 1,
  skipButtonLocked: true,
  isTimerRunning: false,
  timerMode: "focus",
  timeRemaining: 25 * 60,
  lastCycleCompletionMark: 0,
  cycleAccumulatedFocusSeconds: 0,
  cycleAccumulatedPomodoros: 0,
  activeScene: null,
  customMix: {},
  masterVolume: 0.5,
  musicTracks: [],
  currentMusicId: null,
  isMusicPlaying: false,
  musicVolume: 0.5,
  musicRepeatMode: "all",
  isMusicLoading: true,
  musicCurrentTime: 0,
  musicDuration: 0,
  musicProgress: {},
  memos: [],
  memoTags: ["学习", "待查", "论文"],
  showDoneMemos: false,
  notes: [],
  habits: [],
  diaryEntries: {},
  customBackground: null,
  sessions: [],
  heatmapData: [],
  lastDialogShown: null,
  activePanel: null,
};

// ============ Helper ============
function getDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ============ Reducer ============
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_TIMER":
      return { ...state, isTimerRunning: true };

    case "PAUSE_TIMER":
      return { ...state, isTimerRunning: false };

    case "RESET_TIMER":
      return {
        ...state,
        isTimerRunning: false,
        currentCycle: 1,
        cycleAccumulatedFocusSeconds: 0,
        cycleAccumulatedPomodoros: 0,
        timeRemaining: state.timerMode === "focus"
          ? state.pomodoroMinutes * 60
          : state.breakMinutes * 60,
      };

    case "TICK":
      if (state.timeRemaining <= 0) return state;
      return { ...state, timeRemaining: state.timeRemaining - 1 };

    case "COMPLETE_SESSION": {
      const today = new Date().toDateString();
      const isConsecutive = state.lastSessionDate === new Date(Date.now() - 86400000).toDateString()
        || state.lastSessionDate === today;

      const settleRound = (accumulatedSeconds: number, accumulatedPomodoros: number): GameState => {
        const settledMinutes = Math.floor(accumulatedSeconds / 60);
        const affectionGain = settledMinutes > 0 ? Math.max(1, Math.floor(settledMinutes * 0.8)) : 0;
        const newStreak = isConsecutive || state.lastSessionDate === today
          ? (state.lastSessionDate === today ? state.currentStreak : state.currentStreak + 1)
          : 1;

        const todayStr = getDateStr();
        const existingDay = state.heatmapData.find((d) => d.date === todayStr);
        const updatedHeatmap = existingDay
          ? state.heatmapData.map((d) =>
              d.date === todayStr
                ? { ...d, minutes: d.minutes + settledMinutes, sessions: d.sessions + accumulatedPomodoros }
                : d
            )
          : [...state.heatmapData, { date: todayStr, minutes: settledMinutes, sessions: accumulatedPomodoros }];

        const nextSessions = settledMinutes > 0 || accumulatedPomodoros > 0
          ? [
              ...state.sessions,
              {
                id: Date.now().toString(),
                startTime: new Date().toISOString(),
                duration: settledMinutes,
                completed: true,
              },
            ]
          : state.sessions;

        return {
          ...state,
          affection: Math.max(0, (Number.isFinite(state.affection) ? state.affection : 0) + affectionGain),
          totalFocusMinutes: state.totalFocusMinutes + settledMinutes,
          sessionsCompleted: state.sessionsCompleted + accumulatedPomodoros,
          currentStreak: accumulatedPomodoros > 0 ? newStreak : state.currentStreak,
          longestStreak: accumulatedPomodoros > 0 ? Math.max(state.longestStreak, newStreak) : state.longestStreak,
          lastSessionDate: accumulatedPomodoros > 0 ? today : state.lastSessionDate,
          isTimerRunning: false,
          timerMode: "focus",
          currentCycle: 1,
          timeRemaining: state.pomodoroMinutes * 60,
          lastCycleCompletionMark: Date.now(),
          cycleAccumulatedFocusSeconds: 0,
          cycleAccumulatedPomodoros: 0,
          heatmapData: updatedHeatmap,
          sessions: nextSessions,
        };
      };

      if (state.timerMode === "focus") {
        const completedFocusSeconds = Math.max(0, Math.min(
          state.pomodoroMinutes * 60,
          action.payload?.completedFocusSeconds ?? state.pomodoroMinutes * 60,
        ));

        const accumulatedSeconds = state.cycleAccumulatedFocusSeconds + completedFocusSeconds;
        const accumulatedPomodoros = state.cycleAccumulatedPomodoros + 1;
        const cycleFinished = Boolean(action.payload?.endRound) || state.currentCycle >= state.pomodoroCycles;

        if (!cycleFinished) {
          return {
            ...state,
            isTimerRunning: true,
            timerMode: "break",
            currentCycle: state.currentCycle,
            timeRemaining: state.breakMinutes * 60,
            cycleAccumulatedFocusSeconds: accumulatedSeconds,
            cycleAccumulatedPomodoros: accumulatedPomodoros,
          };
        }

        return settleRound(accumulatedSeconds, accumulatedPomodoros);
      }

      if (action.payload?.endRound) {
        return settleRound(state.cycleAccumulatedFocusSeconds, state.cycleAccumulatedPomodoros);
      }

      return {
        ...state,
        isTimerRunning: true,
        timerMode: "focus",
        currentCycle: Math.min(state.currentCycle + 1, state.pomodoroCycles),
        timeRemaining: state.pomodoroMinutes * 60,
      };
    }

    case "SET_POMODORO_MINUTES":
      return {
        ...state,
        pomodoroMinutes: action.payload,
        timeRemaining: state.timerMode === "focus" && !state.isTimerRunning
          ? action.payload * 60
          : state.timeRemaining,
      };

    case "SET_BREAK_MINUTES":
      return {
        ...state,
        breakMinutes: action.payload,
        timeRemaining: state.timerMode === "break" && !state.isTimerRunning
          ? action.payload * 60
          : state.timeRemaining,
      };

    case "SET_POMODORO_CYCLES":
      return {
        ...state,
        pomodoroCycles: action.payload,
        currentCycle: Math.min(state.currentCycle, action.payload),
      };

    case "TOGGLE_SKIP_BUTTON_LOCK":
      return {
        ...state,
        skipButtonLocked: !state.skipButtonLocked,
      };

    case "SET_SCENE": {
      if (!action.payload) {
        return { ...state, activeScene: null, customMix: {} };
      }
      const scene = SOUND_SCENES.find((s) => s.id === action.payload);
      if (scene) {
        const mix: Record<string, number> = {};
        scene.sounds.forEach((s) => { mix[s.id] = s.volume; });
        return { ...state, activeScene: action.payload, customMix: mix };
      }
      return { ...state, activeScene: action.payload };
    }

    case "SET_CUSTOM_MIX":
      return { ...state, customMix: action.payload };

    case "SET_MASTER_VOLUME":
      return { ...state, masterVolume: action.payload };

    case "ADD_MEMO": {
      const now = new Date().toISOString();
      return {
        ...state,
        memos: [
          {
            id: Date.now().toString(),
            content: action.payload.content,
            tag: action.payload.tag,
            priority: action.payload.priority,
            done: false,
            createdAt: now,
            updatedAt: now,
          },
          ...state.memos,
        ],
      };
    }

    case "UPDATE_MEMO":
      return {
        ...state,
        memos: state.memos.map((m) =>
          m.id === action.payload.id
            ? {
                ...m,
                ...(action.payload.content !== undefined && { content: action.payload.content }),
                ...(action.payload.tag !== undefined && { tag: action.payload.tag }),
                ...(action.payload.priority !== undefined && { priority: action.payload.priority }),
                ...(action.payload.done !== undefined && { done: action.payload.done }),
                updatedAt: new Date().toISOString(),
              }
            : m
        ),
      };

    case "DELETE_MEMO":
      return { ...state, memos: state.memos.filter((m) => m.id !== action.payload) };

    case "ADD_MEMO_TAG":
      if (state.memoTags.includes(action.payload)) return state;
      return { ...state, memoTags: [...state.memoTags, action.payload] };

    case "DELETE_MEMO_TAG":
      return { ...state, memoTags: state.memoTags.filter((tag) => tag !== action.payload) };

    case "SET_SHOW_DONE_MEMOS":
      return { ...state, showDoneMemos: action.payload };

    case "ADD_HABIT":
      return {
        ...state,
        habits: [
          ...state.habits,
          { id: Date.now().toString(), name: action.payload.name, completed: false, streak: 0, lastCompleted: null },
        ],
      };

    case "TOGGLE_HABIT": {
      const today = new Date().toDateString();
      return {
        ...state,
        habits: state.habits.map((h) => {
          if (h.id !== action.payload) return h;
          if (h.completed) {
            // 取消勾选：重置 streak（减1，最小为0），清空最后完成时间
            return { 
              ...h, 
              completed: false, 
              streak: Math.max(0, h.streak - 1),
              lastCompleted: null 
            };
          }
          const isConsecutive = h.lastCompleted === new Date(Date.now() - 86400000).toDateString();
          return {
            ...h,
            completed: true,
            streak: isConsecutive ? h.streak + 1 : 1,
            lastCompleted: today,
          };
        }),
      };
    }

    case "DELETE_HABIT":
      return { ...state, habits: state.habits.filter((h) => h.id !== action.payload) };

    case "ADD_NOTE": {
      const now = new Date().toISOString();
      return {
        ...state,
        notes: [
          { id: Date.now().toString(), content: action.payload.content, createdAt: now, updatedAt: now },
          ...state.notes,
        ],
      };
    }

    case "UPDATE_NOTE":
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === action.payload.id
            ? { ...note, content: action.payload.content, updatedAt: new Date().toISOString() }
            : note
        ),
      };

    case "DELETE_NOTE":
      return { ...state, notes: state.notes.filter((note) => note.id !== action.payload) };

    case "SET_DIARY_ENTRY":
      return {
        ...state,
        diaryEntries: {
          ...state.diaryEntries,
          [action.payload.date]: action.payload.content,
        },
      };

    case "SET_CUSTOM_BACKGROUND":
      return { ...state, customBackground: action.payload };

    case "SET_ACTIVE_PANEL":
      return { ...state, activePanel: state.activePanel === action.payload ? null : action.payload };

    // Music actions
    case "ADD_MUSIC_TRACK": {
      // Save to IndexedDB is handled by the component/hook
      const url = URL.createObjectURL(action.payload.file);
      const newTrack: MusicTrack = {
        id: action.payload.id,
        name: action.payload.name,
        url,
        createdAt: new Date().toISOString(),
        status: "valid",
        size: action.payload.file.size,
      };
      return { ...state, musicTracks: [...state.musicTracks, newTrack] };
    }

    case "UPDATE_MUSIC_TRACK":
      return {
        ...state,
        musicTracks: state.musicTracks.map((t) =>
          t.id === action.payload.id ? { ...t, name: action.payload.name } : t
        ),
      };

    case "DELETE_MUSIC_TRACK": {
      const isCurrent = state.currentMusicId === action.payload;
      // Delete from IndexedDB is handled by the component
      return {
        ...state,
        musicTracks: state.musicTracks.filter((t) => t.id !== action.payload),
        currentMusicId: isCurrent ? null : state.currentMusicId,
        isMusicPlaying: isCurrent ? false : state.isMusicPlaying,
      };
    }

    case "UPDATE_MUSIC_TRACK_STATUS":
      return {
        ...state,
        musicTracks: state.musicTracks.map((t) =>
          t.id === action.payload.id
            ? {
                ...t,
                status: action.payload.status,
                ...(action.payload.url && { url: action.payload.url }),
              }
            : t
        ),
      };

    case "REUPLOAD_MUSIC_TRACK": {
      // This is handled by the component, reducer just updates the status
      return {
        ...state,
        musicTracks: state.musicTracks.map((t) =>
          t.id === action.payload.id ? { ...t, status: "loading" } : t
        ),
      };
    }

    case "SET_MUSIC_PROGRESS": {
      const newProgress = {
        ...state.musicProgress,
        ...(state.currentMusicId && {
          [state.currentMusicId]: action.payload.currentTime,
        }),
      };
      // 同时更新当前歌曲的 duration
      const currentTrack = state.currentMusicId
        ? state.musicTracks.find((t) => t.id === state.currentMusicId)
        : null;
      const newTracks = currentTrack
        ? state.musicTracks.map((t) =>
            t.id === state.currentMusicId
              ? { ...t, duration: action.payload.duration }
              : t
          )
        : state.musicTracks;
      
      return {
        ...state,
        musicCurrentTime: action.payload.currentTime,
        musicDuration: action.payload.duration,
        musicProgress: newProgress,
        musicTracks: newTracks,
      };
    }

    case "SEEK_MUSIC":
      return {
        ...state,
        musicCurrentTime: action.payload,
      };

    case "REORDER_MUSIC_TRACKS":
      return { ...state, musicTracks: action.payload };

    case "PLAY_MUSIC": {
      const newTrackId = action.payload;
      
      // 保存当前歌曲的进度（如果有）
      const newProgress = state.currentMusicId
        ? { ...state.musicProgress, [state.currentMusicId]: state.musicCurrentTime }
        : { ...state.musicProgress };
      
      // 获取新歌曲的保存进度
      const savedProgress = newTrackId ? (newProgress[newTrackId] || 0) : 0;
      
      return {
        ...state,
        currentMusicId: newTrackId,
        isMusicPlaying: newTrackId !== null,
        musicCurrentTime: savedProgress,
        musicProgress: newProgress,
      };
    }

    case "PAUSE_MUSIC": {
      // 暂停时保存当前进度到 musicProgress
      const newProgress = state.currentMusicId
        ? { ...state.musicProgress, [state.currentMusicId]: state.musicCurrentTime }
        : { ...state.musicProgress };
      
      return { 
        ...state, 
        isMusicPlaying: false,
        musicProgress: newProgress,
      };
    }

    case "SET_CURRENT_MUSIC":
      return { ...state, currentMusicId: action.payload };

    case "SET_MUSIC_VOLUME":
      return { ...state, musicVolume: action.payload };

    case "SET_MUSIC_REPEAT_MODE":
      return { ...state, musicRepeatMode: action.payload };

    case "LOAD_STATE":
      return { ...state, ...action.payload, isMusicLoading: false };

    default:
      return state;
  }
}

// ============ Context ============
interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  currentPlantStage: PlantStage;
  nextPlantStage: PlantStage | null;
  progressToNext: number;
  getDialogForType: (type: DialogMessage["type"]) => DialogMessage;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Load saved state and validate music files
  useEffect(() => {
    const loadState = async () => {
      try {
        const saved = localStorage.getItem("focus-companion-state");
        // 同时读取 last-audio，因为它保存得更及时（主状态有 500ms 延迟）
        const lastAudioRaw = localStorage.getItem("focus-companion-last-audio");
        const lastAudio = lastAudioRaw ? JSON.parse(lastAudioRaw) : null;
        
        if (saved) {
          const parsed = JSON.parse(saved);
          
          // 优先使用 last-audio 中的 currentMusicId（因为它保存得更及时）
          if (lastAudio?.currentMusicId) {
            parsed.currentMusicId = lastAudio.currentMusicId;
          }
          if (lastAudio?.musicProgress) {
            parsed.musicProgress = { ...parsed.musicProgress, ...lastAudio.musicProgress };
          }
          
          // Validate and refresh music file URLs from IndexedDB
          let validatedTracks: MusicTrack[] = [];
          
          if (parsed.musicTracks && Array.isArray(parsed.musicTracks) && parsed.musicTracks.length > 0) {
            // Retry logic for IndexedDB validation (handles fresh page loads)
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
              const allDbFiles = await getAllMusicFilesInfo();
              
              // If we found files in IndexedDB, proceed with validation
              if (allDbFiles.length > 0 || retryCount === maxRetries - 1) {
                // Validate tracks sequentially to avoid IndexedDB contention
                validatedTracks = [];
                for (const track of parsed.musicTracks) {
                  try {
                    const hasFile = await hasMusicFile(track.id);
                    
                    if (hasFile) {
                      const newUrl = await getMusicFileUrl(track.id);
                      
                      if (newUrl) {
                        validatedTracks.push({
                          ...track,
                          url: newUrl,
                          status: "valid" as const,
                        });
                        continue;
                      }
                    }
                    // File not in IndexedDB, mark as missing
                    validatedTracks.push({
                      ...track,
                      status: "missing" as const,
                    });
                  } catch {
                    validatedTracks.push({
                      ...track,
                      status: "missing" as const,
                    });
                  }
                }
                break; // Successfully validated, exit retry loop
              } else {
                // IndexedDB appears empty, wait and retry
                retryCount++;
                if (retryCount < maxRetries) {
                  await new Promise(r => setTimeout(r, 200 * retryCount));
                }
              }
            }
            
            // Cleanup orphaned files - disabled to prevent accidental deletion
            const validIds = validatedTracks
              .filter((t) => t.status === "valid")
              .map((t) => t.id);
            await cleanupOrphanedFiles(validIds);
          }
          
          // 恢复计时器状态：保留剩余时间，但暂停计时
          const savedTimeRemaining = parsed.timeRemaining;
          const totalTime = parsed.timerMode === "focus"
            ? (parsed.pomodoroMinutes || 25) * 60
            : (parsed.breakMinutes || 5) * 60;
          
          // 确保剩余时间有效（在 0 到总时长之间）
          const validTimeRemaining = savedTimeRemaining > 0 && savedTimeRemaining <= totalTime
            ? savedTimeRemaining
            : totalTime;
          
          // 刷新后默认清空场景和混音（需要用户点击"恢复上次"才恢复）
          // 但保留音乐选中状态和进度
          
          // 关键：确保 musicCurrentTime 对应选中的歌曲
          // 同时验证选中的音乐是否还存在（可能被删除了）
          const savedMusicId = parsed.currentMusicId;
          const savedMusicProgress = parsed.musicProgress || {};
          
          // 检查选中的音乐是否还有效
          const selectedTrack = savedMusicId 
            ? validatedTracks.find((t: MusicTrack) => t.id === savedMusicId)
            : null;
          const validMusicId = selectedTrack?.status === "valid" ? savedMusicId : null;
          
          // 只有有效的音乐才恢复进度，否则重置为0
          const correctCurrentTime = validMusicId 
            ? (savedMusicProgress[validMusicId] || 0)
            : 0;
          
          dispatch({
            type: "LOAD_STATE",
            payload: {
              ...parsed,
              musicTracks: validatedTracks,
              isTimerRunning: false,
              timerMode: parsed.timerMode === "focus" ? "focus" : "break",
              timeRemaining: validTimeRemaining,
              // 清空场景和混音
              activeScene: null,
              customMix: {},
              // 音乐：保留有效选中歌曲，暂停播放；如果歌曲已被删除则清空
              currentMusicId: validMusicId,
              isMusicPlaying: false,
              // 关键：使用选中歌曲的保存进度
              musicCurrentTime: correctCurrentTime,
            },
          });
        } else {
          // No saved state, set loading to false
          dispatch({ type: "LOAD_STATE", payload: { isMusicLoading: false } });
        }
      } catch (e) {
        console.error("Failed to load saved state:", e);
        dispatch({ type: "LOAD_STATE", payload: { isMusicLoading: false } });
      }
    };
    
    loadState();
  }, []);

  // 保存主状态（debounced 500ms）
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const { isTimerRunning, activePanel, ...saveable } = state;
        void isTimerRunning;
        void activePanel;
        localStorage.setItem("focus-companion-state", JSON.stringify(saveable));
      } catch (e) {
        console.warn("Failed to save state:", e);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [state]);
  
  // 音频状态立即保存（无延迟，防止刷新丢失）
  // 只要有选中歌曲或正在播放音频就保存
  useEffect(() => {
    try {
      const hasAudioActivity = state.activeScene !== null || 
        Object.values(state.customMix).some((v) => v > 0) ||
        state.currentMusicId !== null;
      
      if (hasAudioActivity) {
        const audioState = {
          activeScene: state.activeScene,
          customMix: state.customMix,
          masterVolume: state.masterVolume,
          currentMusicId: state.currentMusicId,
          musicVolume: state.musicVolume,
          musicRepeatMode: state.musicRepeatMode,
          musicProgress: state.musicProgress,
          isMusicPlaying: state.isMusicPlaying,
        };
        localStorage.setItem("focus-companion-last-audio", JSON.stringify(audioState));
      }
    } catch (e) {
      console.warn("Failed to save audio state:", e);
    }
  }, [state.activeScene, state.customMix, state.masterVolume, state.currentMusicId, state.musicVolume, state.musicRepeatMode, state.musicProgress, state.isMusicPlaying]);
  
  // 音乐进度变化时立即保存到主 storage（无延迟）
  useEffect(() => {
    try {
      const saved = localStorage.getItem("focus-companion-state");
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.musicProgress = state.musicProgress;
        parsed.musicCurrentTime = state.musicCurrentTime;
        localStorage.setItem("focus-companion-state", JSON.stringify(parsed));
      }
    } catch (e) {
      console.warn("Failed to save music progress:", e);
    }
  }, [state.musicProgress, state.musicCurrentTime]);

  // Reset habits daily - 使用 ref 防止重复执行
  const hasResetTodayRef = useRef(false);
  
  useEffect(() => {
    if (hasResetTodayRef.current) return;
    
    const today = new Date().toDateString();
    const lastCheck = localStorage.getItem("focus-companion-last-habit-check");
    
    if (lastCheck !== today) {
      localStorage.setItem("focus-companion-last-habit-check", today);
      hasResetTodayRef.current = true;
      
      // 重置所有非今日完成的 habit
      state.habits.forEach((h) => {
        if (h.completed && h.lastCompleted !== today) {
          dispatch({ type: "TOGGLE_HABIT", payload: h.id });
        }
      });
    } else {
      hasResetTodayRef.current = true;
    }
  }, []); // 只在组件挂载时执行一次

  const currentPlantStage = [...PLANT_STAGES].reverse().find((s) => state.affection >= s.minAffection) || PLANT_STAGES[0];
  const currentIndex = PLANT_STAGES.indexOf(currentPlantStage);
  const nextPlantStage = currentIndex < PLANT_STAGES.length - 1 ? PLANT_STAGES[currentIndex + 1] : null;
  const progressToNext = nextPlantStage
    ? ((state.affection - currentPlantStage.minAffection) / (nextPlantStage.minAffection - currentPlantStage.minAffection)) * 100
    : 100;

  const getDialogForType = useCallback(
    (type: DialogMessage["type"]) => {
      const eligible = DIALOG_MESSAGES.filter(
        (m) => m.type === type && m.minAffection <= state.affection
      );
      return eligible[Math.floor(Math.random() * eligible.length)] || DIALOG_MESSAGES[0];
    },
    [state.affection]
  );

  return (
    <GameContext.Provider
      value={{ state, dispatch, currentPlantStage, nextPlantStage, progressToNext, getDialogForType }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
