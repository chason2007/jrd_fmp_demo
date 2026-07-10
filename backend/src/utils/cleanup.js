import fs from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { resolveStoragePath } from '../config/storage.js';
import { logger } from './logger.js';

/**
 * Searches for and deletes orphaned photos.
 * An orphaned photo is defined as:
 * - Has no associated issue (`issueId: null`).
 * - Was uploaded more than 24 hours ago.
 * - Is NOT referenced by any active audit draft (`issues_data`).
 */
export async function runOrphanedPhotosCleanup() {
  logger.info('[CLEANUP] Starting orphaned photos garbage collection...');
  try {
    // 1. Gather all photo IDs currently referenced in active drafts.
    const activePhotoIds = new Set();

    // Villa drafts store issues as an array: [{ photoIds: [...] }, ...]
    const villaDrafts = await prisma.auditDraft.findMany({ select: { issuesData: true } });
    for (const d of villaDrafts) {
      const issues = Array.isArray(d.issuesData) ? d.issuesData : [];
      for (const iss of issues) {
        if (iss && Array.isArray(iss.photoIds)) {
          for (const pid of iss.photoIds) if (typeof pid === 'number') activePhotoIds.add(pid);
        }
      }
    }

    // WV drafts store responses keyed by item: { [item]: { photoIds: [...] } }
    const wvDrafts = await prisma.wvAuditDraft.findMany({ select: { responses: true } });
    for (const d of wvDrafts) {
      const responses = d.responses && typeof d.responses === 'object' ? d.responses : {};
      for (const item of Object.values(responses)) {
        if (item && Array.isArray(item.photoIds)) {
          for (const pid of item.photoIds) if (typeof pid === 'number') activePhotoIds.add(pid);
        }
      }
    }

    // 2. Only PENDING photos are eligible — a photo committed to a Villa issue
    //    (issueId) OR a WV audit (wvAuditId) must never be collected. Older than
    //    24h and not referenced by any active draft.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphanedPhotos = await prisma.photo.findMany({
      where: {
        issueId: null,
        wvAuditId: null,
        createdAt: { lt: cutoff },
        ...(activePhotoIds.size > 0 ? { id: { notIn: Array.from(activePhotoIds) } } : {}),
      },
      select: { id: true, storageKey: true },
    });

    if (orphanedPhotos.length === 0) {
      logger.info('[CLEANUP] No orphaned photos found.');
      return;
    }

    logger.info(`[CLEANUP] Found ${orphanedPhotos.length} orphaned photo(s) to remove.`);

    // 3. Delete DB records and best-effort unlink files
    const deleteIds = orphanedPhotos.map((p) => p.id);
    await prisma.photo.deleteMany({
      where: { id: { in: deleteIds } },
    });

    for (const p of orphanedPhotos) {
      const fp = resolveStoragePath(p.storageKey);
      if (fp) {
        fs.promises.unlink(fp).catch((err) => {
          logger.error(`[CLEANUP] Failed to unlink orphaned file ${fp}`, err);
        });
      }
    }

    logger.info(`[CLEANUP] Successfully pruned ${orphanedPhotos.length} orphaned photo(s).`);
  } catch (err) {
    logger.error('[CLEANUP] Error occurred during orphaned photos cleanup', err);
  }
}

/**
 * Run cleanup immediately on startup and schedule it periodically.
 */
export function startCleanupTask(intervalMs = 6 * 60 * 60 * 1000) {
  // Run on startup best effort
  setTimeout(() => {
    runOrphanedPhotosCleanup().catch(err => {
      logger.error('[CLEANUP] Startup run failed', err);
    });
  }, 5000);

  // Periodic interval
  setInterval(() => {
    runOrphanedPhotosCleanup().catch(err => {
      logger.error('[CLEANUP] Periodic run failed', err);
    });
  }, intervalMs);
}
