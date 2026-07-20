import crypto from 'node:crypto';

const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};
const rand = (bytes) => crypto.randomBytes(bytes).toString('hex').toUpperCase();

// Uppercase, strip anything that isn't a letter/digit (keeps codes URL-safe,
// since the audit code is used in `/api/{module}/…/:auditCode`).
const slug = (s) => String(s ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
const FLOOR_CODE = { GROUND: 'G', FIRST: '1', SECOND: '2', THIRD: '3' };

// Codes are generated server-side (never taken from the client) so users can't
// forge or collide identifiers.

/**
 * Villa report number — references the villa/property number so the code is
 * recognizable at a glance (e.g. `AUD-V12-A3F901`). Falls back to a date-based
 * code when no property number is given. A random suffix keeps it unique across
 * repeat inspections of the same villa.
 */
export const newAuditCode = (flatNumber) => {
  const flat = slug(flatNumber);
  return flat ? `AUD-${flat}-${rand(3)}` : `AUD-${stamp()}-${rand(3)}`;
};
export const newDraftCode = () => `DRAFT-${stamp()}-${rand(4)}`;
export const newStorageKey = (ext) => `${crypto.randomUUID()}.${ext}`;

/**
 * Workers Village report number — references the audited location so the code
 * is recognizable at a glance (e.g. `WV-S1-2-1-15-A3F901` = cluster S1, building
 * 2, first floor, room 15). Gym/recreation audits have no room, so they use the
 * type (`WV-GYM-…`). A random suffix keeps it unique even for repeat audits of
 * the same room. Falls back to `X` for any missing part.
 */
export const newWvAuditCode = (meta = {}) => {
  const suffix = rand(3);
  if (meta.auditType === 'gym' || meta.auditType === 'recreation') {
    return `WV-${slug(meta.auditType)}-${suffix}`;
  }
  const floor = FLOOR_CODE[slug(meta.floor)] || slug(meta.floor) || 'X';
  const parts = [slug(meta.cluster) || 'X', slug(meta.building) || 'X', floor, slug(meta.room) || 'X'];
  return `WV-${parts.join('-')}-${suffix}`;
};
export const newWvDraftCode = () => `WVDRAFT-${stamp()}-${rand(4)}`;

/**
 * Apartment report number — references the unit so the code is recognizable at
 * a glance (e.g. `APT-1203-A3F901`). Falls back to a date-based code when no
 * room/unit number is given. Random suffix keeps repeat inspections unique.
 */
export const newApartmentAuditCode = (roomNo) => {
  const unit = slug(roomNo);
  return unit ? `APT-${unit}-${rand(3)}` : `APT-${stamp()}-${rand(3)}`;
};
export const newApartmentDraftCode = () => `APTDRAFT-${stamp()}-${rand(4)}`;
