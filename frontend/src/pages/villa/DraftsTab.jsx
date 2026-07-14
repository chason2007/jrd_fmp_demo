import { useEffect, useState, useCallback } from 'react';
import { listDrafts, getDraft, deleteDraft } from '../../api/villa.js';
import { errorMessage } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ListSkeleton from '../../components/ListSkeleton.jsx';
import { listOfflineDrafts, deleteOfflineDraft } from '../../lib/offlineDrafts.js';
import { cleanLocalPhotosForDraft } from '../../utils/localPhotoStore.js';

export default function DraftsTab({ refreshKey, onResume, onResumeOffline, onStartNew }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState([]);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOffline = useCallback(() => {
    listOfflineDrafts('villa').then(setOfflineDrafts).catch(() => setOfflineDrafts([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    loadOffline();
    try {
      setDrafts(await listDrafts());
    } catch (err) {
      // Offline (or a server hiccup) shouldn't nag — device drafts below still show.
      if (navigator.onLine) show(errorMessage(err, 'Could not load drafts.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [show, loadOffline]);

  useEffect(() => {
    load();
    const onOnline = () => loadOffline();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [load, refreshKey, loadOffline]);

  async function resume(id) {
    try {
      onResume(await getDraft(id));
    } catch (err) {
      show(errorMessage(err, 'Could not open draft.'), 'error');
    }
  }

  async function remove(id) {
    if (!(await confirm('Delete this draft?'))) return;
    try {
      await deleteDraft(id);
      show('Draft deleted.', 'success');
      load();
    } catch (err) {
      show(errorMessage(err, 'Could not delete draft.'), 'error');
    }
  }

  async function removeOffline(record) {
    if (!(await confirm('Delete this draft from this device? It has not been synced to the server.'))) return;
    try { cleanLocalPhotosForDraft(record.payload, 'villa'); } catch (e) {}
    await deleteOfflineDraft(record.localId).catch(() => {});
    setOfflineDrafts((prev) => prev.filter((d) => d.localId !== record.localId));
    show('Device draft deleted.', 'success');
  }

  return (
    <main className="main-content">
      <div className="card">
        <div className="card-title">Saved Drafts (Continue Later)</div>
        {offlineDrafts.map((d) => (
          <div key={d.localId} className="draft-item">
            <div>
              <div className="report-title">
                {d.label || 'Unsynced inspection'}
                <span className="badge" style={{ marginLeft: '8px', color: 'var(--warn-fg)', background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}>
                  On this device · not synced
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>
                Saved {new Date(d.updatedAt).toLocaleString()} · syncs automatically when back online
              </div>
            </div>
            <div className="report-actions">
              <button className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => onResumeOffline(d)}>Resume</button>
              <button className="btn-danger-outline" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => removeOffline(d)}>Delete</button>
            </div>
          </div>
        ))}
        {loading ? (
          <ListSkeleton rows={3} />
        ) : drafts.length === 0 && offlineDrafts.length === 0 ? (
          <EmptyState
            title="No drafts yet"
            message="Drafts you save while inspecting a villa will show up here so you can pick up where you left off."
            ctaLabel="Start a new inspection"
            onCta={onStartNew}
          />
        ) : (
          drafts.map((d) => (
            <div key={d.id} className="draft-item">
              <div>
                <div className="report-title">{d.propertyNumber} — {d.ownerName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>
                  {d.draftCode} · {d.issueCount} issue(s) · updated {new Date(d.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="report-actions">
                <button className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => resume(d.id)}>Resume</button>
                <button className="btn-danger-outline" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => remove(d.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
