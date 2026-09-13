import { StorageConfig, Persona, World, ChatHistory, Place, AmbientSound } from '../types';
import { PERSONAS } from '../data/personas';
import { scheduleCloudSave } from './cloudSync';

const STORAGE_KEY = 'vsen_encrypted_shared_prefs';
const DB_NAME = 'vsen_ai_db';
const DB_VERSION = 1;
const STORE_NAME = 'config_store';

let dbPromise: Promise<IDBDatabase> | null = null;
let cachedConfig: StorageConfig | null = null;

const resetDB = () => {
  dbPromise = null;
};

const getDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        dbPromise = null;
        return reject('IndexedDB not supported');
      }
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => {
          dbPromise = null;
          reject(request.error);
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            try { db.close(); } catch {}
            resetDB();
          };
          db.onclose = () => {
            resetDB();
          };
          db.onerror = () => {
            resetDB();
          };
          resolve(db);
        };
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
      } catch (err) {
        dbPromise = null;
        reject(err);
      }
    });
  }
  return dbPromise;
};

export const saveToIndexedDB = async (config: StorageConfig) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(config, STORAGE_KEY);
      return;
    } catch (err: any) {
      resetDB();
      if (attempt === 1) {
        // Silent catch on window unload or closing connection
        if (err?.name !== 'InvalidStateError' && !String(err).includes('closing')) {
          console.warn('IndexedDB write notice:', err?.message || err);
        }
      }
    }
  }
};

export const loadFromIndexedDB = async (): Promise<StorageConfig | null> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      return await new Promise((resolve) => {
        const req = store.get(STORAGE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      resetDB();
      if (attempt === 1) return null;
    }
  }
  return null;
};

export const clearIndexedDB = async () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(STORAGE_KEY);
      return;
    } catch (err) {
      resetDB();
      if (attempt === 1) {
        console.warn('IndexedDB clear notice:', err);
      }
    }
  }
};

const mergeAssetField = (existing: string | null | undefined, incoming: string | null | undefined): string => {
  const ext = existing || '';
  const inc = incoming || '';
  if (!ext && !inc) return '';
  if (ext.startsWith('db:') && !inc.startsWith('db:')) return ext;
  if (inc.startsWith('db:') && !ext.startsWith('db:')) return inc;
  if (ext.startsWith('db:') && inc.startsWith('db:')) return inc; // both db, take incoming (latest)
  return inc || ext;
};

export const mergePlaces = (listA: Place[] = [], listB: Place[] = []): Place[] => {
  if (!listA || listA.length === 0) return listB || [];
  if (!listB || listB.length === 0) return listA || [];

  const aHasCustom = listA.some(p => (p.image && p.image.trim().length > 0) || (p.name && p.name !== 'General') || (p.triggerDescription && p.triggerDescription.trim().length > 0));
  const bHasCustom = listB.some(p => (p.image && p.image.trim().length > 0) || (p.name && p.name !== 'General') || (p.triggerDescription && p.triggerDescription.trim().length > 0));

  if (aHasCustom && !bHasCustom) return listA;
  if (bHasCustom && !aHasCustom) return listB;

  const map = new Map<string, Place>();
  for (const p of listA) {
    if (p) map.set(p.id || p.name || 'general', p);
  }
  for (const p of listB) {
    if (!p) continue;
    const key = p.id || p.name || 'general';
    const existing = map.get(key);
    if (!existing) {
      map.set(key, p);
    } else {
      map.set(key, {
        ...existing,
        ...p,
        image: mergeAssetField(existing.image, p.image),
        triggerDescription: p.triggerDescription || existing.triggerDescription || '',
      });
    }
  }
  return Array.from(map.values());
};

