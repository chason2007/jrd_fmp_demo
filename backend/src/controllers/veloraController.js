import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

const isAdmin = (req) => req.user.role === 'ADMIN';
const ownAudit = (req) => (isAdmin(req) ? {} : { auditorId: req.user.id });

// Create PDF reports directory
const PDF_DIR = path.resolve(process.cwd(), 'storage/pdf_reports');
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

// Helpers for code generation
const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};
const rand = (bytes) => crypto.randomBytes(bytes).toString('hex').toUpperCase();

export const newAuditNumber = () => `AUD-${stamp()}-${rand(3)}`;
export const newDraftCode = () => `DRFT-${Date.now()}-${rand(2)}`;
export const newReportNumber = () => `RPT-${stamp()}-${rand(3)}`;
export const newPdfReportNumber = () => `PDF-${stamp()}-${rand(3)}`;

// Helper to calculate score for a single observation
function getObservationScore(observation) {
  let scoreSum = 0;
  let itemsCount = 0;
  const items = ['floors', 'furniture', 'walls'];
  for (const item of items) {
    const resp = observation?.[item]?.response;
    if (resp) {
      itemsCount++;
      if (resp === 'Acceptable') {
        scoreSum += 100;
      } else if (resp === 'Needs Improvement') {
        scoreSum += 50;
      }
    }
  }
  return { scoreSum, itemsCount };
}

// Integrity: a non-compliant item (Needs Improvement / Unacceptable) must carry
// evidence — a remark AND at least one photo. Throws HttpError(400) if not.
// Enforced here so the rule holds even if the client is bypassed.
function assertNonComplianceEvidence(responses) {
  const locations = Array.isArray(responses)
    ? responses
    : (responses && typeof responses === 'object' ? Object.values(responses) : []);
  let missing = 0;
  for (const loc of locations) {
    if (!loc || !Array.isArray(loc.observations)) continue;
    for (const obs of loc.observations) {
      for (const key of ['floors', 'furniture', 'walls']) {
        const it = obs?.[key];
        if (it && (it.response === 'Needs Improvement' || it.response === 'Unacceptable')) {
          if (!String(it.comment || '').trim() || !(Array.isArray(it.images) ? it.images : []).length) missing += 1;
        }
      }
    }
  }
  if (missing) {
    throw new HttpError(400, `Every non-compliant item (Needs Improvement / Unacceptable) requires a remark and at least one photo. ${missing} item(s) are missing evidence.`);
  }
}

// Calculate Velora audit score
function calculateScore(responses) {
  let total = 0;
  let count = 0;

  const locations = Array.isArray(responses)
    ? responses
    : (responses && typeof responses === 'object' ? Object.values(responses) : []);

  for (const loc of locations) {
    if (!loc || !Array.isArray(loc.observations)) {
      continue;
    }
    for (const obs of loc.observations) {
      const { scoreSum, itemsCount } = getObservationScore(obs);
      total += scoreSum;
      count += itemsCount;
    }
  }

  return count > 0 ? Math.round((total / count) * 100) / 100 : 0;
}

// 1. GET /api/velora/service-types
export async function getServiceTypes(req, res) {
  const categories = [
    { id: 'hard', name: 'hard', displayName: 'Hard Services' },
    { id: 'soft', name: 'soft', displayName: 'Soft Services' },
  ];
  
  const serviceTypes = [
    { id: 1, categoryId: 1, name: 'general_maintenance', displayName: 'General Maintenance', sortOrder: 1 },
    { id: 2, categoryId: 1, name: 'periodic_maintenance', displayName: 'Periodic Maintenance', sortOrder: 2 },
    { id: 3, categoryId: 1, name: 'specialized_maintenance', displayName: 'Specialized Maintenance', sortOrder: 3 },
    { id: 4, categoryId: 2, name: 'general_maintenance', displayName: 'General Maintenance', sortOrder: 1 },
    { id: 5, categoryId: 2, name: 'periodic_maintenance', displayName: 'Periodic Maintenance', sortOrder: 2 },
    { id: 6, categoryId: 2, name: 'specialized_maintenance', displayName: 'Specialized Maintenance', sortOrder: 3 },
  ];

  res.json({ success: true, data: { categories, serviceTypes } });
}

