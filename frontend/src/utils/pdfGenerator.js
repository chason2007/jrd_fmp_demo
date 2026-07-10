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

export const generatePdfReport = async (audit, { photoEndpoint = '/api/villa/photos' } = {}) => {
  const v = audit.villa;
  const issues = audit.issues || [];
  
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 18; 
  let y = 32; 
  const pageWidth = doc.internal.pageSize.getWidth(); 
  const contentWidth = pageWidth - margin * 2;
  
  let logoB64 = null;
  try {
    logoB64 = await fetchLocalImageBase64('/logo.png');
  } catch(e) {}

  function addHeader(pageNum) { 
      doc.setPage(pageNum); 
      doc.setDrawColor(200,212,220); 
      doc.setFillColor(255,255,255); 
      doc.rect(0,0,pageWidth,45,'F'); 
      doc.line(margin,45,pageWidth-margin,45); 
      
      if (logoB64) {
          // Adjust width/height preserving aspect ratio; assuming original logo is relatively square/rectangular.
          // Let's make it 30mm wide.
          doc.addImage(logoB64, 'PNG', margin, 5, 30, 30, undefined, 'FAST');
      }

      doc.setFont('helvetica','bold'); 
      doc.setFontSize(14); 
      doc.setTextColor(15,59,92); // zinc-900 equivalent for branding
      doc.text('JR Dream Inspection Report', pageWidth - margin, 25, { align: 'right' });
      
      doc.setFont('helvetica','normal'); 
      doc.setFontSize(9); 
      doc.setTextColor(100,100,100);
      
      // Footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(228,228,231); 
      doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
      
      doc.setFontSize(8);
      doc.text('J R D Real Estate Management L.L.C O.P.C', margin, pageHeight - 14);
      doc.text('Mazyad Mall, Tower 1, Floor 9, Office 30, Abu Dhabi', margin, pageHeight - 10);
      doc.text('www.jrdream.com', margin, pageHeight - 6);
      
      doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }
  
  addHeader(1); 
  y = 58;
  doc.setFont('helvetica','bold'); 
  doc.setFontSize(14); 
  doc.setTextColor(24,24,27); // zinc-900
  doc.text('PROPERTY INFORMATION', margin, y); 
  y += 8;
  
  doc.setFillColor(250,250,250); // zinc-50
  doc.rect(margin, y-2, contentWidth, 52, 'F'); 
  doc.setDrawColor(228,228,231); // zinc-200
  doc.rect(margin, y-2, contentWidth, 52);
  
  doc.setFont('helvetica','normal'); 
  doc.setFontSize(10); 
  doc.setTextColor(63,63,70); // zinc-700
  
  const isGymRec = issues.some(i => i.area === 'gym' || i.area === 'recreation');
  
  if (isGymRec) {
    doc.text(`Audit Ref: ${audit.auditCode}`, margin+6, y+8);
    doc.text(`Location: ${v.propertyNumber || 'N/A'}`, margin+6, y+18);
    // For WV, v.address holds "Audit Date: YYYY-MM-DD | Inspector: Name"
    doc.text(v.address || 'N/A', margin+6, y+28);
  } else {
    doc.text(`Villa Number: ${v.propertyNumber || 'N/A'}`, margin+6, y+8);
    doc.text(`Owner: ${v.ownerName || 'N/A'}`, margin+6, y+18);
    doc.text(`Address: ${v.address || 'N/A'}`, margin+6, y+28);
    doc.text(`Location: ${v.emirate || ''} ${v.area ? '- ' + v.area : ''}`, margin+6, y+38);
  }
  
  doc.setFontSize(8); 
  doc.setTextColor(113,113,122); // zinc-500
  if (!isGymRec) {
    doc.text(`Audit Ref: ${audit.auditCode}`, pageWidth-margin-6, y+38, {align:'right'}); 
  }
  y += 68;
  
  doc.setDrawColor(24,24,27); 
  doc.setLineWidth(0.6); 
  doc.line(margin, y, pageWidth-margin, y); 
  doc.setFont('helvetica','bold'); 
  doc.setFontSize(15); 
  doc.setTextColor(24,24,27); 
  doc.text('DEFECT LOG & INSPECTION FINDINGS', margin, y+8); 
  
  doc.setFontSize(9.5); 
  doc.setTextColor(113,113,122); 
  doc.text(`Total Defects Recorded: ${issues.length}`, pageWidth-margin, y+8, {align:'right'}); 
  y += 26;
  
  // Create dynamic groups based on available areas
  const uniqueAreas = [...new Set(issues.map(i => i.area || 'General'))];
  const groups = uniqueAreas.map(areaName => ({
    name: `${String(areaName).toUpperCase()} DEFECTS`,
    items: issues.filter(i => (i.area || 'General') === areaName)
  })); 
  
  let counter = 1;
  for (const group of groups) {
      if (!group.items.length) continue;
      
      if (y > 260) { 
        doc.addPage(); 
        addHeader(doc.internal.getNumberOfPages()); 
        y = 60; 
      }
      
      doc.setFont('helvetica','bold'); 
      doc.setFontSize(12); 
      doc.setTextColor(255,255,255); 
      doc.setFillColor(24,24,27); 
      doc.rect(margin, y, contentWidth, 9, 'F');
      doc.text(group.name, margin+4, y+6); 
      y += 16;
      
      for (const issue of group.items) {
          if (y > 250) { 
            doc.addPage(); 
            addHeader(doc.internal.getNumberOfPages()); 
            y = 60; 
          }
          
          doc.setFont('helvetica','bold'); 
          doc.setFontSize(10); 
          doc.setTextColor(39,39,42); // zinc-800
          
          let heading = `${counter}. ${issue.category || 'Observation'}`;
          if (issue.subCategory) heading += ` - ${issue.subCategory}`;
          doc.text(heading, margin, y); 
          y += 6;
          
          doc.setFont('helvetica','normal'); 
          doc.setFontSize(9); 
          doc.setTextColor(82,82,91); // zinc-600
          
          if (issue.floor || issue.room) {
            let locParts = [];
            if (issue.floor) locParts.push(issue.floor);
            if (issue.room) locParts.push(issue.room);
            doc.text(`Location: ${locParts.join(' > ')}`, margin, y); 
            y += 5;
          }
          
          if (issue.issueType) {
            doc.text(`Issue: ${issue.issueType}`, margin, y); 
            y += 5;
          }
          
          // handle long text for details and remarks
          if (issue.spotDesc) {
            const splitDesc = doc.splitTextToSize(`Details: ${issue.spotDesc}`, contentWidth);
            doc.text(splitDesc, margin, y); 
            y += (5 * splitDesc.length);
          }
          
          if (issue.comment) { 
            const splitComment = doc.splitTextToSize(`Remarks: ${issue.comment}`, contentWidth);
            doc.text(splitComment, margin, y); 
            y += (5 * splitComment.length); 
          }
          
          y += 2;
          
          if (issue.photos && issue.photos.length > 0) {
              const imgW = 40; 
              const imgH = 40; 
              let currX = margin;
              for (let i = 0; i < issue.photos.length; i++) {
                  if (currX + imgW > pageWidth - margin) { 
                    currX = margin; 
                    y += imgH + 5; 
                    if (y > 240) { 
                      doc.addPage(); 
                      addHeader(doc.internal.getNumberOfPages()); 
                      y = 60; 
                    } 
                  }
                  
                  const b64 = await fetchImageBase64(issue.photos[i].id, photoEndpoint);
                  if (b64) {
                    try {
                        doc.addImage(b64, 'JPEG', currX, y, imgW, imgH);
                    } catch(e) {
                        console.error('jsPDF error adding image', e);
                    }
                  }
                  currX += imgW + 5;
              }
              y += imgH + 8;
          } else {
              y += 4;
          }
          
          doc.setDrawColor(228,228,231); 
          doc.setLineWidth(0.2); 
          doc.line(margin, y, pageWidth-margin, y); 
          y += 8;
          counter++;
      }
      y += 10;
  }
  
  const blob = doc.output('blob');
  deliverPdfBlob(blob, `Audit_${v.propertyNumber || audit.auditCode}.pdf`);
};
