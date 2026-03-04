import { useEffect, useRef, useCallback } from "react";
import { useGame } from "@/contexts/GameContext";

export function usePomodoro() {
  const { state, dispatch } = useGame();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (state.isTimerRunning) {
      clearTimer();
      intervalRef.current = setInterval(() => {
        dispatch({ type: "TICK" });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [state.isTimerRunning, clearTimer, dispatch]);

  // Check if timer completed - 使用 ref 防止重复触发
  const hasCompletedRef = useRef(false);
  
  useEffect(() => {
    if (state.isTimerRunning && state.timeRemaining <= 0 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      dispatch({ type: "COMPLETE_SESSION" });
      // Play completion sound
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 800;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1);
        // Second tone
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.frequency.value = 1200;
          osc2.type = "sine";
          gain2.gain.setValueAtTime(0.3, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
          osc2.connect(gain2).connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 1);
        }, 200);
      } catch {}
    }
    
    // Reset the flag when timer is running and timeRemaining > 0
    if (state.timeRemaining > 0) {
      hasCompletedRef.current = false;
    }
  }, [state.isTimerRunning, state.timeRemaining, dispatch]);

  const start = useCallback(() => dispatch({ type: "START_TIMER" }), [dispatch]);
  const pause = useCallback(() => dispatch({ type: "PAUSE_TIMER" }), [dispatch]);
  const reset = useCallback(() => dispatch({ type: "RESET_TIMER" }), [dispatch]);
  const fastForward = useCallback(() => {
    if (state.timerMode !== "focus") return;
    const total = state.pomodoroMinutes * 60;
    const completed = Math.max(0, total - state.timeRemaining);
    dispatch({ type: "COMPLETE_SESSION", payload: { completedFocusSeconds: completed } });
  }, [dispatch, state.timerMode, state.pomodoroMinutes, state.timeRemaining]);

  const endRound = useCallback(() => {
    const total = state.pomodoroMinutes * 60;
    const completed = state.timerMode === "focus"
      ? Math.max(0, total - state.timeRemaining)
      : 0;
    dispatch({ type: "COMPLETE_SESSION", payload: { completedFocusSeconds: completed, endRound: true } });
  }, [dispatch, state.timerMode, state.pomodoroMinutes, state.timeRemaining]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  const progress = state.timerMode === "focus"
    ? 1 - state.timeRemaining / (state.pomodoroMinutes * 60)
    : 1 - state.timeRemaining / (state.breakMinutes * 60);

  return {
    timeRemaining: state.timeRemaining,
    isRunning: state.isTimerRunning,
    mode: state.timerMode,
    progress,
    formattedTime: formatTime(state.timeRemaining),
    start,
    pause,
    reset,
    fastForward,
    endRound,
  };
}
