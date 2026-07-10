import argon2 from 'argon2';
import { prisma } from '../lib/prisma.js';
import {
  signAccessToken,
  newRefreshToken,
  hashToken,
  refreshExpiry,
  newFamilyId,
} from '../lib/tokens.js';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } from '../utils/cookies.js';
import { assertLoginAllowed, recordLoginAttempt, clearLoginFailures } from '../lib/loginGuard.js';
import { writeAudit } from '../lib/audit.js';
import { HttpError } from '../utils/httpError.js';

// A real Argon2id hash we verify against when the username doesn't exist, so the
// response time is the same whether or not the account exists (anti user-enumeration).
const DUMMY_HASH = await argon2.hash('argon2id-timing-equalizer-placeholder');

const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role });
const trimUA = (req) => (req.headers['user-agent'] || '').slice(0, 255);

/** POST /api/auth/login */
export async function login(req, res) {
  const { username, password } = req.body;
  const ip = req.ip;

  await assertLoginAllowed({ username, ip });

  const user = await prisma.user.findUnique({ where: { username } });

  // Always perform a verify to keep timing uniform across existing/non-existing users.
  let passwordOk = false;
  if (user) {
    passwordOk = await argon2.verify(user.passwordHash, password);
  } else {
    await argon2.verify(DUMMY_HASH, password);
  }

  if (!user || !passwordOk || !user.isActive) {
    await recordLoginAttempt({ username, ip, success: false });
    await writeAudit({ userId: user?.id ?? null, action: 'LOGIN_FAILED', ip, metadata: { username } });
    throw new HttpError(401, 'Invalid username or password.');
  }

  // Success: reset the failure counter and open a new refresh-token family.
  await clearLoginFailures({ username, ip });
  await recordLoginAttempt({ username, ip, success: true });

  const familyId = newFamilyId();
  const { raw, hash } = newRefreshToken();
  const expiresAt = refreshExpiry();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hash, familyId, expiresAt, createdByIp: ip, userAgent: trimUA(req) },
  });

  setRefreshCookie(res, raw, expiresAt);
  await writeAudit({ userId: user.id, action: 'LOGIN_SUCCESS', ip });

  res.json({ success: true, data: { accessToken: signAccessToken(user), user: publicUser(user) } });
}

/** POST /api/auth/refresh — single-use rotation with reuse detection. */
export async function refresh(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) throw new HttpError(401, 'Session expired. Please sign in again.');

  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!existing) {
    clearRefreshCookie(res);
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }

  // Reuse detection: a token that was already rotated out (revoked) is being
  // replayed → likely theft. Kill the entire family and force re-login.
  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(res);
    await writeAudit({
      userId: existing.userId,
      action: 'REFRESH_REUSE_DETECTED',
      ip: req.ip,
      metadata: { familyId: existing.familyId },
    });
    throw new HttpError(401, 'Session is no longer valid. Please sign in again.');
  }

  if (existing.expiresAt <= new Date()) {
    clearRefreshCookie(res);
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: existing.userId } });
  if (!user || !user.isActive) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(res);
    throw new HttpError(401, 'Account is not active.');
  }

  // Rotate. The conditional revoke (revokedAt: null) is atomic at the DB row
  // level, so if two requests present the same token concurrently only ONE
  // revoke succeeds; the loser falls into the reuse branch below.
  const { raw: newRaw, hash: newHash } = newRefreshToken();
  const expiresAt = refreshExpiry();

  const revoked = await prisma.refreshToken.updateMany({
    where: { id: existing.id, revokedAt: null },
    data: { revokedAt: new Date(), replacedBy: newHash },
  });

  if (revoked.count !== 1) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(res);
    await writeAudit({
      userId: existing.userId,
      action: 'REFRESH_REUSE_DETECTED',
      ip: req.ip,
      metadata: { familyId: existing.familyId, reason: 'rotation_race' },
    });
    throw new HttpError(401, 'Session is no longer valid. Please sign in again.');
  }

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: newHash,
      familyId: existing.familyId,
      expiresAt,
      createdByIp: req.ip,
      userAgent: trimUA(req),
    },
  });

  setRefreshCookie(res, newRaw, expiresAt);
  res.json({ success: true, data: { accessToken: signAccessToken(user), user: publicUser(user) } });
}

/** POST /api/auth/logout — revoke the current session's whole family. Best-effort. */
export async function logout(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) {
    const token = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { familyId: token.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit({ userId: token.userId, action: 'LOGOUT', ip: req.ip });
    }
  }
  clearRefreshCookie(res);
  res.json({ success: true, data: { message: 'Logged out.' } });
}

/** POST /api/auth/request-reset */
export async function requestPasswordReset(req, res) {
  const { username } = req.body;
  if (!username) {
    throw new HttpError(400, 'Username is required.');
  }

  const genericMessage = 'If the username exists, a reset request has been logged for admins to review.';

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    // Generic response to prevent username enumeration.
    return res.json({ success: true, data: { message: genericMessage } });
  }

  // Dedupe: only one open PENDING request per user (avoids row-spam / queue flooding).
  const existingPending = await prisma.passwordResetRequest.findFirst({
    where: { userId: user.id, status: 'PENDING' },
  });
  if (!existingPending) {
    await prisma.passwordResetRequest.create({ data: { userId: user.id, status: 'PENDING' } });
    await writeAudit({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', ip: req.ip });
  }

  res.json({ success: true, data: { message: genericMessage } });
}

/** GET /api/auth/me — current user/role (requires a valid access token). */
export async function me(req, res) {
  res.json({ success: true, data: { user: req.user } });
}
