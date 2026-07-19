import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { errorMessage } from '../../api/client.js';
import { useAutosave } from '../../hooks/useAutosave.js';
import * as wv from '../../api/wv.js';
import PhotoCapture from '../../components/PhotoCapture.jsx';
import AutosaveStatus from '../../components/AutosaveStatus.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ListSkeleton from '../../components/ListSkeleton.jsx';
import NetworkStatus from '../../components/NetworkStatus.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import Lightbox from '../../components/Lightbox.jsx';
import './WVAuditPro.css';
import { getChecklist } from './wvChecklists.js';
import { cleanLocalPhotosForDraft, uploadLocalPhoto } from '../../utils/localPhotoStore.js';
import {
  Building2, FileText, ClipboardList, Save, LogOut, ThumbsUp, ThumbsDown, LayoutDashboard, ArrowLeft, CheckCircle
} from 'lucide-react';
import { generateUnifiedPdf } from '../../utils/pdfGenerator.js';
import { newLocalId, listOfflineDrafts, deleteOfflineDraft, syncOfflineDrafts } from '../../lib/offlineDrafts.js';

// Turn a device-held autosave snapshot ({ meta, responses }) into the on-wire
// draft shape the server expects (same mapping AuditWorkspace.getPayload uses).
function wvPayloadToWire({ meta, responses } = {}) {
  return {
    ...(meta || {}),
    responses: Object.fromEntries(
      Object.entries(responses || {}).map(([item, r]) => [
        item,
        { answer: r.answer ?? undefined, comment: r.comment || undefined, photoIds: (r.images || []).map((img) => img.id).filter(Boolean) },
      ]),
    ),
  };
}

// Push one device-held WV draft to the server (used by the reconnect sync).
async function pushWvDraft(payload, record) {
  // WV photos upload separately (by id). If this draft still has photos captured
  // offline that were never uploaded, don't auto-sync-and-delete it — that would
  // drop those photos. Throwing keeps it on the device so the user can resume it,
  // let the workspace upload the photos, then it syncs cleanly.
  const hasPendingPhotos = Object.values(payload?.responses || {}).some(
    (r) => (r.images || []).some((img) => !img.id),
  );
  if (hasPendingPhotos) throw new Error('draft has photos not yet uploaded');
  await wv.saveDraft({ draftId: record?.serverId || undefined, ...wvPayloadToWire(payload) });
}

