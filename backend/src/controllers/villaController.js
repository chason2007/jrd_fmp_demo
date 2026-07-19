import fs from 'node:fs';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { detectImage } from '../lib/imageType.js';
import { newAuditCode, newDraftCode, newStorageKey } from '../lib/codes.js';
import { resolveStoragePath } from '../config/storage.js';
import { writeAudit } from '../lib/audit.js';
import { HttpError } from '../utils/httpError.js';

const isAdmin = (req) => req.user.role === 'ADMIN';
// Completed reports are shared org-wide (visible to every authenticated user).
// Ownership is still enforced for DESTRUCTIVE actions (delete) and for drafts —
// that's what `ownAudit` guards. Reads intentionally do not use it.
const ownAudit = (req) => (isAdmin(req) ? {} : { auditorId: req.user.id });

/** POST /api/villa/photos — validate + store a single photo, return its id. */
export async function uploadPhoto(req, res) {
  if (!req.file) throw new HttpError(400, 'No image file provided.');

  const detected = detectImage(req.file.buffer);
  if (!detected) throw new HttpError(400, 'Unsupported image type. Use JPEG, PNG, or WebP.');

  const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const storageKey = newStorageKey(detected.ext);
  const dest = resolveStoragePath(storageKey);
  if (!dest) throw new HttpError(400, 'Invalid storage key.');

  await fs.promises.writeFile(dest, req.file.buffer);

  const photo = await prisma.photo.create({
    data: {
      uploadedById: req.user.id,
      storageKey,
      originalName: (req.file.originalname || '').slice(0, 255) || null,
      mimeType: detected.mime,
      sizeBytes: req.file.size,
      sha256,
    },
    select: { id: true, mimeType: true, sizeBytes: true },
  });

  res.status(201).json({ success: true, data: { photo } });
}

