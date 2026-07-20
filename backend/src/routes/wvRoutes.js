import express, { Router } from 'express';
import { requireAuth, requireRole, requireModule } from '../middleware/auth.js';
import { validate, validateParams } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadSinglePhoto } from '../middleware/upload.js';
import { mutationRateLimiter } from '../middleware/rateLimit.js';
import { saveWvAuditSchema, saveWvDraftSchema, auditCodeParam, idParam } from '../validation/wvSchemas.js';
import * as wv from '../controllers/wvController.js';

const router = Router();
router.use(express.json({ limit: '1mb' })); // photos go via multipart (multer), so JSON stays small
router.use(requireAuth);
router.use(requireRole('ADMIN', 'AUDITOR'));
router.use(requireModule('wv'));
router.use(mutationRateLimiter); // per-user cap on writes (skips GETs)

// Photos
router.post('/photos', uploadSinglePhoto, asyncHandler(wv.uploadPhoto));
router.get('/photos/:id', validateParams(idParam), asyncHandler(wv.servePhoto));

// Audits (completed)
router.post('/audits', validate(saveWvAuditSchema), asyncHandler(wv.saveAudit));
router.get('/audits', asyncHandler(wv.listAudits));
router.get('/audits/:auditCode', validateParams(auditCodeParam), asyncHandler(wv.getAudit));
router.delete('/audits/:auditCode', validateParams(auditCodeParam), asyncHandler(wv.deleteAudit));

// Drafts (work-in-progress)
router.post('/drafts', validate(saveWvDraftSchema), asyncHandler(wv.saveDraft));
router.get('/drafts', asyncHandler(wv.listDrafts));
router.get('/drafts/:id', validateParams(idParam), asyncHandler(wv.getDraft));
router.delete('/drafts/:id', validateParams(idParam), asyncHandler(wv.deleteDraft));

// Stats
router.get('/stats', asyncHandler(wv.getStats));

export default router;
