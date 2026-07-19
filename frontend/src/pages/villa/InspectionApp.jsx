import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router-dom';
import NetworkStatus from '../../components/NetworkStatus.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import Lightbox from '../../components/Lightbox.jsx';
import { LayoutDashboard, LogOut } from 'lucide-react';

import { saveDraft } from '../../api/villa.js';
import { syncOfflineDrafts } from '../../lib/offlineDrafts.js';

import NewInspectionTab from './NewInspectionTab.jsx';
import ReportsTab from './ReportsTab.jsx';
import DraftsTab from './DraftsTab.jsx';

// Push one device-held Villa draft to the server (used by the reconnect sync).
async function pushVillaDraft(payload, record) {
  const { property, issues } = payload || {};
  // Villa photos upload separately (by id). If this draft still has photos captured
  // offline that were never uploaded, don't auto-sync-and-delete it — the user
  // resumes it, the workspace uploads the photos, then it syncs cleanly.
  const hasPendingPhotos = (issues || []).some(
    (iss) => (iss.photoIds || []).some((id) => typeof id === 'string' && id.startsWith('local-')),
  );
  if (hasPendingPhotos) throw new Error('draft has photos not yet uploaded');
  await saveDraft({ draftId: record?.serverId || undefined, ...(property || {}), issues: issues || [] });
}

export default function InspectionApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState('new');
  const [resumeDraft, setResumeDraft] = useState(null);
  const [resumeOffline, setResumeOffline] = useState(null);
  const [reportsKey, setReportsKey] = useState(0);
  const [draftsKey, setDraftsKey] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (location.state?.resumeDraft) {
      setResumeDraft(location.state.resumeDraft);
      setTab('new');
      window.history.replaceState({}, document.title);
    } else if (location.state?.resumeOfflineDraft) {
      setResumeOffline(location.state.resumeOfflineDraft);
      setTab('new');
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Push any device-held drafts to the server on mount and on reconnect — covers
  // drafts from other inspection sessions (saved villa A offline, moved to B; A syncs).
  useEffect(() => {
    const runSync = async () => {
      const { synced } = await syncOfflineDrafts('villa', pushVillaDraft).catch(() => ({ synced: 0 }));
      if (synced > 0) setDraftsKey((k) => k + 1);
    };
    runSync();
    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, []);

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') {
      navigate('/admin');
    }
  }, [user, navigate]);

  if (user?.role === 'SUPERADMIN') return null;

  function handleResume(draft) {
    setResumeDraft(draft);
    setTab('new');
  }

  function handleResumeOffline(record) {
    setResumeOffline(record);
    setTab('new');
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div 
          className="logo" 
          onClick={() => navigate('/')} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              navigate('/');
            }
          }}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--zinc-900)', margin: '0 0 2px 0' }}>JR DREAM</h1>
            <p style={{ fontSize: '12px', color: 'var(--zinc-500)', margin: 0, textTransform: 'uppercase' }}>SNAG AUDIT PORTAL</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <NetworkStatus />
          <ThemeToggle />
          <span className="status-badge" style={{ padding: '6px 12px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border)', boxShadow: 'none' }}>
            {user?.username} · {user?.role}
          </span>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--zinc-600)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: 'none' }}>
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button className="btn-secondary" onClick={logout} style={{ background: 'transparent', border: 'none', color: 'var(--zinc-600)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: 'none' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>New Inspection</button>
        <button className={`tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Reports</button>
        <button className={`tab ${tab === 'drafts' ? 'active' : ''}`} onClick={() => setTab('drafts')}>Drafts</button>
      </div>

      {/* New tab stays mounted (just hidden) so an in-progress inspection isn't lost on tab switch. */}
      <div style={{ display: tab === 'new' ? 'block' : 'none' }}>
        <NewInspectionTab
          resumeDraft={resumeDraft}
          resumeOfflineDraft={resumeOffline}
          onResumed={() => setResumeDraft(null)}
          onOfflineResumed={() => setResumeOffline(null)}
          onCompleted={() => { setReportsKey((k) => k + 1); setDraftsKey((k) => k + 1); setTab('reports'); }}
          onDraftSaved={() => setDraftsKey((k) => k + 1)}
          onLightbox={setLightbox}
        />
      </div>
      {tab === 'reports' && <ReportsTab refreshKey={reportsKey} onLightbox={setLightbox} onStartNew={() => setTab('new')} />}
      {tab === 'drafts' && <DraftsTab refreshKey={draftsKey} onResume={handleResume} onResumeOffline={handleResumeOffline} onStartNew={() => setTab('new')} />}

      {lightbox && (
        <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
