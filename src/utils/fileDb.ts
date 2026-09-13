// Bulletproof utility for storing large assets (like audio files and images) in IndexedDB and Firestore to bypass local limits and survive cross-device transitions.
import { useState, useEffect } from 'react';
import { saveAssetToCloud, getAssetFromCloud } from './cloudSync';

const DB_NAME = 'VsenAiLargeAssetsDB';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
const assetCache = new Map<string, string>();

function resetDB() {
  dbPromise = null;
}

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      dbPromise = null;
      reject(new Error('IndexedDB is not available'));
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
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

      request.onerror = () => {
        resetDB();
        reject(request.error);
      };
    } catch (e) {
      resetDB();
      reject(e);
    }
  });

  return dbPromise;
}

/**
 * Safely converts a data URL to a Blob without throwing
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  try {
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(parts[1] || '');
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
}

/**
 * Safely converts a Blob or File to a Data URL string
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function getAssetSync(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (assetCache.has(ref)) {
    return assetCache.get(ref)!;
  }
  if (!ref.startsWith('db:')) {
    return ref;
  }
  return null;
}

async function runWithDB<T>(action: (db: IDBDatabase) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const db = await getDB();
      return await action(db);
    } catch (err) {
      resetDB();
      if (attempt === 1) throw err;
    }
  }
  throw new Error('IndexedDB operation failed');
}

export async function storeAsset(id: string, data: string | Blob | File): Promise<string> {
  const ref = `db:${id}`;

  try {
    if (data instanceof Blob) {
      // Store in memory cache
      let objectUrl = '';
      try {
        objectUrl = URL.createObjectURL(data);
        assetCache.set(ref, objectUrl);
      } catch {
        // ignore
      }

      // Convert to base64 DataURL for guaranteed persistent serialization in all environments
      const dataUrl = await blobToDataUrl(data);
      if (!objectUrl) {
        assetCache.set(ref, dataUrl);
      }

      await runWithDB(db => new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(dataUrl, id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }));

      // Also persist to cloud in background
      saveAssetToCloud(id, dataUrl).catch(() => {});

      return ref;
    }

    if (typeof data === 'string') {
      assetCache.set(ref, data);

      await runWithDB(db => new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }));

      // Also persist to cloud in background
      saveAssetToCloud(id, data).catch(() => {});

      return ref;
    }
  } catch (err) {
    console.warn('Asset persistence fallback to memory:', err);
    if (typeof data === 'string') {
      assetCache.set(ref, data);
      saveAssetToCloud(id, data).catch(() => {});
    } else if (data instanceof Blob) {
      try {
        assetCache.set(ref, URL.createObjectURL(data));
        blobToDataUrl(data).then(d => saveAssetToCloud(id, d)).catch(() => {});
      } catch {}
    }
  }

  return ref;
}

export async function getAsset(ref: string): Promise<string | null> {
  if (!ref) {
    return null;
  }
  if (assetCache.has(ref)) {
    return assetCache.get(ref)!;
  }
  if (!ref.startsWith('db:')) {
    assetCache.set(ref, ref);
    return ref; 
  }

  const id = ref.substring(3);
  try {
    const localResult = await runWithDB(db => new Promise<any>((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        if (result instanceof Blob) {
          try {
            const blobUrl = URL.createObjectURL(result);
            assetCache.set(ref, blobUrl);
            resolve(blobUrl);
          } catch {
            blobToDataUrl(result).then((dUrl) => {
              assetCache.set(ref, dUrl);
              resolve(dUrl);
            }).catch(() => resolve(null));
          }
          return;
        }

        if (typeof result === 'string') {
          assetCache.set(ref, result);
          resolve(result);
          return;
        }

        resolve(null);
      };

      request.onerror = () => {
        resolve(null);
      };
    }));

    if (localResult) {
      return localResult;
    }

    // If not in local IndexedDB (e.g. new device or cache cleared), fetch from Cloud Firestore!
    const cloudAsset = await getAssetFromCloud(id);
    if (cloudAsset) {
      assetCache.set(ref, cloudAsset);
      // Cache locally in IndexedDB for subsequent instant access
      try {
        await runWithDB(async db => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(cloudAsset, id);
        });
      } catch {}
      return cloudAsset;
    }

    return null;
  } catch (error) {
    console.error('Failed to retrieve asset from IndexedDB/Cloud:', error);
    // Fallback attempt to cloud
    try {
      const cloudAsset = await getAssetFromCloud(id);
      if (cloudAsset) {
        assetCache.set(ref, cloudAsset);
        return cloudAsset;
      }
    } catch {}
    return null;
  }
}

export async function deleteAsset(ref: string): Promise<boolean> {
  if (!ref) return true;
  if (assetCache.has(ref)) {
    assetCache.delete(ref);
  }
  if (!ref.startsWith('db:')) return true;
  const id = ref.substring(3);
  try {
    return await runWithDB(db => new Promise<boolean>((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        resolve(false);
      };
    }));
  } catch (error) {
    console.error('Failed to delete asset from IndexedDB:', error);
    return false;
  }
}

export function useAsset(ref: string | null | undefined): string {
  const [resolved, setResolved] = useState<string>(() => {
    if (!ref) return '';
    return getAssetSync(ref) || (ref.startsWith('db:') ? '' : ref);
  });

  useEffect(() => {
    let isMounted = true;
    if (!ref) {
      setResolved('');
      return;
    }
    const sync = getAssetSync(ref);
    if (sync) {
      setResolved(sync);
      return;
    }
    if (ref.startsWith('db:')) {
      getAsset(ref).then(url => {
        if (isMounted && url) {
          setResolved(url);
        }
      });
    } else {
      setResolved(ref);
    }
    return () => { isMounted = false; };
  }, [ref]);

  return resolved || (ref && !ref.startsWith('db:') ? ref : '');
}

export async function preloadConfigAssets(config: any): Promise<void> {
  if (!config) return;
  const dbRefs = new Set<string>();

  const findRefs = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(findRefs);
      return;
    }
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string' && val.startsWith('db:')) {
        if (!assetCache.has(val)) {
          dbRefs.add(val);
        }
      } else if (typeof val === 'object' && val !== null) {
        findRefs(val);
      }
    }
  };

  findRefs(config);

  if (dbRefs.size > 0) {
    await Promise.all(Array.from(dbRefs).map(ref => getAsset(ref)));
  }
}
