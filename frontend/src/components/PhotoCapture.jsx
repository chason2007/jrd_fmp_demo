import { useEffect, useRef, useState, useCallback } from 'react';
import PhotoThumb from './PhotoThumb.jsx';
import { useToast } from '../context/ToastContext.jsx';

/**
 * Shared photo-capture control for all audit modules. Improvements over the old
 * per-module handlers:
 *  - Optimistic previews: the thumbnail appears instantly on selection and shows
 *    a spinner while it uploads (vital on slow on-site networks).
 *  - Per-photo failure with tap-to-retry, instead of a silent toast-only loss.
 *  - Separate Camera / Gallery buttons (Camera opens the device camera directly).
 *
 * Storage contract: `value` is an array of committed photos identified by `id`
 * only — blob preview URLs are kept in-memory here and NEVER written into `value`,
 * so autosaved drafts don't persist dead blob: URLs. Freshly uploaded photos show
 * from the in-memory preview; ones loaded from the server fall back to PhotoThumb.
 *
 * @param {Array<{id:number}>} value        committed photos (id is all that matters)
 * @param {(next:Array<{id:number}>)=>void} onChange
 * @param {(file:File)=>Promise<{id:number}>} uploadFn  module's upload endpoint
 * @param {(id:number)=>Promise<string>} [fetchUrl]     for server-loaded thumbnails
 * @param {number} [max=5]
 * @param {(url:string)=>void} [onLightbox]
 */
