import { env } from '../config/env.js';

export const REFRESH_COOKIE = 'refresh_token';

// The refresh cookie is HttpOnly (JS can't read it), Secure in production
// (HTTPS only), and Path-scoped to /api/auth so it's only attached to auth
// endpoints. SameSite defaults to Strict (CSRF-safe); a cross-origin split
// (frontend + API on different domains) must set COOKIE_SAMESITE=none, which the
// browser only honours over HTTPS. Note "none" needs Secure, so it only takes
// effect in production.
const baseOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth',
  domain: env.COOKIE_DOMAIN || undefined,
});

export function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions(), expires: expiresAt });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}
