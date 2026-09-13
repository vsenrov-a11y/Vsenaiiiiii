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
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  deleteDoc,
  onSnapshot,
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
  : '(default)';

export const db: Firestore = getFirestore(app, databaseId);

/**
 * Sign in with Google Popup. If currently anonymous, links account or logs in.
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const currentUser = auth.currentUser;
    let user: User | null = null;
    if (currentUser && currentUser.isAnonymous) {
      try {
        const cred = await linkWithPopup(currentUser, googleProvider);
        user = cred.user;
      } catch (linkErr: any) {
        // If account already exists with different credentials, sign in directly
        if (linkErr?.code === 'auth/credential-already-in-use') {
          const cred = await signInWithPopup(auth, googleProvider);
          user = cred.user;
        } else {
          throw linkErr;
        }
      }
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      user = result.user;
    }

    if (user && !user.isAnonymous) {
      try {
        localStorage.setItem('vsen_is_google_linked', 'true');
      } catch {}
    }
    return user;
  } catch (err) {
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

/**
 * Sign out current user and fallback to anonymous
 */
export async function logoutUser(): Promise<void> {
  try {
    localStorage.removeItem('vsen_is_google_linked');
  } catch {}
  try {
    await signOut(auth);
    await signInAnonymously(auth);
  } catch (err) {
    console.error('Logout failed:', err);
  }
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
  onSnapshot 
};