/** GET /api/villa/photos/:id — stream a photo the caller is allowed to see. */
export async function servePhoto(req, res) {
  const photo = await prisma.photo.findUnique({
    where: { id: req.params.id },
    include: { issue: { include: { audit: { select: { auditorId: true } } } } },
  });
  if (!photo) throw new HttpError(404, 'Photo not found.');

  // Committed photos (attached to a completed report) are shared org-wide. A
  // PENDING photo (not yet attached to any report) is only visible to whoever
  // uploaded it, so unpublished uploads aren't enumerable by others.
  if (!photo.issue && !isAdmin(req) && photo.uploadedById !== req.user.id) {
    throw new HttpError(404, 'Photo not found.');
  }

  const filePath = resolveStoragePath(photo.storageKey);
  if (!filePath || !fs.existsSync(filePath)) throw new HttpError(404, 'Photo not found.');

  res.type(photo.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(filePath).pipe(res);
}

/** POST /api/villa/inspections — finalize a completed inspection. */
export async function saveInspection(req, res) {
  const body = req.body;
  const userId = req.user.id;

  // Integrity: each snag is a non-compliance and must carry evidence — a remark
  // AND at least one photo. Enforced here so the rule holds even if the client
  // is bypassed.
  const missingEvidence = (body.issues || []).filter(
    (iss) => !String(iss?.comment || '').trim() || !(Array.isArray(iss?.photoIds) ? iss.photoIds : []).length,
  );
  if (missingEvidence.length) {
    throw new HttpError(400, `Every defect requires a remark and at least one photo. ${missingEvidence.length} defect(s) are missing evidence.`);
  }

  const auditCode = newAuditCode(body.flatNumber);

  const result = await prisma.$transaction(async (tx) => {
    // Get-or-create the flat by flat number.
    let villa = await tx.villa.findUnique({ where: { flatNumber: body.flatNumber } });
    if (!villa) {
      villa = await tx.villa.create({
        data: {
          flatNumber: body.flatNumber,
          unitNumber: body.unitNumber || null,
          ownerName: body.ownerName,
          address: body.propertyAddress || null,
          emirate: body.emirate || null,
          area: body.area || null,
        },
      });
    }

    const audit = await tx.audit.create({
      data: { auditCode, villaId: villa.id, auditorId: userId, status: 'COMPLETED', issueCount: body.issues.length },
    });

    for (const iss of body.issues) {
      const issue = await tx.issue.create({
        data: {
          auditId: audit.id,
          area: iss.area || null,
          floor: iss.floor || null,
          room: iss.room || null,
          spotDesc: iss.spotDesc || null,
          category: iss.category || null,
          subCategory: iss.subCategory || null,
          issueType: iss.issueType || null,
          comment: iss.comment || null,
        },
      });

      const ids = iss.photoIds || [];
      if (ids.length) {
        // Attach ONLY this user's own still-pending photos. A mismatch means a
        // photo is missing, already used, or someone else's → reject the whole save.
        const attached = await tx.photo.updateMany({
          where: { id: { in: ids }, issueId: null, uploadedById: userId },
          data: { issueId: issue.id },
        });
        if (attached.count !== ids.length) {
          throw new HttpError(400, 'One or more photos are invalid or already used.');
        }
      }
    }

    if (body.draftId) {
      await tx.auditDraft.deleteMany({ where: { id: body.draftId, auditorId: userId } });
    }

    return { auditCode, issueCount: body.issues.length };
  });

  await writeAudit({ userId, action: 'INSPECTION_SAVED', entityType: 'audit', entityId: auditCode, ip: req.ip });
  res.status(201).json({ success: true, data: result });
}

/** GET /api/villa/reports — completed inspections (visible to all users). */
export async function listReports(req, res) {
  const reports = await prisma.audit.findMany({
    where: { status: 'COMPLETED' },
    select: {
      auditCode: true,
      auditDate: true,
      issueCount: true,
      auditor: { select: { username: true } },
      villa: { select: { flatNumber: true, unitNumber: true, ownerName: true } },
    },
    orderBy: { auditDate: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: { reports } });
}

/** GET /api/villa/reports/:auditCode — full report (visible to all users). */
export async function getReport(req, res) {
  const audit = await prisma.audit.findFirst({
    where: { auditCode: req.params.auditCode },
    include: {
      villa: true,
      issues: {
        orderBy: { id: 'asc' },
        include: { photos: { select: { id: true, mimeType: true, width: true, height: true } } },
      },
    },
  });
  if (!audit) throw new HttpError(404, 'Audit report not found.');
  res.json({ success: true, data: { audit } });
}

/** DELETE /api/villa/reports/:auditCode — delete report + orphaned files. */
export async function deleteReport(req, res) {
  const audit = await prisma.audit.findFirst({
    where: { auditCode: req.params.auditCode, ...ownAudit(req) },
    include: { issues: { include: { photos: { select: { storageKey: true } } } } },
  });
  if (!audit) throw new HttpError(404, 'Audit report not found.');

  const storageKeys = audit.issues.flatMap((i) => i.photos.map((p) => p.storageKey));
  const villaId = audit.villaId;

  await prisma.$transaction(async (tx) => {
    await tx.audit.delete({ where: { id: audit.id } }); // cascades issues + photo rows
    const remaining = await tx.audit.count({ where: { villaId } });
    if (remaining === 0) await tx.villa.delete({ where: { id: villaId } });
  });

  // Files aren't covered by DB cascade — remove them best-effort after commit.
  for (const key of storageKeys) {
    const fp = resolveStoragePath(key);
    if (fp) fs.promises.unlink(fp).catch(() => {});
  }

  await writeAudit({ userId: req.user.id, action: 'INSPECTION_DELETED', entityType: 'audit', entityId: req.params.auditCode, ip: req.ip });
  res.json({ success: true, data: { message: 'Report deleted.' } });
}

/** POST /api/villa/drafts — create or update an autosave draft (owner only). */
export async function saveDraft(req, res) {
  const body = req.body;
  const userId = req.user.id;
  const shared = {
    auditCode: body.auditCode || null,
    flatNumber: body.flatNumber,
    unitNumber: body.unitNumber || null,
    ownerName: body.ownerName,
    propertyAddress: body.propertyAddress || null,
    emirate: body.emirate || null,
    area: body.area || null,
    issuesData: body.issues,
    issueCount: body.issues.length,
  };

  let draft;
  if (body.draftId) {
    const updated = await prisma.auditDraft.updateMany({
      where: { id: body.draftId, auditorId: userId },
      data: shared,
    });
    if (updated.count === 0) throw new HttpError(404, 'Draft not found.');
    draft = await prisma.auditDraft.findUnique({
      where: { id: body.draftId },
      select: { id: true, draftCode: true, auditCode: true },
    });
  } else {
    draft = await prisma.auditDraft.create({
      data: { draftCode: newDraftCode(), auditorId: userId, ...shared },
      select: { id: true, draftCode: true, auditCode: true },
    });
  }

  res.json({ success: true, data: { draft } });
}

/** GET /api/villa/drafts — the caller's own drafts. */
export async function listDrafts(req, res) {
  const drafts = await prisma.auditDraft.findMany({
    where: { auditorId: req.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: { drafts } });
}

/** GET /api/villa/drafts/:id — one of the caller's drafts. */
export async function getDraft(req, res) {
  const draft = await prisma.auditDraft.findFirst({ where: { id: req.params.id, auditorId: req.user.id } });
  if (!draft) throw new HttpError(404, 'Draft not found.');
  res.json({ success: true, data: { draft } });
}

/** DELETE /api/villa/drafts/:id — delete one of the caller's drafts. */
export async function deleteDraft(req, res) {
  const draft = await prisma.auditDraft.findFirst({
    where: { id: req.params.id, auditorId: req.user.id },
  });
  if (!draft) throw new HttpError(404, 'Draft not found.');

  const photoIds = [];
  const issues = Array.isArray(draft.issuesData) ? draft.issuesData : [];
  for (const iss of issues) {
    if (iss && Array.isArray(iss.photoIds)) {
      for (const pid of iss.photoIds) {
        if (typeof pid === 'number') {
          photoIds.push(pid);
        }
      }
    }
  }

  let storageKeys = [];
  if (photoIds.length) {
    const photos = await prisma.photo.findMany({
      where: {
        id: { in: photoIds },
        issueId: null,
        uploadedById: req.user.id,
      },
      select: { id: true, storageKey: true },
    });
    storageKeys = photos.map((p) => p.storageKey);
  }

  await prisma.$transaction(async (tx) => {
    if (photoIds.length) {
      await tx.photo.deleteMany({
        where: {
          id: { in: photoIds },
          issueId: null,
          uploadedById: req.user.id,
        },
      });
    }
    await tx.auditDraft.delete({
      where: { id: draft.id },
    });
  });

  // Best-effort unlink of physical files
  for (const key of storageKeys) {
    const fp = resolveStoragePath(key);
    if (fp) fs.promises.unlink(fp).catch(() => {});
  }

  res.json({ success: true, data: { message: 'Draft deleted.' } });
}

/** GET /api/villa/stats — return summary statistics for audits/drafts. */
export async function getStats(req, res) {
  const whereScope = ownAudit(req);
  
  const totalAudits = await prisma.audit.count({ where: whereScope });
  const totalDrafts = await prisma.auditDraft.count({ where: whereScope });
  
  // Compliance rate calculation: audits with 0 issues vs total
  const flawlessAudits = await prisma.audit.count({
    where: { ...whereScope, issueCount: 0 }
  });
  
  const complianceRate = totalAudits > 0 
    ? ((flawlessAudits / totalAudits) * 100).toFixed(1) + '%'
    : '100%';

  res.json({
    success: true,
    data: {
      stats: {
        totalAudits,
        complianceRate,
        drafts: totalDrafts,
        reports: totalAudits // assuming reports = completed audits
      }
    }
  });
}
