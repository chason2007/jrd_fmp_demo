import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import NetworkStatus from '../components/NetworkStatus.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { SnagIcon, BuildingIcon, HomeIcon, GearIcon, SparkleIcon } from '../components/ModuleIcons.jsx';
import { cleanLocalPhotosForDraft } from '../utils/localPhotoStore.js';
import { listOfflineDrafts, deleteOfflineDraft } from '../lib/offlineDrafts.js';
import { canAccessModule } from '../lib/modules.js';

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

    // Only touch a module the user actually has enabled — the API would 403 an
    // enabledModules-gated endpoint otherwise, and there's nothing to show anyway.
    const hasVilla = canAccessModule(user, 'villa');
    const hasApartment = canAccessModule(user, 'apartment');
    const hasWv = canAccessModule(user, 'wv');
    const hasVelora = canAccessModule(user, 'velora');

    // 1. Device-held offline drafts (IndexedDB) for the user's enabled modules.
    try {
      const [offVilla, offApartment, offWv, offVelora] = await Promise.all([
        hasVilla ? listOfflineDrafts('villa').catch(() => []) : [],
        hasApartment ? listOfflineDrafts('apartment').catch(() => []) : [],
        hasWv ? listOfflineDrafts('wv').catch(() => []) : [],
        hasVelora ? listOfflineDrafts('velora').catch(() => []) : [],
      ]);
      for (const r of offVilla) {
        foundDrafts.push({ id: r.localId, localId: r.localId, type: 'villa', title: `${r.label || 'Flat draft'} (On this device)`, description: `Saved ${relativeTime(r.updatedAt)} · not synced`, isLocal: true, data: r });
      }
      for (const r of offApartment) {
        foundDrafts.push({ id: r.localId, localId: r.localId, type: 'apartment', title: `${r.label || 'Apartment draft'} (On this device)`, description: `Saved ${relativeTime(r.updatedAt)} · not synced`, isLocal: true, data: r });
      }
      for (const r of offWv) {
        foundDrafts.push({ id: r.localId, localId: r.localId, type: 'wv', title: `${r.label || 'WV audit'} (On this device)`, description: `Saved ${relativeTime(r.updatedAt)} · not synced`, isLocal: true, data: r });
      }
      for (const r of offVelora) {
        foundDrafts.push({ id: r.localId, localId: r.localId, type: 'velora', title: `${r.label || 'Velora audit'} (On this device)`, description: `Saved ${relativeTime(r.updatedAt)} · not synced`, isLocal: true, data: r });
      }
    } catch (e) {
      console.error('Error reading local drafts', e);
    }

    // 2. Fetch server drafts from endpoints (if online)
    if (navigator.onLine) {
      try {
        const [villaRes, apartmentRes, wvRes, veloraRes] = await Promise.all([
          hasVilla ? api.get('/api/villa/drafts').catch(() => ({ data: { data: { drafts: [] } } })) : { data: { data: { drafts: [] } } },
          hasApartment ? api.get('/api/apartment/drafts').catch(() => ({ data: { data: { drafts: [] } } })) : { data: { data: { drafts: [] } } },
          hasWv ? api.get('/api/wv/drafts').catch(() => ({ data: { data: { drafts: [] } } })) : { data: { data: { drafts: [] } } },
          hasVelora ? api.get('/api/velora/drafts').catch(() => ({ data: { data: [] } })) : { data: { data: [] } },
        ]);
        const villaDrafts = villaRes.data?.data?.drafts || [];
        const apartmentDrafts = apartmentRes.data?.data?.drafts || [];
        const wvDrafts = wvRes.data?.data?.drafts || [];
        // Velora's /api/velora/drafts returns the array directly under data (see VeloraApp.jsx DraftsList).
        const veloraDrafts = veloraRes.data?.data || [];

        villaDrafts.forEach(d => {
          foundDrafts.push({
            id: d.id,
            type: 'villa',
            title: `Flat ${d.flatNumber}${d.unitNumber ? ` · Unit ${d.unitNumber}` : ''}${d.buildingName ? ` · ${d.buildingName}` : ''}`,
            description: `Last saved: ${relativeTime(d.updatedAt)}`,
            data: d
          });
        });

        apartmentDrafts.forEach(d => {
          foundDrafts.push({
            id: d.id,
            type: 'apartment',
            title: `Apartment ${d.roomNo || '—'}${d.apartmentNumber ? ` · No. ${d.apartmentNumber}` : ''}${d.tenantName ? ` · ${d.tenantName}` : ''}`,
            description: `Last saved: ${relativeTime(d.updatedAt)}`,
            data: d
          });
        });

        wvDrafts.forEach(d => {
          foundDrafts.push({
            id: d.id,
            type: 'wv',
            title: `WV Audit (${d.auditType || 'Draft'})`,
            description: `Building: ${d.building || 'N/A'} · Saved ${relativeTime(d.updatedAt || d.createdAt)}`,
            data: d
          });
        });

        veloraDrafts.forEach(d => {
          foundDrafts.push({
            id: d.id,
            type: 'velora',
            title: `Velora (${d.serviceCategory || 'Draft'})`,
            description: `Audit: ${d.auditNumber || 'N/A'} · Saved ${relativeTime(d.updatedAt)}`,
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
    const routes = { villa: '/villa', wv: '/wv', velora: '/velora', apartment: '/apartment' };
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
        } else if (draft.type === 'apartment') {
          await api.delete(`/api/apartment/drafts/${draft.id}`);
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

          {user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN'
            && !['villa', 'apartment', 'wv', 'velora'].some((m) => canAccessModule(user, m)) && (
            <p style={{ color: 'var(--gray)', fontStyle: 'italic' }}>
              No modules are enabled on your account yet. Ask an administrator to grant access.
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            {canAccessModule(user, 'villa') && (
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
            )}

            {canAccessModule(user, 'apartment') && (
              <div
                className="card card-clickable module-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate('/apartment')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/apartment'); } }}
              >
                <span className="module-icon"><HomeIcon /></span>
                <div>
                  <h3>Apartment Audit</h3>
                  <p>Room-by-room apartment inspection checklist.</p>
                </div>
              </div>
            )}

            {canAccessModule(user, 'wv') && (
              <div
                className="card card-clickable module-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate('/wv')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/wv'); } }}
              >
                <span className="module-icon"><BuildingIcon /></span>
                <div>
                  <h3>Workers Village</h3>
                  <p>Accommodation compliance audits.</p>
                </div>
              </div>
            )}

            {canAccessModule(user, 'velora') && (
              <div
                className="card card-clickable module-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate('/velora')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/velora'); } }}
              >
                <span className="module-icon"><SparkleIcon /></span>
                <div>
                  <h3>Velora</h3>
                  <p>Facilities services performance audits.</p>
                </div>
              </div>
            )}

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
