import { 
  auth, 
  db, 
  signInWithGoogle as fbSignInWithGoogle, 
  ensureAuthenticatedUser,
  logoutUser,
  handleSignOut as fbHandleSignOut,
  signOut,
  onAuthStateChanged,
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  deleteDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { User } from 'firebase/auth';
import { StorageConfig, Persona, World, ChatHistory, UserPersona, ChatMessage } from '../types';
import { 
  getStorageConfig, 
  saveStorageConfig, 
  loadFromIndexedDB, 
  mergeChatHistories, 
  mergePersonas, 
  mergeWorlds, 
  mergeUserPersonas,
  mergeUserProfiles,
  resetCachedStorage,
  PRESET_COMPANION_IDS,
  PRESET_USER_PERSONA_IDS
} from './storage';
import { preloadConfigAssets } from './fileDb';

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
let writeCooldownUntil = 0;
const syncedDocHashes = new Map<string, string>();

function isQuotaError(err: any): boolean {
  const msg = (err?.message || err?.code || String(err || '')).toLowerCase();
  return msg.includes('resource-exhausted') || msg.includes('quota limit exceeded') || msg.includes('resource_exhausted') || err?.code === 'resource-exhausted';
}

function isWritingPaused(): boolean {
  return Date.now() < writeCooldownUntil;
}

function handleSyncError(err: any, contextMsg: string) {
  if (isQuotaError(err)) {
    // Soft 10-second backoff instead of permanently shutting off all saves
    writeCooldownUntil = Date.now() + 10000;
    console.warn(`[CloudSync] Firestore write rate notice during ${contextMsg}. Pausing cloud writes for 10s.`);
    return;
  }
  console.warn(`[CloudSync] ${contextMsg}:`, err?.message || err);
}

function computeDataHash(data: any): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(Date.now());
  }
}

/**
 * Deep-cleans an object before saving to Firestore to remove undefined properties and functions
 */
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore);
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined && typeof val !== 'function') {
      clean[key] = cleanForFirestore(val);
    }
  }
  return clean;
}

const CHUNK_SIZE = 600000; // 600KB chunk size to stay safely under Firestore's 1MB limit

/**
 * Save an asset directly to Firestore cloud storage collection.
 * Automatically chunks large files (like songs/audio) into subcollection documents.
 */
export async function saveAssetToCloud(id: string, dataUrl: string): Promise<void> {
  if (isWritingPaused()) return;
  try {
    const user = auth.currentUser;
    if (!user || !id || !dataUrl) return;
    const docKey = `asset:${user.uid}:${id}`;
    const hash = computeDataHash(id + dataUrl.length + dataUrl.substring(0, 50));
    if (syncedDocHashes.get(docKey) === hash) return;

    const assetDocRef = doc(db, 'users', user.uid, 'assets', id);

    if (dataUrl.length > CHUNK_SIZE) {
      // Chunking for large audio songs
      const chunks: string[] = [];
      for (let i = 0; i < dataUrl.length; i += CHUNK_SIZE) {
        chunks.push(dataUrl.substring(i, i + CHUNK_SIZE));
      }

      await setDoc(assetDocRef, {
        id,
        isChunked: true,
        totalChunks: chunks.length,
        totalLength: dataUrl.length,
        updatedAt: Date.now()
      }, { merge: true });

      const chunkWrites = chunks.map((chunk, index) => {
        const chunkRef = doc(db, 'users', user.uid, 'assets', id, 'chunks', String(index));
        return setDoc(chunkRef, { index, data: chunk, updatedAt: Date.now() });
      });

      await Promise.all(chunkWrites);
    } else {
      const payload = cleanForFirestore({
        id,
        isChunked: false,
        data: dataUrl,
        updatedAt: Date.now()
      });
      await setDoc(assetDocRef, payload, { merge: true });
    }

    syncedDocHashes.set(docKey, hash);
  } catch (err) {
    handleSyncError(err, 'saveAssetToCloud');
  }
}

/**
 * Fetch an asset directly from Firestore cloud storage collection.
 * Automatically reassembles chunked audio files if stored across subcollection documents.
 */
export async function getAssetFromCloud(id: string): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user || !id) return null;
    const assetDocRef = doc(db, 'users', user.uid, 'assets', id);
    const snap = await getDoc(assetDocRef);
    if (!snap.exists()) return null;

    const docData = snap.data();
    if (!docData) return null;

    if (docData.isChunked) {
      const chunksSnap = await getDocs(collection(db, 'users', user.uid, 'assets', id, 'chunks'));
      if (chunksSnap.empty) return null;

      const chunkDocs = chunksSnap.docs
        .map(d => d.data())
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      return chunkDocs.map(c => c.data || '').join('');
    }

    if (typeof docData.data === 'string') {
      return docData.data;
    }
  } catch (err) {
    handleSyncError(err, 'getAssetFromCloud');
  }
  return null;
}

/**
 * 1. Create a Session (Linked to the User)
 * When starting a new session with a character, write a "session document" to Firestore
 * that explicitly records which user owns it.
 */
export async function createNewSession(
  userId: string, 
  characterId: string, 
  characterName: string,
  extraSessionData?: Partial<ChatHistory>
): Promise<string> {
  try {
    const sessionRef = doc(collection(db, "chats"));
    const sessionId = extraSessionData?.id || sessionRef.id;
    const effectiveRef = extraSessionData?.id ? doc(db, "chats", extraSessionData.id) : sessionRef;

    const { messages: initMsgs, ...extraCleanData } = extraSessionData || {};
    const sessionPayload = cleanForFirestore({
      sessionId: sessionId,
      id: sessionId,
      userId: userId,
      characterId: characterId,
      characterName: characterName,
      personaId: characterId,
      personaName: characterName,
      createdAt: serverTimestamp(),
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
      lastMessage: extraSessionData?.lastMessage || '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      avatarGradient: extraSessionData?.avatarGradient || 'from-zinc-500 to-zinc-600',
      linkedWorldId: extraSessionData?.linkedWorldId || undefined,
      userPersonaId: extraSessionData?.userPersonaId || undefined,
      userPersonaName: extraSessionData?.userPersonaName || undefined,
      userPersonaAvatar: extraSessionData?.userPersonaAvatar || undefined,
      userPersonaDesc: extraSessionData?.userPersonaDesc || undefined,
      isArchived: false,
      isPinned: false,
      deletedMessageIds: [],
      ...extraCleanData
    });

    if (userId) {
      const userChatRef = doc(db, 'users', userId, 'chats', sessionId);
      await setDoc(userChatRef, sessionPayload, { merge: true }).catch(() => {});
    } else {
      await setDoc(effectiveRef, sessionPayload, { merge: true }).catch(err => {
        console.warn('[CloudSync] createNewSession /chats notice:', err);
      });
    }

    // Save initial greeting messages directly to subcollection
    if (Array.isArray(initMsgs) && initMsgs.length > 0) {
      for (const m of initMsgs) {
        if (m && m.text) {
          await saveMessageToSubcollection(sessionId, m).catch(() => {});
        }
      }
    }

    return sessionId;
  } catch (err) {
    console.warn('[CloudSync] createNewSession error:', err);
    return extraSessionData?.id || `chat-${Date.now()}`;
  }
}

