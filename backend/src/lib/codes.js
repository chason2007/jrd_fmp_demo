import crypto from 'node:crypto';

const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};
const rand = (bytes) => crypto.randomBytes(bytes).toString('hex').toUpperCase();

// Codes are generated server-side (never taken from the client) so users can't
// forge or collide identifiers.
export const newAuditCode = () => `AUD-${stamp()}-${rand(3)}`;
export const newDraftCode = () => `DRAFT-${stamp()}-${rand(4)}`;
export const newStorageKey = (ext) => `${crypto.randomUUID()}.${ext}`;
export const newWvAuditCode = () => `WV-${stamp()}-${rand(3)}`;
export const newWvDraftCode = () => `WVDRAFT-${stamp()}-${rand(4)}`;
