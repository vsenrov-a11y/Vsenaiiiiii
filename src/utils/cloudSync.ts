import { 
  auth, 
  db, 
  signInWithGoogle as fbSignInWithGoogle, 
  ensureAuthenticatedUser,
  logoutUser,
  onAuthStateChanged,
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  onSnapshot 
} from '../lib/firebase';
import { User } from 'firebase/auth';
import { StorageConfig, Persona, World, ChatHistory, UserPersona } from '../types';
import { 
  getStorageConfig, 
  saveStorageConfig, 
  loadFromIndexedDB, 
  mergeChatHistories, 
  mergePersonas, 
  mergeWorlds, 
  mergeUserPersonas 
} from './storage';
import { storeAsset, getAssetSync } from './fileDb';

export interface CloudSyncState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isGoogleUser: boolean;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userPhoto: string | null;
  status: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
  lastSyncedAt: number | null;
  errorMessage: string | null;
}

let syncStateListeners: Array<(state: CloudSyncState) => void> = [];
let currentSyncState: CloudSyncState = {
  isInitialized: false,
  isAuthenticated: false,
  isGoogleUser: false,
  userId: null,
  userEmail: null,
  userName: null,
  userPhoto: null,
  status: 'idle',
  lastSyncedAt: null,
  errorMessage: null,
};

function updateSyncState(updates: Partial<CloudSyncState>) {
  currentSyncState = { ...currentSyncState, ...updates };
  syncStateListeners.forEach(listener => {
    try {
      listener(currentSyncState);
    } catch (e) {
      console.error('Error in sync state listener:', e);
    }
  });
}

export function subscribeToSyncState(callback: (state: CloudSyncState) => void): () => void {
  syncStateListeners.push(callback);
  callback(currentSyncState);
  return () => {
    syncStateListeners = syncStateListeners.filter(l => l !== callback);
  };
}

export function getSyncState(): CloudSyncState {
  return currentSyncState;
}

let debounceSaveTimer: any = null;
let isApplyingRemoteChange = false;

/**
 * Clean object before saving to Firestore to remove undefined values
 */
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore);
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = cleanForFirestore(val);
    }
  }
  return clean;
}

/**
 * Save an asset directly to Firestore cloud storage collection
 */
export async function saveAssetToCloud(id: string, dataUrl: string): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const assetDocRef = doc(db, 'users', user.uid, 'assets', id);
    await setDoc(assetDocRef, {
      id,
      data: dataUrl,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to upload asset to cloud:', err);
  }
}

/**
 * Fetch an asset directly from Firestore cloud storage collection
 */
export async function getAssetFromCloud(id: string): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const assetDocRef = doc(db, 'users', user.uid, 'assets', id);
    const snap = await getDoc(assetDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && typeof data.data === 'string') {
        return data.data;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch asset from cloud:', err);
  }
  return null;
}

/**
 * Push current configuration and entities to Firestore
 */
export async function pushConfigToCloud(config: StorageConfig): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  try {
    updateSyncState({ status: 'syncing' });
    const userDocRef = doc(db, 'users', user.uid);

    // Filter root config payload
    const rootPayload = cleanForFirestore({
      apiKey: config.apiKey || '',
      apiKeys: config.apiKeys || [],
      worldApiKey: config.worldApiKey || '',
      useSameApiKey: config.useSameApiKey !== false,
      useServerKeyFallback: config.useServerKeyFallback !== false,
      selectedPersonaId: config.selectedPersonaId || 'tech-mentor',
      activeWorldId: config.activeWorldId || null,
      theme: config.theme || 'dark',
      isPerformanceMode: config.isPerformanceMode !== false,
      hasOnboarded: config.hasOnboarded || false,
      userProfile: config.userProfile || null,
      userPersonas: config.userPersonas || [],
      orbs: typeof config.orbs === 'number' ? config.orbs : 50,
      orbTransactions: config.orbTransactions || [],
      characters: config.characters || [],
      customPersonas: config.customPersonas || [],
      worlds: config.worlds || [],
      chatHistories: config.chatHistories || [],
      likedPersonaIds: config.likedPersonaIds || [],
      likedWorldIds: config.likedWorldIds || [],
      updatedAt: Date.now(),
      lastDevice: typeof navigator !== 'undefined' ? navigator.userAgent : 'web'
    });

    await setDoc(userDocRef, rootPayload, { merge: true });

    // Sync granular documents for characters, worlds, and chats in background
    syncSubcollectionsInBackground(user.uid, config);

    updateSyncState({
      status: 'synced',
      lastSyncedAt: Date.now(),
      errorMessage: null
    });
  } catch (err: any) {
    console.error('Failed to sync to cloud:', err);
    updateSyncState({
      status: 'error',
      errorMessage: err.message || 'Cloud sync failed'
    });
  }
}

/**
 * Sync individual subcollections non-destructively
 */
