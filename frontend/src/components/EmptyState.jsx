/**
 * A more inviting "nothing here yet" state than flat text — used across
 * Villa/WV/Velora's Drafts and Reports lists. Each module passes its own
 * button className so the CTA matches that module's look.
 */
export default function EmptyState({ title, message, ctaLabel, onCta, buttonClassName = 'btn-primary' }) {
  return (
    <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem' }}>{title}</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--gray, #71717a)', marginBottom: ctaLabel ? '1.1rem' : 0 }}>
        {message}
      </div>
      {ctaLabel && onCta && (
        <button className={buttonClassName} onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
