import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, Persona, StorageConfig, ChatHistory } from '../../types';
import { PERSONAS } from '../../data/personas';
import { buildStableSystemInstruction, buildDynamicSystemInstruction } from '../../utils/systemInstructionBuilder';
import { getRealWorldDefaultCalendar } from '../../utils/calendarHelper';
import { resolveWallpaper } from '../../utils/wallpaperResolver';
import { shouldSkipSceneDetection, detectSceneState } from '../../utils/sceneDetectionClient';
import { CharacterProfileScreen } from './CharacterProfileScreen';
import { PhoneInterface } from './PhoneInterface';
import { WorldProfileScreen } from './WorldProfileScreen';
import { EditMessageModal } from '../EditMessageModal';
import { OrbBadge } from '../common/OrbBadge';
import { OrbWalletModal } from '../common/OrbWalletModal';
import { SafeImage } from '../common/SafeImage';

import { Send, Play, PlayCircle, Video, ArrowLeft, Smartphone, Activity, Briefcase, ShoppingBag, Shirt, Package, Sparkles, RefreshCw, AlertCircle, User, Image, Smile, ChevronsRight, Copy, GitFork, Pencil, Pin, Flag, X, ChevronDown, Check, CheckCircle2, Calendar, HelpCircle, Lock, Volume2, VolumeX, Palette, ChevronLeft, ChevronRight, Menu, Trash2, Plus, Info, LayoutTemplate, MessageSquareCode, Share2, Eye, Heart, Compass, Globe, Zap, Wand2, Sliders, MessageSquare, MapPin, CloudSun, Users, Award, Save, Clock, Brain, UserCheck, History, Target, BookOpen, Dumbbell, Search } from 'lucide-react';
import { getAsset, storeAsset, useAsset } from '../../utils/fileDb';
import { saveCharacterChatToLocalStorage, loadCharacterChatFromLocalStorage, clearCharacterChatFromLocalStorage } from '../../utils/storage';

const fetchWithRetry = async (url: string, options: RequestInit, retries = 2, delayMs = 600): Promise<Response> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
      } else {
        return response;
      }
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Network request failed');
};

const EMOJIS = ['👋', '✨', '❤️', '🧠', '🤖', '🔥', '💻', '🔮', '🎉', '🌟'];

const PERSONA_PRESETS = [
  { name: "Explorer", desc: "A curious mind looking for immersive, detailed, and authentic conversations." },
  { name: "Architect", desc: "A structured thinker focused on planning, system design, and elegant code craftsmanship." },
  { name: "Dreamer", desc: "A highly creative soul who enjoys poetry, visual fiction, and whimsical metaphors." }
];

// Creator-added places are used exclusively for wallpapers


interface InlineMessageEditorProps {
  initialText: string;
  onSave: (newText: string) => void;
  onCancel: () => void;
  onRewindAndSave: (newText: string) => void;
}

const InlineMessageEditor: React.FC<InlineMessageEditorProps> = ({
  initialText,
  onSave,
  onCancel,
  onRewindAndSave,
}) => {
  const [text, setText] = useState(initialText);
  return (
    <div className="flex flex-col gap-2 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="bg-black/30 text-white rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-white/20 w-full resize-none h-16 font-sans"
        autoFocus
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (text.trim()) {
              onRewindAndSave(text);
            }
          }}
          className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/10 border border-white/20 text-[10px] text-white font-bold transition-all flex items-center gap-1 cursor-pointer"
          title="Update message and delete all subsequent messages"
        >
          <GitFork className="w-2.5 h-2.5 rotate-180" />
          <span>Rewind & Save</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/25 text-[10px] text-white font-bold transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (text.trim()) {
              onSave(text);
            }
          }}
          className="px-2.5 py-1 rounded bg-[#7c5cfc] hover:bg-[#7c5cfc] text-[10px] text-white font-bold transition-all cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
};

interface PremiumChatScreenProps {
  initialLinkedWorldId?: string | null;
  persona: Persona;
  apiKey?: string;
  historyId: string | null;
  initialMessages?: ChatMessage[];
  onBack: () => void;
  onSaveHistory: (historyId: string, messages: ChatMessage[], lastMessageText: string, personaId?: string) => void;
  isRepliesEnabled?: boolean;
  isHapticEnabled?: boolean;
  storageConfig?: StorageConfig;
  onToggleLikePersona?: (personaId: string) => void;
  onDeletePersona?: (personaId: string) => void;
  onResumeChat?: (historyId: string) => void;
  onUpdateConfig?: (config: Partial<StorageConfig>) => void;
  theme?: 'dark' | 'light';
  onEditPersona?: (personaId: string) => void;
}

