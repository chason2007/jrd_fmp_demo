import { verifyAccessToken } from '../lib/tokens.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Require a valid access token. Verifies the JWT, then confirms the user still
 * exists and is active (so an admin disabling an account takes effect within one
 * access-token lifetime). Attaches req.user = { id, username, role }.
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(\S+)$/);
  if (!match) throw new HttpError(401, 'Authentication required.');

  let payload;
  try {
    payload = verifyAccessToken(match[1]);
  } catch {
    throw new HttpError(401, 'Invalid or expired token.');
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, username: true, role: true, isActive: true, enabledModules: true },
  });
  if (!user || !user.isActive) throw new HttpError(401, 'Account is not active.');

  req.user = { id: user.id, username: user.username, role: user.role, enabledModules: user.enabledModules };
  next();
});

/** Require one of the given roles. Use after requireAuth. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You do not have permission to perform this action.'));
  }
  next();
};

/**
 * Require the caller to have a specific audit module enabled. Use after
 * requireRole('ADMIN', 'AUDITOR') on a module's routes (villa/apartment/wv/velora)
 * — re-checked from the DB on every request via requireAuth, so a superadmin
 * revoking a module takes effect on the user's very next API call, no waiting
 * for a token refresh. SUPERADMIN never reaches these routes (requireRole
 * excludes it), so no bypass is needed here.
 */
export const requireModule = (moduleKey) => (req, res, next) => {
  if (!req.user?.enabledModules?.includes(moduleKey)) {
    return next(new HttpError(403, 'You do not have access to this module.'));
  }
  next();
};