export const mergeAmbientSounds = (listA: AmbientSound[] = [], listB: AmbientSound[] = []): AmbientSound[] => {
  if (!listA || listA.length === 0) return listB || [];
  if (!listB || listB.length === 0) return listA || [];

  const aHasCustom = listA.some(s => (s.audioFile && s.audioFile.trim().length > 0) || (s.name && s.name !== 'General') || (s.triggerDescription && s.triggerDescription.trim().length > 0));
  const bHasCustom = listB.some(s => (s.audioFile && s.audioFile.trim().length > 0) || (s.name && s.name !== 'General') || (s.triggerDescription && s.triggerDescription.trim().length > 0));

  if (aHasCustom && !bHasCustom) return listA;
  if (bHasCustom && !aHasCustom) return listB;

  const map = new Map<string, AmbientSound>();
  for (const s of listA) {
    if (s) map.set(s.id || s.name || 'general', s);
  }
  for (const s of listB) {
    if (!s) continue;
    const key = s.id || s.name || 'general';
    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
    } else {
      map.set(key, {
        ...existing,
        ...s,
        audioFile: mergeAssetField(existing.audioFile, s.audioFile),
        triggerDescription: s.triggerDescription || existing.triggerDescription || '',
      });
    }
  }
  return Array.from(map.values());
};

export const mergeChatHistories = (listA: ChatHistory[] = [], listB: ChatHistory[] = []): ChatHistory[] => {
  const map = new Map<string, ChatHistory>();

  const processList = (list: ChatHistory[]) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || !item.id) continue;
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const existingMsgs = existing.messages || [];
        const newMsgs = item.messages || [];
        
        let winner = existing;
        if (newMsgs.length > existingMsgs.length) {
          winner = {
            ...existing,
            ...item,
            messages: newMsgs,
            customWallpaper: mergeAssetField(existing.customWallpaper, item.customWallpaper),
            relationshipScores: item.relationshipScores || existing.relationshipScores,
            characterState: item.characterState || existing.characterState,
            linkedCharacterIds: item.linkedCharacterIds !== undefined ? item.linkedCharacterIds : existing.linkedCharacterIds,
            updatedAt: Math.max(existing.updatedAt || 0, item.updatedAt || 0),
          };
        } else if (newMsgs.length < existingMsgs.length) {
          winner = {
            ...item,
            ...existing,
            messages: existingMsgs,
            customWallpaper: mergeAssetField(existing.customWallpaper, item.customWallpaper),
            relationshipScores: existing.relationshipScores || item.relationshipScores,
            characterState: existing.characterState || item.characterState,
            linkedCharacterIds: existing.linkedCharacterIds !== undefined ? existing.linkedCharacterIds : item.linkedCharacterIds,
            updatedAt: Math.max(existing.updatedAt || 0, item.updatedAt || 0),
          };
        } else {
          const existingTime = existing.updatedAt || 0;
          const newTime = item.updatedAt || 0;
          if (newTime >= existingTime) {
            winner = {
              ...existing,
              ...item,
              messages: newMsgs,
              customWallpaper: mergeAssetField(existing.customWallpaper, item.customWallpaper),
              linkedCharacterIds: item.linkedCharacterIds !== undefined ? item.linkedCharacterIds : existing.linkedCharacterIds,
              updatedAt: newTime,
            };
          } else {
            winner = {
              ...item,
              ...existing,
              messages: existingMsgs,
              customWallpaper: mergeAssetField(existing.customWallpaper, item.customWallpaper),
              linkedCharacterIds: existing.linkedCharacterIds !== undefined ? existing.linkedCharacterIds : item.linkedCharacterIds,
              updatedAt: existingTime,
            };
          }
        }
        map.set(item.id, winner);
      }
    }
  };

  processList(listA);
  processList(listB);

  return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
};

