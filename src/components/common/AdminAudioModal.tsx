import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Volume2, 
  VolumeX, 
  Play, 
  Square, 
  Activity, 
  Sliders, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  Clock, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Check, 
  Smartphone, 
  Headphones, 
  Radio, 
  Zap, 
  FileAudio, 
  Database,
  Layers,
  Flame,
  Music
} from 'lucide-react';
import { 
  getGlobalAudioContext, 
  isAudioUnlocked, 
  unlockAudioSystem, 
  playTestTone, 
  playTestChime, 
  startSynthesizedAtmosphere, 
  stopSynthesizedAtmosphere,
  SILENT_WAV_DATA_URL,
  getPlayableAudioUrl
} from '../../utils/audioHelper';
import { StorageConfig } from '../../types';

interface AdminAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageConfig?: StorageConfig;
  onUpdateConfig?: (updates: Partial<StorageConfig>) => void;
  activePlaceName?: string;
  activeAmbientName?: string;
  theme?: 'dark' | 'light';
}

export const AdminAudioModal: React.FC<AdminAudioModalProps> = ({
  isOpen,
  onClose,
  storageConfig,
  onUpdateConfig,
  activePlaceName,
  activeAmbientName,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<'diagnostic' | 'soundscapes' | 'simulation' | 'system'>('diagnostic');

  // Real-time AudioContext state
  const [contextState, setContextState] = useState<string>('unknown');
  const [sampleRate, setSampleRate] = useState<number>(0);
  const [contextTime, setContextTime] = useState<number>(0);
  const [unlockedState, setUnlockedState] = useState<boolean>(isAudioUnlocked());
  const [platformInfo, setPlatformInfo] = useState<string>('');

  // Audio Testing State
  const [activeSynthesized, setActiveSynthesized] = useState<string | null>(null);
  const [atmosphereVolume, setAtmosphereVolume] = useState<number>(0.28);
  const atmosphereRef = useRef<{ stop: () => void; setVolume: (v: number) => void } | null>(null);

  // Custom audio player state
  const [customAudioUrl, setCustomAudioUrl] = useState<string>('https://cdn.freesound.org/previews/316/316844_4939433-lq.mp3');
  const [isCustomPlaying, setIsCustomPlaying] = useState<boolean>(false);
  const [customVolume, setCustomVolume] = useState<number>(0.5);
  const [customAudioStatus, setCustomAudioStatus] = useState<string | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);

  // Simulation test state
  const [simulationState, setSimulationState] = useState<'idle' | 'counting' | 'success' | 'blocked'>('idle');
  const [countdown, setCountdown] = useState<number>(0);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const countdownTimerRef = useRef<any>(null);

  // Status ticker for AudioContext
  useEffect(() => {
    if (!isOpen) return;

    // Detect user platform
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
      if (isIOS) {
        setPlatformInfo(isSafari ? 'iOS Mobile Safari' : 'iOS WebKit App / Browser');
      } else if (/Android/i.test(ua)) {
        setPlatformInfo('Android Chrome / WebKit');
      } else if (/Macintosh/i.test(ua)) {
        setPlatformInfo('macOS Desktop');
      } else {
        setPlatformInfo('Desktop / Modern Web');
      }
    }

    const interval = setInterval(() => {
      const ctx = getGlobalAudioContext();
      if (ctx) {
        setContextState(ctx.state);
        setSampleRate(ctx.sampleRate);
        setContextTime(Math.round(ctx.currentTime * 10) / 10);
      } else {
        setContextState('Not Initialized');
      }
      setUnlockedState(isAudioUnlocked());
    }, 400);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Clean up sounds when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (atmosphereRef.current) {
        atmosphereRef.current.stop();
        atmosphereRef.current = null;
        setActiveSynthesized(null);
      }
      if (customAudioRef.current) {
        customAudioRef.current.pause();
        setIsCustomPlaying(false);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    }
  }, [isOpen]);

  const handleExecuteUnlock = async () => {
    const success = await unlockAudioSystem();
    setUnlockedState(isAudioUnlocked());
    if (success) {
      playTestTone(523.25, 'sine', 0.2, 0.15); // gentle confirmation beep
    }
  };

  const handleToggleSynthesized = (preset: 'rain' | 'forest' | 'waves' | 'space') => {
    if (activeSynthesized === preset) {
      if (atmosphereRef.current) {
        atmosphereRef.current.stop();
        atmosphereRef.current = null;
      }
      setActiveSynthesized(null);
    } else {
      if (atmosphereRef.current) {
        atmosphereRef.current.stop();
      }
      const instance = startSynthesizedAtmosphere(preset, atmosphereVolume);
      atmosphereRef.current = instance;
      setActiveSynthesized(preset);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setAtmosphereVolume(newVol);
    if (atmosphereRef.current) {
      atmosphereRef.current.setVolume(newVol);
    }
  };

  const handlePlayCustomUrl = () => {
    if (!customAudioRef.current) {
      customAudioRef.current = new Audio();
      customAudioRef.current.crossOrigin = 'anonymous';
      customAudioRef.current.setAttribute('playsinline', 'true');
      customAudioRef.current.setAttribute('webkit-playsinline', 'true');
    }

    const audio = customAudioRef.current;
    if (isCustomPlaying) {
      audio.pause();
      setIsCustomPlaying(false);
      setCustomAudioStatus('Paused');
      return;
    }

    const playable = getPlayableAudioUrl(customAudioUrl.trim());
    if (!playable) {
      setCustomAudioStatus('Invalid URL or format');
      return;
    }

    audio.src = playable;
    audio.volume = customVolume;
    audio.loop = true;
    setCustomAudioStatus('Loading stream...');

    audio.play().then(() => {
      setIsCustomPlaying(true);
      setCustomAudioStatus('Playing smoothly');
    }).catch((err) => {
      console.warn('Custom audio playback blocked:', err);
      setIsCustomPlaying(false);
      setCustomAudioStatus(`Playback blocked: ${err.message || 'Needs user gesture'}`);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    setCustomAudioUrl(fileUrl);
    setCustomAudioStatus(`Loaded local file: ${file.name}`);

    if (!customAudioRef.current) {
      customAudioRef.current = new Audio();
      customAudioRef.current.setAttribute('playsinline', 'true');
      customAudioRef.current.setAttribute('webkit-playsinline', 'true');
    }
    const audio = customAudioRef.current;
    audio.src = fileUrl;
    audio.volume = customVolume;
    audio.play().then(() => {
      setIsCustomPlaying(true);
      setCustomAudioStatus(`Playing: ${file.name}`);
    }).catch((err) => {
      setCustomAudioStatus(`Blocked: ${err.message}`);
    });
  };

  // Asynchronous delayed playback test (simulates an LLM event triggering ambient audio seconds after screen load)
  const handleStartSimulation = (delaySeconds: number) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    setSimulationState('counting');
    setCountdown(delaySeconds);
    setSimulationLog(prev => [
      `[${new Date().toLocaleTimeString()}] Scheduled delayed audio test for ${delaySeconds}s...`,
      ...prev
    ]);

    let remaining = delaySeconds;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        // Execute event-triggered playback WITHOUT a fresh user gesture
        executeDelayedPlayback();
      }
    }, 1000);
  };

  const executeDelayedPlayback = () => {
    setSimulationLog(prev => [
      `[${new Date().toLocaleTimeString()}] Timer fired! Attempting programmatic audio play...`,
      ...prev
    ]);

    try {
      // 1. Web Audio synthesizer play
      playTestChime('harmonic');

      // 2. HTMLAudioElement play test
      const testAudio = new Audio();
      testAudio.preload = 'auto';
      testAudio.setAttribute('playsinline', 'true');
      testAudio.setAttribute('webkit-playsinline', 'true');
      testAudio.src = SILENT_WAV_DATA_URL;

      testAudio.play().then(() => {
        setSimulationState('success');
        setSimulationLog(prev => [
          `[${new Date().toLocaleTimeString()}] SUCCESS: Event-triggered audio played without error! Web Audio Context is active.`,
          ...prev
        ]);
        testAudio.pause();
      }).catch((err) => {
        setSimulationState('blocked');
        setSimulationLog(prev => [
          `[${new Date().toLocaleTimeString()}] BLOCKED: Browser rejected autoplay without direct gesture (${err.name}: ${err.message}).`,
          ...prev
        ]);
      });
    } catch (err: any) {
      setSimulationState('blocked');
      setSimulationLog(prev => [
        `[${new Date().toLocaleTimeString()}] ERROR: ${err?.message || 'Unknown error'}`,
        ...prev
      ]);
    }
  };

  // Quick Orb manipulation for testing
  const handleAddOrbs = (amount: number) => {
    if (onUpdateConfig && storageConfig) {
      const current = storageConfig.orbs !== undefined ? storageConfig.orbs : 50;
      onUpdateConfig({ orbs: current + amount });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div 
        className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden font-sans ${
          isLight 
            ? 'bg-[#F8F9FA] text-[#1C1C1E] border-black/10' 
            : 'bg-[#141416] text-white border-white/10'
        }`}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-5 sm:px-6 py-4 border-b flex-shrink-0 ${
          isLight ? 'bg-white/80 border-black/8' : 'bg-[#18181B]/80 border-white/8'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider">Admin & Audio Diagnostic Menu</h3>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Dev Mode
                </span>
              </div>
              <p className={`text-[10px] ${isLight ? 'text-black/55' : 'text-white/50'}`}>
                Hardware audio engine diagnostics, ambient sound testing & event triggers
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
              isLight 
                ? 'bg-black/5 hover:bg-black/10 border-black/10 text-black' 
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className={`flex border-b px-3 sm:px-6 gap-1 flex-shrink-0 overflow-x-auto scrollbar-none ${
          isLight ? 'bg-white/50 border-black/8' : 'bg-[#121214] border-white/8'
        }`}>
          {[
            { id: 'diagnostic', label: 'Audio Engine', icon: Activity },
            { id: 'soundscapes', label: 'Soundscapes', icon: Headphones },
            { id: 'simulation', label: 'Event Simulation', icon: Radio },
            { id: 'system', label: 'System Tools', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3.5 border-b-2 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: AUDIO ENGINE & REAL-TIME HARDWARE DIAGNOSTICS */}
          {activeTab === 'diagnostic' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Status Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.03] border-white/8'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                    AudioContext
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      contextState === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {contextState}
                    </span>
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.03] border-white/8'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                    Gesture Lock
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${unlockedState ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'}`} />
                    <span className="text-xs font-bold">
                      {unlockedState ? 'Unlocked ✅' : 'Locked 🔒'}
                    </span>
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.03] border-white/8'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                    Sample Rate
                  </span>
                  <span className="text-xs font-bold font-mono">
                    {sampleRate > 0 ? `${sampleRate.toLocaleString()} Hz` : 'N/A'}
                  </span>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.03] border-white/8'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                    Clock Time
                  </span>
                  <span className="text-xs font-bold font-mono">
                    {contextTime}s
                  </span>
                </div>
              </div>

              {/* Platform Info Banner */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                isLight ? 'bg-black/[0.02] border-black/8' : 'bg-white/[0.02] border-white/8'
              }`}>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  <span className="font-medium">Detected Environment:</span>
                  <span className="font-bold">{platformInfo || 'Unknown Device'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleExecuteUnlock}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Execute Unlock Gesture</span>
                </button>
              </div>

              {/* Visualizer Simulation Bars */}
              <div className={`p-4 rounded-2xl border ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.02] border-white/8'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                    Real-time Audio Activity Spectrum
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {contextState === 'running' ? 'Active Bus' : 'Suspended'}
                  </span>
                </div>
                <div className="flex items-end justify-between h-14 gap-1 px-1">
                  {Array.from({ length: 28 }).map((_, i) => {
                    const heightPercent = contextState === 'running'
                      ? Math.max(12, ((Math.sin(i * 0.4 + contextTime * 3) + 1) / 2) * 90)
                      : 8;
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-full transition-all duration-150"
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: contextState === 'running'
                            ? `hsl(${260 + (i * 3)}, 80%, ${50 + (i % 20)}%)`
                            : 'rgba(255,255,255,0.1)'
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Instant Tone & Chime Synthesizer Controls */}
              <div className="space-y-3">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-black/70' : 'text-white/70'}`}>
                  Direct Web Audio Synthesizer Triggers
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => playTestTone(440, 'sine', 0.5, 0.2)}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all active:scale-95 flex flex-col justify-between ${
                      isLight 
                        ? 'bg-white hover:bg-black/[0.02] border-black/10' 
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2">
                      <Radio className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold">Sine 440 Hz</span>
                    <span className={`text-[10px] ${isLight ? 'text-black/40' : 'text-white/40'}`}>Concert Pitch A4</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => playTestTone(880, 'triangle', 0.5, 0.15)}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all active:scale-95 flex flex-col justify-between ${
                      isLight 
                        ? 'bg-white hover:bg-black/[0.02] border-black/10' 
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-2">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold">Triangle 880 Hz</span>
                    <span className={`text-[10px] ${isLight ? 'text-black/40' : 'text-white/40'}`}>High Harmonic A5</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => playTestChime('harmonic')}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all active:scale-95 flex flex-col justify-between ${
                      isLight 
                        ? 'bg-white hover:bg-black/[0.02] border-black/10' 
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold">Harmonic Chord</span>
                    <span className={`text-[10px] ${isLight ? 'text-black/40' : 'text-white/40'}`}>C-E-G-C Arpeggio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => playTestChime('crystal')}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all active:scale-95 flex flex-col justify-between ${
                      isLight 
                        ? 'bg-white hover:bg-black/[0.02] border-black/10' 
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center mb-2">
                      <Music className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold">Crystal Shimmer</span>
                    <span className={`text-[10px] ${isLight ? 'text-black/40' : 'text-white/40'}`}>Glassy E-Maj Chime</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AMBIENT SOUNDSCAPES (OFFLINE SYNTHESIZED + ONLINE MEDIA) */}
          {activeTab === 'soundscapes' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Synthesized Offline Atmospheres */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-black/70' : 'text-white/70'}`}>
                    Synthesized Atmosphere Presets (100% Offline)
                  </h4>
                  {activeSynthesized && (
                    <button
                      type="button"
                      onClick={() => handleToggleSynthesized(activeSynthesized as any)}
                      className="text-[10px] font-bold text-rose-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop Active Soundscape</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'rain', name: 'Rainstorm & Thunder', desc: 'Continuous pink rain noise with low-frequency rumble', icon: '🌧️' },
                    { id: 'waves', name: 'Ocean Waves & Surf', desc: 'Slow 8-second LFO modulated coastal surf swell', icon: '🌊' },
                    { id: 'forest', name: 'Forest Wind Whispers', desc: 'Bandpass filtered breezes and woodland air', icon: '🌲' },
                    { id: 'space', name: 'Ethereal Cosmic Drone', desc: 'Harmonic 5-oscillator detuned D-minor space pad', icon: '🌌' },
                  ].map((preset) => {
                    const isPlaying = activeSynthesized === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isPlaying
                            ? 'bg-purple-500/15 border-purple-500/40 shadow-lg'
                            : isLight 
                              ? 'bg-white border-black/8 hover:border-black/15' 
                              : 'bg-white/[0.03] border-white/8 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl">{preset.icon}</span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{preset.name}</span>
                            <span className={`text-[10px] block truncate ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                              {preset.desc}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleSynthesized(preset.id as any)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all active:scale-95 ${
                            isPlaying
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                              : 'bg-purple-600 text-white hover:bg-purple-500'
                          }`}
                        >
                          {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Atmosphere Volume Slider */}
                <div className={`p-4 rounded-2xl border flex items-center gap-4 ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.02] border-white/8'}`}>
                  <Volume2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                      <span>Atmosphere Master Volume</span>
                      <span>{Math.round(atmosphereVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      value={atmosphereVolume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Remote Audio Stream / File Upload Tester */}
              <div className={`p-4 rounded-2xl border space-y-3.5 ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.03] border-white/8'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileAudio className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Custom Audio URL or File Tester</h4>
                  </div>
                  {customAudioStatus && (
                    <span className="text-[10px] font-mono text-purple-300 truncate max-w-[200px]">
                      {customAudioStatus}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customAudioUrl}
                    onChange={(e) => setCustomAudioUrl(e.target.value)}
                    placeholder="Enter any https:// MP3 or WAV URL..."
                    className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500 ${
                      isLight ? 'bg-black/[0.03] border-black/10 text-black' : 'bg-black/30 border-white/10 text-white'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handlePlayCustomUrl}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                      isCustomPlaying 
                        ? 'bg-rose-500 text-white hover:bg-rose-600' 
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {isCustomPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isCustomPlaying ? 'Pause' : 'Test Stream'}</span>
                  </button>
                </div>

                {/* Upload local file */}
                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[10px] ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                    Test a local audio file from your iPhone or computer:
                  </span>
                  <label className="px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-white/10 active:scale-95 transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Audio File</span>
                    <input 
                      type="file" 
                      accept="audio/*" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EVENT SIMULATION (TESTING ASYNC LLM DELAYED PLAYBACK) */}
          {activeTab === 'simulation' && (
            <div className="space-y-5 animate-fadeIn">
              <div className={`p-4 rounded-2xl border space-y-2 ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.02] border-white/8'}`}>
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" />
                  <span>Asynchronous Delayed Playback Stress Test</span>
                </h4>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-black/60' : 'text-white/50'}`}>
                  On iOS Safari, playing audio automatically during a background event (such as an LLM scenery shift) fails unless an unlock gesture occurred earlier. Tap below to simulate this exact situation.
                </p>
              </div>

              {/* Countdown / Status Box */}
              <div className={`p-6 rounded-2xl border text-center space-y-3 ${
                simulationState === 'counting'
                  ? 'bg-purple-500/10 border-purple-500/30'
                  : simulationState === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : simulationState === 'blocked'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : isLight ? 'bg-white border-black/8' : 'bg-white/[0.02] border-white/8'
              }`}>
                {simulationState === 'counting' && (
                  <div>
                    <span className="text-3xl font-black font-mono animate-pulse text-purple-400 block mb-1">
                      {countdown}s
                    </span>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/70">
                      Simulating LLM generation latency... Do not touch the screen!
                    </span>
                  </div>
                )}

                {simulationState === 'success' && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-white">Event-Triggered Playback Succeeded!</span>
                    <span className="text-xs text-emerald-400 font-normal">
                      The iOS audio context remained fully primed and allowed programmatic playback.
                    </span>
                  </div>
                )}

                {simulationState === 'blocked' && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-1">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-white">Playback Blocked by WebKit</span>
                    <span className="text-xs text-rose-300 font-normal">
                      Tap "Execute Audio Unlock Gesture" in Tab 1, then retry this test.
                    </span>
                  </div>
                )}

                {simulationState === 'idle' && (
                  <div>
                    <Clock className="w-8 h-8 text-white/30 mx-auto mb-2" />
                    <span className="text-xs font-bold text-white/60 block">Ready for Simulation</span>
                  </div>
                )}

                {/* Trigger buttons */}
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleStartSimulation(3)}
                    disabled={simulationState === 'counting'}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-md shadow-purple-600/20"
                  >
                    Simulate 3s Delay
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartSimulation(5)}
                    disabled={simulationState === 'counting'}
                    className="px-4 py-2.5 rounded-xl border hover:bg-white/10 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition-all active:scale-95"
                  >
                    Simulate 5s Delay
                  </button>
                </div>
              </div>

              {/* Simulation Event Log */}
              {simulationLog.length > 0 && (
                <div className="space-y-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-black/50' : 'text-white/40'}`}>
                    Diagnostic Event Stream
                  </span>
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto">
                    {simulationLog.map((log, i) => (
                      <div key={i} className="text-white/70">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SYSTEM TOOLS & ACTIVE SESSION STATE */}
          {activeTab === 'system' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Active Session Scenery Card */}
              <div className={`p-4 rounded-2xl border space-y-3 ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.03] border-white/8'}`}>
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Current Active Session Scenery</span>
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] opacity-50 block uppercase">Active Place</span>
                    <span className="font-bold">{activePlaceName || 'General'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] opacity-50 block uppercase">Active Ambient Sound</span>
                    <span className="font-bold">{activeAmbientName || 'General'}</span>
                  </div>
                </div>
              </div>

              {/* Orb Economy Tools */}
              <div className={`p-4 rounded-2xl border space-y-3 ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.03] border-white/8'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Orb Wallet Balance Manager</h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {storageConfig?.orbs !== undefined ? storageConfig.orbs : 50} Orbs
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddOrbs(100)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    +100 Orbs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddOrbs(500)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    +500 Orbs
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateConfig) {
                        onUpdateConfig({ orbs: 0 });
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    Reset Balance (0)
                  </button>
                </div>
              </div>

              {/* Haptic Motor Test */}
              <div className={`p-4 rounded-2xl border space-y-3 ${isLight ? 'bg-white border-black/8' : 'bg-white/[0.03] border-white/8'}`}>
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  <span>Device Haptic Vibration Pulses</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['Light (15ms)', 'Medium (30ms)', 'Heavy (60ms)', 'Pattern (20-40-20ms)'].map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                          if (idx === 0) navigator.vibrate(15);
                          else if (idx === 1) navigator.vibrate(30);
                          else if (idx === 2) navigator.vibrate(60);
                          else navigator.vibrate([20, 40, 20]);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border text-xs font-medium hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`px-5 sm:px-6 py-3.5 border-t flex items-center justify-between text-xs flex-shrink-0 ${
          isLight ? 'bg-white/80 border-black/8' : 'bg-[#18181B]/80 border-white/8'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className={`text-[11px] ${isLight ? 'text-black/55' : 'text-white/50'}`}>
              Vsen.Ai Audio Subsystem v2.4 (iOS WebKit Patched)
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
