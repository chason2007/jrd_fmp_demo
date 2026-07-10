import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api, errorMessage } from '../api/client.js';

// Faithful recreation of the legacy login overlay (App.html): centered white box,
// logo + title, Username/Password fields, inline error, full-width "Sign In".
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);

  if (user) return <Navigate to="/" replace />;

  // Mirror the backend Zod rules for instant feedback (server still re-validates).
  function clientValidate() {
    const u = username.trim();
    if (!u) return 'Username is required';
    if (u.length > 100) return 'Username is too long';
    if (!password) return 'Password is required';
    if (password.length > 200) return 'Password is too long';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = clientValidate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setResetMessage('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Sign in failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestReset() {
    const u = username.trim();
    if (!u) {
      setError('Please enter your username above to request a password reset.');
      return;
    }
    setError('');
    setResetMessage('');
    setRequestingReset(true);
    try {
      const res = await api.post('/api/auth/request-reset', { username: u });
      setResetMessage(res.data.data?.message || 'Password reset request submitted successfully.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit reset request.'));
    } finally {
      setRequestingReset(false);
    }
  }

  return (
    <div className="login-overlay">
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/logo.png" alt="JR Dream Logo" style={{ width: '100px', height: '100px', objectFit: 'contain', margin: '0 auto 1rem', display: 'block' }} />
          <h2 style={{ color: 'var(--primary)', fontSize: '1.1rem', lineHeight: 1.3 }}>FACILITIES MANAGEMENT PORTAL</h2>
          <p style={{ color: 'var(--gray)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Sign in to continue
          </p>
        </div>

        {/* A <form> gives Enter-to-submit for free, matching the legacy onkeydown. */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text"
            className="login-input"
            placeholder="Username"
            autoComplete="username"
            maxLength={100}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="login-input"
            placeholder="Password"
            autoComplete="current-password"
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            style={{ width: '100%', justifyContent: 'center', borderRadius: 'var(--radius)', padding: '0.75rem' }}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-text"
              style={{
                fontSize: '0.8rem',
                color: 'var(--primary)',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
                textDecoration: 'underline'
              }}
              onClick={handleRequestReset}
              disabled={requestingReset}
            >
              {requestingReset ? 'Submitting request...' : 'Forgot Password? Request Reset'}
            </button>
          </div>

          {resetMessage && (
            <div style={{
              color: 'var(--ok-fg)',
              backgroundColor: 'var(--ok-bg)',
              border: '1px solid var(--ok-border)',
              padding: '0.5rem',
              borderRadius: 'var(--radius)',
              fontSize: '0.75rem',
              marginTop: '0.5rem',
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {resetMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
