import { jsPDF } from 'jspdf';
import { api } from '../api/client.js';

const isIOSDevice = () => {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

const deliverPdfBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  if (isIOSDevice()) {
    window.location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const fetchImageBase64 = async (id, photoEndpoint) => {
  try {
    const res = await api.get(`${photoEndpoint}/${id}`, { responseType: 'blob' });
    const blob = res.data;

    // Convert any image format (including WebP which jsPDF can't handle) to JPEG
    // by drawing it on an offscreen canvas and re-exporting.
    // Downscale to max 800px to avoid browser memory out-of-memory crashes (e.g. on iOS).
    const bitmap = await createImageBitmap(blob);
    const MAX_DIM = 800;
    let width = bitmap.width;
    let height = bitmap.height;
    if (width > MAX_DIM || height > MAX_DIM) {
      if (width > height) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      } else {
        width = Math.round((width * MAX_DIM) / height);
        height = MAX_DIM;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return canvas.toDataURL('image/jpeg', 0.75);
  } catch (e) {
    console.error('Failed to fetch photo for PDF', e);
    return null;
  }
};

const fetchLocalImageBase64 = async (url) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Failed to fetch local image', e);
    return null;
  }
};

// Maps a finding status to Velora's colour convention for the bullet heading.
const STATUS_RGB = {
  ok: [22, 101, 52],    // green-800
  warn: [133, 77, 14],  // amber-800
  bad: [153, 27, 27],   // red-800
  null: [24, 24, 27],   // zinc-900 (no status)
};

/**
 * The unified "Facilities Audit Report" layout (the format Velora's
 * audit report uses). Renders header/footer branding, an information box, an
 * optional score/compliance panel, and grouped findings with photos — from a
 * neutral data structure so any module can produce an identical-looking report.
 *
 * @param {object} report
 * @param {string} [report.reportTitle] header title (defaults to the unified one)
 * @param {string} report.fileName download filename
 * @param {Array<{label:string,value:string}>} report.info rows in the info box
 * @param {{percent:number,rating:string,label?:string}|null} [report.score] panel
 * @param {Array<{title:string, items:Array<{heading:string,status?:'ok'|'warn'|'bad',statusLabel?:string,lines?:string[],photos?:Array<{id:any}>,images?:string[]}>}>} report.sections
 * @param {object} [opts]
 * @param {string} [opts.photoEndpoint] where photo ids are fetched from
 * @param {boolean} [opts.returnBlob] resolve with the blob instead of downloading
 */
export const generateUnifiedPdf = async (report, { photoEndpoint = '/api/villa/photos', returnBlob = false } = {}) => {
  const {
    reportTitle = 'Facilities Audit Report',
    fileName = 'Audit_Report.pdf',
    info = [],
    score = null,
    sections = [],
  } = report;

  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = 58;

  const addHeader = (pageNum) => {
    doc.setPage(pageNum);
    doc.setDrawColor(228, 228, 231); // zinc-200
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.line(margin, 45, pageWidth - margin, 45);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(24, 24, 27); // zinc-900
    doc.text(reportTitle, pageWidth - margin, 25, { align: 'right' });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(228, 228, 231);
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122); // zinc-500

    doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  };

  const ensureSpace = (needed) => {
    if (y + needed > 275) {
      doc.addPage();
      addHeader(doc.internal.getNumberOfPages());
      y = 58;
    }
  };

  addHeader(1);

  // ── Information box ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(24, 24, 27);
  doc.text('AUDIT INFORMATION', margin, y);
  y += 8;

  const boxHeight = Math.max(38, info.length * 8 + 8);
  doc.setFillColor(250, 250, 250); // zinc-50
  doc.rect(margin, y - 2, contentWidth, boxHeight, 'F');
  doc.setDrawColor(228, 228, 231); // zinc-200
  doc.rect(margin, y - 2, contentWidth, boxHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(63, 63, 70); // zinc-700
  info.forEach((row, i) => {
    doc.text(`${row.label}: ${row.value ?? ''}`, margin + 6, y + 6 + i * 8);
  });
  y += boxHeight + 10;

  // ── Score / compliance panel ──
  if (score) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(24, 24, 27);
    doc.text('PERFORMANCE SCORE', margin, y);
    y += 8;

    doc.setFillColor(24, 24, 27); // zinc-900
    doc.roundedRect(margin, y - 2, contentWidth, 24, 4, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(250, 204, 21); // amber-400
    doc.text(`${Number(score.percent).toFixed(1)}%`, margin + 8, y + 14);

    const pct = Number(score.percent);
    const badge = pct >= 90 ? [22, 101, 52] : pct >= 75 ? [133, 77, 14] : [153, 27, 27];
    doc.setFillColor(badge[0], badge[1], badge[2]);
    doc.roundedRect(pageWidth - margin - 42, y + 4, 36, 12, 6, 6, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(String(score.rating || '').toUpperCase(), pageWidth - margin - 24, y + 12, { align: 'center' });
    y += 38;
  }

  // ── Findings ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(24, 24, 27);
  doc.text('AUDIT FINDINGS & OBSERVATIONS', margin, y);
  y += 8;
  doc.setDrawColor(24, 24, 27);
  doc.setLineWidth(0.4);
  doc.line(margin, y - 2, pageWidth - margin, y - 2);
  y += 4;

  for (const section of sections) {
    if (!section.items || section.items.length === 0) continue;
    ensureSpace(20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(39, 39, 42); // zinc-800
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.text(String(section.title).toUpperCase(), margin + 4, y + 5.5);
    y += 14;

    for (const item of section.items) {
      ensureSpace(12);

      const rgb = STATUS_RGB[item.status] || STATUS_RGB.null;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      const headingText = item.statusLabel ? `• ${item.heading}: ${item.statusLabel}` : `• ${item.heading}`;
      const splitHeading = doc.splitTextToSize(headingText, contentWidth - 4);
      doc.text(splitHeading, margin + 4, y);
      y += 5 * splitHeading.length;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(82, 82, 91); // zinc-600
      for (const line of item.lines || []) {
        const split = doc.splitTextToSize(`  ${line}`, contentWidth - 8);
        ensureSpace(4.5 * split.length);
        doc.text(split, margin + 4, y);
        y += 4.5 * split.length;
      }

      // Photos (fetched by id) or inline images
      const inlineImages = item.images || [];
      const photoIds = (item.photos || []).map((p) => p.id).filter(Boolean);
      if (inlineImages.length || photoIds.length) {
        const imgW = 32;
        const imgH = 32;
        let currX = margin + 4;
        if (y + imgH > 265) { doc.addPage(); addHeader(doc.internal.getNumberOfPages()); y = 58; }

        const drawOne = (data) => {
          if (!data) return;
          if (currX + imgW > pageWidth - margin) {
            currX = margin + 4;
            y += imgH + 4;
            if (y + imgH > 265) { doc.addPage(); addHeader(doc.internal.getNumberOfPages()); y = 58; currX = margin + 4; }
          }
          try { doc.addImage(data, 'JPEG', currX, y, imgW, imgH); } catch (e) { console.error('jsPDF image error', e); }
          currX += imgW + 4;
        };

        for (const img of inlineImages) drawOne(img);
        for (const id of photoIds) drawOne(await fetchImageBase64(id, photoEndpoint));
        y += imgH + 6;
      }

      doc.setDrawColor(228, 228, 231);
      doc.setLineWidth(0.2);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 8;
    }
    y += 4;
  }

  // Re-stamp header/footer on every page now that the count is final.
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) addHeader(i);

  const blob = doc.output('blob');
  if (returnBlob) return blob;
  deliverPdfBlob(blob, fileName);
  return blob;
};
