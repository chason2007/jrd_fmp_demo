import { prisma } from './prisma.js';
import { HttpError } from '../utils/httpError.js';

// DB-backed brute-force guard. Counts *failed* attempts in a rolling window,
// both per-account and per-IP, so it works across multiple server instances.
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_ACCOUNT = 5;
const MAX_PER_IP = 15;

/** Throw 429 if this username or IP has too many recent failed attempts. */
export async function assertLoginAllowed({ username, ip }) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byAccount, byIp] = await Promise.all([
    username
      ? prisma.loginAttempt.count({ where: { username, success: false, createdAt: { gt: since } } })
      : Promise.resolve(0),
    prisma.loginAttempt.count({ where: { ipAddress: ip, success: false, createdAt: { gt: since } } }),
  ]);
  if (byAccount >= MAX_PER_ACCOUNT || byIp >= MAX_PER_IP) {
    throw new HttpError(429, 'Too many failed login attempts. Please try again in a few minutes.');
  }
}

export async function recordLoginAttempt({ username, ip, success }) {
  await prisma.loginAttempt.create({ data: { username: username ?? null, ipAddress: ip, success } });
}

/** Clear failure rows for this account/IP after a successful login. */
export async function clearLoginFailures({ username, ip }) {
  if (username) {
    await prisma.loginAttempt.deleteMany({ where: { username, success: false } });
  }
}
