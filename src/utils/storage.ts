import { StorageConfig, Persona, World, ChatHistory, Place, AmbientSound, UserPersona } from '../types';
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
  if (inc) return inc;
  return ext;
};

export const mergeUserProfiles = (profileA: any, profileB: any): any => {
  if (!profileA && !profileB) return null;
  if (!profileA) return profileB;
  if (!profileB) return profileA;

  const timeA = profileA.updatedAt || 0;
  const timeB = profileB.updatedAt || 0;
  const winner = timeB >= timeA ? profileB : profileA;
  const loser = timeB >= timeA ? profileA : profileB;

  return {
    ...loser,
    ...winner,
    avatar: (winner.avatar !== undefined && winner.avatar !== '') ? winner.avatar : (loser.avatar || ''),
    name: winner.name || loser.name || 'vsenrov',
    username: winner.username || loser.username || 'vsenrov',
    description: winner.description !== undefined ? winner.description : (loser.description || ''),
    updatedAt: Math.max(timeA, timeB, Date.now()),
  };
};

export const mergePlaces = (listA: Place[] = [], listB: Place[] = []): Place[] => {
  if (!listA || listA.length === 0) return listB || [];
  if (!listB || listB.length === 0) return listA || [];

  const map = new Map<string, Place>();
  const getPlaceKey = (p: Place): string => {
    if (!p) return 'general';
    if (p.id === 'place-general' || (p.name && p.name.trim().toLowerCase() === 'general')) {
      return 'general';
    }
    return p.id || (p.name || '').trim().toLowerCase();
  };

  for (const p of listA) {
    if (p) map.set(getPlaceKey(p), p);
  }

  for (const p of listB) {
    if (!p) continue;
    const key = getPlaceKey(p);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, p);
    } else {
      map.set(key, {
        ...existing,
        ...p,
        id: p.id || existing.id || (key === 'general' ? 'place-general' : key),
        name: p.name || existing.name || (key === 'general' ? 'General' : ''),
        image: mergeAssetField(existing.image, p.image),
        triggerDescription: p.triggerDescription || existing.triggerDescription || '',
      });
    }
  }

  const all = Array.from(map.values());
  const generalIdx = all.findIndex(p => getPlaceKey(p) === 'general');
  if (generalIdx > 0) {
    const [gen] = all.splice(generalIdx, 1);
    all.unshift(gen);
  } else if (generalIdx === -1) {
    all.unshift({ id: 'place-general', name: 'General', image: '' });
  }

  return all;
};

export const mergeAmbientSounds = (listA: AmbientSound[] = [], listB: AmbientSound[] = []): AmbientSound[] => {
  if (!listA || listA.length === 0) return listB || [];
  if (!listB || listB.length === 0) return listA || [];

  const map = new Map<string, AmbientSound>();
  const getSoundKey = (s: AmbientSound): string => {
    if (!s) return 'general';
    if (s.id === 'sound-general' || (s.name && s.name.trim().toLowerCase() === 'general')) {
      return 'general';
    }
    return s.id || (s.name || '').trim().toLowerCase();
  };

  for (const s of listA) {
    if (s) map.set(getSoundKey(s), s);
  }

  for (const s of listB) {
    if (!s) continue;
    const key = getSoundKey(s);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
    } else {
      map.set(key, {
        ...existing,
        ...s,
        id: s.id || existing.id || (key === 'general' ? 'sound-general' : key),
        name: s.name || existing.name || (key === 'general' ? 'General' : ''),
        audioFile: mergeAssetField(existing.audioFile, s.audioFile),
        triggerDescription: s.triggerDescription || existing.triggerDescription || '',
      });
    }
  }

  const all = Array.from(map.values());
  const generalIdx = all.findIndex(s => getSoundKey(s) === 'general');
  if (generalIdx > 0) {
    const [gen] = all.splice(generalIdx, 1);
    all.unshift(gen);
  } else if (generalIdx === -1) {
    all.unshift({ id: 'sound-general', name: 'General', audioFile: '' });
  }

  return all;
};

