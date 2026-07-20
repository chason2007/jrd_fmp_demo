/**
 * Canonical audit module list. Keys MUST match the backend allow-list
 * (backend/src/validation/adminSchemas.js MODULE_KEYS) and the module keys
 * used in routing / API paths (/api/villa, /api/apartment, /api/wv, /api/velora).
 */
export const MODULES = [
  { key: 'villa', label: 'Snag Audit', path: '/villa' },
  { key: 'apartment', label: 'Apartment Audit', path: '/apartment' },
  { key: 'wv', label: 'Workers Village', path: '/wv' },
  { key: 'velora', label: 'Velora', path: '/velora' },
];

/**
 * Can this user open the given module? A SUPERADMIN is never gated by
 * enabledModules — they don't use these modules at all (every module page
 * redirects a SUPERADMIN straight to /admin), so the check only matters for
 * ADMIN/AUDITOR accounts.
 */
export function canAccessModule(user, moduleKey) {
  if (!user) return false;
  if (user.role === 'SUPERADMIN') return true;
  return Array.isArray(user.enabledModules) && user.enabledModules.includes(moduleKey);
}
