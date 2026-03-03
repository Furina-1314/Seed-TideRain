import { useGame, SOUND_SCENES, INDIVIDUAL_SOUNDS, type MusicTrack } from "@/contexts/GameContext";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useMusicPlayer } from "@/hooks/useMusicPlayer";
import { saveMusicFile, deleteMusicFile, getMusicFileUrl } from "@/lib/musicStorage";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Volume2, VolumeX, Sliders, Sparkles, Music, 
  Upload, Trash2, Edit2, Check, X, GripVertical, Play, Pause,
  ListMusic, Repeat, Repeat1, ChevronLeft, ChevronRight,
  AlertCircle, RefreshCw
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

type Mode = "scenes" | "mixer" | "music";

const SCENE_ICONS: Record<string, string> = {
  late_night_study: "🌙",
  rainy_cafe: "☕",
  morning_garden: "🌸",
  campfire: "🔥",
  ocean_breeze: "🌊",
  thunderstorm: "⛈️",
};

const SOUND_ICONS: Record<string, string> = {
  rain: "🌧️", thunder: "⛈️", ocean: "🌊", wind: "🍃", birds: "🐦",
  fire: "🔥", white: "📻", brown: "🎵", pink: "🎶", cafe: "☕",
  library: "📚", night: "🌙",
};

