import React, { useState, useEffect, useRef } from 'react';
import { StorageConfig, Persona, UserPersona, UserProfile, World } from '../../types';
import { PERSONAS } from '../../data/personas';
import { motion, AnimatePresence } from 'motion/react';
import { UserPersonaCreator } from './UserPersonaCreator';
import { ImageCropModal } from '../ImageCropModal';
import { OrbBadge } from '../common/OrbBadge';
import { OrbWalletModal } from '../common/OrbWalletModal';
import { storeAsset, useAsset } from '../../utils/fileDb';
import { SafeImage } from '../common/SafeImage';
import { 
  subscribeToSyncState, 
  loginWithGoogle, 
  logoutAndReset, 
  pushConfigToCloud, 
  pullCloudData,
  CloudSyncState 
} from '../../utils/cloudSync';

import { 
  User, 
  ShieldCheck, 
  KeyRound, 
  Cpu, 
  RotateCcw, 
  CheckCircle2, 
  ChevronRight, 
  Award, 
  Flame, 
  Sparkles, 
  Heart, 
  FileText, 
  Settings, 
  Share2, 
  Pencil, 
  Plus, 
  Trash2, 
  X, 
  PlusCircle, 
  MessageSquare,
  Sparkle,
  Zap,
  Database,
  Shield,
  Volume2,
  Globe,
  Fingerprint,
  Code,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Type,
  Download,
  Info,
  Activity,
  Check,
  AlertTriangle,
  LayoutTemplate,
  Save,
  Users,
  MessageCircle,
  Cloud,
  RefreshCw,
  LogIn,
  LogOut
} from 'lucide-react';

const getPrimaryCategory = (persona: Persona) => {
  if (persona.tags && persona.tags.length > 0) {
    return persona.tags[0];
  }
  return 'Featured';
};

const getRealMessageCount = (persona: Persona, histories: any[] = []) => {
  const matchingHistories = histories.filter(h => h.personaId === persona.id);
  let localMessageCount = 0;
  matchingHistories.forEach(h => {
    if (h.messages && Array.isArray(h.messages)) {
      localMessageCount += h.messages.length;
    }
  });

  let baseChats = 0;
  if (persona.chatsCount) {
    const cleanStr = String(persona.chatsCount).toLowerCase().trim();
    const parsed = parseInt(cleanStr.replace(/[^0-9.]/g, ''), 10);
    if (!isNaN(parsed)) {
      if (cleanStr.includes('k')) {
        baseChats = Math.round(parsed * 1000);
      } else if (cleanStr.includes('m')) {
        baseChats = Math.round(parsed * 1000000);
      } else {
        baseChats = parsed;
      }
    }
  } else {
    if (persona.isCustom) {
      baseChats = 0;
    } else {
      let hash = 0;
      for (let i = 0; i < persona.id.length; i++) {
        hash += persona.id.charCodeAt(i);
      }
      baseChats = (hash % 450) + 120;
    }
  }

  const finalCount = baseChats + localMessageCount;
  if (finalCount >= 1000000) return `${(finalCount / 1000000).toFixed(1)}M`;
  if (finalCount >= 1000) return `${(finalCount / 1000).toFixed(1)}K`;
  return String(finalCount);
};

const getRealLikesCount = (persona: Persona, isLiked: boolean) => {
  let baseLikes = 0;
  if (persona.likesCount) {
    const cleanStr = String(persona.likesCount).toLowerCase().trim();
    const parsed = parseInt(cleanStr.replace(/[^0-9.]/g, ''), 10);
    if (!isNaN(parsed)) {
      if (cleanStr.includes('k')) {
        baseLikes = Math.round(parsed * 1000);
      } else if (cleanStr.includes('m')) {
        baseLikes = Math.round(parsed * 1000000);
      } else {
        baseLikes = parsed;
      }
    }
  } else {
    if (persona.isCustom) {
      baseLikes = 0;
    } else {
      let hash = 0;
      for (let i = 0; i < persona.id.length; i++) {
        hash += persona.id.charCodeAt(i);
      }
      baseLikes = (hash % 90) + 18;
    }
  }

  const finalCount = baseLikes + (isLiked ? 1 : 0);
  if (finalCount >= 1000000) return `${(finalCount / 1000000).toFixed(1)}M`;
  if (finalCount >= 1000) return `${(finalCount / 1000).toFixed(1)}K`;
  return String(finalCount);
};

const getWorldMessageCount = (world: World, histories: any[] = []) => {
  const matchingHistories = histories.filter(h => h.linkedWorldId === world.id);
  let localMessageCount = 0;
  matchingHistories.forEach(h => {
    if (h.messages && Array.isArray(h.messages)) {
      localMessageCount += h.messages.length;
    }
  });

  let baseChats = 0;
  if (world.chatsCount) {
    const cleanStr = String(world.chatsCount).toLowerCase().trim();
    const parsed = parseInt(cleanStr.replace(/[^0-9.]/g, ''), 10);
    if (!isNaN(parsed)) {
      if (cleanStr.includes('k')) {
        baseChats = Math.round(parsed * 1000);
      } else if (cleanStr.includes('m')) {
        baseChats = Math.round(parsed * 1000000);
      } else {
        baseChats = parsed;
      }
    }
  } else {
    if (world.creator === '@you' || world.id.startsWith('custom-')) {
      baseChats = 0;
    } else {
      let hash = 0;
      for (let i = 0; i < world.id.length; i++) {
        hash += world.id.charCodeAt(i);
      }
      baseChats = (hash % 350) + 80;
    }
  }

  const finalCount = baseChats + localMessageCount;
  if (finalCount >= 1000000) return `${(finalCount / 1000000).toFixed(1)}M`;
  if (finalCount >= 1000) return `${(finalCount / 1000).toFixed(1)}K`;
  return String(finalCount);
};

const getRealWorldLikesCount = (world: World, isLiked: boolean) => {
  let baseLikes = 0;
  if (world.likesCount) {
    const cleanStr = String(world.likesCount).toLowerCase().trim();
    const parsed = parseInt(cleanStr.replace(/[^0-9.]/g, ''), 10);
    if (!isNaN(parsed)) {
      if (cleanStr.includes('k')) {
        baseLikes = Math.round(parsed * 1000);
      } else if (cleanStr.includes('m')) {
        baseLikes = Math.round(parsed * 1000000);
      } else {
        baseLikes = parsed;
      }
    }
  } else {
    if (world.creator === '@you' || world.id.startsWith('custom-')) {
      baseLikes = 0;
    } else {
      let hash = 0;
      for (let i = 0; i < world.id.length; i++) {
        hash += world.id.charCodeAt(i);
      }
      baseLikes = (hash % 70) + 15;
    }
  }

  const finalCount = baseLikes + (isLiked ? 1 : 0);
  if (finalCount >= 1000000) return `${(finalCount / 1000000).toFixed(1)}M`;
  if (finalCount >= 1000) return `${(finalCount / 1000).toFixed(1)}K`;
  return String(finalCount);
};

interface ProfileScreenProps {
  storageConfig: StorageConfig;
  onUpdateConfig: (config: Partial<StorageConfig>) => void;
  onResetApp: () => void;
  onOpenCodeViewer: () => void;
  onNavigateTab?: (tab: 'history' | 'personas' | 'profile') => void;
  onStartChat?: (personaId: string) => void;
  onOpenCharacterCreator?: () => void;
  onOpenWorldCreator?: () => void;
  onNavigateToWorld?: (worldId: string) => void;
  onNavigateToWorldProfile?: (worldId: string) => void;
  onNavigateToCharacterProfile?: (personaId: string) => void;
  onEditCharacter?: (personaId: string) => void;
  onEditWorld?: (worldId: string) => void;
}

type ProfileTabType = 'characters' | 'personas' | 'liked';

