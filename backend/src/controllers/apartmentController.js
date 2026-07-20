import fs from 'node:fs';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { detectImage } from '../lib/imageType.js';
import { newApartmentAuditCode, newApartmentDraftCode, newStorageKey } from '../lib/codes.js';
import { resolveStoragePath } from '../config/storage.js';
import { writeAudit } from '../lib/audit.js';
import { HttpError } from '../utils/httpError.js';

const isAdmin = (req) => req.user.role === 'ADMIN';
// Object-level scope: admins see everything, auditors only their own audits.
const ownAudit = (req) => (isAdmin(req) ? {} : { auditorId: req.user.id });

const NON_COMPLIANT = ['Needs Improvement', 'Unsatisfactory'];

/**
 * Score a responses object. N/A is excluded from the score entirely so it can't
 * drag the result down; Satisfactory=100, Needs Improvement=50, Unsatisfactory=0.
 * Mirrors scoreApartment() on the client.
 */
function scoreStats(responses) {
  let scored = 0;
  let sum = 0;
  let satisfactoryCount = 0;
  let needsImprovementCount = 0;
  let unsatisfactoryCount = 0;
  let naCount = 0;

  for (const item of Object.values(responses || {})) {
    const answer = item?.answer;
    if (!answer) continue;
    if (answer === 'N/A') { naCount += 1; continue; }
    scored += 1;
    if (answer === 'Satisfactory') { sum += 100; satisfactoryCount += 1; }
    else if (answer === 'Needs Improvement') { sum += 50; needsImprovementCount += 1; }
    else { unsatisfactoryCount += 1; }
  }

  const score = scored > 0 ? Math.round((sum / scored) * 10) / 10 : null;
  const rating = score === null ? null
    : score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'average' : 'poor';

  return { score, rating, totalItems: scored, satisfactoryCount, needsImprovementCount, unsatisfactoryCount, naCount };
}

/** Collect every photoId referenced anywhere in a responses object. */
function collectPhotoIds(responses) {
  const ids = [];
  for (const item of Object.values(responses || {})) {
    if (Array.isArray(item?.photoIds)) ids.push(...item.photoIds);
  }
  return ids;
}

/** POST /api/apartment/photos — validate + store a single photo, return its id. */
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

