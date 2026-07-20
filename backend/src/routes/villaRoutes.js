import express, { Router } from 'express';
import { requireAuth, requireRole, requireModule } from '../middleware/auth.js';
import { validate, validateParams } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadSinglePhoto } from '../middleware/upload.js';
import { mutationRateLimiter } from '../middleware/rateLimit.js';
import { saveInspectionSchema, saveDraftSchema, auditCodeParam, idParam } from '../validation/villaSchemas.js';
import * as villa from '../controllers/villaController.js';

const router = Router();
router.use(express.json({ limit: '1mb' })); // photos go via multipart (multer), so JSON stays small
router.use(requireAuth); // every route in this module requires a valid session
router.use(requireRole('ADMIN', 'AUDITOR'));
router.use(requireModule('villa'));
router.use(mutationRateLimiter); // per-user cap on writes (skips GETs)

// Photos
router.post('/photos', uploadSinglePhoto, asyncHandler(villa.uploadPhoto));
router.get('/photos/:id', validateParams(idParam), asyncHandler(villa.servePhoto));

// Inspections (completed)
router.post('/inspections', validate(saveInspectionSchema), asyncHandler(villa.saveInspection));
router.get('/reports', asyncHandler(villa.listReports));
router.get('/reports/:auditCode', validateParams(auditCodeParam), asyncHandler(villa.getReport));
router.delete('/reports/:auditCode', validateParams(auditCodeParam), asyncHandler(villa.deleteReport));

// Drafts (work-in-progress)
router.post('/drafts', validate(saveDraftSchema), asyncHandler(villa.saveDraft));
router.get('/drafts', asyncHandler(villa.listDrafts));
router.get('/drafts/:id', validateParams(idParam), asyncHandler(villa.getDraft));
router.delete('/drafts/:id', validateParams(idParam), asyncHandler(villa.deleteDraft));

// Stats
router.get('/stats', asyncHandler(villa.getStats));

export default router;
