import { useEffect, useRef, useCallback } from "react";

// Generate noise buffer using Web Audio API
function createNoiseBuffer(
  ctx: AudioContext,
  type: "white" | "brown" | "pink",
  duration = 4
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let lastOut = 0;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;

      if (type === "white") {
        data[i] = white * 0.3;
      } else if (type === "brown") {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5 * 0.3;
      } else if (type === "pink") {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
    }
  }
  return buffer;
}

// Create a single environmental sound layer
function createSoundLayer(
  ctx: AudioContext,
  gainNode: GainNode,
  type: string
): (() => void) | null {
  const cleanups: (() => void)[] = [];

  if (type === "white" || type === "brown" || type === "pink") {
    const buffer = createNoiseBuffer(ctx, type);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);
    source.start();
    cleanups.push(() => { try { source.stop(); } catch {} });
  } else if (type === "rain") {
    const buffer = createNoiseBuffer(ctx, "brown");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 800;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 8000;
    source.connect(highpass).connect(lowpass).connect(gainNode);
    source.start();
    cleanups.push(() => { try { source.stop(); } catch {} });

    const dripInterval = setInterval(() => {
      if (ctx.state !== "running") return;
      const osc = ctx.createOscillator();
      const dripGain = ctx.createGain();
      osc.frequency.value = 2000 + Math.random() * 3000;
      osc.type = "sine";
      dripGain.gain.setValueAtTime(0.02, ctx.currentTime);
      dripGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(dripGain).connect(gainNode);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }, 200 + Math.random() * 300);
    cleanups.push(() => clearInterval(dripInterval));
  } else if (type === "thunder") {
    const buffer = createNoiseBuffer(ctx, "brown");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 600;
    source.connect(highpass).connect(gainNode);
    source.start();
    cleanups.push(() => { try { source.stop(); } catch {} });

    const thunderInterval = setInterval(() => {
      if (ctx.state !== "running") return;
      const thunderBuffer = createNoiseBuffer(ctx, "brown", 2);
      const thunderSource = ctx.createBufferSource();
      thunderSource.buffer = thunderBuffer;
      const thunderGain = ctx.createGain();
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 200;
      const rumbleDelay = 0.05 + Math.random() * 0.2;
      const attack = 0.12 + Math.random() * 0.2;
      const release = 2.2 + Math.random() * 1.8;
      thunderGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      thunderGain.gain.exponentialRampToValueAtTime(0.38 + Math.random() * 0.2, ctx.currentTime + rumbleDelay + attack);
      thunderGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + rumbleDelay + release);
      thunderSource.connect(lowpass).connect(thunderGain).connect(gainNode);
      thunderSource.start();
      thunderSource.stop(ctx.currentTime + rumbleDelay + release + 0.1);

      // 高频闪电“裂响”层，提升真实感
      const crack = ctx.createOscillator();
      const crackGain = ctx.createGain();
      const crackFilter = ctx.createBiquadFilter();
      crackFilter.type = "highpass";
      crackFilter.frequency.value = 1800;
      crack.type = "triangle";
      const crackFreq = 900 + Math.random() * 900;
      crack.frequency.setValueAtTime(crackFreq, ctx.currentTime);
      crack.frequency.exponentialRampToValueAtTime(crackFreq * (1.6 + Math.random() * 0.7), ctx.currentTime + 0.06);
      crackGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      crackGain.gain.exponentialRampToValueAtTime(0.15 + Math.random() * 0.1, ctx.currentTime + 0.02);
      crackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      crack.connect(crackFilter).connect(crackGain).connect(gainNode);
      crack.start();
      crack.stop(ctx.currentTime + 0.16);
    }, 8000 + Math.random() * 15000);
    cleanups.push(() => clearInterval(thunderInterval));
  } else if (type === "ocean") {
    const buffer = createNoiseBuffer(ctx, "pink");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1200;
    const waveGain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.1;
    lfo.type = "sine";
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain).connect(waveGain.gain);
    waveGain.gain.value = 0.5;
    source.connect(lowpass).connect(waveGain).connect(gainNode);
    lfo.start();
    source.start();
    cleanups.push(() => { try { source.stop(); lfo.stop(); } catch {} });
  } else if (type === "wind") {
    const buffer = createNoiseBuffer(ctx, "pink");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 400;
    bandpass.Q.value = 0.5;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain).connect(bandpass.frequency);
    source.connect(bandpass).connect(gainNode);
    lfo.start();
    source.start();
    cleanups.push(() => { try { source.stop(); lfo.stop(); } catch {} });
  } else if (type === "birds") {
    const chirpInterval = setInterval(() => {
      if (ctx.state !== "running") return;
      const chirpCount = 1 + Math.floor(Math.random() * 3);
      const baseFreq = 1800 + Math.random() * 2200;

      for (let i = 0; i < chirpCount; i++) {
        const startAt = ctx.currentTime + i * (0.045 + Math.random() * 0.04);
        const osc = ctx.createOscillator();
        const birdGain = ctx.createGain();
        const pan = ctx.createStereoPanner();
        osc.type = Math.random() > 0.5 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(baseFreq * (0.92 + Math.random() * 0.25), startAt);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.15 + Math.random() * 0.35), startAt + 0.03);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * (0.86 + Math.random() * 0.2), startAt + 0.09);
        birdGain.gain.setValueAtTime(0.0001, startAt);
        birdGain.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.03, startAt + 0.02);
        birdGain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.11);
        pan.pan.value = Math.random() * 1.4 - 0.7;
        osc.connect(birdGain).connect(pan).connect(gainNode);
        osc.start(startAt);
        osc.stop(startAt + 0.13);
      }
    }, 700 + Math.random() * 2600);
    cleanups.push(() => clearInterval(chirpInterval));

    const buffer = createNoiseBuffer(ctx, "pink");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const bgGain = ctx.createGain();
    bgGain.gain.value = 0.1;
    source.connect(bgGain).connect(gainNode);
    source.start();
    cleanups.push(() => { try { source.stop(); } catch {} });
  } else if (type === "fire") {
    const buffer = createNoiseBuffer(ctx, "brown");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 600;
    bandpass.Q.value = 1;

    const crackleInterval = setInterval(() => {
      if (ctx.state !== "running") return;
      const clickBuffer = createNoiseBuffer(ctx, "white", 0.08);
      const clickSource = ctx.createBufferSource();
      clickSource.buffer = clickBuffer;
      const crackleGain = ctx.createGain();
      const crackleBand = ctx.createBiquadFilter();
      crackleBand.type = "bandpass";
      crackleBand.frequency.value = 1800 + Math.random() * 2200;
      crackleBand.Q.value = 1.4;
      crackleGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      crackleGain.gain.exponentialRampToValueAtTime(0.02 + Math.random() * 0.03, ctx.currentTime + 0.008);
      crackleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      clickSource.connect(crackleBand).connect(crackleGain).connect(gainNode);
      clickSource.start();
      clickSource.stop(ctx.currentTime + 0.08);
    }, 70 + Math.random() * 140);

    source.connect(bandpass).connect(gainNode);
    source.start();
    cleanups.push(() => { try { source.stop(); } catch {} });
    cleanups.push(() => clearInterval(crackleInterval));
  } else if (type === "cafe") {
    const buffer = createNoiseBuffer(ctx, "pink");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 2000;
    const murmurGain = ctx.createGain();
    murmurGain.gain.value = 0.4;
    source.connect(lowpass).connect(murmurGain).connect(gainNode);
    source.start();
    cleanups.push(() => { try { source.stop(); } catch {} });

    const clinkInterval = setInterval(() => {
      if (ctx.state !== "running") return;
      // 轻微人声起伏（模拟谈话群体的音量呼吸）
      murmurGain.gain.setTargetAtTime(0.28 + Math.random() * 0.2, ctx.currentTime, 0.6);

      const osc = ctx.createOscillator();
      const clinkGain = ctx.createGain();
      osc.frequency.value = 3000 + Math.random() * 2000;
      osc.type = "sine";
      clinkGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      clinkGain.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.03, ctx.currentTime + 0.015);
      clinkGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(clinkGain).connect(gainNode);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    }, 1600 + Math.random() * 4200);
    cleanups.push(() => clearInterval(clinkInterval));
  } else if (type === "library") {
    const buffer = createNoiseBuffer(ctx, "white");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const quietGain = ctx.createGain();
    quietGain.gain.value = 0.08;
    source.connect(quietGain).connect(gainNode);
    source.start();
    cleanups.push(() => { try { source.stop(); } catch {} });

    const pageInterval = setInterval(() => {
      if (ctx.state !== "running") return;
      const pageBuffer = createNoiseBuffer(ctx, "white", 1);
      const pageSource = ctx.createBufferSource();
      pageSource.buffer = pageBuffer;
      const pageGain = ctx.createGain();
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 3000;
      pageGain.gain.setValueAtTime(0, ctx.currentTime);
      pageGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1);
      pageGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      pageSource.connect(highpass).connect(pageGain).connect(gainNode);
      pageSource.start();
      pageSource.stop(ctx.currentTime + 0.4);
    }, 5000 + Math.random() * 10000);
    cleanups.push(() => clearInterval(pageInterval));
  } else if (type === "night") {
    const cricketInterval = setInterval(() => {
      if (ctx.state !== "running") return;
      const osc = ctx.createOscillator();
      const cricketGain = ctx.createGain();
      osc.frequency.value = 4000 + Math.random() * 1000;
      osc.type = "sine";
      const duration = 0.05;
      const repeats = 3 + Math.floor(Math.random() * 5);

      for (let j = 0; j < repeats; j++) {
        const t = ctx.currentTime + j * 0.08;
        cricketGain.gain.setValueAtTime(0.03, t);
        cricketGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      }

      osc.connect(cricketGain).connect(gainNode);
      osc.start();
      osc.stop(ctx.currentTime + repeats * 0.08 + 0.1);
    }, 300 + Math.random() * 1500);
    cleanups.push(() => clearInterval(cricketInterval));

    const buffer = createNoiseBuffer(ctx, "brown");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const bgGain = ctx.createGain();
    bgGain.gain.value = 0.05;
    source.connect(bgGain).connect(gainNode);
    source.start();
    cleanups.push(() => { try { source.stop(); } catch {} });
  }

  if (cleanups.length === 0) return null;
  return () => cleanups.forEach((fn) => fn());
}

