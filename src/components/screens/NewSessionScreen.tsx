import React, { useState, useMemo } from 'react';
import { Persona, StorageConfig, World, UserPersona } from '../../types';
import { X, Play, Globe, User, MessageSquare, Clock, Plus, Users, Search, Check, Sparkles, UserPlus, Compass, ArrowRight, ShieldCheck } from 'lucide-react';
import { SafeImage } from '../common/SafeImage';
import { useAsset } from '../../utils/fileDb';
import { PERSONAS } from '../../data/personas';

interface NewSessionScreenProps {
  character: Persona;
  storageConfig: StorageConfig;
  onStart: (config: { 
    greeting: string; 
    userPersonaId: string | null; 
    worldId: string | null; 
    enableSceneDetection: boolean;
    linkedCharacterIds?: string[];
    alsoSaveToWorld?: boolean;
  }) => void;
  onCancel: () => void;
  onResumeChat?: (historyId: string) => void;
  isLight: boolean;
}

function WorldCardItem({ 
  w, 
  isLight, 
  isSelected, 
  onClick 
}: { 
  w: World; 
  isLight: boolean; 
  isSelected: boolean; 
  onClick: () => void; 
}) {
  const coverUrl = useAsset(w.coverImage);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-3.5 ${
        isSelected
          ? isLight
            ? 'bg-black/[0.05] border-black/30 shadow-sm ring-1 ring-black/20'
            : 'bg-white/[0.08] border-white/30 shadow-md ring-1 ring-white/20'
          : isLight
            ? 'bg-white border-black/[0.08] hover:border-black/20 hover:bg-black/[0.02]'
            : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      <div 
        className={`w-12 h-12 rounded-xl bg-cover bg-center flex-shrink-0 overflow-hidden border flex items-center justify-center ${
          isLight ? 'bg-black/5 border-black/10' : 'bg-white/5 border-white/10'
        }`}
        style={{ backgroundImage: coverUrl ? `url(${coverUrl})` : undefined }}
      >
        {!coverUrl && (
          <Globe className={`w-5 h-5 ${isLight ? 'text-black/40' : 'text-white/40'}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-bold truncate ${isLight ? 'text-zinc-900' : 'text-white'}`}>
            {w.name}
          </span>
          {isSelected && (
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              isLight ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900'
            }`}>
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </div>
        <p className={`text-[11px] truncate mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {w.tagline || (w.places ? `${w.places.length} locations` : 'World Environment')}
        </p>
      </div>
    </button>
  );
}

export function NewSessionScreen({ 
  character, 
  storageConfig, 
  onStart, 
  onCancel, 
  onResumeChat, 
  isLight 
}: NewSessionScreenProps) {
  const isDirectWorld = character.id.startsWith('world-');
  const directWorldId = isDirectWorld ? character.id.replace('world-', '') : null;
  const directWorld = directWorldId ? (storageConfig.worlds || []).find(w => w.id === directWorldId) : null;

  const greetings = character.additionalGreetings 
    ? [character.greeting || '', ...character.additionalGreetings].filter(Boolean) 
    : [character.greeting || ''];
  const [selectedGreetingIndex, setSelectedGreetingIndex] = useState(0);
  const [selectedUserPersonaId, setSelectedUserPersonaId] = useState<string | null>(storageConfig.userPersonas?.[0]?.id || null);
  
  // Available worlds
  const allWorlds = storageConfig.worlds || [];
  const linkedWorlds = allWorlds.filter(w => w.linkedCharacterIds?.includes(character.id));
  
  // Selected world
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(() => {
    if (directWorldId) return directWorldId;
    if (linkedWorlds.length > 0) return linkedWorlds[0].id;
    return null;
  });

  const [enableSceneDetection, setEnableSceneDetection] = useState(true);
  const [alsoSaveToWorld, setAlsoSaveToWorld] = useState(false);
  const [showAddCharModal, setShowAddCharModal] = useState(false);
  const [characterSearchQuery, setCharacterSearchQuery] = useState('');

  // Active target world
  const currentTargetWorld = useMemo(() => {
    if (isDirectWorld) return directWorld;
    if (selectedWorldId) return allWorlds.find(w => w.id === selectedWorldId) || null;
    return null;
  }, [isDirectWorld, directWorld, selectedWorldId, allWorlds]);

  // All distinct characters available in library
  const allAvailableCharacters = useMemo(() => {
    const combined = [...(storageConfig.characters || []), ...(storageConfig.customPersonas || []), ...PERSONAS];
    return combined.filter((c, idx, arr) => !c.id.startsWith('world-') && arr.findIndex(x => x.id === c.id) === idx);
  }, [storageConfig.characters, storageConfig.customPersonas]);

  // Session-specific linked characters
  const [sessionLinkedCharIds, setSessionLinkedCharIds] = useState<string[]>(() => {
    if (directWorld) {
      return [...(directWorld.linkedCharacterIds || [])];
    }
    if (selectedWorldId) {
      const w = allWorlds.find(x => x.id === selectedWorldId);
      const defaultIds = w?.linkedCharacterIds || [];
      if (!defaultIds.includes(character.id)) {
        return [character.id, ...defaultIds];
      }
      return [...defaultIds];
    }
    return [character.id];
  });

  const handleSelectWorld = (worldId: string | null) => {
    setSelectedWorldId(worldId);
    if (!worldId) {
      setSessionLinkedCharIds([character.id]);
    } else {
      const w = allWorlds.find(x => x.id === worldId);
      const defaultIds = w?.linkedCharacterIds || [];
      if (!isDirectWorld && !defaultIds.includes(character.id)) {
        setSessionLinkedCharIds([character.id, ...defaultIds]);
      } else {
        setSessionLinkedCharIds([...defaultIds]);
      }
    }
  };

  const pastSessions = (storageConfig.chatHistories || []).filter(h => 
    h.personaId === character.id || 
    (directWorldId && h.linkedWorldId === directWorldId) ||
    (selectedWorldId && h.linkedWorldId === selectedWorldId)
  );

  const handleRemoveCharacterFromSession = (charId: string) => {
    setSessionLinkedCharIds(prev => prev.filter(id => id !== charId));
  };

  const handleAddCharacterToSession = (charId: string) => {
    if (!sessionLinkedCharIds.includes(charId)) {
      setSessionLinkedCharIds(prev => [...prev, charId]);
    }
  };

  const handleStart = () => {
    onStart({
      greeting: greetings[selectedGreetingIndex] || '',
      userPersonaId: selectedUserPersonaId,
      worldId: isDirectWorld ? directWorldId : selectedWorldId,
      enableSceneDetection: (isDirectWorld || selectedWorldId) ? enableSceneDetection : false,
      linkedCharacterIds: (isDirectWorld || selectedWorldId) ? sessionLinkedCharIds : undefined,
      alsoSaveToWorld
    });
  };

  // Filtered available characters for add modal
  const filteredCandidates = useMemo(() => {
    const q = characterSearchQuery.trim().toLowerCase();
    return allAvailableCharacters.filter(c => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        (c.tagline && c.tagline.toLowerCase().includes(q))
      );
    });
  }, [allAvailableCharacters, characterSearchQuery]);

  const hasWorldActive = Boolean(isDirectWorld || selectedWorldId);

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col font-sans select-none animate-fadeIn ${
      isLight ? 'bg-[#F8F9FA] text-[#1C1C1E]' : 'bg-[#121214] text-white'
    }`}>
      {/* Top Header Navigation */}
      <header className={`flex items-center justify-between px-5 sm:px-8 py-4 border-b flex-shrink-0 z-10 ${
        isLight 
          ? 'bg-white/80 backdrop-blur-md border-black/[0.08]' 
          : 'bg-[#121214]/80 backdrop-blur-md border-white/[0.08]'
      }`}>
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold tracking-widest uppercase font-sans">
            {isDirectWorld ? 'Enter World Simulation' : 'Configure Session'}
          </h2>
          {hasWorldActive ? (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              isLight 
                ? 'bg-black/5 text-black/70 border-black/10' 
                : 'bg-white/10 text-white/80 border-white/15'
            }`}>
              {sessionLinkedCharIds.length} Cast Members
            </span>
          ) : (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              isLight 
                ? 'bg-black/5 text-black/60 border-black/10' 
                : 'bg-white/5 text-white/60 border-white/10'
            }`}>
              Solo Companion
            </span>
          )}
        </div>

        <button 
          type="button"
          onClick={onCancel} 
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
            isLight 
              ? 'bg-black/5 hover:bg-black/10 text-black/60 hover:text-black border-black/5' 
              : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border-white/10'
          }`}
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-6 pb-36 max-w-4xl mx-auto w-full scrollbar-none">
        
        {/* Hero Card Showcase */}
        <section className={`p-5 sm:p-6 rounded-3xl border transition-all ${
          isLight 
            ? 'bg-white border-black/[0.08] shadow-sm' 
            : 'bg-white/[0.03] border-white/[0.08]'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border shadow-inner ${
              isLight ? 'border-black/10 bg-black/5' : 'border-white/10 bg-white/5'
            }`}>
              {character.avatar ? (
                <SafeImage 
                  src={character.avatar} 
                  referrerPolicy="no-referrer" 
                  className="w-full h-full object-cover" 
                  alt={character.name} 
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${character.avatarGradient || 'from-zinc-700 to-zinc-900'} flex items-center justify-center text-white`}>
                  {isDirectWorld ? <Globe className="w-8 h-8 opacity-80" /> : <User className="w-8 h-8 opacity-80" />}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-xl sm:text-2xl font-bold tracking-tight truncate ${
                  isLight ? 'text-zinc-900' : 'text-white'
                }`}>
                  {character.name}
                </h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                  isLight 
                    ? 'bg-black/5 text-black/70 border-black/10' 
                    : 'bg-white/10 text-white/80 border-white/15'
                }`}>
                  {isDirectWorld ? 'World Environment' : (character.subtitle || 'AI Companion')}
                </span>
              </div>

              <p className={`text-xs sm:text-sm font-normal leading-relaxed line-clamp-2 ${
                isLight ? 'text-zinc-600' : 'text-zinc-400'
              }`}>
                {character.tagline || character.description || (isDirectWorld ? 'Shared interactive world environment with rich lore and atmospheric narrative dynamics.' : 'Conversational companion ready for immersive dialogue.')}
              </p>

              {isDirectWorld && directWorld && (
                <div className="flex items-center gap-4 pt-1">
                  {directWorld.places && (
                    <span className={`text-[11px] font-medium flex items-center gap-1.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      <Compass className="w-3.5 h-3.5 opacity-60" />
                      {directWorld.places.length} Locations
                    </span>
                  )}
                  {directWorld.linkedCharacterIds && (
                    <span className={`text-[11px] font-medium flex items-center gap-1.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      <Users className="w-3.5 h-3.5 opacity-60" />
                      {directWorld.linkedCharacterIds.length} Resident Companions
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Previous Conversations (Resume Chat) */}
        {pastSessions.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                isLight ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                <Clock className="w-3.5 h-3.5 opacity-70" />
                <span>Resume Previous Sessions</span>
              </h4>
              <span className={`text-[10px] font-medium ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {pastSessions.length} saved
              </span>
            </div>

            <div className="flex overflow-x-auto gap-3 pb-2 -mx-5 px-5 sm:-mx-8 sm:px-8 scrollbar-none snap-x">
              {pastSessions.slice(0, 5).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onResumeChat?.(session.id)}
                  className={`snap-start flex-shrink-0 w-64 sm:w-72 p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                    isLight 
                      ? 'bg-white border-black/[0.08] hover:border-black/20 hover:bg-black/[0.02] shadow-sm' 
                      : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      isLight ? 'text-zinc-400' : 'text-zinc-500'
                    }`}>
                      {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : new Date(session.timestamp).toLocaleDateString()}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      isLight 
                        ? 'bg-black/5 text-zinc-700 border-black/5' 
                        : 'bg-white/10 text-zinc-300 border-white/10'
                    }`}>
                      {session.messages?.length || 0} messages
                    </span>
                  </div>
                  <p className={`text-xs line-clamp-2 leading-relaxed italic ${
                    isLight ? 'text-zinc-700' : 'text-zinc-300'
                  }`}>
                    "{(session.messages && session.messages.length > 0 && session.messages[session.messages.length - 1]?.text) || session.lastMessage || 'Ongoing dialogue...'}"
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* World Selection (if starting from a character) */}
        {!isDirectWorld && allWorlds.length > 0 && (
          <section className="space-y-3">
            <h4 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${
              isLight ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              <Globe className="w-3.5 h-3.5 opacity-70" />
              <span>World / Environment Setting</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Solo Option */}
              <button
                type="button"
                onClick={() => handleSelectWorld(null)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-3.5 ${
                  selectedWorldId === null
                    ? isLight
                      ? 'bg-black/[0.05] border-black/30 shadow-sm ring-1 ring-black/20'
                      : 'bg-white/[0.08] border-white/30 shadow-md ring-1 ring-white/20'
                    : isLight
                      ? 'bg-white border-black/[0.08] hover:border-black/20 hover:bg-black/[0.02]'
                      : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05]'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                  isLight ? 'bg-black/5 border-black/10' : 'bg-white/5 border-white/10'
                }`}>
                  <User className={`w-5 h-5 ${isLight ? 'text-black/50' : 'text-white/50'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold truncate ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                      Solo Dialogue (No World)
                    </span>
                    {selectedWorldId === null && (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isLight ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900'
                      }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className={`text-[11px] truncate mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Standard 1-on-1 private companion chat
                  </p>
                </div>
              </button>

              {/* World Options */}
              {allWorlds.map(w => (
                <WorldCardItem 
                  key={w.id}
                  w={w}
                  isLight={isLight}
                  isSelected={selectedWorldId === w.id}
                  onClick={() => handleSelectWorld(w.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* World Cast / Linked Characters Configuration */}
        {hasWorldActive && (
          <section className={`p-5 rounded-3xl border space-y-4 ${
            isLight 
              ? 'bg-white border-black/[0.08] shadow-sm' 
              : 'bg-white/[0.03] border-white/[0.08]'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users className={`w-4 h-4 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`} />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                    Session Cast Roster
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isLight 
                      ? 'bg-black/5 text-zinc-700 border-black/10' 
                      : 'bg-white/10 text-zinc-300 border-white/10'
                  }`}>
                    {sessionLinkedCharIds.length} Active
                  </span>
                </div>
                <p className={`text-[11px] mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Customize the companions participating in this world simulation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCharacterSearchQuery('');
                  setShowAddCharModal(true);
                }}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                  isLight
                    ? 'bg-black/5 hover:bg-black/10 border-black/10 text-zinc-900'
                    : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Link Character</span>
              </button>
            </div>

            {/* Character Roster Grid */}
            {sessionLinkedCharIds.length === 0 ? (
              <div className={`p-6 rounded-2xl border border-dashed text-center space-y-2 ${
                isLight ? 'border-black/15 bg-black/[0.02]' : 'border-white/15 bg-white/[0.02]'
              }`}>
                <p className={`text-xs font-bold ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                  Atmospheric Exploration Mode
                </p>
                <p className={`text-[11px] max-w-md mx-auto ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Zero characters linked. The simulation will narrate pure environmental exploration, atmospheric descriptions, and world events.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddCharModal(true)}
                  className={`mt-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    isLight ? 'bg-zinc-900 text-white hover:bg-black' : 'bg-white text-zinc-900 hover:bg-zinc-200'
                  }`}
                >
                  + Add Characters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sessionLinkedCharIds.map((charId) => {
                  const companion = allAvailableCharacters.find(c => c.id === charId);
                  const isPreset = currentTargetWorld?.linkedCharacterIds?.includes(charId);
                  const charName = companion?.name || charId;
                  const charAvatar = companion?.avatar;
                  const charGradient = companion?.avatarGradient || 'from-zinc-700 to-zinc-900';
                  const charTagline = companion?.tagline || companion?.subtitle || 'Companion';

                  return (
                    <div 
                      key={charId}
                      className={`p-2.5 px-3 rounded-2xl border flex items-center justify-between gap-3 ${
                        isLight ? 'bg-black/[0.02] border-black/10' : 'bg-white/[0.04] border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border ${
                          isLight ? 'border-black/10 bg-black/5' : 'border-white/10 bg-white/5'
                        }`}>
                          {charAvatar ? (
                            <SafeImage 
                              src={charAvatar} 
                              referrerPolicy="no-referrer" 
                              className="w-full h-full object-cover" 
                              alt={charName} 
                            />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${charGradient} flex items-center justify-center text-xs font-bold text-white`}>
                              {charName.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold truncate ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                              {charName}
                            </span>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                              isPreset
                                ? isLight 
                                  ? 'bg-black/5 text-zinc-500 border-black/5' 
                                  : 'bg-white/10 text-zinc-400 border-white/10'
                                : isLight 
                                  ? 'bg-black/10 text-zinc-800 border-black/15 font-semibold' 
                                  : 'bg-white/15 text-white border-white/20 font-semibold'
                            }`}>
                              {isPreset ? 'Preset' : 'Linked'}
                            </span>
                          </div>
                          <p className={`text-[10px] truncate mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {charTagline}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveCharacterFromSession(charId)}
                        title="Remove character from this world session"
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isLight 
                            ? 'bg-black/5 hover:bg-black/10 text-zinc-500 hover:text-zinc-900 border-black/5' 
                            : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border-white/10'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Permanent Save Option Toggle */}
            {currentTargetWorld && (
              <div 
                onClick={() => setAlsoSaveToWorld(!alsoSaveToWorld)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-150 ${
                  alsoSaveToWorld 
                    ? isLight 
                      ? 'bg-black/[0.05] border-black/25 text-zinc-900' 
                      : 'bg-white/[0.08] border-white/25 text-white'
                    : isLight 
                      ? 'bg-black/[0.02] border-black/5 text-zinc-600' 
                      : 'bg-white/[0.02] border-white/5 text-zinc-400'
                }`}
              >
                <div className="pr-3">
                  <span className="text-xs font-bold block">Save Lineup as World Default</span>
                  <p className="text-[10px] opacity-70 mt-0.5">
                    Update permanent resident character list for {currentTargetWorld.name}.
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors ${
                  alsoSaveToWorld 
                    ? isLight ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-white text-zinc-900'
                    : isLight ? 'border-black/20' : 'border-white/20'
                }`}>
                  {alsoSaveToWorld && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            )}

            {/* Auto Scene Detection Toggle */}
            <div 
              onClick={() => setEnableSceneDetection(!enableSceneDetection)}
              className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-150 ${
                isLight ? 'bg-black/[0.02] border-black/5' : 'bg-white/[0.02] border-white/5'
              }`}
            >
              <div className="pr-3">
                <span className={`text-xs font-bold block ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                  Dynamic Scene & Mood Adaptation
                </span>
                <p className={`text-[10px] mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Automatically adjusts live wallpapers and environmental atmosphere during gameplay.
                </p>
              </div>
              <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${
                enableSceneDetection 
                  ? isLight ? 'bg-zinc-900' : 'bg-white' 
                  : isLight ? 'bg-black/15' : 'bg-white/15'
              }`}>
                <div className={`w-5 h-5 rounded-full transition-transform ${
                  enableSceneDetection 
                    ? isLight ? 'translate-x-4 bg-white' : 'translate-x-4 bg-zinc-900' 
                    : isLight ? 'translate-x-0 bg-white' : 'translate-x-0 bg-zinc-400'
                }`} />
              </div>
            </div>
          </section>
        )}

        {/* Starting Greeting Selection */}
        {greetings.length > 1 ? (
          <section className="space-y-3">
            <h4 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${
              isLight ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              <MessageSquare className="w-3.5 h-3.5 opacity-70" />
              <span>Select Opening Scenario ({greetings.length} Available)</span>
            </h4>

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-5 px-5 sm:-mx-8 sm:px-8 scrollbar-none">
              {greetings.map((g, idx) => {
                const isSelected = selectedGreetingIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedGreetingIndex(idx)}
                    className={`snap-start flex-shrink-0 w-[85%] sm:w-[320px] p-4 rounded-2xl border text-left cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? isLight
                          ? 'bg-black/[0.04] border-black/30 shadow-sm ring-1 ring-black/15'
                          : 'bg-white/[0.08] border-white/30 shadow-md ring-1 ring-white/15'
                        : isLight
                          ? 'bg-white border-black/[0.08] hover:border-black/20 hover:bg-black/[0.02]'
                          : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        isLight ? 'text-zinc-400' : 'text-zinc-500'
                      }`}>
                        Scenario #{idx + 1}
                      </span>
                      {isSelected && (
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          isLight 
                            ? 'bg-zinc-900 text-white border-zinc-900' 
                            : 'bg-white text-zinc-900 border-white'
                        }`}>
                          Selected
                        </span>
                      )}
                    </div>
                    <p className={`text-xs line-clamp-4 leading-relaxed italic ${
                      isLight ? 'text-zinc-800' : 'text-zinc-200'
                    }`}>
                      "{g}"
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <h4 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${
              isLight ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              <MessageSquare className="w-3.5 h-3.5 opacity-70" />
              <span>Opening Scenario</span>
            </h4>
            <div className={`p-4 rounded-2xl border ${
              isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.03] border-white/[0.08]'
            }`}>
              <p className={`text-xs leading-relaxed italic ${
                isLight ? 'text-zinc-800' : 'text-zinc-200'
              }`}>
                "{greetings[0] || 'Start dialogue with companion...'}"
              </p>
            </div>
          </section>
        )}

        {/* User Persona ("Play As") Selection */}
        {storageConfig.userPersonas && storageConfig.userPersonas.length > 0 && (
          <section className="space-y-3">
            <h4 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${
              isLight ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              <User className="w-3.5 h-3.5 opacity-70" />
              <span>Play As (Your User Persona)</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Default Anonymous Persona */}
              <button
                type="button"
                onClick={() => setSelectedUserPersonaId(null)}
                className={`p-3 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex items-center gap-3 ${
                  selectedUserPersonaId === null
                    ? isLight
                      ? 'bg-black/[0.05] border-black/30 shadow-sm ring-1 ring-black/20'
                      : 'bg-white/[0.08] border-white/30 shadow-md ring-1 ring-white/20'
                    : isLight
                      ? 'bg-white border-black/[0.08] hover:border-black/20 hover:bg-black/[0.02]'
                      : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05]'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                  isLight ? 'bg-black/5 border-black/10' : 'bg-white/5 border-white/10'
                }`}>
                  <User className={`w-4 h-4 ${isLight ? 'text-black/50' : 'text-white/50'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`text-xs font-bold block truncate ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                    Default User
                  </span>
                  <span className={`text-[10px] block truncate ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Anonymous
                  </span>
                </div>
              </button>

              {/* Custom User Personas */}
              {storageConfig.userPersonas.map(up => (
                <button
                  key={up.id}
                  type="button"
                  onClick={() => setSelectedUserPersonaId(up.id)}
                  className={`p-3 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex items-center gap-3 ${
                    selectedUserPersonaId === up.id
                      ? isLight
                        ? 'bg-black/[0.05] border-black/30 shadow-sm ring-1 ring-black/20'
                        : 'bg-white/[0.08] border-white/30 shadow-md ring-1 ring-white/20'
                      : isLight
                        ? 'bg-white border-black/[0.08] hover:border-black/20 hover:bg-black/[0.02]'
                        : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border ${
                    isLight ? 'border-black/10 bg-black/5' : 'border-white/10 bg-white/5'
                  }`}>
                    {up.avatar ? (
                      <SafeImage 
                        src={up.avatar} 
                        referrerPolicy="no-referrer" 
                        className="w-full h-full object-cover" 
                        alt={up.name} 
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${up.avatarGradient || 'from-zinc-700 to-zinc-900'} flex items-center justify-center text-xs font-bold text-white`}>
                        {up.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-bold block truncate ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                      {up.name}
                    </span>
                    <span className={`text-[10px] block truncate ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {up.description || 'Persona'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Floating Bottom Action Dock */}
      <footer className={`fixed bottom-0 left-0 right-0 p-5 sm:p-6 border-t z-20 ${
        isLight 
          ? 'bg-white/90 backdrop-blur-xl border-black/[0.08]' 
          : 'bg-[#121214]/90 backdrop-blur-xl border-white/[0.08]'
      }`}>
        <div className="max-w-4xl mx-auto w-full">
          <button
            type="button"
            onClick={handleStart}
            className={`w-full py-4 rounded-2xl font-bold text-xs sm:text-sm tracking-widest uppercase transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer shadow-lg ${
              isLight 
                ? 'bg-zinc-900 hover:bg-black text-white shadow-black/10' 
                : 'bg-white hover:bg-zinc-200 text-zinc-900 shadow-white/5'
            }`}
          >
            <Play className={`w-4 h-4 fill-current`} />
            <span>
              {hasWorldActive 
                ? `Enter World Simulation (${sessionLinkedCharIds.length} Cast)` 
                : 'Start Conversation'}
            </span>
          </button>
        </div>
      </footer>

      {/* MODAL: LINK CHARACTER TO WORLD */}
      {showAddCharModal && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div 
            className={`w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl border flex flex-col overflow-hidden shadow-2xl ${
              isLight ? 'bg-white border-black/10 text-zinc-900' : 'bg-[#18181B] border-white/15 text-white'
            }`}
          >
            {/* Modal Header */}
            <div className={`p-4 px-6 border-b flex items-center justify-between ${
              isLight ? 'border-black/10' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                  isLight ? 'bg-black/5 border-black/10 text-zinc-900' : 'bg-white/10 border-white/10 text-white'
                }`}>
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-wider uppercase">Link Character to World</h3>
                  <p className={`text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Select companions to join this simulation
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddCharModal(false)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                  isLight 
                    ? 'bg-black/5 hover:bg-black/10 text-zinc-600 border-black/5' 
                    : 'bg-white/5 hover:bg-white/10 text-zinc-400 border-white/10'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search Input */}
            <div className={`p-4 border-b ${isLight ? 'border-black/10' : 'border-white/10'}`}>
              <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border ${
                isLight ? 'bg-black/[0.03] border-black/10' : 'bg-white/[0.04] border-white/10'
              }`}>
                <Search className={`w-4 h-4 ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`} />
                <input
                  type="text"
                  placeholder="Search companions by name or tagline..."
                  value={characterSearchQuery}
                  onChange={(e) => setCharacterSearchQuery(e.target.value)}
                  className={`bg-transparent text-xs w-full focus:outline-none ${
                    isLight ? 'placeholder-zinc-400 text-zinc-900' : 'placeholder-zinc-500 text-white'
                  }`}
                />
                {characterSearchQuery && (
                  <button 
                    type="button"
                    onClick={() => setCharacterSearchQuery('')} 
                    className="opacity-50 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Character Selection List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[50vh] scrollbar-none">
              {filteredCandidates.length === 0 ? (
                <div className={`py-12 text-center text-xs ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  No characters found matching "{characterSearchQuery}".
                </div>
              ) : (
                filteredCandidates.map(c => {
                  const isAlreadyLinked = sessionLinkedCharIds.includes(c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (isAlreadyLinked) {
                          handleRemoveCharacterFromSession(c.id);
                        } else {
                          handleAddCharacterToSession(c.id);
                        }
                      }}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 active:scale-[0.99] ${
                        isAlreadyLinked 
                          ? isLight 
                            ? 'bg-black/[0.05] border-black/25 ring-1 ring-black/10' 
                            : 'bg-white/[0.08] border-white/25 ring-1 ring-white/10'
                          : isLight 
                            ? 'bg-black/[0.02] border-black/5 hover:border-black/15' 
                            : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border ${
                          isLight ? 'border-black/10 bg-black/5' : 'border-white/10 bg-white/5'
                        }`}>
                          {c.avatar ? (
                            <SafeImage 
                              src={c.avatar} 
                              referrerPolicy="no-referrer" 
                              className="w-full h-full object-cover" 
                              alt={c.name} 
                            />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${c.avatarGradient || 'from-zinc-700 to-zinc-900'} flex items-center justify-center text-xs font-bold text-white`}>
                              {c.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className={`text-xs font-bold truncate ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                            {c.name}
                          </h4>
                          <p className={`text-[10px] truncate mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {c.subtitle || c.tagline || 'AI Companion'}
                          </p>
                        </div>
                      </div>

                      <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isAlreadyLinked
                          ? isLight 
                            ? 'bg-zinc-900 text-white shadow-sm' 
                            : 'bg-white text-zinc-900 shadow-sm'
                          : isLight 
                            ? 'bg-black/5 text-zinc-700 hover:bg-black/10' 
                            : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                      }`}>
                        {isAlreadyLinked ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Linked</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-4 px-6 border-t flex items-center justify-between ${
              isLight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.02]'
            }`}>
              <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {sessionLinkedCharIds.length} companion{sessionLinkedCharIds.length === 1 ? '' : 's'} linked
              </span>
              <button
                type="button"
                onClick={() => setShowAddCharModal(false)}
                className={`px-5 py-2 rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all shadow-sm ${
                  isLight ? 'bg-zinc-900 hover:bg-black text-white' : 'bg-white hover:bg-zinc-200 text-zinc-900'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
