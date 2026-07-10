import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

/** Short-lived access JWT. Carries the user id (sub), role and username only. */
export function signAccessToken(user) {
  return jwt.sign(
    { role: user.role, username: user.username },
    env.JWT_ACCESS_SECRET,
    { subject: String(user.id), expiresIn: env.ACCESS_TOKEN_TTL, jwtid: crypto.randomUUID() },
  );
}

/** Verify an access JWT. Pins the algorithm (no "alg" confusion). Throws on invalid/expired. */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
}

/** SHA-256 hex of an opaque token (what we store; never the raw value). */
export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** A new opaque refresh token: the raw value (sent to client) + its hash (stored). */
export function newRefreshToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashToken(raw) };
}

/** New rotation-family id (groups all tokens descended from one login). */
export function newFamilyId() {
  return crypto.randomUUID();
}

/** Absolute expiry for a freshly issued refresh token. */
export function refreshExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
