const DB_NAME = 'OfflinePhotoStore';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

export async function storePhoto(id, file) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(file, id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function getPhoto(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function deletePhoto(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function listPhotos() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function clearAllPhotos() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Clean up local photos associated with a draft that is deleted/dismissed.
 */
export function cleanLocalPhotosForDraft(draftData, type) {
  try {
    if (type === 'villa' && draftData?.issues) {
      for (const iss of draftData.issues) {
        if (iss.photoIds) {
          for (const id of iss.photoIds) {
            if (typeof id === 'string' && id.startsWith('local-')) {
              deletePhoto(id).catch((err) => console.error('Failed to delete offline photo on draft deletion:', err));
            }
          }
        }
      }
    } else if (type === 'wv' && draftData?.responses) {
      for (const r of Object.values(draftData.responses)) {
        if (r.images) {
          for (const img of r.images) {
            if (typeof img.id === 'string' && img.id.startsWith('local-')) {
              deletePhoto(img.id).catch((err) => console.error('Failed to delete offline photo on draft deletion:', err));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error cleaning local photos for draft:', err);
  }
}

/**
 * Uploads a local photo to the server and deletes it from local IndexedDB if successful.
 */
export async function uploadLocalPhoto(localId, uploadFn) {
  const fileOrBlob = await getPhoto(localId);
  if (!fileOrBlob) {
    console.warn(`Local photo ${localId} not found in store.`);
    return null;
  }
  const serverPhoto = await uploadFn(fileOrBlob);
  await deletePhoto(localId);
  return serverPhoto.id;
}