async function syncSubcollectionsInBackground(userId: string, config: StorageConfig) {
  try {
    // Characters
    const allChars = [...(config.characters || []), ...(config.customPersonas || [])];
    for (const char of allChars) {
      if (char.id) {
        const charRef = doc(db, 'users', userId, 'characters', char.id);
        setDoc(charRef, cleanForFirestore({ ...char, updatedAt: Date.now() }), { merge: true }).catch(() => {});
      }
    }

    // Worlds
    for (const world of config.worlds || []) {
      if (world.id) {
        const worldRef = doc(db, 'users', userId, 'worlds', world.id);
        setDoc(worldRef, cleanForFirestore({ ...world, updatedAt: Date.now() }), { merge: true }).catch(() => {});
      }
    }

    // Chats
    for (const chat of config.chatHistories || []) {
      if (chat.id) {
        const chatRef = doc(db, 'users', userId, 'chats', chat.id);
        setDoc(chatRef, cleanForFirestore({ ...chat, updatedAt: Date.now() }), { merge: true }).catch(() => {});
      }
    }
  } catch (e) {
    // non-blocking
  }
}

/**
 * Debounced save to cloud
 */
export function scheduleCloudSave(config: StorageConfig, delayMs = 1200): void {
  if (isApplyingRemoteChange) return;
  if (debounceSaveTimer) clearTimeout(debounceSaveTimer);

  debounceSaveTimer = setTimeout(() => {
    pushConfigToCloud(config);
  }, delayMs);
}

/**
 * Pull and merge all user cloud data
 */
export async function pullCloudData(
  userId: string, 
  localConfig: StorageConfig
): Promise<StorageConfig> {
  try {
    updateSyncState({ status: 'syncing' });
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);

    let cloudConfig: Partial<StorageConfig> = {};
    if (snap.exists()) {
      cloudConfig = snap.data() as Partial<StorageConfig>;
    }

    // Also fetch any subcollections (characters, worlds, chats) to guarantee completeness
    const [charSnaps, worldSnaps, chatSnaps] = await Promise.all([
      getDocs(collection(db, 'users', userId, 'characters')).catch(() => null),
      getDocs(collection(db, 'users', userId, 'worlds')).catch(() => null),
      getDocs(collection(db, 'users', userId, 'chats')).catch(() => null),
    ]);

    const cloudChars: Persona[] = [];
    if (charSnaps && !charSnaps.empty) {
      charSnaps.forEach(d => {
        const c = d.data() as Persona;
        if (c && c.id) cloudChars.push(c);
      });
    }

    const cloudWorlds: World[] = [];
    if (worldSnaps && !worldSnaps.empty) {
      worldSnaps.forEach(d => {
        const w = d.data() as World;
        if (w && w.id) cloudWorlds.push(w);
      });
    }

    const cloudChats: ChatHistory[] = [];
    if (chatSnaps && !chatSnaps.empty) {
      chatSnaps.forEach(d => {
        const ch = d.data() as ChatHistory;
        if (ch && ch.id) cloudChats.push(ch);
      });
    }

    // Perform safe, non-destructive union with local data
    const allLocalChars = [...(localConfig.characters || []), ...(localConfig.customPersonas || [])];
    const allCloudChars = [...(cloudConfig.characters || []), ...(cloudConfig.customPersonas || []), ...cloudChars];
    const mergedCharacters = mergePersonas(allCloudChars, allLocalChars);

    const mergedWorlds = mergeWorlds(
      [...(cloudConfig.worlds || []), ...cloudWorlds], 
      localConfig.worlds || []
    );

    const mergedChats = mergeChatHistories(
      [...(cloudConfig.chatHistories || []), ...cloudChats], 
      localConfig.chatHistories || []
    );

    const mergedUserPersonas = mergeUserPersonas(
      cloudConfig.userPersonas || [],
      localConfig.userPersonas || []
    );

    const finalConfig: StorageConfig = {
      ...localConfig,
      ...cloudConfig,
      characters: mergedCharacters,
      customPersonas: mergedCharacters.filter(c => c.isCustom),
      worlds: mergedWorlds,
      chatHistories: mergedChats,
      userPersonas: mergedUserPersonas,
      orbs: typeof cloudConfig.orbs === 'number' ? cloudConfig.orbs : (localConfig.orbs ?? 50),
      likedPersonaIds: Array.from(new Set([...(cloudConfig.likedPersonaIds || []), ...(localConfig.likedPersonaIds || [])])),
      likedWorldIds: Array.from(new Set([...(cloudConfig.likedWorldIds || []), ...(localConfig.likedWorldIds || [])])),
    };

    // Save locally
    saveStorageConfig(finalConfig);

    // If local had items not yet in cloud, push merged config back up to cloud
    pushConfigToCloud(finalConfig);

    updateSyncState({
      status: 'synced',
      lastSyncedAt: Date.now(),
      errorMessage: null
    });

    return finalConfig;
  } catch (err: any) {
    console.error('Error pulling cloud data:', err);
    updateSyncState({
      status: 'error',
      errorMessage: err.message || 'Failed to pull cloud data'
    });
    return localConfig;
  }
}

let activeSnapshotUnsubscribe: (() => void) | null = null;

