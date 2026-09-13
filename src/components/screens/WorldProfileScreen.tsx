import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { World, ChatHistory, StorageConfig } from '../../types';
import { SafeImage } from '../common/SafeImage';
import { getRealWorldDefaultCalendar } from '../../utils/calendarHelper';
import { 
  ArrowLeft, 
  MessageSquare, 
  Share2, 
  Heart, 
  Trash2, 
  Edit, 
  Clock, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  AlignLeft, X,
  Globe,
  Plus,
  Sparkles
} from 'lucide-react';

interface WorldProfileScreenProps {
  world: World;
  storageConfig: StorageConfig;
  likedWorldIds: string[];
  onBack: () => void;
  onStartChat: (forceNew?: boolean) => void;
  onEdit: (world: World) => void;
  onToggleLike: (worldId: string) => void;
  onDelete: (worldId: string) => void;
  onResumeChat: (historyId: string) => void;
  onNavigateToCharacterProfile?: (personaId: string) => void;
  disableAnimation?: boolean;
}

export function WorldProfileScreen({
  world,
  storageConfig,
  likedWorldIds,
  onBack,
  onStartChat,
  onEdit,
  onToggleLike,
  onDelete,
  onResumeChat,
  onNavigateToCharacterProfile,
  disableAnimation = false
}: WorldProfileScreenProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isInteractable, setIsInteractable] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsInteractable(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const isLiked = likedWorldIds.includes(world.id);
  const chatSessions = (storageConfig.chatHistories || []).filter(h => (h.linkedWorldId === world.id || h.personaId === `world-${world.id}`) && !h.isArchived);
  const sortedSessions = [...chatSessions].sort((a, b) => {
    const timeA = (typeof a.updatedAt === 'number' && !isNaN(a.updatedAt)) ? a.updatedAt : (a.timestamp ? new Date(a.timestamp).getTime() || 0 : 0);
    const timeB = (typeof b.updatedAt === 'number' && !isNaN(b.updatedAt)) ? b.updatedAt : (b.timestamp ? new Date(b.timestamp).getTime() || 0 : 0);
    return timeB - timeA;
  });
  const mostRecentSession = sortedSessions[0] || null;
  const hasExperience = chatSessions.length > 0 && chatSessions.some(s => s.messages && s.messages.length > 0);

  const messageCount = chatSessions.reduce((acc, session) => acc + (session.messages?.length || 0), 0);
  
  const mostRecentTimestamp = sortedSessions[0]?.updatedAt || (sortedSessions[0]?.timestamp ? new Date(sortedSessions[0].timestamp).getTime() : 0);
  const lastConversationDate = mostRecentTimestamp ? new Date(mostRecentTimestamp) : null;
  const isLight = storageConfig?.theme === 'light';

  // Trigger temporary visual feedback toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/?character=${world.id}`;
    
    // Attempt standard clipboard write
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl);
        triggerToast("Profile link copied to clipboard!");
      } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        triggerToast("Profile link copied!");
      }
    } catch (err) {
      console.error("Failed to copy link:", err);
      triggerToast("Failed to copy share link.");
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLike(world.id);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
    triggerToast(!isLiked ? "Added to favorites!" : "Removed from favorites.");
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete(world.id);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 50, 20]);
    }
  };

  const accentHex = '#27272A';
  
  // Custom styled background or avatar
  const hasAvatar = !!world.coverImage;

  // Subtitle/tagline
  const subtitleText = world.tagline || world.tagline || 'AI Companion';

  // Extract description excerpt
  const rawDesc = world.description || "A custom conversational intelligence configured with unique instruction guidelines.";
  const maxChars = 140;
  const isTruncated = rawDesc.length > maxChars;
  const descriptionExcerpt = isTruncated && !isDescExpanded 
    ? `${rawDesc.slice(0, maxChars)}...` 
    : rawDesc;

  return (
    <motion.div 
      initial={disableAnimation ? undefined : { opacity: 0, y: 20 }}
      animate={disableAnimation ? undefined : { opacity: 1, y: 0 }}
      exit={disableAnimation ? undefined : { opacity: 0, y: 20 }}
      className={`fixed inset-0 z-[100] flex flex-col select-none font-sans overflow-hidden ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}
    >
      {/* Dynamic Toast Overlay */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] px-3.5 py-1.5 font-sans font-medium text-[11px] rounded-xl shadow-lg border border-white/15 bg-black/70 backdrop-blur-xl text-white flex items-center gap-2 max-w-[90vw]"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div 
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={`relative w-full max-w-[280px] border rounded-2xl p-5 shadow-2xl z-10 text-center ${isLight ? 'bg-white border-black/10' : 'bg-[#1a1a1c] border-white/10'}`}
            >
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className={`text-sm font-bold mb-2 ${isLight ? 'text-black' : 'text-white'}`}>Delete World?</h3>
              <p className={`text-[11px] leading-relaxed mb-4 ${isLight ? 'text-black/60' : 'text-[#888]'}`}>
                Are you sure you want to delete this world? This action is permanent.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`flex-1 py-2 rounded-xl border font-bold text-[10.5px] active:scale-95 transition-all cursor-pointer ${isLight ? 'bg-black/[0.03] border-black/10 text-black/80 hover:bg-black/[0.06]' : 'bg-white/[0.04] border-white/10 text-white/80 hover:bg-white/[0.08]'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10.5px] active:scale-95 transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FIXED HEADER UPPER HALF BLOCK */}
      <div className="flex-shrink-0">
        {/* Header Profile Cover Accent & Back Action */}
        <div className="relative w-full pt-4 px-4 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between z-20 relative">
            <button
              onClick={onBack}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all active:scale-90 cursor-pointer ${isLight ? 'bg-black/[0.04] border-black/[0.08] text-black/80 hover:bg-black/[0.08]' : 'bg-white/[0.04] border-white/[0.08] text-white/80 hover:bg-white/[0.08]'}`}
              id="profile-back-button"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            
            <div className={`text-[9px] font-sans font-bold tracking-widest uppercase ${isLight ? 'text-black/40' : 'text-[#666]'}`}>
              World Profile
            </div>

            <div className="w-8 h-8 opacity-0 pointer-events-none" />
          </div>

          {/* Backdrop visual element using accent color */}
          <div 
            className="absolute inset-0 h-44 opacity-10 blur-[80px] pointer-events-none -z-10 rounded-full"
            style={{ backgroundColor: accentHex }}
          />
        </div>

        {/* Profile Header Block */}
        <div className="px-5 text-center flex flex-col items-center mt-2 flex-shrink-0">
          {/* Large Avatar Card */}
          <div 
            className="w-20 h-20 rounded-[24px] p-[3px] border relative transition-transform duration-300 shadow-lg"
            style={{ borderColor: `${accentHex}44` }}
          >
            <div className={`w-full h-full rounded-[20px] overflow-hidden relative border ${isLight ? 'border-black/10' : 'border-white/10'}`}>
              {hasAvatar ? (
                <SafeImage 
                  src={world.coverImage} 
                  referrerPolicy="no-referrer" 
                  className="w-full h-full object-cover" 
                  alt={world.name}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center relative bg-black/20">
                </div>
              )}
            </div>
            {/* Accent glow ring behind */}
            <div 
              className="absolute -inset-1 blur-md rounded-[28px] -z-10 opacity-35"
              style={{ backgroundColor: accentHex }}
            />
          </div>

          {/* Character Title Information */}
          <h1 className={`text-base font-black mt-3 font-sans tracking-tight ${isLight ? 'text-black' : 'text-white'}`}>{world.name}</h1>
          <p className={`text-[11px] font-medium leading-normal mt-0.5 max-w-[240px] ${isLight ? 'text-black/60' : 'text-white/60'}`}>
            {subtitleText}
          </p>

          {/* Action primary buttons */}
          <div className="w-full mt-5 z-10 px-5">
            {hasExperience && mostRecentSession ? (
              <div className="flex gap-2.5 w-full">
                <button
                  onClick={() => {
                    if (chatSessions.length > 1) {
                      setShowSessions(true);
                    } else if (mostRecentSession) {
                      onResumeChat(mostRecentSession.id);
                    } else {
                      onStartChat();
                    }
                  }}
                  className={`flex-1 py-3 px-3 rounded-xl border font-extrabold text-[11px] tracking-wider transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 cursor-pointer font-sans ${isLight ? 'bg-zinc-800 hover:bg-zinc-900 border-zinc-900 text-white shadow-md' : 'bg-zinc-800 hover:bg-zinc-900 border-white/10 text-white shadow-[0_4px_16px_rgba(255,255,255,0.05)]'}`}
                >
                  <Globe className="w-3.5 h-3.5 text-white flex-shrink-0" />
                  <span className="truncate">{chatSessions.length > 1 ? `Sessions (${chatSessions.length})` : 'Continue World'}</span>
                </button>
                <button
                  onClick={() => onStartChat(true)}
                  className={`flex-1 py-3 px-3 rounded-xl border font-extrabold text-[11px] tracking-wider transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 cursor-pointer font-sans ${isLight ? 'bg-black/[0.04] hover:bg-black/[0.08] border-black/10 text-black' : 'bg-white/[0.06] hover:bg-white/10 border-white/10 text-white'}`}
                >
                  <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">Enter World</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => onStartChat()}
                className={`w-full py-3 rounded-xl border font-extrabold text-xs tracking-wider transition-all active:scale-[0.97] flex items-center justify-center gap-1 cursor-pointer font-sans ${isLight ? 'bg-zinc-800 hover:bg-zinc-900 border-zinc-900 text-white shadow-md' : 'bg-zinc-800 hover:bg-zinc-900 border-white/10 text-white shadow-[0_4px_16px_rgba(255,255,255,0.05)]'}`}
              >
                <MessageSquare className="w-3.5 h-3.5 fill-white text-white" />
                <span>Enter World</span>
              </button>
            )}
          </div>

          <div className="w-full mt-3 z-10 px-5 flex gap-2">
            {true && (
              <button
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(10);
                  }
                  onEdit(world);
                }}
                className={`flex-1 py-2.5 rounded-xl border text-[10px] font-extrabold tracking-wider uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer ${isLight ? 'bg-black/[0.02] hover:bg-black/[0.04] border-black/[0.08] text-zinc-700 hover:text-zinc-900' : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-zinc-300 hover:text-zinc-100'}`}
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Customize</span>
              </button>
            )}

            <button
              onClick={handleShare}
              className={`w-11 py-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-[0.98] cursor-pointer flex-shrink-0 ${isLight ? 'bg-black/[0.02] hover:bg-black/[0.04] border-black/[0.08]' : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]'}`}
            >
              <Share2 className={`w-3.5 h-3.5 ${isLight ? 'text-zinc-400' : 'text-zinc-400'}`} />
            </button>
            
            <button
              onClick={handleToggleFavorite}
              className={`w-11 py-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-[0.98] cursor-pointer flex-shrink-0 ${isLight ? 'bg-black/[0.02] hover:bg-black/[0.04] border-black/[0.08]' : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]'}`}
            >
              <Heart className={`w-3.5 h-3.5 stroke-[2.2] ${isLiked ? 'text-rose-500 fill-rose-500' : isLight ? 'text-zinc-400' : 'text-zinc-400'}`} />
            </button>

            {true && (
              <button
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(15);
                  }
                  setShowDeleteConfirm(true);
                }}
                className={`w-11 py-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-[0.98] cursor-pointer flex-shrink-0 ${isLight ? 'bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/20' : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20'}`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              </button>
            )}
          </div>
        </div>

        {/* GLOWY STATS & DESCRIPTION */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-5 mt-6 pb-24 space-y-4">
          <div className="flex gap-3">
            <div 
              onClick={() => {
                if (chatSessions.length > 0) {
                  setShowSessions(true);
                  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
                }
              }}
              className={`flex-1 p-3.5 rounded-2xl border backdrop-blur-md relative overflow-hidden ${chatSessions.length > 0 ? 'cursor-pointer active:scale-95 transition-all' : ''} ${isLight ? 'bg-white/60 border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]' : 'bg-white/[0.02] border-white/5 shadow-[0_4px_20px_rgba(255,255,255,0.01)]'}`}
            >
              <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-[0.15]`} style={{ backgroundColor: accentHex }} />
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <MessageSquare className="w-3.5 h-3.5 text-current opacity-60" style={{ color: accentHex }} />
                <span className={`text-[9px] font-extrabold uppercase tracking-widest flex-1 ${isLight ? 'text-black/40' : 'text-white/40'}`}>Sessions</span>
                {chatSessions.length > 0 && <ChevronRight className={`w-3 h-3 opacity-50`} />}
              </div>
              <div className={`text-xl font-black font-sans relative z-10 ${isLight ? 'text-black' : 'text-white'}`}>
                {chatSessions.length.toLocaleString()}
              </div>
            </div>
            
            <div className={`flex-1 p-3.5 rounded-2xl border backdrop-blur-md relative overflow-hidden ${isLight ? 'bg-white/60 border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]' : 'bg-white/[0.02] border-white/5 shadow-[0_4px_20px_rgba(255,255,255,0.01)]'}`}>
              <div className={`absolute -bottom-6 -left-6 w-20 h-20 rounded-full blur-2xl opacity-[0.15]`} style={{ backgroundColor: accentHex }} />
              <div className="flex items-center gap-2 mb-1.5 relative z-10">
                <Clock className="w-3.5 h-3.5 text-current opacity-60" style={{ color: accentHex }} />
                <span className={`text-[9px] font-extrabold uppercase tracking-widest ${isLight ? 'text-black/40' : 'text-white/40'}`}>Last Chat</span>
              </div>
              <div className={`flex flex-col relative z-10 truncate ${isLight ? 'text-black' : 'text-white'}`}>
                {lastConversationDate && !isNaN(lastConversationDate.getTime()) ? (
                  <>
                    <span className="text-[13px] font-bold">{lastConversationDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    <span className={`text-[10px] font-bold ${isLight ? 'text-black/50' : 'text-white/50'}`}>{lastConversationDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                ) : (
                  <span className="text-[13px] font-bold">Not available</span>
                )}
              </div>
            </div>
          </div>

          {/* World Parameters & Simulation Info */}
          <div className={`p-4 rounded-2xl border backdrop-blur-md relative overflow-hidden ${isLight ? 'bg-white/60 border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]' : 'bg-white/[0.02] border-white/5 shadow-[0_4px_20px_rgba(255,255,255,0.01)]'}`}>
            <h3 className={`text-[10px] font-extrabold uppercase tracking-widest mb-3 relative z-10 flex items-center gap-2 ${isLight ? 'text-black/40' : 'text-white/40'}`}>
              <Clock className="w-3.5 h-3.5 opacity-70" />
              World Environment & Dynamics
            </h3>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-black/[0.02] border-black/5' : 'bg-white/[0.02] border-white/5'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-wider block mb-0.5 ${isLight ? 'text-black/40' : 'text-white/40'}`}>Atmosphere</span>
                <span className={`font-semibold ${isLight ? 'text-black' : 'text-white'}`}>{world.defaultAtmosphere || 'Clear & Vibrant'}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-black/[0.02] border-black/5' : 'bg-white/[0.02] border-white/5'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-wider block mb-0.5 ${isLight ? 'text-black/40' : 'text-white/40'}`}>World Calendar</span>
                <span className={`font-semibold ${isLight ? 'text-black' : 'text-white'}`}>{getRealWorldDefaultCalendar(world.defaultCalendar)}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-black/[0.02] border-black/5' : 'bg-white/[0.02] border-white/5'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-wider block mb-0.5 ${isLight ? 'text-black/40' : 'text-white/40'}`}>Starting Location</span>
                <span className={`font-semibold ${isLight ? 'text-black' : 'text-white'}`}>{world.defaultLocation || (world.places?.[0]?.name) || 'Central Hub'}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-black/[0.02] border-black/5' : 'bg-white/[0.02] border-white/5'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-wider block mb-0.5 ${isLight ? 'text-black/40' : 'text-white/40'}`}>Initial Reputation</span>
                <span className={`font-semibold ${isLight ? 'text-black' : 'text-white'}`}>{world.defaultReputation || 'Neutral Citizen'}</span>
              </div>
            </div>

            {/* Places Tag Pill Cloud */}
            {world.places && world.places.length > 0 && (
              <div className="mt-3">
                <span className={`text-[9px] font-bold uppercase tracking-wider block mb-1.5 ${isLight ? 'text-black/40' : 'text-white/40'}`}>Locations & Scenes ({world.places.length})</span>
                <div className="flex flex-wrap gap-1.5">
                  {world.places.map((place, i) => (
                    <span key={i} className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium ${isLight ? 'bg-black/5 border-black/10 text-black/80' : 'bg-white/5 border-white/10 text-white/80'}`}>
                      📍 {place.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ambient Soundscapes Cloud */}
            {world.ambientSounds && world.ambientSounds.length > 0 && (
              <div className="mt-3">
                <span className={`text-[9px] font-bold uppercase tracking-wider block mb-1.5 ${isLight ? 'text-black/40' : 'text-white/40'}`}>Soundscapes ({world.ambientSounds.length})</span>
                <div className="flex flex-wrap gap-1.5">
                  {world.ambientSounds.map((sound, i) => (
                    <span key={i} className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium ${isLight ? 'bg-black/5 border-black/10 text-black/80' : 'bg-white/5 border-white/10 text-white/80'}`}>
                      🎵 {sound.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className={`p-4 rounded-2xl border backdrop-blur-md relative overflow-hidden ${isLight ? 'bg-white/60 border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]' : 'bg-white/[0.02] border-white/5 shadow-[0_4px_20px_rgba(255,255,255,0.01)]'}`}>
            <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-[0.12]`} style={{ backgroundColor: accentHex }} />
            <h3 className={`text-[10px] font-extrabold uppercase tracking-widest mb-3 relative z-10 flex items-center gap-2 ${isLight ? 'text-black/40' : 'text-white/40'}`}>
              <AlignLeft className="w-3.5 h-3.5 opacity-70" />
              World Architecture
            </h3>
            <p className={`text-[11px] leading-relaxed font-sans relative z-10 break-words ${isLight ? 'text-black/80' : 'text-white/80'}`}>
              {descriptionExcerpt}
            </p>
            {isTruncated && (
              <button
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                style={{ color: accentHex }}
                className="mt-2 text-[10px] font-bold flex items-center gap-1 hover:brightness-125 transition-all cursor-pointer relative z-10 uppercase tracking-wide"
              >
                <span>{isDescExpanded ? 'Show less' : 'Read full architecture'}</span>
                {isDescExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* World Opening Greeting */}
          {world.greeting ? (
            <div 
              onClick={() => onEdit(world)}
              className={`p-4 rounded-2xl border backdrop-blur-md relative overflow-hidden transition-all cursor-pointer hover:border-white/20 ${isLight ? 'bg-white/60 border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]' : 'bg-white/[0.02] border-white/5 shadow-[0_4px_20px_rgba(255,255,255,0.01)]'}`}
            >
              <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-[0.08]`} style={{ backgroundColor: accentHex }} />
              <div className="flex items-center justify-between mb-2 relative z-10">
                <h3 className={`text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 ${isLight ? 'text-black/40' : 'text-white/40'}`}>
                  <Sparkles className="w-3.5 h-3.5 opacity-70" style={{ color: accentHex }} />
                  World Opening Greeting
                </h3>
                <Edit className="w-3.5 h-3.5 opacity-50 hover:opacity-100" style={{ color: accentHex }} />
              </div>
              <p className={`text-[11px] leading-relaxed font-sans relative z-10 whitespace-pre-wrap break-words italic ${isLight ? 'text-black/80' : 'text-white/80'}`}>
                "{world.greeting}"
              </p>
            </div>
          ) : (
            <div 
              onClick={() => onEdit(world)}
              className={`p-4 rounded-2xl border border-dashed backdrop-blur-md relative overflow-hidden cursor-pointer transition-all hover:bg-white/[0.04] ${isLight ? 'bg-white/40 border-black/10' : 'bg-white/[0.01] border-white/10'}`}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-accent">
                <Plus className="w-4 h-4" />
                <span>Add World Opening Greeting</span>
              </div>
              <p className={`text-[10px] mt-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                Set a custom greeting message or scene introduction that appears as the first message of this world.
              </p>
            </div>
          )}

          {/* Example World Chats & Atmospheric Style */}
          {world.exampleDialogue ? (
            <div 
              onClick={() => onEdit(world)}
              className={`p-4 rounded-2xl border backdrop-blur-md relative overflow-hidden transition-all cursor-pointer hover:border-white/20 ${isLight ? 'bg-white/60 border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]' : 'bg-white/[0.02] border-white/5 shadow-[0_4px_20px_rgba(255,255,255,0.01)]'}`}
            >
              <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-[0.08]`} style={{ backgroundColor: accentHex }} />
              <div className="flex items-center justify-between mb-3 relative z-10">
                <h3 className={`text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 ${isLight ? 'text-black/40' : 'text-white/40'}`}>
                  <MessageSquare className="w-3.5 h-3.5 opacity-70" style={{ color: accentHex }} />
                  Example World Chats & Atmospheric Style
                </h3>
                <Edit className="w-3.5 h-3.5 opacity-50 hover:opacity-100" style={{ color: accentHex }} />
              </div>
              <p className={`text-[11px] leading-relaxed font-mono relative z-10 whitespace-pre-wrap break-words ${isLight ? 'text-black/80' : 'text-white/80'}`}>
                {world.exampleDialogue}
              </p>
            </div>
          ) : (
            <div 
              onClick={() => onEdit(world)}
              className={`p-4 rounded-2xl border border-dashed backdrop-blur-md relative overflow-hidden cursor-pointer transition-all hover:bg-white/[0.04] ${isLight ? 'bg-white/40 border-black/10' : 'bg-white/[0.01] border-white/10'}`}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-accent">
                <Plus className="w-4 h-4" />
                <span>Add Example World Chats & Atmospheric Style</span>
              </div>
              <p className={`text-[10px] mt-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                Define sample conversations and narration to shape how characters and the environment respond in this World.
              </p>
            </div>
          )}

          {/* Dedicated Chat Sessions Section */}
          <div className={`p-4 rounded-2xl border backdrop-blur-md relative overflow-hidden ${isLight ? 'bg-white/60 border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]' : 'bg-white/[0.02] border-white/5 shadow-[0_4px_20px_rgba(255,255,255,0.01)]'}`}>
            <div className={`absolute -top-10 -left-10 w-32 h-32 rounded-full blur-3xl opacity-[0.08]`} style={{ backgroundColor: accentHex }} />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <h3 className={`text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 ${isLight ? 'text-black/40' : 'text-white/40'}`}>
                <MessageSquare className="w-3.5 h-3.5 opacity-70" style={{ color: accentHex }} />
                Active Sessions ({chatSessions.length})
              </h3>
              <button
                onClick={() => onStartChat(true)}
                style={{ color: accentHex, borderColor: `${accentHex}30` }}
                className="text-[9px] font-bold px-2 py-1 rounded-lg border hover:bg-white/10 active:scale-95 transition-all uppercase tracking-wide cursor-pointer z-10"
              >
                + New Session
              </button>
            </div>

            {chatSessions.length === 0 ? (
              <div className="text-center py-6 relative z-10">
                <p className={`text-[11px] ${isLight ? 'text-black/50' : 'text-white/40'} mb-3`}>No previous sessions found.</p>
                <button
                  onClick={() => onStartChat(false)}
                  style={{ backgroundColor: accentHex }}
                  className="px-4 py-2 rounded-xl text-[10px] font-bold text-white uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  Start First Session
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-none relative z-10">
                {[...chatSessions].sort((a, b) => {
                  const timeA = a.updatedAt || parseInt(a.id?.split('-')[1]) || 0;
                  const timeB = b.updatedAt || parseInt(b.id?.split('-')[1]) || 0;
                  return timeB - timeA;
                }).map(session => {
                  const ts = session.updatedAt || parseInt(session.id?.split('-')[1]) || 0;
                  const dateStr = ts 
                    ? `${new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
                    : (session.timestamp || 'Recently');
                  return (
                    <button
                      key={session.id}
                      onClick={() => onResumeChat(session.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all active:scale-[0.98] flex flex-col gap-1.5 ${
                        isLight 
                          ? 'bg-white border-black/5 hover:border-black/10' 
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[9px] font-extrabold ${isLight ? 'text-black/40' : 'text-white/40'}`}>
                          {dateStr}
                        </span>
                        <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${isLight ? 'bg-black/5 text-black/60' : 'bg-white/5 text-white/60'}`}>
                          {session.messages?.length || 0} msgs
                        </span>
                      </div>
                      <p className={`text-[11px] font-sans line-clamp-1 leading-snug ${isLight ? 'text-black/70' : 'text-white/80'}`}>
                        {session.messages?.[session.messages.length - 1]?.text || 'No messages yet...'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sessions Overlay Modal */}
      <AnimatePresence>
        {showSessions && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`absolute inset-0 z-50 flex flex-col p-4 backdrop-blur-md ${isLight ? 'bg-white/95' : 'bg-[#0A0A0A]/95'}`}
          >
            <div className="flex items-center justify-between mb-4 mt-2 px-1">
              <h3 className={`text-sm font-extrabold ${isLight ? 'text-black' : 'text-white'} uppercase tracking-wider font-sans`}>Select Session</h3>
              <button 
                onClick={() => setShowSessions(false)}
                className={`p-2 rounded-full active:scale-90 transition-all ${isLight ? 'bg-black/5 text-black/60' : 'bg-white/10 text-white/60'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pb-8 scrollbar-none">
              <button
                onClick={() => {
                  setShowSessions(false);
                  onStartChat(true);
                }}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.98] flex items-center gap-3 cursor-pointer ${
                  isLight
                    ? 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100'
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-200 hover:bg-purple-500/20'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-200 text-purple-800' : 'bg-purple-500/20 text-purple-300'}`}>
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Start Fresh Session</div>
                  <div className={`text-[10px] ${isLight ? 'text-purple-700/70' : 'text-purple-300/60'}`}>Enter world in a brand new, independent session</div>
                </div>
              </button>

              {chatSessions.sort((a, b) => new Date(b.updatedAt || b.timestamp).getTime() - new Date(a.updatedAt || a.timestamp).getTime()).map(session => (
                <button
                  key={session.id}
                  onClick={() => {
                    setShowSessions(false);
                    onResumeChat(session.id);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.98] flex flex-col gap-2 ${
                    isLight 
                      ? 'bg-white border-black/10 shadow-sm hover:border-black/20' 
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-bold ${isLight ? 'text-black/60' : 'text-white/60'}`}>
                      {new Date(session.updatedAt || session.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {new Date(session.updatedAt || session.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isLight ? 'bg-black/5 text-black' : 'bg-white/10 text-white'}`}>
                      {session.messages?.length || 0} msgs
                    </span>
                  </div>
                  <p className={`text-sm font-sans line-clamp-2 ${isLight ? 'text-black' : 'text-white/90'}`}>
                    {session.messages?.[session.messages.length - 1]?.text || 'No messages yet...'}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