export const mergePersonas = (listA: Persona[] = [], listB: Persona[] = []): Persona[] => {
  const map = new Map<string, Persona>();

  if (Array.isArray(listA)) {
    for (const p of listA) {
      if (p && p.id) map.set(p.id, p);
    }
  }

  if (Array.isArray(listB)) {
    for (const p of listB) {
      if (!p || !p.id) continue;
      const existing = map.get(p.id);
      if (!existing) {
        map.set(p.id, p);
      } else {
        const existingTime = (existing as any).updatedAt || 0;
        const incomingTime = (p as any).updatedAt || 0;
        const winner = incomingTime >= existingTime ? p : existing;
        const loser = incomingTime >= existingTime ? existing : p;
        const avatar = mergeAssetField(loser.avatar, winner.avatar);
        map.set(p.id, {
          ...loser,
          ...winner,
          avatar,
          updatedAt: Math.max(existingTime, incomingTime, Date.now()),
        });
      }
    }
  }

  return Array.from(map.values());
};

export const mergeUserPersonas = (listA: any[] = [], listB: any[] = []): any[] => {
  const map = new Map<string, any>();

  if (Array.isArray(listA)) {
    for (const p of listA) {
      if (p && p.id) map.set(p.id, p);
    }
  }

  if (Array.isArray(listB)) {
    for (const p of listB) {
      if (!p || !p.id) continue;
      const existing = map.get(p.id);
      if (!existing) {
        map.set(p.id, p);
      } else {
        const existingTime = p.updatedAt || 0;
        const incomingTime = existing.updatedAt || 0;
        const winner = incomingTime >= existingTime ? existing : p;
        const loser = incomingTime >= existingTime ? p : existing;
        map.set(p.id, {
          ...loser,
          ...winner,
          avatar: mergeAssetField(loser.avatar, winner.avatar),
          updatedAt: Math.max(existingTime, incomingTime, Date.now()),
        });
      }
    }
  }

  return Array.from(map.values());
};

export const mergeWorlds = (listA: World[] = [], listB: World[] = []): World[] => {
  const map = new Map<string, World>();

  if (Array.isArray(listA)) {
    for (const w of listA) {
      if (w && w.id) map.set(w.id, w);
    }
  }

  if (Array.isArray(listB)) {
    for (const w of listB) {
      if (!w || !w.id) continue;
      const existing = map.get(w.id);
      if (!existing) {
        map.set(w.id, w);
      } else {
        const existingTime = existing.updatedAt || 0;
        const incomingTime = w.updatedAt || 0;
        
        // The newer one is authoritative
        const winner = incomingTime >= existingTime ? w : existing;
        const loser = incomingTime >= existingTime ? existing : w;

        const coverImage = mergeAssetField(loser.coverImage, winner.coverImage);

        map.set(w.id, {
          ...loser,
          ...winner,
          coverImage,
          places: mergePlaces(loser.places, winner.places),
          ambientSounds: mergeAmbientSounds(loser.ambientSounds, winner.ambientSounds),
          linkedCharacterIds: winner.linkedCharacterIds?.length ? winner.linkedCharacterIds : (loser.linkedCharacterIds || []),
          updatedAt: Math.max(existingTime, incomingTime, Date.now()),
        });
      }
    }
  }

  return Array.from(map.values());
};

export const DEFAULT_CHARACTERS: Persona[] = [];

