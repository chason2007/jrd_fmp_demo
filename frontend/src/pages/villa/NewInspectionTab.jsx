import { useEffect, useState } from 'react';
import { saveInspection, saveDraft, uploadPhoto, fetchPhotoUrl } from '../../api/villa.js';
import { errorMessage } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAutosave } from '../../hooks/useAutosave.js';
import PhotoCapture from '../../components/PhotoCapture.jsx';
import PhotoThumb from '../../components/PhotoThumb.jsx';
import AutosaveStatus from '../../components/AutosaveStatus.jsx';
import { EMIRATES, AREA_TYPES, FLOORS, ROOMS, CATEGORIES, SUB_CATEGORIES, ISSUE_TYPES } from '../../lib/options.js';
import { cleanLocalPhotosForDraft, uploadLocalPhoto } from '../../utils/localPhotoStore.js';

const emptyProperty = { propertyNumber: '', ownerName: '', propertyAddress: '', emirate: 'Dubai', area: '' };
const emptyDefect = { area: '', floor: '', room: '', category: '', subCategory: '', issueType: '', spotDesc: '', comment: '' };

function Select({ value, onChange, placeholder, options, error }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={error ? { borderColor: 'var(--danger)' } : undefined}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

const FIELD_LABELS = {
  propertyNumber: 'Villa number',
  ownerName: 'Owner name',
  area: 'Area type',
  floor: 'Floor',
  room: 'Room / space',
  category: 'Category',
  subCategory: 'Sub category',
  issueType: 'Issue type',
  spotDesc: 'Exact spot / location description',
};

function FieldError({ message }) {
  if (!message) return null;
  return <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{message}</span>;
}

export default function NewInspectionTab({ resumeDraft, onResumed, onCompleted, onDraftSaved, onLightbox }) {
  const { show } = useToast();
  const [property, setProperty] = useState(emptyProperty);
  const [started, setStarted] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [issues, setIssues] = useState([]);
  const [defect, setDefect] = useState(emptyDefect);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [offlineDraft, setOfflineDraft] = useState(null);
  const [propertyErrors, setPropertyErrors] = useState({});
  const [defectErrors, setDefectErrors] = useState({});
  const [syncingPhotos, setSyncingPhotos] = useState(false);

  // Check for local offline backup draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('villa_inspection_offline_draft');
      if (saved) {
        setOfflineDraft(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load offline draft from localStorage:', e);
    }
  }, []);

  // Load a draft when one is handed in from the Drafts tab.
  useEffect(() => {
    if (!resumeDraft) return;
    setProperty({
      propertyNumber: resumeDraft.propertyNumber || '',
      ownerName: resumeDraft.ownerName || '',
      propertyAddress: resumeDraft.propertyAddress || '',
      emirate: resumeDraft.emirate || 'Dubai',
      area: resumeDraft.area || '',
    });
    setIssues(Array.isArray(resumeDraft.issuesData) ? resumeDraft.issuesData : []);
    setDraftId(resumeDraft.id);
    setStarted(true);
    show('Draft loaded — continue where you left off.', 'info');
    onResumed?.();
  }, [resumeDraft, onResumed, show]);

  // Silently keep the draft in sync while the user works — separate from the
  // manual Save Draft button, which still gives its own explicit toast.
  const autosave = useAutosave(
    { property, issues },
    async ({ property: p, issues: i }) => {
      const draft = await saveDraft({ draftId: draftId || undefined, ...p, issues: i });
      setDraftId(draft.id);
      onDraftSaved?.();
    },
    { enabled: started && !busy && !!property.propertyNumber.trim() && !!property.ownerName.trim(), localStorageKey: 'villa_inspection_offline_draft' },
  );

  useEffect(() => {
    if (!started) return;

    let active = true;
    async function performSync() {
      if (typeof navigator === 'undefined' || !navigator.onLine || syncingPhotos) return;

      const hasLocalIssues = issues.some(iss => iss.photoIds?.some(id => typeof id === 'string' && id.startsWith('local-')));
      const hasLocalPhotos = photos.some(p => typeof p.id === 'string' && p.id.startsWith('local-'));

      if (!hasLocalIssues && !hasLocalPhotos) return;

      setSyncingPhotos(true);
      try {
        // 1. Sync photos in active defect form
        let photosChanged = false;
        const nextPhotos = await Promise.all(photos.map(async (p) => {
          if (typeof p.id === 'string' && p.id.startsWith('local-')) {
            try {
              const serverId = await uploadLocalPhoto(p.id, uploadPhoto);
              photosChanged = true;
              return { id: serverId };
            } catch (err) {
              console.error('Failed to sync active form photo:', err);
              return p;
            }
          }
          return p;
        }));

        if (photosChanged && active) {
          setPhotos(nextPhotos);
        }

        // 2. Sync photos in already added issues
        let issuesChanged = false;
        const nextIssues = await Promise.all(issues.map(async (iss) => {
          if (!iss.photoIds) return iss;

          let issueChanged = false;
          const nextPhotoIds = await Promise.all(iss.photoIds.map(async (id) => {
            if (typeof id === 'string' && id.startsWith('local-')) {
              try {
                const serverId = await uploadLocalPhoto(id, uploadPhoto);
                issueChanged = true;
                return serverId;
              } catch (err) {
                console.error('Failed to sync issue photo:', err);
                return id;
              }
            }
            return id;
          }));

          if (issueChanged) {
            issuesChanged = true;
            return { ...iss, photoIds: nextPhotoIds };
          }
          return iss;
        }));

        if (issuesChanged && active) {
          setIssues(nextIssues);
          show('Offline photos synchronized successfully.', 'success');
        }
      } catch (err) {
        console.error('Error during photo synchronization:', err);
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
  }, [started, issues, photos, syncingPhotos, show]);

  const setProp = (k) => (e) => {
    setProperty((p) => ({ ...p, [k]: e.target.value }));
    setPropertyErrors((err) => (err[k] ? { ...err, [k]: undefined } : err));
  };
  const setDef = (k) => (v) => {
    setDefect((d) => ({ ...d, [k]: typeof v === 'string' ? v : v.target.value }));
    setDefectErrors((err) => (err[k] ? { ...err, [k]: undefined } : err));
  };

  const totalPhotos = issues.reduce((s, i) => s + (i.photoIds?.length || 0), 0);

  function startInspection() {
    const errors = {};
    if (!property.propertyNumber.trim()) errors.propertyNumber = `${FIELD_LABELS.propertyNumber} is required.`;
    if (!property.ownerName.trim()) errors.ownerName = `${FIELD_LABELS.ownerName} is required.`;
    if (Object.keys(errors).length) {
      setPropertyErrors(errors);
      show('Please fill in the required fields.', 'error');
      return;
    }
    setPropertyErrors({});
    setStarted(true);
  }

  function addDefect() {
    const required = ['area', 'floor', 'room', 'category', 'subCategory', 'issueType', 'spotDesc'];
    const errors = {};
    for (const k of required) {
      if (!defect[k].trim()) errors[k] = `${FIELD_LABELS[k]} is required.`;
    }
    if (Object.keys(errors).length) {
      setDefectErrors(errors);
      show('Please fill all required defect fields.', 'error');
      return;
    }
    setDefectErrors({});
    setIssues((arr) => [...arr, { ...defect, photoIds: photos.map((p) => p.id) }]);
    photos.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    setDefect(emptyDefect);
    setPhotos([]);
    show('Defect added.', 'success');
  }

  const removeIssue = (idx) => setIssues((arr) => arr.filter((_, i) => i !== idx));

  function resetAll() {
    setProperty(emptyProperty);
    setIssues([]);
    setDefect(emptyDefect);
    setPhotos([]);
    setStarted(false);
    setDraftId(null);
    setPropertyErrors({});
    setDefectErrors({});
    try {
      localStorage.removeItem('villa_inspection_offline_draft');
    } catch (e) {}
  }

  async function handleSaveDraft() {
    if (!property.propertyNumber.trim() || !property.ownerName.trim()) {
      show('Villa number and owner name are required.', 'error');
      return;
    }
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!property.propertyNumber.trim() || !property.ownerName.trim()) {
      show('Villa number and owner name are required.', 'error');
      return;
    }
    if (issues.length === 0) {
      show('Add at least one defect before completing.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await saveInspection({ draftId: draftId || undefined, ...property, issues });
      show(`Inspection saved (${res.auditCode}).`, 'success');
      resetAll();
      onCompleted?.();
    } catch (err) {
      show(errorMessage(err, 'Could not save inspection.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {offlineDraft && (
        <div style={{
          backgroundColor: 'var(--warn-bg)',
          border: '1px solid var(--warn-solid)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          margin: '1rem 1rem 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, color: 'var(--warn-fg)', fontSize: '0.9rem' }}>
            <strong>Unsaved Offline Draft Found:</strong> We detected an unsaved draft for villa <strong>{offlineDraft.property?.propertyNumber || 'Unknown'}</strong> from your previous session (possibly due to network disconnect).
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-primary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              onClick={() => {
                setProperty(offlineDraft.property || emptyProperty);
                setIssues(offlineDraft.issues || []);
                setStarted(true);
                setOfflineDraft(null);
                show('Offline draft restored.', 'success');
              }}
            >
              Restore Draft
            </button>
            <button
              className="btn-danger-outline"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'transparent' }}
              onClick={() => {
                try {
                  cleanLocalPhotosForDraft(offlineDraft, 'villa');
                  localStorage.removeItem('villa_inspection_offline_draft');
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

      <div className="stats-bar">
        <div className="stat"><div className="stat-value">{issues.length}</div><div className="stat-label">Total Issues</div></div>
        <div className="stat"><div className="stat-value">{totalPhotos}</div><div className="stat-label">Total Photos</div></div>
      </div>

      <main className="main-content">
        {!started ? (
          <div className="card">
            <div className="card-title">Property Information</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="required">Villa Number</label>
                <input
                  type="text"
                  value={property.propertyNumber}
                  onChange={setProp('propertyNumber')}
                  placeholder="e.g., V001, VILLA-01"
                  maxLength={100}
                  style={propertyErrors.propertyNumber ? { borderColor: 'var(--danger)' } : undefined}
                />
                <FieldError message={propertyErrors.propertyNumber} />
              </div>
              <div className="form-group">
                <label className="required">Owner Name</label>
                <input
                  type="text"
                  value={property.ownerName}
                  onChange={setProp('ownerName')}
                  placeholder="Full name as per title deed"
                  maxLength={255}
                  style={propertyErrors.ownerName ? { borderColor: 'var(--danger)' } : undefined}
                />
                <FieldError message={propertyErrors.ownerName} />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input type="text" value={property.propertyAddress} onChange={setProp('propertyAddress')} placeholder="Street name, community" maxLength={1000} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Emirate</label>
                  <select value={property.emirate} onChange={setProp('emirate')}>
                    {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Community / Area</label>
                  <input type="text" value={property.area} onChange={setProp('area')} placeholder="e.g., Palm Jumeirah" maxLength={100} />
                </div>
              </div>
            </div>
            <div style={{ padding: '0 0.75rem 0.75rem' }}>
              <button className="btn-primary" onClick={startInspection} style={{ width: '100%', justifyContent: 'center' }}>Start Inspection</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-between-wrap mb-2">
              <h3>Defect Logger — max 5 photos per defect</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {draftId && <span className="draft-badge">Draft Mode</span>}
                <AutosaveStatus autosave={autosave} />
                <button className="btn-warning" disabled={busy} onClick={handleSaveDraft}>Save now</button>
                <button className="btn-success" disabled={busy} onClick={handleComplete}>Complete &amp; Save</button>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Add New Defect</div>
              <div className="form-grid">
                <div className="form-row">
                  <div className="form-group"><label className="required">Area Type</label><Select value={defect.area} onChange={setDef('area')} placeholder="Select Area" options={AREA_TYPES} error={defectErrors.area} /><FieldError message={defectErrors.area} /></div>
                  <div className="form-group"><label className="required">Floor</label><Select value={defect.floor} onChange={setDef('floor')} placeholder="Select Floor" options={FLOORS} error={defectErrors.floor} /><FieldError message={defectErrors.floor} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="required">Room / Space</label><Select value={defect.room} onChange={setDef('room')} placeholder="Select Room" options={ROOMS} error={defectErrors.room} /><FieldError message={defectErrors.room} /></div>
                  <div className="form-group"><label className="required">Category</label><Select value={defect.category} onChange={setDef('category')} placeholder="Select Category" options={CATEGORIES} error={defectErrors.category} /><FieldError message={defectErrors.category} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="required">Sub Category</label><Select value={defect.subCategory} onChange={setDef('subCategory')} placeholder="Select Sub Category" options={SUB_CATEGORIES} error={defectErrors.subCategory} /><FieldError message={defectErrors.subCategory} /></div>
                  <div className="form-group"><label className="required">Issue Type</label><Select value={defect.issueType} onChange={setDef('issueType')} placeholder="Select Issue Type" options={ISSUE_TYPES} error={defectErrors.issueType} /><FieldError message={defectErrors.issueType} /></div>
                </div>
                <div className="form-group">
                  <label className="required">Exact Spot / Location Description</label>
                  <textarea
                    rows={2}
                    value={defect.spotDesc}
                    onChange={setDef('spotDesc')}
                    placeholder="e.g., North wall near window, 1.5m from floor..."
                    maxLength={2000}
                    style={defectErrors.spotDesc ? { borderColor: 'var(--danger)' } : undefined}
                  />
                  <FieldError message={defectErrors.spotDesc} />
                </div>
                <div className="form-group">
                  <label>Inspector Remarks / Notes</label>
                  <textarea rows={2} value={defect.comment} onChange={setDef('comment')} placeholder="Additional details, recommendations..." maxLength={2000} />
                </div>
                <PhotoCapture
                  value={photos}
                  onChange={setPhotos}
                  uploadFn={uploadPhoto}
                  fetchUrl={fetchPhotoUrl}
                  max={5}
                  onLightbox={onLightbox}
                  label="Photos (MAX 5 per defect)"
                  hint="MAX 5 photos per defect. Unlimited defects per inspection."
                />
              </div>
              <div style={{ padding: '0 0.75rem 0.75rem' }}>
                <button className="btn-primary" disabled={busy} onClick={addDefect} style={{ width: '100%', justifyContent: 'center' }}>Add Defect</button>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Recorded Issues ({issues.length})</div>
              {issues.length === 0 ? (
                <p style={{ color: 'var(--gray)' }}>No defects recorded yet.</p>
              ) : (
                issues.map((iss, idx) => (
                  <div key={idx} className="issue-card">
                    <div className="flex-between-wrap">
                      <strong>{iss.room} · {iss.category} / {iss.subCategory}</strong>
                      <button className="btn-danger-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => removeIssue(idx)}>Remove</button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--gray)', marginTop: '0.3rem' }}>
                      {iss.area} · {iss.floor} · {iss.issueType}
                    </div>
                    <div style={{ marginTop: '0.4rem' }}>{iss.spotDesc}</div>
                    {iss.comment && <div style={{ marginTop: '0.3rem', color: 'var(--gray)' }}>{iss.comment}</div>}
                    {iss.photoIds?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem' }}>
                        {iss.photoIds.map((pid) => <PhotoThumb key={pid} id={pid} onClick={onLightbox} />)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
