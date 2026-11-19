import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenType, MainTabType, StorageConfig, Persona, ChatMessage, ChatHistory, World } from './types';
import { getStorageConfig, saveStorageConfig, loadFromIndexedDB, clearIndexedDB, mergeChatHistories, mergePersonas, mergeWorlds, mergeUserPersonas, saveCharacterChatToLocalStorage, clearCharacterChatFromLocalStorage, getLastMessageTime } from './utils/storage';
import { preloadConfigAssets } from './utils/fileDb';
import { initCloudSync, deleteChatFromCloud, saveSingleChatToCloud, deleteCharacterFromDatabase, deleteWorldFromDatabase, saveUserPersonaToChat } from './utils/cloudSync';
import { unlockAudioSystem } from './utils/audioHelper';
import { PERSONAS } from './data/personas';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { PersonaHubScreen } from './components/screens/PersonaHubScreen';
import { ChatHistoryScreen } from './components/screens/ChatHistoryScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { CharacterProfileScreen } from './components/screens/CharacterProfileScreen';
import { WorldProfileScreen } from './components/screens/WorldProfileScreen';
import { CharacterCreator } from './components/screens/CharacterCreator';
import { WorldCreator } from './components/screens/WorldCreator';
import { UserPersonaCreator } from './components/screens/UserPersonaCreator';
import { PremiumChatScreen } from './components/screens/PremiumChatScreen';
import { GlassDock } from './components/GlassDock';
import { NewSessionScreen } from './components/screens/NewSessionScreen';
import { SafeErrorBoundary } from './components/common/SafeErrorBoundary';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('welcome');
  const [activeTab, setActiveTab] = useState<MainTabType>('personas');
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [activeSetupPersona, setActiveSetupPersona] = useState<Persona | null>(null);
  
  const [storageConfig, setStorageConfig] = useState<StorageConfig>({
    apiKey: '',
    useServerKeyFallback: true,
    selectedPersonaId: '',
    customPersonas: [],
    chatHistories: [],
  });
  
  const [hubCategory, setHubCategory] = useState<'foryou' | 'following' | 'trending' | 'specialists' | 'create'>('foryou');
  const [hubEditingPersonaId, setHubEditingPersonaId] = useState<string | null>(null);
  const [hubCreationType, setHubCreationType] = useState<'character' | 'persona' | 'world' | null>(null);
  const [creationOrigin, setCreationOrigin] = useState<{
    activeTab: MainTabType;
    activeChatSessionId: string | null;
    hubCategory: 'foryou' | 'following' | 'trending' | 'specialists' | 'create';
  } | null>(null);
  const [requestedProfilePersonaId, setRequestedProfilePersonaId] = useState<string | null>(null);
  const [requestedProfileWorldId, setRequestedProfileWorldId] = useState<string | null>(null);
  const [historyActiveSection, setHistoryActiveSection] = useState<'characters' | 'worlds'>('characters');
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({ personas: true });

  useEffect(() => {
    setVisitedTabs(prev => prev[activeTab] ? prev : { ...prev, [activeTab]: true });
  }, [activeTab]);

  // Synchronize active theme with documentElement, body, and iOS status bar meta tags
  useEffect(() => {
    const isLight = storageConfig.theme === 'light';
    const rootHtml = document.documentElement;
    const body = document.body;
    const themeHex = isLight ? '#F8F9FA' : '#0A0A0A';
    const statusBarStyle = isLight ? 'default' : 'black-translucent';

    if (isLight) {
      rootHtml.classList.add('theme-light');
      body.classList.add('theme-light');
      rootHtml.style.colorScheme = 'light';
      rootHtml.style.backgroundColor = '#F8F9FA';
      body.style.backgroundColor = '#F8F9FA';
    } else {
      rootHtml.classList.remove('theme-light');
      body.classList.remove('theme-light');
      rootHtml.style.colorScheme = 'dark';
      rootHtml.style.backgroundColor = '#0A0A0A';
      body.style.backgroundColor = '#0A0A0A';
    }

    // Update meta theme-color tags for both desktop and iOS Safari
    let themeMeta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = themeHex;

    // Update apple-mobile-web-app-status-bar-style
    let statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
    if (!statusBarMeta) {
      statusBarMeta = document.createElement('meta');
      statusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(statusBarMeta);
    }
    statusBarMeta.content = statusBarStyle;
  }, [storageConfig.theme]);

  const [chatOrigin, setChatOrigin] = useState<{
    tab: MainTabType;
    section?: 'characters' | 'worlds';
  } | null>(null);
  
  // Global Profile Overlays
  const [globalProfilePersona, setGlobalProfilePersona] = useState<Persona | null>(null);
  const [globalProfileWorld, setGlobalProfileWorld] = useState<World | null>(null);

  // Derived companions list (memoized to prevent re-rendering tabs on every tick)
  const worldCompanions = useMemo(() => (storageConfig.worlds || []).map(world => ({
    id: `world-${world.id}`,
    name: world.name,
    tagline: world.tagline,
    description: world.description,
    avatar: world.coverImage,
    avatarEmoji: '🌍',
    avatarGradient: 'from-gray-700 to-black',
    systemInstruction: world.worldDefinition || `You are the narrator of ${world.name}. ${world.description}`,
    subtitle: world.tagline || 'World Environment',
    accentColor: 'indigo',
    suggestedPrompts: [],
    greeting: world.greeting || `Welcome to ${world.name}. What would you like to do?`,
    isCustom: true
  })), [storageConfig.worlds]);

  const allCompanions = useMemo(() => [
    ...PERSONAS, 
    ...(storageConfig.characters || []), 
    ...worldCompanions
  ], [storageConfig.characters, worldCompanions]);

  // Handle incoming profile requests from other screens
  useEffect(() => {
    if (requestedProfilePersonaId) {
      const persona = allCompanions.find(p => p.id === requestedProfilePersonaId);
      if (persona) {
        setGlobalProfilePersona(persona);
      }
      setRequestedProfilePersonaId(null);
    }
  }, [requestedProfilePersonaId, allCompanions]);

  useEffect(() => {
    if (requestedProfileWorldId) {
      const world = storageConfig.worlds?.find(w => w.id === requestedProfileWorldId);
      if (world) {
        setGlobalProfileWorld(world);
      }
      setRequestedProfileWorldId(null);
    }
  }, [requestedProfileWorldId, storageConfig.worlds]);

  // Initialize storage config & real-time Cloud Firestore sync on mount
  useEffect(() => {
    const config = getStorageConfig();
    setStorageConfig(config);
    preloadConfigAssets(config);

    // Secondary async check from IndexedDB
    loadFromIndexedDB().then((idbConfig) => {
      let finalConfig = config;
      if (idbConfig) {
        const deletedChatIds = Array.from(new Set([
          ...(idbConfig.deletedChatIds || []),
          ...(config.deletedChatIds || [])
        ])).filter(id => Boolean(id && typeof id === 'string' && id.trim().length > 0));
        const mergedHistories = mergeChatHistories(idbConfig.chatHistories || [], config.chatHistories || [], deletedChatIds);
        const mergedCharacters = mergePersonas(idbConfig.characters || [], config.characters || []);
        const mergedCustom = mergePersonas(idbConfig.customPersonas || [], config.customPersonas || []);
        const mergedWorldsList = mergeWorlds(idbConfig.worlds || [], config.worlds || []);
        const mergedUserPersonasList = mergeUserPersonas(idbConfig.userPersonas || [], config.userPersonas || []);

        finalConfig = {
          ...config,
          ...idbConfig,
          characters: mergedCharacters,
          customPersonas: mergedCustom,
          worlds: mergedWorldsList,
          userPersonas: mergedUserPersonasList,
          chatHistories: mergedHistories
        };
        saveStorageConfig(finalConfig);
        setStorageConfig(finalConfig);
        preloadConfigAssets(finalConfig);
      }
      
      if (finalConfig.hasOnboarded || (finalConfig.chatHistories && finalConfig.chatHistories.length > 0) || (finalConfig.characters && finalConfig.characters.length > 0) || (finalConfig.worlds && finalConfig.worlds.length > 0)) {
        setCurrentScreen('main');
      } else {
        setCurrentScreen('welcome');
      }
    }).catch(() => {
      if (config.hasOnboarded || (config.chatHistories && config.chatHistories.length > 0) || (config.characters && config.characters.length > 0) || (config.worlds && config.worlds.length > 0)) {
        setCurrentScreen('main');
      } else {
        setCurrentScreen('welcome');
      }
    });

    // Initialize real-time Cloud Sync with Firestore
    initCloudSync(
      (cloudConfig) => {
        setStorageConfig(cloudConfig);
        preloadConfigAssets(cloudConfig);
        if (cloudConfig.hasOnboarded || (cloudConfig.chatHistories && cloudConfig.chatHistories.length > 0) || (cloudConfig.characters && cloudConfig.characters.length > 0) || (cloudConfig.worlds && cloudConfig.worlds.length > 0)) {
          setCurrentScreen((prev) => prev === 'welcome' || prev === 'onboarding' ? 'main' : prev);
        }
      },
      () => {
        // Step 2: User has logged out! Reset ALL UI state to blank:
        console.log("No user active. Resetting app memory...");
        setActiveChatSessionId(null);
        setActiveSetupPersona(null);
        setGlobalProfilePersona(null);
        setGlobalProfileWorld(null);

        // CRUCIAL: Instantly wipe your UI arrays so old data disappears!
        setStorageConfig({
          apiKey: '',
          apiKeys: [],
          worldApiKey: '',
          useSameApiKey: true,
          useServerKeyFallback: true,
          selectedPersonaId: '',
          characters: [],
          customPersonas: [],
          worlds: [],
          userPersonas: [],
          chatHistories: [],
          likedPersonaIds: [],
          likedWorldIds: [],
          deletedChatIds: [],
          deletedPersonaIds: [],
          deletedWorldIds: [],
          hasOnboarded: false
        });
        setCurrentScreen('welcome');
      }
    ).catch(err => {
      console.warn('Cloud sync initialization warning:', err);
    });
  }, []);

  const getExistingSessionForPersona = useCallback((pId?: string) => {
    if (!pId) return null;
    const histories = storageConfig.chatHistories || [];
    const rawId = pId.startsWith('world-') ? pId.replace('world-', '') : pId;
    return histories.find(h => 
      !h.isArchived && (
        h.personaId === pId || 
        h.personaId === rawId || 
        h.linkedWorldId === rawId ||
        (h.personaId && h.personaId.replace('world-', '') === rawId)
      )
    ) || null;
  }, [storageConfig.chatHistories]);

  const handleUpdateConfig = useCallback((updates: Partial<StorageConfig>) => {
    const updated = saveStorageConfig(updates, true);
    setStorageConfig(updated);
  }, []);

  const handleSelectPersona = useCallback((persona: Persona) => {
    handleUpdateConfig({ selectedPersonaId: persona.id });
    if (persona.id.startsWith('world-')) {
      const worldId = persona.id.replace('world-', '');
      handleUpdateConfig({ activeWorldId: worldId });
    }
  }, [handleUpdateConfig]);

  const handleSelectChat = useCallback((historyId: string, forceOriginTab?: MainTabType) => {
    const session = storageConfig.chatHistories.find(h => h.id === historyId);
    const originTab = forceOriginTab || activeTab;
    if (!chatOrigin) {
      setChatOrigin({
        tab: originTab,
        section: originTab === 'history' ? historyActiveSection : undefined
      });
    }
    if (session) {
      const isWorld = session.personaId.startsWith('world-') || !!session.linkedWorldId;
      setHistoryActiveSection(isWorld ? 'worlds' : 'characters');
      handleUpdateConfig({ selectedPersonaId: session.personaId });
    }
    unlockAudioSystem();
    setActiveChatSessionId(historyId);
    setActiveTab('history');
  }, [storageConfig.chatHistories, activeTab, chatOrigin, historyActiveSection, handleUpdateConfig]);

  const handleEnterWorld = useCallback((worldId: string) => {
    unlockAudioSystem();
    const persona = allCompanions.find(c => c.id === `world-${worldId}`);
    if (persona) {
      handleUpdateConfig({ activeWorldId: worldId, selectedPersonaId: `world-${worldId}` });
      const existingSession = getExistingSessionForPersona(`world-${worldId}`) || getExistingSessionForPersona(worldId);
      if (existingSession) {
        handleSelectChat(existingSession.id);
      } else {
        setActiveSetupPersona(persona);
      }
    }
  }, [allCompanions, handleUpdateConfig, getExistingSessionForPersona, handleSelectChat]);
  
  const handleSetupWorld = useCallback((worldId: string) => {
    unlockAudioSystem();
    const persona = allCompanions.find(c => c.id === `world-${worldId}`);
    if (persona) {
      handleUpdateConfig({ activeWorldId: worldId, selectedPersonaId: `world-${worldId}` });
      const existingSession = getExistingSessionForPersona(`world-${worldId}`) || getExistingSessionForPersona(worldId);
      if (existingSession) {
        handleSelectChat(existingSession.id);
      } else {
        setActiveSetupPersona(persona);
      }
    }
  }, [allCompanions, handleUpdateConfig, getExistingSessionForPersona, handleSelectChat]);

  const handleCreateCustomPersona = useCallback((newPersona: Persona) => {
    setStorageConfig((prev) => {
      const existingCustomIdx = prev.customPersonas.findIndex((p) => p.id === newPersona.id);
      let updatedCustom = [...prev.customPersonas];
      if (existingCustomIdx >= 0) {
        updatedCustom[existingCustomIdx] = newPersona;
      } else {
        updatedCustom.push(newPersona);
      }

      let updatedCharacters = [...(prev.characters || [])];
      const existingCharIdx = updatedCharacters.findIndex((p) => p.id === newPersona.id);
      if (existingCharIdx >= 0) {
        updatedCharacters[existingCharIdx] = newPersona;
      } else {
        updatedCharacters.push(newPersona);
      }

      const updated = saveStorageConfig({
        customPersonas: updatedCustom,
        characters: updatedCharacters,
        selectedPersonaId: newPersona.id,
        hasOnboarded: true,
      });
      return updated;
    });
  }, []);

  const handleOnboardingContinue = useCallback(() => {
    unlockAudioSystem();
    const updated = saveStorageConfig({ hasOnboarded: true });
    setStorageConfig(updated);
    setCurrentScreen('main');
    setActiveTab('personas');
  }, []);

  const handleSaveHistory = useCallback((historyId: string, messages: ChatMessage[], lastMessageText: string, personaId?: string, newDeletedMessageIds?: string[]) => {
    setStorageConfig((prev) => {
      const existingIdx = prev.chatHistories.findIndex((h) => h.id === historyId);
      let updatedHistories = [...prev.chatHistories];

      const allComps = [...PERSONAS, ...(prev.characters || []), ...worldCompanions];
      const targetPid = personaId || prev.selectedPersonaId;
      const p = allComps.find((item) => item.id === targetPid) || allComps[0];
      const pId = p?.id || targetPid || 'companion';
      const pName = p?.name || 'Companion';
      const pGradient = p?.avatarGradient || 'from-zinc-500 to-zinc-600';
      
      let linkedWorldId = undefined;
      if (targetPid && targetPid.startsWith('world-')) {
        linkedWorldId = targetPid.replace('world-', '');
      }

      let savedSession: ChatHistory;
      if (existingIdx >= 0) {
        const existingSession = updatedHistories[existingIdx];
        const activeUserPersona = (prev.userPersonas || []).find(p => p.id === (existingSession.userPersonaId || prev.activeUserPersonaId)) || prev.userPersonas?.[0];
        const resolvedName = existingSession.userPersonaName || activeUserPersona?.name || prev.userProfile?.name || 'You';
        const resolvedAvatar = existingSession.userPersonaAvatar || activeUserPersona?.avatar || prev.userProfile?.avatar;
        const resolvedDesc = existingSession.userPersonaDesc || activeUserPersona?.description || prev.userProfile?.description;
        
        const combinedDeleted = Array.from(new Set([
          ...(existingSession.deletedMessageIds || []),
          ...(newDeletedMessageIds || [])
        ]));
        const filteredMsgs = (messages || []).filter(m => !combinedDeleted.includes(m.id));

        if (historyId) {
          saveCharacterChatToLocalStorage(historyId, filteredMsgs, pId);
        } else if (pId) {
          saveCharacterChatToLocalStorage(pId, filteredMsgs);
        }

        const updatedSession: ChatHistory = {
          ...existingSession,
          personaId: personaId || existingSession.personaId || pId,
          personaName: pName || existingSession.personaName,
          linkedWorldId: linkedWorldId || existingSession.linkedWorldId,
          userPersonaId: existingSession.userPersonaId || activeUserPersona?.id || prev.activeUserPersonaId || 'user',
          userPersonaName: resolvedName,
          userPersonaAvatar: resolvedAvatar,
          userPersonaDesc: resolvedDesc,
          messages: filteredMsgs,
          lastMessage: lastMessageText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
          deletedMessageIds: combinedDeleted,
        };
        savedSession = updatedSession;
        updatedHistories.splice(existingIdx, 1);
        updatedHistories.unshift(updatedSession);
      } else {
        const activeUserPersona = (prev.userPersonas || []).find(p => p.id === prev.activeUserPersonaId) || prev.userPersonas?.[0];
        const resolvedName = activeUserPersona?.name || prev.userProfile?.name || 'You';
        const resolvedAvatar = activeUserPersona?.avatar || prev.userProfile?.avatar;
        const resolvedDesc = activeUserPersona?.description || prev.userProfile?.description;
        
        const combinedDeleted = Array.from(new Set(newDeletedMessageIds || []));
        const filteredMsgs = (messages || []).filter(m => !combinedDeleted.includes(m.id));

        if (historyId) {
          saveCharacterChatToLocalStorage(historyId, filteredMsgs, pId);
        } else if (pId) {
          saveCharacterChatToLocalStorage(pId, filteredMsgs);
        }

        const newSession: ChatHistory = {
          id: historyId,
          personaId: pId,
          personaName: pName,
          avatarGradient: pGradient,
          linkedWorldId: linkedWorldId,
          userPersonaId: activeUserPersona?.id || prev.activeUserPersonaId || '',
          userPersonaName: resolvedName,
          userPersonaAvatar: resolvedAvatar,
          userPersonaDesc: resolvedDesc,
          messages: filteredMsgs,
          lastMessage: lastMessageText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
          deletedMessageIds: combinedDeleted,
          isArchived: false,
        };
        savedSession = newSession;
        updatedHistories.unshift(newSession);
      }

      // Sort histories: pinned first, then strictly by newest message time
      updatedHistories.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return getLastMessageTime(b) - getLastMessageTime(a);
      });

      // Directly sync this single chat to Firestore in background for instantaneous cloud durability
      saveSingleChatToCloud(savedSession).catch(() => {});

      return saveStorageConfig({ chatHistories: updatedHistories, hasOnboarded: true });
    });
  }, [worldCompanions]);

  const handleDeleteChat = useCallback((historyId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Call cloud delete immediately
    deleteChatFromCloud(historyId).catch(() => {});

    setStorageConfig((prev) => {
      const session = prev.chatHistories.find(h => h.id === historyId);
      clearCharacterChatFromLocalStorage(historyId);
      if (session?.personaId) {
        const otherSessionsForChar = prev.chatHistories.filter(h => h.id !== historyId && h.personaId === session.personaId);
        if (otherSessionsForChar.length === 0) {
          clearCharacterChatFromLocalStorage(session.personaId);
        }
      }
      if (session?.linkedWorldId) {
        const otherWorldSessions = prev.chatHistories.filter(h => h.id !== historyId && h.linkedWorldId === session.linkedWorldId);
        if (otherWorldSessions.length === 0) {
          clearCharacterChatFromLocalStorage(`world-${session.linkedWorldId}`);
        }
      }

      const updatedHistories = prev.chatHistories.filter((h) => 
        h.id !== historyId && h.personaId !== historyId && h.linkedWorldId !== historyId
      );
      const updatedDeleted = Array.from(new Set([...(prev.deletedChatIds || []), historyId]));
      return saveStorageConfig({ chatHistories: updatedHistories, deletedChatIds: updatedDeleted });
    });
    setActiveChatSessionId(prev => prev === historyId ? null : prev);
  }, []);

  const handleTogglePinChat = useCallback((historyId: string) => {
    setStorageConfig((prev) => {
      const updatedHistories = prev.chatHistories.map((h) =>
        h.id === historyId ? { ...h, isPinned: !h.isPinned } : h
      );
      return saveStorageConfig({ chatHistories: updatedHistories });
    });
  }, []);

  const handleToggleArchiveChat = useCallback((historyId: string) => {
    setStorageConfig((prev) => {
      const updatedHistories = prev.chatHistories.map((h) =>
        h.id === historyId ? { ...h, isArchived: !h.isArchived } : h
      );
      return saveStorageConfig({ chatHistories: updatedHistories });
    });
  }, []);

  const handleToggleLikePersona = useCallback((personaId: string) => {
    setStorageConfig((prev) => {
      const liked = prev.likedPersonaIds || [];
      const isLiked = liked.includes(personaId);
      const updatedLiked = isLiked
        ? liked.filter((id) => id !== personaId)
        : [...liked, personaId];

      let updatedChars = [...(prev.characters || [])];
      const charIdx = updatedChars.findIndex((c) => c.id === personaId);
      if (charIdx >= 0) {
        const charObj = { ...updatedChars[charIdx] };
        charObj.favorite = !isLiked;
        charObj.isFavorite = !isLiked;
        updatedChars[charIdx] = charObj;
      }

      return saveStorageConfig({ 
        likedPersonaIds: updatedLiked,
        characters: updatedChars
      });
    });
  }, []);

  const handleToggleLikeWorld = useCallback((worldId: string) => {
    setStorageConfig((prev) => {
      const liked = prev.likedWorldIds || [];
      const isLiked = liked.includes(worldId);
      const updatedLiked = isLiked
        ? liked.filter((id) => id !== worldId)
        : [...liked, worldId];

      return saveStorageConfig({ 
        likedWorldIds: updatedLiked
      });
    });
  }, []);

  const handleDeletePersona = useCallback((personaId: string) => {
    // Delete permanently from Firestore root and user subcollections
    deleteCharacterFromDatabase(personaId).catch(() => {});

    setStorageConfig((prev) => {
      const updatedCustom = prev.customPersonas.filter((p) => p.id !== personaId);
      const updatedCharacters = (prev.characters || []).filter((p) => p.id !== personaId);
      const updatedHistories = prev.chatHistories.filter((h) => h.personaId !== personaId);
      
      let nextSelected = prev.selectedPersonaId;
      if (prev.selectedPersonaId === personaId) {
        nextSelected = updatedCharacters[0]?.id || '';
      }

      return saveStorageConfig({
        customPersonas: updatedCustom,
        characters: updatedCharacters,
        chatHistories: updatedHistories,
        selectedPersonaId: nextSelected,
      });
    });

    setActiveChatSessionId(prev => {
      if (!prev) return null;
      const activeSession = storageConfig.chatHistories.find(h => h.id === prev);
      if (activeSession && activeSession.personaId === personaId) {
        return null;
      }
      return prev;
    });
  }, [storageConfig.chatHistories]);

  const handleResetApp = useCallback(() => {
    localStorage.clear();
    clearIndexedDB().catch(() => {});
    const config = getStorageConfig();
    setStorageConfig(config);
    setCurrentScreen('welcome');
    setActiveTab('personas');
    setActiveChatSessionId(null);
  }, []);

  const fallbackPersona: Persona = {
    id: 'companion',
    name: 'AI Companion',
    subtitle: 'AI Roleplay Companion',
    tagline: 'Your AI Roleplay Companion',
    description: 'A versatile intelligence companion.',
    avatarEmoji: '✨',
    avatarGradient: 'from-purple-600 to-indigo-600',
    accentColor: 'purple',
    systemInstruction: 'You are a versatile intelligence companion.',
    isCustom: true,
    suggestedPrompts: [],
    greeting: 'Hello, how can I help you today?'
  };

  const selectedPersona = allCompanions.find(p => p.id === storageConfig.selectedPersonaId) || allCompanions[0] || fallbackPersona;

  // Active chat details if a history session is loaded
  const activeChatSession = storageConfig.chatHistories.find(h => h.id === activeChatSessionId);
  const activeChatPersonaId = activeChatSession ? activeChatSession.personaId : storageConfig.selectedPersonaId;
  const activePersona = allCompanions.find(p => p.id === activeChatPersonaId) || selectedPersona || fallbackPersona;

  const liveProfilePersona = globalProfilePersona 
    ? (allCompanions.find(c => c.id === globalProfilePersona.id) || globalProfilePersona)
    : null;

  const liveProfileWorld = globalProfileWorld
    ? ((storageConfig.worlds || []).find(w => w.id === globalProfileWorld.id) || globalProfileWorld)
    : null;

  const charactersOnly = useMemo(() => allCompanions.filter(c => !c.id.startsWith('world-')), [allCompanions]);
  const worldsList = useMemo(() => storageConfig.worlds || [], [storageConfig.worlds]);

  const handleTabChange = useCallback((tab: MainTabType) => {
    setActiveTab(tab);
    setActiveChatSessionId(null);
    setHubEditingPersonaId(null);
    setHubCreationType(null);
    setCreationOrigin(null);
  }, []);

  const handleCloseCreation = useCallback(() => {
    setHubEditingPersonaId(null);
    setHubCreationType(null);
    if (creationOrigin) {
      setActiveTab(creationOrigin.activeTab);
      setActiveChatSessionId(creationOrigin.activeChatSessionId);
      setHubCategory(creationOrigin.hubCategory);
      setCreationOrigin(null);
    }
  }, [creationOrigin]);

  const handleOpenCharacterCreator = useCallback(() => {
    setHubCreationType('character');
  }, []);

  const handleOpenWorldCreator = useCallback(() => {
    setHubCreationType('world');
  }, []);

  const handleOpenPersonaCreator = useCallback(() => {
    setHubCreationType('persona');
  }, []);

  const handleOpenGlobalProfile = useCallback((p: Persona) => {
    setGlobalProfilePersona(p);
  }, []);

  const handleOpenGlobalWorldProfile = useCallback((w: World) => {
    setGlobalProfileWorld(w);
  }, []);

  return (
    <div className={`w-full h-[100dvh] flex flex-col overflow-hidden font-sans selection:bg-[#E0E0E0] selection:text-[#121214] ${storageConfig.theme === 'light' ? 'bg-[#F8F9FA] theme-light' : 'bg-[#0A0A0A]'}`}>
      <div className="flex-1 flex flex-col relative overflow-hidden h-full">
        {currentScreen === 'welcome' && (
          <WelcomeScreen 
            theme={storageConfig.theme ?? 'dark'}
            onSetUp={() => {
              unlockAudioSystem();
              setCurrentScreen('onboarding');
            }} 
          />
        )}

        {currentScreen === 'onboarding' && (
          <OnboardingScreen
            storageConfig={storageConfig}
            onContinue={handleOnboardingContinue}
            theme={storageConfig.theme ?? 'dark'}
          />
        )}

        {currentScreen === 'main' && (
          <div className="flex-1 flex flex-col h-full relative overflow-hidden">
            {activeChatSessionId ? (
              /* Active Chat Session Overlay */
              <SafeErrorBoundary
                fallbackTitle="Chat Recovered"
                fallbackSubtitle="The chat interface caught a minor scene state issue and preserved your conversation."
                onReset={() => {}}
              >
                <PremiumChatScreen
                  key={activeChatSessionId}
                  initialLinkedWorldId={
                    activeChatSession?.linkedWorldId || 
                    (activeChatSession?.personaId?.startsWith('world-') ? activeChatSession.personaId.replace('world-', '') : undefined) ||
                    (storageConfig.selectedPersonaId?.startsWith('world-') ? storageConfig.selectedPersonaId.replace('world-', '') : undefined)
                  }
                  persona={activePersona}
                  apiKey={storageConfig.apiKey}
                  historyId={activeChatSessionId}
                  initialMessages={activeChatSession?.messages}
                  onBack={() => {
                    setActiveChatSessionId(null);
                    if (chatOrigin) {
                      setActiveTab(chatOrigin.tab);
                      if (chatOrigin.tab === 'history' && chatOrigin.section) {
                        setHistoryActiveSection(chatOrigin.section);
                      }
                      setChatOrigin(null);
                    }
                  }}
                  onSaveHistory={handleSaveHistory}
                  isRepliesEnabled={storageConfig.isRepliesEnabled !== false}
                  isHapticEnabled={storageConfig.isHapticEnabled !== false}
                  storageConfig={storageConfig}
                  onResumeChat={handleSelectChat}
                  onUpdateConfig={handleUpdateConfig}
                  onEditPersona={(personaId) => {
                    setCreationOrigin({
                      activeTab,
                      activeChatSessionId,
                      hubCategory
                    });
                    setHubEditingPersonaId(personaId);
                    setHubCreationType('character');
                  }}
                  onEditWorld={(worldId) => {
                    setCreationOrigin({
                      activeTab,
                      activeChatSessionId,
                      hubCategory
                    });
                    setHubEditingPersonaId(worldId);
                    setHubCreationType('world');
                  }}
                />
              </SafeErrorBoundary>
            ) : (
              /* Screen Tab Switcher */
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className={`flex-1 flex flex-col h-full overflow-hidden ${activeTab === 'history' ? '' : 'hidden'}`}>
                  {visitedTabs['history'] && (
                    <ChatHistoryScreen
                      chatHistories={storageConfig.chatHistories}
                      personas={allCompanions}
                      worlds={storageConfig.worlds || []}
                      activeSection={historyActiveSection}
                      onSectionChange={setHistoryActiveSection}
                      onSelectChat={(historyId) => {
                        if (!chatOrigin) {
                          setChatOrigin({
                            tab: 'history',
                            section: historyActiveSection
                          });
                        }
                        handleSelectChat(historyId);
                      }}
                      onDeleteChat={handleDeleteChat}
                      onNavigateToPersonas={() => setActiveTab('personas')}
                      onNavigateToWorld={(worldId) => {
                        setChatOrigin({
                          tab: 'history',
                          section: 'worlds'
                        });
                        setHistoryActiveSection('worlds');
                        handleEnterWorld(worldId);
                      }}
                      onNavigateToWorldProfile={(worldId) => {
                        const world = storageConfig.worlds?.find(w => w.id === worldId);
                        if (world) setGlobalProfileWorld(world);
                      }}
                      onNavigateToCharacterProfile={(personaId) => {
                        const persona = allCompanions.find(p => p.id === personaId);
                        if (persona) setGlobalProfilePersona(persona);
                      }}
                      onTogglePinChat={handleTogglePinChat}
                      onToggleArchiveChat={handleToggleArchiveChat}
                      theme={storageConfig.theme ?? 'dark'}
                      storageConfig={storageConfig}
                      onToggleLikePersona={handleToggleLikePersona}
                      onDeletePersona={handleDeletePersona}
                      onStartChat={(personaId) => {
                        unlockAudioSystem();
                        setChatOrigin({
                          tab: 'history',
                          section: historyActiveSection
                        });
                        const isWorld = personaId.startsWith('world-');
                        setHistoryActiveSection(isWorld ? 'worlds' : 'characters');

                        handleUpdateConfig({ selectedPersonaId: personaId });
                        const existingSession = getExistingSessionForPersona(personaId);
                        if (existingSession) {
                          setActiveChatSessionId(existingSession.id);
                        } else {
                          const persona = allCompanions.find(c => c.id === personaId);
                          if (persona) setActiveSetupPersona(persona);
                        }
                      }}
                      onUpdateConfig={handleUpdateConfig}
                      onEditPersona={(personaId) => {
                        setHubEditingPersonaId(personaId);
                        setHubCreationType('character');
                      }}
                      onOpenWorldCreator={() => {
                        setHubCreationType('world');
                      }}
                    />
                  )}
                </div>

                <div className={`flex-1 flex flex-col h-full overflow-hidden ${activeTab === 'personas' ? '' : 'hidden'}`}>
                  {visitedTabs['personas'] && (
                    <PersonaHubScreen
                      selectedPersonaId={storageConfig.selectedPersonaId}
                      customPersonas={storageConfig.customPersonas}
                      characters={charactersOnly}
                      likedPersonaIds={storageConfig.likedPersonaIds || []}
                      onSelectPersona={handleSelectPersona}
                      onSelectWorld={(worldId) => {
                        setChatOrigin({
                          tab: 'personas'
                        });
                        setHistoryActiveSection('worlds');
                        handleSetupWorld(worldId);
                      }}
                      onResumeChat={(historyId) => {
                        setChatOrigin({
                          tab: 'personas'
                        });
                        handleSelectChat(historyId);
                      }}
                      onStartChat={(explicitPersonaId) => {
                        unlockAudioSystem();
                        const pId = typeof explicitPersonaId === 'string' ? explicitPersonaId : storageConfig.selectedPersonaId;
                        const persona = allCompanions.find(c => c.id === pId);
                        if (persona) {
                          setChatOrigin({
                            tab: 'personas'
                          });
                          const isWorld = pId.startsWith('world-');
                          setHistoryActiveSection(isWorld ? 'worlds' : 'characters');
                          
                          handleUpdateConfig({ selectedPersonaId: pId });
                          if (isWorld) {
                            const worldId = pId.replace('world-', '');
                            handleUpdateConfig({ activeWorldId: worldId });
                          }

                          const existingSession = getExistingSessionForPersona(pId);
                          if (existingSession) {
                            handleSelectChat(existingSession.id, 'personas');
                          } else {
                            setActiveSetupPersona(persona);
                          }
                        }
                      }}
                      onCreateCustomPersona={handleCreateCustomPersona}
                      onToggleLikePersona={handleToggleLikePersona}
                      onUpdateConfig={handleUpdateConfig}
                      activeCategory={hubCategory}
                      setActiveCategory={setHubCategory}
                      storageConfig={storageConfig}
                      onDeletePersona={handleDeletePersona}
                      initialEditingPersonaId={hubEditingPersonaId}
                      initialCreationType={hubCreationType}
                      onCloseCreation={handleCloseCreation}
                      onOpenGlobalProfile={handleOpenGlobalProfile}
                      onOpenGlobalWorldProfile={handleOpenGlobalWorldProfile}
                      onOpenCharacterCreator={handleOpenCharacterCreator}
                      onOpenWorldCreator={handleOpenWorldCreator}
                      onOpenPersonaCreator={handleOpenPersonaCreator}
                    />
                  )}
                </div>

                <div className={`flex-1 flex flex-col h-full overflow-hidden ${activeTab === 'profile' ? '' : 'hidden'}`}>
                  {visitedTabs['profile'] && (
                    <ProfileScreen
                      storageConfig={storageConfig}
                      onUpdateConfig={handleUpdateConfig}
                      onResetApp={handleResetApp}
                      onOpenCodeViewer={() => {}}
                      onNavigateTab={handleTabChange}
                      onOpenCharacterCreator={handleOpenCharacterCreator}
                      onOpenWorldCreator={handleOpenWorldCreator}
                      onEditCharacter={(personaId) => {
                        setHubEditingPersonaId(personaId);
                        setHubCreationType('character');
                      }}
                      onEditWorld={(worldId) => {
                        setHubEditingPersonaId(worldId);
                        setHubCreationType('world');
                      }}
                      onNavigateToWorld={(worldId) => {
                        setChatOrigin({
                          tab: 'profile'
                        });
                        setHistoryActiveSection('worlds');
                        handleEnterWorld(worldId);
                      }}
                      onNavigateToWorldProfile={(worldId) => {
                        const world = storageConfig.worlds?.find(w => w.id === worldId);
                        if (world) setGlobalProfileWorld(world);
                      }}
                      onNavigateToCharacterProfile={(personaId) => {
                        const persona = allCompanions.find(p => p.id === personaId);
                        if (persona) setGlobalProfilePersona(persona);
                      }}
                      onStartChat={(personaId) => {
                        setChatOrigin({
                          tab: 'profile'
                        });
                        const isWorld = personaId.startsWith('world-');
                        setHistoryActiveSection(isWorld ? 'worlds' : 'characters');

                        handleUpdateConfig({ selectedPersonaId: personaId });
                        const existingSession = getExistingSessionForPersona(personaId);
                        if (existingSession) {
                          handleSelectChat(existingSession.id, 'profile');
                        } else {
                          const persona = allCompanions.find(c => c.id === personaId);
                          if (persona) setActiveSetupPersona(persona);
                        }
                      }}
                    />
                  )}
                </div>

                {/* Highly Polished Glass Dock Bottom Bar */}
                <GlassDock
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  theme={storageConfig.theme ?? 'dark'}
                />
              </div>
            )}
          </div>
        )}
        {activeSetupPersona && (
          <NewSessionScreen
            character={activeSetupPersona}
            storageConfig={storageConfig}
            isLight={storageConfig.theme === 'light'}
            onCancel={() => {
              setActiveSetupPersona(null);
              if (chatOrigin) {
                setActiveTab(chatOrigin.tab);
                if (chatOrigin.tab === 'history' && chatOrigin.section) {
                  setHistoryActiveSection(chatOrigin.section);
                }
                setChatOrigin(null);
              }
            }}
            onResumeChat={(historyId) => {
              setActiveSetupPersona(null);
              handleSelectChat(historyId);
            }}
            onStart={(config) => {
              unlockAudioSystem();
              setActiveSetupPersona(null);
              setActiveChatSessionId(null);
              const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
              const targetWorldId = config.worldId || (activeSetupPersona.id.startsWith('world-') ? activeSetupPersona.id.replace('world-', '') : undefined);
              const matchedWorld = targetWorldId ? (storageConfig.worlds || []).find(w => w.id === targetWorldId) : null;
              const startingPlace = matchedWorld?.places?.[0]?.name || 'General';
              const startingAmbient = matchedWorld?.ambientSounds?.[0]?.name || 'General';

              let updatedWorlds = storageConfig.worlds || [];
              if (config.alsoSaveToWorld && targetWorldId && config.linkedCharacterIds) {
                updatedWorlds = updatedWorlds.map(w => w.id === targetWorldId ? { ...w, linkedCharacterIds: config.linkedCharacterIds } : w);
              }

              // Snapshot all existing historical sessions so changes to the world can NEVER alter old sessions
              const existingSnapshottedHistories = (storageConfig.chatHistories || []).map(h => {
                if (h.linkedCharacterIds !== undefined) return h;
                if (h.linkedWorldId) {
                  const w = (storageConfig.worlds || []).find(x => x.id === h.linkedWorldId);
                  return { ...h, linkedCharacterIds: w?.linkedCharacterIds ? [...w.linkedCharacterIds] : [] };
                } else if (h.personaId && !h.personaId.startsWith('world-')) {
                  return { ...h, linkedCharacterIds: [h.personaId] };
                }
                return h;
              });

              const resolvedSessionCast = config.linkedCharacterIds !== undefined
                ? config.linkedCharacterIds
                : (matchedWorld?.linkedCharacterIds ? [...matchedWorld.linkedCharacterIds] : (activeSetupPersona.id && !activeSetupPersona.id.startsWith('world-') ? [activeSetupPersona.id] : []));

              const newSession: ChatHistory = {
                id: newSessionId,
                personaId: activeSetupPersona.id,
                personaName: activeSetupPersona.name,
                avatarGradient: activeSetupPersona.avatarGradient,
                lastMessage: '',
                timestamp: new Date().toISOString(),
                updatedAt: Date.now(),
                messages: [{
                  id: `msg-${Date.now()}`,
                  role: 'system',
                  text: config.greeting || activeSetupPersona.greeting || `Greetings. I am ${activeSetupPersona.name}.`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                }],
                linkedWorldId: targetWorldId,
                linkedCharacterIds: resolvedSessionCast,
                userPersonaId: (() => {
                  const targetId = config.userPersonaId || storageConfig.activeUserPersonaId;
                  const found = (storageConfig.userPersonas || []).find(p => p.id === targetId);
                  return found?.id || targetId || 'user';
                })(),
                userPersonaName: (() => {
                  const targetId = config.userPersonaId || storageConfig.activeUserPersonaId;
                  const found = (storageConfig.userPersonas || []).find(p => p.id === targetId);
                  return found?.name || storageConfig.userPersonas?.[0]?.name || storageConfig.userProfile?.name || 'You';
                })(),
                userPersonaAvatar: (() => {
                  const targetId = config.userPersonaId || storageConfig.activeUserPersonaId;
                  const found = (storageConfig.userPersonas || []).find(p => p.id === targetId);
                  return found?.avatar || storageConfig.userPersonas?.[0]?.avatar || storageConfig.userProfile?.avatar;
                })(),
                userPersonaDesc: (() => {
                  const targetId = config.userPersonaId || storageConfig.activeUserPersonaId;
                  const found = (storageConfig.userPersonas || []).find(p => p.id === targetId);
                  return found?.description || storageConfig.userPersonas?.[0]?.description || storageConfig.userProfile?.description;
                })(),
                enableSceneDetection: config.enableSceneDetection,
                activePlaceName: startingPlace,
                activeAmbientName: startingAmbient
              };
              handleUpdateConfig({ 
                chatHistories: [newSession, ...existingSnapshottedHistories],
                ...(config.alsoSaveToWorld && targetWorldId ? { worlds: updatedWorlds } : {})
              });
              setActiveChatSessionId(newSessionId);
            }}
          />
        )}

        {/* Global Profile Overlays */}
        <AnimatePresence>
          {globalProfilePersona && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 z-[120]"
            >
              <CharacterProfileScreen
                persona={liveProfilePersona || globalProfilePersona}
                storageConfig={storageConfig}
                likedPersonaIds={storageConfig.likedPersonaIds || []}
                onBack={() => setGlobalProfilePersona(null)}
                disableAnimation={true}
                onStartChat={(pidParam, forceNew) => {
                  unlockAudioSystem();
                  const pid = pidParam || (liveProfilePersona || globalProfilePersona).id;
                  setChatOrigin({
                    tab: activeTab,
                    section: activeTab === 'history' ? historyActiveSection : undefined
                  });
                  const isWorld = pid.startsWith('world-');
                  setHistoryActiveSection(isWorld ? 'worlds' : 'characters');

                  setGlobalProfilePersona(null);
                  handleUpdateConfig({ selectedPersonaId: pid });
                  const existingSession = getExistingSessionForPersona(pid);
                  if (existingSession && !forceNew) {
                    handleSelectChat(existingSession.id);
                  } else {
                    const p = allCompanions.find(c => c.id === pid);
                    if (p) setActiveSetupPersona(p);
                  }
                }}
                onEdit={(persona) => {
                  setHubEditingPersonaId(persona.id);
                  setHubCreationType('character');
                }}
                onToggleLike={(personaId) => handleToggleLikePersona(personaId)}
                onDelete={(personaId) => {
                  setGlobalProfilePersona(null);
                  handleDeletePersona(personaId);
                }}
                onResumeChat={(historyId) => {
                  unlockAudioSystem();
                  setChatOrigin({
                    tab: activeTab,
                    section: activeTab === 'history' ? historyActiveSection : undefined
                  });
                  setGlobalProfilePersona(null);
                  handleSelectChat(historyId);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {globalProfileWorld && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-0 z-[120]"
            >
              <WorldProfileScreen
                world={liveProfileWorld || globalProfileWorld}
                storageConfig={storageConfig}
                likedWorldIds={storageConfig.likedWorldIds || []}
                onBack={() => setGlobalProfileWorld(null)}
                disableAnimation={true}
                onStartChat={(forceNew) => {
                  unlockAudioSystem();
                  const worldId = (liveProfileWorld || globalProfileWorld).id;
                  setChatOrigin({
                    tab: activeTab,
                    section: activeTab === 'history' ? historyActiveSection : undefined
                  });
                  setHistoryActiveSection('worlds');

                  setGlobalProfileWorld(null);
                  const persona = allCompanions.find(c => c.id === `world-${worldId}`);
                  if (persona) {
                    handleUpdateConfig({ activeWorldId: worldId, selectedPersonaId: `world-${worldId}` });
                    const existingSession = (storageConfig.chatHistories || []).find(h => (h.personaId === `world-${worldId}` || h.linkedWorldId === worldId) && !h.isArchived);
                    if (existingSession && !forceNew) {
                      handleSelectChat(existingSession.id);
                    } else {
                      setActiveSetupPersona(persona);
                    }
                  }
                }}
                onEdit={(world) => {
                  setHubEditingPersonaId(world.id);
                  setHubCreationType('world');
                }}
                onToggleLike={(worldId) => {
                  handleToggleLikeWorld(worldId);
                }}
                onDelete={(worldId) => {
                  setGlobalProfileWorld(null);
                  deleteWorldFromDatabase(worldId).catch(() => {});
                  const worlds = (storageConfig.worlds || []).filter(w => w.id !== worldId);
                  const histories = (storageConfig.chatHistories || []).filter(h => h.linkedWorldId !== worldId);
                  handleUpdateConfig({ worlds, chatHistories: histories });
                }}
                onResumeChat={(historyId) => {
                  setChatOrigin({
                    tab: activeTab,
                    section: activeTab === 'history' ? historyActiveSection : undefined
                  });
                  setGlobalProfileWorld(null);
                  handleSelectChat(historyId);
                }}
                onNavigateToCharacterProfile={(pid) => {
                  const persona = allCompanions.find(p => p.id === pid);
                  if (persona) setGlobalProfilePersona(persona);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Creator Overlays */}
        {hubCreationType === 'character' ? (
          <CharacterCreator
            isLight={storageConfig.theme === 'light'}
            onClose={() => {
              setHubCreationType(null);
              setHubEditingPersonaId(null);
              if (creationOrigin?.activeChatSessionId) {
                setActiveChatSessionId(creationOrigin.activeChatSessionId);
                setActiveTab(creationOrigin.activeTab);
                setCreationOrigin(null);
              }
            }}
            onSave={(persona) => {
              handleCreateCustomPersona(persona);
              setHubCreationType(null);
              setHubEditingPersonaId(null);
              if (creationOrigin?.activeChatSessionId) {
                setActiveChatSessionId(creationOrigin.activeChatSessionId);
                setActiveTab(creationOrigin.activeTab);
                setCreationOrigin(null);
              }
            }}
            onUpdate={(persona) => {
              handleCreateCustomPersona(persona);
            }}
            initialData={hubEditingPersonaId ? (
              allCompanions.find(p => p.id === hubEditingPersonaId) || 
              [...(storageConfig.customPersonas || []), ...(storageConfig.characters || [])].find(p => p.id === hubEditingPersonaId)
            ) : null}
          />
        ) : hubCreationType === 'persona' ? (
          <UserPersonaCreator
            isLight={storageConfig.theme === 'light'}
            onClose={() => setHubCreationType(null)}
            onSave={(newPersona) => {
              const currentPersonas = storageConfig?.userPersonas || [];
              const personaWithTs = { ...newPersona, updatedAt: Date.now() };
              const exists = currentPersonas.some(p => p.id === newPersona.id);
              let updatedPersonas = exists
                ? currentPersonas.map(p => p.id === newPersona.id ? personaWithTs : p)
                : [...currentPersonas, personaWithTs];
              
              const updatedHistories = (storageConfig?.chatHistories || []).map(h => {
                if (h.userPersonaId === newPersona.id) {
                  return {
                    ...h,
                    userPersonaName: newPersona.name,
                    userPersonaAvatar: newPersona.avatar || '',
                    userPersonaDesc: newPersona.description || '',
                    updatedAt: Date.now()
                  };
                }
                return h;
              });

              if (newPersona.isDefault) {
                updatedPersonas = updatedPersonas.map(p => ({
                  ...p,
                  isDefault: p.id === newPersona.id
                }));
                handleUpdateConfig({ 
                  userPersonas: updatedPersonas,
                  activeUserPersonaId: newPersona.id,
                  chatHistories: updatedHistories
                });
              } else {
                handleUpdateConfig({ 
                  userPersonas: updatedPersonas,
                  chatHistories: updatedHistories
                });
              }

              for (const h of updatedHistories.filter(x => x.userPersonaId === newPersona.id).slice(0, 5)) {
                saveUserPersonaToChat(h.id, {
                  id: newPersona.id,
                  name: newPersona.name,
                  avatar: newPersona.avatar,
                  description: newPersona.description
                }).catch(() => {});
              }

              setHubCreationType(null);
            }}
          />
        ) : hubCreationType === 'world' ? (
          <WorldCreator
            isLight={storageConfig.theme === 'light'}
            storageConfig={storageConfig}
            onClose={() => {
              setHubCreationType(null);
              setHubEditingPersonaId(null);
              if (creationOrigin?.activeChatSessionId) {
                setActiveChatSessionId(creationOrigin.activeChatSessionId);
                setActiveTab(creationOrigin.activeTab);
                setCreationOrigin(null);
              }
            }}
            onSave={(newWorld) => {
              const currentWorlds = storageConfig?.worlds || [];
              const exists = currentWorlds.some(w => w.id === newWorld.id);
              let updatedWorlds;
              if (exists) {
                updatedWorlds = currentWorlds.map(w => w.id === newWorld.id ? newWorld : w);
              } else {
                updatedWorlds = [...currentWorlds, newWorld];
              }
              handleUpdateConfig({ worlds: updatedWorlds });
              setHubCreationType(null);
              setHubEditingPersonaId(null);
              if (creationOrigin?.activeChatSessionId) {
                setActiveChatSessionId(creationOrigin.activeChatSessionId);
                setActiveTab(creationOrigin.activeTab);
                setCreationOrigin(null);
              }
            }}
            onUpdate={(newWorld) => {
              const currentWorlds = storageConfig?.worlds || [];
              const exists = currentWorlds.some(w => w.id === newWorld.id);
              let updatedWorlds;
              if (exists) {
                updatedWorlds = currentWorlds.map(w => w.id === newWorld.id ? newWorld : w);
              } else {
                updatedWorlds = [...currentWorlds, newWorld];
              }
              handleUpdateConfig({ worlds: updatedWorlds });
            }}
            initialData={(() => {
              if (!hubEditingPersonaId) return null;
              const cleanId = hubEditingPersonaId.replace(/^world-/, '');
              return (storageConfig.worlds || []).find(w => 
                w.id === hubEditingPersonaId || 
                w.id === cleanId || 
                `world-${w.id}` === hubEditingPersonaId
              ) || null;
            })()}
          />
        ) : null}
      </div>

    </div>
  );
}
