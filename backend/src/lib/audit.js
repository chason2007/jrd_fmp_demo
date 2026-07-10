import { prisma } from './prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Append a security-audit event. Best-effort: a logging failure must never break
 * the request it is describing, so errors are swallowed (and console-logged).
 * Never put secrets (passwords, tokens) in `metadata`.
 */
export async function writeAudit({ userId = null, action, entityType = null, entityId = null, ip = null, metadata = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        ipAddress: ip,
        metadata: metadata ?? undefined,
      },
    });
  } catch (err) {
    logger.error('[audit] failed to write audit log', err);
  }
}