export const mergeMessageArrays = (listA: any[] = [], listB: any[] = [], deletedMessageIds: string[] = []): any[] => {
  const deletedSet = new Set((deletedMessageIds || []).filter(Boolean));
  const safeA = (Array.isArray(listA) ? listA : []).filter(m => m && !deletedSet.has(m.id));
  const safeB = (Array.isArray(listB) ? listB : []).filter(m => m && !deletedSet.has(m.id));

  if (safeA.length === 0) return [...safeB];
  if (safeB.length === 0) return [...safeA];

  const map = new Map<string, any>();
  const order: string[] = [];

  const processMsg = (m: any) => {
    if (!m) return;
    const key = m.id || `${m.timestamp || ''}-${(m.text || '').substring(0, 30)}`;
    if (deletedSet.has(key) || deletedSet.has(m.id)) return;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, m);
    } else {
      const existing = map.get(key)!;
      const isExistingStreaming = existing.isStreaming === true;
      const isNewStreaming = m.isStreaming === true;
      if (isExistingStreaming && !isNewStreaming) {
        map.set(key, m);
      } else if (m.text && typeof m.text === 'string' && m.text.length >= (existing.text || '').length) {
        map.set(key, { ...existing, ...m });
      }
    }
  };

  for (const m of safeA) processMsg(m);
  for (const m of safeB) processMsg(m);

  return order.map(id => map.get(id)!).filter(Boolean);
};

