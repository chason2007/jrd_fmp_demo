import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

/**
 * Promise-based replacement for window.confirm(): `if (!(await confirm('...'))) return;`
 * Renders one shared in-app modal instead of the native browser dialog.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { message, confirmLabel, danger }
  const resolveRef = useRef(null);

  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message, confirmLabel: opts.confirmLabel || 'Delete', danger: opts.danger !== false });
    });
  }, []);

  const settle = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
  }, []);

  // Handle Escape key press to cancel dialog for accessibility
  useEffect(() => {
    if (!state) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') settle(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            if (e.target === e.currentTarget) settle(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') settle(false);
          }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            style={{
              background: 'var(--white)', borderRadius: 'var(--radius)', padding: '1.5rem', width: '100%', maxWidth: 380,
              boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--zinc-900)', lineHeight: 1.5 }}>{state.message}</p>
            <div style={{ display: 'flex', gap: '0.6rem', justifycontent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                autoFocus
                onClick={() => settle(false)}
                style={{
                  padding: '0.55rem 1.1rem', borderRadius: 'var(--radius)', border: '1.5px solid var(--zinc-200)',
                  background: 'var(--white)', color: 'var(--zinc-900)', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => settle(true)}
                style={{
                  padding: '0.55rem 1.1rem', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', fontWeight: 600,
                  background: state.danger ? 'var(--danger)' : 'var(--primary)', color: state.danger ? '#fff' : 'var(--on-primary)',
                }}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