/** GET /api/apartment/photos/:id — stream a photo the caller is allowed to see. */
export async function servePhoto(req, res) {
  const photo = await prisma.photo.findUnique({
    where: { id: req.params.id },
    include: { apartmentAudit: { select: { auditorId: true } } },
  });
  if (!photo) throw new HttpError(404, 'Photo not found.');

  // Committed photos (attached to a completed audit) are shared org-wide. A
  // PENDING photo (not yet attached) is only visible to its uploader.
  if (!photo.apartmentAudit && !isAdmin(req) && photo.uploadedById !== req.user.id) {
    throw new HttpError(404, 'Photo not found.');
  }

  const filePath = resolveStoragePath(photo.storageKey);
  if (!filePath || !fs.existsSync(filePath)) throw new HttpError(404, 'Photo not found.');

  res.type(photo.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(filePath).pipe(res);
}

/** POST /api/apartment/audits — finalize a completed apartment inspection. */
export async function saveAudit(req, res) {
  const body = req.body;
  const userId = req.user.id;

  // Integrity: a non-compliant item (Needs Improvement / Unsatisfactory) must
  // carry evidence — a remark AND at least one photo. Enforced here too so the
  // rule holds even if the client is bypassed.
  const missingEvidence = Object.values(body.responses || {}).filter(
    (r) => NON_COMPLIANT.includes(r?.answer)
      && (!String(r?.comment || '').trim() || !(Array.isArray(r?.photoIds) ? r.photoIds : []).length),
  );
  if (missingEvidence.length) {
    throw new HttpError(400, `Every non-compliant item (Needs Improvement / Unsatisfactory) requires a remark and at least one photo. ${missingEvidence.length} item(s) are missing evidence.`);
  }

  const auditCode = newApartmentAuditCode(body.roomNo);
  const stats = scoreStats(body.responses);

  const audit = await prisma.$transaction(async (tx) => {
    const created = await tx.apartmentAudit.create({
      data: {
        auditCode,
        auditorId: userId,
        tenantName: body.tenantName || null,
        apartmentType: body.apartmentType || null,
        roomNo: body.roomNo || null,
        location: body.location || null,
        moveInDate: body.moveInDate || null,
        landlordName: body.landlordName || null,
        auditDate: body.auditDate,
        // Attribution comes from the session, never the body (anti-repudiation).
        inspectorName: body.inspectorName || req.user.username,
        bedroomCount: body.bedroomCount ?? 1,
        bathroomCount: body.bathroomCount ?? 1,
        responses: body.responses,
        ...stats,
      },
    });

    const ids = collectPhotoIds(body.responses);
    if (ids.length) {
      // Attach ONLY this user's own still-pending photos — same guard as Villa/WV.
      const attached = await tx.photo.updateMany({
        where: { id: { in: ids }, issueId: null, wvAuditId: null, apartmentAuditId: null, uploadedById: userId },
        data: { apartmentAuditId: created.id },
      });
      if (attached.count !== ids.length) {
        throw new HttpError(400, 'One or more photos are invalid or already used.');
      }
    }

    if (body.draftId) {
      await tx.apartmentAuditDraft.deleteMany({ where: { id: body.draftId, auditorId: userId } });
    }

    return created;
  });

  await writeAudit({ userId, action: 'APARTMENT_AUDIT_SAVED', entityType: 'apartment_audit', entityId: auditCode, ip: req.ip });
  res.status(201).json({ success: true, data: { audit } });
}

/** GET /api/apartment/audits — completed audits (visible to all users). */
export async function listAudits(req, res) {
  const audits = await prisma.apartmentAudit.findMany({
    select: {
      auditCode: true,
      tenantName: true,
      apartmentType: true,
      roomNo: true,
      location: true,
      auditDate: true,
      score: true,
      rating: true,
      totalItems: true,
      needsImprovementCount: true,
      unsatisfactoryCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: { audits } });
}

/** GET /api/apartment/audits/:auditCode — full audit (visible to all users). */
export async function getAudit(req, res) {
  const audit = await prisma.apartmentAudit.findFirst({
    where: { auditCode: req.params.auditCode },
    include: { photos: { select: { id: true, mimeType: true } } },
  });
  if (!audit) throw new HttpError(404, 'Audit not found.');
  res.json({ success: true, data: { audit } });
}

/** DELETE /api/apartment/audits/:auditCode — delete audit + orphaned files. */
export async function deleteAudit(req, res) {
  const audit = await prisma.apartmentAudit.findFirst({
    where: { auditCode: req.params.auditCode, ...ownAudit(req) },
    include: { photos: { select: { storageKey: true } } },
  });
  if (!audit) throw new HttpError(404, 'Audit not found.');

  const storageKeys = audit.photos.map((p) => p.storageKey);
  await prisma.apartmentAudit.delete({ where: { id: audit.id } }); // cascades photo rows

  for (const key of storageKeys) {
    const fp = resolveStoragePath(key);
    if (fp) fs.promises.unlink(fp).catch(() => {});
  }

  await writeAudit({ userId: req.user.id, action: 'APARTMENT_AUDIT_DELETED', entityType: 'apartment_audit', entityId: req.params.auditCode, ip: req.ip });
  res.json({ success: true, data: { message: 'Audit deleted.' } });
}

/** POST /api/apartment/drafts — create or update an autosave draft (owner only). */
export async function saveDraft(req, res) {
  const body = req.body;
  const userId = req.user.id;
  const shared = {
    auditCode: body.auditCode || null,
    tenantName: body.tenantName || null,
    apartmentType: body.apartmentType || null,
    roomNo: body.roomNo || null,
    location: body.location || null,
    moveInDate: body.moveInDate || null,
    landlordName: body.landlordName || null,
    auditDate: body.auditDate || null,
    inspectorName: body.inspectorName || null,
    bedroomCount: body.bedroomCount ?? 1,
    bathroomCount: body.bathroomCount ?? 1,
    responses: body.responses,
  };

  let draft;
  if (body.draftId) {
    const updated = await prisma.apartmentAuditDraft.updateMany({
      where: { id: body.draftId, auditorId: userId },
      data: shared,
    });
    if (updated.count === 0) throw new HttpError(404, 'Draft not found.');
    draft = await prisma.apartmentAuditDraft.findUnique({
      where: { id: body.draftId },
      select: { id: true, draftCode: true, auditCode: true, updatedAt: true },
    });
  } else {
    draft = await prisma.apartmentAuditDraft.create({
      data: { draftCode: newApartmentDraftCode(), auditorId: userId, ...shared },
      select: { id: true, draftCode: true, auditCode: true, updatedAt: true },
    });
  }

  res.json({ success: true, data: { draft } });
}

/** GET /api/apartment/drafts — the caller's own drafts. */
export async function listDrafts(req, res) {
  const drafts = await prisma.apartmentAuditDraft.findMany({
    where: { auditorId: req.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: { drafts } });
}

/** GET /api/apartment/drafts/:id — one of the caller's drafts. */
export async function getDraft(req, res) {
  const draft = await prisma.apartmentAuditDraft.findFirst({ where: { id: req.params.id, auditorId: req.user.id } });
  if (!draft) throw new HttpError(404, 'Draft not found.');
  res.json({ success: true, data: { draft } });
}

/** DELETE /api/apartment/drafts/:id — delete a draft + its still-pending photos. */
export async function deleteDraft(req, res) {
  const draft = await prisma.apartmentAuditDraft.findFirst({ where: { id: req.params.id, auditorId: req.user.id } });
  if (!draft) throw new HttpError(404, 'Draft not found.');

  const photoIds = collectPhotoIds(draft.responses);
  let storageKeys = [];
  if (photoIds.length) {
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, issueId: null, wvAuditId: null, apartmentAuditId: null, uploadedById: req.user.id },
      select: { storageKey: true },
    });
    storageKeys = photos.map((p) => p.storageKey);
  }

  await prisma.$transaction(async (tx) => {
    if (photoIds.length) {
      await tx.photo.deleteMany({ where: { id: { in: photoIds }, issueId: null, wvAuditId: null, apartmentAuditId: null, uploadedById: req.user.id } });
    }
    await tx.apartmentAuditDraft.delete({ where: { id: draft.id } });
  });

  for (const key of storageKeys) {
    const fp = resolveStoragePath(key);
    if (fp) fs.promises.unlink(fp).catch(() => {});
  }

  res.json({ success: true, data: { message: 'Draft deleted.' } });
}

/** GET /api/apartment/stats — dashboard summary. */
export async function getStats(req, res) {
  const whereScope = ownAudit(req);
  const totalAudits = await prisma.apartmentAudit.count({ where: whereScope });
  const totalDrafts = await prisma.apartmentAuditDraft.count({ where: whereScope });

  const rated = await prisma.apartmentAudit.findMany({
    where: { ...whereScope, score: { not: null } },
    select: { score: true },
  });
  const avgScore = rated.length
    ? Math.round((rated.reduce((s, a) => s + (a.score || 0), 0) / rated.length) * 10) / 10
    : 0;

  res.json({
    success: true,
    data: { stats: { totalAudits, averageScore: `${avgScore}%`, drafts: totalDrafts, reports: totalAudits } },
  });
}