/**
 * 2. Fetch Saved Sessions on Login
 * When your user signs back in or opens the app, query Firestore to pull all sessions belonging to their userId.
 */
export async function loadUserSessions(userId: string): Promise<ChatHistory[]> {
  if (!userId) return [];
  try {
    const sessionsMap = new Map<string, ChatHistory>();

    // 1. Primary source: Query /users/{userId}/chats first!
    try {
      const userChatsSnap = await getDocs(collection(db, 'users', userId, 'chats'));
      if (userChatsSnap && !userChatsSnap.empty) {
        userChatsSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const id = data.sessionId || data.id || docSnap.id;
          if (!id) return;
          const charId = data.characterId || data.personaId || 'companion';
          const charName = data.characterName || data.personaName || 'Companion';
          sessionsMap.set(id, {
            id,
            sessionId: id,
            userId: data.userId || userId,
            characterId: charId,
            characterName: charName,
            personaId: charId,
            personaName: charName,
            avatarGradient: data.avatarGradient || 'from-zinc-500 to-zinc-600',
            lastMessage: data.lastMessage || '',
            timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : (data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now()),
            lastMessageAt: data.lastMessageAt || data.updatedAt || Date.now(),
            createdAt: data.createdAt,
            messages: Array.isArray(data.messages) ? data.messages : [],
            isPinned: !!data.isPinned,
            isArchived: !!data.isArchived,
            linkedWorldId: data.linkedWorldId,
            userPersonaId: data.userPersonaId || undefined,
            userPersonaName: data.userPersonaName || undefined,
            userPersonaAvatar: data.userPersonaAvatar || undefined,
            userPersonaDesc: data.userPersonaDesc || undefined,
            deletedMessageIds: Array.isArray(data.deletedMessageIds) ? data.deletedMessageIds : []
          });
        });
      }
    } catch (err) {
      console.warn('[CloudSync] /users/chats query notice:', err);
    }

    // 2. Also check legacy /chats where userId == userId for older chats not yet migrated
    try {
      const q = query(
        collection(db, "chats"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot && !querySnapshot.empty) {
        querySnapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const id = data.sessionId || data.id || docSnap.id;
          if (!id) return;
          if (!sessionsMap.has(id)) {
            const charId = data.characterId || data.personaId || 'companion';
            const charName = data.characterName || data.personaName || 'Companion';
            sessionsMap.set(id, {
              id,
              sessionId: id,
              userId: data.userId || userId,
              characterId: charId,
              characterName: charName,
              personaId: charId,
              personaName: charName,
              avatarGradient: data.avatarGradient || 'from-zinc-500 to-zinc-600',
              lastMessage: data.lastMessage || '',
              timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
              updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : (data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now()),
              lastMessageAt: data.lastMessageAt || data.updatedAt || Date.now(),
              createdAt: data.createdAt,
              messages: Array.isArray(data.messages) ? data.messages : [],
              isPinned: !!data.isPinned,
              isArchived: !!data.isArchived,
              linkedWorldId: data.linkedWorldId,
              userPersonaId: data.userPersonaId || undefined,
              userPersonaName: data.userPersonaName || undefined,
              userPersonaAvatar: data.userPersonaAvatar || undefined,
              userPersonaDesc: data.userPersonaDesc || undefined,
              deletedMessageIds: Array.isArray(data.deletedMessageIds) ? data.deletedMessageIds : []
            });
          }
        });
      }
    } catch (err) {
      console.warn('[CloudSync] /chats where query warning:', err);
    }

    const sessions = Array.from(sessionsMap.values()).sort((a, b) => {
      return (b.lastMessageAt || b.updatedAt || 0) - (a.lastMessageAt || a.updatedAt || 0);
    });

    return sessions;
  } catch (err) {
    console.warn('[CloudSync] loadUserSessions failed:', err);
    return [];
  }
}

/**
 * 3. Send and Save Messages
 * Append messages to a specific session in the subcollection of that exact sessionId.
 */
export async function sendMessage(
  sessionId: string,
  senderId: string,
  text: string,
  extraMsgData?: Partial<ChatMessage>
): Promise<string> {
  if (isWritingPaused() || !sessionId || !text) return '';

  try {
    const user = auth.currentUser;
    if (!user || !user.uid) {
      console.warn('[CloudSync] No user logged in');
      return '';
    }

    const msgId = extraMsgData?.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Force correct role + isUser
    const isUser = extraMsgData?.isUser === true || extraMsgData?.role === 'user';
    const role: 'user' | 'ai' | 'system' = isUser ? 'user' : (extraMsgData?.role === 'system' ? 'system' : 'ai');

    const msgPayload = cleanForFirestore({
      id: msgId,
      text: text,
      senderId: senderId || user.uid,
      role: role,
      isUser: isUser,
      timestamp: serverTimestamp(),
      numericTimestamp: Date.now(),
      alternatives: extraMsgData?.alternatives || null,
      activeAlternativeIndex: extraMsgData?.activeAlternativeIndex ?? 0,
      image: extraMsgData?.image || null
    });

    const docKey = `msg:${sessionId}:${msgId}`;
    syncedDocHashes.set(docKey, computeDataHash(msgPayload));

    // === ONLY write to one place ===
    const userMsgRef = doc(db, 'users', user.uid, 'chats', sessionId, 'messages', msgId);
    await setDoc(userMsgRef, msgPayload, { merge: true });

    // Update parent chat metadata (safe merge)
    const sessionUpdate = cleanForFirestore({
      lastMessage: text.substring(0, 500),
      lastMessageAt: Date.now(),
      updatedAt: Date.now(),
    });

    const userChatRef = doc(db, 'users', user.uid, 'chats', sessionId);
    await setDoc(userChatRef, sessionUpdate, { merge: true });

    return msgId;
  } catch (err) {
    handleSyncError(err, 'sendMessage');
    return '';
  }
}

