// Bulletproof Audio Player Helper for iOS Safari, WebKit, and Modern Browsers

const audioBlobCache = new Map<string, string>();
let globalAudioCtx: AudioContext | null = null;
let isAudioHardwareUnlocked = false;
let sharedSilentAudio: HTMLAudioElement | null = null;

// Exact 44-byte silent WAV data URI for priming iOS Safari audio element and Web Audio playback
export const SILENT_WAV_DATA_URL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/**
 * Checks whether audio subsystem has been unlocked by a user gesture
 */
export function isAudioUnlocked(): boolean {
  return isAudioHardwareUnlocked;
}

/**
 * Returns or creates the singleton Web Audio context
 */
export function getGlobalAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!globalAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        globalAudioCtx = new AudioCtx();
      }
    }
    if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => {});
    }
  } catch {}
  return globalAudioCtx;
}

/**
 * Converts a base64 Data URL to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(',');
    const header = parts[0] || '';
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'audio/mpeg';
    const binary = atob(parts[1] || '');
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch (err) {
    console.warn('Failed to parse data URL to blob, using fallback', err);
    return new Blob([], { type: 'audio/mpeg' });
  }
}

/**
 * Ensures an audio URL is 100% playable on iOS Safari.
 * iOS Safari frequently fails to decode base64 data:audio URLs on HTMLAudioElement.
 * Converting to a Blob Object URL resolves this WebKit limitation.
 */
export function getPlayableAudioUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('db:')) return null;

  // If already an HTTP/HTTPS or Blob URL, return directly
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  // If it's a data URL or base64 string, convert to Blob URL
  if (rawUrl.startsWith('data:audio') || rawUrl.startsWith('data:application/octet-stream') || rawUrl.includes(';base64,')) {
    if (audioBlobCache.has(rawUrl)) {
      return audioBlobCache.get(rawUrl)!;
    }
    try {
      const blob = dataUrlToBlob(rawUrl);
      const blobUrl = URL.createObjectURL(blob);
      audioBlobCache.set(rawUrl, blobUrl);
      return blobUrl;
    } catch (e) {
      console.warn('Failed to create Blob URL from audio data', e);
      return rawUrl;
    }
  }

  return rawUrl;
}

/**
 * Creates an HTMLAudioElement configured specifically for iOS Safari & mobile browsers
 */
export function createOptimizedAudioElement(): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.setAttribute('playsinline', 'true');
  audio.setAttribute('webkit-playsinline', 'true');
  audio.crossOrigin = 'anonymous';
  return audio;
}

/**
 * Unlocks iOS Safari and WebKit audio engines on user gesture.
 * Pre-initializes AudioContext and plays a blank/silent audio track in the background.
 * Also primes any passed HTMLAudioElements so event-driven playback is allowed.
 */
export function unlockAudioSystem(audioElements?: (HTMLAudioElement | null | undefined)[]): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  // 1. Resume / activate WebAudio context
  try {
    const ctx = getGlobalAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      // Trigger a 1-buffer silence node to ensure state is active
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch {}
    }
  } catch {}

  // 2. Play blank / silent audio track in the background (essential for iOS Safari media pipeline unlock)
  return new Promise<boolean>((resolve) => {
    try {
      if (!sharedSilentAudio) {
        sharedSilentAudio = new Audio();
        sharedSilentAudio.preload = 'auto';
        sharedSilentAudio.setAttribute('playsinline', 'true');
        sharedSilentAudio.setAttribute('webkit-playsinline', 'true');
        sharedSilentAudio.crossOrigin = 'anonymous';
        sharedSilentAudio.src = SILENT_WAV_DATA_URL;
      }

      const p = sharedSilentAudio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          isAudioHardwareUnlocked = true;
          sharedSilentAudio?.pause();
          resolve(true);
        }).catch((err) => {
          console.warn('[AudioUnlock] Play caught (gesture required):', err);
          resolve(false);
        });
      } else {
        isAudioHardwareUnlocked = true;
        resolve(true);
      }
    } catch {
      resolve(false);
    }

    // 3. Prime provided HTMLAudioElement instances if they haven't started playing yet
    if (audioElements && audioElements.length > 0) {
      audioElements.forEach((el) => {
        if (!el) return;
        try {
          if (!el.src || el.src === '' || el.src === window.location.href) {
            // Prime with silent sound to unlock WebKit audio permission for this element
            el.src = SILENT_WAV_DATA_URL;
            const playPromise = el.play();
            if (playPromise && typeof playPromise.then === 'function') {
              playPromise.then(() => {
                el.pause();
                el.currentTime = 0;
              }).catch(() => {});
            }
          } else if (el.paused && (el as any).__shouldBePlaying) {
            el.play().catch(() => {});
          }
        } catch {}
      });
    }
  });
}

