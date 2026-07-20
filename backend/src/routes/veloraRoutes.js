import express, { Router } from 'express';
import { requireAuth, requireRole, requireModule } from '../middleware/auth.js';
import { validate, validateParams } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  saveAuditSchema,
  saveDraftSchema,
  saveServiceReportSchema,
  saveComplianceSchema,
  savePdfReportSchema,
  idParam,
} from '../validation/veloraSchemas.js';
import { mutationRateLimiter } from '../middleware/rateLimit.js';
import * as velora from '../controllers/veloraController.js';

const router = Router();
// Larger cap here only: Velora embeds base64 images (responses) and PDFs (pdf-reports).
router.use(express.json({ limit: '20mb' }));
router.use(requireAuth); // All routes require authentication
router.use(requireRole('ADMIN', 'AUDITOR'));
router.use(requireModule('velora'));
router.use(mutationRateLimiter); // per-user cap on writes (skips GETs)

// Config/Metadata
router.get('/service-types', asyncHandler(velora.getServiceTypes));

// Audits
router.post('/audits', validate(saveAuditSchema), asyncHandler(velora.saveAudit));
router.get('/audits', asyncHandler(velora.listAudits));
router.get('/audits/:id', validateParams(idParam), asyncHandler(velora.getAudit));

// Drafts
router.post('/drafts', validate(saveDraftSchema), asyncHandler(velora.saveDraft));
router.get('/drafts', asyncHandler(velora.listDrafts));
router.get('/drafts/:id', validateParams(idParam), asyncHandler(velora.getDraft));
router.delete('/drafts/:id', validateParams(idParam), asyncHandler(velora.deleteDraft));

// Stats
router.get('/stats', asyncHandler(velora.getStats));

// PDF Reports
router.post('/pdf-reports', validate(savePdfReportSchema), asyncHandler(velora.savePdfReport));
router.get('/pdf-reports', asyncHandler(velora.listPdfReports));
router.get('/pdf-reports/download/:id', validateParams(idParam), asyncHandler(velora.downloadPdfReport));
router.delete('/pdf-reports/:id', validateParams(idParam), asyncHandler(velora.deletePdfReport));

// Service Reports
router.get('/service-reports', asyncHandler(velora.listServiceReports));
router.post('/service-reports', validate(saveServiceReportSchema), asyncHandler(velora.saveServiceReport));

// Compliance
router.get('/compliance/items/:categoryId', asyncHandler(velora.getComplianceItems));
router.get('/compliance/delivery', asyncHandler(velora.getComplianceDelivery));
router.post('/compliance/delivery', validate(saveComplianceSchema), asyncHandler(velora.saveComplianceDelivery));

export default router;
