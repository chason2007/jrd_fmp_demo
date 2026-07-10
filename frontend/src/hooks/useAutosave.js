import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Autosave a piece of state: debounced after edits, with a periodic fallback
 * in case edits never stop long enough for the debounce to fire. Skips saving
 * when nothing has changed since the last successful save, and never runs two
 * saves concurrently (a save that arrives mid-flight is retried once the
 * in-flight one finishes, so the latest data always ends up persisted).
 *
 * @param {*} data - the current value to save (any JSON-serializable shape)
 * @param {(data: any) => Promise<any>} saveFn - persists `data`; may reject
 * @param {object} [opts]
 * @param {boolean} [opts.enabled=true] - set false until there's anything worth saving
 * @param {number} [opts.debounceMs=4000] - quiet period after an edit before saving
 * @param {number} [opts.intervalMs=45000] - safety-net save cadence during continuous edits
 * @returns {{ status: 'idle'|'saving'|'saved'|'error'|'offline', lastSavedAt: Date|null, flush: () => Promise<'saved'|'skipped'|'offline'|'error'|'pending'> }}
 */
export function useAutosave(data, saveFn, { enabled = true, debounceMs = 4000, intervalMs = 45000, localStorageKey = null } = {}) {
  const [status, setStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const lastSavedSnapshot = useRef(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const debounceTimer = useRef(null);

  // Returns a plain result string ('saved'|'skipped'|'offline'|'error'|'pending')
  // rather than relying on the `status` state, since a caller that awaits this
  // (e.g. a manual Save button) can't rely on this render's `status` having
  // updated by the time the awaited call resolves.
  const attemptSave = useCallback(async () => {
    if (!enabled) return 'skipped';
    const snapshot = JSON.stringify(dataRef.current);
    if (snapshot === lastSavedSnapshot.current) return 'skipped'; // nothing to do

    if (savingRef.current) {
      pendingRef.current = true; // a newer change arrived mid-save; retry after
      return 'pending';
    }

    // Check if browser is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (localStorageKey) {
        try {
          localStorage.setItem(localStorageKey, snapshot);
        } catch (e) {
          console.error('Failed to write offline draft to localStorage:', e);
        }
      }
      setStatus('offline');
      return 'offline';
    }

    savingRef.current = true;
    setStatus('saving');
    try {
      await saveFnRef.current(dataRef.current);
      lastSavedSnapshot.current = snapshot;
      setStatus('saved');
      setLastSavedAt(new Date());
      if (localStorageKey) {
        try {
          localStorage.removeItem(localStorageKey);
        } catch (e) {}
      }
      return 'saved';
    } catch (err) {
      setStatus('error');
      if (localStorageKey) {
        try {
          localStorage.setItem(localStorageKey, snapshot);
        } catch (e) {
          console.error('Failed to write draft backup to localStorage:', e);
        }
      }
      return 'error';
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        attemptSave();
      }
    }
  }, [enabled, localStorageKey]);

  /** Save immediately, bypassing the debounce (used by manual Save buttons). */
  const flush = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    return attemptSave();
  }, [attemptSave]);

  // Debounce: (re)start the quiet-period timer whenever the data changes.
  useEffect(() => {
    if (!enabled) return undefined;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(attemptSave, debounceMs);
    return () => clearTimeout(debounceTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), enabled, debounceMs, attemptSave]);

  // Safety-net interval: catches continuous editing that keeps resetting the debounce.
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(attemptSave, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, attemptSave]);

  // Sync back to database when the network connection is restored
  useEffect(() => {
    if (!enabled) return undefined;
    const handleOnline = () => {
      flush();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [enabled, flush]);

  // Best-effort last-chance save when the tab is hidden/closed (not guaranteed
  // to complete, but costs nothing to try).
  useEffect(() => {
    if (!enabled) return undefined;
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [enabled, flush]);

  return { status, lastSavedAt, flush };
}