// 2. POST /api/velora/audits
export async function saveAudit(req, res) {
  const body = req.body;
  const userId = req.user.id;

  assertNonComplianceEvidence(body.responses);

  const auditNo = newAuditNumber();
  const score = calculateScore(body.responses);
  let rating = 'poor';
  if (score >= 90) rating = 'excellent';
  else if (score >= 75) rating = 'good';
  else if (score >= 60) rating = 'average';

  const result = await prisma.$transaction(async (tx) => {
    const audit = await tx.veloraAudit.create({
      data: {
        auditNumber: auditNo,
        serviceTypeId: body.serviceTypeId,
        serviceCategory: body.serviceCategory,
        auditDate: new Date(body.auditDate),
        // Attribution comes from the session, never the request body (anti-repudiation).
        auditorName: req.user.username,
        auditorId: userId,
        status: 'submitted',
        overallScore: score,
        overallRating: rating,
        locationData: body.locations || [],
        responses: body.responses || {},
        notes: body.notes || null,
      },
    });

    if (body.draftId) {
      // Clean up draft if finalized
      await tx.veloraAuditDraft.deleteMany({
        where: {
          id: body.draftId,
          ...ownAudit(req),
        },
      });
    }

    return audit;
  });

  res.status(201).json({ success: true, data: { audit: result } });
}

// 3. GET /api/velora/audits — visible to all users
export async function listAudits(req, res) {
  const audits = await prisma.veloraAudit.findMany({
    orderBy: { auditDate: 'desc' },
  });
  res.json({ success: true, data: audits });
}

// 4. GET /api/velora/audits/:id — visible to all users
export async function getAudit(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const audit = await prisma.veloraAudit.findUnique({ where: { id } });
  if (!audit) throw new HttpError(404, 'Audit not found.');
  res.json({ success: true, data: audit });
}

// 5. POST /api/velora/drafts
export async function saveDraft(req, res) {
  const body = req.body;
  const userId = req.user.id;
  const draftId = body.draftId;

  let draft;
  if (draftId) {
    draft = await prisma.veloraAuditDraft.update({
      where: { id: draftId, auditorId: userId },
      data: {
        serviceTypeId: body.serviceTypeId || null,
        serviceCategory: body.serviceCategory || null,
        auditDate: body.auditDate ? new Date(body.auditDate) : null,
        auditorName: body.auditorName || null,
        locationData: body.locations || [],
        responses: body.responses || {},
      },
    });
  } else {
    const draftCode = newDraftCode();
    const tempAuditNo = body.auditNumber || `DRF-${stamp()}-${rand(3)}`;
    draft = await prisma.veloraAuditDraft.create({
      data: {
        draftCode,
        auditNumber: tempAuditNo,
        serviceTypeId: body.serviceTypeId || null,
        serviceCategory: body.serviceCategory || null,
        auditDate: body.auditDate ? new Date(body.auditDate) : null,
        auditorName: body.auditorName || null,
        auditorId: userId,
        locationData: body.locations || [],
        responses: body.responses || {},
      },
    });
  }

  res.json({ success: true, data: { draft } });
}

// 6. GET /api/velora/drafts
export async function listDrafts(req, res) {
  const drafts = await prisma.veloraAuditDraft.findMany({
    where: ownAudit(req),
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ success: true, data: drafts });
}

// 7. GET /api/velora/drafts/:id
export async function getDraft(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const draft = await prisma.veloraAuditDraft.findFirst({
    where: {
      id,
      ...ownAudit(req),
    },
  });
  if (!draft) throw new HttpError(404, 'Draft not found.');
  res.json({ success: true, data: draft });
}

// 8. DELETE /api/velora/drafts/:id
export async function deleteDraft(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  await prisma.veloraAuditDraft.deleteMany({
    where: {
      id,
      ...ownAudit(req),
    },
  });
  res.json({ success: true, message: 'Draft deleted successfully.' });
}