/**
 * Appends or updates an individual message document inside the subcollection:
 * users/{userId}/chats/{chatId}/messages/{messageId}
 */
export async function saveMessageToSubcollection(chatId: string, message: ChatMessage): Promise<void> {
  if (!chatId || !message || !message.text) return;
  const user = auth.currentUser;
  const isUserMsg = message.isUser === true || message.role === 'user';
  const senderId = isUserMsg ? (user ? user.uid : 'user') : 'assistant';
  await sendMessage(chatId, senderId, message.text, message);
}

/**
 * Deletes an individual message document from Firestore subcollections:
 * users/{userId}/chats/{chatId}/messages/{messageId}
 */
export async function deleteMessageFromSubcollection(chatId: string, messageId: string): Promise<void> {
  if (isWritingPaused() || !chatId || !messageId) return;
  try {
    const user = auth.currentUser;
    const docKey = `msg:${chatId}:${messageId}`;
    syncedDocHashes.delete(docKey);

    if (user && user.uid) {
      const userMsgRef = doc(db, 'users', user.uid, 'chats', chatId, 'messages', messageId);
      await deleteDoc(userMsgRef).catch(() => {});
    }
  } catch (err) {
    console.warn('[CloudSync] deleteMessageFromSubcollection warning:', err);
  }
}

/**
 * Specifically query the messages subcollection from users/{userId}/chats/{chatId}/messages
 * ordered by numericTimestamp asc.
 * Automatically excludes any tombstoned / deleted message IDs.
 */
export async function loadChatMessagesFromSubcollection(
  chatId: string,
  deletedMessageIds: string[] = []
): Promise<ChatMessage[]> {
  try {
    const user = auth.currentUser;
    if (!user || !user.uid || !chatId) return [];

    const deletedSet = new Set(deletedMessageIds || []);

    // === Query user subcollection directly without Firestore field exclusion ===
    const userColRef = collection(db, 'users', user.uid, 'chats', chatId, 'messages');
    let snap = await getDocs(userColRef).catch(() => null);

    // Fallback: If empty, check legacy root chats subcollection and migrate forward
    if (!snap || snap.empty) {
      const legacyColRef = collection(db, 'chats', chatId, 'messages');
      const legacySnap = await getDocs(legacyColRef).catch(() => null);
      if (legacySnap && !legacySnap.empty) {
        snap = legacySnap;
        (async () => {
          try {
            for (const docSnap of legacySnap.docs) {
              const uRef = doc(db, 'users', user.uid, 'chats', chatId, 'messages', docSnap.id);
              await setDoc(uRef, docSnap.data(), { merge: true }).catch(() => {});
            }
          } catch {}
        })();
      }
    }

    if (!snap || snap.empty) return [];

    const getDocTimestamp = (data: any): number => {
      if (typeof data.numericTimestamp === 'number' && !isNaN(data.numericTimestamp)) return data.numericTimestamp;
      if (data.timestamp?.toMillis && typeof data.timestamp.toMillis === 'function') return data.timestamp.toMillis();
      if (typeof data.timestamp === 'number') return data.timestamp;
      if (data.createdAt?.toMillis && typeof data.createdAt.toMillis === 'function') return data.createdAt.toMillis();
      if (typeof data.createdAt === 'number') return data.createdAt;
      return 0;
    };

    const sortedDocs = [...snap.docs].sort((a, b) => getDocTimestamp(a.data()) - getDocTimestamp(b.data()));

    return sortedDocs
      .filter(d => !deletedSet.has(d.id))
      .map(d => {
        const data = d.data();
        const isUser = data.isUser === true || data.role === 'user';
        const rawTime = getDocTimestamp(data);

        return {
          id: d.id,
          text: data.text || '',
          role: (isUser ? 'user' : (data.role === 'system' ? 'system' : 'ai')) as 'user' | 'ai' | 'system',
          isUser: isUser,
          timestamp: rawTime > 0
            ? new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          alternatives: data.alternatives || undefined,
          activeAlternativeIndex: data.activeAlternativeIndex ?? 0,
          image: data.image || undefined
        };
      });
  } catch (err) {
    console.warn('[CloudSync] loadChatMessagesFromSubcollection error:', err);
    return [];
  }
}

/**
 * Real-time listener for the chat history in users/{userId}/chats/{chatId}/messages
 * Automatically suppresses any message IDs marked as deleted.
 */
export function subscribeToChatMessages(
  chatId: string, 
  onMessagesUpdated: (messages: ChatMessage[]) => void,
  getDeletedIds?: () => string[]
): () => void {
  if (!chatId) return () => {};

  const user = auth.currentUser;
  if (!user || !user.uid) return () => {};

  const userColRef = collection(db, 'users', user.uid, 'chats', chatId, 'messages');

  const getDocTimestamp = (data: any): number => {
    if (typeof data.numericTimestamp === 'number' && !isNaN(data.numericTimestamp)) return data.numericTimestamp;
    if (data.timestamp?.toMillis && typeof data.timestamp.toMillis === 'function') return data.timestamp.toMillis();
    if (typeof data.timestamp === 'number') return data.timestamp;
    if (data.createdAt?.toMillis && typeof data.createdAt.toMillis === 'function') return data.createdAt.toMillis();
    if (typeof data.createdAt === 'number') return data.createdAt;
    return 0;
  };

  return onSnapshot(userColRef, (snapshot) => {
    if (!snapshot.empty) {
      const deletedSet = new Set(getDeletedIds ? getDeletedIds() : []);
      const sortedDocs = [...snapshot.docs].sort((a, b) => getDocTimestamp(a.data()) - getDocTimestamp(b.data()));
      const msgs: ChatMessage[] = sortedDocs
        .filter(d => !deletedSet.has(d.id))
        .map(d => {
          const data = d.data();
          const isUser = data.isUser === true || data.role === 'user';
          const rawTime = getDocTimestamp(data);
          return {
            id: d.id,
            text: data.text || '',
            role: (isUser ? 'user' : (data.role === 'system' ? 'system' : 'ai')) as 'user' | 'ai' | 'system',
            isUser: isUser,
            timestamp: rawTime > 0
              ? new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            alternatives: data.alternatives || undefined,
            activeAlternativeIndex: data.activeAlternativeIndex ?? 0,
            image: data.image || undefined
          };
        });
      onMessagesUpdated(msgs);
    }
  }, (err) => {
    console.warn('[CloudSync] Realtime chat messages listener warning:', err);
  });
}

