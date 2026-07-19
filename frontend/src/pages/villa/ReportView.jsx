import PhotoThumb from '../../components/PhotoThumb.jsx';

/** Read-only modal showing a full completed report (property + issues + photos). */
export default function ReportView({ audit, onClose, onLightbox }) {
  const v = audit.villa;
  const meta = [v.address, v.area, v.emirate].filter(Boolean).join(', ');

  return (
    <div 
      className="modal" 
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClose();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div
        className="card"
        style={{ maxWidth: 700, width: '95%', maxHeight: '90vh', overflowY: 'auto', cursor: 'default', margin: '0 auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-between-wrap">
          <div className="card-title" style={{ marginBottom: 0 }}>
            Flat {v.flatNumber}
            {v.unitNumber ? ` · Unit ${v.unitNumber}` : ''}
            {v.buildingName ? ` · ${v.buildingName}` : ''} — {v.ownerName}
          </div>
          <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem' }} onClick={onClose}>Close</button>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--gray)', margin: '0.75rem 0' }}>
          {audit.auditCode} · {new Date(audit.auditDate).toLocaleString()} · {audit.issueCount} issue(s)
          {meta && <><br />{meta}</>}
        </div>

        {audit.issues.map((iss) => (
          <div key={iss.id} className="issue-card">
            <strong>{iss.room} · {iss.category} / {iss.subCategory}</strong>
            <div style={{ fontSize: '0.85rem', color: 'var(--gray)', marginTop: '0.3rem' }}>
              {iss.area} · {iss.floor} · {iss.issueType}
            </div>
            <div style={{ marginTop: '0.4rem' }}>{iss.spotDesc}</div>
            {iss.comment && <div style={{ marginTop: '0.3rem', color: 'var(--gray)' }}>{iss.comment}</div>}
            {iss.photos?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem' }}>
                {iss.photos.map((p) => <PhotoThumb key={p.id} id={p.id} onClick={onLightbox} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