export const mergeChatHistories = (listA: ChatHistory[] = [], listB: ChatHistory[] = [], deletedChatIds: string[] = []): ChatHistory[] => {
  const map = new Map<string, ChatHistory>();
  const deletedSet = new Set((deletedChatIds || []).filter(id => Boolean(id && typeof id === 'string' && id.trim().length > 0)));

  const processList = (list: ChatHistory[]) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || !item.id || deletedSet.has(item.id)) continue;
      const existing = map.get(item.id);
      if (!existing) {
        const itemDeleted = new Set(item.deletedMessageIds || []);
        map.set(item.id, {
          ...item,
          messages: (item.messages || []).filter(m => !itemDeleted.has(m.id))
        });
      } else {
        const existingTime = existing.updatedAt || 0;
        const incomingTime = item.updatedAt || 0;
        
        const combinedDeletedMsgs = Array.from(new Set([
          ...(existing.deletedMessageIds || []),
          ...(item.deletedMessageIds || [])
        ]));

        const existingMsgs = (Array.isArray(existing.messages) ? existing.messages : []).filter(m => !combinedDeletedMsgs.includes(m.id));
        const incomingMsgs = (Array.isArray(item.messages) ? item.messages : []).filter(m => !combinedDeletedMsgs.includes(m.id));

        // Union both message lists safely excluding any deleted messages
        const mergedMsgs = (incomingMsgs.length === 0 && existingMsgs.length > 0)
          ? existingMsgs
          : (existingMsgs.length === 0 && incomingMsgs.length > 0)
            ? incomingMsgs
            : mergeMessageArrays(existingMsgs, incomingMsgs, combinedDeletedMsgs);
        const isIncomingNewer = incomingTime >= existingTime;

        // Preserve valid user persona details defensively
        const resolvedUserPersonaId = (item.userPersonaId && item.userPersonaId !== '.')
          ? item.userPersonaId
          : (existing.userPersonaId && existing.userPersonaId !== '.' ? existing.userPersonaId : '');
        const resolvedUserPersonaName = (item.userPersonaName && item.userPersonaName.trim())
          ? item.userPersonaName
          : (existing.userPersonaName || '');
        const resolvedUserPersonaAvatar = item.userPersonaAvatar || existing.userPersonaAvatar;
        const resolvedUserPersonaDesc = item.userPersonaDesc || existing.userPersonaDesc;

        // Merge story memories
        const combinedStoryMemories = Array.from(new Set([
          ...(existing.storyMemories || []),
          ...(item.storyMemories || [])
        ]));

        // Merge character memories map
        const mergedCharacterMemories: Record<string, string[]> = {
          ...(existing.characterMemories || {}),
          ...(item.characterMemories || {})
        };
        for (const [cId, mems] of Object.entries(item.characterMemories || {})) {
          if (Array.isArray(mems)) {
            const existingMems = existing.characterMemories?.[cId] || [];
            mergedCharacterMemories[cId] = Array.from(new Set([...existingMems, ...mems]));
          }
        }

        // Merge pinned messages
        const combinedPinned = Array.from(new Set([
          ...(existing.pinnedMessages || []),
          ...(item.pinnedMessages || [])
        ])).filter(mId => !combinedDeletedMsgs.includes(mId));

        const merged: ChatHistory = {
          ...(isIncomingNewer ? existing : item),
          ...(isIncomingNewer ? item : existing),
          userPersonaId: resolvedUserPersonaId,
          userPersonaName: resolvedUserPersonaName,
          userPersonaAvatar: resolvedUserPersonaAvatar,
          userPersonaDesc: resolvedUserPersonaDesc,
          deletedMessageIds: combinedDeletedMsgs,
          messages: mergedMsgs,
          storyMemories: combinedStoryMemories,
          characterMemories: mergedCharacterMemories,
          pinnedMessages: combinedPinned,
          customWallpaper: mergeAssetField(existing.customWallpaper, item.customWallpaper),
          relationshipScores: item.relationshipScores || existing.relationshipScores || {},
          characterState: item.characterState || existing.characterState || {},
          worldCalendar: isIncomingNewer ? (item.worldCalendar || existing.worldCalendar) : (existing.worldCalendar || item.worldCalendar),
          worldLocation: isIncomingNewer ? (item.worldLocation || existing.worldLocation) : (existing.worldLocation || item.worldLocation),
          worldWeather: isIncomingNewer ? (item.worldWeather || existing.worldWeather) : (existing.worldWeather || item.worldWeather),
          worldReputation: isIncomingNewer ? (item.worldReputation || existing.worldReputation) : (existing.worldReputation || item.worldReputation),
          worldSceneMood: isIncomingNewer ? (item.worldSceneMood || existing.worldSceneMood) : (existing.worldSceneMood || item.worldSceneMood),
          activePlaceName: isIncomingNewer ? (item.activePlaceName || existing.activePlaceName) : (existing.activePlaceName || item.activePlaceName),
          activeAmbientName: isIncomingNewer ? (item.activeAmbientName || existing.activeAmbientName) : (existing.activeAmbientName || item.activeAmbientName),
          linkedCharacterIds: item.linkedCharacterIds !== undefined ? item.linkedCharacterIds : existing.linkedCharacterIds,
          lastMessageAt: Math.max(existing.lastMessageAt || 0, item.lastMessageAt || 0),
          updatedAt: Math.max(existingTime, incomingTime),
        };

        map.set(item.id, merged);
      }
    }
  };

  processList(listA);
  processList(listB);

  return Array.from(map.values())
    .filter(item => !deletedSet.has(item.id))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return getLastMessageTime(b) - getLastMessageTime(a);
    });
};