export default function WVAuditPro() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('audit');
  const [resumeDraft, setResumeDraft] = useState(null);
  const [resumeOffline, setResumeOffline] = useState(null);
  const [draftsKey, setDraftsKey] = useState(0);

  useEffect(() => {
    if (location.state?.resumeDraft) {
      setResumeDraft(location.state.resumeDraft);
      setActiveTab('audit');
      window.history.replaceState({}, document.title);
    } else if (location.state?.resumeOfflineDraft) {
      setResumeOffline(location.state.resumeOfflineDraft);
      setActiveTab('audit');
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Push any device-held drafts to the server on mount and on reconnect — covers
  // drafts from other audit sessions (saved audit A offline, moved to B; A syncs).
  useEffect(() => {
    const runSync = async () => {
      const { synced } = await syncOfflineDrafts('wv', pushWvDraft).catch(() => ({ synced: 0 }));
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
    setActiveTab('audit');
  }

  function handleResumeOffline(record) {
    setResumeOffline(record);
    setActiveTab('audit');
  }

  return (
    <div className="wv-container">
      <div className="wv-wrapper">
        <header className="wv-header">
          <div 
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
              <h1 className="wv-header-title" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--zinc-900)', margin: '0 0 2px 0', display: 'block' }}>WORKERS VILLAGE ACCOMMODATION AUDIT</h1>
            </div>
          </div>
          <div className="wv-header-actions">
            <NetworkStatus />
            <ThemeToggle />
            <div className="wv-badge">{user?.username} · {user?.role}</div>
            <button className="wv-btn-text" onClick={() => navigate('/')}>
              <LayoutDashboard size={14} /> Dashboard
            </button>
            <button className="wv-btn-text" onClick={logout}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>

        <nav className="wv-nav">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Building2 },
            { id: 'audit', label: 'New Audit', icon: ClipboardList },
            { id: 'drafts', label: 'Drafts', icon: Save },
            { id: 'reports', label: 'Reports', icon: FileText }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`wv-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </nav>

        <main>
          {activeTab === 'dashboard' && <DashboardStats />}
          {/* Stays mounted (just hidden) so an in-progress audit isn't lost on tab switch. */}
          <div style={{ display: activeTab === 'audit' ? 'block' : 'none' }}>
            <AuditWorkspace
              resumeDraft={resumeDraft}
              resumeOfflineDraft={resumeOffline}
              onResumed={() => setResumeDraft(null)}
              onOfflineResumed={() => setResumeOffline(null)}
              onDraftSaved={() => setDraftsKey((k) => k + 1)}
              onCompleted={() => { setDraftsKey((k) => k + 1); setActiveTab('reports'); }}
            />
          </div>
          {activeTab === 'drafts' && <DraftsList refreshKey={draftsKey} onResume={handleResume} onResumeOffline={handleResumeOffline} onStartNew={() => setActiveTab('audit')} />}
          {activeTab === 'reports' && <ReportsList onStartNew={() => setActiveTab('audit')} />}
        </main>
      </div>
    </div>
  );
}

function DashboardStats() {
  const { show } = useToast();
  const [stats, setStats] = useState({ totalAudits: 0, complianceRate: '100%', drafts: 0, reports: 0 });
  useEffect(() => {
    wv.getStats().then(setStats).catch((e) => show(errorMessage(e, 'Could not load stats.'), 'error'));
  }, [show]);
  return (
    <div className="wv-stats-grid">
      <StatCard title="Total Audits" value={stats.totalAudits.toLocaleString()} />
      <StatCard title="Compliance Rate" value={stats.complianceRate} />
      <StatCard title="Drafts" value={stats.drafts.toLocaleString()} />
      <StatCard title="Reports" value={stats.reports.toLocaleString()} />
    </div>
  );
}
function StatCard({ title, value }) {
  return (
    <div className="wv-stat-card">
      <h3 className="wv-stat-label">{title}</h3>
      <p className="wv-stat-value">{value}</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Audit Workspace (Welcome Form -> Checklist -> Complete)
// -----------------------------------------------------------------------------
const emptyMeta = {
  auditType: 'rooms',
  cluster: '',
  building: '',
  floor: '',
  room: '',
  staffName: '',
  staffNo: '',
  auditDate: new Date().toISOString().split('T')[0],
  inspectorName: ''
};

/** Convert the on-wire responses shape (photoIds only) into the UI shape (adds a
 *  placeholder images array; thumbnails resolve by id via PhotoThumb). */
function responsesFromWire(responses) {
  const out = {};
  for (const [item, r] of Object.entries(responses || {})) {
    out[item] = { answer: r.answer ?? null, comment: r.comment || '', images: (r.photoIds || []).map((id) => ({ id })) };
  }
  return out;
}

function AuditWorkspace({ resumeDraft, resumeOfflineDraft, onResumed, onOfflineResumed, onDraftSaved, onCompleted }) {
  const { show } = useToast();
  const [phase, setPhase] = useState('setup'); // setup, checklist, complete
  const [draftId, setDraftId] = useState(null);
  const [meta, setMeta] = useState(emptyMeta);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [syncingPhotos, setSyncingPhotos] = useState(false);
  // Turns on the inline "remark + photo required" highlights after a blocked completion.
  const [showEvidenceErrors, setShowEvidenceErrors] = useState(false);

  // Stable id for the audit open in the workspace, so repeated offline saves
  // update ONE device record. Reset on clear; set to a draft's id when resuming.
  const localIdRef = useRef(newLocalId());

  useEffect(() => {
    if (!resumeDraft) return;
    setMeta({
      auditType: resumeDraft.auditType || 'rooms',
      cluster: resumeDraft.cluster || '',
      building: resumeDraft.building || '',
      floor: resumeDraft.floor || '',
      room: resumeDraft.room || '',
      staffName: resumeDraft.staffName || '',
      staffNo: resumeDraft.staffNo || '',
      auditDate: resumeDraft.auditDate ? new Date(resumeDraft.auditDate).toISOString().split('T')[0] : emptyMeta.auditDate,
      inspectorName: resumeDraft.inspectorName || '',
    });
    setResponses(responsesFromWire(resumeDraft.responses));
    setDraftId(resumeDraft.id);
    localIdRef.current = newLocalId(); // server draft is canonical; fresh local slot
    setPhase('checklist');
    show('Draft loaded — continue where you left off.', 'info');
    onResumed?.();
  }, [resumeDraft, onResumed, show]);

  // Resume a draft held only on this device (saved offline). Its payload is the
  // exact autosave snapshot, so meta/responses map straight on; keep its localId.
  useEffect(() => {
    if (!resumeOfflineDraft) return;
    const p = resumeOfflineDraft.payload || {};
    localIdRef.current = resumeOfflineDraft.localId;
    setMeta({ ...emptyMeta, ...(p.meta || {}) });
    setResponses(p.responses || {});
    setDraftId(resumeOfflineDraft.serverId || null);
    setPhase('checklist');
    show('Device draft loaded — continue where you left off.', 'info');
    onOfflineResumed?.();
  }, [resumeOfflineDraft, onOfflineResumed, show]);

  const isNonRoom = meta.auditType === 'gym' || meta.auditType === 'recreation';
  const showStaff = meta.auditType === 'rooms' && meta.room !== 'Corridor' && meta.room !== 'Stairways';

  // Silently keep the draft in sync while the user works through the checklist —
  // separate from the manual Save Draft button, which still gives its own toast.
  const autosave = useAutosave(
    { meta, responses },
    async () => {
      const draft = await wv.saveDraft({ draftId: draftId || undefined, ...getPayload() });
      setDraftId(draft.id);
      onDraftSaved?.();
    },
    {
      enabled: phase === 'checklist' && !loading,
      offline: {
        module: 'wv',
        getLocalId: () => localIdRef.current,
        getServerId: () => draftId,
        getLabel: () => {
          const where = isNonRoom ? meta.auditType?.toUpperCase() : [meta.cluster, meta.building, meta.room && `Room ${meta.room}`].filter(Boolean).join(' · ');
          return where || 'WV audit';
        },
      },
    },
  );

  useEffect(() => {
    if (phase !== 'checklist') return;

    let active = true;
    async function performSync() {
      if (typeof navigator === 'undefined' || !navigator.onLine || syncingPhotos) return;

      const hasLocal = Object.values(responses).some(r => r.images?.some(img => typeof img.id === 'string' && img.id.startsWith('local-')));
      if (!hasLocal) return;

      setSyncingPhotos(true);
      try {
        let responsesChanged = false;
        const nextResponses = { ...responses };

        for (const [item, r] of Object.entries(responses)) {
          if (!r.images) continue;

          let itemChanged = false;
          const nextImages = await Promise.all(r.images.map(async (img) => {
            if (typeof img.id === 'string' && img.id.startsWith('local-')) {
              try {
                const serverId = await uploadLocalPhoto(img.id, wv.uploadPhoto);
                itemChanged = true;
                return { id: serverId };
              } catch (err) {
                console.error('Failed to sync WV response photo:', err);
                return img;
              }
            }
            return img;
          }));

          if (itemChanged) {
            responsesChanged = true;
            nextResponses[item] = { ...r, images: nextImages };
          }
        }

        if (responsesChanged && active) {
          setResponses(nextResponses);
          show('Offline photos synchronized successfully.', 'success');
        }
      } catch (err) {
        console.error('Error during WV photo synchronization:', err);
      } finally {
        if (active) setSyncingPhotos(false);
      }
    }

    performSync();

    window.addEventListener('online', performSync);
    return () => {
      active = false;
      window.removeEventListener('online', performSync);
    };
  }, [phase, responses, syncingPhotos, show]);

  const handleStart = () => setPhase('checklist');

  const constructPropertyNumber = () => {
    if (isNonRoom) return `WV-${meta.auditType.toUpperCase()}`;
    return `WV-${meta.cluster || 'X'}-${meta.building || 'X'}-${meta.floor || 'X'}-${meta.room || 'X'}`;
  };

  const getPayload = () => ({
    ...meta,
    responses: Object.fromEntries(
      Object.entries(responses).map(([item, r]) => [
        item,
        { answer: r.answer ?? undefined, comment: r.comment || undefined, photoIds: (r.images || []).map((img) => img.id).filter(Boolean) },
      ]),
    ),
  });

  const saveDraft = async () => {
    setLoading(true);
    try {
      // Goes through the same save path as autosave (flush bypasses its debounce)
      // so there's only ever one source of truth for "is this draft saved".
      const result = await autosave.flush();
      if (result === 'saved' || result === 'skipped') {
        show('Draft saved.', 'success');
      } else if (result === 'offline') {
        show('Offline — draft kept on this device and will sync when back online.', 'info');
      } else if (result === 'error') {
        show('Could not save draft.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Non-compliant ("No") items must carry evidence: a remark AND at least one photo.
  const incompleteNoItems = () =>
    Object.entries(responses)
      .filter(([, r]) => r?.answer === 'no')
      .filter(([, r]) => !String(r.comment || '').trim() || !(r.images || []).length)
      .map(([item]) => item);

  const completeAudit = async () => {
    const incomplete = incompleteNoItems();
    if (incomplete.length) {
      setShowEvidenceErrors(true);
      show(`Every "No" item needs a remark and at least one photo. ${incomplete.length} item(s) still missing evidence.`, 'error');
      return;
    }
    setLoading(true);
    try {
      await wv.saveAudit({ draftId: draftId || undefined, ...getPayload() });
      setPhase('complete');
      deleteOfflineDraft(localIdRef.current).catch(() => {});
    } catch (e) {
      show(errorMessage(e, 'Could not complete audit.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  function resetAll() {
    setPhase('setup');
    setDraftId(null);
    setMeta(emptyMeta);
    setResponses({});
    setShowEvidenceErrors(false);
    deleteOfflineDraft(localIdRef.current).catch(() => {});
    localIdRef.current = newLocalId();
  }

  const getLiveStats = () => {
    let compliantCount = 0;
    let nonCompliantCount = 0;
    for (const item of Object.values(responses || {})) {
      if (item?.answer === 'yes') compliantCount++;
      else if (item?.answer === 'no') nonCompliantCount++;
    }
    const totalItems = compliantCount + nonCompliantCount;
    const complianceRate = totalItems > 0 ? Math.round((compliantCount / totalItems) * 100) : 0;
    return { totalItems, compliantCount, nonCompliantCount, complianceRate };
  };

  if (phase === 'complete') {
    return (
      <div className="wv-card" style={{ textAlign: 'center', padding: '40px' }}>
        <CheckCircle size={48} color="var(--ok)" style={{ margin: '0 auto 20px' }} />
        <h2>Audit Complete!</h2>
        <p>Your report has been saved successfully.</p>
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="wv-btn-action wv-btn-primary" onClick={() => onCompleted?.()}>View Reports</button>
          <button className="wv-btn-action wv-btn-outline" onClick={resetAll}>New Audit</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {phase === 'setup' && (
        <section className="wv-card">
          <div className="wv-card-header"><h2 className="wv-card-title">Audit Information</h2></div>
          <div className="wv-form-grid">
            <FormSelect label="Audit Type" value={meta.auditType} onChange={v => setMeta({...meta, auditType: v})} options={[{v:'rooms',l:'Rooms Audit'},{v:'gym',l:'Gym Audit'},{v:'recreation',l:'Recreation Audit'}]} />
            {!isNonRoom && (
              <>
                <FormSelect label="Cluster/Block" value={meta.cluster} onChange={v => setMeta({...meta, cluster: v})} options={['S1','S2','S3'].map(x=>({v:x,l:x}))} />
                <FormSelect label="Building" value={meta.building} onChange={v => setMeta({...meta, building: v})} options={['1','2','3','4'].map(x=>({v:x,l:x}))} />
                <FormSelect label="Floor" value={meta.floor} onChange={v => setMeta({...meta, floor: v})} options={['Ground','First','Second','Third'].map(x=>({v:x,l:x}))} />
                <FormSelect label="Room / Area" value={meta.room} onChange={v => setMeta({...meta, room: v})} options={['Corridor','Stairways',...Array.from({length:40},(_,i)=>String(i+1))].map(x=>({v:x,l:x}))} />
              </>
            )}
          </div>
          {showStaff && (
            <div className="wv-form-grid" style={{ borderTop: '1px solid var(--zinc-100)', paddingTop: 15, marginTop: 15 }}>
              <FormInput label="Staff Name" value={meta.staffName} onChange={v => setMeta({...meta, staffName: v})} />
              <FormInput label="Staff No" value={meta.staffNo} onChange={v => setMeta({...meta, staffNo: v})} />
            </div>
          )}
          <div className="wv-form-grid" style={{ borderTop: '1px solid var(--zinc-100)', paddingTop: 15, marginTop: 15 }}>
            <FormInput label="Audit Date" type="date" value={meta.auditDate} onChange={v => setMeta({...meta, auditDate: v})} />
            <FormInput label="Inspector Name" value={meta.inspectorName} onChange={v => setMeta({...meta, inspectorName: v})} />
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="wv-btn-action wv-btn-primary" onClick={handleStart}>Start Audit</button>
          </div>
        </section>
      )}

      {phase === 'checklist' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="wv-btn-text" onClick={() => setPhase('setup')}><ArrowLeft size={16} /> Back to Location</button>
            <div className="wv-badge">{constructPropertyNumber()}</div>
          </div>

          {(() => {
            const stats = getLiveStats();
            const totalChecklistItems = getChecklist(meta.auditType, meta.room).reduce((s, sec) => s + sec.items.length, 0);
            const answeredPct = totalChecklistItems > 0 ? Math.round((stats.totalItems / totalChecklistItems) * 100) : 0;
            let scoreColor = 'var(--danger)'; // Red
            if (stats.complianceRate >= 90) scoreColor = 'var(--ok-fg)'; // Green
            else if (stats.complianceRate >= 75) scoreColor = 'var(--warn-solid)'; // Orange
            else if (stats.complianceRate >= 60) scoreColor = 'var(--primary)'; // Blue

            return (
              <div className="wv-card" style={{ padding: '1rem', marginTop: '1rem', borderLeft: `4px solid ${scoreColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--zinc-500)', marginBottom: '0.75rem' }}>
                  <span>{stats.totalItems} of {totalChecklistItems} checklist items answered</span>
                  <span>{answeredPct}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--zinc-100)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                  <div style={{ width: `${answeredPct}%`, height: '100%', backgroundColor: 'var(--zinc-400)', transition: 'width 0.3s ease' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--zinc-500)', letterSpacing: '0.5px' }}>Live Compliance Rate</h3>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: '800', color: scoreColor }}>{stats.complianceRate}%</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--zinc-400)' }}>({stats.compliantCount} of {stats.totalItems} scored elements)</span>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: '150px', maxWidth: '300px' }}>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--zinc-100)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${stats.complianceRate}%`, height: '100%', backgroundColor: scoreColor, transition: 'width 0.3s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--zinc-500)' }}>
                      <span>Compliant: {stats.compliantCount}</span>
                      <span>Non-Compliant: {stats.nonCompliantCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="wv-checklist" style={{ marginTop: '1rem' }}>
            {getChecklist(meta.auditType, meta.room).map(section => (
              <section key={section.name} className="wv-card" style={{ marginBottom: 20 }}>
                <div className="wv-card-header"><h3 className="wv-card-title">{section.name}</h3></div>
                {section.items.map(item => (
                  <ChecklistItem
                    key={item} item={item}
                    response={responses[item]}
                    onChange={r => setResponses(prev => ({...prev, [item]: r}))}
                    onLightbox={setLightbox}
                    showErrors={showEvidenceErrors}
                  />
                ))}
              </section>
            ))}
          </div>

          <div className="wv-action-bar" style={{ alignItems: 'center' }}>
            <AutosaveStatus autosave={autosave} />
            <button className="wv-btn-action wv-btn-outline" onClick={saveDraft} disabled={loading}>{loading ? 'Saving...' : 'Save now'}</button>
            <button className="wv-btn-action wv-btn-primary" onClick={completeAudit} disabled={loading}>{loading ? 'Completing...' : 'Complete & Save'}</button>
          </div>
        </>
      )}
      {lightbox && (
        <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function FormInput({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <div className="wv-form-group">
      <label className="wv-form-label">{label}</label>
      <input type={type} className="wv-input" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
function FormSelect({ label, value, onChange, options, disabled }) {
  return (
    <div className="wv-form-group">
      <label className="wv-form-label">{label}</label>
      <select className="wv-select" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
        <option value="">Select...</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function ChecklistItem({ item, response = { answer: null, comment: '', images: [] }, onChange, onLightbox, showErrors = false }) {
  const images = response.images || [];
  const isNo = response.answer === 'no';
  const missingComment = isNo && !String(response.comment || '').trim();
  const missingPhoto = isNo && images.length === 0;

  return (
    <div className="wv-check-item">
      <div className="wv-check-text">
        <p className="wv-check-question">{item}</p>
      </div>
      <div className="wv-check-actions">
        <button
          onClick={() => onChange({ ...response, answer: 'yes', comment: '', images: [] })}
          className={`wv-toggle ${response.answer === 'yes' ? 'active-yes' : ''}`}
        ><ThumbsUp size={14} /> Yes</button>
        <button
          onClick={() => onChange({ ...response, answer: 'no' })}
          className={`wv-toggle ${response.answer === 'no' ? 'active-no' : ''}`}
        ><ThumbsDown size={14} /> No</button>
      </div>
      {isNo && (
        <div style={{ width: '100%', marginTop: 10 }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--warn-fg)', margin: '0 0 6px 0', fontWeight: 600 }}>
            Non-compliant — a remark and at least one photo are required.
          </p>
          <textarea
            className="wv-input"
            placeholder="Add a remark describing the issue (required)..."
            value={response.comment || ''}
            onChange={e => onChange({ ...response, comment: e.target.value })}
            style={{ width: '100%', minHeight: 60, borderColor: showErrors && missingComment ? 'var(--danger)' : undefined }}
          />
          {showErrors && missingComment && (
            <p style={{ fontSize: '0.72rem', color: 'var(--danger)', margin: '4px 0 0 0' }}>A remark is required for a non-compliant item.</p>
          )}
          <div style={{ marginTop: '10px' }}>
            <PhotoCapture
              value={images}
              onChange={(next) => onChange({ ...response, images: next })}
              uploadFn={wv.uploadPhoto}
              fetchUrl={wv.fetchPhotoUrl}
              max={3}
              onLightbox={onLightbox}
              hint="Attach at least one photo as evidence (up to 3)."
              buttonClassName="wv-btn-action wv-btn-outline"
            />
            {showErrors && missingPhoto && (
              <p style={{ fontSize: '0.72rem', color: 'var(--danger)', margin: '4px 0 0 0' }}>At least one photo is required as evidence.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Lists (Drafts / Reports)
// -----------------------------------------------------------------------------
function DraftsList({ refreshKey, onResume, onResumeOffline, onStartNew }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState([]);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOffline = () => {
    listOfflineDrafts('wv').then(setOfflineDrafts).catch(() => setOfflineDrafts([]));
  };

  useEffect(() => {
    setLoading(true);
    fetchOffline();
    wv.listDrafts()
      .then(setDrafts)
      // Offline (or a server hiccup) shouldn't nag — device drafts below still show.
      .catch((e) => { if (navigator.onLine) show(errorMessage(e, 'Could not load drafts.'), 'error'); })
      .finally(() => setLoading(false));
    const onOnline = () => fetchOffline();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refreshKey, show]);

  async function resume(id) {
    try {
      onResume(await wv.getDraft(id));
    } catch (e) {
      show(errorMessage(e, 'Could not open draft.'), 'error');
    }
  }

  async function remove(id) {
    if (!(await confirm('Are you sure you want to delete this draft?'))) return;
    try {
      await wv.deleteDraft(id);
      show('Draft deleted.', 'success');
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      show(errorMessage(e, 'Could not delete draft.'), 'error');
    }
  }

  async function removeOffline(record) {
    if (!(await confirm('Delete this draft from this device? It has not been synced to the server.'))) return;
    try { cleanLocalPhotosForDraft(record.payload, 'wv'); } catch (e) {}
    await deleteOfflineDraft(record.localId).catch(() => {});
    setOfflineDrafts((prev) => prev.filter((d) => d.localId !== record.localId));
    show('Device draft deleted.', 'success');
  }

  return (
    <div className="wv-card">
      <div className="wv-card-header"><h2 className="wv-card-title">Saved Drafts</h2></div>
      <div>
        {offlineDrafts.map((d) => (
          <div key={d.localId} className="wv-list-item">
            <div>
              <h3 className="wv-list-title">
                {d.label || 'WV audit'}
                <span className="badge" style={{ marginLeft: '8px', color: 'var(--warn-fg)', background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}>
                  On this device · not synced
                </span>
              </h3>
              <p className="wv-list-meta">Saved: {new Date(d.updatedAt).toLocaleString()} · syncs automatically when back online</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button className="wv-list-link" onClick={() => onResumeOffline(d)}>Resume</button>
              <button className="wv-list-link" style={{ color: 'var(--danger)' }} onClick={() => removeOffline(d)}>Delete</button>
            </div>
          </div>
        ))}
        {loading ? (
          <ListSkeleton rows={3} />
        ) : drafts.length === 0 && offlineDrafts.length === 0 ? (
          <EmptyState
            title="No drafts yet"
            message="Drafts you save while working through a checklist will show up here."
            ctaLabel="Start a new audit"
            onCta={onStartNew}
            buttonClassName="wv-btn-action wv-btn-primary"
          />
        ) : drafts.map(d => (
          <div key={d.id} className="wv-list-item">
            <div>
               <h3 className="wv-list-title">{d.cluster || d.auditType} · {d.building || ''} {d.room ? `Room ${d.room}` : ''}</h3>
               <p className="wv-list-meta">Updated: {new Date(d.updatedAt).toLocaleString()}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button className="wv-list-link" onClick={() => resume(d.id)}>Resume</button>
              <button className="wv-list-link" style={{ color: 'var(--danger)' }} onClick={() => remove(d.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Build a WV audit into the unified report structure (matches Velora's format),
 *  grouping checklist items by category and scoring by compliance rate. */
function buildWvReport(audit) {
  const groups = getChecklist(audit.auditType, audit.room);
  const responses = audit.responses || {};

  let total = 0;
  let compliant = 0;
  const sections = groups
    .map((g) => ({
      title: g.name,
      items: g.items
        .filter((q) => responses[q]) // only items that were assessed
        .map((q) => {
          const r = responses[q];
          const yes = r.answer === 'yes';
          const no = r.answer === 'no';
          if (yes || no) { total += 1; if (yes) compliant += 1; }
          return {
            heading: q,
            status: yes ? 'ok' : no ? 'bad' : undefined,
            statusLabel: yes ? 'Compliant' : no ? 'Non-Compliant' : 'Not Assessed',
            lines: r.comment ? [`Remark: ${r.comment}`] : [],
            photos: (r.photoIds || []).map((id) => ({ id })),
          };
        }),
    }))
    .filter((s) => s.items.length);

  const percent = total > 0 ? (compliant / total) * 100 : 100;
  const rating = percent >= 90 ? 'Excellent' : percent >= 75 ? 'Good' : percent >= 60 ? 'Average' : 'Poor';

  const isNonRoom = audit.auditType === 'gym' || audit.auditType === 'recreation';
  const dateStr = audit.auditDate ? new Date(audit.auditDate).toISOString().split('T')[0] : '';
  const location = isNonRoom
    ? `WV-${audit.auditType.toUpperCase()}`
    : `WV-${audit.cluster || 'X'}-${audit.building || 'X'}-${audit.floor || 'X'}-${audit.room || 'X'}`;
  const typeLabel = String(audit.auditType || 'rooms').replace(/^\w/, (c) => c.toUpperCase());

  const info = [
    { label: 'Audit Number', value: audit.auditCode || 'N/A' },
    { label: 'Audit Type', value: `Workers Village — ${typeLabel}` },
    { label: 'Location', value: location },
    { label: 'Audit Date', value: `${dateStr}  |  Inspector: ${audit.inspectorName || ''}` },
  ];
  if (audit.staffName) {
    info.push({ label: 'Staff', value: `${audit.staffName}${audit.staffNo ? ` (No. ${audit.staffNo})` : ''}` });
  }

  return {
    reportTitle: 'Facilities Audit Report',
    fileName: `${audit.auditCode || 'WV_Audit'}.pdf`,
    info,
    score: { percent, rating },
    sections,
  };
}

function ReportsList({ onStartNew }) {
  const { show } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    setLoading(true);
    wv.listAudits()
      .then(setReports)
      .catch((e) => show(errorMessage(e, 'Could not load reports.'), 'error'))
      .finally(() => setLoading(false));
  }, [show]);

  const download = async (code) => {
    try {
      setDownloading(code);
      const audit = await wv.getAudit(code);
      await generateUnifiedPdf(buildWvReport(audit), { photoEndpoint: '/api/wv/photos' });
    } catch (err) {
      show(errorMessage(err, 'Could not generate PDF.'), 'error');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="wv-card">
      <div className="wv-card-header"><h2 className="wv-card-title">Generated Reports</h2></div>
      <div>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : reports.length === 0 ? (
          <EmptyState
            title="No completed audits yet"
            message="Finish an accommodation audit and it will appear here as a downloadable report."
            ctaLabel="Start a new audit"
            onCta={onStartNew}
            buttonClassName="wv-btn-action wv-btn-primary"
          />
        ) : reports.map(r => (
          <div key={r.auditCode} className="wv-list-item">
            <div>
               <h3 className="wv-list-title">{r.auditCode} - {r.cluster || r.auditType} {r.room ? `Room ${r.room}` : ''}</h3>
               <p className="wv-list-meta">Generated: {new Date(r.createdAt).toLocaleString()} • {r.nonCompliantCount} non-compliant / {r.totalItems} items</p>
            </div>
            <button
              className="wv-list-link"
              onClick={() => download(r.auditCode)}
              disabled={downloading === r.auditCode}
            >
              {downloading === r.auditCode ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