export const getStorageConfig = (): StorageConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      let characters = parsed.characters || [];
      let needsSave = false;

      if (characters.length === 0 && DEFAULT_CHARACTERS.length > 0) {
        characters = [...DEFAULT_CHARACTERS];
        needsSave = true;
      }

      let parsedHistories: ChatHistory[] = parsed.chatHistories || [];
      const parsedWorlds: World[] = parsed.worlds || [];
      
      // Ensure every historical session has its own immutable linkedCharacterIds snapshot
      parsedHistories = parsedHistories.map(h => {
        if (h && h.linkedCharacterIds === undefined) {
          if (h.linkedWorldId) {
            const w = parsedWorlds.find(x => x.id === h.linkedWorldId);
            return { ...h, linkedCharacterIds: w?.linkedCharacterIds ? [...w.linkedCharacterIds] : [] };
          } else if (h.personaId && !h.personaId.startsWith('world-')) {
            return { ...h, linkedCharacterIds: [h.personaId] };
          }
        }
        return h;
      });

      const config: StorageConfig = {
        apiKey: parsed.apiKey || '',
        apiKeys: parsed.apiKeys || (parsed.apiKey ? [parsed.apiKey] : []),
        worldApiKey: parsed.worldApiKey || '',
        useSameApiKey: parsed.useSameApiKey !== false,
        useServerKeyFallback: parsed.useServerKeyFallback !== false,
        selectedPersonaId: parsed.selectedPersonaId || 'tech-mentor',
        customPersonas: parsed.customPersonas || [],
        characters: characters,
        chatHistories: parsedHistories,
        likedPersonaIds: parsed.likedPersonaIds || [],
        likedWorldIds: parsed.likedWorldIds || [],
        userPersonas: parsed.userPersonas || [],
        userProfile: parsed.userProfile || {
          name: 'vsenrov',
          username: 'vsenrov',
          description: 'AI Companion enthusiast.',
          avatarGradient: 'from-purple-600 to-indigo-600',
        },
        isHapticEnabled: parsed.isHapticEnabled !== false,
        isRepliesEnabled: parsed.isRepliesEnabled !== false,
        isCacheEnabled: parsed.isCacheEnabled !== false,
        isSafeFilterEnabled: parsed.isSafeFilterEnabled !== false,
        isVoiceRepliesEnabled: parsed.isVoiceRepliesEnabled === true,
        isPerformanceMode: parsed.isPerformanceMode !== undefined ? parsed.isPerformanceMode : true,
        samplerMaxContext: parsed.samplerMaxContext !== undefined ? parsed.samplerMaxContext : 8192,
        samplerGeneratedTokens: parsed.samplerGeneratedTokens !== undefined ? parsed.samplerGeneratedTokens : 1024,
        samplerIsStreaming: parsed.samplerIsStreaming !== false,
        samplerTemperature: parsed.samplerTemperature !== undefined ? parsed.samplerTemperature : 0.7,
        samplerTopP: parsed.samplerTopP !== undefined ? parsed.samplerTopP : 0.95,
        samplerPresencePenalty: parsed.samplerPresencePenalty !== undefined ? parsed.samplerPresencePenalty : 0.0,
        samplerFrequencyPenalty: parsed.samplerFrequencyPenalty !== undefined ? parsed.samplerFrequencyPenalty : 0.0,
        samplerSeed: parsed.samplerSeed !== undefined ? parsed.samplerSeed : 42,
        messageTextSize: parsed.messageTextSize !== undefined ? parsed.messageTextSize : 13,
        worlds: parsed.worlds || [],
        activeWorldId: parsed.activeWorldId || '',
        selectedModel: (parsed.selectedModel && parsed.selectedModel.startsWith('gemini-3.')) 
          ? parsed.selectedModel 
          : 'gemini-3.8-flash',
        apiProvider: parsed.apiProvider || 'gemini',
        hasOnboarded: parsed.hasOnboarded !== undefined ? parsed.hasOnboarded : ((parsed.chatHistories && parsed.chatHistories.length > 0) || (parsed.characters && parsed.characters.length > 0) || (parsed.worlds && parsed.worlds.length > 0)),
        orbs: parsed.orbs !== undefined ? parsed.orbs : 50,
        accountCreatedAt: parsed.accountCreatedAt || Date.now(),
        orbTransactions: parsed.orbTransactions || [
          {
            id: 'tx-welcome',
            amount: 50,
            reason: 'Welcome Bonus',
            timestamp: parsed.accountCreatedAt || Date.now()
          }
        ],
      };

      if (needsSave) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (e) {}
      }

      cachedConfig = config;
      return config;
    }
  } catch (e) {
    console.error('Failed to load storage', e);
  }

  // Fallback default state
  const defaultConfig: StorageConfig = {
    apiKey: '',
    apiKeys: [],
    worldApiKey: '',
    useSameApiKey: true,
    useServerKeyFallback: true,
    selectedPersonaId: 'tech-mentor',
    customPersonas: [],
    characters: [...DEFAULT_CHARACTERS],
    chatHistories: [],
    likedPersonaIds: [],
    likedWorldIds: [],
    userPersonas: [],
    userProfile: {
      name: 'vsenrov',
      username: 'vsenrov',
      description: 'AI Companion enthusiast.',
      avatarGradient: 'from-purple-600 to-indigo-600',
    },
    isHapticEnabled: true,
    isRepliesEnabled: true,
    isCacheEnabled: true,
    isSafeFilterEnabled: true,
    isVoiceRepliesEnabled: false,
    isPerformanceMode: true,
    samplerMaxContext: 8192,
    samplerGeneratedTokens: 1024,
    samplerIsStreaming: true,
    samplerTemperature: 0.7,
    samplerTopP: 0.95,
    samplerPresencePenalty: 0.0,
    samplerFrequencyPenalty: 0.0,
    samplerSeed: 42,
    messageTextSize: 13,
    worlds: [],
    activeWorldId: '',
    selectedModel: 'gemini-3.8-flash',
    apiProvider: 'gemini',
    hasOnboarded: false,
    orbs: 50,
    accountCreatedAt: Date.now(),
    orbTransactions: [
      {
        id: 'tx-welcome',
        amount: 50,
        reason: 'Welcome Bonus',
        timestamp: Date.now()
      }
    ],
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultConfig));
  } catch (e) {}

  cachedConfig = defaultConfig;
  return defaultConfig;
};

