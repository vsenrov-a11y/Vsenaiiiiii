// Web Audio API Sound Synthesizer for Orb Chimes and Rewards

let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const playOrbEarnSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Ascending arpeggio chime (C5, E5, G5, C6, E6)
    const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      // Glassy envelope
      gain.gain.setValueAtTime(0, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.45);
    });
  } catch (err) {
    // Silent fail if audio permissions blocked
  }
};

export const playOrbSpendSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Frequency slide down for spending
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(440.00, now + 0.25);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (err) {
    // Silent fail
  }
};

export const isFreeTrialActive = (accountCreatedAt?: number): boolean => {
  if (!accountCreatedAt) return true; // Default to free pass if creation time not set
  const freePeriodMs = 24 * 60 * 60 * 1000; // 24 Hours
  return Date.now() - accountCreatedAt < freePeriodMs;
};

export const getRemainingFreeTrialHours = (accountCreatedAt?: number): number => {
  if (!accountCreatedAt) return 24;
  const freePeriodMs = 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - accountCreatedAt;
  const remainingMs = Math.max(0, freePeriodMs - elapsed);
  return Math.ceil(remainingMs / (1000 * 60 * 60));
};