// 9. GET /api/velora/stats
export async function getStats(req, res) {
  // Total submitted audits
  const totalAudits = await prisma.veloraAudit.count({
    where: {
      status: { in: ['submitted', 'approved'] },
      ...ownAudit(req),
    },
  });

  // Total generated reports
  const totalReports = await prisma.veloraPdfReport.count();

  // Average compliance delivery status score
  const complianceDeliveries = await prisma.veloraComplianceDelivery.findMany({
    select: { status: true },
  });
  let complianceRate = 0;
  if (complianceDeliveries.length > 0) {
    const totalScore = complianceDeliveries.reduce((sum, item) => {
      if (item.status === 'compliant') return sum + 100;
      if (item.status === 'partial') return sum + 50;
      return sum; // non_compliant = 0
    }, 0);
    complianceRate = Math.round((totalScore / complianceDeliveries.length) * 10) / 10;
  }

  // Calculate average performance rating from audits
  const completedAudits = await prisma.veloraAudit.findMany({
    where: {
      status: { in: ['submitted', 'approved'] },
      ...ownAudit(req),
    },
    select: { overallScore: true },
  });

  let averageScore = 0;
  let rating = 'Poor';
  if (completedAudits.length > 0) {
    const sumScore = completedAudits.reduce((sum, audit) => sum + (audit.overallScore || 0), 0);
    averageScore = Math.round((sumScore / completedAudits.length) * 10) / 10;
    if (averageScore >= 90) rating = 'Excellent';
    else if (averageScore >= 75) rating = 'Good';
    else if (averageScore >= 60) rating = 'Average';
  }

  res.json({
    success: true,
    data: {
      total_audits: totalAudits,
      total_reports: totalReports,
      compliance_rate: complianceRate,
      kpi_score: averageScore,
      performance_rating: rating,
    },
  });
}

// 10. POST /api/velora/pdf-reports
export async function savePdfReport(req, res) {
  const { pdfData, auditNumber, auditId, title } = req.body;

  let base64Content = pdfData;
  if (pdfData.includes('base64,')) {
    base64Content = pdfData.split('base64,')[1];
  }
  const buffer = Buffer.from(base64Content, 'base64');

  // Validate the content is actually a PDF — never trust the client's bytes.
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new HttpError(400, 'Invalid PDF data.');
  }

  const reportNumber = newPdfReportNumber();
  // The filename is built ONLY from the server-generated report number. The
  // client-supplied auditNumber is stored as data but never touches the path
  // (it was previously a path-traversal arbitrary-write primitive).
  const fileName = `${reportNumber}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);
  if (path.dirname(path.resolve(filePath)) !== PDF_DIR) {
    throw new HttpError(400, 'Invalid file path.');
  }

  await fs.promises.writeFile(filePath, buffer);

  const report = await prisma.veloraPdfReport.create({
    data: {
      reportNumber,
      auditorId: req.user.id,
      auditId: auditId || null,
      auditNumber,
      fileName,
      filePath,
      pdfContent: base64Content,
      title: title || `Audit Report ${auditNumber}`,
    },
  });

  res.status(201).json({ success: true, data: { report } });
}

// 11. GET /api/velora/pdf-reports
export async function listPdfReports(req, res) {
  // Reports are shared org-wide (visible to all authenticated users).
  const reports = await prisma.veloraPdfReport.findMany({
    orderBy: { generatedDate: 'desc' },
  });
  res.json({ success: true, data: reports });
}

// Guard: only stream/delete files that actually live inside PDF_DIR (protects
// against any legacy traversal-crafted filePath stored in the DB).
function isInsidePdfDir(filePath) {
  return path.dirname(path.resolve(filePath)) === PDF_DIR;
}

// 12. GET /api/velora/pdf-reports/download/:id
export async function downloadPdfReport(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  // Reports are shared org-wide; any authenticated user may download.
  const report = await prisma.veloraPdfReport.findUnique({ where: { id } });
  if (!report) throw new HttpError(404, 'PDF report not found.');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${report.reportNumber}.pdf"`);

  if (!isInsidePdfDir(report.filePath) || !fs.existsSync(report.filePath)) {
    if (report.pdfContent) {
      const buffer = Buffer.from(report.pdfContent, 'base64');
      res.send(buffer);
      return;
    }
    throw new HttpError(404, 'PDF file not found.');
  }

  fs.createReadStream(report.filePath).pipe(res);
}

// 13. DELETE /api/velora/pdf-reports/:id
export async function deletePdfReport(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const report = await prisma.veloraPdfReport.findFirst({
    where: { id, ...ownAudit(req) },
  });

  if (report) {
    if (isInsidePdfDir(report.filePath) && fs.existsSync(report.filePath)) {
      try {
        fs.unlinkSync(report.filePath);
      } catch (err) {
        logger.error('Failed to delete PDF file', err);
      }
    }

    await prisma.veloraPdfReport.delete({
      where: { id },
    });
  }

  res.json({ success: true, message: 'PDF report deleted successfully.' });
}

// 14. GET /api/velora/service-reports
export async function listServiceReports(req, res) {
  const reports = await prisma.veloraServiceReport.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: reports });
}