let diskSaveTimeout: any = null;

const persistToDisk = (data: StorageConfig) => {
  saveToIndexedDB(data).catch(err => console.error('IndexedDB write error', err));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // Quota exceeded on localStorage: ignore safely, IndexedDB retains 100% full state
  }
};

export const flushStorageConfig = () => {
  if (diskSaveTimeout) {
    clearTimeout(diskSaveTimeout);
    diskSaveTimeout = null;
  }
  if (cachedConfig) {
    persistToDisk(cachedConfig);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushStorageConfig();
  });
}

export const saveStorageConfig = (config: Partial<StorageConfig>, immediateDiskWrite = true): StorageConfig => {
  const current = getStorageConfig();

  const updated: StorageConfig = { 
    ...current, 
    ...config,
  };
  
  // Prune chat histories if too many (keep 150 most recent items)
  if (updated.chatHistories && updated.chatHistories.length > 150) {
    updated.chatHistories = updated.chatHistories.slice(0, 150);
  }

  // Set the cachedConfig immediately to the updated config so all future sync reads are accurate
  cachedConfig = updated;

  // Always write to localStorage synchronously in under 1ms for instant memory persistence
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}

  if (immediateDiskWrite || config.chatHistories !== undefined) {
    if (diskSaveTimeout) {
      clearTimeout(diskSaveTimeout);
      diskSaveTimeout = null;
    }
    persistToDisk(updated);
  } else {
    if (diskSaveTimeout) clearTimeout(diskSaveTimeout);
    diskSaveTimeout = setTimeout(() => {
      persistToDisk(updated);
      diskSaveTimeout = null;
    }, 100);
  }

  // Trigger cloud sync debounce
  scheduleCloudSave(updated);

  return updated;
};

export const getCharacterChatKey = (sessionIdOrCharId: string, secondaryId?: string): string => {
  if (!sessionIdOrCharId && !secondaryId) return 'chat_default';
  // If a session ID is provided as primary, prioritize session-specific key
  if (sessionIdOrCharId) {
    if (sessionIdOrCharId.startsWith('chat-')) {
      return `chat_session_${sessionIdOrCharId}`;
    }
    // If secondary is provided and starts with chat-, prioritize that
    if (secondaryId && secondaryId.startsWith('chat-')) {
      return `chat_session_${secondaryId}`;
    }
    return `chat_session_${sessionIdOrCharId}`;
  }
  if (secondaryId) {
    if (secondaryId.startsWith('chat-')) {
      return `chat_session_${secondaryId}`;
    }
    return `chat_${secondaryId}`;
  }
  return 'chat_default';
};

