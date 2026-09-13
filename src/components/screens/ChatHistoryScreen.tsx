import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ChatHistory, Persona, StorageConfig, World } from '../../types';
import { SafeImage } from '../common/SafeImage';
import { MessageSquare, Calendar, Trash2, ArrowRight, Sparkles, FolderArchive, Pin, PinOff, Archive, ArchiveRestore, X, AlertTriangle, Globe } from 'lucide-react';
import { CharacterProfileScreen } from './CharacterProfileScreen';

interface ChatHistoryScreenProps {
  chatHistories: ChatHistory[];
  personas: Persona[];
  worlds: World[];
  onSelectChat: (historyId: string) => void;
  onDeleteChat: (historyId: string, e?: React.MouseEvent) => void;
  onNavigateToPersonas: () => void;
  onTogglePinChat: (historyId: string) => void;
  onToggleArchiveChat: (historyId: string) => void;
  theme?: string;
  storageConfig?: StorageConfig;
  onToggleLikePersona?: (personaId: string) => void;
  onDeletePersona?: (personaId: string) => void;
  onStartChat?: (personaId: string) => void;
  onEditPersona?: (personaId: string) => void;
  onUpdateConfig?: (updates: Partial<StorageConfig>) => void;
  onOpenWorldCreator?: () => void;
  onNavigateToWorld?: (worldId: string) => void;
  onNavigateToWorldProfile?: (worldId: string) => void;
  onNavigateToCharacterProfile?: (personaId: string) => void;
  activeSection?: 'characters' | 'worlds';
  onSectionChange?: (section: 'characters' | 'worlds') => void;
}