const getMessageTimeMs = (id: string): number => {
  const match = id.match(/\d+$/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return Date.now();
};

const sanitizeZeroCharacterOutput = (text: string): string => {
  // 1. Remove standard character dialog headers e.g. "Persona: " or "Character Name: "
  let sanitized = text.replace(/^[a-zA-Z0-9_\s\-]+:\s*"/gm, "");
  sanitized = sanitized.replace(/^[a-zA-Z0-9_\s\-]+:\s*/gm, "");
  
  // 2. Remove quotation marks to suppress quoted conversational/spoken dialogue lines
  sanitized = sanitized.replace(/"/g, "");
  sanitized = sanitized.replace(/“/g, "");
  sanitized = sanitized.replace(/”/g, "");
  return sanitized;
};

const cleanPhoneMessage = (text: string, characterName: string): string => {
  if (!text) return '';
  
  // 1. Remove "CharacterName: " prefixes if any (case insensitive)
  let cleaned = text;
  const prefixRegex = new RegExp(`^${characterName}\\s*:\\s*`, 'i');
  cleaned = cleaned.replace(prefixRegex, '');
  
  // Strip general names at the beginning of quotes (e.g., "Dino: I'm in front of you")
  cleaned = cleaned.replace(/^[^:\n]+:\s*"/i, '"');
  
  // 2. Remove all asterisks/narrations (e.g., *I text you back* or *smiling*)
  cleaned = cleaned.replace(/\*[^*]+\*/g, '');
  
  // 3. Remove quotation marks if they wrap the entire message
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  
  cleaned = cleaned.trim();
  
  // If the cleaning removed everything, fall back to a simplified version without asterisks/quotes
  if (!cleaned) {
    cleaned = text.replace(/[*"'']/g, '').trim();
  }
  
  return cleaned;
};

interface ParsedSegment {
  id: string;
  type: 'narration' | 'dialogue';
  characterName?: string;
  character?: any;
  text: string;
}

const parseWorldMessage = (text: string, allCompanions: any[], fallbackCharacterName?: string): ParsedSegment[] => {
  if (!text) return [];
  const segments: ParsedSegment[] = [];

  const lines = text.split('\n');
  
  lines.forEach((line, lineIdx) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    let processedLine = trimmedLine;
    // Preprocess choice numbering to keep it inside the narration block instead of splitting it out
    processedLine = processedLine.replace(/^(\d+)\.\s*\*\*([^*]+)\*\*/g, '**$1. $2**');
    processedLine = processedLine.replace(/^(\d+)\.\s*\*([^*]+)\*/g, '*$1. $2*');

    // Check if the line starts with a speaker prefix: CharacterName: or [CharacterName]:
    let lineSpeakerName: string | null = null;
    let lineCompanion: any = null;
    let restOfLine = processedLine;

    const prefixMatch = processedLine.match(/^(?:\[([A-Za-z0-9_'\s]{1,30})\]|([A-Za-z0-9_'\s]{1,30}))\s*:\s*(.*)$/s);
    if (prefixMatch) {
      const candidateName = (prefixMatch[1] || prefixMatch[2] || '').trim();
      const matched = allCompanions.find(c => 
        c.name.toLowerCase() === candidateName.toLowerCase() ||
        c.name.toLowerCase().includes(candidateName.toLowerCase()) ||
        candidateName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (matched || candidateName.length < 25) {
        lineSpeakerName = matched ? matched.name : candidateName;
        lineCompanion = matched;
        restOfLine = prefixMatch[3].trim();
      }
    }

    const parts = restOfLine.split(/(\*{1,2}[^*]+\*{1,2}|["“][^"”]*["”])/g).filter(p => p.trim());

    if (parts.length === 0) {
      if (lineSpeakerName) {
        segments.push({
          id: `empty-dialogue-${lineIdx}`,
          type: 'dialogue',
          characterName: lineSpeakerName,
          character: lineCompanion,
          text: ''
        });
      }
      return;
    }
    
    parts.forEach((part, pIdx) => {
      const trimmedPart = part.trim();
      if (!trimmedPart) return;

      const isAction = trimmedPart.startsWith('*') && trimmedPart.endsWith('*');
      const isDialogueWithQuotes = (trimmedPart.startsWith('"') && trimmedPart.endsWith('"')) || (trimmedPart.startsWith('“') && trimmedPart.endsWith('”'));
      
      if (isAction) {
        const stripped = trimmedPart.replace(/^\*+/, '').replace(/\*+$/, '').trim();
        segments.push({
          id: `narration-${lineIdx}-${pIdx}`,
          type: 'narration',
          characterName: lineSpeakerName || undefined,
          character: lineCompanion,
          text: stripped
        });
      } else if (isDialogueWithQuotes) {
        const quoteContent = trimmedPart.substring(1, trimmedPart.length - 1).trim();
        segments.push({
          id: `dialogue-${lineIdx}-${pIdx}`,
          type: 'dialogue',
          characterName: lineSpeakerName || fallbackCharacterName || "Companion",
          character: lineCompanion || allCompanions.find(c => c.name.toLowerCase() === (lineSpeakerName || fallbackCharacterName || '').toLowerCase()),
          text: quoteContent
        });
      } else {
        // Plain text without asterisks and without surrounding quotes
        // Check if there is an embedded speaker tag like: Marcus: "..." or Marcus: Hello
        const inlinePrefix = trimmedPart.match(/^(?:\[([A-Za-z0-9_'\s]{1,30})\]|([A-Za-z0-9_'\s]{1,30}))\s*:\s*(.*)$/s);
        if (inlinePrefix) {
          const inlineName = (inlinePrefix[1] || inlinePrefix[2] || '').trim();
          const matched = allCompanions.find(c => 
            c.name.toLowerCase() === inlineName.toLowerCase() ||
            c.name.toLowerCase().includes(inlineName.toLowerCase()) ||
            inlineName.toLowerCase().includes(c.name.toLowerCase())
          );
          const activeName = matched ? matched.name : inlineName;
          const inlineText = (inlinePrefix[3] || '').trim();
          if (inlineText) {
            segments.push({
              id: `dialogue-inline-${lineIdx}-${pIdx}`,
              type: 'dialogue',
              characterName: activeName,
              character: matched,
              text: inlineText.replace(/^["“]/, '').replace(/["”]$/, '')
            });
          }
        } else if (lineSpeakerName) {
          // Part of a prefixed line -> dialogue
          segments.push({
            id: `dialogue-plain-${lineIdx}-${pIdx}`,
            type: 'dialogue',
            characterName: lineSpeakerName,
            character: lineCompanion,
            text: trimmedPart
          });
        } else {
          // Unadorned prose with no speaker tag -> 3rd person narration
          segments.push({
            id: `narration-plain-${lineIdx}-${pIdx}`,
            type: 'narration',
            characterName: undefined,
            character: undefined,
            text: trimmedPart
          });
        }
      }
    });
  });

  return segments;
};

const formatRelativeDate = (timeMs: number): string => {
  const now = Date.now();
  const diffMs = now - timeMs;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const date = new Date(timeMs);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  if (diffMs < 0) {
    return `Today, ${timeStr}`;
  }

  if (diffHours < 24) {
    const todayDate = new Date();
    if (todayDate.getDate() === date.getDate()) {
      return `Today, ${timeStr}`;
    } else {
      return `Yesterday, ${timeStr}`;
    }
  }

  if (diffDays === 1) {
    return `1 day ago, ${timeStr}`;
  }
  if (diffDays < 7) {
    return `${diffDays} days ago, ${timeStr}`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? `1 week ago` : `${weeks} weeks ago`;
  }
  const months = Math.floor(diffDays / 30);
  return months === 1 ? `1 month ago` : `${months} months ago`;
};

const getInitialCharScores = (charId: string, name: string) => {
  let hash = 0;
  const str = (charId || '') + (name || '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  return {
    attraction: 3 + (hash % 6),           // 3 to 8
    friendship: 4 + ((hash >> 2) % 6),     // 4 to 9
    trust: 3 + ((hash >> 4) % 6),          // 3 to 8
    respect: 4 + ((hash >> 6) % 6),        // 4 to 9
    loyalty: 3 + ((hash >> 8) % 6),        // 3 to 8
    fear: 1 + ((hash >> 10) % 4),          // 1 to 4
    anger: 1 + ((hash >> 12) % 3),         // 1 to 3
    rivalry: 1 + ((hash >> 14) % 5),       // 1 to 5
    lust: 1 + ((hash >> 16) % 6),          // 1 to 6
  };
};

const sanitizeStatusEasyMode = (prevStatus: any = {}, nextStatus: any = {}) => {
  const safePrev = (prevStatus && typeof prevStatus === 'object') ? prevStatus : {};
  const safeNext = (nextStatus && typeof nextStatus === 'object') ? nextStatus : {};
  const merged = { ...safePrev, ...safeNext };
  
  let health = typeof merged.health === 'number' ? merged.health : (parseInt(String(merged.health)) || 100);
  let energy = typeof merged.energy === 'number' ? merged.energy : (parseInt(String(merged.energy)) || 90);
  let hygiene = typeof merged.hygiene === 'number' ? merged.hygiene : (parseInt(String(merged.hygiene)) || 95);
  let hunger = typeof merged.hunger === 'number' ? merged.hunger : (parseInt(String(merged.hunger)) || 95);
  let thirst = typeof merged.thirst === 'number' ? merged.thirst : (parseInt(String(merged.thirst)) || 95);
  let mood = typeof merged.mood === 'number' ? merged.mood : (parseInt(String(merged.mood)) || 90);
  let arousal = typeof merged.arousal === 'number' ? merged.arousal : (parseInt(String(merged.arousal)) || 10);

  return {
    ...merged,
    health: Math.min(100, Math.max(0, health)),
    energy: Math.min(100, Math.max(0, energy)),
    hygiene: Math.min(100, Math.max(0, hygiene)),
    hunger: Math.min(100, Math.max(0, hunger)),
    thirst: Math.min(100, Math.max(0, thirst)),
    mood: Math.min(100, Math.max(0, mood)),
    arousal: Math.min(100, Math.max(0, arousal)),
  };
};

interface OptimizedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: string;
  onChangeValue?: (val: string) => void;
  onCommit?: (val: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const OptimizedInput = React.memo(React.forwardRef<HTMLInputElement, OptimizedInputProps>(({ value = "", onChangeValue, onCommit, placeholder, className, type = "text", onKeyDown, ...props }, ref) => {
  const [localVal, setLocalVal] = useState(value ?? "");
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal(value ?? "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    if (onChangeValue) {
      onChangeValue(val);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (onCommit) {
      onCommit(localVal);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  return (
    <input
      ref={ref}
      type={type}
      value={localVal}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onCommit) {
          onCommit(localVal);
        }
        if (onKeyDown) onKeyDown(e);
      }}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
}));

interface OptimizedTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  value?: string;
  onChangeValue?: (val: string) => void;
  onCommit?: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const OptimizedTextArea = React.memo(React.forwardRef<HTMLTextAreaElement, OptimizedTextAreaProps>(({ value = "", onChangeValue, onCommit, placeholder, className, ...props }, ref) => {
  const [localVal, setLocalVal] = useState(value ?? "");
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal(value ?? "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    if (onChangeValue) {
      onChangeValue(val);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (onCommit) {
      onCommit(localVal);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  return (
    <textarea
      ref={ref}
      value={localVal}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
}));

const formatTextCache = new Map<string, React.ReactNode>();

const formatText = (content: string, baseSize: number = 13) => {
  if (!content) return null;
  const cacheKey = `${baseSize}_${content}`;
  if (formatTextCache.has(cacheKey)) {
    return formatTextCache.get(cacheKey)!;
  }

  const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|"[^"]*")/g);
  const actionSize = Math.max(9, baseSize - 2);
  
  const result = (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const text = part.slice(2, -2);
          return (
            <span key={idx} style={{ fontSize: `${actionSize}px` }} className="text-white/40 font-light italic tracking-wide">
              {text}
            </span>
          );
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          const text = part.slice(1, -1);
          return (
            <span key={idx} style={{ fontSize: `${actionSize}px` }} className="text-white/40 font-light italic tracking-wide">
              {text}
            </span>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          const text = part.slice(1, -1);
          return (
            <code key={idx} style={{ fontSize: `${actionSize}px` }} className="bg-white/[0.04] px-1.5 py-0.5 rounded text-[#E0E0E0] font-mono border border-white/[0.08]">
              {text}
            </code>
          );
        }
        if (part.startsWith('"') && part.endsWith('"')) {
          return (
            <span key={idx} className="text-white font-medium">
              {part}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );

  if (formatTextCache.size > 500) {
    formatTextCache.clear();
  }
  formatTextCache.set(cacheKey, result);
  return result;
};

interface SmoothStreamingTextProps {
  text: string;
  isStreaming: boolean;
  baseSize?: number;
}

const SmoothStreamingText: React.FC<SmoothStreamingTextProps> = React.memo(({ text, isStreaming, baseSize = 13 }) => {
  return (
    <span>
      {formatText(text, baseSize)}
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 ml-1 bg-current opacity-70 rounded-xs animate-pulse align-middle" />
      )}
    </span>
  );
});

export function stripUserPuppeting(rawText: string, currentPersonaName?: string): string {
  if (!rawText) return rawText;
  
  const userNames = ['user', 'you', 'player', '{{user}}'];
  if (currentPersonaName && currentPersonaName.trim()) {
    userNames.push(currentPersonaName.trim().toLowerCase());
  }

  const lines = rawText.split('\n');
  const sanitizedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if line is dialogue authored for the user persona
    const nameColonMatch = trimmed.match(/^([A-Za-z0-9_\- ]{1,30}):\s*(.*)$/);
    if (nameColonMatch) {
      const speaker = nameColonMatch[1].trim().toLowerCase();
      if (userNames.includes(speaker) || speaker === '{{user}}') {
        break; // Stop taking any more lines if model attempts to speak as user
      }
    }

    // Check if line is action written for the user
    if (trimmed.match(/^\*(you|your persona|user)\s+(say|says|reply|replies|answer|answers|nod|nods|look|looks|smile|smiles|whisper|whispers|ask|asks|feel|feels|decide|decides|walk|walks|grab|grabs|reach|reaches|sigh|sighs)/i)) {
      break;
    }

    sanitizedLines.push(line);
  }

  const result = sanitizedLines.join('\n').trim();
  return result || rawText;
}

interface LiveWallpaperLayerProps {
  wallpaperUrl: string;
  isPerfMode?: boolean;
}

const LiveWallpaperLayer: React.FC<LiveWallpaperLayerProps> = React.memo(({ wallpaperUrl, isPerfMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [panDistance, setPanDistance] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(65);
  const [canPan, setCanPan] = useState<boolean>(false);

  useEffect(() => {
    if (!wallpaperUrl) return;
    const img = typeof window !== 'undefined' ? new window.Image() : null;
    if (!img) return;
    img.src = wallpaperUrl;

    const measure = () => {
      if (!containerRef.current) return;
      const cWidth = containerRef.current.clientWidth;
      const cHeight = containerRef.current.clientHeight;
      if (!cWidth || !cHeight) return;

      const natW = img.naturalWidth || 1920;
      const natH = img.naturalHeight || 1080;
      const imgAspect = natW / natH;
      const containerAspect = cWidth / cHeight;

      if (imgAspect > containerAspect) {
        // Landscape image on portrait/narrow container: height fits 100%, width expands naturally
        const renderedWidth = cHeight * imgAspect;
        const diff = renderedWidth - cWidth;
        if (diff > 8) {
          setPanDistance(diff);
          // Scale duration based on travel distance for an ultra-smooth, slow cinematic glide
          const dynamicDuration = Math.max(50, Math.min(90, 48 + diff / 15));
          setDurationSec(dynamicDuration);
          setCanPan(true);
          return;
        }
      }
      setPanDistance(0);
      setCanPan(false);
    };

    if (img.complete && img.naturalWidth > 0) {
      measure();
    } else {
      img.onload = measure;
    }

    const ro = new ResizeObserver(() => measure());
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    return () => ro.disconnect();
  }, [wallpaperUrl]);

  if (!wallpaperUrl || typeof wallpaperUrl !== 'string' || wallpaperUrl.trim() === '') {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
      style={{
        containerType: 'inline-size'
      }}
    >
      <img
        key={wallpaperUrl}
        src={wallpaperUrl}
        alt="World Wallpaper"
        className={`absolute top-0 bottom-0 h-full w-auto max-w-none min-w-full pointer-events-none select-none ${
          isPerfMode || !canPan ? 'left-1/2 -translate-x-1/2 object-cover' : 'left-0 animate-liveWallpaperPan'
        }`}
        style={{
          ['--max-pan' as any]: `-${panDistance}px`,
          ['--pan-duration' as any]: `${durationSec}s`,
          willChange: isPerfMode || !canPan ? 'auto' : 'transform'
        }}
      />
      {/* Subtle soft-focus overlay to keep background artwork visible yet non-distracting */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/80 pointer-events-none" />
    </div>
  );
});

interface ChatMessageListProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleContainerScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleTouchStart: (e: React.TouchEvent | React.PointerEvent) => void;
  handleTouchMove: (e: React.TouchEvent | React.PointerEvent) => void;
  messages: ChatMessage[];
  linkedWorld: any;
  isZeroCharactersMode: boolean;
  currentPersonaName: string;
  allCompanions: any[];
  characterName: string;
  persona: any;
  activeUserPersona: any;
  chatLayout: string;
  isLight: boolean;
  userBubbleStyle: string;
  aiBubbleStyle: string;
  selectedMessageForMenu: ChatMessage | null;
  handleMessageClick: (msg: ChatMessage) => void;
  storageConfig: any;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  triggerToast: (msg: string) => void;
  triggerHaptic?: () => void;
  activeHistoryId: string | null;
  historyId: string | null | undefined;
  setActiveHistoryId: (id: string) => void;
  onSaveHistory: any;
  handleRetryMessage: (msgId: string) => void;
  isStreaming: boolean;
  parsedWorldMessagesCacheRef: React.MutableRefObject<Map<string, any>>;
  lastHistoryIdRef: React.MutableRefObject<string | null | undefined>;
}

const ChatMessageList: React.FC<ChatMessageListProps> = React.memo(({
  scrollContainerRef,
  messagesEndRef,
  handleContainerScroll,
  handleTouchStart,
  handleTouchMove,
  messages,
  linkedWorld,
  isZeroCharactersMode,
  currentPersonaName,
  allCompanions,
  characterName,
  persona,
  activeUserPersona,
  chatLayout,
  isLight,
  userBubbleStyle,
  aiBubbleStyle,
  selectedMessageForMenu,
  handleMessageClick,
  storageConfig,
  editingMessageId,
  setEditingMessageId,
  setMessages,
  triggerToast,
  triggerHaptic = () => {},
  activeHistoryId,
  historyId,
  setActiveHistoryId,
  onSaveHistory,
  handleRetryMessage,
  isStreaming,
  parsedWorldMessagesCacheRef,
  lastHistoryIdRef,
}) => {
  return (
    <div 
      ref={scrollContainerRef} 
      onScroll={handleContainerScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onPointerDown={handleTouchStart}
      onPointerMove={handleTouchMove}
      className="flex-1 p-5 space-y-4 overflow-y-auto flex flex-col"
      style={{ willChange: 'scroll-position', transform: 'translateZ(0)' }}
    >
      {(() => {
        const list: React.ReactNode[] = [];
        let lastTimeMs = 0;
        messages.forEach((msg, idx) => {
          const currentTimeMs = getMessageTimeMs(msg.id);
          const showDivider = idx === 0 || (currentTimeMs - lastTimeMs > 86400000);
          if (showDivider) {
            list.push(
              <div key={`divider-${msg.id}`} className="w-full flex items-center justify-center my-4 opacity-60 select-none flex-shrink-0">
                <div className="h-[1px] bg-white/[0.08] flex-1" />
                <span className="text-[9.5px] font-mono tracking-wider text-white/45 uppercase px-3.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.04] mx-3">
                  {formatRelativeDate(currentTimeMs)}
                </span>
                <div className="h-[1px] bg-white/[0.08] flex-1" />
              </div>
            );
          }
          lastTimeMs = currentTimeMs;

          const isUser = msg.role === 'user';
          const isMultiCharacterWorld = linkedWorld && !isZeroCharactersMode;

          if (msg.isStreaming && (!msg.text || !msg.text.trim())) {
            return;
          }

          if (isMultiCharacterWorld) {
            let msgText = msg.text || '';
            if (isUser && !msgText.includes(':') && !msgText.startsWith('*') && !msgText.startsWith('"') && !msgText.startsWith('“')) {
              msgText = `${currentPersonaName}: ${msgText}`;
            }

            const cacheKey = `${msg.id}_${msgText}_${allCompanions.length}`;
            let segments = parsedWorldMessagesCacheRef.current.get(cacheKey);
            if (!segments) {
              segments = parseWorldMessage(msgText, allCompanions, isUser ? currentPersonaName : characterName);
              if (parsedWorldMessagesCacheRef.current.size > 300) {
                parsedWorldMessagesCacheRef.current.clear();
              }
              parsedWorldMessagesCacheRef.current.set(cacheKey, segments);
            }

            segments.forEach((segment: any, sIdx: number) => {
              const key = `${msg.id}-${segment.id}`;
              const isDialogue = segment.type === 'dialogue';
              const isUserDialogue = isDialogue && (segment.characterName === currentPersonaName);

              let segmentCharName = segment.characterName || (isUser ? currentPersonaName : characterName);
              let segmentAvatar = segment.character?.avatar || (segment.characterName === characterName ? persona.avatar : (segment.characterName === currentPersonaName ? activeUserPersona?.avatar : null));
              let segmentEmoji = segment.character?.avatarEmoji || (segment.characterName === characterName ? persona.avatarEmoji : (segment.characterName === currentPersonaName ? '👤' : '👥'));
              let segmentGradient = segment.character?.avatarGradient || (segment.characterName === characterName ? persona.avatarGradient : (segment.characterName === currentPersonaName ? (activeUserPersona?.avatarGradient || 'from-zinc-500 to-zinc-700') : 'from-indigo-500 to-purple-600'));

              list.push(
                <div
                  key={key}
                  className={`flex flex-col relative z-10 ${
                    !isDialogue
                      ? 'max-w-[95%] w-full self-center items-center px-4 md:px-12'
                      : isUserDialogue
                        ? 'max-w-[85%] sm:max-w-[75%] self-end items-end'
                        : 'max-w-[85%] sm:max-w-[75%] self-start items-start'
                  } ${chatLayout === 'compact' ? 'mb-2.5' : 'mb-4'}`}
                >
                  {/* Dialogue Profile Row */}
                  {isDialogue && (
                    <div className={`relative z-30 flex items-center gap-1.5 mb-1.5 h-6 min-h-[24px] flex-shrink-0 ${isUserDialogue ? 'flex-row-reverse mr-1' : 'flex-row ml-1'} select-none`}>
                      {(segment.character || segment.characterName === characterName || segment.characterName === currentPersonaName) ? (
                        segmentAvatar ? (
                          <SafeImage 
                            src={segmentAvatar} 
                            referrerPolicy="no-referrer" 
                            className={`w-5 h-5 rounded-[6px] object-cover border select-none shadow-sm relative z-30 ${isLight ? 'border-black/10' : 'border-white/10'}`} 
                            alt={segmentCharName}
                          />
                        ) : (
                          <div className={`w-5 h-5 rounded-[6px] bg-gradient-to-br ${segmentGradient} border flex items-center justify-center text-[9px] font-bold select-none shadow-sm relative z-30 ${isLight ? 'border-black/10 text-white' : 'border-white/10 text-white/90'}`}>
                            {segmentEmoji || segmentCharName.charAt(0).toUpperCase()}
                          </div>
                        )
                      ) : null}
                      <span className={`text-[10.5px] font-sans font-bold tracking-wide relative z-30 ${isLight ? 'text-black/80' : 'text-white/90'}`}>
                        {segmentCharName}
                      </span>
                    </div>
                  )}

                  {/* Bubble styling */}
                  <div
                    onClick={() => handleMessageClick(msg)}
                    className={`leading-relaxed tracking-wide relative font-sans font-normal select-none text-xs ${
                      !isDialogue
                        ? `shadow-none text-center bg-transparent border-0 ${isLight ? 'text-black/50' : 'text-white/45'} italic w-full p-2.5 sm:p-3 text-[12px] sm:text-[13px] leading-relaxed max-w-[800px] mx-auto font-sans cursor-default`
                        : `shadow-md text-left cursor-pointer transition-all duration-200 ${
                            chatLayout === 'compact' ? 'p-2.5 px-3 rounded-[14px]' : 'p-3 px-3.5 rounded-[16px]'
                          } ${isUserDialogue ? userBubbleStyle : aiBubbleStyle} ${chatLayout === 'compact' ? (isUserDialogue ? 'rounded-tr-[2px]' : 'rounded-tl-[2px]') : (isUserDialogue ? 'rounded-tr-[4px]' : 'rounded-tl-[4px]')}`
                    } ${
                      selectedMessageForMenu?.id === msg.id ? 'opacity-85 brightness-110' : ''
                    }`}
                  >
                      {msg.isPinned && sIdx === 0 && (
                        <div className="absolute top-1.5 right-2 opacity-80 animate-pulse scale-90" title="Pinned to Memory">
                          <Pin className="w-2.5 h-2.5 text-white fill-amber-400" />
                        </div>
                      )}
                      {msg.image && sIdx === 0 && (
                        <div className="mb-2 max-w-full rounded-lg overflow-hidden border border-white/10 shadow-sm">
                          <SafeImage src={msg.image} alt="Uploaded attachment" className="w-full max-h-60 object-cover rounded-lg" />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words font-sans" style={{ fontSize: `${storageConfig?.messageTextSize || 13}px` }}>
                        {editingMessageId === msg.id ? (
                          <InlineMessageEditor
                            initialText={msg.text || ''}
                            onCancel={() => setEditingMessageId(null)}
                            onSave={(newText) => {
                              setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, text: newText } : m));
                              setEditingMessageId(null);
                              triggerToast("Message updated");
                            }}
                            onRewindAndSave={(newText) => {
                              const edited = messages.map(m => m.id === msg.id ? { ...m, text: newText } : m);
                              const msgIndex = edited.findIndex(m => m.id === msg.id);
                              if (msgIndex !== -1) {
                                const rewinded = edited.slice(0, msgIndex + 1);
                                setMessages(rewinded);
                                const targetHistoryId = activeHistoryId || historyId || `chat-${Date.now()}`;
                                if (!activeHistoryId) setActiveHistoryId(targetHistoryId);
                                lastHistoryIdRef.current = targetHistoryId;
                                onSaveHistory(targetHistoryId, rewinded, newText, persona.id);
                                triggerToast("Rewound conversation & updated message");
                              } else {
                                setMessages(edited);
                              }
                              setEditingMessageId(null);
                            }}
                          />
                        ) : (
                          <SmoothStreamingText text={segment.text} isStreaming={Boolean(msg.isStreaming && sIdx === segments.length - 1)} />
                        )}
                      </div>
                    </div>

                    {/* Retry & Alternatives controls for AI messages */}
                    {sIdx === segments.length - 1 && !msg.isStreaming && msg.id === messages[messages.length - 1]?.id && (
                      <div className="flex items-center gap-2 mt-1.5 px-1.5 text-[10px] text-white/40">
                        {msg.alternatives && msg.alternatives.length > 1 && (
                          <div className="flex items-center bg-white/[0.04] border border-white/[0.06] rounded-full p-0.5 gap-1 shadow-inner">
                            {msg.alternatives.map((_, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  triggerHaptic();
                                  setMessages(prev => prev.map(m => m.id === msg.id ? {
                                    ...m,
                                    text: m.alternatives?.[idx] || '',
                                    activeAlternativeIndex: idx
                                  } : m));
                                }}
                                className={`w-4 h-4 rounded-full text-[8.5px] font-mono flex items-center justify-center transition-all cursor-pointer ${
                                  (msg.activeAlternativeIndex || 0) === idx
                                    ? 'bg-white text-black font-bold scale-105 shadow-sm'
                                    : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
                                }`}
                                title={`Switch to version ${idx + 1}`}
                              >
                                {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}

                        {msg.id === messages[messages.length - 1]?.id && msg.id !== 'welcome-msg' && (
                          <button
                            type="button"
                            onClick={() => handleRetryMessage(msg.id)}
                            disabled={isStreaming}
                            className="flex items-center gap-1 hover:text-white transition-all bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-full px-2.5 py-0.5 active:scale-95 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                            title="Regenerate another response"
                          >
                            <RefreshCw className={`w-2.5 h-2.5 ${isStreaming ? 'animate-spin' : ''}`} />
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
              );
            });
          } else {
            list.push(
              <div
                key={msg.id}
                className={`flex flex-col relative z-10 ${
                  isUser
                    ? 'max-w-[85%] sm:max-w-[75%] self-end items-end'
                    : isZeroCharactersMode
                      ? 'max-w-full w-full self-center items-center px-4 md:px-8'
                      : 'max-w-[85%] sm:max-w-[75%] self-start items-start'
                } ${chatLayout === 'compact' ? 'mb-2.5' : 'mb-4'}`}
              >
                {!isZeroCharactersMode && (
                  <div className={`relative z-30 flex items-center gap-2 mb-1.5 h-6 min-h-[24px] flex-shrink-0 ${isUser ? 'flex-row-reverse mr-1' : 'flex-row ml-1'} select-none`}>
                    {isUser ? (
                      activeUserPersona?.avatar ? (
                        <SafeImage 
                          src={activeUserPersona.avatar} 
                          referrerPolicy="no-referrer" 
                          className={`w-5 h-5 rounded-[6px] object-cover border select-none shadow-sm relative z-30 ${isLight ? 'border-black/10' : 'border-white/10'}`} 
                          alt={currentPersonaName}
                        />
                      ) : (
                        <div className={`w-5 h-5 rounded-[6px] bg-gradient-to-br ${activeUserPersona?.avatarGradient || 'from-zinc-500 to-zinc-700'} border flex items-center justify-center text-[9px] text-white font-extrabold select-none shadow-sm relative z-30 ${isLight ? 'border-black/10 text-white' : 'border-white/10 text-white/90'}`}>
                          {currentPersonaName.charAt(0).toUpperCase()}
                        </div>
                      )
                    ) : persona.avatar ? (
                      <SafeImage 
                        src={persona.avatar} 
                        referrerPolicy="no-referrer" 
                        className={`w-5 h-5 rounded-[6px] object-cover border select-none shadow-sm relative z-30 ${isLight ? 'border-black/10' : 'border-white/10'}`} 
                        alt={characterName}
                      />
                    ) : (
                      <div className={`w-5 h-5 rounded-[6px] bg-gradient-to-br ${persona.avatarGradient || 'from-indigo-500 to-purple-600'} border flex items-center justify-center text-[9px] text-white font-extrabold select-none shadow-sm relative z-30 ${isLight ? 'border-black/10 text-white' : 'border-white/10 text-white/90'}`}>
                        {persona.avatarEmoji || characterName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={`text-[10.5px] font-sans font-bold tracking-wide relative z-30 ${isLight ? 'text-black/80' : 'text-white/95'}`}>
                      {isUser ? currentPersonaName : characterName}
                    </span>
                  </div>
                )}

                <div
                  onClick={() => handleMessageClick(msg)}
                  className={`leading-relaxed tracking-wide relative font-sans font-normal select-none text-xs ${
                    isUser
                      ? `shadow-md text-left cursor-pointer transition-all duration-200 ${
                          chatLayout === 'compact' ? 'p-2.5 px-3 rounded-[14px]' : 'p-3 px-3.5 rounded-[16px]'
                        } ${userBubbleStyle} ${chatLayout === 'compact' ? 'rounded-tr-[2px]' : 'rounded-tr-[4px]'}`
                      : isZeroCharactersMode
                        ? `shadow-none text-center bg-transparent border-0 ${isLight ? 'text-black/60' : 'text-white/60'} italic w-full p-2 text-xs max-w-full font-sans cursor-default`
                        : `shadow-md text-left cursor-pointer transition-all duration-200 ${
                            chatLayout === 'compact' ? 'p-2.5 px-3 rounded-[14px]' : 'p-3 px-3.5 rounded-[16px]'
                          } ${aiBubbleStyle} ${chatLayout === 'compact' ? 'rounded-tl-[2px]' : 'rounded-tl-[4px]'}`
                  } ${
                    selectedMessageForMenu?.id === msg.id ? 'opacity-85 brightness-110' : ''
                  }`}
                >
                  {msg.isPinned && (
                    <div className="absolute top-1.5 right-2 opacity-80 animate-pulse scale-90" title="Pinned to Memory">
                      <Pin className="w-2.5 h-2.5 text-white fill-amber-400" />
                    </div>
                  )}
                  {msg.image && (
                    <div className="mb-2 max-w-full rounded-lg overflow-hidden border border-white/10 shadow-sm">
                      <SafeImage src={msg.image} alt="Uploaded attachment" className="w-full max-h-60 object-cover rounded-lg" />
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words font-sans" style={{ fontSize: `${storageConfig?.messageTextSize || 13}px` }}>
                    {editingMessageId === msg.id ? (
                      <InlineMessageEditor
                        initialText={msg.text || ''}
                        onCancel={() => setEditingMessageId(null)}
                        onSave={(newText) => {
                          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, text: newText } : m));
                          setEditingMessageId(null);
                          triggerToast("Message updated");
                        }}
                        onRewindAndSave={(newText) => {
                          const edited = messages.map(m => m.id === msg.id ? { ...m, text: newText } : m);
                          const msgIndex = edited.findIndex(m => m.id === msg.id);
                          if (msgIndex !== -1) {
                            const rewinded = edited.slice(0, msgIndex + 1);
                            setMessages(rewinded);
                            const targetHistoryId = activeHistoryId || historyId || `chat-${Date.now()}`;
                            if (!activeHistoryId) setActiveHistoryId(targetHistoryId);
                            lastHistoryIdRef.current = targetHistoryId;
                            onSaveHistory(targetHistoryId, rewinded, newText, persona.id);
                            triggerToast("Rewound conversation & updated message");
                          } else {
                            setMessages(edited);
                          }
                          setEditingMessageId(null);
                        }}
                      />
                    ) : (
                      (() => {
                        const isWorldWithMultipleCharacters = linkedWorld && (linkedWorld.characters?.length || 0) >= 2;
                        const displayText = msg.text || (
                          msg.isStreaming 
                            ? `*${characterName} is thinking...*` 
                            : `*(No response generated. Please tap Continue or Regenerate to try again.)*`
                        );
                        
                        if (!isWorldWithMultipleCharacters) {
                          return <SmoothStreamingText text={displayText} isStreaming={msg.isStreaming || false} />;
                        }

                        const splitMessage = (text: string) => {
                          const parts = text.split('*');
                          return parts.map((part, index) => ({
                            type: index % 2 === 0 ? 'dialogue' : 'narration',
                            text: part
                          })).filter(segment => segment.text.trim() !== '');
                        };

                        const segments = splitMessage(displayText);
                        
                        return (
                          <div className="flex flex-col gap-2">
                            {segments.map((segment, idx) => {
                              if (segment.type === 'narration') {
                                return (
                                  <div key={idx} className="text-center italic text-white/50 text-[11px] my-1 py-1 px-3 bg-white/[0.03] rounded-lg">
                                    *{segment.text}*
                                  </div>
                                );
                              }
                              return <SmoothStreamingText key={idx} text={segment.text} isStreaming={msg.isStreaming || false} />;
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>

                {!isUser && !msg.isStreaming && msg.id === messages[messages.length - 1]?.id && (
                  <div className="flex items-center gap-2 mt-1.5 px-1.5 text-[10px] text-white/40">
                    {msg.alternatives && msg.alternatives.length > 1 && (
                      <div className="flex items-center bg-white/[0.04] border border-white/[0.06] rounded-full p-0.5 gap-1 shadow-inner">
                        {msg.alternatives.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              triggerHaptic();
                              setMessages(prev => prev.map(m => m.id === msg.id ? {
                                ...m,
                                text: m.alternatives?.[idx] || '',
                                activeAlternativeIndex: idx
                              } : m));
                            }}
                            className={`w-4 h-4 rounded-full text-[8.5px] font-mono flex items-center justify-center transition-all cursor-pointer ${
                              (msg.activeAlternativeIndex || 0) === idx
                                ? 'bg-white text-black font-bold scale-105 shadow-sm'
                                : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
                            }`}
                            title={`Switch to version ${idx + 1}`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.id === messages[messages.length - 1]?.id && msg.id !== 'welcome-msg' && (
                      <button
                        type="button"
                        onClick={() => handleRetryMessage(msg.id)}
                        disabled={isStreaming}
                        className="flex items-center gap-1 hover:text-white transition-all bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-full px-2.5 py-0.5 active:scale-95 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                        title="Regenerate another response"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isStreaming ? 'animate-spin' : ''}`} />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }
        });
        return list;
      })()}
      <div ref={messagesEndRef} />
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.messages === nextProps.messages &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.editingMessageId === nextProps.editingMessageId &&
    prevProps.selectedMessageForMenu?.id === nextProps.selectedMessageForMenu?.id &&
    prevProps.chatLayout === nextProps.chatLayout &&
    prevProps.isLight === nextProps.isLight &&
    prevProps.userBubbleStyle === nextProps.userBubbleStyle &&
    prevProps.aiBubbleStyle === nextProps.aiBubbleStyle &&
    prevProps.currentPersonaName === nextProps.currentPersonaName &&
    prevProps.characterName === nextProps.characterName &&
    prevProps.storageConfig?.messageTextSize === nextProps.storageConfig?.messageTextSize &&
    prevProps.allCompanions?.length === nextProps.allCompanions?.length
  );
});

export const PremiumChatScreen: React.FC<PremiumChatScreenProps> = ({
  persona,
  apiKey,
  historyId,
  initialMessages,
  onBack,
  onSaveHistory,
  isRepliesEnabled = true,
  isHapticEnabled = true,
  storageConfig,
  onToggleLikePersona,
  onDeletePersona,
  onResumeChat,
  onUpdateConfig,
  theme = 'dark',
  onEditPersona,
  initialLinkedWorldId,
}) => {
  if (!persona) return null;
  const isLight = theme === 'light';

  // Track active history ID internally (starts with passed prop, can become new generated id)
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(historyId);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // 1. Initial messages from the selected session in storageConfig is authoritative
    if (initialMessages && initialMessages.length > 0) return initialMessages;
    // 2. If this session has a historyId, check its specific storage
    if (historyId) {
      const sessionSaved = loadCharacterChatFromLocalStorage(historyId);
      if (sessionSaved && sessionSaved.length > 0) return sessionSaved;
    }
    // 3. Fallback for non-session / default persona chat
    if (persona?.id && !historyId) {
      const charSaved = loadCharacterChatFromLocalStorage(persona.id);
      if (charSaved && charSaved.length > 0) return charSaved;
    }
    return [];
  });

  // Automatically restore chat history from localStorage when character or session changes
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      return;
    }
    const currentId = historyId || activeHistoryId;
    if (currentId) {
      const saved = loadCharacterChatFromLocalStorage(currentId);
      if (saved && saved.length > 0) {
        setMessages(saved);
        return;
      }
      return;
    }
    if (persona?.id && !currentId) {
      const saved = loadCharacterChatFromLocalStorage(persona.id);
      if (saved && saved.length > 0) {
        setMessages(saved);
        return;
      }
    }
    setMessages([]);
  }, [persona?.id, historyId]);

  // Save the entire conversation to localStorage debounced to avoid UI lag during streaming/typing
  useEffect(() => {
    const targetSessionId = activeHistoryId || historyId;
    const targetCharId = persona?.id;
    if (!messages || messages.length === 0) return;
    if (!targetSessionId && !targetCharId) return;

    const timer = setTimeout(() => {
      if (targetSessionId) {
        saveCharacterChatToLocalStorage(targetSessionId, messages);
      } else if (targetCharId) {
        saveCharacterChatToLocalStorage(targetCharId, messages);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [messages, activeHistoryId, historyId, persona?.id]);
  const [inputText, setInputText] = useState('');
  const [externalInputText, setExternalInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [viewedCompanionProfile, setViewedCompanionProfile] = useState<any | null>(null);
  const [showWorldProfile, setShowWorldProfile] = useState(false);
  
  // Orb Economy Modals State
  const [showOrbWallet, setShowOrbWallet] = useState(false);
  const [restoreStatusModal, setRestoreStatusModal] = useState<{statKey: string, statLabel: string, currentVal: number} | null>(null);

  // States for the new character.ai styling requirements
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);

  const [selectedChatStyle, setSelectedChatStyle] = useState<'general' | 'adventurous' | 'seductive'>('general');
  const [tempChatStyle, setTempChatStyle] = useState<'general' | 'adventurous' | 'seductive'>('general');
  const [disclaimerExpanded, setDisclaimerExpanded] = useState(false);
  const [storyMemories, setStoryMemories] = useState<string[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);
  const [activeWallpaper, setActiveWallpaper] = useState<'charcoal' | 'cosmic' | 'aurora' | 'neon'>('charcoal');
  const chatLayout = storageConfig?.chatLayout || 'standard';
  const [currentPersonaName, setCurrentPersonaName] = useState("Explorer");
  const [currentPersonaDesc, setCurrentPersonaDesc] = useState("A curious mind looking for immersive, detailed, and authentic conversations.");
  const [activeBentoSubTab, setActiveBentoSubTab] = useState<'none' | 'memory' | 'chatStyle' | 'persona' | 'history' | 'world'>('none');
  const [worldTabSection, setWorldTabSection] = useState<'grid' | 'world' | 'character' | 'communication' | 'actions' | 'rp_tools' | 'chat_tools' | 'world_calendar' | 'world_location' | 'world_weather' | 'world_relationships' | 'world_reputation' | 'world_scenes' | 'char_status' | 'char_activity' | 'char_inventory' | 'char_appearance' | 'char_phone'>('grid');
  const [characterState, setCharacterState] = useState<any>({});

  // Maintain a ref to characterState to bypass React closure stale state issues during streaming
  const characterStateRef = useRef<any>(characterState);
  useEffect(() => {
    characterStateRef.current = characterState;
  }, [characterState]);
  const [isPhoneOpen, setIsPhoneOpen] = useState(false);
  const [typingContactId, setTypingContactId] = useState<string | null>(null);
  const [phoneBlockedReason, setPhoneBlockedReason] = useState<string | null>(null);

  const handleOpenPhone = () => {
    triggerHaptic();
    const phoneData = characterState?.phone || {};
    
    // Dynamic context scanning of recent roleplay messages for hostage, broken, or offline scenarios
    let isHostage = false;
    let isBroken = false;
    let isDeadBattery = false;
    let isUnconscious = false;
    
    // Scan last 15 messages in chronological order for dynamic context tracking and recovery
    const checkMessages = messages.slice(-15);
    for (const msg of checkMessages) {
      const lower = msg.text.toLowerCase();
      
      // 1. Hostage triggers
      if (lower.includes("hostage") || lower.includes("kidnap") || lower.includes("abducted") || lower.includes("tied up") || lower.includes("bound and gagged") || lower.includes("captured")) {
        isHostage = true;
      }
      // Hostage recoveries
      if (lower.includes("escape") || lower.includes("free") || lower.includes("rescue") || lower.includes("save") || lower.includes("unbound") || lower.includes("untie") || lower.includes("unlocked") || lower.includes("released") || lower.includes("access")) {
        isHostage = false;
      }

      // 2. Broken triggers
      if (lower.includes("cracked phone") || lower.includes("phone is cracked") || lower.includes("screen is shattered") || lower.includes("smashed my phone") || lower.includes("phone broke") || lower.includes("broken phone")) {
        isBroken = true;
      }
      // Broken recoveries
      if (lower.includes("fix") || lower.includes("repair") || lower.includes("new phone") || lower.includes("replace") || lower.includes("digitizer") || lower.includes("screen is fixed")) {
        isBroken = false;
      }

      // 3. Battery triggers
      if (lower.includes("no battery") || lower.includes("battery died") || lower.includes("dead battery") || lower.includes("phone died") || lower.includes("power off")) {
        isDeadBattery = true;
      }
      // Battery recoveries
      if (lower.includes("charge") || lower.includes("plugged in") || lower.includes("turned on") || lower.includes("power on") || lower.includes("booted") || lower.includes("alive") || lower.includes("charging")) {
        isDeadBattery = false;
      }

      // 4. Unconscious triggers
      if (lower.includes("unconscious") || lower.includes("coma") || lower.includes("passed out") || lower.includes("knocked out") || lower.includes("deep sleep") || lower.includes("asleep")) {
        isUnconscious = true;
      }
      // Unconscious recoveries
      if (lower.includes("wake up") || lower.includes("woke up") || lower.includes("awake") || lower.includes("conscious") || lower.includes("recovered") || lower.includes("alert")) {
        isUnconscious = false;
      }
    }

    let isAccessible = true;
    let blockedReason = "";

    if (isHostage) {
      isAccessible = false;
      blockedReason = "The device cannot be reached. Active roleplay context indicates your companion has been captured or is being held hostage, preventing physical or wireless device access.";
    } else if (isBroken) {
      isAccessible = false;
      blockedReason = "Connection failed. The device's touchscreen digitizer is shattered, cracked, or completely smashed from active scenario damage, rendering it completely unresponsive.";
    } else if (isDeadBattery) {
      isAccessible = false;
      blockedReason = "Device Offline. The battery has completely drained, or the companion's device has powered off completely.";
    } else if (isUnconscious) {
      isAccessible = false;
      blockedReason = "No response. Your companion is currently unconscious, asleep, or physically incapacitated, making them unable to operate their device.";
    }

    if (!isAccessible) {
      setPhoneBlockedReason(blockedReason);
    } else if (phoneData.isAccessible === false) {
      setPhoneBlockedReason(phoneData.accessBlockedReason || "You cannot access your phone right now. (The device is offline or unavailable).");
    } else {
      setIsPhoneOpen(true);
    }
  };
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const handleRepairChatHistory = () => {
    triggerHaptic();
    if (!messages || messages.length === 0) {
      triggerToast("No messages to repair.");
      return;
    }
    
    // Clean messages: strip any error messages or stuck streaming states
    const cleaned = messages.filter(m => {
      if (!m.text) return false;
      const trimmed = m.text.trim();
      if (trimmed.startsWith('**Error:**') || trimmed.startsWith('Error:') || trimmed.includes('All attempted API Keys')) {
        return false;
      }
      return true;
    }).map(m => ({
      ...m,
      isStreaming: false
    }));

    setMessages(cleaned);
    const targetHistoryId = activeHistoryId || historyId || (persona?.id ? `chat-${persona.id}` : `chat-${Date.now()}`);
    if (!activeHistoryId) setActiveHistoryId(targetHistoryId);
    lastHistoryIdRef.current = targetHistoryId;
    const lastMsgText = cleaned[cleaned.length - 1]?.text || '';
    onSaveHistory(targetHistoryId, cleaned, lastMsgText, persona?.id);
    triggerToast("🛠️ Chat repaired! Corrupted error history cleaned successfully.");
  };

  const handleClearChat = () => {
    triggerHaptic();
    if (window.confirm(`Are you sure you want to clear the entire chat history for ${characterName || 'this character'}? This will delete all saved messages.`)) {
      setMessages([]);
      const targetSessionId = activeHistoryId || historyId;
      if (targetSessionId) {
        clearCharacterChatFromLocalStorage(targetSessionId, persona?.id);
        onSaveHistory(targetSessionId, [], '', persona?.id);
      } else if (persona?.id) {
        clearCharacterChatFromLocalStorage(persona.id);
        onSaveHistory(persona.id, [], '', persona.id);
      }
      triggerToast("🗑️ Chat history cleared!");
    }
  };
  const [diceResult, setDiceResult] = useState<{ type: string; value: number } | null>(null);
  const [activeChatStyle, setActiveChatStyle] = useState<'narrative' | 'descriptive' | 'fast' | 'classic'>('narrative');
  const [activePerspective, setActivePerspective] = useState<'1st' | '3rd'>('1st');
  const [worldCalendarInput, setWorldCalendarInput] = useState(() => getRealWorldDefaultCalendar());
  const [worldLocationInput, setWorldLocationInput] = useState("Grand Citadel - Lower Courtyard");
  const [worldWeatherInput, setWorldWeatherInput] = useState("Clear skies, gentle breeze");
  const [worldReputationInput, setWorldReputationInput] = useState("Honored Guest (7/10)");
  const [worldSceneMood, setWorldSceneMood] = useState("Calm");
  const [selectedRelCharId, setSelectedRelCharId] = useState<string | null>(null);

  // Action Time Picker State
  const [pendingActionModal, setPendingActionModal] = useState<{
    title: string;
    category: string;
    promptTemplate?: string;
  } | null>(null);
  const [selectedDurationOption, setSelectedDurationOption] = useState<string>('2 Hours');
  const [customDurationInput, setCustomDurationInput] = useState<string>('');

  // Chat Tools Modals State
  const [activeChatToolModal, setActiveChatToolModal] = useState<'pinned' | 'memories' | 'switch_persona' | 'sessions' | null>(null);
  const [newMemoryText, setNewMemoryText] = useState<string>('');

  const [charRelScores, setCharRelScores] = useState<Record<string, {
    attraction: number;
    friendship: number;
    trust: number;
    respect: number;
    loyalty: number;
    fear: number;
    anger: number;
    rivalry: number;
    lust: number;
  }>>({});
  const [showCreatePersonaForm, setShowCreatePersonaForm] = useState(false);
  const [activeMemorySegment, setActiveMemorySegment] = useState<'story' | 'companion' | 'you'>('story');
  const [storyInputText, setStoryInputText] = useState("");
  const [showStoryInputPopup, setShowStoryInputPopup] = useState(false);
  const [selectedMessageForMenu, setSelectedMessageForMenu] = useState<ChatMessage | null>(null);
  const [showEditModalForMessage, setShowEditModalForMessage] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [showSuggestedAnswers, setShowSuggestedAnswers] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showManualOverrideModal, setShowManualOverrideModal] = useState(false);
  const [isBranchingLoading, setIsBranchingLoading] = useState(false);

  // Long-Term Situation Modal State
  const [showSituationModal, setShowSituationModal] = useState(false);
  const [editingSituationIndex, setEditingSituationIndex] = useState<number | null>(null);
  const [situationForm, setSituationForm] = useState<{
    title: string;
    description: string;
    type: string;
    severity: string;
    duration: string;
  }>({
    title: '',
    description: '',
    type: 'physical',
    severity: 'Mild',
    duration: 'Ongoing',
  });

  // Pregnancy Settings Modal State
  const [showPregnancyModal, setShowPregnancyModal] = useState(false);
  const [pregnancyForm, setPregnancyForm] = useState<{
    status: string;
    weeks: number;
    father: string;
    symptoms: string[];
    protectionUsed: string;
    notes: string;
  }>({
    status: 'Not Pregnant',
    weeks: 0,
    father: 'User',
    symptoms: [],
    protectionUsed: 'None',
    notes: '',
  });
  const [customSymptomInput, setCustomSymptomInput] = useState('');

  // Item on Person Modal State
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState<{
    name: string;
    location: string;
    quantity: number;
    equipped: boolean;
    description: string;
  }>({
    name: '',
    location: 'Right Pocket',
    quantity: 1,
    equipped: false,
    description: '',
  });

  // Money Editing State
  const [showMoneyModal, setShowMoneyModal] = useState(false);
  const [moneyInput, setMoneyInput] = useState<number>(250);
  const audio1Ref = useRef<HTMLAudioElement | null>(null);
  const audio2Ref = useRef<HTMLAudioElement | null>(null);
  const activeAudioSelectorRef = useRef<1 | 2>(1);
  const fadeIntervalRef = useRef<any>(null);
  const lastHistoryIdRef = useRef<string | null | undefined>(historyId || undefined);
  const hasInitializedRef = useRef(false);

  // Active chat session linkage state
  const targetHistoryId = activeHistoryId || historyId || lastHistoryIdRef.current || null;
  const activeSession = targetHistoryId ? (storageConfig?.chatHistories || []).find(h => h.id === targetHistoryId) : null;
  const linkedWorldId = activeSession?.linkedWorldId || initialLinkedWorldId;
  const enableSceneDetection = activeSession?.enableSceneDetection ?? true;
  const rawLinkedWorld = linkedWorldId ? (storageConfig?.worlds || []).find(w => w.id === linkedWorldId) : null;

  // Session-specific linked characters override
  const sessionLinkedCharIds = useMemo(() => {
    if (activeSession?.linkedCharacterIds !== undefined) {
      return activeSession.linkedCharacterIds;
    }
    return rawLinkedWorld?.linkedCharacterIds || [];
  }, [activeSession?.linkedCharacterIds, rawLinkedWorld?.linkedCharacterIds]);

  const linkedWorld = useMemo(() => {
    if (!rawLinkedWorld) return null;
    return {
      ...rawLinkedWorld,
      linkedCharacterIds: sessionLinkedCharIds
    };
  }, [rawLinkedWorld, sessionLinkedCharIds]);

  const [showSessionCastModal, setShowSessionCastModal] = useState(false);
  const [castSearchQuery, setCastSearchQuery] = useState('');
  const [castAlsoSaveToWorld, setCastAlsoSaveToWorld] = useState(false);

  const handleToggleCharacterInSession = (charId: string) => {
    const currentList = sessionLinkedCharIds;
    let nextList: string[];
    if (currentList.includes(charId)) {
      nextList = currentList.filter(id => id !== charId);
    } else {
      nextList = [...currentList, charId];
    }
    const { session, histories } = ensureSessionAndGetId();
    const updatedHistories = histories.map(h => {
      if (h.id === session.id) {
        return { ...h, linkedCharacterIds: nextList };
      }
      // Ensure all other historical sessions have their own cast snapshotted so world changes never affect them
      if (h.linkedCharacterIds === undefined) {
        if (h.linkedWorldId) {
          const w = (storageConfig?.worlds || []).find(x => x.id === h.linkedWorldId);
          return { ...h, linkedCharacterIds: w?.linkedCharacterIds ? [...w.linkedCharacterIds] : [] };
        } else if (h.personaId && !h.personaId.startsWith('world-')) {
          return { ...h, linkedCharacterIds: [h.personaId] };
        }
      }
      return h;
    });
    let updatedWorlds = storageConfig?.worlds;
    if (castAlsoSaveToWorld && linkedWorldId && updatedWorlds) {
      updatedWorlds = updatedWorlds.map(w => w.id === linkedWorldId ? { ...w, linkedCharacterIds: nextList } : w);
    }
    if (onUpdateConfig) {
      onUpdateConfig({
        chatHistories: updatedHistories,
        ...(castAlsoSaveToWorld && updatedWorlds ? { worlds: updatedWorlds } : {})
      });
    }
    triggerHaptic();
  };

  // Helper to ensure target session exists in chatHistories before updating
  const ensureSessionAndGetId = React.useCallback((): { targetId: string; histories: ChatHistory[]; session: ChatHistory } => {
    let targetId = activeHistoryId || historyId || lastHistoryIdRef.current;
    if (!targetId) {
      targetId = `chat-${Date.now()}`;
      setActiveHistoryId(targetId);
      lastHistoryIdRef.current = targetId;
    } else if (!activeHistoryId) {
      setActiveHistoryId(targetId);
      lastHistoryIdRef.current = targetId;
    }

    const currentHistories = storageConfig?.chatHistories || [];
    let session = currentHistories.find(h => h.id === targetId);

    if (!session) {
      const allComps = [...PERSONAS, ...(storageConfig?.characters || [])];
      const p = persona || allComps[0];
      let pLinkedWorldId = initialLinkedWorldId;
      if (!pLinkedWorldId && p.id && p.id.startsWith('world-')) {
        pLinkedWorldId = p.id.replace('world-', '');
      }
      const matchedWorld = pLinkedWorldId ? (storageConfig?.worlds || []).find(w => w.id === pLinkedWorldId) : null;
      const startingPlace = matchedWorld?.places?.[0]?.name || 'General';
      const startingAmbient = matchedWorld?.ambientSounds?.[0]?.name || 'General';
      session = {
        id: targetId,
        personaId: p.id,
        personaName: p.name,
        avatarGradient: p.avatarGradient || 'from-zinc-500 to-zinc-600',
        linkedWorldId: pLinkedWorldId || undefined,
        linkedCharacterIds: matchedWorld?.linkedCharacterIds ? [...matchedWorld.linkedCharacterIds] : (p.id && !p.id.startsWith('world-') ? [p.id] : []),
        lastMessage: messages.length > 0 ? messages[messages.length - 1].text : '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        updatedAt: Date.now(),
        messages: messages || [],
        activePlaceName: startingPlace,
        activeAmbientName: startingAmbient,
        isAmbientMuted: false,
        isArchived: false,
      };
    }
    return { targetId, histories: currentHistories, session };
  }, [activeHistoryId, historyId, storageConfig?.chatHistories, persona, initialLinkedWorldId, messages, storageConfig?.characters, storageConfig?.worlds]);

  const activeTargetCharacter = React.useMemo(() => {
    if (persona && persona.id && !persona.id.startsWith('world-')) {
      return persona;
    }
    if (linkedWorld && linkedWorld.linkedCharacterIds && linkedWorld.linkedCharacterIds.length > 0) {
      const allKnown = [...PERSONAS, ...(storageConfig?.characters || [])];
      const found = allKnown.find(c => linkedWorld.linkedCharacterIds?.includes(c.id) && !c.id.startsWith('world-'));
      if (found) return found;
    }
    return persona;
  }, [persona, linkedWorld, storageConfig?.characters]);

  const activeUserPersona = React.useMemo(() => {
    if (!storageConfig?.userPersonas) return null;
    const upid = activeSession && 'userPersonaId' in activeSession ? (activeSession as any).userPersonaId : storageConfig.activeUserPersonaId;
    return storageConfig.userPersonas.find(p => p.id === upid) || null;
  }, [storageConfig?.userPersonas, activeSession, storageConfig?.activeUserPersonaId]);

  // Trigger haptic feedback
  const triggerHaptic = React.useCallback(() => {
    if (isHapticEnabled && typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  }, [isHapticEnabled]);

  // Scroll & Touch gestures protection to prevent message options modal from opening on scroll
  const isScrollingRef = useRef(false);
  const lastScrollTimeRef = useRef(0);
  const scrollTimeoutRef = useRef<any>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const hasTouchMovedRef = useRef(false);
  const parsedWorldMessagesCacheRef = useRef<Map<string, ParsedSegment[]>>(new Map());

  const handleContainerScroll = React.useCallback(() => {
    isScrollingRef.current = true;
    lastScrollTimeRef.current = Date.now();
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 200);
  }, []);

  const handleTouchStart = React.useCallback((e: React.TouchEvent | React.PointerEvent) => {
    const touch = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.PointerEvent);
    if (touch) {
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }
    hasTouchMovedRef.current = false;
  }, []);

  const handleTouchMove = React.useCallback((e: React.TouchEvent | React.PointerEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.PointerEvent);
    if (touch) {
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      if (dx > 6 || dy > 6) {
        hasTouchMovedRef.current = true;
      }
    }
  }, []);

  const handleMessageClick = React.useCallback((msg: ChatMessage) => {
    const now = Date.now();
    if (isScrollingRef.current || (now - lastScrollTimeRef.current < 250) || hasTouchMovedRef.current) {
      hasTouchMovedRef.current = false;
      return;
    }
    triggerHaptic();
    setSelectedMessageForMenu(msg);
  }, [triggerHaptic]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!audio1Ref.current) {
        audio1Ref.current = new Audio();
        audio1Ref.current.onerror = (e) => {
          console.warn("Audio 1 loading/playback error:", e);
        };
      }
      if (!audio2Ref.current) {
        audio2Ref.current = new Audio();
        audio2Ref.current.onerror = (e) => {
          console.warn("Audio 2 loading/playback error:", e);
        };
      }
    }
  }, []);

  const activePlaceName = activeSession?.activePlaceName || 'General';
  const activeAmbientName = activeSession?.activeAmbientName || 'General';
  const isAmbientMuted = activeSession?.isAmbientMuted ?? false;
  const customWallpaper = activeSession?.customWallpaper || null;

  // Keep location input in sync with activePlaceName
  useEffect(() => {
    if (activePlaceName && activePlaceName !== 'General') {
      setWorldLocationInput(activePlaceName);
    }
  }, [activePlaceName]);

  const currentPlace = linkedWorld?.places?.find(p => p.name.toLowerCase() === activePlaceName.toLowerCase()) || 
                       (activePlaceName.toLowerCase() === 'general' ? undefined : linkedWorld?.places?.[0]);

  const activeAmbientSound = linkedWorld?.ambientSounds?.find(s => s.name.toLowerCase() === activeAmbientName.toLowerCase()) ||
                             (activeAmbientName.toLowerCase() === 'general' ? undefined : linkedWorld?.ambientSounds?.[0]);

  const resolveWorldPlace = (rawPlace: string | null | undefined): string => {
    if (!rawPlace || rawPlace === 'no_change' || rawPlace === 'General') return 'General';
    if (!linkedWorld || !linkedWorld.places || linkedWorld.places.length === 0) return rawPlace;
    const q = rawPlace.toLowerCase().trim();
    // 1. Exact match
    const exact = linkedWorld.places.find((p: any) => p.name.toLowerCase().trim() === q);
    if (exact) return exact.name;
    // 2. Partial match
    const partial = linkedWorld.places.find((p: any) => 
      p.name.toLowerCase().includes(q) || (q.length > 2 && q.includes(p.name.toLowerCase()))
    );
    if (partial) return partial.name;
    return rawPlace;
  };

  const activeWallpaperBgUrlRaw = useMemo(() => {
    return resolveWallpaper(customWallpaper, activePlaceName, worldLocationInput, linkedWorld, persona);
  }, [customWallpaper, activePlaceName, worldLocationInput, linkedWorld, persona]);

  const activeWallpaperBgUrl = useAsset(activeWallpaperBgUrlRaw);

  const [displayedWallpaperUrl, setDisplayedWallpaperUrl] = useState<string | null>(activeWallpaperBgUrl);
  const [isBlackFadeActive, setIsBlackFadeActive] = useState<boolean>(false);
  const prevWallpaperRef = useRef<string | null>(activeWallpaperBgUrl);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (activeWallpaperBgUrl === prevWallpaperRef.current) return;
    
    // Initial mount or first asset resolution
    if (prevWallpaperRef.current === null && activeWallpaperBgUrl) {
      prevWallpaperRef.current = activeWallpaperBgUrl;
      setDisplayedWallpaperUrl(activeWallpaperBgUrl);
      return;
    }

    // Place / scene is switching:
    // 1. Immediately start fading to solid black so the next wallpaper is never visible beforehand
    setIsBlackFadeActive(true);

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // 2. Once solid black has completely obscured the screen, swap the wallpaper underneath
    transitionTimeoutRef.current = setTimeout(() => {
      setDisplayedWallpaperUrl(activeWallpaperBgUrl);
      prevWallpaperRef.current = activeWallpaperBgUrl;

      // 3. Fade out from solid black, smoothly unveiling the new place wallpaper
      transitionTimeoutRef.current = setTimeout(() => {
        setIsBlackFadeActive(false);
      }, 50);
    }, 280);

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [activeWallpaperBgUrl]);

  const handleSetCustomWallpaper = (wallpaperUrl: string | null) => {
    if (onUpdateConfig && storageConfig) {
      const { targetId, histories, session } = ensureSessionAndGetId();
      const updatedSession: ChatHistory = {
        ...session,
        customWallpaper: wallpaperUrl || undefined,
        updatedAt: Date.now(),
      };
      const existingIdx = histories.findIndex(h => h.id === targetId);
      let updatedHistories: ChatHistory[];
      if (existingIdx >= 0) {
        updatedHistories = histories.map(h => h.id === targetId ? updatedSession : h);
      } else {
        updatedHistories = [updatedSession, ...histories];
      }
      onUpdateConfig({ chatHistories: updatedHistories });
      triggerToast(wallpaperUrl ? "Wallpaper updated!" : "Wallpaper auto-synced with location");
    }
  };

  const handleUploadCustomWallpaper = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        try {
          const assetId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const dbRef = await storeAsset(assetId, result);
          handleSetCustomWallpaper(dbRef);
        } catch (err) {
          handleSetCustomWallpaper(result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Ambient loop Crossfade Effect
  useEffect(() => {
    const rawTargetSrc = (!isAmbientMuted && activeAmbientSound?.audioFile) 
      ? (activeAmbientSound.audioFile || null) 
      : null;

    const fadeTimeMs = 1500; // 1.5s crossfade
    const intervalMs = 50;
    const steps = fadeTimeMs / intervalMs;
    const targetMaxVolume = 0.25;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    const currentActiveSelector = activeAudioSelectorRef.current;
    const activeAudio = currentActiveSelector === 1 ? audio1Ref.current : audio2Ref.current;
    const inactiveAudio = currentActiveSelector === 1 ? audio2Ref.current : audio1Ref.current;

    if (!rawTargetSrc) {
      if (activeAudio) {
        let currentStep = 0;
        const initialVol = activeAudio.volume;
        fadeIntervalRef.current = setInterval(() => {
          currentStep++;
          const newVol = Math.max(0, initialVol * (1 - currentStep / steps));
          activeAudio.volume = newVol;
          if (currentStep >= steps) {
            activeAudio.pause();
            activeAudio.src = '';
            if (fadeIntervalRef.current) {
              clearInterval(fadeIntervalRef.current);
              fadeIntervalRef.current = null;
            }
          }
        }, intervalMs);
      }
      return;
    }

    const applyAudio = async () => {
      const targetAudioSrc = await getAsset(rawTargetSrc);
      if (!targetAudioSrc || targetAudioSrc.startsWith('db:')) return;
      
      // If src changed while we were waiting for getAsset, abort
      const updatedRawTargetSrc = (!isAmbientMuted && activeAmbientSound?.audioFile) 
        ? (activeAmbientSound.audioFile || null) 
        : null;
      if (rawTargetSrc !== updatedRawTargetSrc) return;

      if (activeAudio && activeAudio.src === targetAudioSrc) {
        if (activeAudio.paused) {
          activeAudio.play().catch(e => {
            if (e.name !== 'AbortError') console.log("Ambient autoplay blocked:", e);
          });
        }
        let currentStep = 0;
        const initialVol = activeAudio.volume;
        fadeIntervalRef.current = setInterval(() => {
          currentStep++;
          const ratio = currentStep / steps;
          activeAudio.volume = initialVol + (targetMaxVolume - initialVol) * ratio;
          if (currentStep >= steps) {
            activeAudio.volume = targetMaxVolume;
            if (fadeIntervalRef.current) {
              clearInterval(fadeIntervalRef.current);
              fadeIntervalRef.current = null;
            }
          }
        }, intervalMs);
        return;
      }
  
      if (inactiveAudio) {
        inactiveAudio.src = targetAudioSrc;
        inactiveAudio.loop = true;
        inactiveAudio.volume = 0;
        inactiveAudio.play().then(() => {
          let currentStep = 0;
          const startActiveVol = activeAudio ? activeAudio.volume : 0;
          
          fadeIntervalRef.current = setInterval(() => {
            currentStep++;
            const ratio = currentStep / steps;
            inactiveAudio.volume = targetMaxVolume * ratio;
            if (activeAudio) {
              activeAudio.volume = Math.max(0, startActiveVol * (1 - ratio));
            }
            
            if (currentStep >= steps) {
              inactiveAudio.volume = targetMaxVolume;
              if (activeAudio) {
                activeAudio.pause();
                activeAudio.src = '';
              }
              activeAudioSelectorRef.current = currentActiveSelector === 1 ? 2 : 1;
              
              if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
              }
            }
          }, intervalMs);
        }).catch(err => {
          if (err.name !== 'AbortError') {
            console.error("Failed to start crossfading audio:", err);
          }
        });
      }
    };
    
    applyAudio();
  }, [activeAmbientSound?.audioFile, isAmbientMuted, linkedWorldId]);

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      if (audio1Ref.current) {
        audio1Ref.current.pause();
        audio1Ref.current.src = '';
      }
      if (audio2Ref.current) {
        audio2Ref.current.pause();
        audio2Ref.current.src = '';
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  const handleToggleMute = () => {
    const nextMuted = !isAmbientMuted;
    if (onUpdateConfig && storageConfig) {
      const { targetId, histories, session } = ensureSessionAndGetId();
      const updatedSession: ChatHistory = {
        ...session,
        isAmbientMuted: nextMuted,
        updatedAt: Date.now(),
      };
      const existingIdx = histories.findIndex(h => h.id === targetId);
      let updatedHistories: ChatHistory[];
      if (existingIdx >= 0) {
        updatedHistories = histories.map(h => h.id === targetId ? updatedSession : h);
      } else {
        updatedHistories = [updatedSession, ...histories];
      }
      onUpdateConfig({ chatHistories: updatedHistories });
      triggerToast(nextMuted ? "Ambient sound muted" : "Ambient sound unmuted");
    }
  };

  const handleManualPlaceOverride = (placeName: string) => {
    const resolved = resolveWorldPlace(placeName);
    if (onUpdateConfig && storageConfig) {
      const { targetId, histories, session } = ensureSessionAndGetId();
      const updatedSession: ChatHistory = {
        ...session,
        activePlaceName: resolved,
        customWallpaper: undefined, // Clear custom wallpaper so new place image displays automatically
        updatedAt: Date.now(),
      };
      const existingIdx = histories.findIndex(h => h.id === targetId);
      let updatedHistories: ChatHistory[];
      if (existingIdx >= 0) {
        updatedHistories = histories.map(h => h.id === targetId ? updatedSession : h);
      } else {
        updatedHistories = [updatedSession, ...histories];
      }
      onUpdateConfig({ chatHistories: updatedHistories });
      setWorldLocationInput(resolved);
      triggerToast(`Location manually updated to ${resolved}`);
    }
  };

  const handleManualAmbientOverride = (ambientName: string) => {
    // Attempt to unlock audio elements in the same tick as the user click
    if (audio1Ref.current && audio1Ref.current.paused && audio1Ref.current.src) {
        audio1Ref.current.play().catch(() => {});
    }
    if (audio2Ref.current && audio2Ref.current.paused && audio2Ref.current.src) {
        audio2Ref.current.play().catch(() => {});
    }

    if (onUpdateConfig && storageConfig) {
      const { targetId, histories, session } = ensureSessionAndGetId();
      const updatedSession: ChatHistory = {
        ...session,
        activeAmbientName: ambientName,
        isAmbientMuted: false,
        updatedAt: Date.now(),
      };
      const existingIdx = histories.findIndex(h => h.id === targetId);
      let updatedHistories: ChatHistory[];
      if (existingIdx >= 0) {
        updatedHistories = histories.map(h => h.id === targetId ? updatedSession : h);
      } else {
        updatedHistories = [updatedSession, ...histories];
      }
      onUpdateConfig({ chatHistories: updatedHistories });
      triggerToast(`Ambient track manually updated to ${ambientName}`);
    }
  };

  const statusSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateCharacterState = useCallback((category: string, field: string, value: any) => {
    setCharacterState((prev: any) => {
      const safePrev = prev || {};
      const next = {
        ...safePrev,
        [category]: field ? {
          ...(safePrev[category] || {}),
          [field]: value
        } : value
      };
      
      // Schedule the parent update outside the rendering cycle with debouncing to prevent lag
      if (targetHistoryId && onUpdateConfig && storageConfig) {
        if (statusSaveTimeoutRef.current) clearTimeout(statusSaveTimeoutRef.current);
        statusSaveTimeoutRef.current = setTimeout(() => {
          const updatedHistories = (storageConfig?.chatHistories || []).map(h => 
            h.id === targetHistoryId ? { ...h, characterState: next } : h
          );
          onUpdateConfig({ chatHistories: updatedHistories });
        }, 300);
      }
      
      return next;
    });
  }, [targetHistoryId, onUpdateConfig, storageConfig]);

  const handleBatchRestoreAllStatus = useCallback(() => {
    triggerHaptic();
    setCharacterState((prev: any) => {
      const safePrev = prev || {};
      const next = {
        ...safePrev,
        isGhostMode: false,
        status: {
          ...(safePrev.status || {}),
          energy: 100,
          thirst: 100,
          hunger: 100,
          health: 100,
          hygiene: 100,
          mood: 100
        }
      };
      if (targetHistoryId && onUpdateConfig && storageConfig) {
        if (statusSaveTimeoutRef.current) clearTimeout(statusSaveTimeoutRef.current);
        statusSaveTimeoutRef.current = setTimeout(() => {
          const updatedHistories = (storageConfig?.chatHistories || []).map(h => 
            h.id === targetHistoryId ? { ...h, characterState: next } : h
          );
          onUpdateConfig({ chatHistories: updatedHistories });
        }, 300);
      }
      return next;
    });
    triggerToast("🌟 All status bars restored to 100%");
  }, [targetHistoryId, onUpdateConfig, storageConfig]);

  // Side Panel Modal Handlers
  const openSituationModal = (situation?: any, index?: number) => {
    triggerHaptic();
    if (situation && typeof index === 'number') {
      setEditingSituationIndex(index);
      setSituationForm({
        title: situation.title || '',
        description: situation.description || '',
        type: situation.type || 'physical',
        severity: situation.severity || 'Mild',
        duration: situation.duration || 'Ongoing',
      });
    } else {
      setEditingSituationIndex(null);
      setSituationForm({
        title: '',
        description: '',
        type: 'physical',
        severity: 'Mild',
        duration: 'Ongoing',
      });
    }
    setShowSituationModal(true);
  };

  const handleSaveSituation = () => {
    if (!situationForm.title.trim()) {
      triggerToast('Please enter a situation title');
      return;
    }
    const currentList = [...(characterState?.longterm || [])];
    if (editingSituationIndex !== null && editingSituationIndex < currentList.length) {
      currentList[editingSituationIndex] = { ...situationForm };
    } else {
      currentList.push({ ...situationForm });
    }
    handleUpdateCharacterState('longterm', '', currentList);
    setShowSituationModal(false);
    triggerToast('Long-term situation saved');
  };

  const handleDeleteSituation = (indexToDelete: number) => {
    const updated = (characterState?.longterm || []).filter((_: any, i: number) => i !== indexToDelete);
    handleUpdateCharacterState('longterm', '', updated);
    if (editingSituationIndex === indexToDelete) {
      setShowSituationModal(false);
    }
    triggerToast('Situation removed');
  };

  const openPregnancyModal = () => {
    triggerHaptic();
    const current = characterState?.pregnancy || {};
    setPregnancyForm({
      status: current.status || 'Not Pregnant',
      weeks: typeof current.weeks === 'number' ? current.weeks : 0,
      father: current.father || 'User',
      symptoms: Array.isArray(current.symptoms) ? [...current.symptoms] : [],
      protectionUsed: current.protectionUsed || 'None',
      notes: current.notes || '',
    });
    setCustomSymptomInput('');
    setShowPregnancyModal(true);
  };

  const handleSavePregnancy = () => {
    handleUpdateCharacterState('pregnancy', '', { ...pregnancyForm });
    setShowPregnancyModal(false);
    triggerToast('Pregnancy settings updated');
  };

  const openItemModal = (item?: any, index?: number) => {
    triggerHaptic();
    if (item && typeof index === 'number') {
      const norm = typeof item === 'string'
        ? { name: item, location: 'Right Pocket', quantity: 1, equipped: false, description: '' }
        : item;
      setEditingItemIndex(index);
      setItemForm({
        name: norm.name || '',
        location: norm.location || 'Right Pocket',
        quantity: typeof norm.quantity === 'number' ? norm.quantity : 1,
        equipped: !!norm.equipped,
        description: norm.description || '',
      });
    } else {
      setEditingItemIndex(null);
      setItemForm({
        name: '',
        location: 'Right Pocket',
        quantity: 1,
        equipped: false,
        description: '',
      });
    }
    setShowItemModal(true);
  };

  const handleSaveItem = () => {
    if (!itemForm.name.trim()) {
      triggerToast('Please enter an item name');
      return;
    }
    const currentItems = [...(characterState?.inventory?.items || ['Smartphone', 'House Keys', 'Student ID'])];
    if (editingItemIndex !== null && editingItemIndex < currentItems.length) {
      currentItems[editingItemIndex] = { ...itemForm };
    } else {
      currentItems.push({ ...itemForm });
    }
    const nextInv = {
      ...(characterState?.inventory || {}),
      items: currentItems
    };
    handleUpdateCharacterState('inventory', '', nextInv);
    setShowItemModal(false);
    triggerToast('Item on person saved');
  };

  const handleDeleteItem = (indexToDelete: number) => {
    const rawItems = characterState?.inventory?.items || ['Smartphone', 'House Keys', 'Student ID'];
    const currentItems = rawItems.filter((_: any, i: number) => i !== indexToDelete);
    const nextInv = {
      ...(characterState?.inventory || {}),
      items: currentItems
    };
    handleUpdateCharacterState('inventory', '', nextInv);
    if (editingItemIndex === indexToDelete) {
      setShowItemModal(false);
    }
    triggerToast('Item removed from person');
  };

  const openMoneyModal = () => {
    triggerHaptic();
    const currentMoney = characterState?.inventory?.money ?? characterState?.credits ?? 250;
    setMoneyInput(currentMoney);
    setShowMoneyModal(true);
  };

  const handleSaveMoney = (amount: number) => {
    const nextInv = {
      ...(characterState?.inventory || {}),
      money: amount
    };
    handleUpdateCharacterState('inventory', '', nextInv);
    setShowMoneyModal(false);
    triggerToast('Money updated');
  };

  const runSceneDetection = async (characterMessage: string, userMessageText?: string) => {
    if (!characterMessage || characterMessage.trim() === '') {
      return;
    }

    console.log("Running Analyzer for character response & user message:", { characterMessage, userMessageText });

    const worldApiKey = storageConfig?.worldApiKey;
    const apiKey = storageConfig?.useSameApiKey ? storageConfig?.apiKey : (worldApiKey || storageConfig?.apiKey);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const allKnown = [...PERSONAS, ...(storageConfig?.characters || [])];
      const worldChars: Array<{ id: string; name: string; currentRelationships: any }> = [];

      if (linkedWorld && linkedWorld.linkedCharacterIds && linkedWorld.linkedCharacterIds.length > 0) {
        linkedWorld.linkedCharacterIds.forEach((cid: string) => {
          const found = allKnown.find(item => item.id === cid && !item.id.startsWith('world-'));
          if (found) {
            worldChars.push({
              id: found.id,
              name: found.name,
              currentRelationships: charRelScores[found.id] || getInitialCharScores(found.id, found.name)
            });
          }
        });
      }

      if (worldChars.length === 0) {
        const targetChar = activeTargetCharacter || persona;
        if (targetChar && targetChar.id) {
          worldChars.push({
            id: targetChar.id,
            name: targetChar.name || 'Companion',
            currentRelationships: charRelScores[targetChar.id] || getInitialCharScores(targetChar.id, targetChar.name)
          });
        }
      }

      const defaultTargetChar = activeTargetCharacter || persona;
      const defaultTargetCharId = defaultTargetChar?.id || persona?.id || 'char';
      const defaultTargetCharName = defaultTargetChar?.name || persona?.name || 'Companion';

      if (shouldSkipSceneDetection(userMessageText || '', characterMessage)) {
        console.log("Skipping scene detection due to no keywords detected.");
        clearTimeout(timeoutId);
        return;
      }

      const data = await detectSceneState({
        characterMessage,
        userMessageText: userMessageText || '',
        defaultTargetCharName,
        linkedWorld,
        worldCalendarInput,
        worldLocationInput,
        worldWeatherInput,
        worldReputationInput,
        charRelScores,
        getInitialCharScores,
        worldChars,
        apiKey,
        storageConfig,
        characterState,
        defaultTargetCharId,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const detectedPlace = data.place;
      const detectedAmbient = data.ambient;

      console.log("Scene & World Analyzer result:", data);

      let nextCalendar = worldCalendarInput;
      let nextLocation = worldLocationInput;
      let nextWeather = worldWeatherInput;
      let nextReputation = worldReputationInput;
      let nextSceneMood = worldSceneMood;
      let nextRelScores = { ...charRelScores };

      // 1. Calendar
      if (data.calendar && data.calendar !== 'no_change') {
        nextCalendar = data.calendar;
        setWorldCalendarInput(data.calendar);
      }

      // 2. Location
      if (data.location && data.location !== 'no_change') {
        nextLocation = data.location;
        setWorldLocationInput(data.location);
      }

      // 3. Weather
      if (data.weather && data.weather !== 'no_change') {
        nextWeather = data.weather;
        setWorldWeatherInput(data.weather);
      }

      // 4. Reputation
      if (data.reputation && data.reputation !== 'no_change') {
        nextReputation = data.reputation;
        setWorldReputationInput(data.reputation);
        triggerToast(`World standing: ${data.reputation}`);
      }

      // 5. Scene Mood
      if (data.sceneMood && data.sceneMood !== 'no_change') {
        nextSceneMood = data.sceneMood;
        setWorldSceneMood(data.sceneMood);
      }

      // 5. Relationships
      if (data.relationships && typeof data.relationships === 'object') {
        let activeTargetId = data.targetCharacterId;
        let activeTargetName = data.targetCharacterName;

        if (!activeTargetId && activeTargetName) {
          const matched = worldChars.find(c => c.name.toLowerCase() === activeTargetName.toLowerCase());
          if (matched) activeTargetId = matched.id;
        }

        if (!activeTargetId) {
          activeTargetId = defaultTargetCharId;
          activeTargetName = defaultTargetCharName;
        } else if (!activeTargetName) {
          const matched = worldChars.find(c => c.id === activeTargetId);
          if (matched) activeTargetName = matched.name;
        }

        const existing = charRelScores[activeTargetId] || getInitialCharScores(activeTargetId, activeTargetName || 'Companion');
        const updated = { ...existing };
        let changed = false;

        Object.keys(data.relationships).forEach(k => {
          const val = data.relationships[k];
          if (typeof val === 'number' && val >= 1 && val <= 10 && val !== (existing as any)[k]) {
            (updated as any)[k] = val;
            changed = true;
          }
        });

        if (changed) {
          nextRelScores = { ...nextRelScores, [activeTargetId]: updated };
          setCharRelScores(nextRelScores);

          const displayName = activeTargetName || 'Companion';
          if (updated.anger >= 7 && existing.anger < 7) {
            triggerToast(`⚠️ ${displayName} is now Angry (${updated.anger}/10)!`);
          } else if (updated.respect < existing.respect) {
            triggerToast(`⚠️ ${displayName}'s respect dropped to ${updated.respect}/10`);
          } else if (updated.respect > existing.respect) {
            triggerToast(`✨ ${displayName}'s respect increased to ${updated.respect}/10`);
          } else {
            triggerToast(`Relationship with ${displayName} updated`);
          }
        }
      }

      // 6. Save back to session history & update places
      let nextState = { ...characterState };
      if (data.characterState && typeof data.characterState === 'object') {
        const resState = data.characterState;
        
        if (resState.status) {
          const oldS = characterState?.status || {};
          const newS = resState.status;
          
          if (newS.energy !== undefined && newS.energy !== oldS.energy) {
            console.log(`[Analyzer] Energy updated: ${oldS.energy ?? 100} -> ${newS.energy}`);
          }
          if (newS.hygiene !== undefined && newS.hygiene !== oldS.hygiene) {
            console.log(`[Analyzer] Hygiene updated: ${oldS.hygiene ?? 100} -> ${newS.hygiene}`);
          }
          if (newS.arousal !== undefined && newS.arousal !== oldS.arousal) {
            console.log(`[Analyzer] Arousal updated: ${oldS.arousal ?? 0} -> ${newS.arousal}`);
          }
          if (newS.mood && newS.mood !== oldS.mood) {
            triggerToast(`Mood: "${newS.mood}"`);
          }
        }
        
        nextState = {
          ...characterState,
          status: sanitizeStatusEasyMode(characterState?.status, resState.status || {}),
          inventory: {
            ...(characterState?.inventory || {}),
            ...(resState.inventory || {})
          },
          appearance: {
            ...(characterState?.appearance || {}),
            ...(resState.appearance || {})
          },
          phone: {
            ...(characterState?.phone || {}),
            ...(resState.phone || {}),
            threads: characterState?.phone?.threads || {},
            gallery: characterState?.phone?.gallery || []
          },
          longterm: resState.longterm || characterState?.longterm || [],
          pregnancy: resState.pregnancy || characterState?.pregnancy || {
            status: "Not Pregnant",
            weeks: 0,
            father: "None",
            symptoms: [],
            protectionUsed: "None"
          }
        };
        
        setCharacterState(nextState);
      }

      if (onUpdateConfig && storageConfig) {
        const { targetId, histories, session } = ensureSessionAndGetId();
        const rawPlace = (detectedPlace && detectedPlace !== 'no_change') ? detectedPlace : (session.activePlaceName || 'General');
        const nextPlace = resolveWorldPlace(rawPlace);
        const nextAmbient = (detectedAmbient && detectedAmbient !== 'no_change') ? detectedAmbient : (session.activeAmbientName || 'General');

        if (nextPlace !== (session.activePlaceName || 'General')) {
          triggerToast(`Environment shifted to: ${nextPlace}`);
        }
        if (nextAmbient !== (session.activeAmbientName || 'General')) {
          triggerToast(`Soundscape shifted to: ${nextAmbient}`);
        }

        const updatedSession: ChatHistory = {
          ...session,
          activePlaceName: nextPlace,
          activeAmbientName: nextAmbient,
          worldCalendar: nextCalendar,
          worldLocation: nextLocation,
          worldWeather: nextWeather,
          worldReputation: nextReputation,
          worldSceneMood: nextSceneMood,
          relationshipScores: nextRelScores,
          characterState: nextState,
          updatedAt: Date.now(),
        };

        const existingIdx = histories.findIndex(h => h.id === targetId);
        let updatedHistories: ChatHistory[];
        if (existingIdx >= 0) {
          updatedHistories = histories.map(h => h.id === targetId ? updatedSession : h);
        } else {
          updatedHistories = [updatedSession, ...histories];
        }
        onUpdateConfig({ chatHistories: updatedHistories });
      }

    } catch (err: any) {
      if (err.name === 'AbortError' || (err.message && (err.message.includes('aborted') || err.message.includes('abort')))) {
        console.log("Scene & World Analyzer request cancelled or timed out.");
      } else {
        console.warn("Scene/World Analyzer notice (background task skipped):", err.message || err);
      }
    }
  };

  const handleUpdateWorldLinkage = (worldId: string | null) => {
    if (onUpdateConfig && storageConfig) {
      const { targetId, histories, session } = ensureSessionAndGetId();
      const updatedSession: ChatHistory = {
        ...session,
        linkedWorldId: worldId || undefined,
        updatedAt: Date.now(),
      };
      const existingIdx = histories.findIndex(h => h.id === targetId);
      let updatedHistories: ChatHistory[];
      if (existingIdx >= 0) {
        updatedHistories = histories.map(h => h.id === targetId ? updatedSession : h);
      } else {
        updatedHistories = [updatedSession, ...histories];
      }
      onUpdateConfig({ chatHistories: updatedHistories });
      triggerToast(worldId ? "World linked to this chat" : "World link removed");
    }
  };

  const handleToggleSceneDetection = (enabled: boolean) => {
    if (onUpdateConfig && storageConfig) {
      const { targetId, histories, session } = ensureSessionAndGetId();
      const updatedSession: ChatHistory = {
        ...session,
        enableSceneDetection: enabled,
        updatedAt: Date.now(),
      };
      const existingIdx = histories.findIndex(h => h.id === targetId);
      let updatedHistories: ChatHistory[];
      if (existingIdx >= 0) {
        updatedHistories = histories.map(h => h.id === targetId ? updatedSession : h);
      } else {
        updatedHistories = [updatedSession, ...histories];
      }
      onUpdateConfig({ chatHistories: updatedHistories });
      triggerToast(enabled ? "Scene detection enabled" : "Scene detection disabled");
    }
  };

  // Sync current user persona details dynamically from the storageConfig
  useEffect(() => {
    if (targetHistoryId && storageConfig) {
      const activeSession = (storageConfig?.chatHistories || []).find(h => h.id === targetHistoryId);
      if (activeSession && 'userPersonaId' in activeSession) {
        const upid = (activeSession as any).userPersonaId;
        if (upid) {
          const foundPersona = (storageConfig.userPersonas || []).find(p => p.id === upid);
          if (foundPersona) {
            setCurrentPersonaName(foundPersona.name);
            setCurrentPersonaDesc(foundPersona.description);
            return;
          }
        }
      }
      
      // Fallback to active global persona
      if (storageConfig.activeUserPersonaId) {
        const activePersona = (storageConfig.userPersonas || []).find(p => p.id === storageConfig.activeUserPersonaId);
        if (activePersona) {
          setCurrentPersonaName(activePersona.name);
          setCurrentPersonaDesc(activePersona.description);
          return;
        }
      }
    }
  }, [targetHistoryId, storageConfig?.activeUserPersonaId, storageConfig?.userPersonas]);

  // Hydrate persistent world info and relationship scores from activeSession on mount or session change
  useEffect(() => {
    if (activeSession) {
      if (activeSession.worldCalendar) {
        const resolvedCal = getRealWorldDefaultCalendar(activeSession.worldCalendar);
        if (resolvedCal !== worldCalendarInput) {
          setWorldCalendarInput(resolvedCal);
        }
      } else if (linkedWorld?.defaultCalendar) {
        const defCal = getRealWorldDefaultCalendar(linkedWorld.defaultCalendar);
        if (worldCalendarInput !== defCal) {
          setWorldCalendarInput(defCal);
        }
      } else {
        const realCal = getRealWorldDefaultCalendar();
        if (worldCalendarInput !== realCal) {
          setWorldCalendarInput(realCal);
        }
      }

      if (activeSession.worldLocation) {
        if (activeSession.worldLocation !== worldLocationInput) {
          setWorldLocationInput(activeSession.worldLocation);
        }
      } else if (linkedWorld?.places?.[0]?.name) {
        if (worldLocationInput !== linkedWorld.places[0].name) {
          setWorldLocationInput(linkedWorld.places[0].name);
        }
      }

      if (activeSession.worldWeather) {
        if (activeSession.worldWeather !== worldWeatherInput) {
          setWorldWeatherInput(activeSession.worldWeather);
        }
      } else if (linkedWorld?.defaultAtmosphere) {
        if (worldWeatherInput !== linkedWorld.defaultAtmosphere) {
          setWorldWeatherInput(linkedWorld.defaultAtmosphere);
        }
      }

      if (activeSession.worldReputation) {
        if (activeSession.worldReputation !== worldReputationInput) {
          setWorldReputationInput(activeSession.worldReputation);
        }
      }

      if (activeSession.worldSceneMood) {
        if (activeSession.worldSceneMood !== worldSceneMood) {
          setWorldSceneMood(activeSession.worldSceneMood);
        }
      }

      if (activeSession.relationshipScores) {
        setCharRelScores(activeSession.relationshipScores as any);
      }
      if (activeSession.characterState) {
        setCharacterState(activeSession.characterState);
      }

      if (activeSession.activeChatStyle) {
        setActiveChatStyle(activeSession.activeChatStyle);
      }
      if (activeSession.activePerspective) {
        setActivePerspective(activeSession.activePerspective);
      }

      if (Array.isArray(activeSession.storyMemories)) {
        setStoryMemories(activeSession.storyMemories);
      } else {
        setStoryMemories([]);
      }

      if (Array.isArray(activeSession.pinnedMessages)) {
        setPinnedMessages(activeSession.pinnedMessages);
      } else if (activeSession.messages) {
        const pins = activeSession.messages.filter(m => m.isPinned).map(m => m.text);
        setPinnedMessages(pins);
      }
    }
  }, [
    activeSession?.id,
    targetHistoryId,
    linkedWorld?.id
  ]);

  const handleUpdateStoryMemories = (newMemories: string[]) => {
    setStoryMemories(newMemories);
    const targetId = targetHistoryId || activeHistoryId || historyId;
    if (targetId && onUpdateConfig && storageConfig) {
      const updatedHistories = (storageConfig?.chatHistories || []).map(h => 
        h.id === targetId ? { ...h, storyMemories: newMemories } : h
      );
      onUpdateConfig({ chatHistories: updatedHistories });
    }
  };

  const handleUnpinMessage = (msgTextOrId: string) => {
    setMessages(prev => prev.map(m => (m.id === msgTextOrId || m.text === msgTextOrId) ? { ...m, isPinned: false } : m));
    setPinnedMessages(prev => {
      const updatedPins = prev.filter(p => p !== msgTextOrId);
      const targetId = targetHistoryId || activeHistoryId || historyId;
      if (targetId && onUpdateConfig && storageConfig) {
        const updatedHistories = (storageConfig?.chatHistories || []).map(h => 
          h.id === targetId ? { ...h, pinnedMessages: updatedPins } : h
        );
        onUpdateConfig({ chatHistories: updatedHistories });
      }
      return updatedPins;
    });
    triggerToast("Unpinned message");
  };

  const handleSelectUserPersonaForChat = (userPersonaId: string) => {
    const foundPersona = (storageConfig?.userPersonas || []).find(p => p.id === userPersonaId);
    if (!foundPersona) return;

    setCurrentPersonaName(foundPersona.name);
    setCurrentPersonaDesc(foundPersona.description);

    if (targetHistoryId && onUpdateConfig) {
      const updatedHistories = (storageConfig?.chatHistories || []).map(h => 
        h.id === targetHistoryId ? { ...h, userPersonaId: userPersonaId } : h
      );
      onUpdateConfig({ chatHistories: updatedHistories });
    }
  };

  // Custom Character details overrides for high-fidelity inline custom editing
  const [characterName, setCharacterName] = useState(persona?.name || 'Narrator');
  const [characterSubtitle, setCharacterSubtitle] = useState(persona?.subtitle || '');
  const [isEditingCharacter, setIsEditingCharacter] = useState(false);

  const triggerToast = React.useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  const handleInsertEmoji = React.useCallback((emoji: string) => {
    setExternalInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  const handleSelectRealImage = React.useCallback((base64Data: string | null, fileName?: string) => {
    setSelectedImage(base64Data);
    setSelectedImageName(fileName || null);
    if (base64Data) {
      triggerToast("Image attached successfully");
    }
  }, [triggerToast]);

  const handleExternalTextConsumed = React.useCallback(() => {
    setExternalInputText('');
  }, []);

  const handleCopyConversation = () => {
    const text = messages.map(m => `${m.role === 'user' ? 'User' : characterName}: ${m.text}`).join('\n\n');
    navigator.clipboard.writeText(text);
    triggerToast("Conversation copied to clipboard");
    setShowBottomSheet(false);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-msg',
        role: 'ai',
        text: `Greetings. I am your **${characterName}** companion.\n\n${persona.description}\n\nHow may I assist your exploration today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      },
    ]);
    triggerToast("Started a new conversation session");
    setShowBottomSheet(false);
  };

  const handleTogglePin = () => {
    setIsPinned(!isPinned);
    triggerToast(!isPinned ? `${characterName} pinned to favorites` : `${characterName} unpinned`);
    setShowBottomSheet(false);
  };

  const handleReport = () => {
    triggerToast("Thank you. Report submitted for model safety.");
    setShowBottomSheet(false);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Ensure latest messages are flushed to persistent storage on screen exit / unmount
  useEffect(() => {
    return () => {
      if (messagesRef.current && messagesRef.current.length > 0 && lastHistoryIdRef.current) {
        const lastMsgText = messagesRef.current[messagesRef.current.length - 1]?.text || '';
        onSaveHistory(lastHistoryIdRef.current, messagesRef.current, lastMsgText, persona.id);
      }
    };
  }, []);

  // Initialize messages on mount/change
  useEffect(() => {
    if (historyId !== lastHistoryIdRef.current || !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      lastHistoryIdRef.current = historyId;
      setActiveHistoryId(historyId);
      setCharacterName(persona.name || '');
      setCharacterSubtitle(persona.subtitle || '');
      
      const existingSession = historyId
        ? (storageConfig?.chatHistories || []).find(h => h.id === historyId)
        : null;
      const savedFromStorage = historyId ? loadCharacterChatFromLocalStorage(historyId) : null;
      const messagesToLoad: ChatMessage[] = (initialMessages && initialMessages.length > 0)
        ? initialMessages
        : (existingSession?.messages && existingSession.messages.length > 0)
          ? existingSession.messages
          : (savedFromStorage && savedFromStorage.length > 0)
            ? savedFromStorage
            : (!historyId && persona?.id && loadCharacterChatFromLocalStorage(persona.id).length > 0)
              ? loadCharacterChatFromLocalStorage(persona.id)
              : [
                  {
                    id: 'welcome-msg',
                    role: 'ai',
                    text: `Greetings. I am your **${persona.name}** companion.\n\n${persona.description}\n\nHow may I assist your exploration today?`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                  },
                ];

      setMessages(messagesToLoad);
      const loadedPins = messagesToLoad.filter(m => m.isPinned).map(m => m.text);
      setPinnedMessages(loadedPins);
    }
  }, [historyId, initialMessages, persona, storageConfig?.chatHistories]);

  const scrollToBottom = (instant = false) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: instant ? 'auto' : 'smooth',
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
  };

  const sliceHistoryByMemory = (historyArr: any[]) => {
    if (!Array.isArray(historyArr) || historyArr.length === 0) return [];
    
    // Clean and normalize all messages with explicit role & isUser properties
    const cleanList = historyArr
      .filter(m => m && typeof m.text === 'string' && m.text.trim())
      .map(m => {
        const isUser = m.role === 'user' || m.isUser === true;
        return {
          id: m.id,
          role: isUser ? 'user' : 'model',
          isUser,
          text: m.text.trim(),
          isPinned: !!m.isPinned
        };
      });

    const maxContext = storageConfig?.samplerMaxContext ?? 16384;
    // Provide expansive memory: Gemini has 1M+ token context window.
    // By default send up to 150 turns so the AI remembers the entire ongoing conversation!
    let limit = 150;
    if (maxContext <= 4096) {
      limit = 50;
    } else if (maxContext > 30000) {
      limit = 300;
    }

    if (cleanList.length <= limit) {
      return cleanList;
    }

    // Retain any pinned messages from earlier in the chat plus the recent window
    const recent = cleanList.slice(-limit);
    const olderPinned = cleanList.slice(0, -limit).filter(m => m.isPinned);
    return [...olderPinned, ...recent];
  };

  // Pre-calculate all companions once per render to avoid overhead in the message loop
  const allCompanions = useMemo(() => {
    return [
      ...PERSONAS, 
      ...(storageConfig?.characters || []),
      { 
        id: 'user', 
        name: currentPersonaName, 
        avatar: activeUserPersona?.avatar, 
        avatarEmoji: '👤', 
        avatarGradient: activeUserPersona?.avatarGradient || 'from-zinc-500 to-zinc-700' 
      }
    ];
  }, [storageConfig?.characters, currentPersonaName, activeUserPersona]);

  const stableSystemInstruction = useMemo(() => {
    return buildStableSystemInstruction({
      targetChar: activeTargetCharacter || persona,
      persona,
      activeCharName: (activeTargetCharacter || persona)?.name || 'Companion',
      linkedWorld,
      allKnownCompanions: allCompanions,
      activePlaceName,
      currentPersonaName,
      currentPersonaDesc,
      selectedChatStyle,
      activeChatStyle,
      activePerspective,
      storageConfig
    });
  }, [
    activeTargetCharacter,
    persona,
    linkedWorld,
    allCompanions,
    activePlaceName,
    currentPersonaName,
    currentPersonaDesc,
    selectedChatStyle,
    activeChatStyle,
    activePerspective,
    storageConfig
  ]);

  const getFullSystemInstruction = () => {
    const dynamicSystemInstruction = buildDynamicSystemInstruction({
      targetChar: activeTargetCharacter || persona,
      persona,
      activeCharName: (activeTargetCharacter || persona)?.name || 'Companion',
      currentPersonaName,
      worldCalendarInput,
      worldLocationInput,
      activePlaceName,
      worldWeatherInput,
      worldReputationInput,
      worldSceneMood,
      charRelScores,
      getInitialCharScores,
      storyMemories,
      pinnedMessages,
      characterState,
      allKnownCompanions: allCompanions,
      worldLinkedChars: (() => {
        const chars: any[] = [];
        if (linkedWorld?.linkedCharacterIds && linkedWorld.linkedCharacterIds.length > 0) {
          linkedWorld.linkedCharacterIds.forEach((cid: string) => {
            const found = allCompanions.find(item => item.id === cid && !item.id.startsWith('world-'));
            if (found) chars.push(found);
          });
        }
        if (chars.length === 0 && (activeTargetCharacter || persona)) {
          const t = activeTargetCharacter || persona;
          if (t?.id && !t.id.startsWith('world-')) chars.push(t);
        }
        return chars;
      })()
    });

    return stableSystemInstruction + dynamicSystemInstruction;
  };

  const deadCharacterIds = useMemo(() => {
    const deadSet = new Set<string>();
    if (!messages || !Array.isArray(messages)) return deadSet;
    const chars = [...PERSONAS, ...(storageConfig?.characters || [])];
    
    for (const char of chars) {
      const name = char.name.toLowerCase();
      for (const msg of messages) {
        if (!msg.text) continue;
        const text = msg.text.toLowerCase();
        
        if (text.includes(name)) {
          // Check for death triggers
          const deathPatterns = [
            `${name} died`,
            `${name} is dead`,
            `${name} was killed`,
            `${name} has been killed`,
            `${name} has died`,
            `${name} was slain`,
            `${name} perished`,
            `${name} passed away`,
            `${name} is deceased`,
            `${name} is killed`,
            `killed ${name}`,
            `slayed ${name}`,
            `murdered ${name}`,
            `death of ${name}`,
            `rip ${name}`,
            `r.i.p. ${name}`,
            `${name} falls dead`,
            `${name} is no longer alive`,
            `corpse of ${name}`,
            `${name}'s corpse`,
            `${name}'s body`,
            `${name}'s dead body`,
            `rest in peace, ${name}`
          ];
          
          const matchesDeath = deathPatterns.some(p => text.includes(p));
          if (matchesDeath) {
            deadSet.add(char.id);
          }
          
          // Check for resurrection/revival triggers to clear death status
          const livePatterns = [
            `${name} is alive`,
            `revived ${name}`,
            `revive ${name}`,
            `${name} is resurrected`,
            `${name} revived`,
            `${name} survived`,
            `${name} is back to life`,
            `healed ${name}`,
            `brought ${name} back`
          ];
          
          const matchesLive = livePatterns.some(p => text.includes(p));
          if (matchesLive) {
            deadSet.delete(char.id);
          }
        }
      }
    }
    return deadSet;
  }, [messages, storageConfig?.characters]);

  const handlePostSocialUpdate = (content: string, image?: string) => {
    // 1. Append a system message to the main chat so the AI is immediately aware
    const systemMsg: ChatMessage = {
      id: `sys-social-${Date.now()}`,
      role: 'system',
      text: `[System: User posted on social media: "${content}"${image ? ' with an attached photo.' : ''}]`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, systemMsg]);
    
    // Save history session with the system message
    const targetHistId = activeHistoryId || historyId || `chat-${Date.now()}`;
    if (onUpdateConfig && storageConfig) {
      setTimeout(() => {
        const updatedHistories = (storageConfig?.chatHistories || []).map(h => 
          h.id === targetHistId ? { ...h, messages: [...(h.messages || []), systemMsg] } : h
        );
        onUpdateConfig({ chatHistories: updatedHistories });
      }, 50);
    }

    // 2. Trigger an immediate active companion DM in the phone Messaging app after 3.5 seconds
    const activePersona = PERSONAS.find(p => p.id === characterName) || (storageConfig?.characters || []).find(c => c.id === characterName) || PERSONAS[0];
    if (activePersona) {
      setTimeout(async () => {
        try {
          const latestPhone = characterStateRef.current?.phone || {};
          const latestThreads = latestPhone.threads || {};
          const currentContactThread = Array.isArray(latestThreads[activePersona.id]) ? latestThreads[activePersona.id] : [];
          
          const res = await fetchWithRetry('/api/phone-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `[System Notification: User posted this on social media: "${content}". Send a quick message reacting to it or commenting on it as my companion/friend. Keep it in character, casual, texting style and short.]`,
              history: currentContactThread,
              recentWorldChatHistory: messages.slice(-5).map(m => (m.role === 'user' ? 'User: ' : 'Companion: ') + m.text).join('\n'),
              worldLocation: worldLocationInput || activePlaceName,
              contactName: activePersona.name,
              contactPersona: activePersona.description || (activePersona as any).personality || '',
              customApiKey: storageConfig?.apiKey,
              customApiKeys: storageConfig?.apiKeys,
              selectedModel: storageConfig?.selectedModel,
              samplers: storageConfig ? {
                temperature: storageConfig.samplerTemperature,
                topP: storageConfig.samplerTopP,
                generatedTokens: storageConfig.samplerGeneratedTokens,
                isStreaming: storageConfig.samplerIsStreaming
              } : undefined
            })
          });
          
          if (res.ok) {
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let aiReply = '';
            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6));
                      if (data.text) {
                        aiReply += data.text;
                      }
                    } catch (e) {}
                  }
                }
              }
              
              if (aiReply.trim()) {
                const livePhone = characterStateRef.current?.phone || {};
                const liveThreads = livePhone.threads || {};
                const liveThread = Array.isArray(liveThreads[activePersona.id]) ? [...liveThreads[activePersona.id]] : [];
                liveThread.push({
                  text: aiReply,
                  isUser: false,
                  timestamp: Date.now(),
                  unread: true
                });
                handleUpdateCharacterState('phone', 'threads', {
                  ...liveThreads,
                  [activePersona.id]: liveThread
                });
              }
            }
          }
        } catch (e) {
          console.error("Failed to trigger automatic social DM reaction", e);
        }
      }, 3500);
    }
  };

  // Scroll on mount / session change
  useEffect(() => {
    scrollToBottom(true);
    const timer = setTimeout(() => {
      scrollToBottom(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [historyId]);

  // Scroll on messages list change or active stream (only if user is near the bottom)
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;
      if (isNearBottom || isStreaming) {
        scrollToBottom(false);
      }
    } else {
      scrollToBottom(false);
    }
  }, [messages, isStreaming]);

  const handleRewindToHere = (msgId: string) => {
    triggerHaptic();
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex !== -1) {
      // Keep everything up to the selected message (inclusive)
      const newMessages = messages.slice(0, msgIndex + 1);
      setMessages(newMessages);
      
      const targetHistoryId = activeHistoryId || historyId || `chat-${Date.now()}`;
      if (!activeHistoryId) {
        setActiveHistoryId(targetHistoryId);
      }
      lastHistoryIdRef.current = targetHistoryId;
      onSaveHistory(targetHistoryId, newMessages, newMessages[newMessages.length - 1]?.text || '', persona.id);
      triggerToast("Rewound conversation to here");
    }
    setSelectedMessageForMenu(null);
  };

  const handleRetryMessage = async (msgId: string) => {
    if (isStreaming) return;
    
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;
    
    const historyUpToThis = messages.slice(0, msgIndex);
    const lastUserMsg = [...historyUpToThis].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    triggerHaptic();
    setErrorMsg(null);
    setIsStreaming(true);

    const targetHistoryId = activeHistoryId || historyId || `chat-${Date.now()}`;
    if (!activeHistoryId) {
      setActiveHistoryId(targetHistoryId);
    }
    lastHistoryIdRef.current = targetHistoryId;
    let accumulatedText = '';
    
    const targetMsg = messages[msgIndex];
    const currentAlts = targetMsg.alternatives || [targetMsg.text];
    const newAltIndex = currentAlts.length;
    const updatedAlts = [...currentAlts, ""];
    
    setMessages(prev => prev.map(m => m.id === msgId ? {
      ...m,
      text: '',
      isStreaming: true,
      alternatives: updatedAlts,
      activeAlternativeIndex: newAltIndex
    } : m));

    try {
      const fullSystemInstruction = getFullSystemInstruction();

      const response = await fetchWithRetry('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: lastUserMsg.text,
          history: sliceHistoryByMemory(historyUpToThis.slice(0, -1)),
          systemInstruction: fullSystemInstruction,
          customApiKey: apiKey,
          customApiKeys: storageConfig?.apiKeys,
          customApiProvider: storageConfig?.apiProvider || 'gemini',
          characterState,
          currentRelationships: charRelScores[activeTargetCharacter?.id || persona?.id || 'char'] || getInitialCharScores(activeTargetCharacter?.id || persona?.id || 'char', activeTargetCharacter?.name || persona?.name || 'Companion'),
          linkedCharactersCount: linkedWorld ? (linkedWorld.linkedCharacterIds || []).length : 1,
          samplers: storageConfig ? {
            maxContext: storageConfig.samplerMaxContext,
            generatedTokens: storageConfig.samplerGeneratedTokens,
            isStreaming: storageConfig.samplerIsStreaming,
            temperature: storageConfig.samplerTemperature,
            topP: storageConfig.samplerTopP,
            presencePenalty: storageConfig.samplerPresencePenalty,
            frequencyPenalty: storageConfig.samplerFrequencyPenalty,
            seed: storageConfig.samplerSeed
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP Error ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let lastRenderTime = 0;
      let pendingRaf: any = null;
      let streamBuffer = '';
      let streamDone = false;

      const scheduleRetryRender = (force = false) => {
        const now = Date.now();
        if (force || now - lastRenderTime >= 45) {
          if (pendingRaf) {
            cancelAnimationFrame(pendingRaf);
            pendingRaf = null;
          }
          lastRenderTime = now;
          setMessages(prev => prev.map(m => {
            if (m.id === msgId) {
              const updatedAltArray = [...(m.alternatives || [])];
              updatedAltArray[newAltIndex] = accumulatedText;
              return {
                ...m,
                text: accumulatedText,
                alternatives: updatedAltArray,
                activeAlternativeIndex: newAltIndex
              };
            }
            return m;
          }));
        } else if (!pendingRaf) {
          pendingRaf = requestAnimationFrame(() => {
            scheduleRetryRender(true);
          });
        }
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              streamDone = true;
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                const e = new Error(parsed.error);
                (e as any).isStreamError = true;
                throw e;
              }
              if (parsed.text) {
                accumulatedText += parsed.text;
                scheduleRetryRender(false);
              }
            } catch (e: any) {
              if (e.isStreamError) throw e;
            }
          }
        }
      }

      if (pendingRaf) {
        cancelAnimationFrame(pendingRaf);
        pendingRaf = null;
      }

      const finalized = messages.map(m => {
        if (m.id === msgId) {
          const updatedAltArray = [...(m.alternatives || [])];
          updatedAltArray[newAltIndex] = accumulatedText;
          return {
            ...m,
            text: accumulatedText,
            isStreaming: false,
            alternatives: updatedAltArray,
            activeAlternativeIndex: newAltIndex
          };
        }
        return m;
      });

      setMessages(finalized);
      onSaveHistory(targetHistoryId, finalized, accumulatedText);

      // Save regenerated AI reply to phone thread if user sent a text message
      if (lastUserMsg.text.includes('*[Sent a text message to') || lastUserMsg.text.includes('on phone]:')) {
        let targetPid = activeTargetCharacter?.id || persona?.id || 'char';
        const match = lastUserMsg.text.match(/\*\[Sent a [^\]]+ to ([^\]]+) on phone\]:/i);
        if (match && match[1]) {
          const nameQuery = match[1].trim().toLowerCase();
          const allChars = [...PERSONAS, ...(storageConfig?.characters || [])];
          const foundChar = allChars.find(c => c.name.toLowerCase() === nameQuery);
          if (foundChar) {
            targetPid = foundChar.id;
          } else {
            const customContacts = characterState?.phone?.customContacts || [];
            const foundCustom = customContacts.find((c: any) => c.name.toLowerCase() === nameQuery);
            if (foundCustom) {
              targetPid = foundCustom.id;
            }
          }
        }

        const phoneData = characterState?.phone || {};
        const currentThreads = phoneData.threads || {};
        const targetThread = [...(currentThreads[targetPid] || [])];
        
        // Find the last AI message in the thread and update it, or push if none
        let lastAiIndex = -1;
        for (let i = targetThread.length - 1; i >= 0; i--) {
          if (!targetThread[i].isUser) {
            lastAiIndex = i;
            break;
          }
        }
        
        if (lastAiIndex !== -1) {
          targetThread[lastAiIndex] = { ...targetThread[lastAiIndex], text: cleanPhoneMessage(accumulatedText, characterName), timestamp: Date.now() };
        } else {
          targetThread.push({ text: cleanPhoneMessage(accumulatedText, characterName), isUser: false, timestamp: Date.now() });
        }
        
        const nextPhoneThreads = {
          ...currentThreads,
          [targetPid]: targetThread
        };
        
        handleUpdateCharacterState('phone', 'threads', nextPhoneThreads);
      }

      runSceneDetection(accumulatedText, lastUserMsg.text);

    } catch (err: any) {
      console.error('Retry stream error:', err);
      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          const updatedAltArray = [...(m.alternatives || [])];
          const errorText = accumulatedText || `**Error:** Failed to regenerate. ${err.message || ''}`;
          updatedAltArray[newAltIndex] = errorText;
          return {
            ...m,
            text: errorText,
            isStreaming: false,
            alternatives: updatedAltArray,
            activeAlternativeIndex: newAltIndex
          };
        }
        return m;
      }));
    } finally {
      setIsStreaming(false);
    }
  };

  const getSuggestedAnswers = (): string[] => {
    if (messages.length === 0) {
      return persona.suggestedPrompts || ["Tell me an adventure", "Let's start a fantasy quest", "What secrets are you hiding?"];
    }
    
    const lastMsg = [...messages].reverse().find(m => m.role === 'ai');
    if (!lastMsg) {
      return persona.suggestedPrompts || ["Hello there!", "Tell me about yourself", "Let's explore together"];
    }

    const text = lastMsg.text.toLowerCase();
    
    if (selectedChatStyle === 'seductive') {
      if (text.includes('how') || text.includes('assist') || text.includes('help')) {
        return [
          "Surprise me with your charm...",
          "Tell me an intimate secret.",
          "Let's talk about our connection."
        ];
      }
      if (text.includes('story') || text.includes('adventure') || text.includes('game') || text.includes('quest')) {
        return [
          "Make the story romantic and mysterious.",
          "Tell me a tale where we are partners in crime.",
          "Let's play a playful roleplay."
        ];
      }
      return [
        "Tell me more, don't hold back...",
        "You always know exactly what to say.",
        "What would you do if I were there with you?"
      ];
    } else if (selectedChatStyle === 'adventurous') {
      if (text.includes('how') || text.includes('assist') || text.includes('help')) {
        return [
          "Let's initiate a cyber heist!",
          "Start a fantasy dungeon quest.",
          "What's the most dangerous scenario we can run?"
        ];
      }
      if (text.includes('story') || text.includes('quest') || text.includes('game') || text.includes('adventure')) {
        return [
          "Let's add an unexpected plot twist!",
          "I draw my cyber-sword and look around.",
          "We head deeper into the ancient ruins."
        ];
      }
      return [
        "What lies ahead in our quest?",
        "Let's face the danger head-on!",
        "Tell me the legend of this mystical place."
      ];
    } else {
      if (text.includes('how') || text.includes('assist') || text.includes('help')) {
        return [
          "Can you write a creative story with me?",
          "Let's discuss an interesting philosophy topic.",
          "Help me brainstorm a creative project."
        ];
      }
      if (text.includes('story') || text.includes('creative') || text.includes('write')) {
        return [
          "What happens in the next chapter?",
          "Introduce a brand new, mysterious character.",
          "Let's change the scene to a cozy rain cabin."
        ];
      }
      return [
        "That's fascinating. Tell me more about that.",
        "Can we explore a different perspective on this?",
        "What do you suggest we talk about next?"
      ];
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;

    setErrorMsg(null);
    const userMsgText = textToSend.trim();
    setInputText('');

    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    let finalAttachmentUrl: string | undefined = undefined;
    if (selectedImage) {
      if (selectedImage.startsWith('data:')) {
        try {
          const assetId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          finalAttachmentUrl = await storeAsset(assetId, selectedImage);
        } catch (err) {
          console.error("Failed to store message attachment to IndexedDB", err);
          finalAttachmentUrl = selectedImage; // fallback
        }
      } else {
        finalAttachmentUrl = selectedImage;
      }
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userMsgText,
      timestamp: timestampStr,
      image: finalAttachmentUrl,
    };

    setSelectedImage(null);
    setSelectedImageName(null);

    const aiMsgId = `ai-${Date.now()}`;
    const initialAiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'ai',
      text: '',
      timestamp: timestampStr,
      isStreaming: true,
    };

    const updatedHistory = [...messages, userMsg];
    setMessages([...updatedHistory, initialAiMsg]);
    setIsStreaming(true);
    setErrorMsg(null);

    const targetHistoryId = activeHistoryId || historyId || `chat-${Date.now()}`;
    if (!activeHistoryId) {
      setActiveHistoryId(targetHistoryId);
    }
    lastHistoryIdRef.current = targetHistoryId;

    // Sync to parent history debounced to avoid re-render storm
    const syncHistory = (msgs: ChatMessage[], lastText: string) => {
      onSaveHistory(targetHistoryId, msgs, lastText, persona.id);
    };

    // Save user message immediately to persistent storage
    syncHistory(updatedHistory, userMsgText);

    let accumulatedText = '';

    try {
      const fullSystemInstruction = getFullSystemInstruction();

      const response = await fetchWithRetry('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMsgText,
          history: sliceHistoryByMemory(messages),
          systemInstruction: fullSystemInstruction,
          customApiKey: apiKey,
          customApiKeys: storageConfig?.apiKeys,
          customApiProvider: storageConfig?.apiProvider || 'gemini',
          selectedModel: storageConfig?.selectedModel,
          characterState,
          currentRelationships: charRelScores[activeTargetCharacter?.id || persona?.id || 'char'] || getInitialCharScores(activeTargetCharacter?.id || persona?.id || 'char', activeTargetCharacter?.name || persona?.name || 'Companion'),
          linkedCharactersCount: linkedWorld ? (linkedWorld.linkedCharacterIds || []).length : 1,
          samplers: storageConfig ? {
            maxContext: storageConfig.samplerMaxContext,
            generatedTokens: storageConfig.samplerGeneratedTokens,
            isStreaming: storageConfig.samplerIsStreaming,
            temperature: storageConfig.samplerTemperature,
            topP: storageConfig.samplerTopP,
            presencePenalty: storageConfig.samplerPresencePenalty,
            frequencyPenalty: storageConfig.samplerFrequencyPenalty,
            seed: storageConfig.samplerSeed
          } : undefined,
        }),
      });

      if (!response.ok) {
        let errText = `HTTP Error ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error) errText = errData.error;
        } catch {}
        throw new Error(errText);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let lastSaveTime = Date.now();
      let lastRenderTime = 0;
      let pendingRaf: any = null;
      let streamBuffer = '';
      let streamDone = false;

      const scheduleStreamRender = (force = false) => {
        const now = Date.now();
        if (force || now - lastRenderTime >= 45) {
          if (pendingRaf) {
            cancelAnimationFrame(pendingRaf);
            pendingRaf = null;
          }
          lastRenderTime = now;
          const nextMsgs: ChatMessage[] = [
            ...updatedHistory,
            {
              id: aiMsgId,
              role: 'ai',
              text: accumulatedText,
              timestamp: timestampStr,
              isStreaming: true,
            },
          ];
          setMessages(nextMsgs);
          if (now - lastSaveTime > 3000) {
            syncHistory(nextMsgs, accumulatedText);
            lastSaveTime = now;
          }
        } else if (!pendingRaf) {
          pendingRaf = requestAnimationFrame(() => {
            scheduleStreamRender(true);
          });
        }
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              streamDone = true;
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) { const e = new Error(parsed.error); (e as any).isStreamError = true; throw e; }
              if (parsed.text) {
                accumulatedText += parsed.text;
                scheduleStreamRender(false);
              }
            } catch (e: any) { if (e.isStreamError) throw e; }
          }
        }
      }

      if (pendingRaf) {
        cancelAnimationFrame(pendingRaf);
        pendingRaf = null;
      }

      // Finalize streaming state
      const cleanedText = stripUserPuppeting(accumulatedText, currentPersonaName);
      const finalizedText = cleanedText.trim() ? cleanedText : (accumulatedText.trim() ? accumulatedText : "*(No response generated. Please tap Continue or Regenerate to try again.)*");
      const finalizedMsgs: ChatMessage[] = [
        ...updatedHistory,
        {
          id: aiMsgId,
          role: 'ai',
          text: finalizedText,
          timestamp: timestampStr,
          isStreaming: false,
          alternatives: [finalizedText],
          activeAlternativeIndex: 0,
        },
      ];
      setMessages(finalizedMsgs);
      syncHistory(finalizedMsgs, finalizedText);

      // Save AI reply to phone thread if user sent a text message
      if (userMsgText.includes('*[Sent a text message to') || userMsgText.includes('on phone]:')) {
        let targetPid = activeTargetCharacter?.id || persona?.id || 'char';
        const match = userMsgText.match(/\*\[Sent a [^\]]+ to ([^\]]+) on phone\]:/i);
        if (match && match[1]) {
          const nameQuery = match[1].trim().toLowerCase();
          const allChars = [...PERSONAS, ...(storageConfig?.characters || [])];
          const foundChar = allChars.find(c => c.name.toLowerCase() === nameQuery);
          if (foundChar) {
            targetPid = foundChar.id;
          } else {
            const customContacts = characterState?.phone?.customContacts || [];
            const foundCustom = customContacts.find((c: any) => c.name.toLowerCase() === nameQuery);
            if (foundCustom) {
              targetPid = foundCustom.id;
            }
          }
        }

        const phoneData = characterState?.phone || {};
        const currentThreads = phoneData.threads || {};
        const targetThread = currentThreads[targetPid] || [];
        
        const updatedThread = [
          ...targetThread,
          { text: cleanPhoneMessage(accumulatedText, characterName), isUser: false, timestamp: Date.now() }
        ];
        
        const nextPhoneThreads = {
          ...currentThreads,
          [targetPid]: updatedThread
        };
        
        handleUpdateCharacterState('phone', 'threads', nextPhoneThreads);
      }

      runSceneDetection(accumulatedText, userMsgText);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errMsg = err.message || 'Connection failed.';
      setErrorMsg(errMsg);
      const erroredMsgs: ChatMessage[] = [
        ...updatedHistory,
        {
          id: aiMsgId,
          role: 'ai',
          text: accumulatedText || `**Error:** ${errMsg}`,
          timestamp: timestampStr,
          isStreaming: false,
          alternatives: [accumulatedText || `**Error:** ${errMsg}`],
          activeAlternativeIndex: 0,
        },
      ];
      setMessages(erroredMsgs);
      syncHistory(erroredMsgs, accumulatedText || 'Connection error.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleContinueConversation = async () => {
    if (isStreaming) return;

    setErrorMsg(null);
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // The continuation prompt instructs the AI to continue its thought process seamlessly
    const continuationPrompt = "[Continue speaking and elaborating from your last message. Do not introduce or acknowledge this instruction, just continue speaking naturally from where you left off.]";

    const aiMsgId = `ai-${Date.now()}`;
    const initialAiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'ai',
      text: '',
      timestamp: timestampStr,
      isStreaming: true,
    };

    // The updated history to send to Gemini (the backend builds contents out of this history + message)
    // We send current messages as history, and the continuation prompt as the message.
    const updatedHistory = [...messages];
    setMessages([...updatedHistory, initialAiMsg]);
    setIsStreaming(true);
    setErrorMsg(null);

    const targetHistoryId = activeHistoryId || historyId || `chat-${Date.now()}`;
    if (!activeHistoryId) {
      setActiveHistoryId(targetHistoryId);
    }
    lastHistoryIdRef.current = targetHistoryId;

    const syncHistory = (msgs: ChatMessage[], lastText: string) => {
      onSaveHistory(targetHistoryId, msgs, lastText, persona.id);
    };

    let accumulatedText = '';

    try {
      const fullSystemInstruction = getFullSystemInstruction();

      const response = await fetchWithRetry('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: continuationPrompt,
          history: sliceHistoryByMemory(updatedHistory),
          systemInstruction: fullSystemInstruction,
          customApiKey: apiKey,
          customApiKeys: storageConfig?.apiKeys,
          customApiProvider: storageConfig?.apiProvider || 'gemini',
          selectedModel: storageConfig?.selectedModel,
          characterState,
          currentRelationships: charRelScores[activeTargetCharacter?.id || persona?.id || 'char'] || getInitialCharScores(activeTargetCharacter?.id || persona?.id || 'char', activeTargetCharacter?.name || persona?.name || 'Companion'),
          linkedCharactersCount: linkedWorld ? (linkedWorld.linkedCharacterIds || []).length : 1,
          samplers: storageConfig ? {
            maxContext: storageConfig.samplerMaxContext,
            generatedTokens: storageConfig.samplerGeneratedTokens,
            isStreaming: storageConfig.samplerIsStreaming,
            temperature: storageConfig.samplerTemperature,
            topP: storageConfig.samplerTopP,
            presencePenalty: storageConfig.samplerPresencePenalty,
            frequencyPenalty: storageConfig.samplerFrequencyPenalty,
            seed: storageConfig.samplerSeed
          } : undefined,
        }),
      });

      if (!response.ok) {
        let errText = `HTTP Error ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error) errText = errData.error;
        } catch {}
        throw new Error(errText);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let lastSaveTime = Date.now();
      let lastRenderTime = 0;
      let pendingRaf: any = null;
      let streamBuffer = '';
      let streamDone = false;

      const scheduleContinueRender = (force = false) => {
        const now = Date.now();
        if (force || now - lastRenderTime >= 45) {
          if (pendingRaf) {
            cancelAnimationFrame(pendingRaf);
            pendingRaf = null;
          }
          lastRenderTime = now;
          const nextMsgs: ChatMessage[] = [
            ...updatedHistory,
            {
              id: aiMsgId,
              role: 'ai',
              text: accumulatedText,
              timestamp: timestampStr,
              isStreaming: true,
            },
          ];
          setMessages(nextMsgs);
          if (now - lastSaveTime > 3000) {
            syncHistory(nextMsgs, accumulatedText);
            lastSaveTime = now;
          }
        } else if (!pendingRaf) {
          pendingRaf = requestAnimationFrame(() => {
            scheduleContinueRender(true);
          });
        }
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              streamDone = true;
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) { const e = new Error(parsed.error); (e as any).isStreamError = true; throw e; }
              if (parsed.text) {
                accumulatedText += parsed.text;
                scheduleContinueRender(false);
              }
            } catch (e: any) { if (e.isStreamError) throw e; }
          }
        }
      }

      if (pendingRaf) {
        cancelAnimationFrame(pendingRaf);
        pendingRaf = null;
      }

      // Finalize streaming state
      const cleanedContinueText = stripUserPuppeting(accumulatedText, currentPersonaName);
      const finalizedText = cleanedContinueText.trim() ? cleanedContinueText : (accumulatedText.trim() ? accumulatedText : "*(No response generated. Please tap Continue or Regenerate to try again.)*");
      const finalizedMsgs: ChatMessage[] = [
        ...updatedHistory,
        {
          id: aiMsgId,
          role: 'ai',
          text: finalizedText,
          timestamp: timestampStr,
          isStreaming: false,
          alternatives: [finalizedText],
          activeAlternativeIndex: 0,
        },
      ];
      setMessages(finalizedMsgs);
      syncHistory(finalizedMsgs, finalizedText);
      runSceneDetection(finalizedText);
    } catch (err: any) {
      console.error('Continuation error:', err);
      const errMsg = err.message || 'Continuation failed.';
      setErrorMsg(errMsg);
      const erroredMsgs: ChatMessage[] = [
        ...updatedHistory,
        {
          id: aiMsgId,
          role: 'ai',
          text: accumulatedText || `**Error:** ${errMsg}`,
          timestamp: timestampStr,
          isStreaming: false,
          alternatives: [accumulatedText || `**Error:** ${errMsg}`],
          activeAlternativeIndex: 0,
        },
      ];
      setMessages(erroredMsgs);
      syncHistory(erroredMsgs, accumulatedText || 'Continuation error.');
    } finally {
      setIsStreaming(false);
    }
  };

  // Dynamic Background classes based on activeWallpaper
  const bgThemeClass = isLight 
    ? "bg-[#FAFAFA]" 
    : activeWallpaper === 'cosmic'
      ? "bg-gradient-to-tr from-[#0F0C20] via-[#050510] to-[#121214]"
      : activeWallpaper === 'aurora'
        ? "bg-gradient-to-tr from-[#141416] via-[#0D0D0E] to-[#121214]"
        : activeWallpaper === 'neon'
          ? "bg-gradient-to-tr from-[#1E1E21] via-[#080809] to-black"
          : "bg-[#121214]"; // charcoal

  // Wallpaper Button style based on activeWallpaper
  const wallpaperBtnStyle = isLight 
    ? "bg-black/[0.03] hover:bg-black/[0.05] border border-black/[0.06]"
    : activeWallpaper === 'cosmic'
      ? "bg-gradient-to-tr from-zinc-900/30 via-zinc-950/40 to-black/60 border border-zinc-700/30 text-zinc-300 shadow-md"
      : activeWallpaper === 'aurora'
        ? "bg-gradient-to-tr from-zinc-800/20 via-zinc-900/30 to-black/60 border border-white/10 text-zinc-200 shadow-md"
        : activeWallpaper === 'neon'
          ? "bg-gradient-to-tr from-zinc-700/25 via-zinc-850/30 to-black/60 border border-white/15 text-white shadow-md"
          : "bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06]";

  // Chat Bubble custom classes based on activeWallpaper
  const isPerfMode = !!storageConfig?.isPerformanceMode;

  const userBubbleStyle = isLight 
    ? "bg-zinc-900/85 backdrop-blur-xl text-white border border-black/10 shadow-sm"
    : "bg-white/[0.08] backdrop-blur-xl text-white border border-white/[0.12] shadow-sm";

  const aiBubbleStyle = isLight 
    ? "bg-white/80 backdrop-blur-xl text-zinc-900 border border-black/10 shadow-sm"
    : "bg-white/[0.03] backdrop-blur-xl text-white/90 border border-white/[0.08] shadow-sm";

  const isZeroCharactersMode = !!linkedWorld && (!linkedWorld.linkedCharacterIds || linkedWorld.linkedCharacterIds.length === 0);

  // Chat Style Bento Card mapping
  const chatStyleCardBg = isLight
    ? "bg-white border-black/10 text-black shadow-sm"
    : selectedChatStyle === 'seductive'
      ? "bg-gradient-to-tr from-red-950/70 via-[#180003]/80 to-black border-white/20 text-white shadow-[0_4px_20px_rgba(239,68,68,0.15)]"
      : selectedChatStyle === 'adventurous'
        ? "bg-gradient-to-tr from-blue-950/70 via-[#000814]/80 to-black border-white/20 text-white shadow-[0_4px_20px_rgba(59,130,246,0.15)]"
        : "bg-gradient-to-tr from-white/[0.08] to-white/[0.02] border-white/15 text-white"; // general

  const chatStyleLogo = 
    selectedChatStyle === 'seductive'
      ? <Heart className="w-3.5 h-3.5 text-white fill-red-500 animate-pulse" />
      : selectedChatStyle === 'adventurous'
        ? <Compass className="w-3.5 h-3.5 text-white fill-purple-400/10" />
        : <MessageSquareCode className="w-3.5 h-3.5 text-white" />;

  const isPersonaDying = typeof characterState?.status?.health === 'number' && characterState.status.health < 1;

  return (
    <div className={`flex-1 flex flex-col h-full ${bgThemeClass} select-none relative overflow-hidden transition-all duration-500`}>
      <AnimatePresence>
        {isPersonaDying && !characterState?.isGhostMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-text"
          >
            <div className="bg-[#121214] border border-red-500/30 p-6 rounded-[28px] max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />
              
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-3xl shadow-lg">
                💀
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white tracking-tight">Your Persona is Dead</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {currentPersonaName}'s health dropped to 0%. Physical life has ceased and the spirit is parting from the world.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 w-full pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    handleUpdateCharacterState('isGhostMode', '', true);
                    triggerToast("👻 Ghost Mode activated! You can now speak as a spirit.");
                  }}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-purple-500/25 cursor-pointer"
                >
                  <span>👻 Play as Ghost / Spirit</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    handleUpdateCharacterState('status', 'health', 50);
                    handleUpdateCharacterState('isGhostMode', '', false);
                    triggerToast("❤️‍🔥 Death rejected! Health restored to 50%.");
                  }}
                  className="w-full py-3.5 px-4 bg-white/10 hover:bg-white/15 border border-white/15 text-white rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <span>❤️‍🔥 Reject Death (Revive to 50%)</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setShowAdminModal(true);
                  }}
                  className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/20 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <span>⚡ Admin Stat Controls</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ENERGY < 20% EXHAUSTION BANNER */}
      {((characterState?.status?.energy ?? 90) < 20) && (
        <div className="pointer-events-none absolute top-14 left-0 right-0 z-20 flex justify-center px-4">
          <div className="bg-zinc-950/90 border border-amber-500/30 text-amber-200 text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2">
            <span className="text-amber-400 font-bold">⚡</span>
            <span className="font-medium">Extreme Exhaustion (Energy &lt; 20%)</span>
          </div>
        </div>
      )}

      {/* PHONE INTERFACE TOGGLE BUTTON */}
      <button
        type="button"
        onClick={handleOpenPhone}
        title="Open Character Phone"
        className="absolute right-0 top-[calc(50%-5.5rem)] -translate-y-1/2 z-30 flex items-center justify-center w-8 h-20 bg-zinc-950/85 hover:bg-zinc-900 border-y border-l border-white/15 rounded-l-2xl text-white/90 shadow-xl transition-all cursor-pointer group active:scale-95"
      >
        <Smartphone className="w-4 h-4 text-white/80 group-hover:text-white group-hover:scale-110 transition-transform" />
      </button>

      {/* RIGHT DRAWER TOGGLE BUTTON */}
      {!isDrawerOpen && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setIsDrawerOpen(prev => !prev);
          }}
          title="Toggle Status & World Info"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center w-8 h-20 bg-zinc-950/85 hover:bg-zinc-900 border-y border-l border-white/15 rounded-l-2xl text-white/90 shadow-xl transition-all cursor-pointer group active:scale-95"
        >
          <ChevronLeft className="w-4 h-4 text-white/80 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}
      
      {/* Immersive World & Custom Scene Wallpaper Background */}
      {displayedWallpaperUrl && (
        <LiveWallpaperLayer wallpaperUrl={displayedWallpaperUrl} isPerfMode={isPerfMode} />
      )}

      {/* Cinematic Place & Scene Switching Black Fade Layer */}
      <div 
        className={`absolute inset-0 z-[1] bg-black pointer-events-none transition-opacity duration-300 ease-in-out ${
          isBlackFadeActive ? 'opacity-100' : 'opacity-0'
        }`} 
      />
      
      {/* Premium Toast Notification Feedback (Frosted Glass / Blurry-Clear) */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] px-3.5 py-1.5 font-sans font-medium text-[11px] rounded-xl shadow-lg border border-white/15 bg-black/70 backdrop-blur-xl text-white flex items-center gap-2 animate-fadeIn max-w-[90vw]">
          {toastMessage.includes('⚠️') ? (
            <Sparkles className="w-4 h-4 text-white flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
          )}
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Edit Companion Inline Dialog */}
      {isEditingCharacter && (
        <div className="absolute inset-0 bg-[#121214]/95 z-[60] flex flex-col p-6 animate-fadeIn justify-center font-sans">
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-6 shadow-2xl space-y-4 max-w-[90%] mx-auto w-full">
            <h3 className="text-sm font-bold text-white">Edit Companion Settings</h3>
            
            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] text-white/45 font-bold uppercase tracking-wider block mb-1">Companion Name</label>
                <OptimizedInput
                  type="text"
                  value={characterName || ''}
                  onChangeValue={(val) => setCharacterName(val)}
                  onCommit={(val) => setCharacterName(val)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-accent/40 transition-all font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/45 font-bold uppercase tracking-wider block mb-1">Subtitle / Role</label>
                <OptimizedInput
                  type="text"
                  value={characterSubtitle || ''}
                  onChangeValue={(val) => setCharacterSubtitle(val)}
                  onCommit={(val) => setCharacterSubtitle(val)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-accent/40 transition-all font-sans"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingCharacter(false)}
                className="flex-1 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/80 hover:text-white text-xs font-bold active:scale-95 transition-all text-center font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  persona.name = characterName;
                  persona.subtitle = characterSubtitle;
                  setIsEditingCharacter(false);
                  triggerToast("Companion updated successfully");
                }}
                className="flex-1 py-2.5 rounded-2xl bg-accent hover:bg-accent/90 text-white text-xs font-bold active:scale-95 transition-all text-center font-sans border-none cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Environment & Wallpaper Override Modal */}
      {showManualOverrideModal && (
        <div className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-6 animate-fadeIn font-sans">
          <div className={`${isLight ? 'bg-white border-black/10' : 'bg-[#121214] border-white/[0.08]'} rounded-2xl p-5 shadow-2xl max-w-[92%] w-full max-h-[85%] flex flex-col`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'} mb-4`}>
              <div className="flex items-center gap-2">
                <Palette className={`w-4 h-4 ${isLight ? 'text-zinc-800' : 'text-white'}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-black' : 'text-white'}`}>Scene & Wallpaper Controls</span>
              </div>
              <button
                onClick={() => { triggerHaptic(); setShowManualOverrideModal(false); }}
                className={`p-1 rounded-full border transition-all cursor-pointer ${isLight ? 'bg-black/[0.03] hover:bg-black/[0.06] border-black/[0.06] text-black/50 hover:text-black' : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06] text-white/50 hover:text-white'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-none">

              {/* Location & Scene Place Section */}
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-black/50' : 'text-white/50'}`}>Location & Place</div>
                
                {/* Manual location search / input */}
                <div className="flex gap-2">
                  <OptimizedInput
                    type="text"
                    value={worldLocationInput ?? ""}
                    onChangeValue={(val) => setWorldLocationInput(val)}
                    onCommit={(val) => {
                      setWorldLocationInput(val);
                      if (val.trim()) {
                        handleManualPlaceOverride(val.trim());
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && worldLocationInput.trim()) {
                        triggerHaptic();
                        handleManualPlaceOverride(worldLocationInput.trim());
                      }
                    }}
                    placeholder="Type place name (e.g. Rainy Cafe, Cyberpunk Rooftop)..."
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (worldLocationInput.trim()) {
                        triggerHaptic();
                        handleManualPlaceOverride(worldLocationInput.trim());
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-white/90 text-black font-bold text-xs cursor-pointer active:scale-95 transition-all flex items-center gap-1 shadow-sm"
                  >
                    <span>Shift Place</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* General / Default Place option */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      handleManualPlaceOverride('General');
                    }}
                    className={`p-2.5 rounded-xl text-left text-xs transition-all flex flex-col gap-1 border cursor-pointer ${
                      activePlaceName.toLowerCase() === 'general'
                        ? (isLight ? 'bg-zinc-800/10 border-zinc-800/30 text-zinc-800' : 'bg-white/10 border-white/20 text-white')
                        : (isLight ? 'bg-black/[0.03] border-black/[0.08] text-black/70 hover:bg-black/[0.06]' : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.04]')
                    }`}
                  >
                    <span className="font-bold">General</span>
                    <span className="text-[9px] opacity-60">Default fallback location</span>
                  </button>

                  {/* World custom places */}
                  {linkedWorld && (linkedWorld.places || []).filter(p => p.name.toLowerCase() !== 'general').map((p, idx) => (
                    <button
                      key={`override-place-${idx}`}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        handleManualPlaceOverride(p.name);
                      }}
                      className={`p-2.5 rounded-xl text-left text-xs transition-all flex flex-col gap-1 border cursor-pointer ${
                        activePlaceName.toLowerCase() === p.name.toLowerCase()
                          ? (isLight ? 'bg-zinc-800/10 border-zinc-800/30 text-zinc-800' : 'bg-white/10 border-white/20 text-white')
                          : (isLight ? 'bg-black/[0.03] border-black/[0.08] text-black/70 hover:bg-black/[0.06]' : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.04]')
                      }`}
                    >
                      <span className="font-bold truncate">{p.name}</span>
                      <span className="text-[9px] opacity-60 truncate">{p.triggerDescription || 'Custom place'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ambient Sound Section */}
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-black/50' : 'text-white/50'}`}>Ambient Soundscape</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      handleToggleMute();
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isAmbientMuted
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/10 border-white/20 text-white'
                    }`}
                  >
                    {isAmbientMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isAmbientMuted ? "Muted" : "Active"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      handleManualAmbientOverride('General');
                    }}
                    className={`p-2.5 rounded-xl text-left text-xs transition-all flex flex-col gap-1 border cursor-pointer ${
                      activeAmbientName.toLowerCase() === 'general'
                        ? (isLight ? 'bg-zinc-800/10 border-zinc-800/30 text-zinc-800' : 'bg-white/10 border-white/20 text-white')
                        : (isLight ? 'bg-black/[0.03] border-black/[0.08] text-black/70 hover:bg-black/[0.06]' : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.04]')
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1.5">
                      General
                      {activeAmbientName.toLowerCase() === 'general' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-auto" />
                      )}
                    </span>
                    <span className="text-[9px] opacity-60">Silence / Default track</span>
                  </button>

                  {linkedWorld && (linkedWorld.ambientSounds || []).filter(s => s.name.toLowerCase() !== 'general').map((s, idx) => (
                    <button
                      key={`override-ambient-${idx}`}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        handleManualAmbientOverride(s.name);
                      }}
                      className={`p-2.5 rounded-xl text-left text-xs transition-all flex flex-col gap-1 border cursor-pointer ${
                        activeAmbientName.toLowerCase() === s.name.toLowerCase()
                          ? (isLight ? 'bg-zinc-800/10 border-zinc-800/30 text-zinc-800' : 'bg-white/10 border-white/20 text-white')
                          : (isLight ? 'bg-black/[0.03] border-black/[0.08] text-black/70 hover:bg-black/[0.06]' : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.04]')
                      }`}
                    >
                      <span className="font-bold truncate flex items-center gap-1.5 w-full">
                        {s.name}
                        {activeAmbientName.toLowerCase() === s.name.toLowerCase() && !isAmbientMuted && (
                           <Volume2 className="w-3 h-3 ml-auto animate-pulse text-white" />
                        )}
                      </span>
                      <span className="text-[9px] opacity-60 truncate">{s.triggerDescription || 'Custom track'}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { triggerHaptic(); setShowManualOverrideModal(false); }}
              className={`mt-5 w-full py-2.5 active:scale-[0.98] font-bold text-xs rounded-xl transition-all border-none cursor-pointer ${isLight ? 'bg-zinc-800 text-white hover:bg-black' : 'bg-accent text-black hover:bg-accent/80'}`}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* LONG-TERM SITUATION MODAL */}
      {showSituationModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn font-sans">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  {editingSituationIndex !== null ? 'Edit Long-Term Situation' : 'Add Long-Term Situation'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSituationModal(false)}
                className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Title */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Situation Title *
                </label>
                <input
                  type="text"
                  value={situationForm.title || ''}
                  onChange={(e) => setSituationForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Exhausted, Secret Pregnancy, Forbidden Affair, Injured Shoulder"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Type Category */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Category / Type
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['physical', 'romantic', 'medical', 'mental', 'social', 'narrative'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSituationForm(prev => ({ ...prev, type: cat }))}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-semibold capitalize border transition-all cursor-pointer ${
                        situationForm.type === cat
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800/60 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Severity / Intensity
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {['Mild', 'Moderate', 'Intense', 'Critical', 'N/A'].map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSituationForm(prev => ({ ...prev, severity: sev }))}
                      className={`py-1.5 px-1 text-center rounded-xl text-[10px] font-semibold border transition-all cursor-pointer ${
                        situationForm.severity === sev
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800/60 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Duration / Active Period
                </label>
                <input
                  type="text"
                  value={situationForm.duration || ''}
                  onChange={(e) => setSituationForm(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="e.g., Ongoing, 3 Days, Temporary, Permanent"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Description & Context
                </label>
                <textarea
                  rows={3}
                  value={situationForm.description || ''}
                  onChange={(e) => setSituationForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe how this ongoing condition impacts behavior, emotions, physical state, or storylines..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 custom-scrollbar"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10 gap-2">
              {editingSituationIndex !== null ? (
                <button
                  type="button"
                  onClick={() => handleDeleteSituation(editingSituationIndex)}
                  className="py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Delete
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSituationModal(false)}
                  className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium border border-zinc-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSituation}
                  className="py-2.5 px-5 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95"
                >
                  Save Situation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREGNANCY SETTINGS MODAL */}
      {showPregnancyModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn font-sans">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Pregnancy & Fertility Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPregnancyModal(false)}
                className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Selector */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Pregnancy Status
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    'Not Pregnant',
                    'Suspected / Early Signs',
                    'Confirmed',
                    'Visibly Pregnant',
                    'Late Term / Near Birth',
                    'Postpartum'
                  ].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPregnancyForm(prev => ({
                        ...prev,
                        status: st,
                        weeks: st === 'Not Pregnant' ? 0 : (prev.weeks || 4)
                      }))}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold text-left border transition-all cursor-pointer ${
                        pregnancyForm.status === st
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800/60 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gestation Weeks Slider & Input */}
              {pregnancyForm.status !== 'Not Pregnant' && (
                <div className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Gestation Progress (Weeks)
                    </label>
                    <span className="text-xs font-mono font-bold text-white bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                      {pregnancyForm.weeks} Wks ({
                        pregnancyForm.weeks <= 13 ? '1st Trimester' : pregnancyForm.weeks <= 27 ? '2nd Trimester' : '3rd Trimester'
                      })
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={pregnancyForm.weeks ?? 0}
                    onChange={(e) => setPregnancyForm(prev => ({ ...prev, weeks: parseInt(e.target.value) || 0 }))}
                    className="w-full accent-white bg-zinc-800 rounded-lg h-2 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                    <span>0 wks</span>
                    <span>13 wks</span>
                    <span>27 wks</span>
                    <span>40 wks</span>
                  </div>
                </div>
              )}

              {/* Conception Partner / Father */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Conception Partner / Father
                </label>
                <input
                  type="text"
                  value={pregnancyForm.father || ''}
                  onChange={(e) => setPregnancyForm(prev => ({ ...prev, father: e.target.value }))}
                  placeholder="e.g., User, Character Name, Unknown"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Protection Used */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Protection / Contraception Last Used
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                  {['None', 'Protection Used', 'Failed / Bypassed', 'Unknown'].map((prot) => (
                    <button
                      key={prot}
                      type="button"
                      onClick={() => setPregnancyForm(prev => ({ ...prev, protectionUsed: prot }))}
                      className={`py-1.5 px-1 text-center rounded-xl text-[10px] font-semibold border transition-all cursor-pointer ${
                        pregnancyForm.protectionUsed === prot
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800/60 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {prot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Active Symptoms & Physical Signs
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Morning Sickness',
                    'Fatigue',
                    'Cravings',
                    'Mood Swings',
                    'Back Pain',
                    'Baby Bump',
                    'Nausea',
                    'Hormonal Changes'
                  ].map((sym) => {
                    const active = pregnancyForm.symptoms.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => {
                          setPregnancyForm(prev => ({
                            ...prev,
                            symptoms: active
                              ? prev.symptoms.filter(s => s !== sym)
                              : [...prev.symptoms, sym]
                          }));
                        }}
                        className={`py-1 px-2.5 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                          active
                            ? 'bg-white text-black border-white font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}{sym}
                      </button>
                    );
                  })}
                </div>

                {/* Custom symptom input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSymptomInput}
                    onChange={(e) => setCustomSymptomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customSymptomInput.trim()) {
                        e.preventDefault();
                        const s = customSymptomInput.trim();
                        if (!pregnancyForm.symptoms.includes(s)) {
                          setPregnancyForm(prev => ({ ...prev, symptoms: [...prev.symptoms, s] }));
                        }
                        setCustomSymptomInput('');
                      }
                    }}
                    placeholder="Add custom symptom and press enter..."
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customSymptomInput.trim()) {
                        const s = customSymptomInput.trim();
                        if (!pregnancyForm.symptoms.includes(s)) {
                          setPregnancyForm(prev => ({ ...prev, symptoms: [...prev.symptoms, s] }));
                        }
                        setCustomSymptomInput('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Medical / Roleplay Notes
                </label>
                <textarea
                  rows={2}
                  value={pregnancyForm.notes || ''}
                  onChange={(e) => setPregnancyForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Special instructions or narrative background for AI companion..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 custom-scrollbar"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPregnancyForm({
                    status: 'Not Pregnant',
                    weeks: 0,
                    father: 'None',
                    symptoms: [],
                    protectionUsed: 'None',
                    notes: '',
                  });
                }}
                className="py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Reset / Clear
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPregnancyModal(false)}
                  className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium border border-zinc-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePregnancy}
                  className="py-2.5 px-5 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ITEM ON PERSON MODAL */}
      {showItemModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn font-sans">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  {editingItemIndex !== null ? 'Edit Item on Person' : 'Add Item on Person'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Item Name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={itemForm.name || ''}
                  onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Encrypted Smartphone, Silver Pocket Knife, Wallet, ID Badge"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Location / Slot */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Location Carried / Equipped Slot
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {[
                    'Right Pocket',
                    'Left Pocket',
                    'In Hand',
                    'Waist / Belt',
                    'Worn / Clothing',
                    'Backpack / Bag'
                  ].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setItemForm(prev => ({ ...prev, location: loc }))}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-semibold border transition-all cursor-pointer ${
                        itemForm.location === loc
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-800/60 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={itemForm.location || ''}
                  onChange={(e) => setItemForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Or custom location (e.g. Inside Jacket, Holster)..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Quantity & Equipped */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={itemForm.quantity ?? 1}
                    onChange={(e) => setItemForm(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Equipped Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setItemForm(prev => ({ ...prev, equipped: !prev.equipped }))}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      itemForm.equipped
                        ? 'bg-white text-black border-white'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {itemForm.equipped ? '✓ Equipped / Worn' : 'Not Equipped'}
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Accurate Item Details / Notes
                </label>
                <textarea
                  rows={2}
                  value={itemForm.description || ''}
                  onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe appearance, condition, contents, or special properties..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 custom-scrollbar"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10 gap-2">
              {editingItemIndex !== null ? (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(editingItemIndex)}
                  className="py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Delete Item
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium border border-zinc-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveItem}
                  className="py-2.5 px-5 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95"
                >
                  Save Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MONEY / WALLET MODAL */}
      {showMoneyModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn font-sans">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">$</span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Adjust Wallet Balance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMoneyModal(false)}
                className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Current Wallet Cash ($)
                </label>
                <input
                  type="number"
                  value={moneyInput ?? 0}
                  onChange={(e) => setMoneyInput(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-base font-mono font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[+10, +50, +100, +500, -10, -50].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => setMoneyInput(prev => Math.max(0, prev + delta))}
                    className="py-1 px-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowMoneyModal(false)}
                className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium border border-zinc-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveMoney(moneyInput)}
                className="py-2.5 px-5 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95"
              >
                Update Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* World Tab Bottom Sheet */}
      <AnimatePresence>
        {showBottomSheet && (
          <>
            {/* Drawer Overlay Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/50 z-50 cursor-pointer" 
              onClick={() => {
                triggerHaptic();
                setShowBottomSheet(false);
                setWorldTabSection('grid');
              }}
            />

            {/* World Tab Container */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-x-0 bottom-0 z-50 p-5 pb-7 font-sans bg-[#0d0d0f]/95 backdrop-blur-md border-t border-x border-white/20 rounded-t-[28px] shadow-2xl text-white select-none max-h-[85vh] overflow-y-auto scrollbar-none"
            >
              {/* Top Drag Handle */}
              <div 
                className="w-12 h-1 bg-white/30 hover:bg-white/50 rounded-full mx-auto mb-5 cursor-pointer transition-colors"
                onClick={() => {
                  triggerHaptic();
                  setShowBottomSheet(false);
                  setWorldTabSection('grid');
                }} 
              />

              {/* World Tab Header */}
              <div className="flex items-center justify-between mb-5 px-1">
                <div className="flex items-center gap-2">
                  {worldTabSection !== 'grid' && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        if (['world', 'character', 'communication', 'actions', 'rp_tools', 'chat_tools'].includes(worldTabSection)) {
                          setWorldTabSection('grid');
                        } else if (worldTabSection.startsWith('char_')) {
                          setWorldTabSection('character');
                        } else {
                          setWorldTabSection('world');
                        }
                      }}
                      className="p-1 -ml-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold mr-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                  )}
                  <div className="w-2 h-2 rounded-full bg-white/80" />
                  <span className="text-xs font-bold uppercase tracking-widest text-white/90">
                    {worldTabSection === 'grid' && "World Tab"}
                    {worldTabSection === 'world' && "World Section"}
                    {worldTabSection === 'character' && "Character Details"}
                    {worldTabSection === 'communication' && "Communication Style"}
                    {worldTabSection === 'actions' && "Roleplay Quick Actions"}
                    {worldTabSection === 'rp_tools' && "Role Play Tools"}
                    {worldTabSection === 'chat_tools' && "Chat & System Tools"}
                    {worldTabSection === 'world_calendar' && "Calendar & Time"}
                    {worldTabSection === 'world_location' && "Current Location"}
                    {worldTabSection === 'world_weather' && "Weather & Atmosphere"}
                    {worldTabSection === 'world_relationships' && "Relationships"}
                    {worldTabSection === 'world_reputation' && "World Reputation"}
                    {worldTabSection === 'world_scenes' && "Scenes & Soundscapes"}
                    {worldTabSection === 'char_status' && "Current Status"}
                    {worldTabSection === 'char_activity' && "Activity & Job"}
                    {worldTabSection === 'char_inventory' && "Inventory & Wallet"}
                    {worldTabSection === 'char_appearance' && "Appearance & Traits"}
                    {worldTabSection === 'char_phone' && "Smart Device"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setShowBottomSheet(false);
                    setWorldTabSection('grid');
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* MAIN 4-BUTTON GRID (100% EQUAL BUTTON SIZES) */}
              {worldTabSection === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* 1. World */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('world');
                    }}
                    className="w-full min-h-[84px] py-3.5 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/12 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Globe className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-xs font-bold tracking-wide text-white text-center leading-tight">
                      World
                    </span>
                  </button>

                  {/* 2. Character */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('character');
                    }}
                    className="w-full min-h-[84px] py-3.5 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/12 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <User className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-xs font-bold tracking-wide text-white text-center leading-tight">
                      Character
                    </span>
                  </button>

                  {/* 3. Actions */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('actions');
                    }}
                    className="w-full min-h-[84px] py-3.5 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/12 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Zap className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-xs font-bold tracking-wide text-white text-center leading-tight">
                      Actions
                    </span>
                  </button>

                  {/* 4. Chat tools */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('chat_tools');
                    }}
                    className="w-full min-h-[84px] py-3.5 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/12 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Sliders className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-xs font-bold tracking-wide text-white text-center leading-tight">
                      Chat tools
                    </span>
                  </button>
                </div>
              )}

              {/* WORLD SECTION (6 EQUAL BUTTONS) */}
              {worldTabSection === 'world' && (
                <div className="grid grid-cols-3 gap-3">
                  {/* Calendar */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('world_calendar');
                    }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Calendar className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">
                      Calendar
                    </span>
                  </button>

                  {/* Current Location */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('world_location');
                    }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <MapPin className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">
                      Current Location
                    </span>
                  </button>

                  {/* Weather */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('world_weather');
                    }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <CloudSun className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">
                      Weather
                    </span>
                  </button>

                  {/* Relationships */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('world_relationships');
                    }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Users className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">
                      Relationships
                    </span>
                  </button>

                  {/* Reputation */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('world_reputation');
                    }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Award className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">
                      Reputation
                    </span>
                  </button>

                  {/* Scenes & Music */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setWorldTabSection('world_scenes');
                    }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Palette className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">
                      Scenes & Music
                    </span>
                  </button>
                </div>
              )}

              {/* CHARACTER SUBVIEW */}
              {/* CHARACTER SUBVIEW */}
              {worldTabSection === 'character' && (
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => { triggerHaptic(); setWorldTabSection('char_status'); }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Activity className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">Current Status</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { triggerHaptic(); setWorldTabSection('char_activity'); }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Briefcase className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">Activity</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { triggerHaptic(); setWorldTabSection('char_inventory'); }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Package className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">Inventory</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { triggerHaptic(); setWorldTabSection('char_appearance'); }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Shirt className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">Appearance</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { triggerHaptic(); setWorldTabSection('char_phone'); }}
                    className="aspect-square w-full min-h-[96px] h-24 sm:h-28 flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer transition-all text-center select-none shadow-sm active:scale-[0.96]"
                  >
                    <Smartphone className="w-6 h-6 text-white mb-1.5" />
                    <span className="text-[11px] font-bold tracking-wide text-white text-center leading-tight">Phone</span>
                  </button>
                </div>
              )}

              {/* CHAR STATUS SUBVIEW */}
              {worldTabSection === 'char_status' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Core Vitals & Status</span>
                    
                    {[
                      { key: 'health', label: 'Health', color: 'bg-emerald-400' },
                      { key: 'energy', label: 'Energy', color: 'bg-amber-400' },
                      { key: 'hunger', label: 'Hunger', color: 'bg-amber-400' },
                      { key: 'thirst', label: 'Thirst', color: 'bg-blue-400' },
                      { key: 'hygiene', label: 'Hygiene', color: 'bg-purple-400' },
                      { key: 'mood', label: 'Mood', color: 'bg-pink-400' },
                      { key: 'arousal', label: 'Arousal', color: 'bg-rose-400' }
                    ].map(stat => {
                      const rawVal = characterState?.status?.[stat.key] ?? 100;
                      const numVal = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal)) || 100;
                      const isCritical = numVal < 10;
                      
                      return (
                        <div 
                          key={stat.key} 
                          onClick={() => {
                            triggerHaptic();
                            setShowAdminModal(true);
                          }}
                          className="space-y-1 py-1.5 px-2 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/5 transition-all cursor-pointer group active:scale-[0.98]"
                          title={`Click to adjust ${stat.label}`}
                        >
                          <div className="flex justify-between text-xs">
                            <span className="text-white/70 group-hover:text-white transition-colors">{stat.label} <span className="text-[9px] text-white/30 font-light opacity-0 group-hover:opacity-100 transition-opacity">(Adjust)</span></span>
                            <span className={`font-mono font-bold ${isCritical ? 'text-white animate-pulse' : 'text-white'}`}>
                              {numVal}% {isCritical && '(Critical)'}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full transition-all ${isCritical ? 'bg-red-500' : (stat.color || 'bg-white/80')}`} style={{ width: `${numVal}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* PREGNANCY & FERTILITY MONITOR */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent border border-white/20 space-y-3 shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🍼</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white">Pregnancy & Fertility</span>
                      </div>
                      <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full border border-white/20 font-semibold uppercase">
                        {characterState?.pregnancy?.status || "Not Pregnant"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                      <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-0.5">
                        <span className="text-white/40 text-[10px]">Gestation Period</span>
                        <div className="text-white font-semibold">
                          {characterState?.pregnancy?.weeks ? `${characterState.pregnancy.weeks} Weeks` : '0 Weeks (N/A)'}
                        </div>
                      </div>
                      <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-0.5">
                        <span className="text-white/40 text-[10px]">Father Identity</span>
                        <div className="text-white font-semibold truncate">
                          {characterState?.pregnancy?.father || 'None'}
                        </div>
                      </div>
                    </div>

                    {characterState?.pregnancy?.symptoms && characterState?.pregnancy?.symptoms.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-white/40 text-[10px] block">Active Symptoms</span>
                        <div className="flex flex-wrap gap-1.5">
                          {characterState.pregnancy.symptoms.map((symptom: string, idx: number) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 bg-white/10 border border-white/20 text-white rounded-lg">
                              {symptom}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] bg-white/5 p-2 rounded-xl border border-white/5">
                      <span className="text-white/50">Last Protection Used:</span>
                      <span className="text-white font-medium">{characterState?.pregnancy?.protectionUsed || 'None'}</span>
                    </div>

                    {/* Quick Manual override controls */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <button
                        type="button"
                        onClick={openPregnancyModal}
                        className="w-full py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Adjust Pregnancy Parameters</span>
                      </button>
                    </div>
                  </div>

                  {/* LONG-TERM SITUATIONS */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Long-Term Situations & States</span>
                      <span className="text-[10px] text-white font-bold">Active</span>
                    </div>

                    {(!characterState?.longterm || characterState.longterm.length === 0) ? (
                      <div className="text-center py-4 bg-white/[0.02] rounded-xl border border-dashed border-white/10 px-2">
                        <p className="text-[11px] text-white/40 leading-relaxed">
                          No active long-term conditions. Intimate choices, story skips, or relationship developments will trigger lasting status effects here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {characterState.longterm.map((sit: any, idx: number) => {
                          let typeColor = 'bg-white/10 text-white border-white/20';
                          if (sit.type === 'medical') typeColor = 'bg-white/10 text-white border-white/20';
                          if (sit.type === 'romantic') typeColor = 'bg-white/10 text-white border-white/20';
                          if (sit.type === 'physical') typeColor = 'bg-white/10 text-white border-white/20';

                          return (
                            <div key={idx} className="bg-white/5 p-3 pb-11 rounded-xl border border-white/5 space-y-1 relative">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-semibold text-xs text-white leading-tight">{sit.title}</span>
                                <div className="flex gap-1 items-center">
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded border ${typeColor}`}>
                                    {sit.type}
                                  </span>
                                  {sit.severity && sit.severity !== 'N/A' && (
                                    <span className="text-[8px] bg-white/10 text-white border border-white/20 px-1.5 py-0.5 rounded">
                                      {sit.severity}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-white/60 leading-relaxed">{sit.description}</p>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (characterState.longterm || []).filter((_: any, i: number) => i !== idx);
                                  handleUpdateCharacterState('longterm', '', updated);
                                }}
                                className="absolute bottom-2 right-2 text-[10px] bg-white/10 hover:bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                                title="Remove situation"
                              >
                                Dismiss ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <button 
                      type="button"
                      onClick={() => openSituationModal()}
                      className="w-full py-2 mt-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold transition-all border border-white/10 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Custom Situation</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">World Custom Stats</span>
                    {Object.entries(characterState?.status?.custom || { Mana: 100, Corruption: 0 }).map(([key, val]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-white/70">{key}</span>
                          <span className="text-white font-mono">{String(val)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-white/80 transition-all" style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    ))}
                    <button className="w-full py-2 mt-2 rounded-xl bg-white/10 hover:bg-white/15 text-[10px] text-white/70 font-bold transition-all">
                      + Add Custom Stat
                    </button>
                  </div>
                </div>
              )}

              {/* CHAR ACTIVITY SUBVIEW */}
              {worldTabSection === 'char_activity' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Current Job</span>
                    <OptimizedInput 
                      type="text" 
                      value={characterState?.activity?.job || 'Student'} 
                      onCommit={(val) => handleUpdateCharacterState('activity', 'job', val)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white" 
                    />
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Success Rate</span>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">Performance</span>
                      <span className="text-white font-mono">{characterState?.activity?.successRate || 85}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/80 transition-all" style={{ width: `${characterState?.activity?.successRate || 85}%` }} />
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Schedule</span>
                    <OptimizedTextArea 
                      value={characterState?.activity?.schedule || '08:00 AM - Classes\n03:00 PM - Free time\n08:00 PM - Study'} 
                      onCommit={(val) => handleUpdateCharacterState('activity', 'schedule', val)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white h-24" 
                    />
                  </div>
                </div>
              )}

              {/* CHAR INVENTORY SUBVIEW */}
              {worldTabSection === 'char_inventory' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Wallet</span>
                    <div className="text-lg font-bold text-white">${characterState?.inventory?.money || 150}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Items on Person</span>
                    <div className="flex flex-wrap gap-2">
                      {(characterState?.inventory?.items || ['Smartphone', 'House Keys', 'Student ID']).map((item: string, i: number) => (
                        <div key={i} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-white border border-white/5">
                          {item}
                        </div>
                      ))}
                      <button className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 border border-white/10 border-dashed hover:bg-white/10">
                        + Add Item
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CHAR APPEARANCE SUBVIEW */}
              {worldTabSection === 'char_appearance' && (
                <div className="space-y-4">
                  {['outfit', 'accessories', 'hairstyle', 'makeup', 'products', 'specialFeatures'].map(field => (
                    <div key={field} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block capitalize">
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <OptimizedInput 
                        type="text" 
                        value={characterState?.appearance?.[field] || ''} 
                        onCommit={(val) => handleUpdateCharacterState('appearance', field, val)}
                        placeholder={`Describe ${field}...`}
                        className="w-full bg-transparent text-sm text-white focus:outline-none" 
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* CHAR PHONE SUBVIEW (Launches or configures phone restriction states) */}
              {worldTabSection === 'char_phone' && (
                <div className="space-y-4">
                  {/* Status Indicator */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-white" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Device Status</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        characterState?.phone?.isAccessible !== false 
                          ? 'bg-white/10 text-white border border-white/20'
                          : 'bg-white/10 text-white border border-white/20'
                      }`}>
                        {characterState?.phone?.isAccessible !== false ? 'Accessible' : 'Restricted'}
                      </span>
                    </div>

                    {characterState?.phone?.isAccessible === false ? (
                      <div className="p-3 rounded-xl bg-white/10 border border-white/20 space-y-1.5">
                        <div className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Access Blocked Reason:</span>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed italic">
                          "{characterState?.phone?.accessBlockedReason || 'Device is currently locked or unavailable in this scene.'}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-white/70 leading-relaxed">
                        Device connection is active. You can unlock the companion phone to view chat threads, photos, and socials.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleOpenPhone}
                      className="w-full py-3 rounded-xl bg-white hover:bg-zinc-100 text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <span>{characterState?.phone?.isAccessible !== false ? 'Unlock Device' : 'Attempt to Unlock'}</span>
                    </button>
                  </div>

                  {/* Manual Controls for testing and simulation */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3.5">
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Simulation Controls</h4>
                      <p className="text-[11px] text-white/40 leading-normal">
                        Manually simulate restricted access states to test the companion device behavior.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-xs font-semibold text-white/85">Restrict Phone Access</span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentlyAccessible = characterState?.phone?.isAccessible !== false;
                            handleUpdateCharacterState('phone', 'isAccessible', !currentlyAccessible);
                            if (currentlyAccessible) {
                              handleUpdateCharacterState('phone', 'accessBlockedReason', 'The screen is completely shattered and won\'t turn on.');
                            } else {
                              handleUpdateCharacterState('phone', 'accessBlockedReason', null);
                            }
                            triggerHaptic();
                          }}
                          className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                            characterState?.phone?.isAccessible === false ? 'bg-indigo-500' : 'bg-white/10'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            characterState?.phone?.isAccessible === false ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {characterState?.phone?.isAccessible === false && (
                        <div className="space-y-2.5 pt-1">
                          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">Choose Scenario Preset</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'Shattered Screen', reason: 'The screen is completely shattered and won\'t turn on.' },
                              { label: 'Confiscated', reason: 'Your phone has been confiscated by guards/security.' },
                              { label: 'Hostage/Bound', reason: 'You are bound and cannot reach your phone across the room.' },
                              { label: 'Battery Dead', reason: 'The battery has drained to 0% and is powered off.' },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  handleUpdateCharacterState('phone', 'accessBlockedReason', preset.reason);
                                  triggerHaptic();
                                }}
                                className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                                  characterState?.phone?.accessBlockedReason === preset.reason
                                    ? 'bg-white/10 border-indigo-500 text-white'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">Custom Blocked Reason</label>
                            <input
                              type="text"
                              value={characterState?.phone?.accessBlockedReason || ''}
                              onChange={(e) => handleUpdateCharacterState('phone', 'accessBlockedReason', e.target.value)}
                              placeholder="e.g., Captured in a dark cell..."
                              className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-white/30"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* COMMUNICATION SUBVIEW */}
              {worldTabSection === 'communication' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">Roleplay Style Preset</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'narrative', name: 'Narrative Prose', desc: 'Detailed sensory descriptions' },
                        { id: 'fast', name: 'Fast-Paced Dialogue', desc: 'Short, snappy exchanges' },
                        { id: 'descriptive', name: 'Deep Imagery', desc: 'Atmospheric immersion' },
                        { id: 'classic', name: 'Classic / Formal', desc: 'Poetic, elevated tone' },
                      ].map(style => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            const newStyle = style.id as any;
                            setActiveChatStyle(newStyle);
                            triggerToast(`Chat style updated: ${style.name}`);
                            if (targetHistoryId && onUpdateConfig && storageConfig) {
                              const updated = (storageConfig?.chatHistories || []).map(h =>
                                h.id === targetHistoryId ? { ...h, activeChatStyle: newStyle } : h
                              );
                              onUpdateConfig({ chatHistories: updated });
                            }
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            activeChatStyle === style.id
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs font-bold">{style.name}</div>
                          <div className={`text-[10px] ${activeChatStyle === style.id ? 'text-black/70' : 'text-white/50'}`}>{style.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">Grammatical Perspective</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setActivePerspective('1st');
                          triggerToast("Perspective set to First Person ('I')");
                          if (targetHistoryId && onUpdateConfig && storageConfig) {
                            const updated = (storageConfig?.chatHistories || []).map(h =>
                              h.id === targetHistoryId ? { ...h, activePerspective: '1st' as const } : h
                            );
                            onUpdateConfig({ chatHistories: updated });
                          }
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all text-center ${
                          activePerspective === '1st'
                            ? 'bg-white text-black border-white'
                            : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-xs font-bold">1st Person ("I")</div>
                        <div className={`text-[10px] ${activePerspective === '1st' ? 'text-black/70' : 'text-white/50'}`}>"I walk over to you..."</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setActivePerspective('3rd');
                          triggerToast("Perspective set to Third Person ('He/She')");
                          if (targetHistoryId && onUpdateConfig && storageConfig) {
                            const updated = (storageConfig?.chatHistories || []).map(h =>
                              h.id === targetHistoryId ? { ...h, activePerspective: '3rd' as const } : h
                            );
                            onUpdateConfig({ chatHistories: updated });
                          }
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all text-center ${
                          activePerspective === '3rd'
                            ? 'bg-white text-black border-white'
                            : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-xs font-bold">3rd Person ("He/She")</div>
                        <div className={`text-[10px] ${activePerspective === '3rd' ? 'text-black/70' : 'text-white/50'}`}>"She walks over..."</div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIONS SUBVIEW */}
              {worldTabSection === 'actions' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/70">
                    Select an action or activity below. You will choose how much time you spend doing it, which updates character status & roleplay context!
                  </div>

                  {/* 1. Time & Quick Actions */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white block px-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Time & Quick Actions
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { title: 'Time Skip', desc: 'Advance world time & scene clock' },
                        { title: 'Continue Current Activity', desc: 'Maintain current roleplay action' },
                      ].map(act => (
                        <button
                          key={act.title}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setPendingActionModal({ title: act.title, category: 'Time' });
                          }}
                          className="p-3.5 rounded-xl bg-white/10 hover:bg-white/10 border border-white/20 text-white font-bold text-xs text-left cursor-pointer transition-all active:scale-[0.97]"
                        >
                          <div className="text-white">{act.title}</div>
                          <div className="text-[10px] text-white/50 font-normal mt-0.5">{act.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Activities */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white block px-1 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" /> Activities
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { title: 'Study', icon: '📖', desc: 'Increases knowledge & focus' },
                        { title: 'Work', icon: '💼', desc: 'Earns credits & productivity' },
                        { title: 'Exercise', icon: '🏋️', desc: 'Boosts fitness & energy' },
                        { title: 'Read', icon: '📚', desc: 'Enhances wisdom & lore' },
                        { title: 'Practice Hobby', icon: '🎨', desc: 'Raises hobby skill & mood' },
                      ].map(act => (
                        <button
                          key={act.title}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setPendingActionModal({ title: act.title, category: 'Activities' });
                          }}
                          className="p-3 rounded-xl bg-white/10 hover:bg-white/10 border border-white/20 text-white font-bold text-xs text-left cursor-pointer transition-all active:scale-[0.97]"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{act.icon}</span>
                            <span className="text-white">{act.title}</span>
                          </div>
                          <div className="text-[10px] text-white/50 font-normal mt-0.5">{act.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Planning */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white block px-1 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" /> Planning
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { title: 'Set Daily Goal', desc: 'Set target duration & objective' },
                        { title: 'Plan Schedule', desc: 'Structure upcoming schedule' },
                      ].map(act => (
                        <button
                          key={act.title}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setPendingActionModal({ title: act.title, category: 'Planning' });
                          }}
                          className="p-3.5 rounded-xl bg-white/10 hover:bg-white/10 border border-white/20 text-white font-bold text-xs text-left cursor-pointer transition-all active:scale-[0.97]"
                        >
                          <div className="text-white">{act.title}</div>
                          <div className="text-[10px] text-white/50 font-normal mt-0.5">{act.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CHAT TOOLS SUBVIEW */}
              {worldTabSection === 'chat_tools' && (
                <div className="space-y-2.5">
                  {[
                    {
                      id: 'pinned',
                      title: 'View Pinned Messages',
                      subtitle: `${messages.filter(m => m.isPinned).length || pinnedMessages.length} pinned memory entries`,
                      icon: Pin,
                    },
                    {
                      id: 'memories',
                      title: 'View Manual Memories',
                      subtitle: `${storyMemories.length} active custom context memories`,
                      icon: Brain,
                    },
                    {
                      id: 'switch_persona',
                      title: 'Switch Persona',
                      subtitle: 'Change active persona playing in chat',
                      icon: UserCheck,
                    },
                    {
                      id: 'sessions',
                      title: 'View Chat Sessions',
                      subtitle: 'Browse, switch, or manage saved chat history',
                      icon: History,
                    },
                    ...(linkedWorld ? [{
                      id: 'session_cast',
                      title: 'Manage World Cast',
                      subtitle: `${sessionLinkedCharIds.length} character${sessionLinkedCharIds.length === 1 ? '' : 's'} linked in this world session`,
                      icon: Users,
                    }] : []),
                  ].map(item => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          if (item.id === 'session_cast') {
                            setIsDrawerOpen(false);
                            setShowSessionCastModal(true);
                          } else {
                            setActiveChatToolModal(item.id as any);
                          }
                        }}
                        className="w-full p-3.5 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/15 text-left cursor-pointer transition-all flex items-center justify-between active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                            <ItemIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{item.title}</div>
                            <div className="text-[10.5px] text-white/60 mt-0.5">{item.subtitle}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/40" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* SCENES & MUSIC SUBVIEW */}
              {worldTabSection === 'world_scenes' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 block px-1">Places in World</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(linkedWorld?.places && linkedWorld.places.length > 0 ? linkedWorld.places : [
                        { name: 'Lower Courtyard', image: '' },
                        { name: 'Royal Throne Room', image: '' },
                        { name: 'Shadowy Alleys', image: '' }
                      ]).map(p => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            if (targetHistoryId && onUpdateConfig && storageConfig) {
                              const currentHistories = storageConfig?.chatHistories || [];
                              const updatedHistories = currentHistories.map(h => 
                                h.id === targetHistoryId ? { ...h, activePlaceName: p.name } : h
                              );
                              onUpdateConfig({ chatHistories: updatedHistories });
                              triggerToast(`Scene shifted to ${p.name}`);
                            }
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            activePlaceName.toLowerCase() === p.name.toLowerCase()
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs font-bold">{p.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 block px-1">Ambient Music Tracks</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(linkedWorld?.ambientSounds && linkedWorld.ambientSounds.length > 0 ? linkedWorld.ambientSounds : [
                        { name: 'Courtyard Breeze' },
                        { name: 'Throne Whispers' },
                        { name: 'Midnight Rain' }
                      ]).map(s => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            if (targetHistoryId && onUpdateConfig && storageConfig) {
                              const currentHistories = storageConfig?.chatHistories || [];
                              const updatedHistories = currentHistories.map(h => 
                                h.id === targetHistoryId ? { ...h, activeAmbientName: s.name } : h
                              );
                              onUpdateConfig({ chatHistories: updatedHistories });
                              triggerToast(`Music shifted to ${s.name}`);
                            }
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            activeAmbientName.toLowerCase() === s.name.toLowerCase()
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs font-bold">{s.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CALENDAR SUBVIEW */}
              {worldTabSection === 'world_calendar' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Current World Date & Time</span>
                    <div className="text-sm font-semibold text-white">{worldCalendarInput || "No date set"}</div>
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      AI automatically tracks the in-world time and date during chat. You can manually adjust it below.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">Edit Date & Time</label>
                    <OptimizedInput 
                      type="text"
                      value={worldCalendarInput ?? ""}
                      onChangeValue={(val) => setWorldCalendarInput(val)}
                      onCommit={(val) => setWorldCalendarInput(val)}
                      placeholder="e.g. August 15, 2026 - Afternoon"
                      className="w-full bg-white/10 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        if (targetHistoryId && onUpdateConfig && storageConfig) {
                          const currentHistories = storageConfig?.chatHistories || [];
                          const updatedHistories = currentHistories.map(h => 
                            h.id === targetHistoryId ? { ...h, worldCalendar: worldCalendarInput } : h
                          );
                          onUpdateConfig({ chatHistories: updatedHistories });
                        }
                        triggerToast("Calendar updated & saved");
                      }}
                      className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Calendar Info</span>
                    </button>
                  </div>
                </div>
              )}

              {/* LOCATION SUBVIEW */}
              {worldTabSection === 'world_location' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Current Tracked Location</span>
                    <div className="text-sm font-semibold text-white">{worldLocationInput || "Unspecified Location"}</div>
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      AI updates current location as your characters move through world scenes during roleplay.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">Edit Location</label>
                    <OptimizedInput 
                      type="text"
                      value={worldLocationInput ?? ""}
                      onChangeValue={(val) => setWorldLocationInput(val)}
                      onCommit={(val) => {
                        setWorldLocationInput(val);
                        if (val.trim()) {
                          handleManualPlaceOverride(val.trim());
                        }
                      }}
                      placeholder="e.g. Grand Citadel - Lower Courtyard"
                      className="w-full bg-white/10 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        if (worldLocationInput.trim()) {
                          handleManualPlaceOverride(worldLocationInput.trim());
                        }
                      }}
                      className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Location Info</span>
                    </button>
                  </div>
                </div>
              )}

              {/* WEATHER SUBVIEW */}
              {worldTabSection === 'world_weather' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Current Atmospheric Weather</span>
                    <div className="text-sm font-semibold text-white">{worldWeatherInput || "Clear"}</div>
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      Analyzer and AI dynamically keep track of ambient weather and atmosphere in scene changes.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">Edit Weather</label>
                    <OptimizedInput 
                      type="text"
                      value={worldWeatherInput ?? ""}
                      onChangeValue={(val) => setWorldWeatherInput(val)}
                      onCommit={(val) => setWorldWeatherInput(val)}
                      placeholder="e.g. Clear skies, gentle breeze, 22°C"
                      className="w-full bg-white/10 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        if (targetHistoryId && onUpdateConfig && storageConfig) {
                          const currentHistories = storageConfig?.chatHistories || [];
                          const updatedHistories = currentHistories.map(h => 
                            h.id === targetHistoryId ? { ...h, worldWeather: worldWeatherInput } : h
                          );
                          onUpdateConfig({ chatHistories: updatedHistories });
                        }
                        triggerToast("Weather updated & saved");
                      }}
                      className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Weather Info</span>
                    </button>
                  </div>
                </div>
              )}

              {/* RELATIONSHIPS SUBVIEW */}
              {worldTabSection === 'world_relationships' && (() => {
                const availableCharacters: Persona[] = [];
                const seen = new Set<string>();
                const allKnown = [...PERSONAS, ...(storageConfig?.characters || [])];

                // 1. Linked World Characters (exclude any world profile objects)
                if (linkedWorld) {
                  if (linkedWorld.linkedCharacterIds && Array.isArray(linkedWorld.linkedCharacterIds)) {
                    linkedWorld.linkedCharacterIds.forEach((cid: string) => {
                      const found = allKnown.find(item => item.id === cid && !item.id.startsWith('world-'));
                      if (found && !seen.has(found.id)) {
                        availableCharacters.push(found);
                        seen.add(found.id);
                      }
                    });
                  }
                  if ((linkedWorld as any).characters && Array.isArray((linkedWorld as any).characters)) {
                    (linkedWorld as any).characters.forEach((c: any) => {
                      if (c && c.id && !c.id.startsWith('world-') && !seen.has(c.id)) {
                        availableCharacters.push(c);
                        seen.add(c.id);
                      }
                    });
                  }
                }

                // 2. Active persona if real character
                if (persona && persona.id && !persona.id.startsWith('world-') && !seen.has(persona.id)) {
                  availableCharacters.push(persona);
                  seen.add(persona.id);
                }

                // 3. Fallback to activeTargetCharacter if real character
                if (availableCharacters.length === 0 && activeTargetCharacter && !activeTargetCharacter.id.startsWith('world-')) {
                  availableCharacters.push(activeTargetCharacter);
                  seen.add(activeTargetCharacter.id);
                }

                const activeRelChar = availableCharacters.find(c => c.id === selectedRelCharId) || availableCharacters[0] || (activeTargetCharacter && !activeTargetCharacter.id.startsWith('world-') ? activeTargetCharacter : null);

                if (!activeRelChar) {
                  return (
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2">
                      <div className="text-sm font-bold text-white/90">No Characters Linked</div>
                      <p className="text-xs text-white/50 leading-relaxed">
                        There are currently no characters linked to this world. Link characters in the World settings to track individual relationship dynamics.
                      </p>
                    </div>
                  );
                }

                const charScores = charRelScores[activeRelChar.id] || getInitialCharScores(activeRelChar.id, activeRelChar.name);

                const METRIC_DEFS = [
                  { 
                    key: 'attraction', 
                    label: 'Attraction', 
                    icon: '💖',
                    color: 'text-white',
                    gradient: 'from-pink-500 to-rose-400',
                    getDesc: (v: number) => v <= 2 ? 'Indifferent' : v <= 4 ? 'Curious' : v <= 6 ? 'Flirtatious' : v <= 8 ? 'Infatuated' : 'Deeply In Love'
                  },
                  { 
                    key: 'lust', 
                    label: 'Lust', 
                    icon: '🫦',
                    color: 'text-white',
                    gradient: 'from-fuchsia-500 to-pink-500',
                    getDesc: (v: number) => v <= 2 ? 'Apathetic' : v <= 4 ? 'Teased' : v <= 6 ? 'Desirous' : v <= 8 ? 'Lustful' : 'Carnal Obsession'
                  },
                  { 
                    key: 'friendship', 
                    label: 'Friendship', 
                    icon: '🤝',
                    color: 'text-white',
                    gradient: 'from-emerald-500 to-teal-400',
                    getDesc: (v: number) => v <= 2 ? 'Distant' : v <= 4 ? 'Acquaintance' : v <= 6 ? 'Friendly' : v <= 8 ? 'Close Friend' : 'Soulmate'
                  },
                  { 
                    key: 'trust', 
                    label: 'Trust', 
                    icon: '🛡️',
                    color: 'text-sky-400',
                    gradient: 'from-sky-500 to-blue-400',
                    getDesc: (v: number) => v <= 2 ? 'Suspicious' : v <= 4 ? 'Cautious' : v <= 6 ? 'Trusting' : v <= 8 ? 'Confidant' : 'Unwavering Faith'
                  },
                  { 
                    key: 'respect', 
                    label: 'Respect', 
                    icon: '👑',
                    color: 'text-white',
                    gradient: 'from-amber-500 to-yellow-400',
                    getDesc: (v: number) => v <= 2 ? 'Disdainful' : v <= 4 ? 'Unimpressed' : v <= 6 ? 'Respectful' : v <= 8 ? 'Esteemed' : 'Revered Icon'
                  },
                  { 
                    key: 'loyalty', 
                    label: 'Loyalty', 
                    icon: '⚜️',
                    color: 'text-white',
                    gradient: 'from-indigo-500 to-purple-400',
                    getDesc: (v: number) => v <= 2 ? 'Fickle' : v <= 4 ? 'Uncommitted' : v <= 6 ? 'Reliable' : v <= 8 ? 'Devoted Ally' : 'Sworn Defender'
                  },
                  { 
                    key: 'fear', 
                    label: 'Fear', 
                    icon: '⚡',
                    color: 'text-white',
                    gradient: 'from-purple-600 to-fuchsia-500',
                    getDesc: (v: number) => v <= 2 ? 'Unfazed' : v <= 4 ? 'Wary' : v <= 6 ? 'Intimidated' : v <= 8 ? 'Terrified' : 'Petrified'
                  },
                  { 
                    key: 'anger', 
                    label: 'Anger', 
                    icon: '💥',
                    color: 'text-white',
                    gradient: 'from-rose-600 to-red-600',
                    getDesc: (v: number) => v <= 2 ? 'Calm' : v <= 4 ? 'Annoyed' : v <= 6 ? 'Irritated' : v <= 8 ? 'Furious' : 'Enraged'
                  },
                  { 
                    key: 'rivalry', 
                    label: 'Rivalry', 
                    icon: '⚔️',
                    color: 'text-orange-400',
                    gradient: 'from-orange-500 to-amber-600',
                    getDesc: (v: number) => v <= 2 ? 'Friendly Match' : v <= 4 ? 'Competitive' : v <= 6 ? 'Fierce Rival' : v <= 8 ? 'Bitter Rival' : 'Archenemy'
                  },
                ];

                const metrics = METRIC_DEFS.map(d => ({
                  ...d,
                  value: (charScores as any)[d.key] ?? 5,
                  desc: d.getDesc((charScores as any)[d.key] ?? 5)
                }));

                // Calculate Dominant Emotional Mood Disposition
                let dominantMood = '😊 Calm & Observant';
                let dominantBg = 'from-indigo-500/10 to-blue-500/10 border-white/20';
                
                if (charScores.anger >= 7) {
                  dominantMood = `🔥 Furious & Resentful (${charScores.anger}/10 Anger)`;
                  dominantBg = 'from-rose-500/20 to-red-600/20 border-white/20';
                } else if (charScores.lust >= 8) {
                  dominantMood = `🫦 Overcome with Lust & Passion (${charScores.lust}/10 Lust)`;
                  dominantBg = 'from-fuchsia-500/20 to-pink-500/20 border-white/20';
                } else if (charScores.attraction >= 8) {
                  dominantMood = `💘 Deeply Enamored & Infatuated (${charScores.attraction}/10 Attraction)`;
                  dominantBg = 'from-pink-500/20 to-rose-500/20 border-white/20';
                } else if (charScores.fear >= 7) {
                  dominantMood = `⚡ Terrified & Apprehensive (${charScores.fear}/10 Fear)`;
                  dominantBg = 'from-purple-500/20 to-fuchsia-600/20 border-white/20';
                } else if (charScores.respect <= 2 && charScores.anger >= 4) {
                  dominantMood = `😤 Disdainful & Unimpressed (${charScores.respect}/10 Respect)`;
                  dominantBg = 'from-amber-500/20 to-orange-600/20 border-white/20';
                } else if (charScores.trust >= 8 && charScores.friendship >= 8) {
                  dominantMood = `✨ Devoted & Deeply Trusted Companion (${charScores.trust}/10 Trust)`;
                  dominantBg = 'from-emerald-500/20 to-teal-500/20 border-white/20';
                } else if (charScores.rivalry >= 7) {
                  dominantMood = `⚔️ Fiercely Competitive Rival (${charScores.rivalry}/10 Rivalry)`;
                  dominantBg = 'from-orange-500/20 to-amber-500/20 border-orange-500/30';
                } else if (charScores.respect >= 8) {
                  dominantMood = `👑 Highly Revered & Respected (${charScores.respect}/10 Respect)`;
                  dominantBg = 'from-amber-500/20 to-yellow-500/20 border-white/20';
                }

                const updateMetricScore = (metricKey: string, newValue: number, commit = true) => {
                  const val = Math.max(1, Math.min(10, Math.round(newValue)));
                  triggerHaptic();

                  setCharRelScores(prev => {
                    const existingScores = prev[activeRelChar.id] || charScores;
                    if ((existingScores as any)[metricKey] === val) return prev;

                    const nextCharScores = {
                      ...existingScores,
                      [metricKey]: val
                    };
                    const nextAllScores = {
                      ...prev,
                      [activeRelChar.id]: nextCharScores
                    };

                    if (commit && targetHistoryId && onUpdateConfig && storageConfig) {
                      setTimeout(() => {
                        const currentHistories = storageConfig?.chatHistories || [];
                        const updatedHistories = currentHistories.map(h => 
                          h.id === targetHistoryId ? { ...h, relationshipScores: nextAllScores } : h
                        );
                        onUpdateConfig({ chatHistories: updatedHistories });
                      }, 0);
                    }

                    return nextAllScores;
                  });
                };

                const commitMetricScores = () => {
                  if (targetHistoryId && onUpdateConfig && storageConfig) {
                    const currentHistories = storageConfig?.chatHistories || [];
                    const updatedHistories = currentHistories.map(h => 
                      h.id === targetHistoryId ? { ...h, relationshipScores: charRelScores } : h
                    );
                    onUpdateConfig({ chatHistories: updatedHistories });
                  }
                };

                return (
                  <div className="space-y-3.5">
                    {/* Character Picker */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block px-1">Linked Characters</label>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {availableCharacters.map(charItem => {
                          const isSelected = charItem.id === activeRelChar.id;
                          return (
                            <button
                              key={charItem.id}
                              type="button"
                              onClick={() => {
                                triggerHaptic();
                                setSelectedRelCharId(charItem.id);
                              }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                                isSelected 
                                  ? 'bg-white text-black border-white' 
                                  : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {charItem.avatar ? (
                                <SafeImage src={charItem.avatar} className="w-5 h-5 rounded-full object-cover" alt="" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                                  {charItem.name.charAt(0)}
                                </div>
                              )}
                              <span>{charItem.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Character Relationship Header & Dominant Disposition */}
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                      <div className="flex items-center gap-3">
                        {activeRelChar.avatar ? (
                          <SafeImage src={activeRelChar.avatar} className="w-10 h-10 rounded-xl object-cover border border-white/15" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-bold text-white">
                            {activeRelChar.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold text-white">{activeRelChar.name}'s Attitude toward You</div>
                          <div className="text-[10px] text-white/50">User Persona: {activeUserPersona?.name || currentPersonaName}</div>
                        </div>
                      </div>

                      {/* Dominant Emotional Disposition Banner */}
                      <div className={`p-2.5 rounded-xl border bg-gradient-to-r ${dominantBg} flex items-center justify-between`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Current Disposition</div>
                        <div className="text-xs font-bold text-white">{dominantMood}</div>
                      </div>
                    </div>

                    {/* 8 Relationship Rating Bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {metrics.map(m => (
                        <div key={m.label} className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                              <span>{m.icon}</span>
                              <span className={m.color}>{m.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white/10 text-white/90 border border-white/10">
                                {m.desc}
                              </span>
                              <span className="font-mono text-white/90 text-xs font-bold w-6 text-center">{m.value}/10</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => updateMetricScore(m.key, m.value - 1, true)}
                              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-transform flex-shrink-0"
                            >
                              -
                            </button>

                            <div className="relative flex-1 flex items-center">
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={m.value}
                                onChange={(e) => updateMetricScore(m.key, Number(e.target.value), false)}
                                onMouseUp={commitMetricScores}
                                onTouchEnd={commitMetricScores}
                                className="w-full h-2 rounded-lg bg-white/10 appearance-none cursor-pointer accent-purple-400 touch-pan-x"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => updateMetricScore(m.key, m.value + 1, true)}
                              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-transform flex-shrink-0"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* REPUTATION SUBVIEW */}
              {worldTabSection === 'world_reputation' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Current Standing & Reputation</span>
                    <div className="text-sm font-semibold text-white">{worldReputationInput || "Neutral"}</div>
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      Your standing in this world influences how factions, characters, and authorities treat you.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">Edit Reputation</label>
                    <input 
                      type="text"
                      value={worldReputationInput ?? ""}
                      onChange={(e) => setWorldReputationInput(e.target.value)}
                      placeholder="e.g. Honored Guest (7/10)"
                      className="w-full bg-white/10 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        if (targetHistoryId && onUpdateConfig && storageConfig) {
                          const currentHistories = storageConfig?.chatHistories || [];
                          const updatedHistories = currentHistories.map(h => 
                            h.id === targetHistoryId ? { ...h, worldReputation: worldReputationInput } : h
                          );
                          onUpdateConfig({ chatHistories: updatedHistories });
                        }
                        triggerToast("Reputation updated & saved");
                      }}
                      className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Reputation Info</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Top Chat Header */}
      <div className={`p-2.5 px-5 backdrop-blur-sm border-b flex items-center justify-between z-10 shadow-sm ${isLight ? 'bg-white/90 border-black/10' : 'bg-[#121215]/90 border-white/[0.08]'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`p-2 -ml-2 rounded-full active:scale-[0.88] transition-all duration-100 animate-scaleIn ${isLight ? 'hover:bg-black/5 text-black/40' : 'hover:bg-white/[0.08] text-white/50 hover:text-white'}`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div 
            onClick={() => {
              triggerHaptic();
              if (linkedWorld && persona.id.startsWith('world-')) {
                setShowWorldProfile(true);
              } else if (!isZeroCharactersMode) {
                setShowProfile(true);
              } else if (linkedWorld) {
                setShowWorldProfile(true);
              }
            }}
            className={`flex items-center gap-2.5 cursor-pointer p-1 px-1.5 rounded-xl transition-all active:scale-[0.98] ${isLight ? 'hover:bg-black/5' : 'hover:bg-white/[0.04]'}`}
            title="View Profile"
          >
            <div className="relative">
              {linkedWorld && linkedWorld.coverImage ? (
                <SafeImage
                    src={linkedWorld.coverImage}
                    className={`w-8 h-8 rounded-lg object-cover border shadow-sm ${isLight ? 'border-black/10' : 'border-white/[0.1]'}`}
                    alt={linkedWorld.name}
                />
              ) : linkedWorld ? (
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/30 border flex items-center justify-center shadow-sm ${isLight ? 'border-black/10' : 'border-white/[0.08]'}`}>
                  <Globe className="w-4 h-4 text-white/40" />
                </div>
              ) : isZeroCharactersMode ? (
                <div className={`w-8 h-8 rounded-lg bg-white/[0.04] border flex items-center justify-center shadow-sm ${isLight ? 'border-black/10' : 'border-white/[0.08]'}`}>
                    <User className="w-4 h-4 text-white/20" />
                </div>
              ) : persona.avatar ? (
                <SafeImage 
                  src={persona.avatar} 
                  className={`w-8 h-8 rounded-lg object-cover border shadow-sm ${isLight ? 'border-black/10' : 'border-white/[0.1]'}`} 
                  alt={characterName}
                />
              ) : (
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${persona.avatarGradient} border flex items-center justify-center shadow-sm ${isLight ? 'border-black/10' : 'border-white/[0.08]'}`}>
                  <span className="text-white font-bold text-xs">{characterName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            
            <div className="font-sans flex flex-col justify-center -space-y-0.5">
              <div className={`text-[11px] font-bold tracking-wide leading-tight ${isLight ? 'text-black' : 'text-white'}`}>
                {linkedWorld ? linkedWorld.name : (isZeroCharactersMode ? "No Character Linked" : characterName)}
              </div>
              <div className={`text-[8.5px] font-medium tracking-wide flex items-center gap-1 opacity-60 ${isLight ? 'text-black' : 'text-white'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
                <span>{linkedWorld ? "Active Scene" : "Active Dialogue"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 z-20">
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-xl p-0.5 shadow-sm">
            <button
              onClick={() => { triggerHaptic(); setShowManualOverrideModal(true); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-[0.95] cursor-pointer ${
                isLight 
                  ? 'hover:bg-black/5 text-zinc-700' 
                  : 'hover:bg-white/[0.08] text-white hover:text-white'
              }`}
              title="Scene & Wallpaper Controls"
            >
              <Palette className="w-3.5 h-3.5 text-white" />
              <span className="text-[9px] font-bold uppercase tracking-wider hidden xs:inline">Scene</span>
            </button>

            <div className="w-[1px] h-3 bg-white/10 mx-0.5" />

            <button
              onClick={() => { triggerHaptic(); handleToggleMute(); }}
              className={`p-1.5 px-2 rounded-lg transition-all active:scale-[0.95] cursor-pointer ${
                isAmbientMuted 
                  ? (isLight ? 'text-white' : 'text-white')
                  : (isLight ? 'text-zinc-700 hover:text-black' : 'text-white hover:text-white')
              }`}
              title={isAmbientMuted ? "Unmute Ambient" : "Mute Ambient"}
            >
              {isAmbientMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <div className="w-[1px] h-3 bg-white/10 mx-0.5" />

            <button
              type="button"
              onClick={handleClearChat}
              className={`p-1.5 px-2 rounded-lg transition-all active:scale-[0.95] cursor-pointer flex items-center gap-1 ${
                isLight 
                  ? 'hover:bg-red-50 text-red-600' 
                  : 'hover:bg-red-500/20 text-red-400 hover:text-red-300'
              }`}
              title="Clear Chat History for this character"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[9px] font-bold uppercase tracking-wider hidden sm:inline">Clear</span>
            </button>
          </div>

          {isStreaming && (
            <RefreshCw className={`w-3 h-3 animate-spin mx-1 ${isLight ? 'text-black/40' : 'text-white/40'}`} />
          )}
        </div>
      </div>

      {linkedWorld && (
        <div className={`py-1.5 px-4 flex items-center gap-2 overflow-x-auto scrollbar-none border-b backdrop-blur-xl z-10 select-none ${
          isLight ? 'bg-white/70 border-black/5 text-black' : 'bg-white/5 border-white/10 text-white'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-black/50' : 'text-white/50'} whitespace-nowrap shrink-0`}>
            World Cast ({sessionLinkedCharIds.length}):
          </span>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 min-w-0">
            {(() => {
              const allCompanions = [...PERSONAS, ...(storageConfig?.characters || [])];
              const linkedChars = allCompanions.filter(c => sessionLinkedCharIds.includes(c.id));
              if (linkedChars.length === 0) return <span className="text-[10px] text-amber-400/80 italic font-medium whitespace-nowrap">Solo World (No characters linked)</span>;
              
              return linkedChars.map((char) => {
                const isDead = deadCharacterIds.has(char.id);
                return (
                  <div 
                    key={char.id}
                    onClick={() => {
                      triggerHaptic();
                      setViewedCompanionProfile(char);
                      setShowProfile(true);
                    }}
                    className={`flex items-center gap-1.5 p-1 px-2.5 rounded-full border text-[10px] font-semibold active:scale-[0.95] cursor-pointer transition-all shrink-0 backdrop-blur-md ${
                      isDead
                        ? (isLight 
                            ? 'bg-rose-50/50 border-rose-200/50 text-white/60 grayscale opacity-60' 
                            : 'bg-rose-950/25 border-rose-900/30 text-white/60 grayscale opacity-60')
                        : (isLight 
                            ? 'bg-black/5 hover:bg-black/10 border-black/10 text-zinc-900 shadow-sm' 
                            : 'bg-white/10 hover:bg-white/15 border-white/15 text-white shadow-sm')
                    }`}
                  >
                    {char.avatar ? (
                      <SafeImage 
                        src={char.avatar} 
                        className={`w-4 h-4 rounded-full object-cover ${isDead ? 'grayscale filter border border-white/20' : ''}`} 
                        alt={char.name}
                      />
                    ) : (
                      <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${isDead ? 'from-zinc-600 to-zinc-800' : (char.avatarGradient || 'from-indigo-500 to-purple-600')} flex items-center justify-center text-[8px] text-white font-bold`}>
                        {isDead ? '💀' : (char.avatarEmoji || char.name.charAt(0).toUpperCase())}
                      </div>
                    )}
                    <span className="truncate max-w-[100px]">{char.name}</span>
                    {isDead && (
                      <span className="text-[8px] scale-90 leading-none" title="Deceased">💀</span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}


      {/* Error Alert Banner if needed */}
      {errorMsg && (
        <div className="bg-white/10 border-b border-white/20 px-4 py-2.5 flex items-center gap-2 text-[11px] text-white font-sans font-light tracking-wide">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-white" />
          <span className="truncate flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="underline font-bold hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <ChatMessageList
        scrollContainerRef={scrollContainerRef}
        messagesEndRef={messagesEndRef}
        handleContainerScroll={handleContainerScroll}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        messages={messages}
        linkedWorld={linkedWorld}
        isZeroCharactersMode={isZeroCharactersMode}
        currentPersonaName={currentPersonaName}
        allCompanions={allCompanions}
        characterName={characterName}
        persona={persona}
        activeUserPersona={activeUserPersona}
        chatLayout={chatLayout}
        isLight={isLight}
        userBubbleStyle={userBubbleStyle}
        aiBubbleStyle={aiBubbleStyle}
        selectedMessageForMenu={selectedMessageForMenu}
        handleMessageClick={handleMessageClick}
        storageConfig={storageConfig}
        editingMessageId={editingMessageId}
        setEditingMessageId={setEditingMessageId}
        setMessages={setMessages}
        triggerToast={triggerToast}
        triggerHaptic={triggerHaptic}
        activeHistoryId={activeHistoryId}
        historyId={historyId}
        setActiveHistoryId={setActiveHistoryId}
        onSaveHistory={onSaveHistory}
        handleRetryMessage={handleRetryMessage}
        isStreaming={isStreaming}
        parsedWorldMessagesCacheRef={parsedWorldMessagesCacheRef}
        lastHistoryIdRef={lastHistoryIdRef}
      />

      {/* Suggested Prompts if only welcome message */}
      {messages.length === 1 && !isStreaming && isRepliesEnabled && (
        <div className="px-5 pb-2 font-sans">
          <div className="text-[10px] font-sans font-light uppercase tracking-wider text-[#666] mb-2 px-1">
            Suggested Prompts
          </div>
          <div className="flex flex-wrap gap-2">
            {(persona.suggestedPrompts || []).map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="px-3 py-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/[0.08] text-[11px] text-[#CCC] hover:text-white text-left transition-all active:scale-[0.96] duration-100 shadow-sm font-sans font-normal tracking-wide"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image Upload preview banner */}
      {selectedImage && (
        <div className="px-5 pt-1.5 pb-0 flex items-center justify-between font-sans">
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl p-1.5 pr-3 relative">
            <img src={selectedImage} alt="Attached" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-[10px] text-white/60 font-sans">{selectedImageName || 'photo.jpg'}</span>
            <button
              type="button"
              onClick={() => {
                setSelectedImage(null);
                setSelectedImageName(null);
              }}
              className="w-4 h-4 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white/80 absolute -top-1.5 -right-1.5 shadow-sm border border-white/10"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}

      {/* Emoji Sticker Tray overlay */}
      {showEmojiPicker && (
        <div className="px-5 pt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none font-sans bg-white/[0.01] border-b border-white/[0.03]">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleInsertEmoji(emoji)}
              className="w-7 h-7 flex items-center justify-center text-sm rounded-lg bg-white/[0.03] hover:bg-white/[0.08] active:scale-90 transition-all flex-shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Pill Styled Input Bar Container */}
      <div className="px-4 pt-2 pb-6 sm:pb-8 font-sans flex flex-col items-center transition-all duration-500 bg-transparent">
        {isStreaming && !showBottomSheet && (
          <div className="fixed bottom-28 left-0 right-0 flex justify-center z-30 pointer-events-none">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-[20px] backdrop-blur-md animate-fade-in border ${
              isLight
                ? 'bg-black/[0.04] border-black/5 shadow-sm text-black/80'
                : 'bg-white/[0.06] border-white/5 shadow-sm text-white/80'
            }`}>
              <span className="text-[12px] font-medium tracking-wide">Thinking</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full animate-bounce ${isLight ? 'bg-black/60' : 'bg-white/60'}`} style={{ animationDuration: '0.8s', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Dynamic Suggested Answers Panel */}
        <AnimatePresence>
          {isRepliesEnabled && showSuggestedAnswers && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="w-full overflow-hidden mb-4"
            >
              <div className="flex flex-col gap-2 px-1">
                <div className="flex items-center justify-between text-[9.5px] uppercase tracking-widest text-white/50 font-extrabold px-0.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#7c5cfc] drop-shadow-[0_0_8px_rgba(124,92,252,0.5)]" />
                    <span>Smart Replies</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSuggestedAnswers(false)}
                    className="hover:text-white transition-all text-[9.5px] cursor-pointer opacity-60 hover:opacity-100"
                  >
                    Hide
                  </button>
                </div>
                <div className="flex items-center gap-2.5 overflow-x-auto py-1.5 scrollbar-none snap-x pr-4">
                  {getSuggestedAnswers().map((ans, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setExternalInputText(ans);
                        setShowSuggestedAnswers(false);
                      }}
                      className="flex-shrink-0 snap-start px-4 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] active:bg-white/15 border border-white/[0.08] hover:border-white/20 text-[11px] text-white/90 hover:text-white font-sans transition-all active:scale-[0.97] shadow-lg max-w-[280px] truncate cursor-pointer"
                    >
                      {ans}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <IsolatedChatInput
          characterName={characterName}
          isLight={isLight}
          isStreaming={isStreaming}
          isRepliesEnabled={isRepliesEnabled}
          isPerformanceMode={storageConfig?.isPerformanceMode}
          showSuggestedAnswers={showSuggestedAnswers}
          setShowSuggestedAnswers={setShowSuggestedAnswers}
          selectedImage={selectedImage}
          setSelectedImage={handleSelectRealImage}
          setShowBottomSheet={setShowBottomSheet}
          onSendMessage={handleSendMessage}
          onContinueConversation={handleContinueConversation}
          messagesLength={messages.length}
          externalText={externalInputText}
          onExternalTextConsumed={handleExternalTextConsumed}
        />

      </div>

      {/* ADMIN STAT & REALISM MODAL */}
      <AnimatePresence>
        {showAdminModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-text"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121214] border border-white/15 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 text-white max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                    ⚡
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">Admin Stat & Realism Controls</h3>
                    <p className="text-[10px] text-white/50">Adjust Persona status bars & repair chat history</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sliders for Persona Stats */}
              <div className="space-y-3 pt-1">
                {[
                  { label: '⚡ Energy', key: 'energy' },
                  { label: '💧 Thirst', key: 'thirst' },
                  { label: '🍗 Hunger', key: 'hunger' },
                  { label: '❤️ Health', key: 'health' },
                  { label: '🧼 Hygiene', key: 'hygiene' },
                  { label: '😊 Mood', key: 'mood' },
                ].map(stat => {
                  const rawVal = characterState?.status?.[stat.key as keyof typeof characterState.status] ?? 100;
                  const val = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal)) || 100;
                  return (
                    <div key={stat.key} className="space-y-1 bg-white/[0.03] p-2.5 rounded-2xl border border-white/[0.06]">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white/90">{stat.label}</span>
                        <span className="font-mono font-bold text-amber-300">{val}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={val}
                        onChange={(e) => handleUpdateCharacterState('status', stat.key, parseInt(e.target.value))}
                        className="w-full accent-amber-400 bg-white/10 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Quick Presets */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Quick Test Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleBatchRestoreAllStatus}
                    className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>🌟 Full Restore</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      handleUpdateCharacterState('status', 'energy', 10);
                      triggerToast("⚡ Energy set to 10% (Exhaustion Overlay Active)");
                    }}
                    className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>⚡ Exhausted (10%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      handleUpdateCharacterState('status', 'thirst', 10);
                      triggerToast("💧 Thirst set to 10% (Voice Impaired)");
                    }}
                    className="py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>💧 Dehydrated (10%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      handleUpdateCharacterState('status', 'hunger', 10);
                      triggerToast("🍗 Hunger set to 10% (Physical Weakness Active)");
                    }}
                    className="py-2 px-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>🍗 Starving (10%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      handleUpdateCharacterState('status', 'hygiene', 10);
                      triggerToast("🧼 Hygiene set to 10% (Unpleasant Smell / NPC Avoidance)");
                    }}
                    className="py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>🧼 Filthy (10%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      handleUpdateCharacterState('status', 'mood', 10);
                      triggerToast("🌧️ Mood set to 10% (Forced Smiles)");
                    }}
                    className="py-2 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>🌧️ Depressed (10%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      handleUpdateCharacterState('status', 'health', 0);
                      triggerToast("💀 Health set to 0% (Persona Death)");
                    }}
                    className="py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2"
                  >
                    <span>💀 Trigger Persona Death (Health 0%)</span>
                  </button>
                </div>
              </div>

              {/* Repair & Clear Chat History Buttons */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Chat Session Recovery & Storage</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRepairChatHistory}
                    className="py-3 px-3 rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-400/40 text-indigo-100 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg"
                  >
                    <span>🛠️ Repair History</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminModal(false);
                      handleClearChat();
                    }}
                    className="py-3 px-3 rounded-2xl bg-rose-600/30 hover:bg-rose-600/40 border border-rose-400/40 text-rose-100 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                    <span>🗑️ Clear Chat History</span>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="py-2 px-5 bg-white text-black font-bold text-xs rounded-xl hover:bg-white/90 transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Options Context Menu overlay (Non-animated for instant performance) */}
      {selectedMessageForMenu && (
        <div className="absolute inset-0 z-[60] flex flex-col justify-end overflow-hidden animate-none">
          {/* Backdrop Dimmer */}
          <div
            className="absolute inset-0 bg-black/60 cursor-pointer backdrop-blur-[2px]"
            onClick={() => setSelectedMessageForMenu(null)}
          />
          {/* Bottom Sheet Card Container */}
          <div className="relative w-full bg-[#121214] border-t border-x border-white/[0.08] rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.65)] z-10 font-sans px-4 pb-6 pt-3 select-none flex flex-col gap-2.5 max-h-[85vh] overflow-y-auto scrollbar-none animate-none">
            {/* Drag Handle Bar */}
            <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-3.5" />

            {/* Header Title */}
            <div className="px-1 mb-1">
              <p className="text-[10px] text-white/45 uppercase tracking-widest font-bold">Message Options</p>
              <p className="text-xs text-white/70 truncate mt-1">"{selectedMessageForMenu.text}"</p>
            </div>

            {/* Options List with Proper Spacing */}
            <div className="flex flex-col gap-2.5">
              {/* Option 1: Edit Message */}
              <button
                type="button"
                onClick={() => {
                  const msgToEdit = selectedMessageForMenu;
                  setSelectedMessageForMenu(null);
                  setShowEditModalForMessage(msgToEdit);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1E1E1E]/40 border border-white/[0.04] hover:bg-white/[0.06] active:scale-[0.98] transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/70">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Edit Message</div>
                    <div className="text-[9px] text-white/40 leading-none mt-0.5">Revise the text content of this message</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20" />
              </button>

              {/* Option: Retry / Regenerate Response (Only for Assistant messages) */}
              {selectedMessageForMenu.role !== 'user' && selectedMessageForMenu.id !== 'welcome-msg' && (
                <button
                  type="button"
                  onClick={() => {
                    const msgId = selectedMessageForMenu.id;
                    setSelectedMessageForMenu(null);
                    handleRetryMessage(msgId);
                  }}
                  disabled={isStreaming}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/10[0.04] border border-white/20 hover:bg-white/10[0.08] active:scale-[0.98] transition-all text-left cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Retry/Regenerate Answer</div>
                      <div className="text-[9px] text-white/55 leading-none mt-0.5">Generate a new, alternative response for this prompt</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30" />
                </button>
              )}

              {/* Option 2: Pin Message (Highlights with accent color when active) */}
              <button
                type="button"
                onClick={() => {
                  const isPinned = !!selectedMessageForMenu.isPinned;
                  
                  // Toggle isPinned property in state
                  const updatedMessages = messages.map(m => {
                    if (m.id === selectedMessageForMenu.id) {
                      return { ...m, isPinned: !isPinned };
                    }
                    return m;
                  });
                  setMessages(updatedMessages);

                  // Toggle in pinnedMessages string list
                  if (isPinned) {
                    setPinnedMessages(prev => prev.filter(p => p !== selectedMessageForMenu.text));
                    triggerToast("Unpinned message from memory");
                  } else {
                    setPinnedMessages(prev => [...prev, selectedMessageForMenu.text]);
                    triggerToast("Pinned message to memory!");
                  }

                  setSelectedMessageForMenu(null);
                  triggerHaptic();

                  // Save history directly
                  const targetHistoryId = activeHistoryId || historyId || `chat-${Date.now()}`;
                  if (!activeHistoryId) setActiveHistoryId(targetHistoryId);
                  lastHistoryIdRef.current = targetHistoryId;
                  onSaveHistory(
                    targetHistoryId,
                    updatedMessages,
                    updatedMessages[updatedMessages.length - 1]?.text || '',
                    persona.id
                  );
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl active:scale-[0.98] transition-all text-left cursor-pointer ${
                  selectedMessageForMenu.isPinned 
                    ? 'bg-accent/[0.04] border border-accent/25 hover:bg-accent/[0.08]' 
                    : 'bg-[#1E1E1E]/40 border border-white/[0.04] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    selectedMessageForMenu.isPinned 
                      ? 'bg-accent/15 border border-accent/25 text-accent' 
                      : 'bg-white/[0.03] border border-white/[0.06] text-white/70'
                  }`}>
                    <Pin className={`w-4 h-4 ${selectedMessageForMenu.isPinned ? 'fill-accent text-accent' : ''}`} />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${selectedMessageForMenu.isPinned ? 'text-accent' : 'text-white'}`}>
                      {selectedMessageForMenu.isPinned ? 'Unpin Message' : 'Pin Message'}
                    </div>
                    <div className="text-[9px] text-white/40 leading-none mt-0.5">
                      {selectedMessageForMenu.isPinned ? 'Remove from simulated memory context' : 'Inject directly into character memory context'}
                    </div>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 ${selectedMessageForMenu.isPinned ? 'text-accent/40' : 'text-white/20'}`} />
              </button>

              {/* Option: Branch New Session */}
              <button
                type="button"
                onClick={() => {
                  const msg = selectedMessageForMenu;
                  if (!msg) return;

                  const msgIndex = messages.findIndex(m => m.id === msg.id);
                  if (msgIndex === -1) {
                    setSelectedMessageForMenu(null);
                    return;
                  }

                  // Show loading overlay
                  setIsBranchingLoading(true);

                  setTimeout(() => {
                    const branchedMessages = messages.slice(0, msgIndex + 1);
                    const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                    const currentHistories = storageConfig?.chatHistories || [];
                    const sourceSession = currentHistories.find(h => h.id === (activeHistoryId || historyId || lastHistoryIdRef.current));

                    const lastText = msg.text || branchedMessages[branchedMessages.length - 1]?.text || '';
                    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

                    const branchedSession: ChatHistory = {
                      id: newSessionId,
                      personaId: persona.id,
                      personaName: persona.name,
                      avatarGradient: persona.avatarGradient || 'from-purple-500 to-indigo-600',
                      linkedWorldId: linkedWorldId || sourceSession?.linkedWorldId,
                      userPersonaId: (activeSession as any)?.userPersonaId || sourceSession?.userPersonaId || storageConfig?.activeUserPersonaId,
                      messages: branchedMessages,
                      lastMessage: lastText,
                      timestamp: timeStr,
                      updatedAt: Date.now(),
                      isArchived: false,
                      isPinned: false,
                      enableSceneDetection: sourceSession?.enableSceneDetection ?? true,
                      activePlaceName: activePlaceName || sourceSession?.activePlaceName || 'General',
                      activeAmbientName: activeAmbientName || sourceSession?.activeAmbientName || 'General',
                      isAmbientMuted: isAmbientMuted,
                      customWallpaper: customWallpaper || sourceSession?.customWallpaper,
                      worldCalendar: worldCalendarInput || sourceSession?.worldCalendar,
                      worldLocation: worldLocationInput || sourceSession?.worldLocation,
                      worldWeather: worldWeatherInput || sourceSession?.worldWeather,
                      worldReputation: worldReputationInput || sourceSession?.worldReputation,
                      worldSceneMood: worldSceneMood || sourceSession?.worldSceneMood,
                      worldEvents: sourceSession?.worldEvents ? JSON.parse(JSON.stringify(sourceSession.worldEvents)) : undefined,
                      relationshipScores: charRelScores ? JSON.parse(JSON.stringify(charRelScores)) : (sourceSession?.relationshipScores ? JSON.parse(JSON.stringify(sourceSession.relationshipScores)) : undefined),
                      interCharacterRelationships: sourceSession?.interCharacterRelationships ? JSON.parse(JSON.stringify(sourceSession.interCharacterRelationships)) : undefined,
                      characterState: characterState ? JSON.parse(JSON.stringify(characterState)) : (sourceSession?.characterState ? JSON.parse(JSON.stringify(sourceSession.characterState)) : undefined),
                    };

                    const updatedHistories = [branchedSession, ...currentHistories.filter(h => h.id !== newSessionId)];
                    if (onUpdateConfig) {
                      onUpdateConfig({ chatHistories: updatedHistories, selectedPersonaId: persona.id });
                    }
                    if (onSaveHistory) {
                      onSaveHistory(newSessionId, branchedMessages, lastText, persona.id);
                    }

                    setActiveHistoryId(newSessionId);
                    lastHistoryIdRef.current = newSessionId;
                    setMessages(branchedMessages);
                    messagesRef.current = branchedMessages;
                    setPinnedMessages(branchedMessages.filter(m => m.isPinned).map(m => m.text));

                    if (branchedSession.relationshipScores) setCharRelScores(branchedSession.relationshipScores as any);
                    if (branchedSession.characterState) setCharacterState(branchedSession.characterState);
                    if (branchedSession.worldCalendar) setWorldCalendarInput(branchedSession.worldCalendar);
                    if (branchedSession.worldLocation) setWorldLocationInput(branchedSession.worldLocation);
                    if (branchedSession.worldWeather) setWorldWeatherInput(branchedSession.worldWeather);
                    if (branchedSession.worldReputation) setWorldReputationInput(branchedSession.worldReputation);
                    if (branchedSession.worldSceneMood) setWorldSceneMood(branchedSession.worldSceneMood);

                    if (onResumeChat) {
                      onResumeChat(newSessionId);
                    }

                    setTimeout(() => {
                      setSelectedMessageForMenu(null);
                      setIsBranchingLoading(false);
                      triggerToast("Branched new session from this message!");
                      triggerHaptic();
                    }, 300);
                  }, 400);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/10[0.06] border border-white/20 hover:bg-white/10[0.12] active:scale-[0.98] transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <GitFork className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Branch New Session</div>
                    <div className="text-[9px] text-white/60 leading-none mt-0.5">Duplicate walkthrough from here for alternate endings</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </button>

              {/* Option 3: Rewind to here */}
              <button
                type="button"
                onClick={() => handleRewindToHere(selectedMessageForMenu.id)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1E1E1E]/40 border border-white/[0.04] hover:bg-white/[0.06] active:scale-[0.98] transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/70">
                    <GitFork className="w-4 h-4 rotate-180" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Rewind to here</div>
                    <div className="text-[9px] text-white/40 leading-none mt-0.5">Wipe later messages and fork dialogue state</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20" />
              </button>

              {/* Option 4: Copy Text */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(selectedMessageForMenu.text);
                  setSelectedMessageForMenu(null);
                  triggerToast("Message copied");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1E1E1E]/40 border border-white/[0.04] hover:bg-white/[0.06] active:scale-[0.98] transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/70">
                    <Copy className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Copy Text</div>
                    <div className="text-[9px] text-white/40 leading-none mt-0.5">Save content directly to device clipboard</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20" />
              </button>

              {/* Option 5: Delete Message (Destructive action) */}
              <button
                type="button"
                onClick={() => {
                  setMessages(prev => prev.filter(m => m.id !== selectedMessageForMenu.id));
                  setSelectedMessageForMenu(null);
                  triggerToast("Message deleted");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/10[0.02] border border-white/20 hover:bg-white/10[0.06] hover:border-white/20 active:scale-[0.98] transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Delete Message</div>
                    <div className="text-[9px] text-white/55 leading-none mt-0.5">Irreversibly remove from current stream</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch New Session Loading Modal */}
      {isBranchingLoading && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-6 select-none">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute w-24 h-24 rounded-full bg-white/10 animate-ping" />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-400/40 flex items-center justify-center text-white shadow-[0_0_40px_rgba(168,85,247,0.5)] animate-bounce">
              <GitFork className="w-8 h-8 text-white" />
            </div>
          </div>
          <h3 className="text-base font-extrabold text-white text-center tracking-tight">
            Opening a new session from this message...
          </h3>
          <p className="text-xs text-white/70 text-center max-w-xs mt-2 font-medium leading-relaxed">
            Duplicating world timeline, memories, character relationships & location status
          </p>
          <div className="mt-6 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse delay-150" />
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse delay-300" />
          </div>
        </div>
      )}

      {/* Edit Message Modal */}
      <EditMessageModal
        message={showEditModalForMessage}
        onClose={() => setShowEditModalForMessage(null)}
        onSave={(newText) => {
          if (!showEditModalForMessage) return;
          const msgId = showEditModalForMessage.id;
          const updatedMessages = messages.map(m => m.id === msgId ? { ...m, text: newText } : m);
          setMessages(updatedMessages);
          setShowEditModalForMessage(null);
          triggerToast("Message updated");

          const targetHistoryId = activeHistoryId || historyId || `chat-${Date.now()}`;
          if (!activeHistoryId) setActiveHistoryId(targetHistoryId);
          lastHistoryIdRef.current = targetHistoryId;
          onSaveHistory(
            targetHistoryId,
            updatedMessages,
            updatedMessages[updatedMessages.length - 1]?.text || '',
            persona.id
          );
        }}
      />

      {/* Profile Screen Overlay */}

      {/* PHONE INTERFACE */}
      <AnimatePresence>
        {isPhoneOpen && (
          <PhoneInterface
            onClose={() => setIsPhoneOpen(false)}
            characterState={characterState}
            onUpdateCharacterState={handleUpdateCharacterState}
            personas={[...PERSONAS, ...(storageConfig?.characters || [])]}
            worldName={linkedWorld?.name}
            wallpaperUrl={activeWallpaperBgUrl}
            onSetCustomWallpaper={handleSetCustomWallpaper}
            isPerformanceMode={isPerfMode}
            linkedCharacterIds={linkedWorld?.linkedCharacterIds || []}
            typingContactId={typingContactId}
            deadCharacterIds={deadCharacterIds}
            onPostSocialUpdate={handlePostSocialUpdate}
            triggerHaptic={triggerHaptic}
            activeUserPersona={activeUserPersona}
            currentPersonaName={currentPersonaName}
            onSendMessage={async (contactId, text, userMsg) => {
              const allChars = [...PERSONAS, ...(storageConfig?.characters || [])];
              const customContacts = characterStateRef.current?.phone?.customContacts || [];
              let contactObj: any = allChars.find(c => c.id === contactId);
              if (!contactObj) {
                contactObj = customContacts.find((c: any) => c.id === contactId);
              }
              const contactName = contactObj?.name || 'Companion';
              const contactPersona = contactObj?.description || contactObj?.personality || '';

              setTypingContactId(contactId);

              const latestPhone = characterStateRef.current?.phone || {};
              const latestThreads = latestPhone.threads || {};
              const currentContactThread = Array.isArray(latestThreads[contactId]) ? latestThreads[contactId] : [];
              
              const threadWithUser = userMsg && !currentContactThread.some((m: any) => m === userMsg || (m.timestamp === userMsg.timestamp && m.text === userMsg.text))
                ? [...currentContactThread, userMsg]
                : (currentContactThread.length > 0 ? currentContactThread : (userMsg ? [userMsg] : [{ text, isUser: true, timestamp: Date.now() }]));

              if (threadWithUser !== currentContactThread) {
                handleUpdateCharacterState('phone', 'threads', {
                  ...latestThreads,
                  [contactId]: threadWithUser
                });
              }

              try {
                const res = await fetchWithRetry('/api/phone-chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    message: text,
                    history: threadWithUser.slice(0, -1),
                    recentWorldChatHistory: messages.slice(-5).map(m => (m.role === 'user' ? 'User: ' : 'Companion: ') + m.text).join('\n'),
                    worldLocation: worldLocationInput || activePlaceName,
                    contactName,
                    contactPersona,
                    customApiKey: storageConfig?.apiKey,
                    customApiKeys: storageConfig?.apiKeys,
                    selectedModel: storageConfig?.selectedModel,
                    samplers: storageConfig ? {
                      temperature: storageConfig.samplerTemperature,
                      topP: storageConfig.samplerTopP,
                      generatedTokens: storageConfig.samplerGeneratedTokens,
                      isStreaming: storageConfig.samplerIsStreaming
                    } : undefined
                  })
                });

                if (!res.ok) throw new Error('Failed to fetch phone response');

                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                let aiReply = '';

                const freshPhoneBeforeAi = characterStateRef.current?.phone || {};
                const freshThreadsBeforeAi = freshPhoneBeforeAi.threads || {};
                const currentFreshThread = Array.isArray(freshThreadsBeforeAi[contactId]) ? freshThreadsBeforeAi[contactId] : currentContactThread;

                const threadWithAiPlaceholder = [
                  ...threadWithUser,
                  { text: '', isUser: false, timestamp: Date.now(), unread: true }
                ];
                handleUpdateCharacterState('phone', 'threads', {
                  ...freshThreadsBeforeAi,
                  [contactId]: threadWithAiPlaceholder
                });

                if (reader) {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                      if (line.startsWith('data: ')) {
                        try {
                          const data = JSON.parse(line.slice(6));
                          if (data.text) {
                            aiReply += data.text;
                            const livePhone = characterStateRef.current?.phone || {};
                            const liveThreads = livePhone.threads || {};
                            const rawLiveThread = Array.isArray(liveThreads[contactId]) && liveThreads[contactId].length >= threadWithUser.length
                              ? liveThreads[contactId]
                              : [...threadWithUser];
                            
                            const hasUserMsgInLive = userMsg ? rawLiveThread.some((m: any) => m === userMsg || (m.timestamp === userMsg.timestamp && m.isUser)) : true;
                            const liveThreadBase = hasUserMsgInLive ? rawLiveThread : [...rawLiveThread, userMsg];
                            
                            const liveThread = [...liveThreadBase];
                            if (liveThread.length > 0 && !liveThread[liveThread.length - 1].isUser) {
                              liveThread[liveThread.length - 1] = {
                                text: aiReply,
                                isUser: false,
                                timestamp: Date.now(),
                                unread: true
                              };
                            } else {
                              liveThread.push({
                                text: aiReply,
                                isUser: false,
                                timestamp: Date.now(),
                                unread: true
                              });
                            }
                            handleUpdateCharacterState('phone', 'threads', {
                              ...liveThreads,
                              [contactId]: liveThread
                            });
                          }
                        } catch (e) {}
                      }
                    }
                  }
                }
              } catch (err) {
                console.error('Phone chat error:', err);
                const livePhone = characterStateRef.current?.phone || {};
                const liveThreads = livePhone.threads || {};
                const liveThread = Array.isArray(liveThreads[contactId]) ? [...liveThreads[contactId]] : [];
                liveThread.push({
                  text: "(Typing error or network disruption...)",
                  isUser: false,
                  timestamp: Date.now(),
                  unread: true
                });
                handleUpdateCharacterState('phone', 'threads', {
                  ...liveThreads,
                  [contactId]: liveThread
                });
              } finally {
                setTypingContactId(null);
              }
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute inset-0 z-[120] bg-[#121214]"
          >
            <CharacterProfileScreen
              persona={viewedCompanionProfile || persona}
              storageConfig={storageConfig || { apiKey: '', useServerKeyFallback: true, selectedPersonaId: '', customPersonas: [], chatHistories: [] }}
              likedPersonaIds={storageConfig?.likedPersonaIds || []}
              disableAnimation={true}
              onBack={() => {
                setShowProfile(false);
                setViewedCompanionProfile(null);
              }}
              onStartChat={() => {
                setShowProfile(false);
              }}
              onEdit={(persona) => {
                if (onEditPersona) {
                  onEditPersona(persona.id);
                }
                setShowProfile(false);
              }}
              onToggleLike={(personaId) => {
                if (onToggleLikePersona) {
                  onToggleLikePersona(personaId);
                }
              }}
              onDelete={(personaId) => {
                if (onDeletePersona) {
                  onDeletePersona(personaId);
                }
                setShowProfile(false);
                onBack(); // go back since it was deleted
              }}
              onResumeChat={(historyId) => {
                if (onResumeChat) {
                  onResumeChat(historyId);
                }
                setShowProfile(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* World Profile Screen Overlay */}
      <AnimatePresence>
        {showWorldProfile && linkedWorld && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute inset-0 z-[120] bg-[#121214]"
          >
            <WorldProfileScreen
              world={linkedWorld}
              storageConfig={storageConfig || { apiKey: '', useServerKeyFallback: true, selectedPersonaId: '', customPersonas: [], chatHistories: [] }}
              likedWorldIds={storageConfig?.likedWorldIds || []}
              disableAnimation={true}
              onBack={() => setShowWorldProfile(false)}
              onStartChat={() => {
                setShowWorldProfile(false);
              }}
              onEdit={() => {
                // Handle world edit if needed
                setShowWorldProfile(false);
              }}
              onToggleLike={(worldId) => {
                if (onUpdateConfig && storageConfig) {
                  const likedIds = [...(storageConfig.likedWorldIds || [])];
                  const idx = likedIds.indexOf(worldId);
                  if (idx === -1) likedIds.push(worldId);
                  else likedIds.splice(idx, 1);
                  onUpdateConfig({ likedWorldIds: likedIds });
                }
              }}
              onDelete={(worldId) => {
                if (onUpdateConfig && storageConfig) {
                  const worlds = (storageConfig.worlds || []).filter(w => w.id !== worldId);
                  const histories = (storageConfig?.chatHistories || []).filter(h => h.linkedWorldId !== worldId);
                  onUpdateConfig({ worlds, chatHistories: histories });
                }
                setShowWorldProfile(false);
                onBack();
              }}
              onResumeChat={(historyId) => {
                if (onResumeChat) {
                  onResumeChat(historyId);
                }
                setShowWorldProfile(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* WORLD SESSION CAST MODAL */}
      <AnimatePresence>
        {showSessionCastModal && linkedWorld && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-md max-h-[85vh] rounded-3xl bg-[#14151b] border border-white/15 p-5 text-white shadow-2xl flex flex-col gap-4 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">World Session Cast</h3>
                    <p className="text-[10.5px] text-white/50">{linkedWorld.name} • {sessionLinkedCharIds.length} linked</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setShowSessionCastModal(false);
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Cast Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {/* Active in Session */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-purple-300 px-1">
                    <span>Active Characters in this Session</span>
                    <span className="text-[10px] lowercase text-white/40">{sessionLinkedCharIds.length} selected</span>
                  </div>

                  {sessionLinkedCharIds.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
                      <p className="text-xs font-semibold text-amber-300">No characters active (Solo World)</p>
                      <p className="text-[10px] text-amber-200/60">Add characters below to have them inhabit this world session with you.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {sessionLinkedCharIds.map(charId => {
                        const allComps = [...PERSONAS, ...(storageConfig?.characters || [])];
                        const char = allComps.find(c => c.id === charId);
                        if (!char) return null;
                        return (
                          <div
                            key={charId}
                            className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {char.avatar ? (
                                <SafeImage src={char.avatar} alt={char.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${char.avatarGradient || 'from-purple-500 to-indigo-600'} flex items-center justify-center text-xs text-white font-bold shrink-0`}>
                                  {char.avatarEmoji || char.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">{char.name}</div>
                                <div className="text-[10px] text-white/40 truncate">{char.tagline || (char as any).role || 'Companion'}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleCharacterInSession(charId)}
                              title="Remove from session"
                              className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            >
                              <X className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Add Available Characters */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/70 px-1">
                    <span>Add from Characters Library</span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      placeholder="Search characters to add..."
                      value={castSearchQuery}
                      onChange={(e) => setCastSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                    {(() => {
                      const allComps = [...PERSONAS, ...(storageConfig?.characters || [])];
                      const available = allComps.filter(c => 
                        !sessionLinkedCharIds.includes(c.id) &&
                        (!castSearchQuery.trim() || c.name.toLowerCase().includes(castSearchQuery.toLowerCase()) || (c.tagline && c.tagline.toLowerCase().includes(castSearchQuery.toLowerCase())))
                      );

                      if (available.length === 0) {
                        return (
                          <div className="p-3 text-center text-white/40 text-[11px] italic">
                            {castSearchQuery.trim() ? "No matching characters found" : "All available characters are already in this session"}
                          </div>
                        );
                      }

                      return available.map(char => (
                        <div
                          key={char.id}
                          className="flex items-center justify-between p-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {char.avatar ? (
                              <SafeImage src={char.avatar} alt={char.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${char.avatarGradient || 'from-indigo-500 to-purple-600'} flex items-center justify-center text-[10px] text-white font-bold shrink-0`}>
                                {char.avatarEmoji || char.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white/90 truncate">{char.name}</div>
                              <div className="text-[9.5px] text-white/40 truncate">{char.tagline || (char as any).role || 'Companion'}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleCharacterInSession(char.id)}
                            className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Permanent World Default Sync Toggle */}
                <div 
                  onClick={() => setCastAlsoSaveToWorld(!castAlsoSaveToWorld)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] cursor-pointer hover:bg-white/[0.06] transition-all"
                >
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                    castAlsoSaveToWorld ? 'bg-purple-500 border-purple-400 text-white' : 'border-white/30 bg-transparent'
                  }`}>
                    {castAlsoSaveToWorld && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[11px] font-bold text-white">Save as World's Default Cast</div>
                    <div className="text-[9.5px] text-white/50">Also updates the base template for all future sessions in {linkedWorld.name}</div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-white/10 pt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setShowSessionCastModal(false);
                  }}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-purple-500/20 cursor-pointer transition-all active:scale-[0.98]"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACTION DURATION MODAL */}
      <AnimatePresence>
        {pendingActionModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="w-full max-w-sm rounded-3xl bg-[#1a1b22] border border-white/15 p-5 text-white shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-white" />
                  <span className="font-bold text-sm text-white">{pendingActionModal.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingActionModal(null)}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/90">
                  How much time will you spend doing this?
                </label>
                <p className="text-[11px] text-white/50 leading-normal">
                  This updates {persona.name}'s current status, activity stats, and roleplay timeline.
                </p>
              </div>

              {/* Quick Duration Options */}
              <div className="grid grid-cols-3 gap-2">
                {['15 Minutes', '30 Minutes', '1 Hour', '2 Hours', '4 Hours', '8 Hours'].map(dur => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setSelectedDurationOption(dur);
                      setCustomDurationInput('');
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selectedDurationOption === dur && !customDurationInput
                        ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {dur}
                  </button>
                ))}
              </div>

              {/* Custom Duration Input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Or enter custom duration
                </label>
                <input
                  type="text"
                  value={customDurationInput ?? ""}
                  onChange={(e) => setCustomDurationInput(e.target.value)}
                  placeholder="e.g. 3 Hours 30 Mins"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              {/* Confirm Action Button */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingActionModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    const finalDuration = customDurationInput.trim() || selectedDurationOption;
                    
                    // Update characterState
                    const newActivity = `${pendingActionModal.title} (${finalDuration})`;
                    const updatedState = {
                      ...(characterState || {}),
                      currentActivity: newActivity,
                      lastDuration: finalDuration,
                      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    };

                    // Apply stat boosts based on action title
                    const currentStatus = sanitizeStatusEasyMode(characterState?.status, {});

                    if (pendingActionModal.title === 'Sleep' || pendingActionModal.title === 'Rest' || pendingActionModal.title === 'Time Skip') {
                      currentStatus.energy = 100;
                      currentStatus.mood = 95;
                      currentStatus.hygiene = Math.max(85, currentStatus.hygiene);
                    } else if (pendingActionModal.title === 'Shower' || pendingActionModal.title === 'Bath' || pendingActionModal.title === 'Wash') {
                      currentStatus.hygiene = 100;
                      currentStatus.mood = Math.min(100, (currentStatus.mood as number || 80) + 10);
                    } else if (pendingActionModal.title === 'Eat' || pendingActionModal.title === 'Meal') {
                      currentStatus.hunger = 100;
                      currentStatus.energy = Math.min(100, currentStatus.energy + 15);
                    } else if (pendingActionModal.title === 'Drink') {
                      currentStatus.thirst = 100;
                    } else if (pendingActionModal.title === 'Study') {
                      updatedState.knowledge = Math.min(100, ((characterState?.knowledge as number) || 50) + 15);
                      updatedState.focus = Math.min(100, ((characterState?.focus as number) || 60) + 20);
                    } else if (pendingActionModal.title === 'Work') {
                      updatedState.credits = ((characterState?.credits as number) || 250) + 150;
                      updatedState.productivity = Math.min(100, ((characterState?.productivity as number) || 50) + 20);
                    } else if (pendingActionModal.title === 'Exercise') {
                      updatedState.fitness = Math.min(100, ((characterState?.fitness as number) || 40) + 20);
                      currentStatus.energy = Math.max(40, currentStatus.energy - 10);
                      currentStatus.hygiene = Math.max(80, currentStatus.hygiene - 5);
                    } else if (pendingActionModal.title === 'Read') {
                      updatedState.wisdom = Math.min(100, ((characterState?.wisdom as number) || 50) + 15);
                    } else if (pendingActionModal.title === 'Practice Hobby') {
                      updatedState.hobbySkill = Math.min(100, ((characterState?.hobbySkill as number) || 35) + 15);
                      currentStatus.mood = Math.min(100, (currentStatus.mood as number || 80) + 15);
                    } else if (pendingActionModal.title === 'Set Daily Goal') {
                      updatedState.dailyGoal = `Goal set for next ${finalDuration}`;
                    } else if (pendingActionModal.title === 'Plan Schedule') {
                      updatedState.scheduledActivity = `Scheduled task for next ${finalDuration}`;
                    }

                    updatedState.status = currentStatus;

                    setCharacterState(updatedState);

                    // Send roleplay message into chat session
                    const actionMsg = `*Spends ${finalDuration} on ${pendingActionModal.title.toLowerCase()} with ${persona.name}...*`;
                    handleSendMessage(actionMsg);

                    // Trigger Toast
                    triggerToast(`${pendingActionModal.title} logged for ${finalDuration}! Character status updated.`);

                    // Reset & Close
                    setPendingActionModal(null);
                    setCustomDurationInput('');
                    setShowBottomSheet(false);
                    setWorldTabSection('grid');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHAT TOOLS MODALS */}
      <AnimatePresence>
        {activeChatToolModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-[#0e0e11]/95 backdrop-blur-md border border-white/20 p-5 text-white shadow-2xl space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  {activeChatToolModal === 'pinned' && <Pin className="w-5 h-5 text-white" />}
                  {activeChatToolModal === 'memories' && <Brain className="w-5 h-5 text-white" />}
                  {activeChatToolModal === 'switch_persona' && <UserCheck className="w-5 h-5 text-white" />}
                  {activeChatToolModal === 'sessions' && <History className="w-5 h-5 text-white" />}
                  <span className="font-bold text-sm text-white">
                    {activeChatToolModal === 'pinned' && "Pinned Messages"}
                    {activeChatToolModal === 'memories' && "Manual Story Memories"}
                    {activeChatToolModal === 'switch_persona' && "Switch Active Persona"}
                    {activeChatToolModal === 'sessions' && "Chat Session History"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveChatToolModal(null)}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {/* 1. PINNED MESSAGES */}
                {activeChatToolModal === 'pinned' && (() => {
                  const pinnedList = messages.filter(m => m.isPinned);
                  const hasPins = pinnedList.length > 0 || pinnedMessages.length > 0;
                  if (!hasPins) {
                    return (
                      <div className="p-6 rounded-2xl bg-white/10 border border-white/15 text-center text-xs text-white/60 space-y-1">
                        <Pin className="w-6 h-6 text-white/40 mx-auto mb-2" />
                        <p className="font-semibold text-white">No pinned messages yet</p>
                        <p className="text-[11px] text-white/50">Long-press or click the options menu on any chat message to pin key details directly into character memory.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2.5">
                      {pinnedList.map(msg => (
                        <div key={msg.id} className="p-3.5 rounded-2xl bg-white/10 border border-white/15 space-y-2">
                          <div className="text-xs text-white/90 leading-relaxed italic font-serif">
                            "{msg.text}"
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-white/50 pt-2 border-t border-white/10">
                            <span className="font-medium text-white/70">{msg.role === 'user' ? 'User' : persona.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic();
                                handleUnpinMessage(msg.id);
                              }}
                              className="text-white hover:text-red-300 font-bold cursor-pointer transition-colors flex items-center gap-1"
                            >
                              <Pin className="w-3 h-3 rotate-45 text-white/60" />
                              <span>Unpin</span>
                            </button>
                          </div>
                        </div>
                      ))}
                      {pinnedMessages.map((pmText, idx) => {
                        if (pinnedList.some(m => m.text === pmText)) return null;
                        return (
                          <div key={`pm-${idx}`} className="p-3.5 rounded-2xl bg-white/10 border border-white/15 space-y-2">
                            <div className="text-xs text-white/90 leading-relaxed italic font-serif">
                              "{pmText}"
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-white/50 pt-2 border-t border-white/10">
                              <span className="font-medium text-white/70">Pinned Chat Fact</span>
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic();
                                  handleUnpinMessage(pmText);
                                }}
                                className="text-white hover:text-red-300 font-bold cursor-pointer transition-colors flex items-center gap-1"
                              >
                                <Pin className="w-3 h-3 rotate-45 text-white/60" />
                                <span>Unpin</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* 2. MANUAL MEMORIES */}
                {activeChatToolModal === 'memories' && (
                  <div className="space-y-3">
                    {/* Add Memory Input */}
                    <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 space-y-2.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/80 block">
                        Add Manual Story Memory
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newMemoryText ?? ""}
                          onChange={(e) => setNewMemoryText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newMemoryText.trim()) {
                              triggerHaptic();
                              const updated = [...storyMemories, newMemoryText.trim()];
                              handleUpdateStoryMemories(updated);
                              setNewMemoryText('');
                              triggerToast("Manual memory added!");
                            }
                          }}
                          placeholder="e.g. Likes jasmine tea, fears high places..."
                          className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newMemoryText.trim()) return;
                            triggerHaptic();
                            const updated = [...storyMemories, newMemoryText.trim()];
                            handleUpdateStoryMemories(updated);
                            setNewMemoryText('');
                            triggerToast("Manual memory added!");
                          }}
                          className="px-3 py-2 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-md"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-white/50 leading-normal">
                        Manual memories are saved directly to the chat history and shared into the character context to improve AI responses.
                      </p>
                    </div>

                    {/* Memory List */}
                    {storyMemories.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-white/10 border border-white/15 text-center text-xs text-white/50">
                        No manual memories added yet. Type a fact above to guide the AI's context.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                        {storyMemories.map((mem, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between gap-2">
                            <span className="text-xs text-white/90 leading-normal font-medium">{mem}</span>
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic();
                                const updated = storyMemories.filter((_, i) => i !== idx);
                                handleUpdateStoryMemories(updated);
                                triggerToast("Memory removed");
                              }}
                              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
                              title="Remove Memory"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. SWITCH PERSONA */}
                {activeChatToolModal === 'switch_persona' && (() => {
                  const userPersonas = storageConfig?.userPersonas && storageConfig.userPersonas.length > 0
                    ? storageConfig.userPersonas
                    : PERSONA_PRESETS.map((p, i) => ({ id: `preset-${i}`, name: p.name, description: p.desc, avatar: undefined }));
                  
                  const activePersonaId = storageConfig?.activeUserPersonaId || userPersonas[0]?.id;

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                          Select Who You Play As
                        </span>
                        <span className="text-[10px] text-white/40">
                          {userPersonas.length} Available
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {userPersonas.map(up => {
                          const isSelected = activePersonaId === up.id;
                          return (
                            <button
                              key={up.id}
                              type="button"
                              onClick={() => {
                                triggerHaptic();
                                if (onUpdateConfig) {
                                  const updatedHistories = (storageConfig?.chatHistories || []).map(h => 
                                    h.id === targetHistoryId ? { ...h, userPersonaId: up.id } : h
                                  );
                                  onUpdateConfig({ 
                                    activeUserPersonaId: up.id,
                                    chatHistories: updatedHistories
                                  });
                                }
                                setCurrentPersonaName(up.name);
                                setCurrentPersonaDesc(up.description || '');
                                triggerToast(`Playing as ${up.name}`);
                                setActiveChatToolModal(null);
                              }}
                              className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-white/15 border-white/40 text-white shadow-lg'
                                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0">
                                  {up.avatar ? (
                                    <SafeImage src={up.avatar} alt={up.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{up.name?.[0] || 'U'}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-white truncate">{up.name}</div>
                                  <div className="text-[10px] text-white/50 truncate max-w-[200px]">{up.description || 'No bio specified'}</div>
                                </div>
                              </div>
                              {isSelected ? (
                                <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-black shrink-0">
                                  Playing As
                                </span>
                              ) : (
                                <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 5. VIEW CHAT SESSIONS */}
                {activeChatToolModal === 'sessions' && (() => {
                  const currentWorldId = linkedWorld?.id || (persona.id.startsWith('world-') ? persona.id.replace('world-', '') : null);
                  const currentPersonaId = persona.id;

                  const filteredSessions = (storageConfig?.chatHistories || []).filter(session => {
                    if (currentWorldId) {
                      return session.linkedWorldId === currentWorldId || session.personaId === currentPersonaId;
                    }
                    return session.personaId === currentPersonaId;
                  });

                  const handleStartNewSession = () => {
                    triggerHaptic();
                    const newSessionId = `chat-${Date.now()}`;
                    const newSession: ChatHistory = {
                      id: newSessionId,
                      personaId: persona.id,
                      personaName: persona.name,
                      avatarGradient: persona.avatarGradient,
                      lastMessage: '',
                      timestamp: 'Just now',
                      updatedAt: Date.now(),
                      messages: persona.greeting ? [{
                        id: `msg-${Date.now()}`,
                        role: 'ai',
                        text: persona.greeting,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      } as ChatMessage] : [],
                      linkedWorldId: currentWorldId || undefined,
                      userPersonaId: storageConfig?.activeUserPersonaId
                    };

                    const updatedHistories = [newSession, ...(storageConfig?.chatHistories || [])];
                    if (onUpdateConfig) {
                      onUpdateConfig({ chatHistories: updatedHistories });
                    }
                    if (onResumeChat) {
                      onResumeChat(newSessionId);
                    }
                    triggerToast(`Started new session with ${persona.name}`);
                    setActiveChatToolModal(null);
                    setShowBottomSheet(false);
                  };

                  return (
                    <div className="space-y-3">
                      {/* Top Action Header */}
                      <div className="flex items-center justify-between pb-1">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">
                            Sessions for {persona.name}
                          </span>
                          <span className="text-[10px] text-white/40">
                            {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'} saved
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleStartNewSession}
                          className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Session</span>
                        </button>
                      </div>

                      {filteredSessions.length === 0 ? (
                        <div className="p-6 text-center text-xs text-white/50 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                          <p className="font-semibold text-white/80">No previous sessions with {persona.name}</p>
                          <p className="text-[11px] text-white/40">Start a fresh conversation timeline anytime.</p>
                          <button
                            type="button"
                            onClick={handleStartNewSession}
                            className="mt-2 px-4 py-2 rounded-xl bg-white text-black font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Start First Session</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                          {filteredSessions.map(session => {
                            const isActive = session?.id === targetHistoryId;
                            const msgCount = session?.messages?.length || 0;

                            return (
                              <div
                                key={session?.id || Math.random().toString()}
                                className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between ${
                                  isActive
                                    ? 'bg-white/15 border-white/40 text-white shadow-lg'
                                    : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic();
                                    if (onResumeChat && session?.id) {
                                      onResumeChat(session.id);
                                    }
                                    setActiveChatToolModal(null);
                                    setShowBottomSheet(false);
                                  }}
                                  className="flex-1 min-w-0 text-left flex items-center gap-3 cursor-pointer"
                                >
                                  <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 border border-white/20 flex-shrink-0 flex items-center justify-center font-bold text-xs text-white">
                                    {persona?.avatar ? (
                                      <SafeImage src={persona.avatar} alt={(session as any)?.title || 'Session'} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{persona?.name?.[0] || 'S'}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-white truncate">
                                      {(session as any)?.title || (session as any)?.worldName || `Session ${session?.id?.slice(-4)}`}
                                    </div>
                                    <div className="text-[10px] text-white/50 truncate">
                                      {session?.lastMessage || `${msgCount} ${msgCount === 1 ? 'message' : 'messages'}`}
                                    </div>
                                  </div>
                                </button>

                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  {isActive ? (
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-black">
                                      Active
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerHaptic();
                                        if (onUpdateConfig) {
                                          const updated = (storageConfig?.chatHistories || []).filter(h => h.id !== session.id);
                                          onUpdateConfig({ chatHistories: updated });
                                          triggerToast('Session deleted');
                                        }
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                                      title="Delete Session"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RIGHT SLIDE-OUT STATUS & WORLD DRAWER */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 z-[140] bg-black/70 cursor-pointer"
            />

            {/* Slide-out Panel from Right */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="absolute top-0 right-0 bottom-0 z-[150] w-[85%] max-w-xs sm:max-w-sm bg-[#0c0c0f] border-l border-white/[0.08] shadow-2xl flex flex-col text-white overflow-hidden font-sans select-text"
            >
              {/* Drawer Top Header */}
              <div className="p-4 border-b border-white/[0.05] flex items-center justify-between shrink-0 bg-black/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/20 flex-shrink-0">
                    {persona.avatar ? (
                      <SafeImage src={persona.avatar} alt={persona.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-sm bg-white/20 text-white">
                        {persona.name?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                      <span>{persona.name}</span>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20">
                        Status
                      </span>
                    </div>
                    <div className="text-[11px] text-white/50 truncate">
                      {persona.tagline || (persona as any).role || linkedWorld?.name || "Active Session"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setShowAdminModal(true);
                    }}
                    title="Open Admin Stat Controls & Chat Repair"
                    className="px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <span>⚡ Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer active:scale-95 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto px-4 pb-12 pt-4 space-y-4 custom-scrollbar">
                {/* 1. CHARACTER STATUS */}
                <div className="p-3.5 rounded-2xl bg-black/40 shadow-sm border border-white/[0.05] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-zinc-300" /> Character Status
                    </span>
                    <span className="text-[10px] text-white/50 font-mono truncate max-w-[120px]">
                      {characterState?.currentActivity || characterState?.activity?.job || "Roleplaying"}
                    </span>
                  </div>

                  {/* Stat Vitals */}
                  <div className="space-y-2 pt-1">
                    {[
                      { label: 'Health', key: 'health', defaultVal: 100 },
                      { label: 'Energy', key: 'energy', defaultVal: 85 },
                      { label: 'Mood', key: 'mood', defaultVal: 80 },
                      { label: 'Hunger', key: 'hunger', defaultVal: 90 },
                      { label: 'Thirst', key: 'thirst', defaultVal: 85 },
                      { label: 'Hygiene', key: 'hygiene', defaultVal: 95 },
                    ].map(stat => {
                      const rawVal = characterState?.status?.[stat.key] ?? characterState?.[stat.key] ?? stat.defaultVal;
                      const numVal = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal)) || 100;
                      return (
                        <div 
                          key={stat.key} 
                          className="flex items-center gap-3 py-1.5 px-1.5 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/5 transition-all group"
                          title={`Adjust ${stat.label}`}
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span 
                                className="text-white/60 font-medium group-hover:text-white transition-colors cursor-pointer"
                                onClick={() => {
                                  triggerHaptic();
                                  setShowAdminModal(true);
                                }}
                              >
                                {stat.label} <span className="text-[8px] text-white/30 font-light opacity-0 group-hover:opacity-100 transition-opacity">(Adjust)</span>
                              </span>
                              <span className="text-white font-mono font-semibold">{numVal}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full bg-white transition-all duration-300`} style={{ width: `${Math.min(100, Math.max(0, numVal))}%` }} />
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic();
                              setRestoreStatusModal({
                                statKey: stat.key,
                                statLabel: stat.label,
                                currentVal: numVal
                              });
                            }}
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors active:scale-95 flex-shrink-0"
                            title="Restore 20% (10 Orbs)"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* LONG-TERM SITUATIONS */}
                <div className="p-3.5 rounded-2xl bg-black/40 shadow-sm border border-white/[0.05] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-zinc-300" /> Long-Term Situations
                    </span>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase">Active</span>
                  </div>

                  {(!characterState?.longterm || characterState.longterm.length === 0) ? (
                    <div className="text-center py-4 bg-white/[0.02] rounded-xl border border-dashed border-white/10 px-2">
                      <p className="text-[10px] text-zinc-400 leading-relaxed">
                        No active long-term conditions. Intimacy choices, exhaustion, or storyline developments will trigger lasting status effects here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {characterState.longterm.map((sit: any, idx: number) => {
                        return (
                          <div key={idx} className="bg-white/[0.03] hover:bg-white/[0.06] p-3 rounded-xl border border-white/10 transition-all space-y-1.5 group relative">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-xs text-white leading-tight">{sit.title}</span>
                              <div className="flex gap-1 items-center flex-shrink-0">
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                                  {sit.type || 'condition'}
                                </span>
                                {sit.severity && sit.severity !== 'N/A' && (
                                  <span className="text-[9px] bg-zinc-800 text-zinc-200 border border-zinc-700 px-1.5 py-0.5 rounded font-bold">
                                    {sit.severity}
                                  </span>
                                )}
                              </div>
                            </div>
                            {sit.description && (
                              <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-2">{sit.description}</p>
                            )}
                            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[9px] text-zinc-400">
                              <span>Duration: {sit.duration || 'Ongoing'}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openSituationModal(sit, idx)}
                                  className="text-zinc-300 hover:text-white font-medium px-1.5 py-0.5 rounded hover:bg-white/10 transition-all cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSituation(idx)}
                                  className="text-zinc-400 hover:text-white font-medium px-1.5 py-0.5 rounded hover:bg-white/10 transition-all cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button 
                    type="button"
                    onClick={() => openSituationModal()}
                    className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold transition-all border border-white/10 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Long-Term Situation</span>
                  </button>
                </div>

                {/* PREGNANCY & FERTILITY MONITOR */}
                <div className="p-3.5 rounded-2xl bg-black/40 shadow-sm border border-white/[0.05] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-zinc-300" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Pregnancy & Fertility</span>
                    </div>
                    <span className="text-[9px] bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded-full border border-zinc-700 font-semibold uppercase">
                      {characterState?.pregnancy?.status || "Not Pregnant"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                      <span className="text-zinc-400 text-[9px] block font-medium">Gestation</span>
                      <div className="text-white font-semibold">
                        {characterState?.pregnancy?.weeks ? `${characterState.pregnancy.weeks} Weeks` : '0 Weeks (N/A)'}
                      </div>
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                      <span className="text-zinc-400 text-[9px] block font-medium">Father / Partner</span>
                      <div className="text-white font-semibold truncate">
                        {characterState?.pregnancy?.father || 'None'}
                      </div>
                    </div>
                  </div>

                  {characterState?.pregnancy?.symptoms && characterState?.pregnancy?.symptoms.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-zinc-400 text-[9px] block font-medium">Symptoms</span>
                      <div className="flex flex-wrap gap-1">
                        {characterState.pregnancy.symptoms.map((symptom: string, idx: number) => (
                          <span key={idx} className="text-[9px] px-2 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-md">
                            {symptom}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-zinc-400 font-medium">Protection Used:</span>
                    <span className="text-white font-semibold">{characterState?.pregnancy?.protectionUsed || 'None'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={openPregnancyModal}
                    className="w-full py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Adjust Pregnancy Settings</span>
                  </button>
                </div>

                {/* 2. INVENTORY & MONEY */}
                <div className="p-3.5 rounded-2xl bg-black/40 shadow-sm border border-white/[0.05] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-zinc-300" /> Inventory & Money
                    </span>
                    <button
                      type="button"
                      onClick={openMoneyModal}
                      className="text-[10px] text-zinc-400 hover:text-white font-bold underline cursor-pointer"
                    >
                      Edit Wallet
                    </button>
                  </div>

                  {/* Money Card */}
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white font-bold text-xs">
                        $
                      </div>
                      <span className="text-xs text-zinc-300 font-medium">Money / Wallet</span>
                    </div>
                    <span className="text-sm font-bold text-white font-mono">
                      ${characterState?.inventory?.money ?? characterState?.credits ?? 250}
                    </span>
                  </div>

                  {/* Inventory Items on Person */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Items on Person</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {(characterState?.inventory?.items || ['Smartphone', 'House Keys', 'Student ID']).length} items
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {(characterState?.inventory?.items || ['Smartphone', 'House Keys', 'Student ID']).map((rawItem: any, i: number) => {
                        const item = typeof rawItem === 'string'
                          ? { name: rawItem, location: 'On Person', quantity: 1, equipped: false, description: '' }
                          : rawItem;

                        return (
                          <div 
                            key={i} 
                            className="bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/5 transition-all flex items-center justify-between gap-2 group cursor-pointer"
                            onClick={() => openItemModal(item, i)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-white truncate">{item.name || 'Unnamed Item'}</span>
                                {item.quantity && item.quantity > 1 && (
                                  <span className="text-[9px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-1.5 py-0.2 rounded font-mono font-bold">
                                    x{item.quantity}
                                  </span>
                                )}
                                {item.equipped && (
                                  <span className="text-[8px] bg-white text-black font-extrabold px-1.5 py-0.2 rounded uppercase">
                                    Equipped
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                                <span>{item.location || 'On Person'}</span>
                                {item.description && <span className="text-zinc-500"> — {item.description}</span>}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(i);
                              }}
                              className="text-zinc-500 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
                              title="Remove item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => openItemModal()}
                      className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold transition-all border border-white/10 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 mt-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item on Person</span>
                    </button>
                  </div>
                </div>

                {/* 3. CURRENT LOCATION */}
                <div className="p-3.5 rounded-2xl bg-black/40 shadow-sm border border-white/[0.05] space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-300" /> Current Location
                  </span>
                  {currentPlace?.image && (
                    <div className="w-full h-24 rounded-xl overflow-hidden border border-white/10 relative">
                      <SafeImage src={currentPlace.image} alt={worldLocationInput} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2">
                        <span className="text-xs font-bold text-white drop-shadow">{currentPlace.name}</span>
                      </div>
                    </div>
                  )}
                  <OptimizedInput
                    type="text"
                    value={worldLocationInput ?? ""}
                    onChangeValue={(val) => setWorldLocationInput(val)}
                    onCommit={(val) => {
                      setWorldLocationInput(val);
                      if (val.trim()) {
                        handleManualPlaceOverride(val.trim());
                      }
                    }}
                    placeholder="Current Location..."
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/50"
                  />
                </div>

                {/* 4. TIME PERIOD */}
                <div className="p-3.5 rounded-2xl bg-black/40 shadow-sm border border-white/[0.05] space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-300" /> Time Period
                  </span>
                  <OptimizedInput
                    type="text"
                    value={worldCalendarInput ?? ""}
                    onChangeValue={(val) => setWorldCalendarInput(val)}
                    onCommit={(val) => {
                      setWorldCalendarInput(val);
                      if (targetHistoryId && onUpdateConfig && storageConfig) {
                        const updatedHistories = (storageConfig?.chatHistories || []).map(h => 
                          h.id === targetHistoryId ? { ...h, worldCalendar: val } : h
                        );
                        onUpdateConfig({ chatHistories: updatedHistories });
                      }
                    }}
                    placeholder="e.g. August 15, 2026 - Afternoon"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/50"
                  />
                </div>

                {/* 5. WEATHER & ATMOSPHERE */}
                <div className="p-3.5 rounded-2xl bg-black/40 shadow-sm border border-white/[0.05] space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <CloudSun className="w-3.5 h-3.5 text-zinc-300" /> Weather & Atmosphere
                  </span>
                  <OptimizedInput
                    type="text"
                    value={worldWeatherInput ?? ""}
                    onChangeValue={(val) => setWorldWeatherInput(val)}
                    onCommit={(val) => {
                      setWorldWeatherInput(val);
                      if (targetHistoryId && onUpdateConfig && storageConfig) {
                        const updatedHistories = (storageConfig?.chatHistories || []).map(h => 
                          h.id === targetHistoryId ? { ...h, worldWeather: val } : h
                        );
                        onUpdateConfig({ chatHistories: updatedHistories });
                      }
                    }}
                    placeholder="e.g. Clear skies, gentle breeze"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/50"
                  />
                </div>

              </div>

              {/* Drawer Footer */}
              <div className="p-3.5 border-t border-white/10 bg-white/[0.02] backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setIsDrawerOpen(false);
                    setShowBottomSheet(true);
                    setWorldTabSection('grid');
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <Sliders className="w-4 h-4 text-white" />
                  <span>Open Roleplay Menu</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Orb Economy Modals */}
      {storageConfig && onUpdateConfig && (
        <>
          <OrbWalletModal
            isOpen={showOrbWallet}
            onClose={() => setShowOrbWallet(false)}
            storageConfig={storageConfig}
            onUpdateConfig={onUpdateConfig}
          />

          {/* Status Restore Confirm Modal */}
          <AnimatePresence>
            {restoreStatusModal && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 cursor-pointer"
                  onClick={() => setRestoreStatusModal(null)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="relative w-full max-w-sm bg-[#111111] rounded-2xl border border-white/10 shadow-2xl p-6 text-center"
                >
                  <div className="mx-auto w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-4 border border-white/20">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Restore {restoreStatusModal.statLabel}</h3>
                  <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                    Would you like to spend <span className="font-bold text-white">10 Orbs</span> to instantly restore <span className="font-bold text-white">20%</span> of your {restoreStatusModal.statLabel}?
                  </p>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setRestoreStatusModal(null)}
                      className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if ((storageConfig.orbs || 0) < 10) {
                          setToastMessage("Not enough Orbs! You need at least 10 Orbs.");
                          setRestoreStatusModal(null);
                          return;
                        }
                        
                        onUpdateConfig({ orbs: (storageConfig.orbs || 0) - 10 });
                        
                        const nextVal = Math.min(100, restoreStatusModal.currentVal + 20);
                        handleUpdateCharacterState('status', restoreStatusModal.statKey, nextVal);
                        
                        setToastMessage(`${restoreStatusModal.statLabel} restored by 20%! (-10 Orbs)`);
                        setRestoreStatusModal(null);
                      }}
                      className="flex-1 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    >
                      Confirm
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </>
      )}

      {/* IMMERSIVE PHONE ACCESS BLOCKED MODAL */}
      <AnimatePresence>
        {phoneBlockedReason && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with extreme glass blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPhoneBlockedReason(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-zinc-950/90 border border-white/20 p-6 shadow-2xl text-center space-y-5"
            >
              {/* Animated Accent glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent blur-xs opacity-60" />

              {/* Warning Device Graphic */}
              <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white relative">
                <Smartphone className="w-8 h-8" />
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                  <X className="w-2.5 h-2.5 text-white" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">Device Connection Blocked</h3>
                <p className="text-[10px] font-bold text-white tracking-wider uppercase">Immersive Context Limit</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-white/80 leading-relaxed text-left italic">
                "{phoneBlockedReason}"
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setPhoneBlockedReason(null)}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/10 border border-white/20 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-all active:scale-[0.98]"
                >
                  Return to Roleplay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneBlockedReason(null);
                    setIsPhoneOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/10 border border-white/20 text-white font-bold text-[11px] uppercase tracking-wider cursor-pointer transition-all active:scale-[0.98]"
                >
                  Force Bypass & Unlock Device
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface IsolatedChatInputProps {
  characterName: string;
  isLight: boolean;
  isStreaming: boolean;
  isRepliesEnabled: boolean;
  isPerformanceMode?: boolean;
  showSuggestedAnswers: boolean;
  setShowSuggestedAnswers: (val: boolean | ((prev: boolean) => boolean)) => void;
  selectedImage: string | null;
  setSelectedImage: (val: string | null, name?: string) => void;
  setShowBottomSheet: (val: boolean) => void;
  onSendMessage: (text: string) => void;
  onContinueConversation: () => void;
  messagesLength: number;
  externalText?: string;
  onExternalTextConsumed?: () => void;
}

const IsolatedChatInput: React.FC<IsolatedChatInputProps> = React.memo(({
  characterName,
  isLight,
  isStreaming,
  isRepliesEnabled,
  isPerformanceMode,
  showSuggestedAnswers,
  setShowSuggestedAnswers,
  selectedImage,
  setSelectedImage,
  setShowBottomSheet,
  onSendMessage,
  onContinueConversation,
  messagesLength,
  externalText,
  onExternalTextConsumed,
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        return;
      }
      try {
        const assetId = `chat-img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const dbRef = await storeAsset(assetId, file);
        setSelectedImage(dbRef, file.name);
      } catch (err) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setSelectedImage(event.target.result as string, file.name);
          }
        };
        reader.readAsDataURL(file);
      } finally {
        e.target.value = '';
      }
    }
  };

  const adjustHeight = (newText: string) => {
    const el = textareaRef.current;
    if (!el) return;
    if (!newText) {
      el.style.height = 'auto';
      return;
    }
    const currentLen = newText.length;
    const lastLen = (el as any)._lastLen || 0;
    (el as any)._lastLen = currentLen;

    if (currentLen < lastLen) {
      el.style.height = 'auto';
    }
    const newHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${Math.max(24, newHeight)}px`;
  };

  useEffect(() => {
    if (externalText) {
      setText(prev => {
        const next = prev ? prev + externalText : externalText;
        adjustHeight(next);
        return next;
      });
      if (onExternalTextConsumed) onExternalTextConsumed();
    }
  }, [externalText, onExternalTextConsumed]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    adjustHeight(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isStreaming) return;
    const sentText = text;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      (textareaRef.current as any)._lastLen = 0;
    }
    onSendMessage(sentText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      if (!e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit(e);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex items-end gap-2.5">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      {/* Main Input Pill Capsule */}
      <div className={`flex-1 flex items-center rounded-[22px] shadow-sm transition-colors min-h-[44px] h-auto relative py-1 pl-4 pr-1.5 border focus-within:ring-1 ${
        isPerformanceMode ? '' : 'backdrop-blur-xl'
      } ${
        isLight
          ? 'bg-white/80 border-black/10 focus-within:border-black/20 focus-within:ring-black/5'
          : 'bg-white/[0.03] hover:bg-white/[0.05] border-white/[0.08] focus-within:border-white/20 focus-within:ring-white/10'
      }`}>
        {/* Core Message Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className={`bg-transparent text-xs ${isLight ? 'text-black placeholder:text-black/40' : 'text-white placeholder:text-white/40'} placeholder:font-normal focus:outline-none flex-1 ml-1 mr-1 font-sans font-normal tracking-wide resize-none py-1.5 scrollbar-none max-h-[200px] overflow-y-auto leading-relaxed self-center`}
        />

        {/* Secondary Option Buttons aligned to the right */}
        <div className="flex items-center gap-1 flex-shrink-0 self-center">
          <button
            type="button"
            onClick={() => {
              if (selectedImage) {
                setSelectedImage(null);
              } else {
                fileInputRef.current?.click();
              }
            }}
            className={`w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all cursor-pointer ${isLight ? 'hover:bg-black/5 text-black/40' : 'hover:bg-white/10 text-white/50'}`}
            title="Attach photo"
          >
            <Image className="w-4 h-4" />
          </button>

          {isRepliesEnabled && (
            <button
              type="button"
              onClick={() => setShowSuggestedAnswers(prev => !prev)}
              className={`w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all cursor-pointer ${showSuggestedAnswers ? 'bg-white/15 text-white' : (isLight ? 'hover:bg-black/5 text-black/40' : 'hover:bg-white/10 text-white/50')}`}
              title="Smart Suggested Replies"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          
          <button
            type="button"
            onClick={() => setShowBottomSheet(true)}
            className={`w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all cursor-pointer border shadow-inner ${isLight ? 'bg-black/5 border-black/5 hover:bg-black/10 text-black/70' : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05] text-white'}`}
            title="Companion Settings"
          >
            <Menu className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Exterior Small Circle Action Buttons */}
      {text.trim() ? (
        <button
          type="submit"
          disabled={isStreaming}
          className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 border shadow-sm self-end active:scale-95 backdrop-blur-xl cursor-pointer ${
            !isStreaming
              ? isLight
                ? 'bg-white/80 hover:bg-white border-black/10 text-black'
                : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-white'
              : isLight 
                ? 'bg-black/5 text-black/30 border-black/5 cursor-not-allowed'
                : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
          }`}
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onContinueConversation}
          disabled={isStreaming || messagesLength === 0}
          className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 border shadow-sm self-end active:scale-95 backdrop-blur-xl cursor-pointer ${
            !isStreaming && messagesLength > 0
              ? isLight
                ? 'bg-white/80 hover:bg-white border-black/10 text-black'
                : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-white'
              : isLight 
                ? 'bg-black/5 text-black/30 border-black/5 cursor-not-allowed'
                : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
          }`}
          title="Continue AI response"
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      )}
    </form>
  );
});
