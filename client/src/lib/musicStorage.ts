// ============ Music File Persistent Storage using IndexedDB ============
// Blob URLs are temporary and become invalid after page refresh.
// This module uses IndexedDB to store music file content persistently.

const DB_NAME = "FocusCompanionMusicDB";
const DB_VERSION = 1;
const STORE_NAME = "musicFiles";

interface StoredMusicFile {
  id: string;
  name: string;
  blob: Blob;
  createdAt: string;
}

interface MusicFileInfo {
  id: string;
  name: string;
  createdAt: string;
  size: number; // file size in bytes
}

// Single DB connection instance to avoid connection limits
let dbInstance: IDBDatabase | null = null;
let dbConnecting: Promise<IDBDatabase> | null = null;

// Open IndexedDB connection (with singleton pattern)
function openDB(): Promise<IDBDatabase> {
  // Return existing connection if available and open
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  
  // Return pending connection if one is in progress
  if (dbConnecting) {
    return dbConnecting;
  }
  
  dbConnecting = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      dbConnecting = null;
      reject(request.error);
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      
      // Handle connection closure
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      
      // Handle version change (other tab upgraded)
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      
      dbConnecting = null;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (dbConnecting) {
        dbConnecting = null;
        reject(new Error("IndexedDB connection timeout"));
      }
    }, 5000);
  });
  
  return dbConnecting;
}

// Save music file to IndexedDB
export async function saveMusicFile(id: string, name: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const data: StoredMusicFile = {
      id,
      name,
      blob,
      createdAt: new Date().toISOString(),
    };
    
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get music file from IndexedDB and create a fresh blob URL (with retry)
export async function getMusicFileUrl(id: string, retries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const db = await openDB();
      const url = await new Promise<string | null>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = () => {
          const data: StoredMusicFile | undefined = request.result;
          if (data && data.blob) {
            // Create a fresh blob URL
            const url = URL.createObjectURL(data.blob);
            resolve(url);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
      if (url) return url;
      // If null, try again (might be transient)
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 100 * attempt));
      }
    } catch {
      if (attempt === retries) {
        return null;
      }
      await new Promise(r => setTimeout(r, 100 * attempt));
    }
  }
  return null;
}

// Delete music file from IndexedDB
export async function deleteMusicFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get all music file info (without blob data)
export async function getAllMusicFilesInfo(): Promise<MusicFileInfo[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const files: StoredMusicFile[] = request.result;
      const info: MusicFileInfo[] = files.map(f => ({
        id: f.id,
        name: f.name,
        createdAt: f.createdAt,
        size: f.blob?.size || 0,
      }));
      resolve(info);
    };
    request.onerror = () => reject(request.error);
  });
}

// Check if music file exists in IndexedDB (with retry)
export async function hasMusicFile(id: string, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const db = await openDB();
      const result = await new Promise<boolean>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => reject(request.error);
      });
      return result;
    } catch {
      if (attempt === retries) {
        return false;
      }
      await new Promise(r => setTimeout(r, 100 * attempt));
    }
  }
  return false;
}

// Clean up orphaned files (files in IndexedDB but not in the provided list)
// NOTE: Currently disabled to prevent accidental file deletion
export async function cleanupOrphanedFiles(_validIds: string[]): Promise<void> {
  // TODO: Implement safe cleanup after thorough testing
  // For now, we keep all files in IndexedDB to prevent data loss
}

// Migrate from old storage (blob URLs) to new storage
// This should be called on app initialization
export async function migrateMusicFiles(
  tracks: { id: string; name: string; url: string }[]
): Promise<{ id: string; name: string; url: string; isValid: boolean }[]> {
  const results = await Promise.all(
    tracks.map(async (track) => {
      // Check if file exists in IndexedDB
      const hasFile = await hasMusicFile(track.id);
      if (hasFile) {
        // Get fresh URL from IndexedDB
        const newUrl = await getMusicFileUrl(track.id);
        return {
          ...track,
          url: newUrl || track.url,
          isValid: !!newUrl,
        };
      }
      // Check if the existing URL is still valid (blob: protocol)
      if (track.url.startsWith("blob:")) {
        // Try to verify if the blob URL is still valid
        try {
          const response = await fetch(track.url, { method: "HEAD" });
          if (response.ok) {
            return { ...track, isValid: true };
          }
        } catch {
          // URL is invalid, mark as needs re-upload
        }
      }
      return { ...track, isValid: false };
    })
  );
  
  return results;
}

// Export music file as downloadable blob
export async function exportMusicFile(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      const data: StoredMusicFile | undefined = request.result;
      resolve(data?.blob || null);
    };
    request.onerror = () => reject(request.error);
  });
}
