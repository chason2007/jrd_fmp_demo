import { timeAgo } from '../lib/timeAgo.js';

/**
 * Save-state indicator for a useAutosave() result. A clear color-coded pill (not
 * quiet text) so a field auditor can tell at a glance whether their work is safe
 * — the 'error' and 'offline' states are deliberately prominent. No toasts, no
 * interruptions.
 */

// Small inline icons (no external dep) so this works in every module.
function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
  );
}
function AlertIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
function CloudOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m2 2 20 20" /><path d="M5.8 5.8A6 6 0 0 0 9 17h9a4 4 0 0 0 1.9-.5" />
      <path d="M14.5 7A6 6 0 0 1 20 12" />
    </svg>
  );
}

export default function AutosaveStatus({ autosave }) {
  const { status, lastSavedAt } = autosave;
  if (status === 'idle') return null;

  const styles = {
    saving: { bg: 'var(--zinc-100)', fg: 'var(--zinc-600)', border: 'var(--zinc-200)', icon: <SpinnerIcon />, label: 'Saving…' },
    saved: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)', border: 'var(--ok-border)', icon: <CheckIcon />, label: `Saved ${timeAgo(lastSavedAt)}` },
    offline: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)', border: 'var(--warn-border)', icon: <CloudOffIcon />, label: 'Offline — saved on this device' },
    error: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', border: 'var(--danger-border)', icon: <AlertIcon />, label: "Couldn't save — will retry" },
  };
  const s = styles[status] || styles.saving;

  const title =
    status === 'error'
      ? 'The server save failed. Your work is kept on this device and will retry automatically.'
      : status === 'offline'
      ? 'No connection. Your work is saved locally and will sync when you are back online.'
      : status === 'saved' && lastSavedAt
      ? `Last saved at ${lastSavedAt.toLocaleTimeString()}`
      : undefined;

  return (
    <span
      role="status"
      aria-live="polite"
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.6rem',
        borderRadius: '4px', backgroundColor: s.bg, color: s.fg,
        border: `1px solid ${s.border}`, whiteSpace: 'nowrap', transition: 'all 0.2s ease',
      }}
    >
      {s.icon}
      {s.label}
    </span>
  );
}
