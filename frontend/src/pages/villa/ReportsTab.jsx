import { useEffect, useState, useCallback } from 'react';
import { listReports, getReport, deleteReport } from '../../api/villa.js';
import { errorMessage } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import ReportView from './ReportView.jsx';
import { generateUnifiedPdf } from '../../utils/pdfGenerator.js';
import EmptyState from '../../components/EmptyState.jsx';
import ListSkeleton from '../../components/ListSkeleton.jsx';

/** Build a Villa snag audit into the unified report structure (matches Velora/WV).
 *  Villa is a defect log rather than a scored checklist, so it carries no score
 *  panel; defects are grouped by area. */
function buildVillaReport(audit) {
  const v = audit.villa || {};
  const issues = audit.issues || [];

  const areas = [...new Set(issues.map((i) => i.area || 'General'))];
  const sections = areas.map((area) => ({
    title: `${area} Defects`,
    items: issues
      .filter((i) => (i.area || 'General') === area)
      .map((i) => {
        const lines = [];
        if (i.floor || i.room) lines.push(`Location: ${[i.floor, i.room].filter(Boolean).join(' > ')}`);
        if (i.issueType) lines.push(`Issue: ${i.issueType}`);
        if (i.spotDesc) lines.push(`Details: ${i.spotDesc}`);
        if (i.comment) lines.push(`Remarks: ${i.comment}`);
        return {
          heading: `${i.category || 'Observation'}${i.subCategory ? ` - ${i.subCategory}` : ''}`,
          lines,
          photos: (i.photos || []).map((p) => ({ id: p.id })).filter((p) => p.id),
        };
      }),
  }));

  const dateStr = audit.auditDate ? new Date(audit.auditDate).toISOString().split('T')[0] : '';
  const info = [
    { label: 'Flat Number', value: v.flatNumber || 'N/A' },
    { label: 'Unit Number', value: v.unitNumber || 'N/A' },
    { label: 'Owner', value: v.ownerName || 'N/A' },
    { label: 'Address', value: v.address || 'N/A' },
    { label: 'Location', value: `${v.emirate || ''}${v.area ? ` - ${v.area}` : ''}` || 'N/A' },
    { label: 'Audit Ref', value: `${audit.auditCode || 'N/A'}  |  Date: ${dateStr}  |  Total Defects: ${issues.length}` },
  ];

  return {
    reportTitle: 'Facilities Audit Report',
    fileName: `${v.flatNumber || audit.auditCode || 'Flat'}.pdf`,
    info,
    score: null,
    sections,
  };
}

export default function ReportsTab({ refreshKey, onLightbox, onStartNew }) {
  const { show } = useToast();
  const confirm = useConfirm();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await listReports());
    } catch (err) {
      show(errorMessage(err, 'Could not load reports.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function view(code) {
    try {
      setViewing(await getReport(code));
    } catch (err) {
      show(errorMessage(err, 'Could not open report.'), 'error');
    }
  }

  async function download(code) {
    try {
      show('Generating PDF...', 'success');
      const audit = await getReport(code);
      await generateUnifiedPdf(buildVillaReport(audit), { photoEndpoint: '/api/villa/photos' });
    } catch (err) {
      show(errorMessage(err, 'Could not generate PDF.'), 'error');
    }
  }

  async function remove(code) {
    if (!(await confirm(`Delete report ${code}? This cannot be undone.`))) return;
    try {
      await deleteReport(code);
      show('Report deleted.', 'success');
      load();
    } catch (err) {
      show(errorMessage(err, 'Could not delete report.'), 'error');
    }
  }

  return (
    <main className="main-content">
      <div className="card">
        <div className="card-title">Completed Audit Reports</div>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : reports.length === 0 ? (
          <EmptyState
            title="No completed reports yet"
            message="Finish an inspection and it will appear here as a downloadable report."
            ctaLabel="Start a new inspection"
            onCta={onStartNew}
          />
        ) : (
          reports.map((r) => (
            <div key={r.auditCode} className="report-item">
              <div>
                <div className="report-title">
                  Flat {r.villa.flatNumber}
                  {r.villa.unitNumber ? ` · Unit ${r.villa.unitNumber}` : ''} — {r.villa.ownerName}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>
                  {r.auditCode} · {new Date(r.auditDate).toLocaleDateString()} · {r.issueCount} issue(s)
                </div>
              </div>
              <div className="report-actions">
                <button className="btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => view(r.auditCode)}>View</button>
                <button className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => download(r.auditCode)}>PDF</button>
                <button className="btn-danger-outline" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => remove(r.auditCode)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
      {viewing && <ReportView audit={viewing} onClose={() => setViewing(null)} onLightbox={onLightbox} />}
    </main>
  );
}
