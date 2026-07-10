import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Rate-limit counter storage.
 *
 * Default (REDIS_URL unset) is express-rate-limit's in-process MemoryStore — fine
 * for a single node, but counters are PER-PROCESS and reset on restart. When the
 * app is scaled horizontally (PM2 cluster, multiple containers), set REDIS_URL so
 * all instances share one counter. The Redis packages are imported dynamically,
 * so they're only required when REDIS_URL is actually set.
 */
async function connectRedis() {
  if (!env.REDIS_URL) return null;
  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: env.REDIS_URL });
    client.on('error', (e) => logger.error('Rate-limit Redis error', e));
    await client.connect();
    logger.info('Rate limiting backed by Redis (shared across instances).');
    return client;
  } catch (err) {
    logger.error(
      'REDIS_URL is set but Redis could not be initialised — falling back to in-memory ' +
        'rate limiting. Run `npm i redis rate-limit-redis` and check the URL.',
      err,
    );
    return null;
  }
}

const redisClient = await connectRedis();
const { RedisStore } = redisClient ? await import('rate-limit-redis') : {};

/**
 * Merge a fresh RedisStore (with a per-limiter prefix so counters don't collide)
 * into the options when Redis is active; otherwise leave options untouched so the
 * built-in MemoryStore is used.
 */
const withStore = (opts, prefix) =>
  redisClient && RedisStore
    ? { ...opts, store: new RedisStore({ prefix, sendCommand: (...args) => redisClient.sendCommand(args) }) }
    : opts;

/**
 * Coarse per-IP safety net in front of the DB-backed per-account guard
 * (lib/loginGuard.js). Catches floods before they hit the database.
 */
export const loginRateLimiter = rateLimit(
  withStore(
    {
      windowMs: 10 * 60 * 1000, // 10 minutes
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many requests. Please try again later.' },
    },
    'rl:login:',
  ),
);

/**
 * Password-reset requests are unauthenticated and write to the DB, so cap them
 * per IP to prevent flooding the reset queue / row spam.
 */
export const passwordResetRateLimiter = rateLimit(
  withStore(
    {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many reset requests. Please try again later.' },
    },
    'rl:reset:',
  ),
);

/**
 * Per-user cap on authenticated writes (create/update/delete audits, drafts,
 * photo uploads). Without this, a single logged-in — or compromised — account can
 * flood the DB and disk with no ceiling. GETs are exempt so reads/listing stay
 * snappy. Keyed by user id — these routes all sit behind requireAuth, so req.user
 * is always populated (the 'anon' bucket is defensive and effectively unreachable).
 * Apply AFTER requireAuth.
 */
export const mutationRateLimiter = rateLimit(
  withStore(
    {
      windowMs: 60 * 1000, // 1 minute
      max: 120, // generous enough for autosave + burst photo uploads, low enough to stop floods
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.method === 'GET',
      keyGenerator: (req) => `u:${req.user?.id ?? 'anon'}`,
      message: { success: false, error: 'Too many requests. Please slow down and try again shortly.' },
    },
    'rl:mutation:',
  ),
);
