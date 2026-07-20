import express, { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateParams } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createUserSchema,
  updateStatusSchema,
  updateUserSchema,
  updateRoleSchema,
  updateModulesSchema,
  resetPasswordSchema,
  idParam,
  moduleParam,
} from '../validation/adminSchemas.js';
import { mutationRateLimiter } from '../middleware/rateLimit.js';
import * as admin from '../controllers/adminController.js';

const router = Router();
router.use(express.json({ limit: '1mb' }));

// ALL admin routes require authentication
router.use(requireAuth);
router.use(mutationRateLimiter); // per-user cap on writes (skips GETs)

// User Management & Resets (SUPERADMIN and ADMIN)
router.get('/users', requireRole('SUPERADMIN', 'ADMIN'), asyncHandler(admin.getUsers));
router.post('/users', requireRole('SUPERADMIN', 'ADMIN'), validate(createUserSchema), asyncHandler(admin.createUser));
router.put('/users/:id', requireRole('SUPERADMIN', 'ADMIN'), validateParams(idParam), validate(updateUserSchema), asyncHandler(admin.updateUser));
router.put('/users/:id/status', requireRole('SUPERADMIN', 'ADMIN'), validateParams(idParam), validate(updateStatusSchema), asyncHandler(admin.toggleUserStatus));
router.delete('/users/:id', requireRole('SUPERADMIN', 'ADMIN'), validateParams(idParam), asyncHandler(admin.deleteUser));
router.get('/resets', requireRole('SUPERADMIN'), asyncHandler(admin.getResetRequests));
router.post('/resets/:id/approve', requireRole('SUPERADMIN'), validateParams(idParam), asyncHandler(admin.approveResetRequest));
router.put('/users/:id/role', requireRole('SUPERADMIN', 'ADMIN'), validateParams(idParam), validate(updateRoleSchema), asyncHandler(admin.updateUserRole));
router.put('/users/:id/modules', requireRole('SUPERADMIN'), validateParams(idParam), validate(updateModulesSchema), asyncHandler(admin.updateUserModules));
router.put('/users/:id/password', requireRole('SUPERADMIN'), validateParams(idParam), validate(resetPasswordSchema), asyncHandler(admin.resetUserPassword));

// Global Audits / Inspection Management (ADMIN only)
router.get('/audits', requireRole('ADMIN'), asyncHandler(admin.getAudits));
router.delete('/velora-audits/:id', requireRole('ADMIN'), validateParams(idParam), asyncHandler(admin.deleteVeloraAudit));
router.delete('/service-reports/:id', requireRole('ADMIN'), validateParams(idParam), asyncHandler(admin.deleteVeloraServiceReport));
router.delete('/compliance-deliveries/:id', requireRole('ADMIN'), validateParams(idParam), asyncHandler(admin.deleteVeloraComplianceDelivery));

// Database Maintenance (SUPERADMIN only)
router.delete('/maintenance/users', requireRole('SUPERADMIN'), asyncHandler(admin.purgeAllUsers));
router.delete('/maintenance/all-records', requireRole('SUPERADMIN'), asyncHandler(admin.purgeAllRecords));
router.delete('/maintenance/module/:moduleName', requireRole('SUPERADMIN'), validateParams(moduleParam), asyncHandler(admin.purgeModuleRecords));

export default router;
