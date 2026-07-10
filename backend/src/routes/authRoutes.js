import express, { Router } from 'express';
import { login, refresh, logout, me, requestPasswordReset } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validation/authSchemas.js';
import { loginRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(express.json({ limit: '1mb' }));

router.post('/login', loginRateLimiter, validate(loginSchema), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.post('/request-reset', passwordResetRateLimiter, asyncHandler(requestPasswordReset));
router.get('/me', requireAuth, asyncHandler(me));

export default router;