// 15. POST /api/velora/service-reports
export async function saveServiceReport(req, res) {
  const body = req.body;
  const reportNumber = newReportNumber();

  const report = await prisma.veloraServiceReport.create({
    data: {
      reportNumber,
      reportTypeId: body.reportTypeId,
      title: body.title,
      description: body.description || null,
      reportDate: new Date(body.reportDate),
      // Attribution from the session, not the request body.
      createdBy: req.user.username,
      content: body.content || null,
      status: 'published',
    },
  });

  res.status(201).json({ success: true, data: { report } });
}

// 16. GET /api/velora/compliance/items/:categoryId
export async function getComplianceItems(req, res) {
  const categoryId = Number.parseInt(req.params.categoryId, 10);
  
  // Seed data is returned statically to avoid complex database schema maintenance for categories/items
  const itemsByCategory = {
    1: [
      { id: 1, itemName: 'Adequate Staffing Levels' },
      { id: 2, itemName: 'Equipment Availability' },
      { id: 3, itemName: 'PPE Availability' },
      { id: 4, itemName: 'Consumables Stock' },
    ],
    2: [
      { id: 5, itemName: 'Safety Briefings' },
      { id: 6, itemName: 'Hazard Reporting' },
      { id: 7, itemName: 'Emergency Drills' },
      { id: 8, itemName: 'Safety Signage' },
      { id: 9, itemName: 'Incident Reporting' },
    ],
    3: [
      { id: 10, itemName: 'Safety Training' },
      { id: 11, itemName: 'Technical Certifications' },
      { id: 12, itemName: 'First Aid Certification' },
      { id: 13, itemName: 'Fire Safety Training' },
      { id: 14, itemName: 'Equipment Operation Training' },
    ],
  };

  const items = itemsByCategory[categoryId] || [];
  res.json({ success: true, data: items });
}

// 17. GET /api/velora/compliance/delivery
export async function getComplianceDelivery(req, res) {
  const deliveries = await prisma.veloraComplianceDelivery.findMany({
    orderBy: { deliveryDate: 'desc' },
  });

  // Resolve compliance item details and category names statically
  const items = [
    { id: 1, categoryId: 1, categoryName: 'Resources', itemName: 'Adequate Staffing Levels' },
    { id: 2, categoryId: 1, categoryName: 'Resources', itemName: 'Equipment Availability' },
    { id: 3, categoryId: 1, categoryName: 'Resources', itemName: 'PPE Availability' },
    { id: 4, categoryId: 1, categoryName: 'Resources', itemName: 'Consumables Stock' },
    { id: 5, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Safety Briefings' },
    { id: 6, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Hazard Reporting' },
    { id: 7, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Emergency Drills' },
    { id: 8, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Safety Signage' },
    { id: 9, categoryId: 2, categoryName: 'Safety Practice', itemName: 'Incident Reporting' },
    { id: 10, categoryId: 3, categoryName: 'Training and Certification', itemName: 'Safety Training' },
    { id: 11, categoryId: 3, categoryName: 'Training and Certification', itemName: 'Technical Certifications' },
    { id: 12, categoryId: 3, categoryName: 'Training and Certification', itemName: 'First Aid Certification' },
    { id: 13, categoryId: 3, categoryName: 'Training and Certification', itemName: 'Fire Safety Training' },
    { id: 14, categoryId: 3, categoryName: 'Training and Certification', itemName: 'Equipment Operation Training' },
  ];

  const itemMap = new Map(items.map(i => [i.id, i]));

  const data = deliveries.map(d => {
    const item = itemMap.get(d.complianceItemId);
    return {
      ...d,
      item_name: item ? item.itemName : 'Unknown Item',
      category_name: item ? item.categoryName : 'Unknown Category',
    };
  });

  res.json({ success: true, data });
}

// 18. POST /api/velora/compliance/delivery
export async function saveComplianceDelivery(req, res) {
  const body = req.body;

  const delivery = await prisma.veloraComplianceDelivery.create({
    data: {
      complianceItemId: body.complianceItemId,
      deliveryDate: new Date(body.deliveryDate),
      status: body.status,
      evidence: body.evidence || null,
      verifiedBy: body.verifiedBy || null,
      verificationDate: body.verificationDate ? new Date(body.verificationDate) : null,
    },
  });

  res.status(201).json({ success: true, data: { delivery } });
}