export const ProfileScreen: React.FC<ProfileScreenProps> = React.memo(({
  storageConfig,
  onUpdateConfig,
  onResetApp,
  onOpenCodeViewer,
  onNavigateTab,
  onStartChat,
  onOpenCharacterCreator,
  onOpenWorldCreator,
  onNavigateToWorld,
  onNavigateToWorldProfile,
  onNavigateToCharacterProfile,
  onEditCharacter,
  onEditWorld,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ProfileTabType | 'worlds'>('characters');
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  
  // Custom toggles for overhauled Settings screen initialized directly from storageConfig
  const [isHapticEnabled, setIsHapticEnabled] = useState(storageConfig.isHapticEnabled !== false);
  const [isPerformanceMode, setIsPerformanceMode] = useState(storageConfig.isPerformanceMode === true);
  const [isRepliesEnabled, setIsRepliesEnabled] = useState(storageConfig.isRepliesEnabled !== false);
  const [isCacheEnabled, setIsCacheEnabled] = useState(storageConfig.isCacheEnabled !== false);
  const [isSafeFilterEnabled, setIsSafeFilterEnabled] = useState(storageConfig.isSafeFilterEnabled !== false);
  const [apiProvider, setApiProvider] = useState<'gemini' | 'openai'>(storageConfig.apiProvider ?? 'gemini');
  const [selectedModel, setSelectedModel] = useState<string>(
    (storageConfig.selectedModel && storageConfig.selectedModel.startsWith('gemini-3.'))
      ? storageConfig.selectedModel 
      : 'gemini-3.8-flash'
  );
  const [theme, setTheme] = useState<'dark' | 'light'>(storageConfig.theme ?? 'dark');
  const isLight = theme === 'light';
  const [messageTextSize, setMessageTextSize] = useState<number>(storageConfig.messageTextSize ?? 13);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Orb Economy Modals State
  const [showOrbWallet, setShowOrbWallet] = useState(false);

  // Key vault state
  const [apiKey, setApiKey] = useState(storageConfig.apiKey || '');
  const [apiKeys, setApiKeys] = useState<string[]>(storageConfig.apiKeys || (storageConfig.apiKey ? [storageConfig.apiKey] : []));
  const [worldApiKey, setWorldApiKey] = useState(storageConfig.worldApiKey || '');
  const [useSameApiKey, setUseSameApiKey] = useState(storageConfig.useSameApiKey !== false);
  const [isSaved, setIsSaved] = useState(false);

  // Cloud Sync State
  const [syncState, setSyncState] = useState<CloudSyncState>({
    isInitialized: false,
    isAuthenticated: false,
    isGoogleUser: false,
    userId: null,
    userEmail: null,
    userName: null,
    userPhoto: null,
    status: 'idle',
    lastSyncedAt: null,
    errorMessage: null
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSyncState(setSyncState);
    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await loginWithGoogle(storageConfig, (newConfig) => {
        onUpdateConfig(newConfig);
      });
      triggerToast("Google Account linked! Cloud sync active.");
    } catch (err: any) {
      triggerToast(err?.message || "Google sign-in failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutAndReset((newConfig) => {
        onUpdateConfig(newConfig);
      });
      triggerToast("Signed out of Google Account.");
    } catch (err) {
      triggerToast("Sign out failed");
    }
  };

  const handleManualSync = async () => {
    try {
      triggerToast("Syncing with Firestore Cloud...");
      if (syncState.userId) {
        const merged = await pullCloudData(syncState.userId, storageConfig);
        onUpdateConfig(merged);
        await pushConfigToCloud(merged);
        triggerToast("Cloud sync complete! ✅");
      } else {
        await pushConfigToCloud(storageConfig);
        triggerToast("Cloud sync complete! ✅");
      }
    } catch (err: any) {
      triggerToast("Sync error: " + (err.message || 'Unknown'));
    }
  };

  const isEditingKeysRef = useRef(false);
  const saveTimerRef = useRef<any>(null);

  const commitApiKeys = React.useCallback((
    keysToCommit?: string[],
    worldKeyToCommit?: string,
    sameKey?: boolean
  ) => {
    const activeKeys = keysToCommit !== undefined ? keysToCommit : apiKeys;
    const activeWorld = worldKeyToCommit !== undefined ? worldKeyToCommit : worldApiKey;
    const activeSame = sameKey !== undefined ? sameKey : useSameApiKey;
    const trimmedKeys = (activeKeys || []).map(k => (k || '').trim());
    
    onUpdateConfig({
      apiKeys: trimmedKeys,
      apiKey: trimmedKeys[0] || '',
      worldApiKey: (activeWorld || '').trim(),
      useSameApiKey: activeSame
    });
  }, [apiKeys, worldApiKey, useSameApiKey, onUpdateConfig]);

  const scheduleAutoSave = React.useCallback((
    updatedKeys: string[],
    updatedWorldKey: string,
    sameKey: boolean
  ) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      commitApiKeys(updatedKeys, updatedWorldKey, sameKey);
    }, 1200);
  }, [commitApiKeys]);

  // Sync external config to local state only when not actively editing
  useEffect(() => {
    if (!isEditingKeysRef.current) {
      const incomingKeys = storageConfig.apiKeys || (storageConfig.apiKey ? [storageConfig.apiKey] : []);
      setApiKeys(incomingKeys.length > 0 ? incomingKeys : ['']);
      setApiKey(storageConfig.apiKey || '');
      setWorldApiKey(storageConfig.worldApiKey || '');
      if (storageConfig.useSameApiKey !== undefined) {
        setUseSameApiKey(storageConfig.useSameApiKey !== false);
      }
    }
  }, [storageConfig.apiKeys, storageConfig.apiKey, storageConfig.worldApiKey, storageConfig.useSameApiKey]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const triggerHaptic = () => {
    if (storageConfig.isHapticEnabled !== false && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(storageConfig, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "vsen_export.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast("Saved to Downloads/vsen_export.json");
  };

  const handleClearAllChatHistory = () => {
    onUpdateConfig({ chatHistories: [] });
    setShowClearHistoryConfirm(false);
    triggerToast("All Chat Histories Cleared!");
  };

  const handleTestConnection = async () => {
    const isFallbackAllowed = apiProvider === 'gemini' && storageConfig.useServerKeyFallback !== false;
    const activeKey = apiKey?.trim() || apiKeys[0]?.trim();

    if (!activeKey && !isFallbackAllowed) {
      setTestStatus('error');
      setTestError('Please provide an API key first.');
      return;
    }

    // Immediately commit current keys
    commitApiKeys(apiKeys, worldApiKey, useSameApiKey);

    setTestStatus('testing');
    setTestError(null);
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: activeKey || 'SERVER_FALLBACK',
          provider: apiProvider
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTestStatus('success');
        triggerToast("API Connection Verified!");
      } else {
        setTestStatus('error');
        setTestError(data.error || 'Connection failed.');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestError(err.message || 'Connection test failed.');
    }
  };

  const [samplerMaxContext, setSamplerMaxContext] = useState(storageConfig.samplerMaxContext ?? 8192);
  const [samplerGeneratedTokens, setSamplerGeneratedTokens] = useState(storageConfig.samplerGeneratedTokens ?? 1024);
  const [samplerIsStreaming, setSamplerIsStreaming] = useState(storageConfig.samplerIsStreaming ?? true);
  const [samplerTemperature, setSamplerTemperature] = useState(storageConfig.samplerTemperature ?? 0.7);
  const [samplerTopP, setSamplerTopP] = useState(storageConfig.samplerTopP ?? 0.95);
  const [samplerPresencePenalty, setSamplerPresencePenalty] = useState(storageConfig.samplerPresencePenalty ?? 0.0);
  const [samplerFrequencyPenalty, setSamplerFrequencyPenalty] = useState(storageConfig.samplerFrequencyPenalty ?? 0.0);
  const [samplerSeed, setSamplerSeed] = useState(storageConfig.samplerSeed ?? 42);

  // Sync settings on mount
  useEffect(() => {
    setIsHapticEnabled(storageConfig.isHapticEnabled !== false);
    setIsRepliesEnabled(storageConfig.isRepliesEnabled !== false);
    setIsCacheEnabled(storageConfig.isCacheEnabled !== false);
    setIsSafeFilterEnabled(storageConfig.isSafeFilterEnabled !== false);
    setApiProvider(storageConfig.apiProvider ?? 'gemini');
    setTheme(storageConfig.theme ?? 'dark');
    setMessageTextSize(storageConfig.messageTextSize ?? 13);
    setApiKey(storageConfig.apiKey || '');
    setWorldApiKey(storageConfig.worldApiKey || '');
    setUseSameApiKey(storageConfig.useSameApiKey !== false);
    setSamplerMaxContext(storageConfig.samplerMaxContext ?? 8192);
    setSamplerGeneratedTokens(storageConfig.samplerGeneratedTokens ?? 1024);
    setSamplerIsStreaming(storageConfig.samplerIsStreaming ?? true);
    setSamplerTemperature(storageConfig.samplerTemperature ?? 0.7);
    setSamplerTopP(storageConfig.samplerTopP ?? 0.95);
    setSamplerPresencePenalty(storageConfig.samplerPresencePenalty ?? 0.0);
    setSamplerFrequencyPenalty(storageConfig.samplerFrequencyPenalty ?? 0.0);
    setSamplerSeed(storageConfig.samplerSeed ?? 42);
  }, []);
  
  // Modals for creating entities
  const [showCreatePersona, setShowCreatePersona] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: 'character' | 'world' | 'persona';
    name: string;
  } | null>(null);
  const [editingUserPersona, setEditingUserPersona] = useState<any | null>(null);
  const uTouchTimerRef = useRef<any>(null);
  const uIsHoldingRef = useRef<boolean>(false);
  const [showShareToast, setShowShareToast] = useState(false);

  // Edit Profile form state
  const profile = storageConfig.userProfile || {
    name: 'vsenrov',
    username: 'vsenrov',
    description: 'AI Companion enthusiast.',
    avatarGradient: 'from-purple-600 to-indigo-600',
  };
  const [editName, setEditName] = useState(profile.name || '');
  const [editUsername, setEditUsername] = useState(profile.username || '');
  const [editDesc, setEditDesc] = useState(profile.description || '');
  const [editAvatar, setEditAvatar] = useState(profile.avatar || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showEditProfile) {
      setEditName(profile.name || '');
      setEditUsername(profile.username || '');
      setEditDesc(profile.description || '');
      setEditAvatar(profile.avatar || '');
      setUsernameError(null);
    }
  }, [showEditProfile, profile]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCropSrc(event.target.result as string);
          setIsCropOpen(true);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleCropComplete = async (croppedBase64: string) => {
    try {
      const assetId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const dbRef = await storeAsset(assetId, croppedBase64);
      setEditAvatar(dbRef);
    } catch (e) {
      setEditAvatar(croppedBase64);
    }
    setIsCropOpen(false);
    setCropSrc(null);
  };

  const handleTriggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const validateUsername = (val: string): boolean => {
    if (val.length < 4) {
      setUsernameError('Username must be at least 4 characters long.');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) {
      setUsernameError('Letters, numbers, and underscores only — no spaces, emojis, or special characters.');
      return false;
    }
    setUsernameError(null);
    return true;
  };

  // Create Persona form state
  const [personaName, setPersonaName] = useState('');
  const [personaDesc, setPersonaDesc] = useState('');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUsername(editUsername.trim())) {
      return;
    }
    onUpdateConfig({
      userProfile: {
        ...profile,
        name: editName.trim() || 'vsenrov',
        username: editUsername.trim() || 'vsenrov',
        description: editDesc.trim(),
        avatar: editAvatar,
      }
    });
    setShowEditProfile(false);
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({ apiKey: apiKey.trim() });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddUserPersona = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaName.trim() || !personaDesc.trim()) return;

    const gradients = [
      'from-white/10 to-zinc-800/20 border-white/10 text-white/95',
      'from-zinc-900/40 to-zinc-950/60 border-zinc-800/40 text-zinc-300',
      'from-zinc-800/15 to-white/[0.03] border-white/10 text-white',
      'from-white/[0.04] to-zinc-900/30 border-white/5 text-zinc-400',
    ];
    const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];

    const newPersona: UserPersona = {
      id: `user-persona-${Date.now()}`,
      name: personaName.trim(),
      description: personaDesc.trim(),
      avatarGradient: randomGradient,
    };

    const currentPersonas = storageConfig.userPersonas || [];
    onUpdateConfig({
      userPersonas: [...currentPersonas, newPersona]
    });

    // Reset fields
    setPersonaName('');
    setPersonaDesc('');
    setShowCreatePersona(false);
  };

  const handleDeleteUserPersona = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = (storageConfig.userPersonas || []).find(p => p.id === id);
    setDeleteTarget({
      id,
      type: 'persona',
      name: target?.name || 'this Persona'
    });
  };

  const handleShareProfile = () => {
    navigator.clipboard.writeText(`https://vsen.ai/u/${profile.username}`);
    setShowShareToast(true);
    setTimeout(() => {
      setShowShareToast(false);
    }, 2000);
  };

  const handleDeleteCustomCharacter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = (storageConfig.characters || []).find(p => p.id === id);
    setDeleteTarget({
      id,
      type: 'character',
      name: target?.name || 'this Character'
    });
  };

  const handleDeleteWorld = (worldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = (storageConfig.worlds || []).find(w => w.id === worldId);
    setDeleteTarget({
      id: worldId,
      type: 'world',
      name: target?.name || 'this World'
    });
  };

  const confirmDeleteTarget = () => {
    if (!deleteTarget) return;
    const { id, type } = deleteTarget;

    if (type === 'character') {
      const currentCustom = storageConfig.customPersonas || [];
      const currentChars = storageConfig.characters || [];
      const currentHistories = storageConfig.chatHistories || [];
      onUpdateConfig({
        customPersonas: currentCustom.filter(p => p.id !== id),
        characters: currentChars.filter(p => p.id !== id),
        chatHistories: currentHistories.filter(h => h.personaId !== id)
      });
      triggerToast("Character Deleted!");
    } else if (type === 'world') {
      const currentWorlds = storageConfig.worlds || [];
      const currentHistories = storageConfig.chatHistories || [];
      const nextConfig: Partial<StorageConfig> = {
        worlds: currentWorlds.filter(w => w.id !== id),
        chatHistories: currentHistories.filter(h => h.linkedWorldId !== id && h.personaId !== `world-${id}`)
      };
      if (storageConfig.activeWorldId === id) {
        nextConfig.activeWorldId = '';
      }
      onUpdateConfig(nextConfig);
      triggerToast("World Deleted!");
    } else if (type === 'persona') {
      const currentPersonas = storageConfig.userPersonas || [];
      onUpdateConfig({
        userPersonas: currentPersonas.filter(p => p.id !== id)
      });
      triggerToast("Persona Deleted!");
    }

    setDeleteTarget(null);
  };

  // Lists
  const allCompanions = storageConfig.characters || [];
  const customCharacters = allCompanions.filter(p => p && p.isCustom);
  const userPersonas = storageConfig.userPersonas || [];
  const worlds = storageConfig.worlds || [];
  
  const likedCharacters = [
    ...PERSONAS,
    ...allCompanions
  ].filter(p => 
    p && p.id && (storageConfig.likedPersonaIds || []).includes(p.id)
  );

  const likedWorlds = worlds.filter(w => 
    w && w.id && (storageConfig.likedWorldIds || []).includes(w.id)
  );

  return (
    <div className={`flex-1 flex flex-col overflow-hidden select-none h-full relative ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}>
      
      {/* Premium Toast Feedback */}
      {showShareToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] px-3.5 py-2 bg-white text-black font-sans font-bold text-[10px] rounded-2xl shadow-xl border border-white/20 flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className={`w-3.5 h-3.5 ${isLight ? 'text-zinc-800' : 'text-zinc-900'}`} />
          <span>Profile link copied to clipboard</span>
        </div>
      )}
      
      {/* Settings Panel Overlay Drawer */}
      {showSettings && (
        <div className={`absolute inset-0 z-50 flex flex-col p-4 animate-fadeIn overflow-x-hidden max-w-full box-border ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5 mt-1 px-1">
            <h3 className={`text-sm font-extrabold ${isLight ? 'text-[#1C1C1E]' : 'text-white'} uppercase tracking-wider font-sans truncate pr-2`}>Settings</h3>
            <button 
              onClick={() => setShowSettings(false)}
              className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 cursor-pointer flex-shrink-0 ${
                isLight 
                  ? 'bg-black/[0.04] border border-black/[0.08] text-black/80' 
                  : 'bg-white/[0.04] border border-white/[0.08] text-white/80'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pb-12 scrollbar-none">
            {/* Cloud Persistence & Account Group */}
            <div className="space-y-3">
              <div className={`text-[10px] font-extrabold ${isLight ? 'text-black/55' : 'text-white/40'} uppercase tracking-widest px-1 flex items-center justify-between`}>
                <span className="flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  Cloud Sync & Account
                </span>
                <span className="flex items-center gap-1 text-[9px] lowercase font-normal">
                  <span className={`w-1.5 h-1.5 rounded-full ${syncState.status === 'error' ? 'bg-red-500' : syncState.status === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {syncState.status === 'syncing' ? 'syncing...' : syncState.status === 'error' ? 'sync error' : 'firestore active'}
                </span>
              </div>

              <div className={`rounded-2xl p-4 space-y-3 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                {syncState.isGoogleUser ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {syncState.userPhoto ? (
                          <img 
                            src={syncState.userPhoto} 
                            alt={syncState.userName || 'User'} 
                            className="w-10 h-10 rounded-xl object-cover border border-white/10"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                            {(syncState.userName || syncState.userEmail || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold truncate ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>
                            {syncState.userName || 'Google Account'}
                          </div>
                          <div className={`text-[10px] truncate ${isLight ? 'text-black/55' : 'text-white/40'}`}>
                            {syncState.userEmail}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleManualSync}
                          disabled={syncState.status === 'syncing'}
                          className={`p-2 rounded-xl border text-xs font-medium flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                            isLight 
                              ? 'bg-black/5 border-black/10 text-black hover:bg-black/10' 
                              : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                          }`}
                          title="Force Cloud Sync"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={handleSignOut}
                          className={`p-2 rounded-xl border text-xs font-medium flex items-center justify-center text-red-400 transition-all active:scale-95 cursor-pointer ${
                            isLight 
                              ? 'bg-red-50 border-red-200 hover:bg-red-100' 
                              : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20'
                          }`}
                          title="Sign Out"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className={`text-[10.5px] leading-relaxed p-2.5 rounded-xl border ${
                      isLight ? 'bg-emerald-50/60 border-emerald-200/60 text-emerald-900' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold mb-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Multi-Device Cloud Sync Active</span>
                      </div>
                      Your characters, worlds, chats, and uploaded media are permanently saved and will automatically load on Samsung, iPhone, Mac, and PC.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>
                          <span>Cloud Backup Active</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 font-medium">Session Sync</span>
                        </div>
                        <p className={`text-[10.5px] leading-relaxed mt-1 ${isLight ? 'text-black/55' : 'text-white/50'}`}>
                          Sign in with Google to permanently link your characters, worlds, chats, and uploaded pictures across all devices with zero data loss.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleGoogleLogin}
                        disabled={isLoggingIn}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 transition-all active:scale-98 shadow-sm cursor-pointer ${
                          isLight 
                            ? 'bg-[#1C1C1E] hover:bg-black text-white' 
                            : 'bg-white hover:bg-white/90 text-black shadow-[0_2px_10px_rgba(255,255,255,0.15)]'
                        }`}
                      >
                        {isLoggingIn ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                        )}
                        <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
                      </button>

                      <button
                        onClick={handleManualSync}
                        disabled={syncState.status === 'syncing'}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                          isLight 
                            ? 'bg-black/5 border-black/10 text-black hover:bg-black/10' 
                            : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                        }`}
                        title="Sync with Cloud"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncState.status === 'syncing' ? 'animate-spin text-accent' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI & Model Group */}
            <div className="space-y-3">
              <div className={`text-[10px] font-extrabold ${isLight ? 'text-black/55' : 'text-white/40'} uppercase tracking-widest px-1`}>AI & Model</div>
              
              {/* Provider Selector Row */}
              <div className={`flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-white'}`}>
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Model Provider</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Select your AI intelligence backend platform</div>
                  </div>
                </div>
                <select
                  value={apiProvider || 'gemini'}
                  onChange={(e) => {
                    const val = e.target.value as 'gemini' | 'openai';
                    setApiProvider(val);
                    onUpdateConfig({ apiProvider: val });
                  }}
                  className={`border text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-zinc-500 max-w-[150px] font-sans cursor-pointer ${isLight ? 'bg-white border-black/15 text-black' : 'bg-[#121214] border border-white/10 text-white'}`}
                >
                  <option value="gemini">Gemini API</option>
                  <option value="openai">OpenAI Compatible</option>
                </select>
              </div>

              {/* Active Model Selector Row */}
              <div className={`flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-white'}`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Active Model</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Select AI model for chat & roleplay</div>
                  </div>
                </div>
                <select
                  value={selectedModel || 'gemini-3.8-flash'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedModel(val);
                    onUpdateConfig({ selectedModel: val });
                  }}
                  className={`border text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-zinc-500 max-w-[200px] font-sans cursor-pointer ${isLight ? 'bg-white border-black/15 text-black' : 'bg-[#121214] border border-white/10 text-white'}`}
                >
                  <optgroup label="Active Gemini Models">
                    <option value="gemini-3.8-flash">Gemini 3.8 Flash (Recommended)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Fast)</option>
                    <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Reasoning)</option>
                    <option value="gemini-flash-latest">Gemini Flash Latest</option>
                  </optgroup>
                </select>
              </div>

              {/* API Keys Input Rows */}
              <div className={`rounded-2xl p-4 space-y-3 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-white'}`}>
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Chat API Keys</div>
                      <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Used for generating persona dialogue with automatic rotation</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {(apiKeys.length > 0 ? apiKeys : ['']).map((key, idx) => {
                    const isVisible = visibleKeys[`chat-${idx}`];
                    return (
                    <div key={idx} className="relative w-full">
                      <input
                        type={isVisible ? "text" : "password"}
                        value={key || ''}
                        onFocus={() => {
                          isEditingKeysRef.current = true;
                        }}
                        onBlur={() => {
                          isEditingKeysRef.current = false;
                          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                          commitApiKeys();
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newKeys = apiKeys.length > 0 ? [...apiKeys] : [''];
                          if (idx >= newKeys.length) newKeys.push(val);
                          else newKeys[idx] = val;
                          
                          setApiKeys(newKeys);
                          setApiKey(newKeys[0] || '');
                          scheduleAutoSave(newKeys, worldApiKey, useSameApiKey);
                        }}
                        placeholder={apiProvider === 'gemini' ? "AIzaSy..." : "sk-..."}
                        className={`w-full pl-3 pr-[80px] py-2 rounded-xl text-xs focus:outline-none focus:border-zinc-500 font-sans transition-all border ${isLight ? 'bg-white border-black/15 text-black placeholder:text-black/35' : 'bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20'}`}
                      />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                        <button
                          type="button"
                          onClick={() => setVisibleKeys(prev => ({ ...prev, [`chat-${idx}`]: !prev[`chat-${idx}`] }))}
                          className={`p-3 active:scale-90 transition-all cursor-pointer ${isLight ? 'text-black/40 hover:text-black/70' : 'text-white/40 hover:text-white/70'}`}
                        >
                          {isVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                        {(apiKeys.length > 1 || key) && (
                          <button
                            type="button"
                            onClick={() => {
                              const newKeys = apiKeys.length > 0 ? [...apiKeys] : [''];
                              newKeys.splice(idx, 1);
                              const finalKeys = newKeys.length > 0 ? newKeys : [''];
                              setApiKeys(finalKeys);
                              setApiKey(finalKeys[0] || '');
                              commitApiKeys(finalKeys, worldApiKey, useSameApiKey);
                            }}
                            className={`p-3 pr-4 active:scale-90 transition-all cursor-pointer ${isLight ? 'text-red-500/60 hover:text-red-500' : 'text-red-400/60 hover:text-red-400'}`}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )})}
                  
                  <button
                    type="button"
                    onClick={() => {
                      const newKeys = apiKeys.length > 0 ? [...apiKeys, ''] : ['', ''];
                      setApiKeys(newKeys);
                    }}
                    className={`flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider py-1.5 px-3 rounded-lg border transition-all ${
                      isLight 
                        ? 'border-black/10 text-black/60 hover:bg-black/5 hover:text-black' 
                        : 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/90'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    Add Another Key
                  </button>
                </div>

                <div className="flex items-center gap-2 px-1 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !useSameApiKey;
                      setUseSameApiKey(nextVal);
                      commitApiKeys(apiKeys, worldApiKey, nextVal);
                    }}
                    className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${useSameApiKey ? (isLight ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-white text-black') : (isLight ? 'border-black/20 bg-transparent' : 'border-white/20 bg-transparent')}`}
                  >
                    {useSameApiKey && <Check className="w-3 h-3" />}
                  </button>
                  <span className={`text-[10.5px] ${isLight ? 'text-black/60' : 'text-white/50'} font-sans select-none cursor-pointer leading-tight`} onClick={() => {
                    const nextVal = !useSameApiKey;
                    setUseSameApiKey(nextVal);
                    commitApiKeys(apiKeys, worldApiKey, nextVal);
                  }}>Use the same key for World Detection</span>
                </div>

                {!useSameApiKey && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:min-h-[44px] pt-1">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-white'}`}>
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>World Detection API Key</div>
                        <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Separate key for environmental vision</div>
                      </div>
                    </div>
                    <div className="relative w-full sm:max-w-[200px]">
                      <input
                        type={visibleKeys['world'] ? "text" : "password"}
                        value={worldApiKey || ''}
                        onFocus={() => {
                          isEditingKeysRef.current = true;
                        }}
                        onBlur={() => {
                          isEditingKeysRef.current = false;
                          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                          commitApiKeys(apiKeys, worldApiKey, false);
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWorldApiKey(val);
                          scheduleAutoSave(apiKeys, val, false);
                        }}
                        placeholder="API Key..."
                        className={`w-full pl-3 pr-10 py-2 rounded-xl text-xs focus:outline-none focus:border-zinc-500 font-sans transition-all border ${isLight ? 'bg-white border-black/15 text-black placeholder:text-black/35' : 'bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setVisibleKeys(prev => ({ ...prev, world: !prev.world }))}
                        className={`absolute right-0 top-1/2 -translate-y-1/2 p-3 active:scale-90 transition-all cursor-pointer ${isLight ? 'text-black/40 hover:text-black/70' : 'text-white/40 hover:text-white/70'}`}
                      >
                        {visibleKeys['world'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Save Keys and Test Connection Buttons Row */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                      const trimmedKeys = apiKeys.map(k => k.trim());
                      setApiKeys(trimmedKeys);
                      setApiKey(trimmedKeys[0] || '');
                      commitApiKeys(trimmedKeys, worldApiKey, useSameApiKey);
                      
                      setIsSaved(true);
                      setTimeout(() => setIsSaved(false), 3000);
                    }}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 font-sans ${
                      isLight
                        ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-900 shadow-[0_0_6px_rgba(0,0,0,0.04)] hover:shadow-[0_0_10px_rgba(0,0,0,0.08)]'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/90 shadow-[0_0_8px_rgba(255,255,255,0.05)] hover:shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5 animate-bounce" />
                        <span>Saved Successfully!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save API Keys</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing'}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 font-sans ${
                      isLight 
                        ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-900 shadow-[0_0_6px_rgba(0,0,0,0.04)] hover:shadow-[0_0_10px_rgba(0,0,0,0.08)]' 
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/90 shadow-[0_0_8px_rgba(255,255,255,0.05)] hover:shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                    }`}
                  >
                    {testStatus === 'testing' ? (
                      <>
                        <span className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${isLight ? 'border-zinc-800' : 'border-white'}`} />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Activity className={`w-3.5 h-3.5 ${isLight ? 'text-zinc-800' : 'text-white'}`} />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {testStatus === 'success' && (
                    <div className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-sans font-bold px-2.5 py-2 rounded-xl border ${
                      isLight 
                        ? 'bg-zinc-100 border-zinc-200 text-zinc-900' 
                        : 'bg-white/[0.04] border-white/10 text-white/90'
                    }`}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Connection Verified Successfully</span>
                    </div>
                  )}
                  {testStatus === 'error' && (
                    <div className="flex-1 flex items-center justify-center gap-1 text-rose-400 text-[10px] font-sans font-bold bg-rose-500/10 px-2.5 py-1.5 rounded-xl border border-rose-500/20" title={testError || 'Error'}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[280px]">{testError || 'Verification failed'}</span>
                    </div>
                  )}
                </div>
                {testStatus === 'error' && testError && (
                  <div className="text-[9.5px] text-rose-400/80 bg-rose-500/[0.02] border border-rose-500/10 p-2 rounded-lg font-mono leading-relaxed">
                    {testError}
                  </div>
                )}

                {/* Memory Level Section */}
                <div className="space-y-2 pt-3.5 border-t border-white/[0.05] mt-3.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${isLight ? 'text-black/70' : 'text-white/70'}`}>Memory Level</span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${isLight ? 'bg-black/[0.03] border border-black/5 text-zinc-700 font-bold' : 'bg-white/[0.04] border border-white/[0.06] text-white/60 font-bold'}`}>
                      {samplerMaxContext <= 4096 ? "Lower (4k)" : samplerMaxContext > 20000 ? "Higher (32k)" : "Regular (16k)"}
                    </span>
                  </div>
                  
                  <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl border ${isLight ? 'bg-black/[0.02] border-black/[0.05]' : 'bg-black/40 border-white/[0.05]'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSamplerMaxContext(4096);
                        onUpdateConfig({ samplerMaxContext: 4096 });
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-150 ${
                        samplerMaxContext <= 4096
                          ? (isLight ? 'bg-zinc-900 text-white shadow' : 'bg-white text-black font-extrabold')
                          : (isLight ? 'text-black/50 hover:text-black hover:bg-black/5' : 'text-white/40 hover:text-white hover:bg-white/5')
                      }`}
                    >
                      Lower
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSamplerMaxContext(16384);
                        onUpdateConfig({ samplerMaxContext: 16384 });
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-150 ${
                        samplerMaxContext > 4096 && samplerMaxContext <= 20000
                          ? (isLight ? 'bg-zinc-900 text-white shadow' : 'bg-white text-black font-extrabold')
                          : (isLight ? 'text-black/50 hover:text-black hover:bg-black/5' : 'text-white/40 hover:text-white hover:bg-white/5')
                      }`}
                    >
                      Regular
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSamplerMaxContext(32768);
                        onUpdateConfig({ samplerMaxContext: 32768 });
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-150 ${
                        samplerMaxContext > 20000
                          ? (isLight ? 'bg-zinc-900 text-white shadow' : 'bg-white text-black font-extrabold')
                          : (isLight ? 'text-black/50 hover:text-black hover:bg-black/5' : 'text-white/40 hover:text-white hover:bg-white/5')
                      }`}
                    >
                      Higher
                    </button>
                  </div>
                  
                  <p className={`text-[9.5px] leading-relaxed font-sans px-1 ${isLight ? 'text-black/55' : 'text-white/40'}`}>
                    {samplerMaxContext <= 4096 
                      ? "⚡ Uses minimal context window. Saves quota usage and speeds up responses, but forgets older chat messages sooner."
                      : samplerMaxContext > 20000
                        ? "🔮 Max context memory. Best for long-form immersive roleplay and multi-character continuity, but consumes more quota."
                        : "⚖️ Balanced memory depth. Normal context preservation and standard performance."
                    }
                  </p>
                </div>

                {/* Response Length Section */}
                <div className="space-y-2 pt-3.5 border-t border-white/[0.05] mt-3.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${isLight ? 'text-black/70' : 'text-white/70'}`}>Response Length</span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${isLight ? 'bg-black/[0.03] border border-black/5 text-zinc-700 font-bold' : 'bg-white/[0.04] border border-white/[0.06] text-white/60 font-bold'}`}>
                      {samplerGeneratedTokens <= 256 ? "Shorter (256)" : samplerGeneratedTokens > 1024 ? "Longer (2048)" : "Regular (1024)"}
                    </span>
                  </div>
                  
                  <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl border ${isLight ? 'bg-black/[0.02] border-black/[0.05]' : 'bg-black/40 border-white/[0.05]'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSamplerGeneratedTokens(256);
                        onUpdateConfig({ samplerGeneratedTokens: 256 });
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-150 ${
                        samplerGeneratedTokens <= 256
                          ? (isLight ? 'bg-zinc-900 text-white shadow' : 'bg-white text-black font-extrabold')
                          : (isLight ? 'text-black/50 hover:text-black hover:bg-black/5' : 'text-white/40 hover:text-white hover:bg-white/5')
                      }`}
                    >
                      Shorter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSamplerGeneratedTokens(1024);
                        onUpdateConfig({ samplerGeneratedTokens: 1024 });
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-150 ${
                        samplerGeneratedTokens > 256 && samplerGeneratedTokens <= 1024
                          ? (isLight ? 'bg-zinc-900 text-white shadow' : 'bg-white text-black font-extrabold')
                          : (isLight ? 'text-black/50 hover:text-black hover:bg-black/5' : 'text-white/40 hover:text-white hover:bg-white/5')
                      }`}
                    >
                      Regular
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSamplerGeneratedTokens(2048);
                        onUpdateConfig({ samplerGeneratedTokens: 2048 });
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-150 ${
                        samplerGeneratedTokens > 1024
                          ? (isLight ? 'bg-zinc-900 text-white shadow' : 'bg-white text-black font-extrabold')
                          : (isLight ? 'text-black/50 hover:text-black hover:bg-black/5' : 'text-white/40 hover:text-white hover:bg-white/5')
                      }`}
                    >
                      Longer
                    </button>
                  </div>
                  
                  <p className={`text-[9.5px] leading-relaxed font-sans px-1 ${isLight ? 'text-black/55' : 'text-white/40'}`}>
                    {samplerGeneratedTokens <= 256 
                      ? "⚡ Forces rapid, brief, and concise dialogue. Ideal for fast chat style replies and free tiers."
                      : samplerGeneratedTokens > 1024
                        ? "🎬 Unlocks multi-paragraph, rich and highly-detailed descriptive storytelling with prose depth."
                        : "⚖️ Standard reply length. Natural balance of speech dialogue and description actions."
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Appearance Group */}
            <div className="space-y-3">
              <div className={`text-[10px] font-extrabold ${isLight ? 'text-black/55' : 'text-white/40'} uppercase tracking-widest px-1`}>Appearance</div>
              
              {/* Theme Toggle Row */}
              <div className={`flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-white'}`}>
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Visual Color Theme</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Choose Dark Mode or Light Mode layouts</div>
                  </div>
                </div>
                <div className={`flex rounded-xl p-0.5 border ${isLight ? 'bg-black/[0.03] border-black/[0.05]' : 'bg-black/40 border border-white/5'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      onUpdateConfig({ theme: 'dark' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                      theme === 'dark' ? (isLight ? 'bg-zinc-900 text-white shadow' : 'bg-white text-black font-extrabold') : (isLight ? 'text-black/45 hover:text-black/70' : 'text-white/40 hover:text-white/60')
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('light');
                      onUpdateConfig({ theme: 'light' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                      theme === 'light' ? (isLight ? 'bg-zinc-900 text-white shadow' : 'bg-white text-black font-extrabold') : (isLight ? 'text-black/45 hover:text-black/70' : 'text-white/40 hover:text-white/60')
                    }`}
                  >
                    Light
                  </button>
                </div>
              </div>

              {/* Message Text Size Slider Row */}
              <div className={`rounded-2xl p-4 space-y-2 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex items-center justify-between gap-3 min-h-[28px]">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-accent'}`}>
                      <Type className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Message Font Size</div>
                      <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Adjust text readability in chat dialogues</div>
                    </div>
                  </div>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-lg border ${isLight ? 'text-black/60 bg-black/[0.02] border-black/[0.08]' : 'text-white/60 bg-white/[0.03] border-white/[0.08]'}`}>{messageTextSize}px</span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <span className={`text-[10px] font-bold ${isLight ? 'text-black/25' : 'text-white/20'}`}>A</span>
                  <input
                    type="range"
                    min={11}
                    max={20}
                    step={1}
                    value={messageTextSize ?? 13}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMessageTextSize(val);
                      onUpdateConfig({ messageTextSize: val });
                    }}
                    className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer ${isLight ? 'bg-black/10 accent-zinc-800' : 'bg-white/10 accent-accent'}`}
                  />
                  <span className={`text-sm font-bold ${isLight ? 'text-black/45' : 'text-white/40'}`}>A</span>
                </div>
              </div>
            </div>

            {/* Chat Behavior Group */}
            <div className="space-y-3">
              <div className={`text-[10px] font-extrabold ${isLight ? 'text-black/55' : 'text-white/40'} uppercase tracking-widest px-1`}>Chat Behavior</div>
              
              {/* Haptic Feedback Row */}
              <div className={`flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-accent'}`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Haptic Feedback</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Vibrate on button taps and selection holds</div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const nextVal = !isHapticEnabled;
                    setIsHapticEnabled(nextVal);
                    onUpdateConfig({ isHapticEnabled: nextVal });
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                      navigator.vibrate(12);
                    }
                  }}
                  className={`w-10 h-6 rounded-full p-0.5 border transition-all duration-200 cursor-pointer flex items-center ${
                    isHapticEnabled ? (isLight ? 'bg-zinc-800 border-zinc-800' : 'bg-accent border-accent') : (isLight ? 'bg-black/[0.06] border-black/10' : 'bg-black border-white/15')
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full shadow-md transition-all duration-200 ease-in-out ${
                    isHapticEnabled ? 'translate-x-4 bg-white shadow-sm' : `translate-x-0 ${isLight ? 'bg-white shadow' : 'bg-white/40'}`
                  }`} />
                </button>
              </div>

              {/* Performance Mode Row */}
              <div className={`flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-accent'}`}>
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Performance Mode (Ultra Fast)</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Disable heavy blur filters for ultra-smooth typing on low-end phones</div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const nextVal = !isPerformanceMode;
                    setIsPerformanceMode(nextVal);
                    onUpdateConfig({ isPerformanceMode: nextVal });
                  }}
                  className={`w-10 h-6 rounded-full p-0.5 border transition-all duration-200 cursor-pointer flex items-center ${
                    isPerformanceMode ? (isLight ? 'bg-zinc-800 border-zinc-800' : 'bg-accent border-accent') : (isLight ? 'bg-black/[0.06] border-black/10' : 'bg-black border-white/15')
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full shadow-md transition-all duration-200 ease-in-out ${
                    isPerformanceMode ? 'translate-x-4 bg-white shadow-sm' : `translate-x-0 ${isLight ? 'bg-white shadow' : 'bg-white/40'}`
                  }`} />
                </button>
              </div>

              {/* Suggested Auto-Replies Row */}
              <div className={`flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-accent'}`}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Suggested Auto-Replies</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Offer context-aware swift replies in chat view</div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const nextVal = !isRepliesEnabled;
                    setIsRepliesEnabled(nextVal);
                    onUpdateConfig({ isRepliesEnabled: nextVal });
                  }}
                  className={`w-10 h-6 rounded-full p-0.5 border transition-all duration-200 cursor-pointer flex items-center ${
                    isRepliesEnabled ? (isLight ? 'bg-zinc-800 border-zinc-800' : 'bg-accent border-accent') : (isLight ? 'bg-black/[0.06] border-black/10' : 'bg-black border-white/15')
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full shadow-md transition-all duration-200 ease-in-out ${
                    isRepliesEnabled ? 'translate-x-4 bg-white shadow-sm' : `translate-x-0 ${isLight ? 'bg-white shadow' : 'bg-white/40'}`
                  }`} />
                </button>
              </div>

              {/* Streaming Responses Row */}
              <div className={`flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-accent'}`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Streaming Responses</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Stream replies character-by-character live</div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const nextVal = !samplerIsStreaming;
                    setSamplerIsStreaming(nextVal);
                    onUpdateConfig({ samplerIsStreaming: nextVal });
                  }}
                  className={`w-10 h-6 rounded-full p-0.5 border transition-all duration-200 cursor-pointer flex items-center ${
                    samplerIsStreaming ? (isLight ? 'bg-zinc-800 border-zinc-800' : 'bg-accent border-accent') : (isLight ? 'bg-black/[0.06] border-black/10' : 'bg-black border-white/15')
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full shadow-md transition-all duration-200 ease-in-out ${
                    samplerIsStreaming ? 'translate-x-4 bg-white shadow-sm' : `translate-x-0 ${isLight ? 'bg-white shadow' : 'bg-white/40'}`
                  }`} />
                </button>
              </div>
            </div>

            {/* Data & Privacy Group */}
            <div className="space-y-3">
              <div className={`text-[10px] font-extrabold ${isLight ? 'text-black/55' : 'text-white/40'} uppercase tracking-widest px-1`}>Data & Privacy</div>
              
              {/* Clear All Chat History Row */}
              <button
                type="button"
                onClick={() => setShowClearHistoryConfirm(true)}
                className="w-full text-left flex items-center justify-between gap-3 min-h-[64px] py-2 bg-red-500/[0.02] hover:bg-red-500/[0.04] border border-red-500/10 rounded-2xl px-4 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-red-400">Clear All Chat History</div>
                    <div className="text-[10px] text-red-400/50 leading-relaxed font-sans block break-words font-sans">Permanently wipe all past messaging dialogues</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400/30 flex-shrink-0" />
              </button>

              {/* Export My Data Row */}
              <button
                type="button"
                onClick={handleExportData}
                className={`w-full text-left flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 transition-all cursor-pointer active:scale-98 border ${isLight ? 'bg-white hover:bg-black/[0.02] border-black/[0.08] shadow-sm' : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.04]'}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-black/[0.03] border-black/[0.08] text-black/60' : 'bg-white/[0.03] border-white/[0.08] text-white/60'}`}>
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Export My Data</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Download configuration & companion backup as JSON</div>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-black/30' : 'text-white/30'}`} />
              </button>
            </div>

            {/* About Group */}
            <div className="space-y-3">
              <div className={`text-[10px] font-extrabold ${isLight ? 'text-black/55' : 'text-white/40'} uppercase tracking-widest px-1`}>About</div>
              
              {/* App Version Row */}
              <div className={`flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 border transition-all ${isLight ? 'bg-white border-black/[0.08] shadow-sm' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-accent'}`}>
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>App Version</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Production simulation firmware build</div>
                  </div>
                </div>
                <span className={`text-[10px] font-mono px-2.5 py-1.5 rounded-lg border ${isLight ? 'text-black/50 bg-black/[0.02] border-black/[0.08]' : 'text-white/50 bg-white/[0.04] border-white/[0.08]'}`}>v1.2.0-Prod</span>
              </div>

              {/* Send Feedback Row */}
              <a
                href="mailto:feedback@vsen.ai?subject=Vsen.Ai%20Feedback"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between gap-3 min-h-[64px] py-2 rounded-2xl px-4 transition-all cursor-pointer border ${isLight ? 'bg-white hover:bg-black/[0.02] border-black/[0.08] shadow-sm' : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.04]'}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isLight ? 'bg-zinc-800/10 border-zinc-800/15 text-zinc-800' : 'bg-white/[0.03] border-white/[0.08] text-accent'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>Send Feedback</div>
                    <div className={`text-[10px] leading-relaxed font-sans block break-words ${isLight ? 'text-black/55' : 'text-white/40'}`}>Reach out to request features or report bugs</div>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-black/30' : 'text-white/30'}`} />
              </a>
            </div>

            {/* Section 5: DEVELOPER CONTROLS */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-white/45 uppercase tracking-widest px-1">Developer Controls</div>
              <div className="bg-[#1E1E1E]/40 backdrop-blur-lg rounded-2xl p-2 border border-white/[0.04] space-y-2">
                {/* Kotlin Codebase */}
                <button
                  onClick={onOpenCodeViewer}
                  className="w-full p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] text-white flex items-center justify-between gap-3 transition-all active:scale-[0.96] cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-[#E0E0E0]" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">Kotlin Codebase</div>
                      <div className="text-[10px] text-white/40 font-sans">Show classes and layout specifications</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30" />
                </button>

                {/* Reset Database option */}
                <button
                  onClick={() => {
                    if (confirm("Reset Vsen.Ai? This will wipe all chat logs, custom personas, and settings permanently.")) {
                      onResetApp();
                    }
                  }}
                  className="w-full p-4 rounded-2xl bg-red-500/[0.02] hover:bg-red-500/[0.06] border border-red-500/10 hover:border-red-500/20 text-red-400 flex items-center justify-between gap-3 transition-all active:scale-[0.96] cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-xs text-red-400">Reset Application Database</div>
                      <div className="text-[10px] text-red-400/50 font-sans">Wipe all session histories and custom characters</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-400/30" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat History Confirmation Dialog */}
      <AnimatePresence>
        {showClearHistoryConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearHistoryConfirm(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative w-full max-w-[290px] bg-[#161618] border border-white/[0.08] rounded-3xl p-6 shadow-2xl z-10 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto mb-4">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-2">Wipe All Chat Histories?</h3>
              <p className="text-[11px] text-[#888] leading-relaxed mb-5 font-sans">
                Are you sure you want to clear <span className="text-white font-bold">ALL</span> past conversations with all characters? This action is absolute and cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearHistoryConfirm(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-white/80 font-bold text-[10.5px] hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearAllChatHistory}
                  className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10.5px] active:scale-95 transition-all cursor-pointer font-sans"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom dynamic Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -25, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.9 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[250] px-3.5 py-1.5 font-sans font-medium text-[11px] rounded-xl shadow-lg border border-white/15 bg-black/70 backdrop-blur-xl text-white flex items-center gap-2 max-w-[90vw]"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Panel Overlay Drawer */}
      {showEditProfile && (
        <div className="absolute inset-0 bg-[#121214] z-50 flex flex-col p-5 animate-slideIn">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Edit Profile</h3>
            <button 
              onClick={() => setShowEditProfile(false)}
              className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/80 active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveProfile} className="flex-1 flex flex-col justify-between">
            <div className="space-y-5">
              {/* Profile Pic Silhouette */}
              <div className="flex flex-col items-center justify-center py-4">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleAvatarChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={handleTriggerFileSelect}
                  className="w-20 h-20 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-white relative overflow-hidden active:scale-95 transition-transform cursor-pointer"
                >
                  {editAvatar ? (
                    <SafeImage 
                      src={editAvatar} 
                      alt="Avatar Preview" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${profile.avatarGradient || 'from-purple-600 to-indigo-600'} flex items-center justify-center`}>
                      <span className="text-white font-bold text-2xl font-sans">
                        {editName.charAt(0).toUpperCase() || 'V'}
                      </span>
                    </div>
                  )}
                </button>
                <div className="flex items-center gap-2 mt-2">
                  <button 
                    type="button"
                    onClick={handleTriggerFileSelect}
                    className="text-[10px] text-accent font-sans font-semibold hover:underline cursor-pointer"
                  >
                    Change Avatar
                  </button>
                  {editAvatar && (
                    <>
                      <span className="text-[10px] text-white/20">•</span>
                      <button 
                        type="button"
                        onClick={() => setEditAvatar('')}
                        className="text-[10px] text-red-400 font-sans font-semibold hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[9px] font-sans font-light uppercase tracking-widest text-[#888] block mb-1.5 px-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName || ''}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-white focus:outline-none font-sans font-normal tracking-wide"
                />
              </div>

              <div>
                <label className="text-[9px] font-sans font-light uppercase tracking-widest text-[#888] block mb-1.5 px-1">Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white/30 font-sans">@</span>
                  <input
                    type="text"
                    required
                    value={editUsername || ''}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/\s+/g, '');
                      setEditUsername(cleanVal);
                      validateUsername(cleanVal);
                    }}
                    className={`w-full pl-8 pr-4 py-3.5 rounded-xl bg-white/[0.03] border text-xs text-white focus:outline-none font-sans font-normal tracking-wide transition-colors ${
                      usernameError ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-accent/50'
                    }`}
                  />
                </div>
                {usernameError && (
                  <p className="text-[10px] text-red-400 mt-1.5 px-1 font-sans flex items-start gap-1 leading-normal animate-scaleIn">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-red-400 flex-shrink-0" />
                    <span>{usernameError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-[9px] font-sans font-light uppercase tracking-widest text-[#888] block mb-1.5 px-1">Short Biography</label>
                <textarea
                  rows={3}
                  value={editDesc || ''}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="I love chatting with AI characters!"
                  className="w-full p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-white placeholder:text-[#444] placeholder:font-light focus:outline-none resize-none font-sans font-normal tracking-wide leading-relaxed"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-accent hover:bg-accent/90 text-white font-bold text-xs tracking-tight shadow-[0_4px_12px_rgba(124,92,252,0.3)] transition-all active:scale-[0.95] mb-4 font-sans border-none cursor-pointer"
            >
              Save Profile Changes
            </button>
          </form>

          {isCropOpen && cropSrc && (
            <ImageCropModal
              isOpen={isCropOpen}
              imageSrc={cropSrc}
              isLight={isLight}
              circular={true}
              title="Adjust Profile Picture"
              onClose={() => {
                setIsCropOpen(false);
                setCropSrc(null);
              }}
              onCrop={handleCropComplete}
            />
          )}
        </div>
      )}      {/* Create Persona Modal Overlay */}
      <AnimatePresence>
        {showCreatePersona && (
          <UserPersonaCreator
            isLight={isLight}
            initialData={editingUserPersona}
            onClose={() => {
              setShowCreatePersona(false);
              setEditingUserPersona(null);
            }}
            onSave={(newPersona) => {
              const currentPersonas = storageConfig.userPersonas || [];
              let updatedPersonas = [...currentPersonas];
              const existingIdx = updatedPersonas.findIndex(p => p.id === newPersona.id);
              if (existingIdx >= 0) {
                updatedPersonas[existingIdx] = newPersona;
              } else {
                updatedPersonas.push(newPersona);
              }
              
              if (newPersona.isDefault) {
                updatedPersonas = updatedPersonas.map(p => ({
                  ...p,
                  isDefault: p.id === newPersona.id
                }));
                onUpdateConfig({ 
                  userPersonas: updatedPersonas,
                  activeUserPersonaId: newPersona.id 
                });
              } else {
                onUpdateConfig({ userPersonas: updatedPersonas });
              }
              setShowCreatePersona(false);
              setEditingUserPersona(null);
            }}
          />
        )}

      </AnimatePresence>

      {/* Main Top Profile Content Area (Non-Scrollable Top Profile Header) */}
      <div className={`flex-none px-5 pt-5 pb-1 z-10 flex flex-col gap-3.5 ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'}`}>
        {/* Top Header Row matching My Chats */}
        <div className="flex items-center justify-between font-sans">
          <div className="flex flex-col">
            <h2 className={`text-2xl font-extrabold tracking-tight font-sans ${isLight ? 'text-black' : 'text-white'}`}>My Profile</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic();
                setShowSettings(true);
              }}
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all duration-300 active:scale-95 cursor-pointer text-[10px] font-bold ${
                syncState.isGoogleUser
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : isLight
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-blue-500/10 border-blue-500/25 text-blue-400'
              }`}
              title="Cloud Persistence Status"
            >
              <Cloud className={`w-3.5 h-3.5 ${syncState.status === 'syncing' ? 'animate-pulse' : ''}`} />
              <span>{syncState.isGoogleUser ? 'Cloud Synced' : 'Sync Account'}</span>
            </button>
            <OrbBadge
              orbs={storageConfig.orbs !== undefined ? storageConfig.orbs : 50}
              accountCreatedAt={storageConfig.accountCreatedAt}
              onClick={() => setShowOrbWallet(true)}
            />
            <button 
              onClick={() => {
                triggerHaptic();
                setShowSettings(true);
              }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer ${
                isLight 
                  ? 'bg-black/5 border-black/10 text-black hover:bg-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                  : 'bg-accent/10 border-accent/25 text-white shadow-[0_2px_10px_rgba(170,170,170,0.15)] hover:bg-accent/20 hover:border-accent/40 hover:shadow-[0_4px_20px_rgba(170,170,170,0.22)]'
              }`}
              title="Settings"
            >
              <Settings className="w-4.5 h-4.5 text-accent" />
            </button>
          </div>
        </div>

        {/* Profile Card View - Avatar on Left, Names and Bio on Right */}
        <div className="flex flex-col gap-3 mt-0.5">
          {/* Avatar + Names Row */}
          <div className="flex items-start gap-4 text-left">
            {/* Squircular avatar - bigger and elegant */}
            <div className={`w-20 h-20 rounded-3xl bg-[#1A1A1A] border flex-shrink-0 flex items-center justify-center shadow-xl relative overflow-hidden active:scale-95 transition-transform duration-200 ${
              isLight ? 'border-black/10' : 'border-white/[0.08]'
            }`}>
              {profile.avatar ? (
                <SafeImage 
                  src={profile.avatar} 
                  alt={profile.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${profile.avatarGradient || 'from-purple-600 to-indigo-600'} flex items-center justify-center`}>
                  <span className="text-white font-bold text-2xl font-sans">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Headers + Bio Next to Avatar */}
            <div className="flex-1 min-w-0 flex flex-col justify-start pt-0.5">
              <h3 className={`text-base font-extrabold tracking-tight leading-tight font-sans ${isLight ? 'text-[#1C1C1E]' : 'text-white'}`}>
                {profile.name}
              </h3>
              <p className={`text-[10.5px] mt-0.5 font-medium font-sans ${isLight ? 'text-black/45' : 'text-white/40'} tracking-wide`}>
                @{profile.username}
              </p>
              <p className={`text-[11px] leading-relaxed font-sans font-normal tracking-wide mt-1.5 line-clamp-2 ${
                isLight ? 'text-black/60' : 'text-zinc-300/80'
              }`}>
                {profile.description || "No biography provided yet."}
              </p>
            </div>
          </div>

          {/* Button actions bar - Compact Glowy Style */}
          <div className="flex items-center gap-3 mt-1 w-full">
            <button
              onClick={() => {
                triggerHaptic();
                setEditName(profile.name || '');
                setEditUsername(profile.username || '');
                setEditDesc(profile.description || '');
                setShowEditProfile(true);
              }}
              className={`flex-1 py-2 rounded-xl border text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                isLight 
                  ? 'bg-black/5 border-black/10 text-black/55 hover:text-black/85 hover:bg-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                  : 'bg-white/[0.04] border-white/[0.08] text-white/45 hover:text-white/80 hover:bg-white/[0.08] hover:border-white/15'
              }`}
            >
              <Pencil className={`w-3 h-3 ${isLight ? 'text-black/55' : 'text-white/45'}`} />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={() => {
                triggerHaptic();
                handleShareProfile();
              }}
              className={`flex-1 py-2 rounded-xl border text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                isLight 
                  ? 'bg-black/5 border-black/10 text-black/55 hover:text-black/85 hover:bg-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                  : 'bg-white/[0.04] border-white/[0.08] text-white/45 hover:text-white/80 hover:bg-white/[0.08] hover:border-white/15'
              }`}
            >
              <Share2 className={`w-3 h-3 ${isLight ? 'text-black/55' : 'text-white/45'}`} />
              <span>Share Profile</span>
            </button>
          </div>
        </div>

        {/* Borderless Glowy Sub-tabs Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-3.5 px-5 -mx-5 scrollbar-none">
          {[
            { id: 'characters', label: 'Characters', icon: User },
            { id: 'worlds', label: 'Worlds', icon: Globe },
            { id: 'personas', label: 'Personas', icon: FileText },
            { id: 'liked', label: 'Liked', icon: Heart },
          ].map((tab) => {
            const isActive = activeSubTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic();
                  setActiveSubTab(tab.id as ProfileTabType | 'worlds');
                }}
                className="relative py-2 px-3.5 text-[10px] font-extrabold tracking-widest whitespace-nowrap transition-all duration-300 flex-shrink-0 active:scale-95 cursor-pointer uppercase font-sans flex items-center gap-1.5"
              >
                <Icon className={`w-3.5 h-3.5 relative z-10 ${
                  isActive 
                    ? isLight 
                      ? 'text-black stroke-[2.5]' 
                      : 'text-accent stroke-[2.5]' 
                    : isLight 
                      ? 'text-black/50 hover:text-black/80' 
                      : 'text-white/45 hover:text-white/85'
                } ${isActive && tab.id === 'liked' ? 'fill-current' : ''}`} />
                
                <span className={`transition-all duration-300 relative z-10 ${
                  isActive 
                    ? isLight 
                      ? 'text-black font-extrabold scale-105' 
                      : 'text-accent scale-105 drop-shadow-[0_0_8px_rgba(170,170,170,0.3)]'
                    : isLight 
                      ? 'text-black/55 hover:text-black/85' 
                      : 'text-white/45 hover:text-white/80'
                }`}>
                  {tab.label}
                </span>
                
                {/* Visual filled pill accent highlight */}
                {isActive && (
                  <motion.div 
                    layoutId="activeProfileTabPill"
                    className={`absolute inset-0 rounded-xl -z-0 border ${
                      isLight 
                        ? 'bg-black/5 border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)]' 
                        : 'bg-accent/10 border-accent/25 shadow-[0_2px_10px_rgba(170,170,170,0.15)]'
                    }`}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Bottom List Area - Scrollable Container */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Soft elegant top fade glow to bridge the transition area */}
        <div className={`absolute -top-1 inset-x-0 h-2 pointer-events-none z-20 ${
          isLight 
            ? 'bg-gradient-to-b from-[#F8F9FA] to-transparent' 
            : 'bg-gradient-to-b from-[#121214] to-transparent'
        }`} />
        
        {/* Scrollable list content */}
        <div className={`flex-1 overflow-y-auto px-5 pb-28 pt-2 relative scrollbar-none ${
          isLight ? 'bg-[#F8F9FA]' : 'bg-[#121214]'
        }`}>
        
        {/* Tab 4: Worlds */}
        {activeSubTab === 'worlds' && (
          <div className="space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-sans font-bold ${isLight ? 'text-black/50' : 'text-white/40'} uppercase tracking-wider`}>My Worlds</span>
              {worlds.length > 0 && onOpenWorldCreator && (
                <button
                  onClick={onOpenWorldCreator}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wide transition-all duration-150 active:scale-95 shadow-sm border ${
                    isLight 
                      ? 'bg-black/5 border-black/10 text-black hover:bg-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                      : 'bg-accent/10 border-accent/25 text-white shadow-[0_2px_10px_rgba(170,170,170,0.15)] hover:bg-accent/20 hover:border-accent/40 hover:shadow-[0_4px_20px_rgba(170,170,170,0.22)]'
                  }`}
                >
                  <Plus className={`w-3 h-3 ${isLight ? 'text-black/60' : 'text-accent font-bold stroke-[3.5]'}`} />
                  <span>Create</span>
                </button>
              )}
            </div>

            {worlds.length === 0 ? (
              <div className={`text-center py-12 border rounded-[28px] p-6 shadow-inner animate-fadeIn ${isLight ? 'bg-black/[0.01] border-black/[0.04]' : 'bg-white/[0.01] border-white/[0.04]'}`}>
                <Globe className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-black/10' : 'text-white/10'}`} />
                <h4 className={`text-sm font-bold font-sans ${isLight ? 'text-black' : 'text-white'}`}>No Worlds Created</h4>
                <p className={`text-[11px] max-w-[200px] mx-auto mt-2 leading-relaxed font-sans font-light ${isLight ? 'text-black/45' : 'text-white/45'}`}>
                  Design custom environments and settings for your chat scenarios.
                </p>
                {onOpenWorldCreator && (
                  <button
                    onClick={onOpenWorldCreator}
                    className={`mt-5 px-5 py-2.5 text-xs font-bold rounded-xl transition-all active:scale-95 duration-150 font-sans ${
                      isLight 
                        ? 'bg-zinc-800 text-white hover:bg-zinc-900 shadow-md' 
                        : 'bg-white hover:bg-white/90 text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]'
                    }`}
                  >
                    Create World
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {worlds.map((world) => {
                  return (
                    <div 
                      key={world.id} 
                      onClick={() => onNavigateToWorldProfile?.(world.id)}
                      className="flex flex-col cursor-pointer group active:scale-[0.98] transition-all duration-300 relative animate-fadeIn"
                    >
                      {/* Visual container with border & shadow */}
                      <div className={`relative w-full aspect-[3/4.4] rounded-[28px] overflow-hidden border transition-all duration-300 ${
                        isLight 
                          ? 'bg-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] border-black/[0.04]' 
                          : 'bg-[#121214] border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.8),_0_0_12px_rgba(255,255,255,0.06)] hover:shadow-[0_12px_24px_rgba(0,0,0,1),_0_0_20px_rgba(255,255,255,0.12)] hover:border-white/20'
                      }`}>
                        {/* Cover Image */}
                        {world.coverImage ? (
                          <SafeImage 
                            src={world.coverImage} 
                            referrerPolicy="no-referrer" 
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
                            alt={world.name} 
                          />
                        ) : (
                          <div className="absolute inset-0 w-full h-full">
                            <div className={`absolute inset-0 bg-gradient-to-br from-indigo-900/60 to-purple-950/80 opacity-[0.95]`} />
                          </div>
                        )}

                        {/* Top-Right Action Buttons */}
                        <div 
                          className="absolute top-3 right-3 z-30 flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditWorld?.(world.id);
                            }}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer shadow-sm ${
                              isLight 
                                ? 'bg-white/80 border-black/15 text-zinc-700 hover:bg-white hover:text-black' 
                                : 'bg-black/55 border-accent/25 text-accent shadow-[0_0_8px_rgba(170,170,170,0.1)] hover:bg-accent hover:text-white hover:border-accent/50'
                            }`}
                            title="Edit World"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWorld(world.id, e);
                            }}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer shadow-sm ${
                              isLight 
                                ? 'bg-white/80 border-black/15 text-red-600 hover:bg-red-50 hover:border-red-300' 
                                : 'bg-black/55 border-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.1)] hover:bg-red-600/20 hover:text-red-300 hover:border-red-500/40'
                            }`}
                            title="Delete World"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Ambient gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent z-10 pointer-events-none" />

                        {/* Smooth backdrop blur fading up */}
                        <div 
                          className="absolute inset-0 bg-black/20 backdrop-blur-[12px] pointer-events-none z-10"
                          style={{
                            maskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)',
                            WebkitMaskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)'
                          }}
                        />

                        {/* Info & Text Overlay near the bottom */}
                        <div className="absolute inset-x-0 bottom-0 p-3.5 pb-3.5 z-20 flex flex-col justify-end">
                          <div className="text-white text-[13.5px] font-bold tracking-tight mb-0.5 line-clamp-1 drop-shadow-sm font-sans">
                            {world.name}
                          </div>
                          
                          {/* Tagline / Description */}
                          <p className="text-[10px] text-white/75 leading-normal tracking-wide line-clamp-2 min-h-[28px] font-sans drop-shadow-sm mb-2">
                            {world.tagline || world.description}
                          </p>

                          {/* Bottom metrics */}
                          <div className="flex items-center gap-3 text-white/85 font-medium font-sans mt-0.5">
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5 text-white/85 stroke-[2.2]" />
                              <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getWorldMessageCount(world, storageConfig.chatHistories || [])}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className={`w-3.5 h-3.5 stroke-[2.2] ${(storageConfig.likedWorldIds || []).includes(world.id) ? 'text-white fill-white' : 'text-white/75'}`} />
                              <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getRealWorldLikesCount(world, (storageConfig.likedWorldIds || []).includes(world.id))}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-white/85 stroke-[2.2]" />
                              <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{world.linkedCharacterIds?.length || (world as any).characters?.length || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {activeSubTab === 'characters' && (
          <div className="space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-sans font-bold ${isLight ? 'text-black/50' : 'text-white/40'} uppercase tracking-wider`}>My Characters</span>
              {customCharacters.length > 0 && (
                <button
                  onClick={onOpenCharacterCreator}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wide transition-all duration-150 active:scale-95 shadow-sm border ${
                    isLight 
                      ? 'bg-black/5 border-black/10 text-black hover:bg-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                      : 'bg-accent/10 border-accent/25 text-white shadow-[0_2px_10px_rgba(170,170,170,0.15)] hover:bg-accent/20 hover:border-accent/40 hover:shadow-[0_4px_20px_rgba(170,170,170,0.22)]'
                  }`}
                >
                  <Plus className={`w-3 h-3 ${isLight ? 'text-black/60' : 'text-accent font-bold stroke-[3.5]'}`} />
                  <span>Create</span>
                </button>
              )}
            </div>

            {customCharacters.length === 0 ? (
              <div className={`text-center py-12 border rounded-[28px] p-6 shadow-inner animate-fadeIn ${isLight ? 'bg-black/[0.01] border-black/[0.04]' : 'bg-white/[0.01] border-white/[0.04]'}`}>
                <Sparkles className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-black/10' : 'text-white/10'}`} />
                <h4 className={`text-sm font-bold font-sans ${isLight ? 'text-black' : 'text-white'}`}>No Characters Constructed</h4>
                <p className={`text-[11px] max-w-[200px] mx-auto mt-2 leading-relaxed font-sans font-light ${isLight ? 'text-black/45' : 'text-white/45'}`}>
                  Design custom conversational agents with custom system prompts and rules.
                </p>
                <button
                  onClick={onOpenCharacterCreator}
                  className={`mt-5 px-5 py-2.5 text-xs font-bold rounded-xl transition-all active:scale-95 duration-150 font-sans ${
                    isLight 
                      ? 'bg-zinc-800 text-white hover:bg-zinc-900 shadow-md' 
                      : 'bg-white hover:bg-white/90 text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]'
                  }`}
                >
                  Create Character
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {customCharacters.map((persona) => {
                  const isLiked = storageConfig.likedPersonaIds?.includes(persona.id) || false;
                  return (
                    <div
                      key={persona.id}
                      onClick={() => onNavigateToCharacterProfile?.(persona.id)}
                      className="flex flex-col cursor-pointer group active:scale-[0.98] transition-all duration-300 relative animate-fadeIn"
                    >
                      {/* Visual container with border & shadow */}
                      <div className={`relative w-full aspect-[3/4.4] rounded-[28px] overflow-hidden border transition-all duration-300 ${
                        isLight 
                          ? 'bg-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] border-black/[0.04]' 
                          : 'bg-[#121214] border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.8),_0_0_12px_rgba(255,255,255,0.06)] hover:shadow-[0_12px_24px_rgba(0,0,0,1),_0_0_20px_rgba(255,255,255,0.12)] hover:border-white/20'
                      }`}>
                        {/* Visual gradient backdrop */}
                        {persona.avatar ? (
                          <SafeImage 
                            src={persona.avatar} 
                            referrerPolicy="no-referrer" 
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
                            alt={persona.name} 
                          />
                        ) : (
                          <div className="absolute inset-0 w-full h-full">
                            <div className={`absolute inset-0 bg-gradient-to-br ${persona.avatarGradient} opacity-[0.65]`} />
                          </div>
                        )}

                        {/* Top-Right Action Buttons */}
                        <div 
                          className="absolute top-3 right-3 z-30 flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditCharacter?.(persona.id);
                            }}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer shadow-sm ${
                              isLight 
                                ? 'bg-white/80 border-black/15 text-zinc-700 hover:bg-white hover:text-black' 
                                : 'bg-black/55 border-accent/25 text-accent shadow-[0_0_8px_rgba(170,170,170,0.1)] hover:bg-accent hover:text-white hover:border-accent/50'
                            }`}
                            title="Edit Character"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomCharacter(persona.id, e);
                            }}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer shadow-sm ${
                              isLight 
                                ? 'bg-white/80 border-black/15 text-red-600 hover:bg-red-50 hover:border-red-300' 
                                : 'bg-black/55 border-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.1)] hover:bg-red-600/20 hover:text-red-300 hover:border-red-500/40'
                            }`}
                            title="Delete Character"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Ambient gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent z-10 pointer-events-none" />

                        {/* Smooth backdrop blur fading up */}
                        <div 
                          className="absolute inset-0 bg-black/20 backdrop-blur-[12px] pointer-events-none z-10"
                          style={{
                            maskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)',
                            WebkitMaskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)'
                          }}
                        />

                        {/* Info & Text Overlay near the bottom */}
                        <div className="absolute inset-x-0 bottom-0 p-3.5 pb-3.5 z-20 flex flex-col justify-end">
                          <div className="text-white text-[13.5px] font-bold tracking-tight mb-0.5 line-clamp-1 drop-shadow-sm font-sans">
                            {persona.name}
                          </div>
                          
                          {/* Subtitle / Description */}
                          <p className="text-[10px] text-white/75 leading-normal tracking-wide line-clamp-2 min-h-[28px] font-sans drop-shadow-sm mb-2">
                            {persona.subtitle || persona.greeting || persona.description}
                          </p>

                          {/* Bottom metrics */}
                          <div className="flex items-center gap-3 text-white/85 font-medium font-sans mt-0.5">
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5 text-white/85 stroke-[2.2]" />
                              <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getRealMessageCount(persona, storageConfig.chatHistories || [])}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className={`w-3.5 h-3.5 stroke-[2.2] ${isLiked ? 'text-white fill-white' : 'text-white/75'}`} />
                              <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getRealLikesCount(persona, isLiked)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Personas the user made */}
        {activeSubTab === 'personas' && (
          <div className="space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-sans font-bold ${isLight ? 'text-black/50' : 'text-white/40'} uppercase tracking-wider`}>My Personas</span>
              {userPersonas.length > 0 && (
                <button
                  onClick={() => setShowCreatePersona(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wide transition-all duration-150 active:scale-95 shadow-sm border ${
                    isLight 
                      ? 'bg-black/5 border-black/10 text-black hover:bg-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                      : 'bg-accent/10 border-accent/25 text-white shadow-[0_2px_10px_rgba(170,170,170,0.15)] hover:bg-accent/20 hover:border-accent/40 hover:shadow-[0_4px_20px_rgba(170,170,170,0.22)]'
                  }`}
                >
                  <Plus className={`w-3 h-3 ${isLight ? 'text-black/60' : 'text-accent font-bold stroke-[3.5]'}`} />
                  <span>Create</span>
                </button>
              )}
            </div>

            {userPersonas.length === 0 ? (
              <div className={`text-center py-12 border rounded-[28px] p-6 shadow-inner animate-fadeIn ${isLight ? 'bg-black/[0.01] border-black/[0.04]' : 'bg-white/[0.01] border-white/[0.04]'}`}>
                <FileText className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-black/10' : 'text-white/10'}`} />
                <h4 className={`text-sm font-bold font-sans ${isLight ? 'text-black' : 'text-white'}`}>No Personas Defined</h4>
                <p className={`text-[11px] max-w-[220px] mx-auto mt-2 leading-relaxed font-sans font-light ${isLight ? 'text-black/45' : 'text-white/45'}`}>
                  Personas describe you so AI characters understand your personality and background.
                </p>
                <button
                  onClick={() => setShowCreatePersona(true)}
                  className={`mt-5 px-5 py-2.5 text-xs font-bold rounded-xl transition-all active:scale-95 duration-150 font-sans ${
                    isLight 
                      ? 'bg-zinc-800 text-white hover:bg-zinc-900 shadow-md' 
                      : 'bg-white hover:bg-white/90 text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]'
                  }`}
                >
                  Create Persona
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {userPersonas.map((uPersona) => {
                  const isActive = storageConfig.activeUserPersonaId === uPersona.id;
                  
                  return (
                    <div
                      key={uPersona.id}
                      onClick={() => onUpdateConfig({ activeUserPersonaId: isActive ? '' : uPersona.id })}
                      className="flex flex-col cursor-pointer group active:scale-[0.98] transition-all duration-300 relative animate-fadeIn"
                    >
                      {/* Visual container with border & shadow */}
                      <div className={`relative w-full aspect-[3/4.4] rounded-[28px] overflow-hidden border transition-all duration-300 ${
                        isActive
                          ? isLight
                            ? 'bg-zinc-150 border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.16)] ring-2 ring-zinc-800/10'
                            : 'bg-[#161619] border-white shadow-[0_0_25px_rgba(255,255,255,0.32)] ring-2 ring-white/50'
                          : isLight 
                            ? 'bg-zinc-100 shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] border-black/[0.04]' 
                            : 'bg-[#121214] border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.8),_0_0_12px_rgba(255,255,255,0.06)] hover:shadow-[0_12px_24px_rgba(0,0,0,1),_0_0_20px_rgba(255,255,255,0.12)] hover:border-white/20'
                      }`}>
                        {/* Custom background image if avatar exists */}
                        {uPersona.avatar ? (
                          <SafeImage 
                            src={uPersona.avatar} 
                            referrerPolicy="no-referrer" 
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
                            alt={uPersona.name} 
                          />
                        ) : (
                          <div className="absolute inset-0 w-full h-full">
                            <div className={`absolute inset-0 bg-gradient-to-br ${uPersona.avatarGradient || 'from-indigo-900 to-purple-950'} opacity-[0.65]`} />
                          </div>
                        )}

                        {/* Top-Right Action Buttons */}
                        <div 
                          className="absolute top-3 right-3 z-30 flex items-center gap-1.5" 
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingUserPersona(uPersona);
                              setShowCreatePersona(true);
                            }}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer shadow-sm ${
                              isLight 
                                ? 'bg-white/80 border-black/15 text-zinc-700 hover:bg-white hover:text-black' 
                                : 'bg-black/55 border-accent/25 text-accent shadow-[0_0_8px_rgba(170,170,170,0.1)] hover:bg-accent hover:text-white hover:border-accent/50'
                            }`}
                            title="Edit Persona"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUserPersona(uPersona.id, e);
                            }}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer shadow-sm ${
                              isLight 
                                ? 'bg-white/80 border-black/15 text-red-600 hover:bg-red-50 hover:border-red-300' 
                                : 'bg-black/55 border-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.1)] hover:bg-red-600/20 hover:text-red-300 hover:border-red-500/40'
                            }`}
                            title="Delete Persona"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Ambient gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent z-10 pointer-events-none" />

                        {/* Smooth backdrop blur fading up */}
                        <div 
                          className="absolute inset-0 bg-black/20 backdrop-blur-[12px] pointer-events-none z-10"
                          style={{
                            maskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)',
                            WebkitMaskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)'
                          }}
                        />

                        {/* Info & Text Overlay near the bottom */}
                        <div className="absolute inset-x-0 bottom-0 p-3.5 pb-3.5 z-20 flex flex-col justify-end">
                          <div className="text-white text-[13.5px] font-bold tracking-tight mb-0.5 line-clamp-1 drop-shadow-sm font-sans">
                            {uPersona.name}
                          </div>
                          
                          <p className="text-[10px] text-white/75 leading-normal tracking-wide line-clamp-2 min-h-[28px] font-sans drop-shadow-sm mb-0">
                            {uPersona.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Characters and Worlds Users Liked */}
        {activeSubTab === 'liked' && (
          <div className="space-y-6 animate-scaleIn">
            {likedCharacters.length === 0 && likedWorlds.length === 0 ? (
              <div className={`text-center py-12 border rounded-[28px] p-6 shadow-inner animate-fadeIn ${isLight ? 'bg-black/[0.01] border-black/[0.04]' : 'bg-white/[0.01] border-white/[0.04]'}`}>
                <Heart className={`w-10 h-10 mx-auto mb-3 ${isLight ? 'text-black/10' : 'text-white/10'}`} />
                <h4 className={`text-sm font-bold font-sans ${isLight ? 'text-black' : 'text-white'}`}>No Favorites Yet</h4>
                <p className={`text-[11px] max-w-[220px] mx-auto mt-2 leading-relaxed font-sans font-light ${isLight ? 'text-black/45' : 'text-white/45'}`}>
                  Heart characters or worlds from their profiles, and they will show up here as favorites.
                </p>
                <button
                  onClick={() => {
                    if (onNavigateTab) onNavigateTab('personas');
                  }}
                  className={`mt-5 px-5 py-2.5 text-xs font-bold rounded-xl transition-all active:scale-95 duration-150 font-sans ${
                    isLight 
                      ? 'bg-zinc-800 text-white hover:bg-zinc-900 shadow-md' 
                      : 'bg-white hover:bg-white/90 text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]'
                  }`}
                >
                  Explore Vsen.Ai
                </button>
              </div>
            ) : (
              <>
                {/* Liked Characters section */}
                {likedCharacters.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-sans font-bold ${isLight ? 'text-black/50' : 'text-white/40'} uppercase tracking-wider`}>Favorited Characters ({likedCharacters.length})</span>
                    </div>

                    <div className="flex gap-3.5 overflow-x-auto pt-2 pb-7 px-5 -mx-5 scrollbar-none">
                      {likedCharacters.map((persona) => {
                        const isWorld = persona.id.startsWith('world-');
                        return (
                          <div
                            key={persona.id}
                            onClick={() => {
                              if (isWorld) {
                                onNavigateToWorldProfile?.(persona.id.replace('world-', ''));
                              } else {
                                onNavigateToCharacterProfile?.(persona.id);
                              }
                            }}
                            className="flex flex-col cursor-pointer group active:scale-[0.98] transition-all duration-300 relative animate-fadeIn w-[145px] min-w-[145px] max-w-[145px] flex-shrink-0"
                          >
                            {/* Visual container with border & shadow */}
                            <div className={`relative w-full aspect-[3/4.4] rounded-[28px] overflow-hidden border transition-all duration-300 ${
                              isLight 
                                ? 'bg-zinc-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] border-black/[0.04]' 
                                : 'bg-[#121214] border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:border-white/20 hover:shadow-[0_6px_16px_rgba(0,0,0,0.6)]'
                            }`}>
                              {persona.avatar ? (
                                <SafeImage 
                                  src={persona.avatar} 
                                  referrerPolicy="no-referrer" 
                                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
                                  alt={persona.name} 
                                />
                              ) : (
                                <div className="absolute inset-0 w-full h-full">
                                  <div className={`absolute inset-0 bg-gradient-to-br ${persona.avatarGradient || 'from-indigo-900 to-purple-950'} opacity-[0.65]`} />
                                </div>
                              )}

                              {/* Interactive Heart/Unlike overlay button */}
                              <div 
                                className="absolute top-3 right-3 z-30"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentLiked = storageConfig.likedPersonaIds || [];
                                    onUpdateConfig({
                                      likedPersonaIds: currentLiked.filter(id => id !== persona.id)
                                    });
                                    triggerToast("Unliked Character!");
                                  }}
                                  className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer shadow-sm ${
                                    isLight 
                                      ? 'bg-white/80 border-black/15 text-rose-500 hover:bg-rose-50 hover:border-rose-300' 
                                      : 'bg-black/55 border-rose-500/20 text-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.1)] hover:bg-rose-500 hover:text-white hover:border-rose-500/50'
                                  }`}
                                  title="Unlike Character"
                                >
                                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                                </button>
                              </div>

                              {/* Ambient gradient overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent z-10 pointer-events-none" />

                              {/* Smooth backdrop blur fading up */}
                              <div 
                                className="absolute inset-0 bg-black/20 backdrop-blur-[12px] pointer-events-none z-10"
                                style={{
                                  maskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)',
                                  WebkitMaskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)'
                                }}
                              />

                              {/* Info & Text Overlay near the bottom */}
                              <div className="absolute inset-x-0 bottom-0 p-3.5 pb-3.5 z-20 flex flex-col justify-end">
                                <div className="text-white text-[13.5px] font-bold tracking-tight mb-0.5 line-clamp-1 drop-shadow-sm font-sans">
                                  {persona.name}
                                </div>
                                
                                <p className="text-[10px] text-white/75 leading-normal tracking-wide line-clamp-2 min-h-[28px] font-sans drop-shadow-sm mb-2">
                                  {persona.subtitle || persona.greeting}
                                </p>

                                {/* Bottom metrics */}
                                <div className="flex items-center gap-3 text-white/85 font-medium font-sans mt-0.5">
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="w-3.5 h-3.5 text-white/85 stroke-[2.2]" />
                                    <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getRealMessageCount(persona, storageConfig.chatHistories || [])}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Heart className="w-3.5 h-3.5 fill-white text-white stroke-[2.2]" />
                                    <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getRealLikesCount(persona, true)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Liked Worlds section */}
                {likedWorlds.length > 0 && (
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                       <span className={`text-[10px] font-sans font-bold ${isLight ? 'text-black/50' : 'text-white/40'} uppercase tracking-wider`}>Favorited Worlds ({likedWorlds.length})</span>
                    </div>

                    <div className="flex gap-3.5 overflow-x-auto pt-2 pb-7 px-5 -mx-5 scrollbar-none">
                      {likedWorlds.map((world) => {
                        return (
                          <div
                            key={world.id}
                            onClick={() => {
                              onNavigateToWorldProfile?.(world.id);
                            }}
                            className="flex flex-col cursor-pointer group active:scale-[0.98] transition-all duration-300 relative animate-fadeIn w-[145px] min-w-[145px] max-w-[145px] flex-shrink-0"
                          >
                            {/* Visual container with border & shadow */}
                            <div className={`relative w-full aspect-[3/4.4] rounded-[28px] overflow-hidden border transition-all duration-300 ${
                              isLight 
                                ? 'bg-zinc-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] border-black/[0.04]' 
                                : 'bg-[#121214] border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:border-white/20 hover:shadow-[0_6px_16px_rgba(0,0,0,0.6)]'
                            }`}>
                              {world.coverImage ? (
                                <SafeImage 
                                  src={world.coverImage} 
                                  referrerPolicy="no-referrer" 
                                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
                                  alt={world.name} 
                                />
                              ) : (
                                <div className="absolute inset-0 w-full h-full">
                                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-purple-950/90" />
                                </div>
                              )}

                              {/* Interactive Heart/Unlike overlay button */}
                              <div 
                                className="absolute top-3 right-3 z-30"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentLiked = storageConfig.likedWorldIds || [];
                                    onUpdateConfig({
                                      likedWorldIds: currentLiked.filter(id => id !== world.id)
                                    });
                                    triggerToast("Unliked World!");
                                  }}
                                  className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer shadow-sm ${
                                    isLight 
                                      ? 'bg-white/80 border-black/15 text-rose-500 hover:bg-rose-50 hover:border-rose-300' 
                                      : 'bg-black/55 border-rose-500/20 text-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.1)] hover:bg-rose-500 hover:text-white hover:border-rose-500/50'
                                  }`}
                                  title="Unlike World"
                                >
                                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                                </button>
                              </div>

                              {/* Ambient gradient overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent z-10 pointer-events-none" />

                              {/* Smooth backdrop blur fading up */}
                              <div 
                                className="absolute inset-0 bg-black/20 backdrop-blur-[12px] pointer-events-none z-10"
                                style={{
                                  maskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)',
                                  WebkitMaskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 40%)'
                                }}
                              />

                              {/* Info & Text Overlay near the bottom */}
                              <div className="absolute inset-x-0 bottom-0 p-3.5 pb-3.5 z-20 flex flex-col justify-end">
                                <div className="text-white text-[13.5px] font-bold tracking-tight mb-0.5 line-clamp-1 drop-shadow-sm font-sans">
                                  {world.name}
                                </div>
                                
                                <p className="text-[10px] text-white/75 leading-normal tracking-wide line-clamp-2 min-h-[28px] font-sans drop-shadow-sm mb-2">
                                  {world.tagline || world.description}
                                </p>

                                {/* Bottom metrics */}
                                <div className="flex items-center gap-3 text-white/85 font-medium font-sans mt-0.5">
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="w-3.5 h-3.5 text-white/85 stroke-[2.2]" />
                                    <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getWorldMessageCount(world, storageConfig.chatHistories || [])}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Heart className={`w-3.5 h-3.5 stroke-[2.2] ${(storageConfig.likedWorldIds || []).includes(world.id) ? 'text-white fill-white' : 'text-white/75'}`} />
                                    <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{getRealWorldLikesCount(world, (storageConfig.likedWorldIds || []).includes(world.id))}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-white/85 stroke-[2.2]" />
                                    <span className="text-[10px] font-bold tracking-wide leading-none text-white/90">{world.linkedCharacterIds?.length || (world as any).characters?.length || 0}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-[290px] rounded-[28px] border p-6 text-center shadow-2xl animate-scaleIn ${
            isLight 
              ? 'bg-white/95 border-black/10 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]' 
              : 'bg-[#16161a]/95 border-white/10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
          }`}>
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 stroke-[2]" />
            </div>
            
            <h4 className="text-sm font-extrabold tracking-wide uppercase font-sans mb-2">
              Confirm Permanent Deletion
            </h4>
            
            <p className={`text-[11px] leading-relaxed font-sans font-light mb-6 ${
              isLight ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              Are you sure to delete <span className="font-semibold text-rose-500">{deleteTarget.name}</span> permanently?
            </p>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDeleteTarget}
                className="w-full py-2.5 rounded-xl text-xs font-bold font-sans bg-rose-600 hover:bg-rose-700 text-white transition-all active:scale-95 duration-150 shadow-md"
              >
                Yes, delete permanently
              </button>
              
              <button
                onClick={() => setDeleteTarget(null)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold font-sans transition-all active:scale-95 duration-150 border ${
                  isLight 
                    ? 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200' 
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orb Economy Modals */}
      <OrbWalletModal
        isOpen={showOrbWallet}
        onClose={() => setShowOrbWallet(false)}
        storageConfig={storageConfig}
        onUpdateConfig={onUpdateConfig}
      />

    </div>
  );
});