export default function PhotoCapture({
  value = [],
  onChange,
  uploadFn,
  fetchUrl,
  max = 5,
  onLightbox,
  label,
  hint,
  buttonClassName = 'camera-btn',
}) {
  const { show } = useToast();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const previews = useRef(new Map()); // id -> object URL (this session's uploads)
  const allUrls = useRef(new Set());  // every object URL created, for unmount cleanup
  const tmpSeq = useRef(0);
  const [pending, setPending] = useState([]); // { tmpId, url, file, status }

  // Use refs to avoid stale closures in memoized callbacks and event listeners
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const uploadFnRef = useRef(uploadFn);
  uploadFnRef.current = uploadFn;

  function makePreviewUrl(file) {
    const url = URL.createObjectURL(file);
    allUrls.current.add(url);
    return url;
  }
  function revoke(url) {
    if (!url) return;
    URL.revokeObjectURL(url);
    allUrls.current.delete(url);
  }

  // Revoke any object URLs still alive on unmount (double-revokes are harmless).
  useEffect(() => {
    const urls = allUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const retry = useCallback(async (entry) => {
    setPending((prev) => prev.map((p) => (p.tmpId === entry.tmpId ? { ...p, status: 'uploading' } : p)));
    try {
      const photo = await uploadFnRef.current(entry.file);
      previews.current.set(photo.id, entry.url);
      setPending((prev) => prev.filter((p) => p.tmpId !== entry.tmpId));
      onChangeRef.current([...valueRef.current, { id: photo.id }]);
    } catch {
      setPending((prev) => prev.map((p) => (p.tmpId === entry.tmpId ? { ...p, status: 'error' } : p)));
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        show('Still offline. Could not upload photo.', 'error');
      } else {
        show('Still could not upload that photo.', 'error');
      }
    }
  }, [show]);

  // Auto-retry failed uploads when connection is restored
  useEffect(() => {
    const handleOnline = () => {
      setPending((prev) => {
        const failed = prev.filter((p) => p.status === 'error');
        failed.forEach((entry) => {
          retry(entry);
        });
        return prev;
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [retry]);

  const uploadingCount = pending.filter((p) => p.status === 'uploading').length;
  const activeCount = value.length + pending.filter((p) => p.status !== 'error').length;
  const full = activeCount >= max;

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file
    if (!files.length) return;

    const room = max - activeCount;
    if (room <= 0) {
      show(`Maximum ${max} photos reached.`, 'error');
      return;
    }

    const entries = files.slice(0, room).map((file) => ({
      tmpId: `tmp-${tmpSeq.current++}`,
      url: makePreviewUrl(file),
      file,
      status: 'uploading',
    }));
    setPending((prev) => [...prev, ...entries]);

    const uploaded = [];
    const doneTmpIds = [];
    for (const entry of entries) {
      try {
        const photo = await uploadFnRef.current(entry.file);
        previews.current.set(photo.id, entry.url);
        uploaded.push({ id: photo.id });
        doneTmpIds.push(entry.tmpId);
        // Keep the thumbnail visible (status 'done', no overlay) until the whole
        // batch commits — avoids earlier photos flickering out mid-upload.
        setPending((prev) => prev.map((p) => (p.tmpId === entry.tmpId ? { ...p, status: 'done' } : p)));
      } catch {
        setPending((prev) => prev.map((p) => (p.tmpId === entry.tmpId ? { ...p, status: 'error' } : p)));
      }
    }
    if (uploaded.length) {
      // Commit and drop the done placeholders in one batched update (seamless swap).
      onChangeRef.current([...valueRef.current, ...uploaded]);
      setPending((prev) => prev.filter((p) => !doneTmpIds.includes(p.tmpId)));
    }
    if (uploaded.length < entries.length) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        show('You are offline. Photo upload failed. It will upload automatically when connection is restored.', 'error');
      } else {
        show('Some photos could not be uploaded (JPEG, PNG or WebP under 8MB). Tap a failed photo to retry.', 'error');
      }
    }
  }

  function removePending(entry) {
    revoke(entry.url);
    setPending((prev) => prev.filter((p) => p.tmpId !== entry.tmpId));
  }

  function removeCommitted(id) {
    const u = previews.current.get(id);
    if (u) { revoke(u); previews.current.delete(id); }
    onChange(value.filter((p) => p.id !== id));
  }

  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <div className="photo-upload-area">
        <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" style={{ display: 'none' }} onChange={handleFiles} />
        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={handleFiles} />
        <button type="button" className={buttonClassName} disabled={full || uploadingCount > 0} onClick={() => cameraRef.current?.click()}>
          Take Photo
        </button>
        <button type="button" className={buttonClassName} disabled={full || uploadingCount > 0} onClick={() => galleryRef.current?.click()}>
          Gallery
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--zinc-500)' }}>
          {activeCount}/{max}{uploadingCount > 0 ? ' · uploading…' : ''}
        </span>
      </div>
      {hint && <div className="compress-info">{hint}</div>}
      {full && <div className="photo-limit-warning">Maximum {max} photos reached.</div>}

      {(value.length > 0 || pending.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem' }}>
          {value.map((p) => {
            const localUrl = previews.current.get(p.id);
            return (
              <div key={p.id} className="photo-preview-container">
                {localUrl ? (
                  <img 
                    className="photo-preview" 
                    src={localUrl} 
                    alt="Photo" 
                    onClick={() => onLightbox?.(localUrl)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onLightbox?.(localUrl);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  />
                ) : (
                  <PhotoThumb id={p.id} fetchUrl={fetchUrl} onClick={onLightbox} />
                )}
                {/* Removing a committed photo mid-batch would be lost when the batch
                    commits with a stale value, so disable while uploads are in flight. */}
                <button type="button" className="remove-photo-btn" aria-label="Remove photo" disabled={uploadingCount > 0} onClick={() => removeCommitted(p.id)}>×</button>
              </div>
            );
          })}

          {pending.map((entry) => (
            <div key={entry.tmpId} className="photo-preview-container">
              <img className="photo-preview" src={entry.url} alt="" style={{ opacity: entry.status === 'uploading' ? 0.85 : 1 }} />
              {entry.status === 'uploading' && (
                <div className="photo-status-overlay uploading" aria-label="Uploading photo">
                  <span className="photo-status-spinner" />
                </div>
              )}
              {entry.status === 'error' && (
                <div
                  className="photo-status-overlay error"
                  role="button"
                  tabIndex={0}
                  aria-label="Upload failed — tap to retry"
                  onClick={() => retry(entry)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); retry(entry); } }}
                >
                  <span className="photo-retry">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Retry
                  </span>
                </div>
              )}
              {/* Only allow discarding a failed photo — discarding one mid-upload
                  would revoke its URL while the request is still in flight. */}
              {entry.status === 'error' && (
                <button type="button" className="remove-photo-btn" aria-label="Discard photo" onClick={() => removePending(entry)}>×</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
