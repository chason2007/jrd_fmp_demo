import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { env, corsOrigins, trustProxy } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { ensureUploadDir } from './config/storage.js';
import authRoutes from './routes/authRoutes.js';
import villaRoutes from './routes/villaRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import veloraRoutes from './routes/veloraRoutes.js';
import wvRoutes from './routes/wvRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { startCleanupTask } from './utils/cleanup.js';
import { logger } from './utils/logger.js';
import { requestLogger } from './middleware/requestLogger.js';

const app = express();

app.use(requestLogger);

// Trust proxy hops per deployment (see TRUST_PROXY). Wrong values let clients
// spoof X-Forwarded-For and defeat IP-based rate limiting, so this is explicit.
app.set('trust proxy', trustProxy);

// Security headers. CSP is SPA-safe (this server also serves the built React app
// in production) while still forbidding external/inline scripts and framing.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Force HTTPS for 180 days once seen over TLS (prod only; harmless to omit in dev).
    strictTransportSecurity:
      env.NODE_ENV === 'production'
        ? { maxAge: 15552000, includeSubDomains: true }
        : false,
  }),
);

// Permissions-Policy isn't set by helmet's defaults. The app uses the camera for
// photo uploads, so allow only that (self-origin) and explicitly deny the rest.
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(), microphone=(), payment=(), usb=()');
  next();
});

// CORS allowlist. `credentials: true` is required so the browser sends/stores the
// refresh cookie. Origins not on the allowlist are rejected (no wildcard).
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || corsOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Confirm-Password'],
  }),
);

// Body parsing is applied PER-ROUTER (not globally) so each area gets an
// appropriate size cap: small for auth/admin/villa/wv, larger only for Velora
// (which embeds base64 images/PDFs). This limits the memory-DoS surface.
app.use(cookieParser());

// Liveness: the process is up (cheap, no dependencies).
app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

// Readiness: verifies the database is actually reachable. Point your uptime
// monitor here — a 503 means "up but can't serve requests" (e.g. DB down).
app.get('/api/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, data: { status: 'ready' } });
  } catch (err) {
    logger.error('Readiness check failed: database unreachable', err);
    res.status(503).json({ success: false, error: 'Service not ready' });
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/villa', villaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/velora', veloraRoutes);
app.use('/api/wv', wvRoutes);

// In production, serve the compiled React frontend IF it's present. In a
// same-origin deploy the build sits at ../frontend/dist and we serve it. In a
// cross-origin split (frontend hosted separately on Vercel), the build is absent
// and this backend stays API-only.
if (env.NODE_ENV === 'production') {
  const distPath = path.resolve(process.cwd(), '../frontend/dist');
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

app.use(notFound);
app.use(errorHandler);

ensureUploadDir();

prisma
  .$connect()
  .then(() => {
    startCleanupTask();
    const server = app.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`));

    // Cap how long a single request may take, so a slow/stalled client can't tie
    // up a connection indefinitely (slow-loris). Generous enough for large Velora
    // uploads on a poor field connection.
    server.requestTimeout = 120000; // 2 min for the whole request
    server.headersTimeout = 65000; // header slow-loris guard

    // Graceful shutdown: on SIGTERM/SIGINT (redeploy, Ctrl-C, systemd stop) stop
    // accepting new connections, let in-flight requests finish, then close the DB
    // pool cleanly. A hard timeout prevents hanging forever if a request stalls.
    let shuttingDown = false;
    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`${signal} received — shutting down gracefully…`);
      const forced = setTimeout(() => {
        logger.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 15000);
      forced.unref();
      server.close(async () => {
        try {
          await prisma.$disconnect();
        } catch (err) {
          logger.error('Error disconnecting Prisma during shutdown', err);
        }
        clearTimeout(forced);
        logger.info('Shutdown complete.');
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    logger.error('Failed to connect to the database', err);
    process.exit(1);
  });
