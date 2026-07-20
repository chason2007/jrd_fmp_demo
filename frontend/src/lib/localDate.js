/**
 * Today's date as YYYY-MM-DD in the DEVICE's local timezone, for pre-filling
 * `<input type="date">` fields.
 *
 * `new Date().toISOString().split('T')[0]` (used for this all over the app)
 * is wrong here: toISOString() converts to UTC first, so anyone in a positive
 * UTC offset (e.g. UAE, +04:00) who opens the app between midnight and their
 * offset-hours-past-midnight gets YESTERDAY's date pre-filled.
 */
export function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * A stored date/timestamp as YYYY-MM-DD in the device's local timezone, for
 * populating a date input when resuming a draft (e.g. `new Date(saved).toISOString()...`
 * has the same UTC-shift bug as todayLocal above).
 */
export function toLocalDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
