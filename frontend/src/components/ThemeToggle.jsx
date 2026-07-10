import { useState } from 'react';
import { getEffectiveTheme, setTheme } from '../lib/theme.js';

/** Sun/moon button that flips between light and dark and remembers the choice. */
export default function ThemeToggle() {
  const [theme, setLocal] = useState(getEffectiveTheme());
  const next = theme === 'dark' ? 'light' : 'dark';

  const toggle = () => {
    setTheme(next);
    setLocal(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-secondary"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      style={{ padding: '0.4rem', width: 34, height: 34, flexShrink: 0 }}
    >
      {theme === 'dark' ? (
        // Sun
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        </svg>
      )}
    </button>
  );
}