export const ChatHistoryScreen: React.FC<ChatHistoryScreenProps> = React.memo(({
  chatHistories,
  personas,
  worlds,
  onSelectChat,
  onDeleteChat,
  onNavigateToPersonas,
  onOpenWorldCreator,
  onNavigateToWorld,
  onTogglePinChat,
  onToggleArchiveChat,
  onNavigateToWorldProfile,
  onNavigateToCharacterProfile,
  theme = 'dark',
  storageConfig,
  onToggleLikePersona,
  onDeletePersona,
  onStartChat,
  onEditPersona,
  onUpdateConfig,
  activeSection: propActiveSection,
  onSectionChange: propOnSectionChange,
}) => {
  const [selectedChatForMenu, setSelectedChatForMenu] = useState<ChatHistory | null>(null);
  const [showArchiveScreen, setShowArchiveScreen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ChatHistory | null>(null);
  
  const [localActiveSection, setLocalActiveSection] = useState<'characters' | 'worlds'>('characters');
  const activeSection = propActiveSection !== undefined ? propActiveSection : localActiveSection;
  const setActiveSection = propOnSectionChange !== undefined ? propOnSectionChange : setLocalActiveSection;

  const [selectedPersonaForProfile, setSelectedPersonaForProfile] = useState<Persona | null>(null);
  const [activeArchiveSection, setActiveArchiveSection] = useState<'characters' | 'worlds'>('characters');

  const isLight = theme === 'light';

  const touchTimerRef = useRef<any>(null);
  const touchStartCoords = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  // Trigger brief vibration simulation
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  // Hold Gesture triggers
  const handleTouchStart = (chat: ChatHistory, e: React.TouchEvent) => {
    hasMovedRef.current = false;
    if (e.touches && e.touches[0]) {
      touchStartCoords.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      triggerHaptic();
      setSelectedChatForMenu(chat);
    }, 550); // Holding duration
  };

  const handlePinAction = (chat: ChatHistory) => {
    if (chat.id.startsWith('mock-world-')) {
       const realChat = { ...chat, id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, isPinned: true };
       if (onUpdateConfig) {
          onUpdateConfig({ chatHistories: [realChat, ...chatHistories] });
       }
    } else {
       onTogglePinChat(chat.id);
    }
  };

  const handleArchiveAction = (chat: ChatHistory) => {
    if (chat.id.startsWith('mock-world-')) {
       const realChat = { ...chat, id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, isArchived: true };
       if (onUpdateConfig) {
          onUpdateConfig({ chatHistories: [realChat, ...chatHistories] });
       }
    } else {
       onToggleArchiveChat(chat.id);
    }
  };

  const handleDeleteAction = (chat: ChatHistory) => {
    setChatToDelete(chat);
  };

  const handleWorldTouchStart = (world: World, e: React.TouchEvent, session?: ChatHistory) => {
    hasMovedRef.current = false;
    if (e.touches && e.touches[0]) {
      touchStartCoords.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      triggerHaptic();
      const chatSession: ChatHistory = session || {
        id: `mock-world-${world.id}`,
        personaId: world.linkedCharacterIds?.[0] || 'tech-mentor',
        personaName: world.name,
        avatarGradient: 'from-blue-500/20 to-purple-500/30',
        lastMessage: 'Enter this world to start your story.',
        timestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        updatedAt: Date.now(),
        messages: [],
        linkedWorldId: world.id,
        isPinned: false,
        isArchived: false,
      };
      setSelectedChatForMenu(chatSession);
    }, 550); // Holding duration
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    touchStartCoords.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartCoords.current && e.touches && e.touches[0]) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);
      if (deltaX > 10 || deltaY > 10) {
        hasMovedRef.current = true;
        if (touchTimerRef.current) {
          clearTimeout(touchTimerRef.current);
          touchTimerRef.current = null;
        }
      }
    } else {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  };

  const handleMouseDown = (chat: ChatHistory) => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      triggerHaptic();
      setSelectedChatForMenu(chat);
    }, 550);
  };

  const handleWorldMouseDown = (world: World, session?: ChatHistory) => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      triggerHaptic();
      const chatSession: ChatHistory = session || {
        id: `mock-world-${world.id}`,
        personaId: world.linkedCharacterIds?.[0] || 'tech-mentor',
        personaName: world.name,
        avatarGradient: 'from-blue-500/20 to-purple-500/30',
        lastMessage: 'Enter this world to start your story.',
        timestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        updatedAt: Date.now(),
        messages: [],
        linkedWorldId: world.id,
        isPinned: false,
        isArchived: false,
      };
      setSelectedChatForMenu(chatSession);
    }, 550);
  };

  const handleMouseUp = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const formatHistoryTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const now = new Date();
      
      // If today, show time
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      
      // If yesterday, show 'Yesterday'
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      
      // If within last 7 days, show day name
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      }

      // Otherwise show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return isoString;
    }
  };

  // Helper to extract the most appropriate display text for the card - simplified to show the absolute latest message
  const getDisplayMessage = (chat: ChatHistory) => {
    if (chat.messages && chat.messages.length > 0) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg && lastMsg.text && lastMsg.text.trim() !== '') {
        return lastMsg.text;
      }
    }
    // Fallbacks
    if (chat.lastMessage && chat.lastMessage.trim() !== '') return chat.lastMessage;
    return "No conversation history yet...";
  };

  // Robust filter for world chats
  const isWorldChat = (h: ChatHistory) => !!h.linkedWorldId || h.personaId.startsWith('world-');

  const getSessionTime = (h: ChatHistory) => h.updatedAt || parseInt(h.id?.split('-')[1]) || 0;

  // Filter histories
  const mainChats = chatHistories
    .filter(h => !h.isArchived && !isWorldChat(h))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return getSessionTime(b) - getSessionTime(a);
    });

  const worldChats = chatHistories
    .filter(h => !h.isArchived && isWorldChat(h))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return getSessionTime(b) - getSessionTime(a);
    });

  const archivedChats = chatHistories
    .filter(h => h.isArchived)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  const archivedCharacters = archivedChats.filter(c => !c.linkedWorldId);
  const archivedWorlds = archivedChats.filter(c => !!c.linkedWorldId);

  const activeCount = mainChats.length;
  const archivedCount = archivedChats.length;

  return (
    <div className={`flex-1 flex flex-col relative h-full overflow-hidden select-none font-sans ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}>
      {/* Fixed Top Header */}
      <div className={`flex-none px-5 pt-6 pb-2 border-b z-10 flex flex-col gap-4 ${isLight ? 'bg-white border-black/[0.05]' : 'bg-[#121214] border-white/[0.05]'}`}>
        <div className="flex items-center justify-between font-sans">
          <div className="flex flex-col">
            <h2 className={`text-2xl font-extrabold tracking-tight font-sans ${isLight ? 'text-black' : 'text-white'}`}>My Chats</h2>
          </div>
          <button
            onClick={() => {
              triggerHaptic();
              setShowArchiveScreen(true);
            }}
            className={`py-2 px-3.5 rounded-xl border font-extrabold text-[9px] tracking-widest uppercase transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
              isLight 
                ? 'bg-black/5 border-black/10 text-black hover:bg-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                : 'bg-accent/10 border-accent/25 text-white shadow-[0_2px_10px_rgba(170,170,170,0.15)] hover:bg-accent/20 hover:border-accent/40 hover:shadow-[0_4px_20px_rgba(170,170,170,0.22)]'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5 text-accent" />
            <span>Archived ({archivedCount})</span>
          </button>
        </div>

        {/* Section/Tab Selector: Characters vs Worlds */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl relative bg-transparent border-none">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveSection('characters');
            }}
            className={`relative py-2.5 text-[10px] font-extrabold tracking-widest uppercase rounded-xl transition-all duration-300 cursor-pointer z-10 flex items-center justify-center gap-1.5 ${
              activeSection === 'characters'
                ? isLight
                  ? 'text-black font-extrabold'
                  : 'text-accent scale-105 drop-shadow-[0_0_8px_rgba(170,170,170,0.3)]'
                : isLight
                  ? 'text-black/50 hover:text-black/80'
                  : 'text-white/45 hover:text-white/80'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Characters</span>
            {activeCount > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                activeSection === 'characters'
                  ? isLight
                    ? 'bg-black/10 text-black'
                    : 'bg-accent/20 text-accent border border-accent/20'
                  : isLight
                    ? 'bg-black/10 text-black/60'
                    : 'bg-white/10 text-white/40'
              }`}>
                {activeCount}
              </span>
            )}
            {activeSection === 'characters' && (
              <motion.div
                layoutId="activeHistorySectionPill"
                className={`absolute inset-0 rounded-xl -z-10 border ${
                  isLight 
                    ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]' 
                    : 'bg-accent/10 border-accent/25 shadow-[0_2px_10px_rgba(170,170,170,0.15)]'
                }`}
                transition={{ duration: 0.22, ease: "easeOut" }}
              />
            )}
          </button>
          
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveSection('worlds');
            }}
            className={`relative py-2.5 text-[10px] font-extrabold tracking-widest uppercase rounded-xl transition-all duration-300 cursor-pointer z-10 flex items-center justify-center gap-1.5 ${
              activeSection === 'worlds'
                ? isLight
                  ? 'text-black font-extrabold'
                  : 'text-accent scale-105 drop-shadow-[0_0_8px_rgba(170,170,170,0.3)]'
                : isLight
                  ? 'text-black/50 hover:text-black/80'
                  : 'text-white/45 hover:text-white/80'
            }`}
          >
            <Globe className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Worlds</span>
            {worldChats.length > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                activeSection === 'worlds'
                  ? isLight
                    ? 'bg-black/10 text-black'
                    : 'bg-accent/20 text-accent border border-accent/20'
                  : isLight
                    ? 'bg-black/10 text-black/60'
                    : 'bg-white/10 text-white/40'
              }`}>
                {worldChats.length}
              </span>
            )}
            {activeSection === 'worlds' && (
              <motion.div
                layoutId="activeHistorySectionPill"
                className={`absolute inset-0 rounded-xl -z-10 border ${
                  isLight 
                    ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]' 
                    : 'bg-accent/10 border-accent/25 shadow-[0_2px_10px_rgba(170,170,170,0.15)]'
                }`}
                transition={{ duration: 0.22, ease: "easeOut" }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Scrollable list content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24 scrollbar-none font-sans pt-3">
        <div className="w-full">

          {activeSection === 'characters' ? (
            /* Main Chats List */
            activeCount === 0 ? (
              <div className={`mt-12 flex flex-col items-center text-center p-6 rounded-2xl border shadow-2xl font-sans ${
                isLight ? 'bg-white border-black/[0.05] shadow-sm' : 'bg-white/[0.01] backdrop-blur-md border-white/[0.04]'
              }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${
                  isLight ? 'bg-black/[0.03] border-black/[0.06]' : 'bg-white/[0.03] border-white/[0.06]'
                }`}>
                  <Sparkles className={`w-5 h-5 ${isLight ? 'text-black/35' : 'text-white/20'}`} />
                </div>
                <h3 className={`text-xs font-bold mb-1 font-sans ${isLight ? 'text-black' : 'text-white'}`}>No Active Chats</h3>
                <p className={`text-[11px] max-w-[200px] leading-relaxed mb-6 font-normal tracking-wide font-sans ${
                  isLight ? 'text-black/50' : 'text-white/40'
                }`}>
                  Choose or design your custom AI companion in the catalog screen.
                </p>
                <button
                  onClick={onNavigateToPersonas}
                  className={`px-5 py-2.5 rounded-2xl font-bold text-[11px] tracking-wide transition-all duration-300 active:scale-95 flex items-center gap-1.5 shadow-md font-sans ${
                    isLight 
                      ? 'bg-zinc-950 hover:bg-zinc-850 text-white shadow-zinc-950/10' 
                      : 'bg-accent hover:bg-accent/95 text-white shadow-[0_4px_12px_rgba(124,92,252,0.3)]'
                  }`}
                >
                  <span>Explore Catalog</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-3 mt-4 font-sans animate-fadeIn">
                {mainChats.map((chat) => {
                  const persona = personas.find((p) => p.id === chat.personaId);
                  
                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        if (!hasMovedRef.current) {
                          onSelectChat(chat.id);
                        }
                      }}
                      onTouchStart={(e) => handleTouchStart(chat, e)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                      onMouseDown={() => handleMouseDown(chat)}
                      onMouseUp={handleMouseUp}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 group relative overflow-hidden font-sans active:scale-[0.98] ${
                        chat.isPinned 
                          ? isLight 
                            ? 'bg-black/10 border-black/15 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:bg-black/15' 
                            : 'bg-accent/20 border-accent/35 shadow-[0_4px_15px_rgba(170,170,170,0.15)] hover:bg-accent/25' 
                          : isLight 
                            ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:bg-black/10 hover:border-black/15' 
                            : 'bg-accent/10 border-accent/20 shadow-[0_4px_12px_rgba(170,170,170,0.08)] hover:bg-accent/15 hover:border-accent/30 hover:shadow-[0_4px_20px_rgba(170,170,170,0.15)]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Companion Avatar (Tap-to-profile) */}
                    <div 
                      className={`w-10 h-10 rounded-2xl border flex-shrink-0 relative overflow-hidden shadow-inner cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 ${
                        isLight ? 'border-black/10' : 'border-white/10'
                      }`}
                      title="View Profile"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (persona) onNavigateToCharacterProfile?.(persona.id);
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                          {persona && persona.avatar ? (
                            <SafeImage 
                              src={persona.avatar} 
                              referrerPolicy="no-referrer" 
                              className="w-full h-full object-cover" 
                              alt={chat.personaName}
                            />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${chat.avatarGradient || 'from-purple-500/20 to-pink-500/30'}`}>
                              {/* Blank color */}
                            </div>
                          )}
                          {persona?.isCustom && (
                            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border flex items-center justify-center text-[7px] font-black z-10 ${
                              isLight ? 'bg-black text-white border-white' : 'bg-white/90 border-[#1E1E1E] text-[#121214]'
                            }`}>
                              +
                            </div>
                          )}
                        </div>

                        {/* Meta info & last message */}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center justify-between">
                            {/* Name (Tap-to-profile) */}
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (persona) onNavigateToCharacterProfile?.(persona.id);
                              }}
                              className={`text-xs font-bold tracking-wide truncate font-sans flex items-center gap-1.5 hover:text-accent hover:underline cursor-pointer transition-colors ${
                                isLight ? 'text-[#1C1C1E]' : 'text-white'
                              }`}
                              title="View Profile"
                            >
                              <span>{chat.personaName}</span>
                              {chat.isPinned && (
                                <Pin className={`w-2.5 h-2.5 rotate-45 ${isLight ? 'text-zinc-850' : 'text-zinc-300'}`} />
                              )}
                            </div>
                            <span className={`text-[8px] font-sans font-light tracking-wider flex items-center gap-1 ${
                              isLight ? 'text-black/40' : 'text-white/30'
                            }`}>
                              <Calendar className="w-2 h-2" />
                              {formatHistoryTime(chat.timestamp)}
                            </span>
                          </div>
                          
                          <p className={`text-[11px] mt-1 leading-relaxed truncate font-normal tracking-wide font-sans ${
                            isLight ? 'text-black/55' : 'text-white/50'
                          }`}>
                            {getDisplayMessage(chat)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Worlds Section */
            worldChats.length === 0 ? (
              <div className={`mt-12 flex flex-col items-center text-center p-6 rounded-2xl border shadow-xl font-sans animate-fadeIn ${
                isLight ? 'bg-white border-black/[0.05] shadow-sm' : 'bg-white/[0.01] border-white/[0.04]'
              }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${
                  isLight ? 'bg-black/[0.03] border-black/[0.06]' : 'bg-white/[0.03] border-white/[0.06]'
                }`}>
                  <Globe className={`w-5 h-5 ${isLight ? 'text-black/30' : 'text-white/20'}`} />
                </div>
                <h3 className={`text-xs font-bold mb-1 font-sans ${isLight ? 'text-black' : 'text-white'}`}>No Active Worlds</h3>
                <p className={`text-[11px] max-w-[200px] leading-relaxed mb-6 font-normal tracking-wide font-sans ${
                  isLight ? 'text-black/50' : 'text-white/40'
                }`}>
                  Explore immersive worlds or create your own to start roleplaying.
                </p>
                <button
                  onClick={onNavigateToPersonas}
                  className={`px-5 py-2.5 rounded-2xl font-bold text-[11px] tracking-wide flex items-center gap-1.5 font-sans shadow-md transition-all active:scale-95 ${
                    isLight 
                      ? 'bg-zinc-950 hover:bg-zinc-850 text-white shadow-zinc-950/10' 
                      : 'bg-accent hover:bg-accent/95 text-white shadow-[0_4px_12px_rgba(124,92,252,0.3)]'
                  }`}
                >
                  <span>Explore Worlds</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
                /* List of world sessions */
                <div className="space-y-3 mt-4 animate-fadeIn font-sans">
                  {worldChats.map((chat) => {
                    const world = worlds.find(w => w.id === chat.linkedWorldId);
                    
                    return (
                      <div 
                        key={chat.id} 
                        onClick={() => {
                          if (!hasMovedRef.current) {
                            onSelectChat(chat.id);
                          }
                        }}
                        onTouchStart={(e) => handleTouchStart(chat, e)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchMove}
                        onMouseDown={() => handleMouseDown(chat)}
                        onMouseUp={handleMouseUp}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 group relative overflow-hidden font-sans active:scale-[0.98] ${
                          chat.isPinned
                            ? isLight
                              ? 'bg-black/10 border-black/15 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:bg-black/15'
                              : 'bg-accent/20 border-accent/35 shadow-[0_4px_15px_rgba(170,170,170,0.15)] hover:bg-accent/25'
                            : isLight 
                              ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:bg-black/10 hover:border-black/15' 
                              : 'bg-accent/10 border-accent/20 shadow-[0_4px_12px_rgba(170,170,170,0.08)] hover:bg-accent/15 hover:border-accent/30 hover:shadow-[0_4px_20px_rgba(170,170,170,0.15)]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (world) onNavigateToWorldProfile?.(world.id);
                              else onNavigateToCharacterProfile?.(chat.personaId);
                            }}
                            className={`w-10 h-10 rounded-2xl border flex-shrink-0 relative overflow-hidden shadow-inner flex items-center justify-center transition-transform active:scale-90 ${
                              isLight ? 'border-black/10 bg-zinc-100' : 'border-white/10 bg-white/[0.04]'
                            }`}
                          >
                            {world?.coverImage ? (
                              <SafeImage 
                                src={world.coverImage} 
                                referrerPolicy="no-referrer" 
                                className="w-full h-full object-cover" 
                                alt={world.name}
                              />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${chat.avatarGradient || 'from-indigo-500/20 to-cyan-500/30'}`}>
                                {/* Blank color/gradient as requested */}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (world) onNavigateToWorldProfile?.(world.id);
                                    else onNavigateToCharacterProfile?.(chat.personaId);
                                  }}
                                  className={`text-xs font-bold tracking-wide truncate font-sans hover:underline decoration-white/20 underline-offset-2 ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}
                                >
                                  {world?.name || chat.personaName}
                                </div>
                                {chat.isPinned && (
                                  <Pin className={`w-2.5 h-2.5 rotate-45 flex-shrink-0 ${isLight ? 'text-zinc-850' : 'text-zinc-300'}`} />
                                )}
                              </div>
                              <span className={`text-[8px] font-sans font-light tracking-wider flex items-center gap-1 ${
                                isLight ? 'text-black/40' : 'text-white/30'
                              }`}>
                                <Calendar className="w-2 h-2" />
                                {formatHistoryTime(chat.timestamp)}
                              </span>
                            </div>
                            <p className={`text-[11px] mt-1 leading-relaxed truncate font-normal tracking-wide font-sans ${
                              isLight ? 'text-black/55' : 'text-white/50'
                            }`}>
                              {getDisplayMessage(chat)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            )
          )}
        </div>

        {chatHistories.length > 0 && activeSection === 'characters' && (
          <div className={`text-[9px] text-center font-sans font-light tracking-widest mt-8 ${isLight ? 'text-black/40' : 'text-white/30'}`}>
            Tip: Hold a chat companion card for premium options
          </div>
        )}
      </div>

      {/* HOLD OPTIONS MODAL OVERLAY */}
      {selectedChatForMenu && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-md transition-all"
            onClick={() => setSelectedChatForMenu(null)}
          />
          <div className={`relative border rounded-2xl w-full max-w-xs overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.85)] animate-scaleIn p-5 font-sans text-left ${
            isLight ? 'bg-white border-black/[0.08]' : 'bg-[#121214]/98 border-white/[0.08]'
          }`}>
            <div className={`flex items-center justify-between mb-4 pb-3 border-b ${isLight ? 'border-black/[0.06]' : 'border-b border-white/[0.06]'}`}>
              <div className="flex items-center gap-3">
                {(() => {
                  const isWorld = !!selectedChatForMenu.linkedWorldId;
                  const menuWorld = isWorld ? worlds.find(w => w.id === selectedChatForMenu.linkedWorldId) : null;
                  const menuPersona = personas.find(p => p.id === selectedChatForMenu.personaId);
                  
                  return (
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center relative overflow-hidden flex-shrink-0 shadow-inner ${
                      isLight ? 'border-black/10 bg-zinc-100' : 'border-white/10 bg-white/[0.04]'
                    }`}>
                      {isWorld ? (
                         menuWorld?.coverImage ? (
                           <SafeImage src={menuWorld.coverImage} className="w-full h-full object-cover" alt={menuWorld?.name} referrerPolicy="no-referrer" />
                         ) : (
                           <Globe className={`w-5 h-5 ${isLight ? 'text-black/50' : 'text-white/50'}`} />
                         )
                      ) : menuPersona && menuPersona.avatar ? (
                        <SafeImage 
                          src={menuPersona.avatar} 
                          referrerPolicy="no-referrer" 
                          className="w-full h-full object-cover" 
                          alt={selectedChatForMenu.personaName}
                        />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${selectedChatForMenu.avatarGradient || 'from-purple-500/20 to-pink-500/30'}`}>
                          {menuPersona && menuPersona.avatarEmoji ? (
                            <span className="text-lg select-none">{menuPersona.avatarEmoji}</span>
                          ) : (
                            <span className={`font-bold text-sm font-sans ${isLight ? 'text-black' : 'text-white'}`}>{selectedChatForMenu.personaName.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div>
                  <div className={`text-xs font-extrabold leading-normal font-sans ${isLight ? 'text-black' : 'text-white'}`}>
                    {selectedChatForMenu.linkedWorldId ? worlds.find(w => w.id === selectedChatForMenu.linkedWorldId)?.name || 'World' : selectedChatForMenu.personaName}
                  </div>
                  <div className={`text-[9px] font-medium tracking-wide font-sans ${isLight ? 'text-black/45' : 'text-white/40'}`}>
                    Session Settings
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedChatForMenu(null)}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                  isLight 
                    ? 'bg-black/[0.04] hover:bg-black/[0.08] border border-black/[0.08] text-black/60 hover:text-black' 
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/60 hover:text-white'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {/* Pin/Unpin */}
              <button
                type="button"
                onClick={() => {
                  handlePinAction(selectedChatForMenu);
                  setSelectedChatForMenu(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl border transition-all text-left font-sans cursor-pointer group ${
                  isLight 
                    ? 'bg-black/[0.02] border-black/[0.04] hover:bg-black/[0.05] text-black/85' 
                    : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.06] active:bg-white/10 text-white/85'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {selectedChatForMenu.isPinned ? (
                    <>
                      <PinOff className={`w-3.5 h-3.5 group-hover:scale-110 transition-transform ${isLight ? 'text-zinc-800' : 'text-zinc-300'}`} />
                      <span className={`text-[11px] font-semibold ${isLight ? 'text-black/85' : 'text-white/85'}`}>Unpin Chat</span>
                    </>
                  ) : (
                    <>
                      <Pin className={`w-3.5 h-3.5 rotate-45 group-hover:scale-110 transition-transform ${isLight ? 'text-zinc-800' : 'text-zinc-300'}`} />
                      <span className={`text-[11px] font-semibold ${isLight ? 'text-black/85' : 'text-white/85'}`}>Pin Chat to Top</span>
                    </>
                  )}
                </div>
                <span className={`text-[8px] font-medium tracking-widest uppercase ${isLight ? 'text-black/40' : 'text-white/30'}`}>Select</span>
              </button>

              {/* Archive/Unarchive */}
              <button
                type="button"
                onClick={() => {
                  handleArchiveAction(selectedChatForMenu);
                  setSelectedChatForMenu(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl border transition-all text-left font-sans cursor-pointer group ${
                  isLight 
                    ? 'bg-black/[0.02] border-black/[0.04] hover:bg-black/[0.05] text-black/85' 
                    : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.06] active:bg-white/10 text-white/85'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {selectedChatForMenu.isArchived ? (
                    <>
                      <ArchiveRestore className={`w-3.5 h-3.5 group-hover:scale-110 transition-transform ${isLight ? 'text-zinc-800' : 'text-zinc-300'}`} />
                      <span className={`text-[11px] font-semibold ${isLight ? 'text-black/85' : 'text-white/85'}`}>Unarchive Chat</span>
                    </>
                  ) : (
                    <>
                      <Archive className={`w-3.5 h-3.5 group-hover:scale-110 transition-transform ${isLight ? 'text-zinc-800' : 'text-zinc-300'}`} />
                      <span className={`text-[11px] font-semibold ${isLight ? 'text-black/85' : 'text-white/85'}`}>Archive Chat</span>
                    </>
                  )}
                </div>
                <span className={`text-[8px] font-medium tracking-widest uppercase ${isLight ? 'text-black/40' : 'text-white/30'}`}>Select</span>
              </button>

              {/* Delete with validation */}
              <button
                type="button"
                onClick={() => {
                  handleDeleteAction(selectedChatForMenu);
                  setSelectedChatForMenu(null);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border transition-all text-left font-sans cursor-pointer group ${
                  isLight 
                    ? 'bg-red-500/[0.01] border-red-500/10 hover:border-red-500/25 hover:bg-red-500/[0.03] text-red-500' 
                    : 'bg-red-500/[0.02] border-red-500/10 hover:border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/[0.04] active:bg-red-500/[0.08]'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold">{selectedChatForMenu.linkedWorldId ? 'Delete World' : 'Delete Chat Session'}</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* DOUBLE CONFIRMATION SAFETY DELETE DIALOG */}
      {chatToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-all"
            onClick={() => setChatToDelete(null)}
          />
          <div className={`relative border rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl animate-scaleIn p-5 font-sans text-center ${
            isLight ? 'bg-white border-red-500/15' : 'bg-[#121214]/98 border-red-500/20'
          }`}>
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <h3 className={`text-xs font-bold mb-1.5 font-sans ${isLight ? 'text-black' : 'text-white'}`}>
              Erase Conversation History?
            </h3>
            <p className={`text-[10px] leading-relaxed mb-5 px-1 font-sans ${isLight ? 'text-black/55' : 'text-[#A39CA0]'}`}>
              Are you sure? This action is absolute. The session's custom message logs and shared context will be fully erased.
            </p>
            <div className="flex gap-2 font-sans">
              <button
                type="button"
                onClick={() => setChatToDelete(null)}
                className={`flex-1 py-2 rounded-2xl text-[10px] font-bold active:scale-95 transition-all cursor-pointer border ${
                  isLight 
                    ? 'text-black/55 bg-black/[0.02] border-black/[0.08] hover:bg-black/[0.05]' 
                    : 'text-[#888] bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05]'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (chatToDelete) {
                    onDeleteChat(chatToDelete.id);
                  }
                  setChatToDelete(null);
                  triggerHaptic();
                }}
                className="flex-1 py-2 rounded-2xl text-[10px] text-white bg-red-500 hover:bg-red-400 font-bold active:scale-95 transition-all border border-red-500/20 hover:shadow-[0_0_12px_rgba(239,68,68,0.3)] cursor-pointer"
              >
                Yes, Erase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVED CHATS SUB-SCREEN OVERLAY */}
      {showArchiveScreen && (
        <div className={`absolute inset-0 z-40 flex flex-col font-sans animate-fadeIn ${
          isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'
        }`}>
          {/* Header */}
          <div className={`flex-none px-5 pt-6 pb-2 border-b z-10 flex flex-col gap-4 ${isLight ? 'bg-white border-black/[0.05]' : 'bg-[#121214] border-white/[0.05]'}`}>
            <div className="flex items-center justify-between font-sans">
              <div className="flex flex-col">
                <h2 className={`text-2xl font-extrabold tracking-tight font-sans ${isLight ? 'text-black' : 'text-white'}`}>Archived Chats</h2>
              </div>
              <button
                onClick={() => {
                  triggerHaptic();
                  setShowArchiveScreen(false);
                }}
                className={`py-2 px-3.5 rounded-xl border font-extrabold text-[9px] tracking-widest uppercase transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                  isLight 
                    ? 'bg-black/5 border-black/10 text-black hover:bg-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                    : 'bg-accent/10 border-accent/25 text-white shadow-[0_2px_10px_rgba(170,170,170,0.15)] hover:bg-accent/20 hover:border-accent/40 hover:shadow-[0_4px_20px_rgba(170,170,170,0.22)]'
                }`}
              >
                <X className="w-3.5 h-3.5 text-accent" />
                <span>Back</span>
              </button>
            </div>

            {/* Section/Tab Selector: Characters vs Worlds inside Archive */}
            <div className="grid grid-cols-2 p-1.5 rounded-2xl relative bg-transparent border-none">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setActiveArchiveSection('characters');
                }}
                className={`relative py-2.5 text-[10px] font-extrabold tracking-widest uppercase rounded-xl transition-all duration-300 cursor-pointer z-10 flex items-center justify-center gap-1.5 ${
                  activeArchiveSection === 'characters'
                    ? isLight
                      ? 'text-black font-extrabold'
                      : 'text-accent scale-105 drop-shadow-[0_0_8px_rgba(170,170,170,0.3)]'
                    : isLight
                      ? 'text-black/50 hover:text-black/80'
                      : 'text-white/45 hover:text-white/80'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Characters</span>
                {archivedCharacters.length > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeArchiveSection === 'characters'
                      ? isLight
                        ? 'bg-black/10 text-black'
                        : 'bg-accent/20 text-accent border border-accent/20'
                      : isLight
                        ? 'bg-black/10 text-black/60'
                        : 'bg-white/10 text-white/40'
                  }`}>
                    {archivedCharacters.length}
                  </span>
                )}
                {activeArchiveSection === 'characters' && (
                  <motion.div
                    layoutId="activeArchiveSectionPill"
                    className={`absolute inset-0 rounded-xl -z-10 border ${
                      isLight 
                        ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]' 
                        : 'bg-accent/10 border-accent/25 shadow-[0_2px_10px_rgba(170,170,170,0.15)]'
                    }`}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  />
                )}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setActiveArchiveSection('worlds');
                }}
                className={`relative py-2.5 text-[10px] font-extrabold tracking-widest uppercase rounded-xl transition-all duration-300 cursor-pointer z-10 flex items-center justify-center gap-1.5 ${
                  activeArchiveSection === 'worlds'
                    ? isLight
                      ? 'text-black font-extrabold'
                      : 'text-accent scale-105 drop-shadow-[0_0_8px_rgba(170,170,170,0.3)]'
                    : isLight
                      ? 'text-black/50 hover:text-black/80'
                      : 'text-white/45 hover:text-white/80'
                }`}
              >
                <Globe className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Worlds</span>
                {archivedWorlds.length > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeArchiveSection === 'worlds'
                      ? isLight
                        ? 'bg-black/10 text-black'
                        : 'bg-accent/20 text-accent border border-accent/20'
                      : isLight
                        ? 'bg-black/10 text-black/60'
                        : 'bg-white/10 text-white/40'
                  }`}>
                    {archivedWorlds.length}
                  </span>
                )}
                {activeArchiveSection === 'worlds' && (
                  <motion.div
                    layoutId="activeArchiveSectionPill"
                    className={`absolute inset-0 rounded-xl -z-10 border ${
                      isLight 
                        ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]' 
                        : 'bg-accent/10 border-accent/25 shadow-[0_2px_10px_rgba(170,170,170,0.15)]'
                    }`}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  />
                )}
              </button>
            </div>
          </div>

          {/* List of archived items */}
          <div className="flex-1 overflow-y-auto px-5 pb-24 scrollbar-none font-sans pt-3">
            <div className="w-full">
              {activeArchiveSection === 'characters' ? (
                /* Character Archive List */
                archivedCharacters.length === 0 ? (
                  <div className={`mt-12 flex flex-col items-center text-center p-6 rounded-2xl border shadow-xl font-sans animate-fadeIn ${
                    isLight ? 'bg-white border-black/[0.05] shadow-sm' : 'bg-white/[0.01] border-white/[0.04]'
                  }`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${
                      isLight ? 'bg-black/[0.03] border-black/[0.06]' : 'bg-white/[0.03] border-white/[0.06]'
                    }`}>
                      <FolderArchive className={`w-5 h-5 ${isLight ? 'text-black/30' : 'text-white/20'}`} />
                    </div>
                    <h3 className={`text-xs font-bold mb-1 font-sans ${isLight ? 'text-black' : 'text-white'}`}>No Archived Characters</h3>
                    <p className={`text-[11px] max-w-[200px] leading-relaxed mb-6 font-normal tracking-wide font-sans ${
                      isLight ? 'text-black/50' : 'text-white/40'
                    }`}>
                      Character chats you archive will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 mt-4 font-sans animate-fadeIn">
                    {archivedCharacters.map((chat) => {
                      const persona = personas.find((p) => p.id === chat.personaId);
                      return (
                        <div
                          key={chat.id}
                          onClick={() => {
                            if (!hasMovedRef.current) {
                              onSelectChat(chat.id);
                              setShowArchiveScreen(false);
                            }
                          }}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 group relative overflow-hidden font-sans active:scale-[0.98] flex items-center justify-between gap-3 ${
                            chat.isPinned 
                              ? isLight 
                                ? 'bg-black/10 border-black/15 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:bg-black/15' 
                                : 'bg-accent/20 border-accent/35 shadow-[0_4px_15px_rgba(170,170,170,0.15)] hover:bg-accent/25' 
                              : isLight 
                                ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:bg-black/10 hover:border-black/15' 
                                : 'bg-accent/10 border-accent/20 shadow-[0_4px_12px_rgba(170,170,170,0.08)] hover:bg-accent/15 hover:border-accent/30 hover:shadow-[0_4px_20px_rgba(170,170,170,0.15)]'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            {/* Avatar */}
                            <div 
                              className={`w-10 h-10 rounded-2xl border flex-shrink-0 relative overflow-hidden shadow-inner cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 ${
                                isLight ? 'border-black/10' : 'border-white/10'
                              }`}
                            >
                              {persona && persona.avatar ? (
                                <SafeImage 
                                  src={persona.avatar} 
                                  referrerPolicy="no-referrer" 
                                  className="w-full h-full object-cover" 
                                  alt={chat.personaName}
                                />
                              ) : (
                                <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${chat.avatarGradient || 'from-purple-500/20 to-pink-500/30'}`}>
                                  <span className={`font-bold text-[10px] font-sans ${isLight ? 'text-black' : 'text-white'}`}>{chat.personaName.charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className={`text-xs font-bold tracking-wide truncate font-sans flex items-center gap-1.5 ${
                                  isLight ? 'text-[#1C1C1E]' : 'text-white'
                                }`}>
                                  <span>{chat.personaName}</span>
                                  {chat.isPinned && (
                                    <Pin className={`w-2.5 h-2.5 rotate-45 ${isLight ? 'text-zinc-850' : 'text-zinc-300'}`} />
                                  )}
                                </div>
                                <span className={`text-[8px] font-sans font-light tracking-wider flex items-center gap-1 flex-shrink-0 ${
                                  isLight ? 'text-black/40' : 'text-white/30'
                                }`}>
                                  <Calendar className="w-2 h-2" />
                                  {formatHistoryTime(chat.timestamp)}
                                </span>
                              </div>
                              <p className={`text-[11px] mt-1 leading-relaxed truncate font-normal tracking-wide font-sans ${
                                isLight ? 'text-black/55' : 'text-white/50'
                              }`}>
                                {getDisplayMessage(chat)}
                              </p>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                onToggleArchiveChat(chat.id);
                                triggerHaptic();
                              }}
                              className={`w-8 h-8 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-90 ${
                                isLight 
                                  ? 'bg-black/[0.03] hover:bg-black/[0.08] text-black/50 hover:text-black' 
                                  : 'bg-[#1E1E1E] hover:bg-white border border-white/[0.08] text-white/50 hover:text-[#121214]'
                              }`}
                              title="Unarchive"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setChatToDelete(chat);
                                triggerHaptic();
                              }}
                              className={`w-8 h-8 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-90 ${
                                isLight 
                                  ? 'bg-red-50 hover:bg-red-100 text-red-500' 
                                  : 'bg-[#1E1E1E] hover:bg-red-500/10 border border-white/[0.08] text-[#555] hover:text-red-400'
                              }`}
                              title="Delete Forever"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* Worlds Archive List */
                archivedWorlds.length === 0 ? (
                  <div className={`mt-12 flex flex-col items-center text-center p-6 rounded-2xl border shadow-xl font-sans animate-fadeIn ${
                    isLight ? 'bg-white border-black/[0.05] shadow-sm' : 'bg-white/[0.01] border-white/[0.04]'
                  }`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${
                      isLight ? 'bg-black/[0.03] border-black/[0.06]' : 'bg-white/[0.03] border-white/[0.06]'
                    }`}>
                      <Globe className={`w-5 h-5 ${isLight ? 'text-black/30' : 'text-white/20'}`} />
                    </div>
                    <h3 className={`text-xs font-bold mb-1 font-sans ${isLight ? 'text-black' : 'text-white'}`}>No Archived Worlds</h3>
                    <p className={`text-[11px] max-w-[200px] leading-relaxed mb-6 font-normal tracking-wide font-sans ${
                      isLight ? 'text-black/50' : 'text-white/40'
                    }`}>
                      World roleplays you archive will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 mt-4 font-sans animate-fadeIn">
                    {archivedWorlds.map((chat) => {
                      const world = worlds.find(w => w.id === chat.linkedWorldId);
                      const displayName = world ? world.name : chat.personaName;
                      return (
                        <div
                          key={chat.id}
                          onClick={() => {
                            if (!hasMovedRef.current) {
                              onSelectChat(chat.id);
                              setShowArchiveScreen(false);
                            }
                          }}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 group relative overflow-hidden font-sans active:scale-[0.98] flex items-center justify-between gap-3 ${
                            chat.isPinned 
                              ? isLight 
                                ? 'bg-black/10 border-black/15 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:bg-black/15' 
                                : 'bg-accent/20 border-accent/35 shadow-[0_4px_15px_rgba(170,170,170,0.15)] hover:bg-accent/25' 
                              : isLight 
                                ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:bg-black/10 hover:border-black/15' 
                                : 'bg-accent/10 border-accent/20 shadow-[0_4px_12px_rgba(170,170,170,0.08)] hover:bg-accent/15 hover:border-accent/30 hover:shadow-[0_4px_20px_rgba(170,170,170,0.15)]'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            {/* Avatar */}
                            <div 
                              className={`w-10 h-10 rounded-2xl border flex-shrink-0 relative overflow-hidden shadow-inner cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 ${
                                isLight ? 'border-black/10' : 'border-white/10'
                              }`}
                            >
                              {world?.coverImage ? (
                                <SafeImage src={world.coverImage} className="w-full h-full object-cover" alt={world.name} referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                  <Globe className={`w-4 h-4 ${isLight ? 'text-black/50' : 'text-white/50'}`} />
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className={`text-xs font-bold tracking-wide truncate font-sans flex items-center gap-1.5 ${
                                  isLight ? 'text-[#1C1C1E]' : 'text-white'
                                }`}>
                                  <span>{displayName}</span>
                                  {chat.isPinned && (
                                    <Pin className={`w-2.5 h-2.5 rotate-45 ${isLight ? 'text-zinc-850' : 'text-zinc-300'}`} />
                                  )}
                                </div>
                                <span className={`text-[8px] font-sans font-light tracking-wider flex items-center gap-1 flex-shrink-0 ${
                                  isLight ? 'text-black/40' : 'text-white/30'
                                }`}>
                                  <Calendar className="w-2 h-2" />
                                  {formatHistoryTime(chat.timestamp)}
                                </span>
                              </div>
                              <p className={`text-[11px] mt-1 leading-relaxed truncate font-normal tracking-wide font-sans ${
                                isLight ? 'text-black/55' : 'text-white/50'
                              }`}>
                                {getDisplayMessage(chat)}
                              </p>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                onToggleArchiveChat(chat.id);
                                triggerHaptic();
                              }}
                              className={`w-8 h-8 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-90 ${
                                isLight 
                                  ? 'bg-black/[0.03] hover:bg-black/[0.08] text-black/50 hover:text-black' 
                                  : 'bg-[#1E1E1E] hover:bg-white border border-white/[0.08] text-white/50 hover:text-[#121214]'
                              }`}
                              title="Unarchive"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setChatToDelete(chat);
                                triggerHaptic();
                              }}
                              className={`w-8 h-8 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-90 ${
                                isLight 
                                  ? 'bg-red-50 hover:bg-red-100 text-red-500' 
                                  : 'bg-[#1E1E1E] hover:bg-red-500/10 border border-white/[0.08] text-[#555] hover:text-red-400'
                              }`}
                              title="Delete Forever"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHARACTER PROFILE OVERLAY MODAL */}
      {selectedPersonaForProfile && (
        <div className={`absolute inset-0 z-[100] ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}>
          <CharacterProfileScreen
            persona={selectedPersonaForProfile}
            storageConfig={storageConfig || { apiKey: '', useServerKeyFallback: true, selectedPersonaId: '', customPersonas: [], chatHistories: [] }}
            likedPersonaIds={storageConfig?.likedPersonaIds || []}
            onBack={() => setSelectedPersonaForProfile(null)}
            disableAnimation={true}
            onStartChat={() => {
              if (onStartChat) {
                onStartChat(selectedPersonaForProfile.id);
              }
              setSelectedPersonaForProfile(null);
            }}
            onEdit={(persona) => {
              if (onEditPersona) {
                onEditPersona(persona.id);
              }
              setSelectedPersonaForProfile(null);
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
              setSelectedPersonaForProfile(null);
            }}
            onResumeChat={(historyId) => {
              onSelectChat(historyId);
              setSelectedPersonaForProfile(null);
            }}
          />
        </div>
      )}
    </div>
  );
});
