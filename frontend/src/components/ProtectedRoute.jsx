import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { canAccessModule } from '../lib/modules.js';

/**
 * Gate that renders children only for an authenticated user. Pass `module` to
 * additionally require that module be enabled for this user (superadmin-set;
 * see AdminPortal) — an AUDITOR/ADMIN without it is bounced to the Dashboard
 * instead of reaching the page, so hiding a Dashboard tile can't be bypassed
 * by typing the URL directly.
 */
export default function ProtectedRoute({ children, module }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-overlay">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (module && !canAccessModule(user, module)) return <Navigate to="/" replace />;
  return children;
}
