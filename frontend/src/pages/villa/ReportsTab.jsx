import { useEffect, useState, useCallback } from 'react';
import { listReports, getReport, deleteReport } from '../../api/villa.js';
import { errorMessage } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';
import ReportView from './ReportView.jsx';
import { generatePdfReport } from '../../utils/pdfGenerator.js';
import EmptyState from '../../components/EmptyState.jsx';
import ListSkeleton from '../../components/ListSkeleton.jsx';

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
      await generatePdfReport(audit);
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
                <div className="report-title">{r.villa.propertyNumber} — {r.villa.ownerName}</div>
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