/**
 * Initialize cloud sync engine
 */
export async function initCloudSync(
  onConfigUpdated: (config: StorageConfig) => void
): Promise<void> {
  const localConfig = getStorageConfig();
  const idbConfig = await loadFromIndexedDB();
  const mergedLocal = idbConfig ? {
    ...localConfig,
    ...idbConfig,
    characters: mergePersonas(idbConfig.characters || [], localConfig.characters || []),
    customPersonas: mergePersonas(idbConfig.customPersonas || [], localConfig.customPersonas || []),
    worlds: mergeWorlds(idbConfig.worlds || [], localConfig.worlds || []),
    chatHistories: mergeChatHistories(idbConfig.chatHistories || [], localConfig.chatHistories || []),
    userPersonas: mergeUserPersonas(idbConfig.userPersonas || [], localConfig.userPersonas || [])
  } : localConfig;

  onAuthStateChanged(auth, async (user: User | null) => {
    if (activeSnapshotUnsubscribe) {
      activeSnapshotUnsubscribe();
      activeSnapshotUnsubscribe = null;
    }

    if (user) {
      const isGoogle = Boolean(user.providerData && user.providerData.some(p => p.providerId === 'google.com'));
      updateSyncState({
        isInitialized: true,
        isAuthenticated: true,
        isGoogleUser: isGoogle,
        userId: user.uid,
        userEmail: user.email || null,
        userName: user.displayName || null,
        userPhoto: user.photoURL || null,
        status: 'syncing'
      });

      // Pull & merge cloud data
      const merged = await pullCloudData(user.uid, mergedLocal);
      onConfigUpdated(merged);

      // Listen for remote real-time updates from other devices/tabs
      const userDocRef = doc(db, 'users', user.uid);
      activeSnapshotUnsubscribe = onSnapshot(userDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const remoteData = snapshot.data() as Partial<StorageConfig>;
          const currentLocal = getStorageConfig();

          // Only apply if remote is newer or contains new items
          const currentChars = currentLocal.characters || [];
          const remoteChars = remoteData.characters || [];
          const currentWorlds = currentLocal.worlds || [];
          const remoteWorlds = remoteData.worlds || [];
          const currentChats = currentLocal.chatHistories || [];
          const remoteChats = remoteData.chatHistories || [];

          const mergedChars = mergePersonas(remoteChars, currentChars);
          const mergedWorldsList = mergeWorlds(remoteWorlds, currentWorlds);
          const mergedChatsList = mergeChatHistories(remoteChats, currentChats);
          const mergedUserList = mergeUserPersonas(remoteData.userPersonas || [], currentLocal.userPersonas || []);

          isApplyingRemoteChange = true;
          const updated: StorageConfig = {
            ...currentLocal,
            ...remoteData,
            characters: mergedChars,
            customPersonas: mergedChars.filter(c => c.isCustom),
            worlds: mergedWorldsList,
            chatHistories: mergedChatsList,
            userPersonas: mergedUserList,
          };

          saveStorageConfig(updated);
          onConfigUpdated(updated);
          setTimeout(() => {
            isApplyingRemoteChange = false;
          }, 300);
        }
      }, (err) => {
        console.warn('Realtime cloud sync listener warning:', err);
      });

    } else {
      const isGoogleLinked = typeof window !== 'undefined' && localStorage.getItem('vsen_is_google_linked') === 'true';
      if (!isGoogleLinked) {
        // Auto authenticate anonymously if no Google session exists
        updateSyncState({
          isInitialized: true,
          isAuthenticated: false,
          isGoogleUser: false,
          userId: null,
          userEmail: null,
          userName: null,
          userPhoto: null,
          status: 'idle'
        });
        await ensureAuthenticatedUser();
      } else {
        // Wait briefly for Firebase Auth session to restore from persistence
        setTimeout(async () => {
          if (!auth.currentUser) {
            await ensureAuthenticatedUser();
          }
        }, 1000);
      }
    }
  });
}

/**
 * Trigger Google Account Sign-In with full local data migration to the Google account
 */
export async function loginWithGoogle(
  currentConfig: StorageConfig,
  onConfigUpdated: (config: StorageConfig) => void
): Promise<User | null> {
  try {
    updateSyncState({ status: 'syncing' });
    const user = await fbSignInWithGoogle();
    if (user) {
      const merged = await pullCloudData(user.uid, currentConfig);
      onConfigUpdated(merged);
      return user;
    }
    return null;
  } catch (err: any) {
    console.error('Google Sign-In error:', err);
    updateSyncState({
      status: 'error',
      errorMessage: err.message || 'Google sign-in failed'
    });
    throw err;
  }
}

/**
 * Sign out and switch to fresh anonymous session
 */
export async function logoutAndReset(
  onConfigUpdated: (config: StorageConfig) => void
): Promise<void> {
  if (activeSnapshotUnsubscribe) {
    activeSnapshotUnsubscribe();
    activeSnapshotUnsubscribe = null;
  }
  await logoutUser();
}
