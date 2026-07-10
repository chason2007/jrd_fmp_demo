import { useEffect, useState, useCallback } from 'react';
import { listDrafts, getDraft, deleteDraft } from '../../api/villa.js';
import { errorMessage } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ListSkeleton from '../../components/ListSkeleton.jsx';

export default function DraftsTab({ refreshKey, onResume, onStartNew }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDrafts(await listDrafts());
    } catch (err) {
      show(errorMessage(err, 'Could not load drafts.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load, refreshKey]);

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

  return (
    <main className="main-content">
      <div className="card">
        <div className="card-title">Saved Drafts (Continue Later)</div>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : drafts.length === 0 ? (
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
