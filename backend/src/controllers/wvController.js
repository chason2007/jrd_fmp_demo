import fs from 'node:fs';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { detectImage } from '../lib/imageType.js';
import { newWvAuditCode, newWvDraftCode, newStorageKey } from '../lib/codes.js';
import { resolveStoragePath } from '../config/storage.js';
import { writeAudit } from '../lib/audit.js';
import { HttpError } from '../utils/httpError.js';

const isAdmin = (req) => req.user.role === 'ADMIN';
// Object-level scope: admins see everything, auditors only their own audits.
const ownAudit = (req) => (isAdmin(req) ? {} : { auditorId: req.user.id });

/** Compute compliance stats from a responses object: { [item]: { answer } }. */
function complianceStats(responses) {
  let compliantCount = 0;
  let nonCompliantCount = 0;
  for (const item of Object.values(responses || {})) {
    if (item?.answer === 'yes') compliantCount++;
    else if (item?.answer === 'no') nonCompliantCount++;
  }
  const totalItems = compliantCount + nonCompliantCount;
  const complianceRate = totalItems > 0 ? Math.round((compliantCount / totalItems) * 1000) / 10 : null;
  return { totalItems, compliantCount, nonCompliantCount, complianceRate };
}

/** Collect every photoId referenced anywhere in a responses object. */
function collectPhotoIds(responses) {
  const ids = [];
  for (const item of Object.values(responses || {})) {
    if (Array.isArray(item?.photoIds)) ids.push(...item.photoIds);
  }
  return ids;
}

/** POST /api/wv/photos — validate + store a single photo, return its id. */
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

