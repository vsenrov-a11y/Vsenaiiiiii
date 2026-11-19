import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged,
  linkWithPopup,
  setPersistence,
  browserLocalPersistence,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
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
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with explicit browser local persistence
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn('Failed to set auth persistence:', err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore with specific database ID if configured
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.trim() !== ''
  ? firebaseConfig.firestoreDatabaseId
  : 'ai-studio-vsenai-24528b97-a25b-43e5-92ea-f2d6da5dbc49';

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {}, databaseId);
} catch (e) {
  firestoreInstance = getFirestore(app, databaseId);
}

export const db: Firestore = firestoreInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuota = errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded') || errMsg.includes('resource_exhausted');

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isQuota) {
    console.warn('[Firestore] Write quota limit reached for this project. Operating in local storage offline mode.');
  } else {
    console.warn('Firestore Notice:', JSON.stringify(errInfo));
  }
  return errInfo;
}

/**
 * Sign in with Google Popup directly to preserve the user click gesture and sync all local data.
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    if (user && !user.isAnonymous) {
      try {
        localStorage.setItem('vsen_is_google_linked', 'true');
      } catch {}
    }
    return user;
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked') {
      console.warn('Google Sign-In popup was blocked by browser or iframe policy:', err);
      throw new Error('Popup blocked by browser. Please allow popups for this site or open in a new tab.');
    }
    if (err?.code === 'auth/popup-closed-by-user') {
      console.log('Google Sign-In popup was closed by user.');
      return null;
    }
    console.error('Failed to sign in with Google:', err);
    throw err;
  }
}

/**
 * Ensures user has an active authenticated session (anonymous fallback if not logged in with Google)
 */
export async function ensureAuthenticatedUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        if (!user.isAnonymous) {
          try { localStorage.setItem('vsen_is_google_linked', 'true'); } catch {}
        }
        resolve(user);
      } else {
        // Only trigger anonymous sign-in if we are sure there is no linked Google account saved
        const isGoogleLinked = localStorage.getItem('vsen_is_google_linked') === 'true';
        if (isGoogleLinked) {
          // Give Firebase Auth another moment to restore session from IndexedDB
          setTimeout(async () => {
            if (auth.currentUser) {
              resolve(auth.currentUser);
            } else {
              try {
                const anon = await signInAnonymously(auth);
                resolve(anon.user);
              } catch (err) {
                console.warn('Anonymous auth failed:', err);
                resolve(null);
              }
            }
          }, 500);
        } else {
          try {
            const anon = await signInAnonymously(auth);
            resolve(anon.user);
          } catch (err) {
            console.warn('Anonymous auth failed:', err);
            resolve(null);
          }
        }
      }
    });
  });
}

// --- FUNCTION 1: SIGN OUT & WIPE LOCAL DATA ---
export async function handleSignOut(): Promise<void> {
  try {
    // 1. Sign out of Firebase Auth
    await signOut(auth);
    
    // 2. Wipe LocalStorage & SessionStorage (destroys saved API keys)
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    
    console.log("Signed out and successfully cleared all device storage!");
  } catch (error) {
    console.error("Error during sign out:", error);
  }
}

export async function logoutUser(): Promise<void> {
  await handleSignOut();
}

export { 
  signInWithPopup, 
  signInAnonymously, 
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
  orderBy
};
