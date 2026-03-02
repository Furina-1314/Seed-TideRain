import { useEffect, useRef, useCallback } from "react";
import { useGame } from "@/contexts/GameContext";

export function useMusicPlayer() {
  const { state, dispatch } = useGame();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  // 初始化音频元素
  useEffect(() => {
    audioRef.current = new Audio();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  // 音量更新
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.musicVolume;
    }
  }, [state.musicVolume]);

  // 监听音频事件：timeupdate, ended, loadedmetadata
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      // 只更新当前时间，不触发播放逻辑
      dispatch({
        type: "SET_MUSIC_PROGRESS",
        payload: {
          currentTime: audio.currentTime,
          duration: audio.duration || state.musicDuration,
        },
      });
    };

    const handleEnded = () => {
      const { musicTracks, currentMusicId, musicRepeatMode } = state;
      
      if (!currentMusicId || musicTracks.length === 0) {
        dispatch({ type: "PAUSE_MUSIC" });
        return;
      }

      const currentIndex = musicTracks.findIndex((t) => t.id === currentMusicId);
      
      if (musicRepeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => dispatch({ type: "PAUSE_MUSIC" }));
      } else if (musicRepeatMode === "all") {
        const nextIndex = (currentIndex + 1) % musicTracks.length;
        dispatch({ type: "PLAY_MUSIC", payload: musicTracks[nextIndex].id });
      } else {
        const nextIndex = currentIndex + 1;
        if (nextIndex < musicTracks.length) {
          dispatch({ type: "PLAY_MUSIC", payload: musicTracks[nextIndex].id });
        } else {
          dispatch({ type: "PAUSE_MUSIC" });
        }
      }
    };

    const handleLoadedMetadata = () => {
      dispatch({
        type: "SET_MUSIC_PROGRESS",
        payload: {
          currentTime: audio.currentTime,
          duration: audio.duration,
        },
      });
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [state.musicTracks, state.currentMusicId, state.musicRepeatMode, state.musicDuration, dispatch]);

  // 核心播放逻辑：处理歌曲切换和播放/暂停
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    const currentTrack = state.musicTracks.find((t) => t.id === state.currentMusicId);

    // 没有选中歌曲，暂停
    if (!currentTrack) {
      audio.pause();
      lastTrackIdRef.current = null;
      return;
    }

    // 歌曲文件缺失
    if (currentTrack.status === "missing") {
      audio.pause();
      dispatch({ type: "PAUSE_MUSIC" });
      return;
    }

    const isNewTrack = lastTrackIdRef.current !== currentTrack.id;
    lastTrackIdRef.current = currentTrack.id;

    // 如果是新歌曲，设置 src 并恢复进度
    if (isNewTrack) {
      audio.src = currentTrack.url;
      audio.load();
      
      // 从保存的进度恢复
      const savedProgress = state.musicProgress[currentTrack.id] || 0;
      audio.currentTime = savedProgress;
    }

    // 播放或暂停
    if (state.isMusicPlaying) {
      audio.play().catch((err) => {
        console.error("Failed to play:", err);
        dispatch({ type: "PAUSE_MUSIC" });
      });
    } else {
      audio.pause();
    }
  }, [state.isMusicPlaying, state.currentMusicId, state.musicTracks, state.musicProgress, dispatch]);

  const playTrack = useCallback((trackId: string | null) => {
    dispatch({ type: "PLAY_MUSIC", payload: trackId });
  }, [dispatch]);

  const pauseTrack = useCallback(() => {
    dispatch({ type: "PAUSE_MUSIC" });
  }, [dispatch]);

  const togglePlay = useCallback((trackId: string) => {
    if (state.currentMusicId === trackId && state.isMusicPlaying) {
      pauseTrack();
    } else {
      playTrack(trackId);
    }
  }, [state.currentMusicId, state.isMusicPlaying, playTrack, pauseTrack]);

  const playNext = useCallback(() => {
    const { musicTracks, currentMusicId } = state;
    if (!currentMusicId || musicTracks.length === 0) return;
    
    const currentIndex = musicTracks.findIndex((t) => t.id === currentMusicId);
    const nextIndex = (currentIndex + 1) % musicTracks.length;
    dispatch({ type: "PLAY_MUSIC", payload: musicTracks[nextIndex].id });
  }, [state.musicTracks, state.currentMusicId, dispatch]);

  const playPrevious = useCallback(() => {
    const { musicTracks, currentMusicId } = state;
    if (!currentMusicId || musicTracks.length === 0) return;
    
    const currentIndex = musicTracks.findIndex((t) => t.id === currentMusicId);
    const prevIndex = currentIndex === 0 ? musicTracks.length - 1 : currentIndex - 1;
    dispatch({ type: "PLAY_MUSIC", payload: musicTracks[prevIndex].id });
  }, [state.musicTracks, state.currentMusicId, dispatch]);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      // 同时更新 state 中的 currentTime
      dispatch({ type: "SEEK_MUSIC", payload: time });
    }
  }, [dispatch]);

  return {
    playTrack,
    pauseTrack,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    currentTrack: state.musicTracks.find((t) => t.id === state.currentMusicId),
    isPlaying: state.isMusicPlaying,
    volume: state.musicVolume,
    setVolume: (v: number) => dispatch({ type: "SET_MUSIC_VOLUME", payload: v }),
    repeatMode: state.musicRepeatMode,
    setRepeatMode: (mode: "none" | "all" | "one") => dispatch({ type: "SET_MUSIC_REPEAT_MODE", payload: mode }),
    currentTime: state.musicCurrentTime,
    duration: state.musicDuration,
  };
}