/**
 * Immediately persist a single active chat session directly to Firestore subcollection.
 * This guarantees real-time cloud durability for every message sent or memory generated!
 */
export async function saveSingleChatToCloud(chat: ChatHistory): Promise<void> {
  if (isWritingPaused()) return;
  try {
    const user = auth.currentUser;
    if (!chat || !chat.id) return;
    
    const deletedSet = new Set(chat.deletedMessageIds || []);

    // Clean deleted message subcollections if any were tombstoned
    if (chat.deletedMessageIds && chat.deletedMessageIds.length > 0) {
      for (const dId of chat.deletedMessageIds) {
        deleteMessageFromSubcollection(chat.id, dId).catch(() => {});
      }
    }

    const docKey = `chat:${user ? user.uid : 'anon'}:${chat.id}`;
    // Omit messages array so parent doc stores ONLY session metadata
    const { messages: _omittedMessages, ...chatMeta } = chat;
    const payload = cleanForFirestore({
      ...chatMeta,
      sessionId: chat.sessionId || chat.id,
      userId: chat.userId || (user ? user.uid : undefined),
      characterId: chat.characterId || chat.personaId,
      characterName: chat.characterName || chat.personaName,
      userPersonaId: chat.userPersonaId || undefined,
      userPersonaName: chat.userPersonaName || undefined,
      userPersonaAvatar: chat.userPersonaAvatar || undefined,
      userPersonaDesc: chat.userPersonaDesc || undefined,
      createdAt: chat.createdAt || serverTimestamp(),
      updatedAt: chat.updatedAt || Date.now(),
      lastMessageAt: chat.lastMessageAt || Date.now()
    });
    const hash = computeDataHash(payload);
    
    if (syncedDocHashes.get(docKey) !== hash) {
      if (user && user.uid) {
        const userChatRef = doc(db, 'users', user.uid, 'chats', chat.id);
        await setDoc(userChatRef, payload, { merge: true });
      } else {
        const directChatRef = doc(db, 'chats', chat.id);
        await setDoc(directChatRef, payload, { merge: true });
      }
      syncedDocHashes.set(docKey, hash);
    }

    // Persist only the latest 1-2 non-deleted messages if not already synced to avoid redundant writes
    if (Array.isArray(chat.messages) && chat.messages.length > 0) {
      const recent = chat.messages.slice(-2);
      for (const msg of recent) {
        if (msg && msg.text && !msg.isStreaming && !deletedSet.has(msg.id)) {
          const msgDocKey = `msg:${chat.id}:${msg.id}`;
          if (!syncedDocHashes.has(msgDocKey)) {
            await saveMessageToSubcollection(chat.id, msg);
          }
        }
      }
    }
  } catch (err) {
    handleSyncError(err, 'saveSingleChatToCloud');
  }
}

/**
 * Update and persist the user persona directly to the chat document in Firestore.
 */
export async function saveUserPersonaToChat(
  chatId: string,
  userPersona: {
    id: string;
    name: string;
    avatar?: string;
    description?: string;
  }
) {
  const user = auth.currentUser;
  if (!user || !user.uid || !chatId) return;

  const chatRef = doc(db, 'users', user.uid, 'chats', chatId);

  await setDoc(
    chatRef,
    {
      userPersonaId: userPersona.id || '',
      userPersonaName: userPersona.name || '',
      userPersonaAvatar: userPersona.avatar || '',
      userPersonaDesc: userPersona.description || '',
      updatedAt: Date.now(),
    },
    { merge: true } // very important - does not erase other fields
  );
}

export const updateChatUserPersonaInCloud = saveUserPersonaToChat;

/**
 * Push complete configuration and granular subcollections to Firestore.
 * Avoids single 1MB document limitations by storing full chat histories in dedicated subcollections.
 */
export async function pushConfigToCloud(config: StorageConfig): Promise<void> {
  if (isWritingPaused()) return;
  const user = auth.currentUser;
  if (!user) return;

  try {
    updateSyncState({ status: 'syncing' });
    const userDocRef = doc(db, 'users', user.uid);

    // Build lightweight chat summaries for the root user doc to guarantee it never exceeds 1MB limit
    const chatSummaries = (config.chatHistories || []).slice(0, 100).map(c => ({
      id: c.id,
      personaId: c.personaId,
      personaName: c.personaName,
      lastMessage: (c.lastMessage || '').substring(0, 200),
      timestamp: c.timestamp,
      updatedAt: c.updatedAt || Date.now(),
      linkedWorldId: c.linkedWorldId || null,
      isArchived: c.isArchived || false
    }));

    const rootPayload = cleanForFirestore({
      apiKey: config.apiKey || '',
      apiKeys: config.apiKeys || [],
      worldApiKey: config.worldApiKey || '',
      useSameApiKey: config.useSameApiKey !== false,
      useServerKeyFallback: config.useServerKeyFallback !== false,
      selectedPersonaId: config.selectedPersonaId || '',
      selectedModel: config.selectedModel || 'gemini-3.1-flash-lite',
      activeWorldId: config.activeWorldId || null,
      theme: config.theme || 'dark',
      isPerformanceMode: config.isPerformanceMode !== false,
      hasOnboarded: config.hasOnboarded || false,
      userProfile: config.userProfile || null,
      userPersonas: config.userPersonas || [],
      activeUserPersonaId: config.activeUserPersonaId || '',
      orbs: typeof config.orbs === 'number' ? config.orbs : 50,
      orbTransactions: config.orbTransactions || [],
      deletedChatIds: (config.deletedChatIds || []).filter(id => Boolean(id && typeof id === 'string' && id.trim().length > 0)),
      deletedPersonaIds: (config.deletedPersonaIds || []).filter(id => Boolean(id && typeof id === 'string' && id.trim().length > 0)),
      deletedWorldIds: (config.deletedWorldIds || []).filter(id => Boolean(id && typeof id === 'string' && id.trim().length > 0)),
      likedPersonaIds: config.likedPersonaIds || [],
      likedWorldIds: config.likedWorldIds || [],
      chatSummaries,
      samplerMaxContext: config.samplerMaxContext,
      samplerGeneratedTokens: config.samplerGeneratedTokens,
      samplerTemperature: config.samplerTemperature,
      samplerTopP: config.samplerTopP,
      samplerPresencePenalty: config.samplerPresencePenalty,
      samplerFrequencyPenalty: config.samplerFrequencyPenalty,
      samplerSeed: config.samplerSeed,
      messageTextSize: config.messageTextSize,
      chatLayout: config.chatLayout,
      lastDevice: typeof navigator !== 'undefined' ? navigator.userAgent : 'web'
    });

    const rootDocKey = `root:${user.uid}`;
    const rootHash = computeDataHash(rootPayload);
    if (syncedDocHashes.get(rootDocKey) !== rootHash) {
      await setDoc(userDocRef, { ...rootPayload, updatedAt: Date.now() }, { merge: true });
      syncedDocHashes.set(rootDocKey, rootHash);
    }

    // Sync granular documents for characters, worlds, and chats
    await syncSubcollectionsNonBlocking(user.uid, config);

    updateSyncState({
      status: 'synced',
      lastSyncedAt: Date.now(),
      errorMessage: null
    });
  } catch (err: any) {
    handleSyncError(err, 'pushConfigToCloud');
  }
}