// 自定义滑块
function CustomSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const percentage = Math.round(value * 100);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleInteraction = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const newValue = Math.max(0, Math.min(1, x / rect.width));
    onChange(newValue);
  }, [onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleInteraction(e.clientX);
    
    const handleMouseMove = (moveEvent: MouseEvent) => handleInteraction(moveEvent.clientX);
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div ref={trackRef} className="flex-1 h-4 flex items-center cursor-pointer" onMouseDown={handleMouseDown}>
      <div className="relative w-full h-[4px] bg-gray-200 rounded-full overflow-hidden">
        <div className="absolute left-0 top-0 h-full bg-purple-500 rounded-full" style={{ width: `${percentage}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-purple-500 rounded-full shadow-sm" style={{ left: `calc(${percentage}% - 5px)` }} />
      </div>
    </div>
  );
}

// 音乐轨道项 - 智能编辑版：单选编辑、ESC取消、Enter保存、失焦自动保存
interface MusicTrackItemProps {
  track: MusicTrack;
  index: number;
  isPlaying: boolean;
  isCurrent: boolean;
  isEditing: boolean;
  currentTime?: number;
  duration?: number;
  onPlay: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onReupload: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onSeek?: (time: number) => void;
}

function MusicTrackItem({
  track,
  index,
  isPlaying,
  isCurrent,
  isEditing,
  currentTime = 0,
  duration = 0,
  onPlay,
  onDelete,
  onRename,
  onReupload,
  onStartEdit,
  onStopEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onSeek,
}: MusicTrackItemProps) {
  const [editName, setEditName] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // 当进入编辑状态时，重置编辑名称并聚焦
  useEffect(() => {
    if (isEditing) {
      setEditName(track.name);
      // 延迟聚焦，确保 input 已渲染
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isEditing, track.name]);

  const handleSave = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== track.name) {
      onRename(trimmed);
    }
    onStopEdit();
  }, [editName, track.name, onRename, onStopEdit]);

  const handleCancel = useCallback(() => {
    setEditName(track.name);
    onStopEdit();
  }, [track.name, onStopEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // 检查焦点是否移动到了按钮上
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest("[data-edit-action]")) {
      return;
    }
    // 失去焦点时自动保存
    handleSave();
  }, [handleSave]);

  const isMissing = track.status === "missing";
  const isLoading = track.status === "loading";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !isCurrent) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * duration);
  };

  return (
    <div 
      className={`rounded-lg m-0.5 ${
        isCurrent && isPlaying
          ? "bg-purple-100 border border-purple-300" 
          : isMissing 
            ? "bg-red-50/30 opacity-70" 
            : "hover:bg-gray-50"
      }`}
      draggable={!isMissing && !isEditing}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
    >
      {/* 主行 */}
      <div className="flex items-center gap-1.5 py-1.5 px-2">
      {/* 拖拽手柄 */}
      <div 
        className={`shrink-0 ${
          isMissing || isEditing ? "text-gray-200 cursor-default" : "text-gray-300 hover:text-gray-500 cursor-move"
        }`}
      >
        <GripVertical size={14} />
      </div>
      
      {/* 播放/状态按钮 */}
      {isMissing ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onReupload}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
            >
              <RefreshCw size={12} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>文件已丢失，点击重新上传</TooltipContent>
        </Tooltip>
      ) : isLoading ? (
        <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 text-gray-400">
          <div className="w-3 h-3 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <button 
          onClick={onPlay}
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            isCurrent && isPlaying 
              ? "bg-purple-500 text-white" 
              : "bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600"
          }`}
        >
          {isCurrent && isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
        </button>
      )}

      {/* 歌曲信息 */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-0.5">
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 text-xs px-1.5 py-1 rounded border border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white min-w-0"
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onClick={(e) => e.stopPropagation()}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  data-edit-action="save"
                  onClick={(e) => { e.stopPropagation(); handleSave(); }} 
                  className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors shrink-0"
                >
                  <Check size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>保存 (Enter)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  data-edit-action="cancel"
                  onClick={(e) => { e.stopPropagation(); handleCancel(); }} 
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors shrink-0"
                >
                  <X size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>取消 (Esc)</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div 
            className="flex items-start gap-2 min-w-0 cursor-pointer"
            onClick={onPlay}
          >
            <span className={`text-xs break-all leading-tight flex-1 ${
              isCurrent ? "font-medium text-purple-700" : 
              isMissing ? "text-red-600" : "text-gray-700"
            }`}>
              {track.name}
            </span>
            {isMissing && (
              <button
                onClick={(e) => { e.stopPropagation(); onReupload(); }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] hover:bg-red-200 transition-colors shrink-0"
              >
                <RefreshCw size={10} />
                重新上传
              </button>
            )}
          </div>
        )}
      </div>

      {/* 操作按钮 - 非编辑状态可见 */}
      {!isEditing && (
        <div className="flex items-center gap-0.5 shrink-0">
          {!isMissing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={(e) => { e.stopPropagation(); onStartEdit(); }} 
                  className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                >
                  <Edit2 size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>重命名</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>删除</TooltipContent>
          </Tooltip>
        </div>
      )}
      </div>
      
      {/* 进度条 - 仅当前播放歌曲显示 */}
      {isCurrent && onSeek && (
        <div className="px-2 pb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-400 w-7 text-right">
              {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
            </span>
            <div 
              className="flex-1 h-4 flex items-center cursor-pointer group"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSeek(e);
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  if (!onSeek) return;
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  const x = moveEvent.clientX - rect.left;
                  const percentage = Math.max(0, Math.min(1, x / rect.width));
                  onSeek(percentage * duration);
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener("mousemove", handleMouseMove);
                  document.removeEventListener("mouseup", handleMouseUp);
                };
                
                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
              }}
            >
              <div className="relative w-full h-1 bg-gray-300 rounded-full overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full bg-purple-500 rounded-full" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>
            <span className="text-[9px] text-gray-400 w-7">
              {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, "0")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// 循环模式按钮
function RepeatModeButton({ mode, onChange }: { mode: "none" | "all" | "one"; onChange: (m: "none" | "all" | "one") => void }) {
  const modes: { key: "none" | "all" | "one"; icon: typeof Repeat; label: string }[] = [
    { key: "none", icon: Repeat, label: "顺序" },
    { key: "all", icon: Repeat, label: "循环" },
    { key: "one", icon: Repeat1, label: "单曲" },
  ];
  
  const current = modes.find((m) => m.key === mode)!;
  const nextMode = modes[(modes.findIndex((m) => m.key === mode) + 1) % modes.length].key;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button 
          onClick={() => onChange(nextMode)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === "none" 
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200" 
              : "bg-purple-100 text-purple-600 hover:bg-purple-200"
          }`}
        >
          <current.icon size={14} />
          <span>{current.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>{`${current.label}播放 (点击切换)`}</TooltipContent>
    </Tooltip>
  );
}

// 重新上传对话框
function ReuploadDialog({ 
  track, 
  isOpen, 
  onClose, 
  onReupload 
}: { 
  track: MusicTrack | null; 
  isOpen: boolean; 
  onClose: () => void;
  onReupload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  if (!isOpen || !track) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      onReupload(file);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle size={24} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">重新上传音乐</h3>
            <p className="text-xs text-gray-500 line-clamp-1">{track.name}</p>
          </div>
        </div>
        
        <div className="bg-amber-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>为什么文件会丢失？</strong><br/>
            浏览器存储空间有限，或您可能清除了浏览数据。
            请重新选择原文件（或其他音频文件）进行恢复。
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2.5 px-4 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Upload size={18} />
            选择文件
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// 空状态组件
function EmptyMusicState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-3">
        <Music size={28} className="text-purple-300" />
      </div>
      <h4 className="text-sm font-medium text-gray-700 mb-1">还没有音乐</h4>
      <p className="text-xs text-gray-400 mb-4 max-w-[200px]">
        添加您喜欢的音乐，在专注时聆听
      </p>
      <button
        onClick={onUpload}
        className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors flex items-center gap-1.5"
      >
        <Upload size={14} />
        添加音乐
      </button>
    </div>
  );
}

export default function SoundPanel() {
  const { state, dispatch } = useGame();
  const { 
    togglePlay, 
    playNext, 
    playPrevious,
    seekTo,
    currentTrack, 
    isPlaying, 
    volume, 
    setVolume,
    repeatMode,
    setRepeatMode,
    currentTime,
    duration
  } = useMusicPlayer();
  const [mode, setMode] = useState<Mode>("scenes");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reuploadFileInputRef = useRef<HTMLInputElement>(null);
  const previousMixRef = useRef<Record<string, number>>({});
  const previousSceneRef = useRef<string | null>(null);
  const [reuploadTrack, setReuploadTrack] = useState<MusicTrack | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  
  // 恢复上次状态
  const [showRestoreButton, setShowRestoreButton] = useState(false);
  const lastAudioStateRef = useRef<{
    activeScene: string | null;
    customMix: Record<string, number>;
    masterVolume: number;
    currentMusicId: string | null;
    musicVolume: number;
    musicRepeatMode: "none" | "all" | "one";
    isMusicPlaying: boolean; // 记录上次是否正在播放，用于决定恢复时是否自动播放
  } | null>(null);
  const userModifiedRef = useRef(false);

  useAudioEngine(state.customMix, state.masterVolume);

  // 检查是否需要显示"恢复上次"按钮
  useEffect(() => {
    if (state.isMusicLoading) return;
    
    try {
      const lastAudio = localStorage.getItem("focus-companion-last-audio");
      if (lastAudio) {
        const parsed = JSON.parse(lastAudio);
        
        // 检查上次是否有音频活动，且恢复后**会播放**（不只是选中）
        const wasPlayingScene = parsed.activeScene !== null;
        const customMix = parsed.customMix as Record<string, number> || {};
        const wasPlayingMix = Object.values(customMix).some((v) => v > 0);
        
        // 检查音乐：必须正在播放，且音乐文件还存在
        const savedMusicId = parsed.currentMusicId;
        const savedTrack = savedMusicId 
          ? state.musicTracks.find((t) => t.id === savedMusicId)
          : null;
        const isMusicValid = savedTrack?.status === "valid";
        const wasPlayingMusic = parsed.isMusicPlaying === true && isMusicValid;
        
        // 只有恢复后会播放东西，才显示按钮
        if (wasPlayingScene || wasPlayingMix || wasPlayingMusic) {
          lastAudioStateRef.current = {
            activeScene: parsed.activeScene || null,
            customMix: parsed.customMix || {},
            masterVolume: parsed.masterVolume ?? 1,
            currentMusicId: isMusicValid ? savedMusicId : null, // 只保存有效的音乐ID
            musicVolume: parsed.musicVolume ?? 1,
            musicRepeatMode: parsed.musicRepeatMode || "none",
            isMusicPlaying: wasPlayingMusic, // 音乐无效时视为未播放
          };
          
          // 当前为空时显示按钮
          const isCurrentlyEmpty = !state.activeScene && 
            !Object.values(state.customMix).some((v) => v > 0);
          
          if (isCurrentlyEmpty && !userModifiedRef.current) {
            setShowRestoreButton(true);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to check last audio state:", e);
    }
  }, [state.isMusicLoading, state.activeScene, state.customMix]);

  // 关键修复：正确判断活跃音效状态
  const isSceneMode = !!state.activeScene;
  const isMixerMode = !isSceneMode && Object.values(state.customMix).some((v) => v > 0);
  const hasActiveSound = isSceneMode || isMixerMode;
  const activeSoundCount = Object.entries(state.customMix).filter(([_, v]) => v > 0).length;

  // 拖拽处理
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;

    const newTracks = [...state.musicTracks];
    const [removed] = newTracks.splice(dragIndex, 1);
    newTracks.splice(dropIndex, 0, removed);
    
    dispatch({ type: "REORDER_MUSIC_TRACKS", payload: newTracks });
    setDragIndex(null);
  };

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    await Promise.all(
      Array.from(files).map(async (file) => {
        if (!file.type.startsWith("audio/")) return;
        
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const name = file.name.replace(/\.[^/.]+$/, "");
        
        try {
          await saveMusicFile(id, name, file);
          dispatch({ 
            type: "ADD_MUSIC_TRACK", 
            payload: { file, id, name } 
          });
        } catch (err) {
          console.error("Failed to save music file:", err);
          alert(`保存音乐"${name}"失败，可能是存储空间不足`);
        }
      })
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 处理重新上传
  const handleReupload = async (track: MusicTrack, file: File) => {
    dispatch({ type: "REUPLOAD_MUSIC_TRACK", payload: { id: track.id, file } });
    
    try {
      await saveMusicFile(track.id, track.name, file);
      const newUrl = await getMusicFileUrl(track.id);
      if (newUrl) {
        dispatch({
          type: "UPDATE_MUSIC_TRACK_STATUS",
          payload: { id: track.id, status: "valid", url: newUrl },
        });
      }
    } catch (err) {
      console.error("Failed to reupload:", err);
      dispatch({
        type: "UPDATE_MUSIC_TRACK_STATUS",
        payload: { id: track.id, status: "missing" },
      });
      alert("重新上传失败，请重试");
    }
  };

  const handleDeleteTrack = async (id: string) => {
    try {
      await deleteMusicFile(id);
    } catch (err) {
      console.warn("Failed to delete from IndexedDB:", err);
    }
    dispatch({ type: "DELETE_MUSIC_TRACK", payload: id });
  };

  // 新增：用于保存音乐播放状态
  const previousMusicPlayingRef = useRef(false);
  const previousMusicIdRef = useRef<string | null>(null);

  const handleMuteToggle = () => {
    const hasAnySound = state.isMusicPlaying || !!state.activeScene || activeSoundCount > 0;
    
    if (hasAnySound) {
      // 静音所有：保存当前状态（包括混音）
      previousMixRef.current = { ...state.customMix };
      previousSceneRef.current = state.activeScene;
      // 验证音乐是否还存在，不存在则视为没有音乐
      const currentTrack = state.currentMusicId 
        ? state.musicTracks.find((t) => t.id === state.currentMusicId)
        : null;
      const isMusicValid = currentTrack?.status === "valid";
      previousMusicPlayingRef.current = isMusicValid && state.isMusicPlaying;
      previousMusicIdRef.current = isMusicValid ? state.currentMusicId : null;
      // 暂停音乐
      if (state.isMusicPlaying) {
        dispatch({ type: "PAUSE_MUSIC" });
      }
      // 停止场景音效（但不要清空混音，只是停止场景）
      if (state.activeScene) {
        dispatch({ type: "SET_SCENE", payload: null });
      }
      // 清空混音（通过 SET_CUSTOM_MIX，这样 previousMixRef 已经保存了）
      if (Object.keys(state.customMix).length > 0) {
        dispatch({ type: "SET_CUSTOM_MIX", payload: {} });
      }
    } else {
      // 恢复所有：场景和混音都要恢复（先场景后混音，这样自定义混音会覆盖场景默认）
      if (previousSceneRef.current) {
        dispatch({ type: "SET_SCENE", payload: previousSceneRef.current });
      }
      // 总是恢复混音（如果保存过的话），覆盖场景的默认混音
      if (Object.keys(previousMixRef.current).length > 0) {
        dispatch({ type: "SET_CUSTOM_MIX", payload: previousMixRef.current });
      }
      // 恢复音乐（如果有）
      if (previousMusicIdRef.current && previousMusicPlayingRef.current) {
        dispatch({ type: "PLAY_MUSIC", payload: previousMusicIdRef.current });
      }
    }
  };

  const handleSceneSelect = (sceneId: string) => {
    markUserModified();
    if (state.activeScene === sceneId) {
      dispatch({ type: "SET_SCENE", payload: null });
    } else {
      dispatch({ type: "SET_SCENE", payload: sceneId });
    }
  };

  const handleMixerToggle = (soundId: string) => {
    markUserModified();
    const newMix = { ...state.customMix };
    const currentVolume = newMix[soundId] || 0;
    if (currentVolume > 0) {
      newMix[soundId] = 0;
    } else {
      newMix[soundId] = 0.5;
    }
    dispatch({ type: "SET_CUSTOM_MIX", payload: newMix });
    // 注：不主动清除场景状态，让用户在场景基础上开关音效
  };

  const handleMixerVolume = (soundId: string, volume: number) => {
    markUserModified();
    const newMix = { ...state.customMix };
    if (volume <= 0.01) {
      newMix[soundId] = 0;
    } else {
      newMix[soundId] = volume;
    }
    dispatch({ type: "SET_CUSTOM_MIX", payload: newMix });
    // 注：不主动清除场景状态，让用户在场景基础上调整混音
    // 顶部显示逻辑会根据 activeScene 和 customMix 自动判断显示方式
  };

  // 播放/暂停音乐（像场景一样，点击切换）
  const handlePlayMusic = (trackId: string) => {
    markUserModified();
    const track = state.musicTracks.find((t) => t.id === trackId);
    if (track?.status === "missing") {
      setReuploadTrack(track);
      return;
    }
    if (state.currentMusicId === trackId && state.isMusicPlaying) {
      dispatch({ type: "PAUSE_MUSIC" });
    } else {
      dispatch({ type: "PLAY_MUSIC", payload: trackId });
    }
  };

  const handleRenameTrack = (trackId: string, newName: string) => {
    dispatch({ type: "UPDATE_MUSIC_TRACK", payload: { id: trackId, name: newName } });
  };

  // 判断当前混音是否与场景的默认设置一致
  const isSceneDefaultMix = () => {
    if (!state.activeScene) return false;
    const scene = SOUND_SCENES.find((s) => s.id === state.activeScene);
    if (!scene) return false;
    // 场景要求的音效
    const sceneSoundIds = new Set(scene.sounds.map((s) => s.id));
    // 当前活跃的音效
    const currentSoundIds = Object.entries(state.customMix)
      .filter(([, v]) => v > 0)
      .map(([id]) => id);
    // 如果活跃音效与场景要求的不一致，说明是自定义混音
    if (currentSoundIds.length !== scene.sounds.length) return false;
    return currentSoundIds.every((id) => sceneSoundIds.has(id));
  };

  // 顶部状态标签 - 现在可以同时显示多种状态
  const getModeLabel = () => {
    const labels: string[] = [];
    
    // 音乐状态（只有正在播放时才显示）
    if (state.currentMusicId && state.isMusicPlaying) {
      const track = state.musicTracks.find((t) => t.id === state.currentMusicId);
      labels.push(track ? `🎵 ${track.name}` : "🎵 音乐");
    }
    
    // 场景/混音状态（只显示正在播放的）
    if (state.activeScene) {
      const scene = SOUND_SCENES.find((s) => s.id === state.activeScene);
      if (scene) {
        if (isSceneDefaultMix()) {
          labels.push(`🎧 ${scene.name}`);
        } else if (activeSoundCount > 0) {
          labels.push(`🎚️ ${scene.name} (${activeSoundCount})`);
        }
      }
    } else if (activeSoundCount > 0) {
      // 纯自定义混音，没有场景
      labels.push(`🎚️ 混音 (${activeSoundCount})`);
    }
    
    return labels.length > 0 ? labels.join(" + ") : null;
  };
  
  // 判断是否所有声音都被静音
  const isAllMuted = !state.isMusicPlaying && !state.activeScene && activeSoundCount === 0;

  // 恢复上次音效状态（并自动播放）
  const handleRestoreLast = () => {
    const lastState = lastAudioStateRef.current;
    if (!lastState) return;
    
    // 恢复音量设置
    dispatch({ type: "SET_MASTER_VOLUME", payload: lastState.masterVolume });
    dispatch({ type: "SET_MUSIC_VOLUME", payload: lastState.musicVolume });
    dispatch({ type: "SET_MUSIC_REPEAT_MODE", payload: lastState.musicRepeatMode });
    
    // 恢复场景或混音
    if (lastState.activeScene) {
      dispatch({ type: "SET_SCENE", payload: lastState.activeScene });
    }
    if (Object.values(lastState.customMix).some((v) => v > 0)) {
      dispatch({ type: "SET_CUSTOM_MIX", payload: lastState.customMix });
    }
    
    // 恢复音乐：如果上次正在播放则播放，否则只选中
    // 再次验证音乐是否还存在（防止加载后到恢复前这段时间被删除）
    if (lastState.currentMusicId) {
      const track = state.musicTracks.find((t) => t.id === lastState.currentMusicId);
      if (track?.status === "valid") {
        if (lastState.isMusicPlaying) {
          dispatch({ type: "PLAY_MUSIC", payload: lastState.currentMusicId });
        } else {
          dispatch({ type: "SET_CURRENT_MUSIC", payload: lastState.currentMusicId });
        }
      }
    }
    
    userModifiedRef.current = true;
    setShowRestoreButton(false);
  };

  // 标记用户修改
  const markUserModified = () => {
    userModifiedRef.current = true;
    setShowRestoreButton(false);
  };

  // 用户停止所有音频时，清空保存的状态（这样刷新后不会显示"恢复上次"）
  const clearLastAudioState = () => {
    lastAudioStateRef.current = null;
    try {
      localStorage.removeItem("focus-companion-last-audio");
    } catch (e) {
      // ignore
    }
  };

  // 监听：用户主动停止所有音频后，清空保存的状态
  useEffect(() => {
    // 如果用户已修改过，且当前没有任何音频活动，清空保存的状态
    if (userModifiedRef.current) {
      const hasAudioActivity = state.activeScene !== null || 
        Object.values(state.customMix).some((v) => v > 0) ||
        state.isMusicPlaying;
      
      if (!hasAudioActivity) {
        clearLastAudioState();
      }
    }
  }, [state.activeScene, state.customMix, state.isMusicPlaying]);

  const missingTracksCount = state.musicTracks.filter((t) => t.status === "missing").length;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-lg h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
            <Music size={14} className="text-white" />
          </div>
          <div className="min-w-0 max-w-[160px]">
            <h3 className="text-sm font-semibold text-gray-800">环境音效</h3>
            {getModeLabel() && <p className="text-[10px] text-purple-600 break-all line-clamp-2">{getModeLabel()}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* 恢复上次按钮 */}
          {showRestoreButton && lastAudioStateRef.current && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRestoreLast}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors animate-in fade-in slide-in-from-right-2 duration-200"
                >
                  <RefreshCw size={12} />
                  恢复上次
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>恢复上次的场景、混音和音乐设置</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleMuteToggle} 
                className={`p-1.5 rounded-lg transition-colors ${!isAllMuted ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"}`}
              >
                {!isAllMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>静音</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 模式切换 */}
      <div className="flex gap-1 mb-2 bg-gray-100 rounded-lg p-0.5 shrink-0">
        <button 
          onClick={() => setMode("scenes")} 
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all ${mode === "scenes" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Sparkles size={11} /> 场景
        </button>
        <button 
          onClick={() => setMode("mixer")} 
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all ${mode === "mixer" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Sliders size={11} /> 混音
        </button>
        <div className="w-px bg-gray-300 mx-0.5" />
        <button 
          onClick={() => setMode("music")} 
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all ${mode === "music" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <ListMusic size={11} /> 音乐
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto pr-0.5 min-h-0">
        {mode === "scenes" ? (
          <div className="space-y-1.5 py-0.5 px-0.5">
            {SOUND_SCENES.map((scene) => (
              <button
                key={scene.id}
                onClick={() => handleSceneSelect(scene.id)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left ${state.activeScene === scene.id ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300 m-0.5" : "bg-gray-50 hover:bg-gray-100 text-gray-700"}`}
              >
                <span className="text-lg">{SCENE_ICONS[scene.id]}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{scene.name}</div>
                  <div className="text-[10px] opacity-70 leading-tight line-clamp-2">{scene.description}</div>
                </div>
                {state.activeScene === scene.id && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[0, 1, 2].map((i) => <div key={i} className="w-0.5 h-3 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : mode === "mixer" ? (
          <div className="space-y-0.5">
            {INDIVIDUAL_SOUNDS.map((sound) => {
              const volume = state.customMix[sound.id] || 0;
              const isActive = volume > 0;
              return (
                <div key={sound.id} className="flex items-center gap-1.5 py-0.5 px-1 rounded-lg hover:bg-gray-50">
                  <button onClick={() => handleMixerToggle(sound.id)} className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all ${isActive ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"}`}>
                    <span className="text-xs">{SOUND_ICONS[sound.id]}</span>
                  </button>
                  <span className={`text-xs w-12 whitespace-nowrap ${isActive ? "font-medium text-gray-800" : "text-gray-500"}`}>{sound.name}</span>
                  <CustomSlider value={volume} onChange={(v) => handleMixerVolume(sound.id, v)} />
                  <span className="text-[10px] text-gray-400 w-7 text-right">{Math.round(volume * 100)}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 overflow-x-hidden">
            {/* 上传按钮 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-all"
            >
              <Upload size={18} />
              <span className="text-xs font-medium">添加本地音乐</span>
            </button>

            {/* 失效文件提示 */}
            {missingTracksCount > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-xl text-xs text-red-600">
                <AlertCircle size={16} className="shrink-0" />
                <span>{missingTracksCount} 首音乐需要重新上传</span>
              </div>
            )}

            {/* 播放控制 */}
            {state.musicTracks.length > 0 && (
              <div className="flex items-center justify-between px-1 py-1">
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={playPrevious}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-purple-600 transition-colors"
                      >
                        <ChevronLeft size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>上一首</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={playNext}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-purple-600 transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>下一首</TooltipContent>
                  </Tooltip>
                </div>
                <RepeatModeButton mode={repeatMode} onChange={setRepeatMode} />
              </div>
            )}

            {/* 音乐列表 */}
            <div className="space-y-2 pb-2">
              {state.isMusicLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400 text-xs">
                  加载音乐中...
                </div>
              ) : state.musicTracks.length === 0 ? (
                <EmptyMusicState onUpload={() => fileInputRef.current?.click()} />
              ) : (
                state.musicTracks.map((track, index) => {
                  const isCurrent = state.currentMusicId === track.id;
                  const savedProgress = state.musicProgress[track.id] || 0;
                  // 当前播放歌曲使用实时进度，其他歌曲使用保存的进度
                  const displayTime = isCurrent ? currentTime : savedProgress;
                  // 对于非当前歌曲，尝试从track获取duration（如果之前加载过）
                  const displayDuration = isCurrent ? duration : (track.duration || 0);
                  
                  return (
                    <MusicTrackItem
                      key={track.id}
                      track={track}
                      index={index}
                      isPlaying={state.isMusicPlaying}
                      isCurrent={isCurrent}
                      isEditing={editingTrackId === track.id}
                      currentTime={displayTime}
                      duration={displayDuration}
                      onPlay={() => handlePlayMusic(track.id)}
                      onDelete={() => void handleDeleteTrack(track.id)}
                      onRename={(name) => handleRenameTrack(track.id, name)}
                      onReupload={() => setReuploadTrack(track)}
                      onStartEdit={() => setEditingTrackId(track.id)}
                      onStopEdit={() => setEditingTrackId(null)}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onSeek={isCurrent ? seekTo : undefined}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 底部控制 */}
      <div className="shrink-0 pt-2 mt-2 border-t border-gray-200">
        {/* 音量控制 */}
        {mode === "music" ? (
          <div className="flex items-center gap-2">
            <VolumeX size={12} className="text-gray-400 shrink-0" />
            <div className="flex-1 h-4 flex items-center">
              <CustomSlider value={volume} onChange={setVolume} />
            </div>
            <Volume2 size={12} className="text-gray-400 shrink-0" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <VolumeX size={12} className="text-gray-400 shrink-0" />
            <div className="flex-1 h-4 flex items-center">
              <CustomSlider value={state.masterVolume} onChange={(v) => dispatch({ type: "SET_MASTER_VOLUME", payload: v })} />
            </div>
            <Volume2 size={12} className="text-gray-400 shrink-0" />
          </div>
        )}
      </div>

      {/* 重新上传对话框 */}
      <ReuploadDialog
        track={reuploadTrack}
        isOpen={!!reuploadTrack}
        onClose={() => setReuploadTrack(null)}
        onReupload={(file) => reuploadTrack && handleReupload(reuploadTrack, file)}
      />
    </div>
  );
}
