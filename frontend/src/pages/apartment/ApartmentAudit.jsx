import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import { errorMessage } from '../../api/client.js';
import { useAutosave } from '../../hooks/useAutosave.js';
import * as apt from '../../api/apartment.js';
import PhotoCapture from '../../components/PhotoCapture.jsx';
import AutosaveStatus from '../../components/AutosaveStatus.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ListSkeleton from '../../components/ListSkeleton.jsx';
import NetworkStatus from '../../components/NetworkStatus.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import Lightbox from '../../components/Lightbox.jsx';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { generateUnifiedPdf } from '../../utils/pdfGenerator.js';
import { newLocalId, listOfflineDrafts, deleteOfflineDraft, syncOfflineDrafts } from '../../lib/offlineDrafts.js';
import { todayLocal, toLocalDateInput } from '../../lib/localDate.js';
import {
  RESPONSE_OPTIONS,
  NON_COMPLIANT_ANSWERS,
  ROOMS_BY_FLOOR,
  buildSections,
  itemKey,
  totalItemCount,
  scoreApartment,
  missingEvidenceKeys,
} from './apartmentChecklists.js';

const emptyMeta = {
  tenantName: '',
  apartmentType: '',
  roomNo: '',
  apartmentNumber: '',
  location: '',
  moveInDate: '',
  landlordName: '',
  auditDate: todayLocal(),
  bedroomCount: 1,
  bathroomCount: 1,
};

/** UI shape ({ images:[{id}] }) → on-wire shape ({ photoIds }). */
const responsesToWire = (responses) =>
  Object.fromEntries(
    Object.entries(responses || {}).map(([key, r]) => [
      key,
      {
        answer: r.answer ?? undefined,
        comment: r.comment || undefined,
        photoIds: (r.images || []).map((img) => img.id).filter(Boolean),
      },
    ]),
  );

/** On-wire shape → UI shape (thumbnails resolve by id via PhotoCapture). */
const responsesFromWire = (responses) =>
  Object.fromEntries(
    Object.entries(responses || {}).map(([key, r]) => [
      key,
      { answer: r.answer ?? null, comment: r.comment || '', images: (r.photoIds || []).map((id) => ({ id })) },
    ]),
  );

const metaToWire = (meta) => ({
  tenantName: meta.tenantName || undefined,
  apartmentType: meta.apartmentType || undefined,
  roomNo: meta.roomNo || undefined,
  apartmentNumber: meta.apartmentNumber || undefined,
  location: meta.location || undefined,
  moveInDate: meta.moveInDate || undefined,
  landlordName: meta.landlordName || undefined,
  auditDate: meta.auditDate,
  bedroomCount: Number(meta.bedroomCount) || 0,
  bathroomCount: Number(meta.bathroomCount) || 0,
});

/** Push one device-held apartment draft to the server (reconnect sync). */
async function pushApartmentDraft(payload, record) {
  const { meta, responses } = payload || {};
  const wire = responsesToWire(responses);
  // Photos upload separately by id; don't auto-sync-and-delete a draft whose
  // photos never uploaded, or that evidence would be lost.
  const hasPending = Object.values(responses || {}).some((r) => (r.images || []).some((img) => !img.id));
  if (hasPending) throw new Error('draft has photos not yet uploaded');
  await apt.saveDraft({ draftId: record?.serverId || undefined, ...metaToWire(meta || {}), responses: wire });
}