export const saveCharacterChatToLocalStorage = (sessionIdOrCharId: string, messages: any[], secondaryId?: string): void => {
  if (!sessionIdOrCharId && !secondaryId) return;
  if (typeof window === 'undefined') return;
  try {
    const key = getCharacterChatKey(sessionIdOrCharId, secondaryId);
    if (!messages || messages.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    const formatted = messages.map(m => ({
      id: m.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: m.role || (m.isUser ? 'user' : 'model'),
      content: m.content || m.text || '',
      text: m.text || m.content || '',
      isUser: m.isUser ?? (m.role === 'user'),
      timestamp: m.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      isError: m.isError,
      attachmentUrl: m.attachmentUrl,
      thoughtText: m.thoughtText,
    }));
    localStorage.setItem(key, JSON.stringify(formatted));
  } catch (err) {
    console.warn(`Failed to save chat to localStorage for key ${getCharacterChatKey(sessionIdOrCharId, secondaryId)}:`, err);
  }
};

export const loadCharacterChatFromLocalStorage = (sessionIdOrCharId: string, secondaryId?: string): any[] => {
  if (!sessionIdOrCharId && !secondaryId) return [];
  if (typeof window === 'undefined') return [];
  try {
    // 1. Try primary session key first
    const primaryKey = getCharacterChatKey(sessionIdOrCharId, secondaryId);
    let raw = localStorage.getItem(primaryKey);
    
    // 2. If not found and legacy key exists for the specific target ID, try that
    if (!raw && sessionIdOrCharId) {
      raw = localStorage.getItem(`chat_${sessionIdOrCharId}`);
      if (!raw && sessionIdOrCharId.startsWith('chat-')) {
        raw = localStorage.getItem(`chat_session_${sessionIdOrCharId}`);
      }
    }
    // 3. ONLY fall back to secondaryId (e.g. persona ID) if no sessionId was provided at all!
    // This prevents different chat sessions for the same character from clobbering each other.
    if (!raw && !sessionIdOrCharId && secondaryId) {
      raw = localStorage.getItem(`chat_${secondaryId}`);
    }

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(m => ({
        ...m,
        role: m.role || (m.isUser ? 'user' : 'model'),
        isUser: m.isUser ?? (m.role === 'user'),
        text: m.text || m.content || '',
        content: m.content || m.text || '',
        timestamp: m.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      }));
    }
  } catch (err) {
    console.warn(`Failed to load chat from localStorage for key ${getCharacterChatKey(sessionIdOrCharId, secondaryId)}:`, err);
  }
  return [];
};

export const clearCharacterChatFromLocalStorage = (sessionIdOrCharId: string, secondaryId?: string): void => {
  if (!sessionIdOrCharId && !secondaryId) return;
  if (typeof window === 'undefined') return;
  try {
    const key = getCharacterChatKey(sessionIdOrCharId, secondaryId);
    localStorage.removeItem(key);
    if (sessionIdOrCharId) {
      localStorage.removeItem(`chat_${sessionIdOrCharId}`);
      if (sessionIdOrCharId.startsWith('chat-')) {
        localStorage.removeItem(`chat_session_${sessionIdOrCharId}`);
      }
    }
    // Only remove secondaryId if no primary session ID was specified
    if (!sessionIdOrCharId && secondaryId) {
      localStorage.removeItem(`chat_${secondaryId}`);
    }
  } catch (err) {
    console.warn('Failed to clear character chat from localStorage:', err);
  }
};

