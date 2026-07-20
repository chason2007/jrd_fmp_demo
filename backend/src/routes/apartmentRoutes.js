import express, { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateParams } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadSinglePhoto } from '../middleware/upload.js';
import { mutationRateLimiter } from '../middleware/rateLimit.js';
import { saveApartmentAuditSchema, saveApartmentDraftSchema, auditCodeParam, idParam } from '../validation/apartmentSchemas.js';
import * as apartment from '../controllers/apartmentController.js';

const router = Router();
router.use(express.json({ limit: '1mb' })); // photos go via multipart (multer), so JSON stays small
router.use(requireAuth);
router.use(requireRole('ADMIN', 'AUDITOR'));
router.use(mutationRateLimiter); // per-user cap on writes (skips GETs)

// Photos
router.post('/photos', uploadSinglePhoto, asyncHandler(apartment.uploadPhoto));
router.get('/photos/:id', validateParams(idParam), asyncHandler(apartment.servePhoto));

// Audits (completed)
router.post('/audits', validate(saveApartmentAuditSchema), asyncHandler(apartment.saveAudit));
router.get('/audits', asyncHandler(apartment.listAudits));
router.get('/audits/:auditCode', validateParams(auditCodeParam), asyncHandler(apartment.getAudit));
router.delete('/audits/:auditCode', validateParams(auditCodeParam), asyncHandler(apartment.deleteAudit));

// Drafts (work-in-progress)
router.post('/drafts', validate(saveApartmentDraftSchema), asyncHandler(apartment.saveDraft));
router.get('/drafts', asyncHandler(apartment.listDrafts));
router.get('/drafts/:id', validateParams(idParam), asyncHandler(apartment.getDraft));
router.delete('/drafts/:id', validateParams(idParam), asyncHandler(apartment.deleteDraft));

// Stats
router.get('/stats', asyncHandler(apartment.getStats));

export default router;
