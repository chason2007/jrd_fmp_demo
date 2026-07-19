import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import NetworkStatus from '../components/NetworkStatus.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { SnagIcon, BuildingIcon, HomeIcon, GearIcon } from '../components/ModuleIcons.jsx';
import { cleanLocalPhotosForDraft } from '../utils/localPhotoStore.js';
import { listOfflineDrafts, deleteOfflineDraft } from '../lib/offlineDrafts.js';

/** "3 min ago" / "2 hours ago" — falls back to a full date past a week. */
function relativeTime(dateInput) {
  if (!dateInput) return 'Unsaved';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString();
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { show } = useToast();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') {
      navigate('/admin');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') {
      fetchActiveDrafts();
    }
  }, [user]);

  const fetchActiveDrafts = async () => {
    setLoadingDrafts(true);
    const foundDrafts = [];

    // 1. Device-held offline drafts (IndexedDB) for Flat Snag module.
    try {
      const offVilla = await listOfflineDrafts('villa').catch(() => []);
      for (const r of offVilla) {
        foundDrafts.push({ id: r.localId, localId: r.localId, type: 'villa', title: `${r.label || 'Flat draft'} (On this device)`, description: `Saved ${relativeTime(r.updatedAt)} · not synced`, isLocal: true, data: r });
      }
    } catch (e) {
      console.error('Error reading local drafts', e);
    }

    // 2. Fetch server drafts from endpoints (if online)
    if (navigator.onLine) {
      try {
        const villaRes = await api.get('/api/villa/drafts').catch(() => ({ data: { data: { drafts: [] } } }));
        const villaDrafts = villaRes.data?.data?.drafts || [];

        villaDrafts.forEach(d => {
          foundDrafts.push({
            id: d.id,
            type: 'villa',
            title: `Flat ${d.flatNumber}${d.unitNumber ? ` · Unit ${d.unitNumber}` : ''}${d.buildingName ? ` · ${d.buildingName}` : ''}`,
            description: `Last saved: ${relativeTime(d.updatedAt)}`,
            data: d
          });
        });
      } catch (e) {
        console.error('Error fetching server drafts', e);
      }
    }

    setDrafts(foundDrafts);
    setLoadingDrafts(false);
  };

  const handleResumeDraft = (draft) => {
    // Device-held drafts resume via resumeOfflineDraft (the module maps its
    // stored snapshot back into state); server drafts via resumeDraft.
    const routes = { villa: '/villa', wv: '/wv', velora: '/velora' };
    const path = routes[draft.type];
    if (!path) return;
    navigate(path, { state: draft.isLocal ? { resumeOfflineDraft: draft.data } : { resumeDraft: draft.data } });
  };

  const handleDeleteDraft = async (e, draft) => {
    e.stopPropagation();
    if (!(await confirm(`Are you sure you want to delete this ${draft.type} draft?`))) {
      return;
    }
    try {
      if (draft.isLocal) {
        try { cleanLocalPhotosForDraft(draft.data?.payload, draft.type); } catch (e) {}
        await deleteOfflineDraft(draft.localId).catch(() => {});
        show('Offline draft deleted.', 'success');
      } else {
        if (draft.type === 'villa') {
          await api.delete(`/api/villa/drafts/${draft.id}`);
        } else if (draft.type === 'wv') {
          await api.delete(`/api/wv/drafts/${draft.id}`);
        } else if (draft.type === 'velora') {
          await api.delete(`/api/velora/drafts/${draft.id}`);
        }
        show('Draft deleted successfully.', 'success');
      }
      fetchActiveDrafts();
    } catch (err) {
      console.error('Error deleting draft:', err);
      show('Failed to delete draft. Please try again.', 'error');
    }
  };

  if (user?.role === 'SUPERADMIN') return null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div>
            <h1>{t('facilitiesManagementDashboard', 'FACILITIES MANAGEMENT PORTAL')}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NetworkStatus />
          <ThemeToggle />
          <span className="status-badge">
            {user?.username} · {user?.role}
          </span>
          <button
            className="btn-danger-outline"
            onClick={logout}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
          >
            {t('logout', 'Logout')}
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Active Drafts Section */}
        {user?.role !== 'SUPERADMIN' && (loadingDrafts || drafts.length > 0) && (
          <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Resume Active Drafts</span>
              <button
                className="btn-secondary"
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                onClick={fetchActiveDrafts}
                disabled={loadingDrafts}
              >
                Refresh
              </button>
            </div>
            <p style={{ color: 'var(--gray)', fontSize: '0.9rem', margin: '1rem 1rem 0.5rem' }}>
              You have the following saved drafts. Click any card to load it and continue auditing:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', padding: '0.5rem 1rem 1rem' }}>
              {loadingDrafts
                ? [0, 1, 2].map(i => (
                    <div key={`sk-${i}`} className="skeleton-card" aria-hidden="true">
                      <div className="skeleton skeleton-line" style={{ width: '55%' }} />
                      <div className="skeleton skeleton-line" style={{ width: '80%', marginTop: '0.9rem' }} />
                    </div>
                  ))
                : drafts.map(d => (
                    <div
                      key={`${d.type}-${d.id}`}
                      className="card card-clickable"
                      role="button"
                      tabIndex={0}
                      style={{
                        border: '1px solid',
                        padding: '1rem',
                        margin: 0,
                        background: d.isLocal ? 'var(--warn-bg)' : 'var(--white)',
                        borderColor: d.isLocal ? 'var(--warn-border)' : 'var(--border)',
                        position: 'relative',
                      }}
                      onClick={() => handleResumeDraft(d)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleResumeDraft(d); } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>{d.title}</h4>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor: d.isLocal ? 'var(--warn-bg)' : 'var(--ok-bg)',
                          color: d.isLocal ? 'var(--warn-fg)' : 'var(--ok-fg)',
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: d.isLocal ? 'var(--warn-solid)' : 'var(--ok)',
                          }} />
                          {d.isLocal ? 'Offline' : 'Synced'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                        <p style={{ color: 'var(--gray)', fontSize: '0.8rem', margin: 0 }}>
                          {d.description}
                        </p>
                        <button
                          className="btn-danger-outline"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={(e) => handleDeleteDraft(e, d)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-title">Select Module</div>
          <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>
            Welcome, {user?.username}. Please select the audit module you wish to access:
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div
              className="card card-clickable module-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate('/villa')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/villa'); } }}
            >
              <span className="module-icon"><SnagIcon /></span>
              <div>
                <h3>Snag Audit</h3>
                <p>General flat inspections and defect logging.</p>
              </div>
            </div>

            {(user?.role === 'SUPERADMIN' || user?.role === 'ADMIN') && (
              <div
                className="card card-clickable module-card"
                role="button"
                tabIndex={0}
                style={{ background: 'var(--zinc-50)' }}
                onClick={() => navigate('/admin')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/admin'); } }}
              >
                <span className="module-icon"><GearIcon /></span>
                <div>
                  <h3>Administration Portal</h3>
                  <p>Manage users, view global audits, and approve resets.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
