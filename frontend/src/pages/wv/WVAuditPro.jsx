import React, { useState, useEffect } from 'react';
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
import {
  Building2, FileText, ClipboardList, Save, LogOut, ThumbsUp, ThumbsDown, LayoutDashboard, ArrowLeft, CheckCircle
} from 'lucide-react';
import { generatePdfReport } from '../../utils/pdfGenerator.js';

export default function WVAuditPro() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('audit');
  const [resumeDraft, setResumeDraft] = useState(null);
  const [draftsKey, setDraftsKey] = useState(0);

  useEffect(() => {
    if (location.state?.resumeDraft) {
      setResumeDraft(location.state.resumeDraft);
      setActiveTab('audit');
      window.history.replaceState({}, document.title);
    }
  }, [location]);

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
            <img src="/logo.png" alt="JR Dream Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <div>
              <h1 className="wv-header-title" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--zinc-900)', margin: '0 0 2px 0', display: 'block' }}>JR DREAM</h1>
              <p className="wv-header-subtitle" style={{ fontSize: '12px', color: 'var(--zinc-500)', margin: 0, textTransform: 'uppercase' }}>WORKERS VILLAGE ACCOMMODATION AUDIT</p>
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
              onResumed={() => setResumeDraft(null)}
              onDraftSaved={() => setDraftsKey((k) => k + 1)}
              onCompleted={() => { setDraftsKey((k) => k + 1); setActiveTab('reports'); }}
            />
          </div>
          {activeTab === 'drafts' && <DraftsList refreshKey={draftsKey} onResume={handleResume} onStartNew={() => setActiveTab('audit')} />}
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

function AuditWorkspace({ resumeDraft, onResumed, onDraftSaved, onCompleted }) {
  const { show } = useToast();
  const [phase, setPhase] = useState('setup'); // setup, checklist, complete
  const [draftId, setDraftId] = useState(null);
  const [meta, setMeta] = useState(emptyMeta);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [offlineDraft, setOfflineDraft] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  // Check for local offline backup draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wv_inspection_offline_draft');
      if (saved) {
        setOfflineDraft(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load offline draft from localStorage:', e);
    }
  }, []);

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
    setPhase('checklist');
    show('Draft loaded — continue where you left off.', 'info');
    onResumed?.();
  }, [resumeDraft, onResumed, show]);

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
    { enabled: phase === 'checklist' && !loading, localStorageKey: 'wv_inspection_offline_draft' },
  );

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

  const completeAudit = async () => {
    setLoading(true);
    try {
      await wv.saveAudit({ draftId: draftId || undefined, ...getPayload() });
      setPhase('complete');
      try {
        localStorage.removeItem('wv_inspection_offline_draft');
      } catch (e) {}
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
    try {
      localStorage.removeItem('wv_inspection_offline_draft');
    } catch (e) {}
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
      {offlineDraft && (
        <div style={{
          backgroundColor: 'var(--warn-bg)',
          border: '1px solid var(--warn-solid)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, color: 'var(--warn-fg)', fontSize: '0.9rem' }}>
            <strong>Unsaved Offline Draft Found:</strong> We detected an unsaved Workers Village draft from your previous session (possibly due to network disconnect).
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="wv-btn-action wv-btn-primary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              onClick={() => {
                setMeta(offlineDraft.meta || emptyMeta);
                setResponses(offlineDraft.responses || {});
                setPhase('checklist');
                setOfflineDraft(null);
                show('Offline draft restored.', 'success');
              }}
            >
              Restore Draft
            </button>
            <button
              className="wv-btn-action wv-btn-outline"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'transparent' }}
              onClick={() => {
                try {
                  localStorage.removeItem('wv_inspection_offline_draft');
                } catch (e) {}
                setOfflineDraft(null);
                show('Offline draft dismissed.', 'info');
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

function ChecklistItem({ item, response = { answer: null, comment: '', images: [] }, onChange, onLightbox }) {
  const images = response.images || [];

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
      {response.answer === 'no' && (
        <div style={{ width: '100%', marginTop: 10 }}>
          <textarea
            className="wv-input"
            placeholder="Add comments or details about the issue..."
            value={response.comment || ''}
            onChange={e => onChange({ ...response, comment: e.target.value })}
            style={{ width: '100%', minHeight: 60 }}
          />
          <div style={{ marginTop: '10px' }}>
            <PhotoCapture
              value={images}
              onChange={(next) => onChange({ ...response, images: next })}
              uploadFn={wv.uploadPhoto}
              fetchUrl={wv.fetchPhotoUrl}
              max={3}
              onLightbox={onLightbox}
              hint="Attach up to 3 photos as evidence."
              buttonClassName="wv-btn-action wv-btn-outline"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Lists (Drafts / Reports)
// -----------------------------------------------------------------------------
function DraftsList({ refreshKey, onResume, onStartNew }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    wv.listDrafts()
      .then(setDrafts)
      .catch((e) => show(errorMessage(e, 'Could not load drafts.'), 'error'))
      .finally(() => setLoading(false));
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

  return (
    <div className="wv-card">
      <div className="wv-card-header"><h2 className="wv-card-title">Saved Drafts</h2></div>
      <div>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : drafts.length === 0 ? (
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

/** Adapt a WV audit into the shape generatePdfReport expects (villa/issues). */
function toPdfShape(audit) {
  const issues = Object.entries(audit.responses || {})
    .filter(([, r]) => r.answer === 'no')
    .map(([item, r]) => ({
      area: audit.auditType,
      room: audit.room || '',
      floor: audit.floor || '',
      category: 'WV Checklist',
      spotDesc: item,
      comment: r.comment || '',
      photos: (r.photoIds || []).map((id) => ({ id })),
    }));
  if (issues.length === 0) {
    issues.push({ area: audit.auditType, spotDesc: 'Audit Completed - No Defects Found', category: 'WV Checklist', comment: 'All checked items are compliant.' });
  }
  const dateStr = audit.auditDate ? new Date(audit.auditDate).toISOString().split('T')[0] : '';
  let address = `Audit Date: ${dateStr} | Inspector: ${audit.inspectorName || ''}`;
  if (audit.staffName) address += ` | Staff Name: ${audit.staffName} | Staff No: ${audit.staffNo || ''}`;
  const propertyNumber = (audit.auditType === 'gym' || audit.auditType === 'recreation')
    ? `WV-${audit.auditType.toUpperCase()}`
    : `WV-${audit.cluster || 'X'}-${audit.building || 'X'}-${audit.floor || 'X'}-${audit.room || 'X'}`;
  return {
    auditCode: audit.auditCode,
    villa: { propertyNumber, ownerName: 'Workers Village', address, emirate: 'Dubai', area: 'WV Base' },
    issues,
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
      await generatePdfReport(toPdfShape(audit), { photoEndpoint: '/api/wv/photos' });
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
