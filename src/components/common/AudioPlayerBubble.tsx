import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, AlertCircle, RefreshCw } from 'lucide-react';
import { getPlayableAudioUrl, unlockAudioSystem, getGlobalAudioContext } from '../../utils/audioHelper';

interface AudioPlayerBubbleProps {
  src: string;
  title?: string;
  subTitle?: string;
  theme?: 'dark' | 'light';
  variant?: 'chat' | 'card' | 'compact';
  autoPlay?: boolean;
}

export const AudioPlayerBubble: React.FC<AudioPlayerBubbleProps> = ({
  src,
  title = 'Audio Track',
  subTitle,
  theme = 'dark',
  variant = 'chat',
  autoPlay = false
}) => {
  const isLight = theme === 'light';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize source URL for iOS Safari compatibility
  const playableUrl = getPlayableAudioUrl(src);

  useEffect(() => {
    if (!playableUrl) {
      setError('Invalid audio URL');
      return;
    }

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.crossOrigin = 'anonymous';
    audio.src = playableUrl;

    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
      setError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: any) => {
      console.warn('[AudioPlayerBubble] Audio error:', e);
      setIsLoading(false);
      setIsPlaying(false);
      setError('Unable to load audio');
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    if (autoPlay) {
      handleTogglePlay();
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [playableUrl]);

  const handleTogglePlay = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!audioRef.current) return;
    const audio = audioRef.current;

    // First unlock iOS Audio Context and hardware
    await unlockAudioSystem([audio]);

    try {
      const ctx = getGlobalAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch {}

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      setError(null);
      try {
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
      } catch (err: any) {
        console.warn('[AudioPlayerBubble] Playback promise rejected:', err);
        setIsLoading(false);
        setIsPlaying(false);
        setError('Tap to play');
      }
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    audioRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const formatTime = (timeInSec: number) => {
    if (isNaN(timeInSec) || !isFinite(timeInSec)) return '0:00';
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      onClick={(e) => e.stopPropagation()}
      className={`rounded-2xl border p-3 flex flex-col gap-2 transition-all select-none w-full max-w-[280px] sm:max-w-[320px] font-sans ${
        isLight
          ? 'bg-white/90 border-black/10 text-black shadow-sm'
          : 'bg-black/40 backdrop-blur-md border-white/15 text-white shadow-md'
      }`}
    >
      {/* Header Info Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isPlaying ? 'bg-indigo-500 text-white animate-pulse' : isLight ? 'bg-black/5 text-black/70' : 'bg-white/10 text-white/80'
          }`}>
            <Music className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold block truncate leading-tight">
              {title}
            </span>
            {subTitle && (
              <span className={`text-[9px] block truncate ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                {subTitle}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleMute}
          className={`p-1 rounded-lg transition-colors cursor-pointer ${
            isLight ? 'hover:bg-black/5 text-black/60' : 'hover:bg-white/10 text-white/60'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Main Control Row */}
      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={handleTogglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer active:scale-90 shadow-md ${
            isPlaying
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-indigo-500 hover:bg-indigo-400 text-white'
          }`}
          title={isPlaying ? 'Pause' : 'Play MP3'}
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-white" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Progress Bar & Waveform */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          {/* Animated Waveform Visualizer */}
          <div className="flex items-end gap-[2px] h-3 px-1">
            {Array.from({ length: 24 }).map((_, i) => {
              const active = (i / 24) * 100 <= progressPercent;
              const barHeight = isPlaying
                ? Math.max(20, Math.sin(i * 0.5 + currentTime * 8) * 100)
                : 20 + (i % 3) * 15;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-150 ${
                    active
                      ? 'bg-indigo-400'
                      : isLight ? 'bg-black/15' : 'bg-white/20'
                  }`}
                  style={{ height: `${barHeight}%` }}
                />
              );
            })}
          </div>

          {/* Timeline Range Scrubber */}
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleScrub}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-400"
            />
          </div>

          {/* Time Display */}
          <div className={`flex justify-between text-[9px] font-mono ${isLight ? 'text-black/50' : 'text-white/50'}`}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1 text-[9.5px] text-rose-400 font-medium px-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