// Track active layers
interface ActiveLayer {
  gainNode: GainNode;
  cleanup: () => void;
}

export function useAudioEngine(mix: Record<string, number>, masterVolume: number) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const layersRef = useRef<Map<string, ActiveLayer>>(new Map());

  const ensureContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
      masterGainRef.current = ctxRef.current.createGain();
      masterGainRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return { ctx: ctxRef.current, masterGain: masterGainRef.current! };
  }, []);

  const stopLayer = useCallback((soundId: string) => {
    const layer = layersRef.current.get(soundId);
    if (layer) {
      layer.cleanup();
      try { layer.gainNode.disconnect(); } catch {}
      layersRef.current.delete(soundId);
    }
  }, []);

  const stopAll = useCallback(() => {
    layersRef.current.forEach((_, id) => stopLayer(id));
  }, [stopLayer]);

  // Sync layers with mix
  useEffect(() => {
    const activeSounds = Object.entries(mix).filter(([, v]) => v > 0);

    if (activeSounds.length === 0) {
      stopAll();
      return;
    }

    const { ctx, masterGain } = ensureContext();

    // Remove layers no longer in mix
    layersRef.current.forEach((_, id) => {
      if (!mix[id] || mix[id] <= 0) {
        stopLayer(id);
      }
    });

    // Add or update layers
    activeSounds.forEach(([soundId, volume]) => {
      const existing = layersRef.current.get(soundId);
      if (existing) {
        // Update volume
        existing.gainNode.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
      } else {
        // Create new layer
        const layerGain = ctx.createGain();
        layerGain.gain.value = volume;
        layerGain.connect(masterGain);
        const cleanup = createSoundLayer(ctx, layerGain, soundId);
        if (cleanup) {
          layersRef.current.set(soundId, { gainNode: layerGain, cleanup });
        }
      }
    });

    return () => {
      // Don't stop on re-render, only on unmount
    };
  }, [mix, ensureContext, stopLayer, stopAll]);

  // Update master volume
  useEffect(() => {
    if (masterGainRef.current && ctxRef.current && ctxRef.current.state === "running") {
      masterGainRef.current.gain.setTargetAtTime(masterVolume, ctxRef.current.currentTime, 0.1);
    }
  }, [masterVolume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  return { stopAll };
}
