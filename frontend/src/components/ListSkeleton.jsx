/**
 * Shimmer placeholder for a list that's still loading — used in the Drafts /
 * Reports lists across modules instead of a bare "Loading…" line. Mirrors the
 * shape of a list row (title + subtitle on the left, an action button on the
 * right) so the layout doesn't jump when real data arrives. Purely decorative,
 * so it's hidden from assistive tech. Uses the global `.skeleton` classes.
 */
export default function ListSkeleton({ rows = 3 }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            borderBottom: '1px solid var(--zinc-100)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="skeleton skeleton-line" style={{ width: '45%', maxWidth: 220 }} />
            <div className="skeleton skeleton-line" style={{ width: '70%', maxWidth: 340, marginBottom: 0 }} />
          </div>
          <div className="skeleton" style={{ width: 72, height: 28, borderRadius: 'var(--radius)', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}
