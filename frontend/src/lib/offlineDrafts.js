/**
 * Offline draft store (IndexedDB).
 *
 * The problem this solves: an auditor can be halfway through an audit when the
 * connection drops. They must be able to save that audit as a draft *on the
 * device*, start a DIFFERENT audit, and later come back and finish the first —
 * all while possibly still offline. When the connection returns, every locally
 * held draft is pushed up to the server and removed from the device.
 *
 * Why IndexedDB and not localStorage: Velora audits embed photos as base64,
 * so a single draft can be several MB. localStorage (~5MB total, synchronous)
 * would overflow the moment a couple of photo-heavy audits are held offline.
 * IndexedDB gives us room and async access.
 *
 * Each record is keyed by a `localId` that is unique to ONE editing session, so
 * repeatedly saving the same audit while offline updates a single record rather
 * than piling up duplicates — and two different audits never clobber each other.
 */

const DB_NAME = 'audit-portal-offline';
const STORE = 'drafts';
const VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'localId' });
        // Lets us list only one module's drafts without scanning everything.
        store.createIndex('module', 'module', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

// Ids the open editor is actively persisting/syncing itself. The background
// reconnect sync skips these so it never races the editor's own flush and
// double-posts the same audit (which, before a server id exists, would create a
// duplicate). Lives in memory only — a page reload clears it, and drafts from a
// prior session correctly become eligible for background sync again.
const activeLocalIds = new Set();
export function markActiveLocalId(id) { if (id) activeLocalIds.add(id); }
export function releaseActiveLocalId(id) { if (id) activeLocalIds.delete(id); }

/** A fresh unique id for a new editing session. */
export function newLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `local-${crypto.randomUUID()}`;
  // Fallback for older browsers (crypto.randomUUID lands ~2021).
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/**
 * Insert or update one offline draft.
 * @param {object} record
 * @param {string} record.localId  unique per editing session (see newLocalId)
 * @param {'velora'|'wv'|'villa'} record.module
 * @param {string} record.label    human label shown in the drafts list
 * @param {*} record.payload       the exact editor snapshot needed to resume + to POST to the server
 * @param {number|null} [record.serverId]  server draft id, if this draft was already created server-side
 */
export async function saveOfflineDraft(record) {
  const store = await tx('readwrite');
  const full = {
    serverId: null,
    ...record,
    synced: false,
    updatedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const req = store.put(full);
    req.onsuccess = () => resolve(full);
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineDraft(localId) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(localId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** All offline drafts for a module, newest first. */
export async function listOfflineDrafts(module) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const out = [];
    const idx = store.index('module');
    const req = idx.openCursor(IDBKeyRange.only(module));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.push(cursor.value);
        cursor.continue();
      } else {
        out.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineDraft(localId) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(localId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Push every locally held draft for a module up to the server, then remove the
 * ones that made it. Call this on reconnect and when a module mounts online.
 *
 * @param {'velora'|'wv'|'villa'} module
 * @param {(payload: any, record: object) => Promise<any>} pushFn
 *        Sends one draft's payload to the server. Reject to keep it for next time.
 * @returns {Promise<{ synced: number, failed: number }>}
 */
export async function syncOfflineDrafts(module, pushFn) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, failed: 0 };
  const drafts = await listOfflineDrafts(module);
  let synced = 0;
  let failed = 0;
  for (const draft of drafts) {
    // The open editor is handling this one itself — don't race its flush.
    if (activeLocalIds.has(draft.localId)) continue;
    try {
      await pushFn(draft.payload, draft);
      await deleteOfflineDraft(draft.localId);
      synced += 1;
    } catch (err) {
      // Leave it on the device; the next reconnect (or manual retry) tries again.
      failed += 1;
    }
  }
  return { synced, failed };
}
