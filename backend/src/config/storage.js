import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

// Absolute upload directory, resolved from the backend's working directory.
export const UPLOAD_DIR = path.resolve(process.cwd(), env.UPLOAD_DIR);
export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Resolve a storage key to an absolute path, refusing anything that escapes
 * UPLOAD_DIR (defence-in-depth against path traversal, even though keys are
 * server-generated UUIDs). Returns null if the key is not a direct child.
 */
export function resolveStoragePath(storageKey) {
  const full = path.resolve(UPLOAD_DIR, storageKey);
  if (path.dirname(full) !== UPLOAD_DIR) return null;
  return full;
}