export const getLastMessageTime = (h: ChatHistory | null | undefined): number => {
  if (!h) return 0;

  // 1. Explicit lastMessageAt
  if (typeof h.lastMessageAt === 'number' && !isNaN(h.lastMessageAt) && h.lastMessageAt > 0) {
    return h.lastMessageAt;
  }

  // 2. Scan messages from latest to earliest for real user or ai message timestamps
  if (Array.isArray(h.messages) && h.messages.length > 0) {
    for (let i = h.messages.length - 1; i >= 0; i--) {
      const m = h.messages[i];
      if (!m) continue;
      if (typeof (m as any).numericTimestamp === 'number' && (m as any).numericTimestamp > 0) {
        return (m as any).numericTimestamp;
      }
      if (typeof (m as any).timestamp === 'number' && (m as any).timestamp > 0) {
        return (m as any).timestamp;
      }
      if (typeof m.timestamp === 'string') {
        const parsed = Date.parse(m.timestamp);
        if (!isNaN(parsed) && parsed > 1000000000) {
          return parsed;
        }
      }
    }
  }

  // 3. Fallback to updatedAt if valid
  if (typeof h.updatedAt === 'number' && !isNaN(h.updatedAt) && h.updatedAt > 0) {
    return h.updatedAt;
  }

  // 4. Session ID creation timestamp (e.g. chat-1727182900000)
  const idParts = (h.id || '').split('-');
  for (const part of idParts) {
    const num = parseInt(part, 10);
    if (!isNaN(num) && num > 1000000000000) {
      return num;
    }
  }

  if (h.timestamp) {
    const parsed = Date.parse(h.timestamp);
    if (!isNaN(parsed)) return parsed;
  }

  return 0;
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
        const avatar = (winner.avatar !== undefined && winner.avatar !== '') ? winner.avatar : (loser.avatar || '');
        map.set(p.id, {
          ...loser,
          ...winner,
          avatar,
          socialAvatar: winner.socialAvatar || loser.socialAvatar || avatar,
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
        const existingTime = (existing as any).updatedAt || 0;
        const incomingTime = (p as any).updatedAt || 0;
        const winner = incomingTime >= existingTime ? p : existing;
        const loser = incomingTime >= existingTime ? existing : p;
        const avatar = (winner.avatar !== undefined && winner.avatar !== '') ? winner.avatar : (loser.avatar || '');
        map.set(p.id, {
          ...loser,
          ...winner,
          avatar,
          avatarGradient: winner.avatarGradient || loser.avatarGradient || 'from-purple-600 to-indigo-600',
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

        const coverImage = (winner.coverImage !== undefined && winner.coverImage !== '') ? winner.coverImage : (loser.coverImage || '');

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

export const DEFAULT_USER_PERSONAS: UserPersona[] = [];

export const PRESET_COMPANION_IDS = new Set(['tech-mentor', 'aria-thorne', 'kaelen-arcane', 'lyra-sterling']);
export const PRESET_USER_PERSONA_IDS = new Set(['up-default-1', 'up-default-2', 'up-user-main']);

export const getStorageConfig = (): StorageConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      let parsedHistories: ChatHistory[] = parsed.chatHistories || [];
      const parsedWorlds: World[] = parsed.worlds || [];
      let needsSave = false;

      // Strip any preset companions
      let characters: Persona[] = (parsed.characters || []).filter((c: any) => c && !PRESET_COMPANION_IDS.has(c.id));
      let customPersonas: Persona[] = (parsed.customPersonas || []).filter((c: any) => c && !PRESET_COMPANION_IDS.has(c.id));
      if (characters.length !== (parsed.characters || []).length) {
        needsSave = true;
      }

      // Restore user-created companions from chat histories if they were overwritten
      const knownCharIds = new Set(characters.map((c: any) => c.id));
      for (const h of parsedHistories) {
        if (h && h.personaId && !PRESET_COMPANION_IDS.has(h.personaId) && !h.personaId.startsWith('world-')) {
          if (!knownCharIds.has(h.personaId)) {
            const restoredChar: Persona = {
              id: h.personaId,
              name: h.personaName || 'Companion',
              subtitle: 'Custom Companion',
              tagline: 'Custom Companion',
              description: 'Your custom companion',
              systemInstruction: `You are ${h.personaName || 'a companion'}. Speak naturally in character with depth and emotion.`,
              greeting: h.messages?.[0]?.text || `*Smiles warmly.* "Hello! It is good to see you again."`,
              avatarGradient: h.avatarGradient || 'from-indigo-600 to-purple-800',
              accentColor: '#8b5cf6',
              suggestedPrompts: [],
              isCustom: true,
              updatedAt: h.updatedAt || Date.now()
            };
            characters.push(restoredChar);
            knownCharIds.add(h.personaId);
            needsSave = true;
          }
        }
      }

      // Strip preset user personas (Explorer, Averick, up-user-main default)
      let userPersonas = (parsed.userPersonas || []).filter((up: any) => 
        up && !PRESET_USER_PERSONA_IDS.has(up.id) && up.name !== 'Explorer' && up.name !== 'Averick'
      );
      if (userPersonas.length !== (parsed.userPersonas || []).length) {
        needsSave = true;
      }

      // Restore user personas from chat histories
      for (const h of parsedHistories) {
        if (h && h.userPersonaName && h.userPersonaName !== 'Explorer' && h.userPersonaName !== 'Averick') {
          if (!userPersonas.some((up: any) => up.name === h.userPersonaName)) {
            userPersonas.push({
              id: h.userPersonaId || `up-restored-${Date.now()}`,
              name: h.userPersonaName,
              description: h.userPersonaDesc || '',
              avatar: h.userPersonaAvatar,
              avatarGradient: 'from-purple-600 to-indigo-600',
              isDefault: userPersonas.length === 0
            });
            needsSave = true;
          }
        }
      }

      const activeUserPersonaId = (userPersonas.some((up: any) => up.id === parsed.activeUserPersonaId))
        ? parsed.activeUserPersonaId
        : (userPersonas[0]?.id || '');

      const selectedPersonaId = (PRESET_COMPANION_IDS.has(parsed.selectedPersonaId) || !parsed.selectedPersonaId)
        ? (characters[0]?.id || '')
        : parsed.selectedPersonaId;
      
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
        selectedPersonaId,
        customPersonas,
        characters,
        chatHistories: parsedHistories,
        deletedChatIds: parsed.deletedChatIds || [],
        likedPersonaIds: parsed.likedPersonaIds || [],
        likedWorldIds: parsed.likedWorldIds || [],
        userPersonas,
        activeUserPersonaId,
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
        selectedModel: parsed.selectedModel || 'gemini-3.8-flash',
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
    selectedPersonaId: '',
    customPersonas: [],
    characters: [],
    chatHistories: [],
    likedPersonaIds: [],
    likedWorldIds: [],
    userPersonas: [],
    activeUserPersonaId: '',
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
    isPerformanceMode: false,
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

export const resetCachedStorage = () => {
  cachedConfig = null;
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
  } catch (e) {
    // If browser localStorage quota (5MB) is reached, save with pruned messages in cache
    try {
      const pruned = {
        ...updated,
        chatHistories: (updated.chatHistories || []).slice(0, 50).map(h => ({
          ...h,
          messages: (h.messages || []).slice(-20)
        }))
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch (e2) {
      console.warn('[Storage] LocalStorage quota fallback engaged', e2);
    }
  }

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
    try {
      localStorage.setItem(key, JSON.stringify(formatted));
    } catch (quotaErr) {
      // Keep recent 40 messages if localStorage full so saving never stops
      try {
        localStorage.setItem(key, JSON.stringify(formatted.slice(-40)));
      } catch {}
    }
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

/**
 * Persist unsent draft text per exact chat session
 */
export const getSessionDraftKey = (sessionIdOrKey: string): string => {
  const cleanKey = sessionIdOrKey ? sessionIdOrKey.replace(/[^a-zA-Z0-9_-]/g, '_') : 'default';
  return `vsen_draft_${cleanKey}`;
};

export const saveSessionDraft = (sessionIdOrKey: string, draftText: string): void => {
  if (!sessionIdOrKey || typeof window === 'undefined') return;
  try {
    const key = getSessionDraftKey(sessionIdOrKey);
    if (!draftText || draftText.trim().length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, draftText);
    }
  } catch (err) {
    console.warn('Failed to save session draft:', err);
  }
};

export const loadSessionDraft = (sessionIdOrKey: string): string => {
  if (!sessionIdOrKey || typeof window === 'undefined') return '';
  try {
    const key = getSessionDraftKey(sessionIdOrKey);
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

export const clearSessionDraft = (sessionIdOrKey: string): void => {
  if (!sessionIdOrKey || typeof window === 'undefined') return;
  try {
    const key = getSessionDraftKey(sessionIdOrKey);
    localStorage.removeItem(key);
  } catch {}
};

