// 全局音频上下文
let globalAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  
  if (!globalAudioContext) {
    globalAudioContext = new AudioContextClass();
  }
  return globalAudioContext;
}

// 播放5秒完成提示音
export function playCompleteSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const play = () => {
    const now = ctx.currentTime;
    const notes = [
      { f: 523.25, t: 0, d: 0.5 },    // C5
      { f: 659.25, t: 0.4, d: 0.5 },  // E5
      { f: 783.99, t: 0.8, d: 0.5 },  // G5
      { f: 1046.50, t: 1.2, d: 0.8 }, // C6
      { f: 783.99, t: 2.0, d: 0.4 },  // G5
      { f: 1046.50, t: 2.4, d: 2.0 }, // C6
    ];
    
    // 主旋律
    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = note.f;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, now + note.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.t);
      osc.stop(now + note.t + note.d);
    });
    
    // 和弦背景音
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "triangle";
      gain.gain.setValueAtTime(0.1, now + 3.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 3.5);
      osc.stop(now + 5);
    });
  };
  
  if (ctx.state === "suspended") {
    ctx.resume().then(play);
  } else {
    play();
  }
}