export default function ApartmentAudit() {
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

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') navigate('/admin');
  }, [user, navigate]);

  // Push device-held drafts on mount and on reconnect (covers other sessions).
  useEffect(() => {
    const runSync = async () => {
      const { synced } = await syncOfflineDrafts('apartment', pushApartmentDraft).catch(() => ({ synced: 0 }));
      if (synced > 0) setDraftsKey((k) => k + 1);
    };
    runSync();
    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, []);

  if (user?.role === 'SUPERADMIN') return null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div
          className="logo"
          onClick={() => navigate('/')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <h1>Apartment Audit</h1>
            <p>Apartment inspection checklist</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <NetworkStatus />
          <ThemeToggle />
          <span className="status-badge">{user?.username} · {user?.role}</span>
          <button className="btn-secondary" onClick={() => navigate('/')}>
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button className="btn-secondary" onClick={logout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <div className="tabs">
        {[
          { id: 'audit', label: 'New Audit' },
          { id: 'drafts', label: 'Drafts' },
          { id: 'reports', label: 'Reports' },
        ].map((t) => (
          <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Stays mounted (hidden) so an in-progress audit isn't lost on tab switch. */}
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
      {activeTab === 'drafts' && (
        <DraftsList
          refreshKey={draftsKey}
          onResume={(d) => { setResumeDraft(d); setActiveTab('audit'); }}
          onResumeOffline={(d) => { setResumeOffline(d); setActiveTab('audit'); }}
          onStartNew={() => setActiveTab('audit')}
        />
      )}
      {activeTab === 'reports' && <ReportsList onStartNew={() => setActiveTab('audit')} />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Workspace: setup → checklist → complete
// -----------------------------------------------------------------------------
function AuditWorkspace({ resumeDraft, resumeOfflineDraft, onResumed, onOfflineResumed, onDraftSaved, onCompleted }) {
  const { show } = useToast();
  const [phase, setPhase] = useState('setup');
  const [draftId, setDraftId] = useState(null);
  const [meta, setMeta] = useState(emptyMeta);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [showEvidenceErrors, setShowEvidenceErrors] = useState(false);

  // Stable id for this editing session so repeated offline saves update ONE
  // device record instead of piling up.
  const localIdRef = useRef(newLocalId());

  const sections = buildSections(Number(meta.bedroomCount) || 0, Number(meta.bathroomCount) || 0);
  const stats = scoreApartment(sections, responses);
  const totalItems = totalItemCount(Number(meta.bedroomCount) || 0, Number(meta.bathroomCount) || 0);
  const answered = stats.totalItems + stats.naCount;

  useEffect(() => {
    if (!resumeDraft) return;
    setMeta({
      tenantName: resumeDraft.tenantName || '',
      apartmentType: resumeDraft.apartmentType || '',
      roomNo: resumeDraft.roomNo || '',
      apartmentNumber: resumeDraft.apartmentNumber || '',
      location: resumeDraft.location || '',
      moveInDate: toLocalDateInput(resumeDraft.moveInDate),
      landlordName: resumeDraft.landlordName || '',
      auditDate: resumeDraft.auditDate ? toLocalDateInput(resumeDraft.auditDate) : emptyMeta.auditDate,
      bedroomCount: resumeDraft.bedroomCount ?? 1,
      bathroomCount: resumeDraft.bathroomCount ?? 1,
    });
    setResponses(responsesFromWire(resumeDraft.responses));
    setDraftId(resumeDraft.id);
    localIdRef.current = newLocalId(); // server draft is canonical
    setPhase('checklist');
    show('Draft loaded — continue where you left off.', 'info');
    onResumed?.();
  }, [resumeDraft, onResumed, show]);

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

  const autosave = useAutosave(
    { meta, responses },
    async () => {
      const draft = await apt.saveDraft({
        draftId: draftId || undefined,
        ...metaToWire(meta),
        responses: responsesToWire(responses),
      });
      setDraftId(draft.id);
      onDraftSaved?.();
    },
    {
      enabled: phase === 'checklist' && !loading,
      offline: {
        module: 'apartment',
        getLocalId: () => localIdRef.current,
        getServerId: () => draftId,
        getLabel: () => `Apartment ${meta.roomNo || '—'}${meta.tenantName ? ` · ${meta.tenantName}` : ''}`,
      },
    },
  );

  const setM = (k) => (v) => setMeta((m) => ({ ...m, [k]: v }));

  function startChecklist() {
    if (!meta.roomNo.trim()) {
      show('Room is required.', 'error');
      return;
    }
    setPhase('checklist');
  }

  const saveDraftNow = async () => {
    setLoading(true);
    try {
      const result = await autosave.flush();
      if (result === 'saved' || result === 'skipped') show('Draft saved.', 'success');
      else if (result === 'offline') show('Offline — draft kept on this device and will sync when back online.', 'info');
      else if (result === 'error') show('Could not save draft.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const completeAudit = async () => {
    const missing = missingEvidenceKeys(sections, responses);
    if (missing.length) {
      setShowEvidenceErrors(true);
      show(`Every "Needs Improvement" / "Unsatisfactory" item needs a remark and a photo. ${missing.length} item(s) missing evidence.`, 'error');
      return;
    }
    if (answered === 0) {
      show('Answer at least one checklist item before completing.', 'error');
      return;
    }
    setLoading(true);
    try {
      await apt.saveAudit({
        draftId: draftId || undefined,
        ...metaToWire(meta),
        responses: responsesToWire(responses),
      });
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

  if (phase === 'complete') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Inspection Complete</h2>
        <p style={{ color: 'var(--gray)' }}>The report has been saved.</p>
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => onCompleted?.()}>View Reports</button>
          <button className="btn-secondary" onClick={resetAll}>New Inspection</button>
        </div>
      </div>
    );
  }

  return (
    <main className="main-content">
      {phase === 'setup' && (
        <div className="card">
          <div className="card-title">Apartment Information</div>
          <div className="form-grid">
            <div className="form-row">
              <div className="form-group"><label>Tenant Name</label><input value={meta.tenantName} onChange={(e) => setM('tenantName')(e.target.value)} /></div>
              <div className="form-group"><label>Apartment Type</label><input value={meta.apartmentType} onChange={(e) => setM('apartmentType')(e.target.value)} placeholder="e.g. 2 BHK" /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="required">Room</label>
                <select value={meta.roomNo} onChange={(e) => setM('roomNo')(e.target.value)}>
                  <option value="">Select room…</option>
                  {ROOMS_BY_FLOOR.map(({ floor, rooms }) => (
                    <optgroup key={floor} label={`Floor ${floor}`}>
                      {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="form-group"><label>Apartment Number</label><input value={meta.apartmentNumber} onChange={(e) => setM('apartmentNumber')(e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Landlord / Manager</label><input value={meta.landlordName} onChange={(e) => setM('landlordName')(e.target.value)} /></div>
              <div className="form-group"><label>Location</label><input value={meta.location} onChange={(e) => setM('location')(e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Move In Date</label><input type="date" value={meta.moveInDate} onChange={(e) => setM('moveInDate')(e.target.value)} /></div>
              <div className="form-group"><label>Date of Inspection</label><input type="date" value={meta.auditDate} onChange={(e) => setM('auditDate')(e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Bedrooms</label>
                <input type="number" min={0} max={20} value={meta.bedroomCount} onChange={(e) => setM('bedroomCount')(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Bathrooms</label>
                <input type="number" min={0} max={20} value={meta.bathroomCount} onChange={(e) => setM('bathroomCount')(e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ padding: '0 1rem 1rem' }}>
            <button className="btn-primary" onClick={startChecklist} style={{ width: '100%', justifyContent: 'center' }}>
              Start Inspection
            </button>
          </div>
        </div>
      )}

      {phase === 'checklist' && (
        <>
          <div className="stats-bar">
            <div className="stat"><div className="stat-label">Score</div><div className="stat-value">{stats.percent.toFixed(1)}%</div></div>
            <div className="stat"><div className="stat-label">Rating</div><div className="stat-value" style={{ fontSize: '1.1rem' }}>{stats.rating}</div></div>
            <div className="stat"><div className="stat-label">Answered</div><div className="stat-value">{answered}/{totalItems}</div></div>
            <div className="stat"><div className="stat-label">Issues</div><div className="stat-value">{stats.needsImprovementCount + stats.unsatisfactoryCount}</div></div>
          </div>

          <div className="card">
            <div className="card-title">
              {meta.roomNo ? `Apartment ${meta.roomNo}` : 'Apartment'}{meta.apartmentNumber ? ` · No. ${meta.apartmentNumber}` : ''}{meta.tenantName ? ` — ${meta.tenantName}` : ''}
            </div>
            <div style={{ padding: '0.75rem 1rem' }}>
              <button className="btn-secondary" onClick={() => setPhase('setup')}>Edit apartment details</button>
            </div>
          </div>

          {sections.map((section) => (
            <div className="card" key={section.key}>
              <div className="card-title">{section.name}</div>
              {section.items.map((label, i) => (
                <ChecklistItem
                  key={itemKey(section.key, i)}
                  label={label}
                  response={responses[itemKey(section.key, i)]}
                  onChange={(r) => setResponses((prev) => ({ ...prev, [itemKey(section.key, i)]: r }))}
                  onLightbox={setLightbox}
                  showErrors={showEvidenceErrors}
                />
              ))}
            </div>
          ))}

          <div className="flex-between-wrap" style={{ marginBottom: '1.25rem' }}>
            <AutosaveStatus autosave={autosave} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={saveDraftNow} disabled={loading}>{loading ? 'Saving…' : 'Save now'}</button>
              <button className="btn-primary" onClick={completeAudit} disabled={loading}>{loading ? 'Completing…' : 'Complete & Save'}</button>
            </div>
          </div>
        </>
      )}

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </main>
  );
}

function ChecklistItem({ label, response = { answer: null, comment: '', images: [] }, onChange, onLightbox, showErrors = false }) {
  const images = response.images || [];
  const isNonCompliant = NON_COMPLIANT_ANSWERS.includes(response.answer);
  const missingComment = isNonCompliant && !String(response.comment || '').trim();
  const missingPhoto = isNonCompliant && images.length === 0;

  const pick = (choice) => {
    // Clearing to a compliant/N-A answer drops the evidence fields with it.
    if (NON_COMPLIANT_ANSWERS.includes(choice)) onChange({ ...response, answer: choice });
    else onChange({ ...response, answer: choice, comment: '', images: [] });
  };

  return (
    <div className="issue-card">
      <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {RESPONSE_OPTIONS.map((choice) => {
          const selected = response.answer === choice;
          const danger = choice === 'Unsatisfactory';
          const warn = choice === 'Needs Improvement';
          return (
            <button
              key={choice}
              onClick={() => pick(choice)}
              className={selected ? 'btn-primary' : 'btn-secondary'}
              style={selected && (danger || warn) ? {
                background: danger ? 'var(--danger)' : 'var(--warn-solid)',
                borderColor: 'transparent',
                color: '#fff',
              } : undefined}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {isNonCompliant && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--warn-fg)', margin: '0 0 6px 0', fontWeight: 600 }}>
            Non-compliant — a remark and at least one photo are required.
          </p>
          <textarea
            placeholder="Add a remark describing the issue (required)…"
            value={response.comment || ''}
            onChange={(e) => onChange({ ...response, comment: e.target.value })}
            style={{
              width: '100%', minHeight: 60, padding: '0.35rem 0.625rem', borderRadius: 4,
              border: `1px solid ${showErrors && missingComment ? 'var(--danger)' : 'var(--zinc-300)'}`,
              fontFamily: 'inherit', fontSize: '0.875rem', background: 'var(--white)', color: 'var(--zinc-900)',
            }}
          />
          {showErrors && missingComment && (
            <p style={{ fontSize: '0.72rem', color: 'var(--danger)', margin: '4px 0 0 0' }}>A remark is required.</p>
          )}
          <div style={{ marginTop: '0.5rem' }}>
            <PhotoCapture
              value={images}
              onChange={(next) => onChange({ ...response, images: next })}
              uploadFn={apt.uploadPhoto}
              fetchUrl={apt.fetchPhotoUrl}
              max={3}
              onLightbox={onLightbox}
              hint="Attach at least one photo as evidence (up to 3)."
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
// Lists
// -----------------------------------------------------------------------------
function DraftsList({ refreshKey, onResume, onResumeOffline, onStartNew }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState([]);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOffline = () => {
    listOfflineDrafts('apartment').then(setOfflineDrafts).catch(() => setOfflineDrafts([]));
  };

  useEffect(() => {
    setLoading(true);
    fetchOffline();
    apt.listDrafts()
      .then(setDrafts)
      .catch((e) => { if (navigator.onLine) show(errorMessage(e, 'Could not load drafts.'), 'error'); })
      .finally(() => setLoading(false));
    const onOnline = () => fetchOffline();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refreshKey, show]);

  async function resume(id) {
    try { onResume(await apt.getDraft(id)); }
    catch (e) { show(errorMessage(e, 'Could not open draft.'), 'error'); }
  }

  async function remove(id) {
    if (!(await confirm('Delete this draft?'))) return;
    try {
      await apt.deleteDraft(id);
      show('Draft deleted.', 'success');
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (e) { show(errorMessage(e, 'Could not delete draft.'), 'error'); }
  }

  async function removeOffline(record) {
    if (!(await confirm('Delete this draft from this device? It has not been synced to the server.'))) return;
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
                <span className="badge" style={{ marginLeft: 8, color: 'var(--warn-fg)', background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}>
                  On this device · not synced
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>
                Saved {new Date(d.updatedAt).toLocaleString()} · syncs automatically when back online
              </div>
            </div>
            <div className="report-actions">
              <button className="btn-primary" onClick={() => onResumeOffline(d)}>Resume</button>
              <button className="btn-danger-outline" onClick={() => removeOffline(d)}>Delete</button>
            </div>
          </div>
        ))}
        {loading ? (
          <ListSkeleton rows={3} />
        ) : drafts.length === 0 && offlineDrafts.length === 0 ? (
          <EmptyState
            title="No drafts yet"
            message="Drafts you save while working through an inspection will show up here."
            ctaLabel="Start a new inspection"
            onCta={onStartNew}
          />
        ) : drafts.map((d) => (
          <div key={d.id} className="draft-item">
            <div>
              <div className="report-title">Apartment {d.roomNo || '—'}{d.apartmentNumber ? ` · No. ${d.apartmentNumber}` : ''}{d.tenantName ? ` · ${d.tenantName}` : ''}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>
                {d.draftCode} · updated {new Date(d.updatedAt).toLocaleString()}
              </div>
            </div>
            <div className="report-actions">
              <button className="btn-primary" onClick={() => resume(d.id)}>Resume</button>
              <button className="btn-danger-outline" onClick={() => remove(d.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

/** Build a completed apartment audit into the unified report structure. */
function buildApartmentReport(audit) {
  const sections = buildSections(audit.bedroomCount ?? 1, audit.bathroomCount ?? 1);
  const responses = audit.responses || {};

  const reportSections = sections
    .map((section) => ({
      title: section.name,
      items: section.items
        .map((label, i) => ({ label, r: responses[itemKey(section.key, i)] }))
        .filter(({ r }) => r && r.answer)
        .map(({ label, r }) => ({
          heading: label,
          status: r.answer === 'Satisfactory' ? 'ok'
            : r.answer === 'Needs Improvement' ? 'warn'
            : r.answer === 'Unsatisfactory' ? 'bad'
            : undefined,
          statusLabel: r.answer,
          lines: r.comment ? [`Remark: ${r.comment}`] : [],
          photos: (r.photoIds || []).map((id) => ({ id })),
        })),
    }))
    .filter((s) => s.items.length);

  const fmt = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');
  const info = [
    { label: 'Report No', value: audit.auditCode || 'N/A' },
    { label: 'Apartment', value: `${audit.roomNo || 'N/A'}${audit.apartmentType ? ` · ${audit.apartmentType}` : ''}` },
    { label: 'Tenant', value: audit.tenantName || 'N/A' },
    { label: 'Location', value: audit.location || 'N/A' },
    { label: 'Inspection Date', value: `${fmt(audit.auditDate)}  |  Inspector: ${audit.inspectorName || ''}` },
  ];
  if (audit.apartmentNumber) info.push({ label: 'Apartment Number', value: audit.apartmentNumber });
  if (audit.landlordName) info.push({ label: 'Landlord / Manager', value: audit.landlordName });
  if (audit.moveInDate) info.push({ label: 'Move In Date', value: fmt(audit.moveInDate) });

  const percent = audit.score ?? 0;
  const rating = audit.rating ? audit.rating.charAt(0).toUpperCase() + audit.rating.slice(1) : '';

  return {
    fileName: `${audit.auditCode || 'Apartment'}.pdf`,
    info,
    score: { percent, rating },
    sections: reportSections,
  };
}

function ReportsList({ onStartNew }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  const load = () => {
    setLoading(true);
    apt.listAudits()
      .then(setReports)
      .catch((e) => show(errorMessage(e, 'Could not load reports.'), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const download = async (code) => {
    try {
      setDownloading(code);
      const audit = await apt.getAudit(code);
      await generateUnifiedPdf(buildApartmentReport(audit), { photoEndpoint: '/api/apartment/photos' });
    } catch (e) {
      show(errorMessage(e, 'Could not generate PDF.'), 'error');
    } finally {
      setDownloading(null);
    }
  };

  const remove = async (code) => {
    if (!(await confirm(`Delete report ${code}? This cannot be undone.`))) return;
    try {
      await apt.deleteAudit(code);
      show('Report deleted.', 'success');
      load();
    } catch (e) { show(errorMessage(e, 'Could not delete report.'), 'error'); }
  };

  return (
    <main className="main-content">
      <div className="card">
        <div className="card-title">Completed Inspection Reports</div>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : reports.length === 0 ? (
          <EmptyState
            title="No completed reports yet"
            message="Finish an apartment inspection and it will appear here as a downloadable report."
            ctaLabel="Start a new inspection"
            onCta={onStartNew}
          />
        ) : reports.map((r) => (
          <div key={r.auditCode} className="report-item">
            <div>
              <div className="report-title">Apartment {r.roomNo || '—'}{r.apartmentNumber ? ` · No. ${r.apartmentNumber}` : ''}{r.tenantName ? ` · ${r.tenantName}` : ''}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>
                {r.auditCode} · {new Date(r.auditDate).toLocaleDateString()} · {r.score != null ? `${r.score}%` : '—'}
                {(r.needsImprovementCount + r.unsatisfactoryCount) > 0 ? ` · ${r.needsImprovementCount + r.unsatisfactoryCount} issue(s)` : ''}
              </div>
            </div>
            <div className="report-actions">
              <button className="btn-primary" disabled={downloading === r.auditCode} onClick={() => download(r.auditCode)}>
                {downloading === r.auditCode ? 'Generating…' : 'PDF'}
              </button>
              <button className="btn-danger-outline" onClick={() => remove(r.auditCode)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