/** GET /api/wv/photos/:id — stream a photo the caller is allowed to see. */
export async function servePhoto(req, res) {
  const photo = await prisma.photo.findUnique({
    where: { id: req.params.id },
    include: { wvAudit: { select: { auditorId: true } } },
  });
  if (!photo) throw new HttpError(404, 'Photo not found.');

  // Committed photos (attached to a completed audit) are shared org-wide. A
  // PENDING photo (not yet attached) is only visible to its uploader.
  if (!photo.wvAudit && !isAdmin(req) && photo.uploadedById !== req.user.id) {
    throw new HttpError(404, 'Photo not found.');
  }

  const filePath = resolveStoragePath(photo.storageKey);
  if (!filePath || !fs.existsSync(filePath)) throw new HttpError(404, 'Photo not found.');

  res.type(photo.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(filePath).pipe(res);
}

/** POST /api/wv/audits — finalize a completed WV audit. */
export async function saveAudit(req, res) {
  const body = req.body;
  const userId = req.user.id;

  // Integrity: a non-compliant ("No") item must carry evidence — a remark AND at
  // least one photo. Enforced here too so the rule holds even if the client is
  // bypassed.
  const missingEvidence = Object.values(body.responses || {}).filter(
    (r) => r?.answer === 'no' && (!String(r?.comment || '').trim() || !(Array.isArray(r?.photoIds) ? r.photoIds : []).length),
  );
  if (missingEvidence.length) {
    throw new HttpError(400, `Every non-compliant ("No") item requires a remark and at least one photo. ${missingEvidence.length} item(s) are missing evidence.`);
  }

  const auditCode = newWvAuditCode({
    auditType: body.auditType,
    cluster: body.cluster,
    building: body.building,
    floor: body.floor,
    room: body.room,
  });
  const stats = complianceStats(body.responses);

  const audit = await prisma.$transaction(async (tx) => {
    const created = await tx.wvAudit.create({
      data: {
        auditCode,
        auditorId: userId,
        auditType: body.auditType,
        cluster: body.cluster || null,
        building: body.building || null,
        floor: body.floor || null,
        room: body.room || null,
        staffName: body.staffName || null,
        staffNo: body.staffNo || null,
        auditDate: body.auditDate,
        inspectorName: body.inspectorName || req.user.username,
        responses: body.responses,
        ...stats,
      },
    });

    const ids = collectPhotoIds(body.responses);
    if (ids.length) {
      // Attach ONLY this user's own still-pending photos — same guard as Villa.
      const attached = await tx.photo.updateMany({
        where: { id: { in: ids }, issueId: null, wvAuditId: null, uploadedById: userId },
        data: { wvAuditId: created.id },
      });
      if (attached.count !== ids.length) {
        throw new HttpError(400, 'One or more photos are invalid or already used.');
      }
    }

    if (body.draftId) {
      await tx.wvAuditDraft.deleteMany({ where: { id: body.draftId, auditorId: userId } });
    }

    return created;
  });

  await writeAudit({ userId, action: 'WV_AUDIT_SAVED', entityType: 'wv_audit', entityId: auditCode, ip: req.ip });
  res.status(201).json({ success: true, data: { audit } });
}

/** GET /api/wv/audits — completed audits (visible to all users). */
export async function listAudits(req, res) {
  const audits = await prisma.wvAudit.findMany({
    select: {
      auditCode: true,
      auditType: true,
      cluster: true,
      building: true,
      floor: true,
      room: true,
      auditDate: true,
      complianceRate: true,
      totalItems: true,
      nonCompliantCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: { audits } });
}

/** GET /api/wv/audits/:auditCode — full audit (visible to all users). */
export async function getAudit(req, res) {
  const audit = await prisma.wvAudit.findFirst({
    where: { auditCode: req.params.auditCode },
    include: { photos: { select: { id: true, mimeType: true } } },
  });
  if (!audit) throw new HttpError(404, 'Audit not found.');
  res.json({ success: true, data: { audit } });
}

/** DELETE /api/wv/audits/:auditCode — delete audit + orphaned files. */
export async function deleteAudit(req, res) {
  const audit = await prisma.wvAudit.findFirst({
    where: { auditCode: req.params.auditCode, ...ownAudit(req) },
    include: { photos: { select: { storageKey: true } } },
  });
  if (!audit) throw new HttpError(404, 'Audit not found.');

  const storageKeys = audit.photos.map((p) => p.storageKey);
  await prisma.wvAudit.delete({ where: { id: audit.id } }); // cascades photo rows

  for (const key of storageKeys) {
    const fp = resolveStoragePath(key);
    if (fp) fs.promises.unlink(fp).catch(() => {});
  }

  await writeAudit({ userId: req.user.id, action: 'WV_AUDIT_DELETED', entityType: 'wv_audit', entityId: req.params.auditCode, ip: req.ip });
  res.json({ success: true, data: { message: 'Audit deleted.' } });
}

/** POST /api/wv/drafts — create or update an autosave draft (owner only). */
export async function saveDraft(req, res) {
  const body = req.body;
  const userId = req.user.id;
  const shared = {
    auditCode: body.auditCode || null,
    auditType: body.auditType,
    cluster: body.cluster || null,
    building: body.building || null,
    floor: body.floor || null,
    room: body.room || null,
    staffName: body.staffName || null,
    staffNo: body.staffNo || null,
    auditDate: body.auditDate || null,
    inspectorName: body.inspectorName || null,
    responses: body.responses,
  };

  let draft;
  if (body.draftId) {
    const updated = await prisma.wvAuditDraft.updateMany({
      where: { id: body.draftId, auditorId: userId },
      data: shared,
    });
    if (updated.count === 0) throw new HttpError(404, 'Draft not found.');
    draft = await prisma.wvAuditDraft.findUnique({
      where: { id: body.draftId },
      select: { id: true, draftCode: true, auditCode: true, updatedAt: true },
    });
  } else {
    draft = await prisma.wvAuditDraft.create({
      data: { draftCode: newWvDraftCode(), auditorId: userId, ...shared },
      select: { id: true, draftCode: true, auditCode: true, updatedAt: true },
    });
  }

  res.json({ success: true, data: { draft } });
}

/** GET /api/wv/drafts — the caller's own drafts. */
export async function listDrafts(req, res) {
  const drafts = await prisma.wvAuditDraft.findMany({
    where: { auditorId: req.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: { drafts } });
}

/** GET /api/wv/drafts/:id — one of the caller's drafts. */
export async function getDraft(req, res) {
  const draft = await prisma.wvAuditDraft.findFirst({ where: { id: req.params.id, auditorId: req.user.id } });
  if (!draft) throw new HttpError(404, 'Draft not found.');
  res.json({ success: true, data: { draft } });
}

/** DELETE /api/wv/drafts/:id — delete one of the caller's drafts + its pending photos. */
export async function deleteDraft(req, res) {
  const draft = await prisma.wvAuditDraft.findFirst({ where: { id: req.params.id, auditorId: req.user.id } });
  if (!draft) throw new HttpError(404, 'Draft not found.');

  const photoIds = collectPhotoIds(draft.responses);
  let storageKeys = [];
  if (photoIds.length) {
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, issueId: null, wvAuditId: null, uploadedById: req.user.id },
      select: { storageKey: true },
    });
    storageKeys = photos.map((p) => p.storageKey);
  }

  await prisma.$transaction(async (tx) => {
    if (photoIds.length) {
      await tx.photo.deleteMany({ where: { id: { in: photoIds }, issueId: null, wvAuditId: null, uploadedById: req.user.id } });
    }
    await tx.wvAuditDraft.delete({ where: { id: draft.id } });
  });

  for (const key of storageKeys) {
    const fp = resolveStoragePath(key);
    if (fp) fs.promises.unlink(fp).catch(() => {});
  }

  res.json({ success: true, data: { message: 'Draft deleted.' } });
}

/** GET /api/wv/stats — dashboard summary. */
export async function getStats(req, res) {
  const whereScope = ownAudit(req);
  const totalAudits = await prisma.wvAudit.count({ where: whereScope });
  const totalDrafts = await prisma.wvAuditDraft.count({ where: whereScope });

  const rated = await prisma.wvAudit.findMany({
    where: { ...whereScope, complianceRate: { not: null } },
    select: { complianceRate: true },
  });
  const avgRate = rated.length
    ? Math.round((rated.reduce((s, a) => s + a.complianceRate, 0) / rated.length) * 10) / 10
    : 100;

  res.json({
    success: true,
    data: { stats: { totalAudits, complianceRate: `${avgRate}%`, drafts: totalDrafts, reports: totalAudits } },
  });
}
