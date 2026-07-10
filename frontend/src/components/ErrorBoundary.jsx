import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--zinc-900)',
          color: 'var(--zinc-50)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '500px',
            backgroundColor: 'var(--zinc-800)',
            padding: '2.5rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--zinc-700)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem',
              color: 'var(--danger)'
            }}>⚠️</div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '0.75rem',
              color: 'var(--zinc-50)'
            }}>Something went wrong</h1>
            <p style={{
              fontSize: '0.9rem',
              color: 'var(--zinc-400)',
              lineHeight: '1.5',
              marginBottom: '2rem'
            }}>
              An unexpected error occurred in the application. Any active unsaved work has been secured where possible.
            </p>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--on-primary)',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = 'var(--primary-dark)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'var(--primary)'}
                onFocus={(e) => e.target.style.backgroundColor = 'var(--primary-dark)'}
                onBlur={(e) => e.target.style.backgroundColor = 'var(--primary)'}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  backgroundColor: 'var(--zinc-600)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = 'var(--zinc-700)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'var(--zinc-600)'}
                onFocus={(e) => e.target.style.backgroundColor = 'var(--zinc-700)'}
                onBlur={(e) => e.target.style.backgroundColor = 'var(--zinc-600)'}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