/**
 * Synchronize subcollections in parallel with chunked promises
 */
async function syncSubcollectionsNonBlocking(userId: string, config: StorageConfig) {
  if (isWritingPaused()) return;
  try {
    const promises: Promise<any>[] = [];

    // 1. Sync full Chat Sessions (only write if modified)
    for (const chat of config.chatHistories || []) {
      if (chat && chat.id) {
        const docKey = `chat:${userId}:${chat.id}`;
        const payload = cleanForFirestore({ ...chat, updatedAt: chat.updatedAt || Date.now() });
        const hash = computeDataHash(payload);
        if (syncedDocHashes.get(docKey) !== hash) {
          const chatRef = doc(db, 'users', userId, 'chats', chat.id);
          promises.push(
            setDoc(chatRef, payload, { merge: true })
              .then(() => syncedDocHashes.set(docKey, hash))
              .catch(err => handleSyncError(err, `Chat sync notice (${chat.id})`))
          );
        }
      }
    }

    // 2. Sync Characters (only write if modified, linked to user)
    const allChars = [...(config.characters || []), ...(config.customPersonas || [])];
    const uniqueChars = Array.from(new Map(allChars.map(c => [c.id, c])).values());
    for (const char of uniqueChars) {
      if (char && char.id) {
        const docKey = `char:${userId}:${char.id}`;
        const payload = cleanForFirestore({ 
          ...char, 
          userId, 
          updatedAt: (char as any).updatedAt || Date.now() 
        });
        const hash = computeDataHash(payload);
        if (syncedDocHashes.get(docKey) !== hash) {
          const charRef = doc(db, 'users', userId, 'characters', char.id);
          const rootCharRef = doc(db, 'characters', char.id);
          promises.push(
            Promise.all([
              setDoc(charRef, payload, { merge: true }),
              setDoc(rootCharRef, payload, { merge: true })
            ])
              .then(() => syncedDocHashes.set(docKey, hash))
              .catch(err => handleSyncError(err, `Character sync notice (${char.id})`))
          );
        }
      }
    }

    // 3. Sync Worlds (only write if modified, linked to user)
    for (const world of config.worlds || []) {
      if (world && world.id) {
        const docKey = `world:${userId}:${world.id}`;
        const payload = cleanForFirestore({ 
          ...world, 
          userId, 
          updatedAt: world.updatedAt || Date.now() 
        });
        const hash = computeDataHash(payload);
        if (syncedDocHashes.get(docKey) !== hash) {
          const worldRef = doc(db, 'users', userId, 'worlds', world.id);
          const rootWorldRef = doc(db, 'worlds', world.id);
          promises.push(
            Promise.all([
              setDoc(worldRef, payload, { merge: true }),
              setDoc(rootWorldRef, payload, { merge: true })
            ])
              .then(() => syncedDocHashes.set(docKey, hash))
              .catch(err => handleSyncError(err, `World sync notice (${world.id})`))
          );
        }
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  } catch (e) {
    handleSyncError(e, 'syncSubcollectionsNonBlocking');
  }
}

/**
 * Debounced save to cloud
 */
export function scheduleCloudSave(config: StorageConfig, delayMs = 150): void {
  if (isApplyingRemoteChange) return;
  if (debounceSaveTimer) clearTimeout(debounceSaveTimer);

  debounceSaveTimer = setTimeout(() => {
    pushConfigToCloud(config);
  }, delayMs);
}

/**
 * Pull and merge all user cloud data completely without losing any past chats or data
 */
export async function pullCloudData(
  userId: string, 
  localConfig: StorageConfig
): Promise<StorageConfig> {
  try {
    updateSyncState({ status: 'syncing' });
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);

    let cloudRoot: Partial<StorageConfig> = {};
    if (snap.exists()) {
      cloudRoot = snap.data() as Partial<StorageConfig>;
    }

    // Fetch all subcollection documents in parallel, including user-linked sessions from /chats, /characters, and /worlds
    const qUserCharacters = query(
      collection(db, "characters"), 
      where("userId", "==", userId)
    );
    const qUserWorlds = query(
      collection(db, "worlds"), 
      where("userId", "==", userId)
    );
    const [charSnaps, rootCharSnaps, worldSnaps, rootWorldSnaps, chatSnaps, userSessionsFromChats] = await Promise.all([
      getDocs(collection(db, 'users', userId, 'characters')).catch(err => {
        handleFirestoreError(err, OperationType.LIST, `users/${userId}/characters`);
        return null;
      }),
      getDocs(qUserCharacters).catch(err => {
        handleFirestoreError(err, OperationType.LIST, `characters?userId=${userId}`);
        return null;
      }),
      getDocs(collection(db, 'users', userId, 'worlds')).catch(err => {
        handleFirestoreError(err, OperationType.LIST, `users/${userId}/worlds`);
        return null;
      }),
      getDocs(qUserWorlds).catch(err => {
        handleFirestoreError(err, OperationType.LIST, `worlds?userId=${userId}`);
        return null;
      }),
      getDocs(collection(db, 'users', userId, 'chats')).catch(err => {
        handleFirestoreError(err, OperationType.LIST, `users/${userId}/chats`);
        return null;
      }),
      loadUserSessions(userId).catch(() => [])
    ]);

    const cloudChars: Persona[] = [];
    if (charSnaps && !charSnaps.empty) {
      charSnaps.forEach(d => {
        const c = d.data() as Persona;
        if (c && c.id && (!c.userId || c.userId === userId)) cloudChars.push(c);
      });
    }
    if (rootCharSnaps && !rootCharSnaps.empty) {
      rootCharSnaps.forEach(d => {
        const c = d.data() as Persona;
        if (c && c.id && (!c.userId || c.userId === userId)) cloudChars.push(c);
      });
    }

    const cloudWorlds: World[] = [];
    if (worldSnaps && !worldSnaps.empty) {
      worldSnaps.forEach(d => {
        const w = d.data() as World;
        if (w && w.id && (!w.userId || w.userId === userId)) cloudWorlds.push(w);
      });
    }
    if (rootWorldSnaps && !rootWorldSnaps.empty) {
      rootWorldSnaps.forEach(d => {
        const w = d.data() as World;
        if (w && w.id && (!w.userId || w.userId === userId)) cloudWorlds.push(w);
      });
    }

    const cloudChats: ChatHistory[] = [...(userSessionsFromChats || [])];
    if (chatSnaps && !chatSnaps.empty) {
      chatSnaps.forEach(d => {
        const ch = d.data() as ChatHistory;
        if (ch && ch.id) cloudChats.push(ch);
      });
    }

    // Support legacy chatHistories from root doc if present
    const legacyChats = (cloudRoot as any).chatHistories || [];

    // Perform safe, non-destructive union with local data, strictly filtering by user
    const allLocalChars = [...(localConfig.characters || []), ...(localConfig.customPersonas || [])].filter(c => !c.userId || c.userId === userId);
    const allCloudChars = [...(cloudRoot.characters || []), ...(cloudRoot.customPersonas || []), ...cloudChars].filter(c => !c.userId || c.userId === userId);
    const mergedCharacters = mergePersonas(allCloudChars, allLocalChars);

    const mergedWorlds = mergeWorlds(
      [...(cloudRoot.worlds || []), ...cloudWorlds], 
      localConfig.worlds || []
    );

    const deletedChatIds = Array.from(new Set([
      ...(cloudRoot.deletedChatIds || []),
      ...(localConfig.deletedChatIds || [])
    ])).filter(id => Boolean(id && typeof id === 'string' && id.trim().length > 0));

    const deletedPersonaIds = Array.from(new Set([
      ...(cloudRoot.deletedPersonaIds || []),
      ...(localConfig.deletedPersonaIds || [])
    ])).filter(id => Boolean(id && typeof id === 'string' && id.trim().length > 0));

    const deletedWorldIds = Array.from(new Set([
      ...(cloudRoot.deletedWorldIds || []),
      ...(localConfig.deletedWorldIds || [])
    ])).filter(id => Boolean(id && typeof id === 'string' && id.trim().length > 0));

    const deletedPersonaSet = new Set(deletedPersonaIds);
    const deletedWorldSet = new Set(deletedWorldIds);

    const allCandidateChats = [...legacyChats, ...cloudChats];
    const mergedChats = mergeChatHistories(
      allCandidateChats, 
      localConfig.chatHistories || [],
      deletedChatIds
    );

    const mergedUserPersonas = mergeUserPersonas(
      cloudRoot.userPersonas || [],
      localConfig.userPersonas || []
    );

    const mergedUserProfile = mergeUserProfiles(cloudRoot.userProfile, localConfig.userProfile);

    const cleanedCharacters = mergedCharacters.filter(c => c && !PRESET_COMPANION_IDS.has(c.id) && !deletedPersonaSet.has(c.id));
    const cleanedWorlds = mergedWorlds.filter(w => w && !deletedWorldSet.has(w.id));
    const cleanedUserPersonas = mergedUserPersonas.filter(up => 
      up && !PRESET_USER_PERSONA_IDS.has(up.id) && up.name !== 'Explorer' && up.name !== 'Averick'
    );

    const finalConfig: StorageConfig = {
      ...localConfig,
      ...cloudRoot,
      userProfile: mergedUserProfile,
      characters: cleanedCharacters,
      customPersonas: cleanedCharacters.filter(c => c.isCustom),
      worlds: cleanedWorlds,
      chatHistories: mergedChats,
      deletedChatIds,
      deletedPersonaIds,
      deletedWorldIds,
      userPersonas: cleanedUserPersonas,
      activeUserPersonaId: (cloudRoot.activeUserPersonaId && cleanedUserPersonas.some(up => up.id === cloudRoot.activeUserPersonaId))
        ? cloudRoot.activeUserPersonaId
        : (localConfig.activeUserPersonaId && cleanedUserPersonas.some(up => up.id === localConfig.activeUserPersonaId))
          ? localConfig.activeUserPersonaId
          : (cleanedUserPersonas[0]?.id || ''),
      selectedPersonaId: PRESET_COMPANION_IDS.has(cloudRoot.selectedPersonaId || '')
        ? (cleanedCharacters[0]?.id || '')
        : (cloudRoot.selectedPersonaId || cleanedCharacters[0]?.id || ''),
      orbs: typeof cloudRoot.orbs === 'number' ? cloudRoot.orbs : (localConfig.orbs ?? 50),
      likedPersonaIds: Array.from(new Set([...(cloudRoot.likedPersonaIds || []), ...(localConfig.likedPersonaIds || [])])),
      likedWorldIds: Array.from(new Set([...(cloudRoot.likedWorldIds || []), ...(localConfig.likedWorldIds || [])])),
    };

    // Preload all assets in memory cache for instant avatar/media display
    preloadConfigAssets(finalConfig).catch(() => {});

    // Save locally to both localStorage and IndexedDB
    saveStorageConfig(finalConfig);

    // If local had fresh entities, push merged back to cloud asynchronously
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
let activeChatsSnapshotUnsubscribe: (() => void) | null = null;

/**
 * Initialize cloud sync engine with Auth State Listener
 */
export async function initCloudSync(
  onConfigUpdated: (config: StorageConfig) => void,
  onAuthLoggedOut?: () => void
): Promise<void> {
  onAuthStateChanged(auth, async (user: User | null) => {
    // Clear previous real-time listeners on auth change
    if (activeSnapshotUnsubscribe) {
      activeSnapshotUnsubscribe();
      activeSnapshotUnsubscribe = null;
    }
    if (activeChatsSnapshotUnsubscribe) {
      activeChatsSnapshotUnsubscribe();
      activeChatsSnapshotUnsubscribe = null;
    }

    if (user) {
      console.log("User is active:", user.uid);
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

      // 1. Load ONLY the characters belonging to this user
      const q = query(
        collection(db, "characters"), 
        where("userId", "==", user.uid) // 👈 Protects other accounts' data
      );
      const querySnapshot = await getDocs(q).catch((err) => {
        console.warn("Characters query warning:", err);
        return null;
      });
      const myCharacters = querySnapshot ? querySnapshot.docs.map(doc => doc.data() as Persona) : [];

      // Fetch freshest local state from memory + IndexedDB
      const currentLocal = getStorageConfig();
      const idbConfig = await loadFromIndexedDB().catch(() => null);
      const combinedLocal = idbConfig ? {
        ...currentLocal,
        ...idbConfig,
        characters: mergePersonas(idbConfig.characters || [], currentLocal.characters || []),
        customPersonas: mergePersonas(idbConfig.customPersonas || [], currentLocal.customPersonas || []),
        worlds: mergeWorlds(idbConfig.worlds || [], currentLocal.worlds || []),
        chatHistories: mergeChatHistories(idbConfig.chatHistories || [], currentLocal.chatHistories || []),
        userPersonas: mergeUserPersonas(idbConfig.userPersonas || [], currentLocal.userPersonas || []),
        userProfile: mergeUserProfiles(idbConfig.userProfile, currentLocal.userProfile)
      } : currentLocal;

      // Pull & merge cloud data
      const merged = await pullCloudData(user.uid, combinedLocal);
      
      // Merge scoped characters
      if (myCharacters.length > 0) {
        merged.characters = mergePersonas(myCharacters, merged.characters || []);
      }

      onConfigUpdated(merged);

      // Listen for remote real-time root profile/settings changes
      const userDocRef = doc(db, 'users', user.uid);
      activeSnapshotUnsubscribe = onSnapshot(userDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const remoteData = snapshot.data() as Partial<StorageConfig>;
          const latestLocal = getStorageConfig();

          isApplyingRemoteChange = true;
          const updated: StorageConfig = {
            ...latestLocal,
            ...remoteData,
            userProfile: mergeUserProfiles(remoteData.userProfile, latestLocal.userProfile),
            activeUserPersonaId: (remoteData.activeUserPersonaId && remoteData.activeUserPersonaId.trim()) 
              ? remoteData.activeUserPersonaId 
              : latestLocal.activeUserPersonaId,
            userPersonas: (Array.isArray(remoteData.userPersonas) && remoteData.userPersonas.length > 0)
              ? mergeUserPersonas(remoteData.userPersonas, latestLocal.userPersonas || [])
              : latestLocal.userPersonas,
            characters: latestLocal.characters,
            worlds: latestLocal.worlds,
            chatHistories: latestLocal.chatHistories,
          };

          preloadConfigAssets(updated).catch(() => {});
          saveStorageConfig(updated);
          onConfigUpdated(updated);
          setTimeout(() => {
            isApplyingRemoteChange = false;
          }, 300);
        }
      }, (err) => {
        console.warn('Realtime root listener warning:', err);
      });

      // Listen for remote real-time chat subcollection updates
      const chatsColRef = collection(db, 'users', user.uid, 'chats');
      activeChatsSnapshotUnsubscribe = onSnapshot(chatsColRef, (snapshot) => {
        if (!snapshot.empty && !isApplyingRemoteChange) {
          const remoteChats: ChatHistory[] = [];
          snapshot.forEach(d => {
            const ch = d.data() as ChatHistory;
            if (ch && ch.id) remoteChats.push(ch);
          });

          if (remoteChats.length > 0) {
            const latest = getStorageConfig();
            const deleted = latest.deletedChatIds || [];
            const mergedChats = mergeChatHistories(remoteChats, latest.chatHistories || [], deleted);
            
            // Only update if there is a substantive change
            if (JSON.stringify(mergedChats) !== JSON.stringify(latest.chatHistories)) {
              isApplyingRemoteChange = true;
              const updated: StorageConfig = {
                ...latest,
                chatHistories: mergedChats
              };
              saveStorageConfig(updated);
              onConfigUpdated(updated);
              setTimeout(() => {
                isApplyingRemoteChange = false;
              }, 300);
            }
          }
        }
      }, (err) => {
        console.warn('Realtime chats listener warning:', err);
      });

    } else {
      // User is signed out or transitioning
      updateSyncState({
        isInitialized: true,
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

      if (onAuthLoggedOut) {
        onAuthLoggedOut();
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
/**
 * 3. Deleting Parents WITH Deleting Subcollections
 * Deleting a parent document (chat session) does not automatically delete its subcollections.
 * We query and delete all messages in /chats/{chatId}/messages and /users/{userId}/chats/{chatId}/messages
 * before deleting the parent session document!
 */
export async function deleteChatFromCloud(chatId: string): Promise<void> {
  if (!chatId) return;
  try {
    const user = auth.currentUser;

    // 1. Delete all messages inside /chats/{chatId}/messages subcollection
    try {
      const msgsRef = collection(db, 'chats', chatId, 'messages');
      const snap = await getDocs(msgsRef);
      if (!snap.empty) {
        const deleteOps = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deleteOps);
      }
    } catch (err) {
      console.warn(`[CloudSync] Subcollection message cleanup notice (${chatId}):`, err);
    }

    // 2. Delete all messages inside /users/{userId}/chats/{chatId}/messages subcollection
    if (user && user.uid) {
      try {
        const userMsgsRef = collection(db, 'users', user.uid, 'chats', chatId, 'messages');
        const userSnap = await getDocs(userMsgsRef);
        if (!userSnap.empty) {
          const deleteOps = userSnap.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deleteOps);
        }
      } catch {}
    }

    // 3. Delete parent chat document from root collection: /chats/{chatId}
    const directChatRef = doc(db, 'chats', chatId);
    await deleteDoc(directChatRef).catch(() => {});

    // 4. Delete parent chat document from user collection: /users/{userId}/chats/{chatId}
    if (user && user.uid) {
      const userChatRef = doc(db, 'users', user.uid, 'chats', chatId);
      await deleteDoc(userChatRef).catch(() => {});
    }

    // 5. Clean up cached sync hashes
    syncedDocHashes.delete(`chat:${user ? user.uid : 'anon'}:${chatId}`);

    // 6. Record tombstone in deletedChatIds to guarantee it never reappears
    const current = getStorageConfig();
    const currentDeleted = current.deletedChatIds || [];
    if (!currentDeleted.includes(chatId)) {
      const updatedDeleted = [...currentDeleted, chatId];
      const updatedChats = (current.chatHistories || []).filter(c => c.id !== chatId);
      const updatedConfig: StorageConfig = {
        ...current,
        chatHistories: updatedChats,
        deletedChatIds: updatedDeleted
      };
      saveStorageConfig(updatedConfig);
      pushConfigToCloud(updatedConfig);
    }
  } catch (err) {
    console.warn('[CloudSync] Failed to delete chat from cloud:', err);
  }
}

/**
 * 2. Deleting from Local State AND Firestore
 * Call deleteDoc() on the actual Firestore documents so the character never comes back.
 */
export async function deleteCharacterFromDatabase(characterId: string): Promise<void> {
  if (!characterId) return;
  try {
    const user = auth.currentUser;

    // 1. Delete from root collection: /characters/{characterId}
    await deleteDoc(doc(db, 'characters', characterId)).catch(() => {});

    // 2. Delete from user subcollection: /users/{userId}/characters/{characterId}
    if (user && user.uid) {
      await deleteDoc(doc(db, 'users', user.uid, 'characters', characterId)).catch(() => {});
    }

    // 3. Invalidate sync hash
    syncedDocHashes.delete(`char:${user ? user.uid : 'anon'}:${characterId}`);

    // 4. Cascade delete any chat sessions for this character (and their subcollections)
    const current = getStorageConfig();
    const relatedChats = (current.chatHistories || []).filter(h => h.personaId === characterId);
    for (const chat of relatedChats) {
      await deleteChatFromCloud(chat.id).catch(() => {});
    }

    // 5. Update local state and tombstone
    const updatedCustom = (current.customPersonas || []).filter(p => p.id !== characterId);
    const updatedCharacters = (current.characters || []).filter(p => p.id !== characterId);
    const updatedHistories = (current.chatHistories || []).filter(h => h.personaId !== characterId);
    const updatedDeleted = Array.from(new Set([...(current.deletedPersonaIds || []), characterId]));

    let nextSelected = current.selectedPersonaId;
    if (current.selectedPersonaId === characterId) {
      nextSelected = updatedCharacters[0]?.id || updatedCustom[0]?.id || '';
    }

    const updatedConfig: StorageConfig = {
      ...current,
      customPersonas: updatedCustom,
      characters: updatedCharacters,
      chatHistories: updatedHistories,
      deletedPersonaIds: updatedDeleted,
      selectedPersonaId: nextSelected
    };

    saveStorageConfig(updatedConfig);
    pushConfigToCloud(updatedConfig);
  } catch (err) {
    console.warn('[CloudSync] Failed to delete character from database:', err);
  }
}

/**
 * Delete world permanently from Firestore and local state
 */
export async function deleteWorldFromDatabase(worldId: string): Promise<void> {
  if (!worldId) return;
  try {
    const user = auth.currentUser;

    // 1. Delete from root collection: /worlds/{worldId}
    await deleteDoc(doc(db, 'worlds', worldId)).catch(() => {});

    // 2. Delete from user subcollection: /users/{userId}/worlds/{worldId}
    if (user && user.uid) {
      await deleteDoc(doc(db, 'users', user.uid, 'worlds', worldId)).catch(() => {});
    }

    // 3. Invalidate sync hash
    syncedDocHashes.delete(`world:${user ? user.uid : 'anon'}:${worldId}`);

    // 4. Cascade delete associated chat sessions
    const current = getStorageConfig();
    const relatedChats = (current.chatHistories || []).filter(
      h => h.linkedWorldId === worldId || h.personaId === `world-${worldId}`
    );
    for (const chat of relatedChats) {
      await deleteChatFromCloud(chat.id).catch(() => {});
    }

    // 5. Update local state and tombstone
    const updatedWorlds = (current.worlds || []).filter(w => w.id !== worldId);
    const updatedHistories = (current.chatHistories || []).filter(
      h => h.linkedWorldId !== worldId && h.personaId !== `world-${worldId}`
    );
    const updatedDeleted = Array.from(new Set([...(current.deletedWorldIds || []), worldId]));

    const updatedConfig: StorageConfig = {
      ...current,
      worlds: updatedWorlds,
      chatHistories: updatedHistories,
      deletedWorldIds: updatedDeleted
    };

    saveStorageConfig(updatedConfig);
    pushConfigToCloud(updatedConfig);
  } catch (err) {
    console.warn('[CloudSync] Failed to delete world from database:', err);
  }
}

// --- FUNCTION 1: SIGN OUT & WIPE LOCAL DATA ---
export async function handleSignOut(): Promise<void> {
  try {
    if (activeSnapshotUnsubscribe) {
      activeSnapshotUnsubscribe();
      activeSnapshotUnsubscribe = null;
    }
    if (activeChatsSnapshotUnsubscribe) {
      activeChatsSnapshotUnsubscribe();
      activeChatsSnapshotUnsubscribe = null;
    }
    
    // 1. Sign out of Firebase Auth
    await signOut(auth);
    
    // 2. Wipe LocalStorage & SessionStorage (destroys saved API keys)
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Storage clear warning:", e);
    }
    resetCachedStorage();
    
    console.log("Signed out and successfully cleared all device storage!");
  } catch (error) {
    console.error("Error during sign out:", error);
  }
}

export async function logoutAndReset(
  onConfigUpdated?: (config: StorageConfig) => void
): Promise<void> {
  await handleSignOut();
  const wipedConfig: StorageConfig = {
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
  };
  saveStorageConfig(wipedConfig);
  if (onConfigUpdated) {
    onConfigUpdated(wipedConfig);
  }
}