/**
 * Initializes the global iOS Audio Unlock gesture on first user tap/click.
 * Unlocks iOS Web Audio on the very first screen interaction across the application.
 */
export function initAudioUnlockGesture() {
  if (typeof window === 'undefined') return;

  function unlockAudio() {
    const silentAudio = new Audio();
    silentAudio.preload = 'auto';
    silentAudio.setAttribute('playsinline', 'true');
    silentAudio.setAttribute('webkit-playsinline', 'true');
    silentAudio.src = SILENT_WAV_DATA_URL;

    // Pre-initialize and unlock AudioContext
    try {
      const ctx = getGlobalAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}

    const playPromise = silentAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        // Audio context is now unlocked for event-based playback!
        isAudioHardwareUnlocked = true;
        silentAudio.pause();
        cleanupListeners();
      }).catch(() => {
        // Keep listeners active until successful gesture
      });
    } else {
      isAudioHardwareUnlocked = true;
      cleanupListeners();
    }
  }

  function cleanupListeners() {
    document.removeEventListener('click', unlockAudio, true);
    document.removeEventListener('touchstart', unlockAudio, true);
    document.removeEventListener('pointerdown', unlockAudio, true);
  }

  document.addEventListener('click', unlockAudio, { capture: true, passive: true });
  document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });
  document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
}

/**
 * Plays a simple test tone at the specified frequency and waveform
 */
export function playTestTone(
  frequency = 440, 
  type: OscillatorType = 'sine', 
  durationSeconds = 0.6, 
  volume = 0.2
): void {
  const ctx = getGlobalAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Smooth envelope to prevent audio click
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSeconds);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationSeconds + 0.05);
  } catch (err) {
    console.warn('[AudioTest] Failed to play test tone:', err);
  }
}

/**
 * Plays a rich multi-oscillator chord / chime sequence
 */
export function playTestChime(type: 'crystal' | 'harmonic' | 'alert' = 'harmonic'): void {
  const ctx = getGlobalAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  try {
    const now = ctx.currentTime;
    let freqs: number[];

    if (type === 'crystal') {
      freqs = [659.25, 830.61, 987.77, 1318.51, 1661.22]; // Emaj
    } else if (type === 'alert') {
      freqs = [440, 554.37, 659.25, 880];
    } else {
      freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // Cmaj arpeggio
    }

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.65);
    });
  } catch (err) {
    console.warn('[AudioTest] Failed to play chime:', err);
  }
}

let activeAtmosphereCleanup: (() => void) | null = null;
let activeAtmosphereVolumeNode: GainNode | null = null;

/**
 * Starts a real-time synthesized ambient atmosphere using Web Audio noise and filters.
 * Runs 100% offline with zero network requests.
 */
