import 'dotenv/config';
import { z } from 'zod';

/**
 * Validate environment configuration at boot. The server refuses to start with
 * missing/weak secrets rather than running in an insecure state.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  DEFAULT_ADMIN_USER: z.string().default('admin'),
  DEFAULT_ADMIN_PASS: z.string().optional(),
  CORS_ORIGINS: z.string().default(''),
  COOKIE_DOMAIN: z.string().default('localhost'),
  // Refresh-cookie SameSite policy. Keep "strict" when the frontend and API are
  // same-origin. Set "none" for a CROSS-ORIGIN split (frontend on Vercel, API on
  // Render) so the browser will actually send the cookie — "none" requires HTTPS
  // (Secure), which production already enforces.
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  UPLOAD_DIR: z.string().default('storage/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(8),
  // How many proxy hops to trust for req.ip. MUST match your deployment (e.g. 1
  // behind a single reverse proxy). "false" when the app is exposed directly, so
  // X-Forwarded-For can't be spoofed to defeat IP rate-limiting.
  TRUST_PROXY: z.string().default('false'),
  // Optional: when set, rate-limit counters are stored in Redis so limits hold
  // across multiple processes/instances. Unset → in-memory (single-node only).
  REDIS_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

// "false"/"true"/<number-of-hops> → Express trust-proxy value.
export const trustProxy = (() => {
  const v = env.TRUST_PROXY;
  if (v === 'false') return false;
  if (v === 'true') return true;
  const n = Number(v);
  return Number.isFinite(n) ? n : false;
})();