export function startSynthesizedAtmosphere(
  preset: 'rain' | 'forest' | 'waves' | 'space',
  initialVolume = 0.25
): { stop: () => void; setVolume: (v: number) => void } {
  // Stop any currently running atmosphere
  if (activeAtmosphereCleanup) {
    activeAtmosphereCleanup();
    activeAtmosphereCleanup = null;
  }

  const ctx = getGlobalAudioContext();
  if (!ctx) {
    return { stop: () => {}, setVolume: () => {} };
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  try {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(initialVolume, ctx.currentTime);
    masterGain.connect(ctx.destination);
    activeAtmosphereVolumeNode = masterGain;

    const stopCallbacks: (() => void)[] = [];

    if (preset === 'space') {
      // Ethereal Detuned Space Drone
      const baseFreqs = [73.42, 110.00, 146.83, 220.00, 277.18]; // D2, A2, D3, A3, C#4
      baseFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        // Subtle detune
        osc.detune.setValueAtTime((i - 2) * 4, ctx.currentTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, ctx.currentTime);

        oscGain.gain.setValueAtTime(0.08 / (i + 1), ctx.currentTime);

        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start();
        stopCallbacks.push(() => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {}
        });
      });
    } else {
      // Noise-based atmospheres: Rain, Waves, Forest Wind
      const bufferSize = ctx.sampleRate * 2; // 2 seconds of loopable noise
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;

      // Pink noise approximation
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Gain compensation
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';

      if (preset === 'rain') {
        lowpass.frequency.setValueAtTime(1200, ctx.currentTime);
        highpass.frequency.setValueAtTime(350, ctx.currentTime);
      } else if (preset === 'waves') {
        lowpass.frequency.setValueAtTime(600, ctx.currentTime);
        highpass.frequency.setValueAtTime(150, ctx.currentTime);

        // LFO for ocean surf swell
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // ~8 second swell
        lfoGain.gain.setValueAtTime(450, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(lowpass.frequency);
        lfo.start();
        stopCallbacks.push(() => {
          try {
            lfo.stop();
            lfo.disconnect();
          } catch {}
        });
      } else if (preset === 'forest') {
        lowpass.frequency.setValueAtTime(800, ctx.currentTime);
        highpass.frequency.setValueAtTime(200, ctx.currentTime);

        // Slow wind modulation
        const windLfo = ctx.createOscillator();
        const windLfoGain = ctx.createGain();
        windLfo.frequency.setValueAtTime(0.08, ctx.currentTime);
        windLfoGain.gain.setValueAtTime(300, ctx.currentTime);
        windLfo.connect(windLfoGain);
        windLfoGain.connect(lowpass.frequency);
        windLfo.start();
        stopCallbacks.push(() => {
          try {
            windLfo.stop();
            windLfo.disconnect();
          } catch {}
        });
      }

      whiteNoise.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(masterGain);

      whiteNoise.start();
      stopCallbacks.push(() => {
        try {
          whiteNoise.stop();
          whiteNoise.disconnect();
        } catch {}
      });
    }

    const stop = () => {
      stopCallbacks.forEach(cb => cb());
      try {
        masterGain.disconnect();
      } catch {}
      if (activeAtmosphereCleanup === stop) {
        activeAtmosphereCleanup = null;
      }
    };

    activeAtmosphereCleanup = stop;

    return {
      stop,
      setVolume: (v: number) => {
        try {
          masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime);
        } catch {}
      }
    };
  } catch (err) {
    console.warn('[AudioAtmosphere] Failed to create atmosphere:', err);
    return { stop: () => {}, setVolume: () => {} };
  }
}

/**
 * Stops any actively playing synthesized atmosphere
 */
export function stopSynthesizedAtmosphere(): void {
  if (activeAtmosphereCleanup) {
    activeAtmosphereCleanup();
    activeAtmosphereCleanup = null;
  }
}

/**
 * Global hook / registration for unlocking audio across the app on iOS
 */
export function registerGlobalAudioUnlocker(getAudioElements?: () => (HTMLAudioElement | null | undefined)[]) {
  if (typeof window === 'undefined') return () => {};

  const handleInteraction = () => {
    const elements = getAudioElements ? getAudioElements() : [];
    unlockAudioSystem(elements);
  };

  window.addEventListener('touchstart', handleInteraction, { capture: true, passive: true });
  window.addEventListener('touchend', handleInteraction, { capture: true, passive: true });
  window.addEventListener('pointerdown', handleInteraction, { capture: true, passive: true });
  window.addEventListener('click', handleInteraction, { capture: true, passive: true });
  window.addEventListener('keydown', handleInteraction, { capture: true, passive: true });

  return () => {
    window.removeEventListener('touchstart', handleInteraction, { capture: true });
    window.removeEventListener('touchend', handleInteraction, { capture: true });
    window.removeEventListener('pointerdown', handleInteraction, { capture: true });
    window.removeEventListener('click', handleInteraction, { capture: true });
    window.removeEventListener('keydown', handleInteraction, { capture: true });
  };
}
