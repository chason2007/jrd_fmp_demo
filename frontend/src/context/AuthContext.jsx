import { createContext, useContext, useEffect, useState } from 'react';
import { api, setAccessToken, setOnLogout } from '../api/client.js';
import { clearAllPhotos } from '../utils/localPhotoStore.js';

const AuthContext = createContext(null);

// Offline draft backups (may contain audit data / photos). Cleared on logout so
// nothing sensitive is left in localStorage on a shared/kiosk device.
const OFFLINE_DRAFT_KEYS = [
  'villa_inspection_offline_draft',
  'wv_inspection_offline_draft',
  'velora_inspection_offline_draft',
];

function clearOfflineDrafts() {
  for (const key of OFFLINE_DRAFT_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  try {
    clearAllPhotos().catch(console.error);
  } catch (e) {
    console.error('Failed to clear local photos on logout:', e);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fires when ANY API call gets a 401 and the refresh-cookie retry also
    // fails (dead/expired session, revoked account, etc.) — from any page.
    // A hard redirect (not just clearing `user` and trusting ProtectedRoute's
    // re-render) guarantees the bounce to /login happens immediately, even if
    // other in-flight requests on the dying page would otherwise surface a
    // confusing error toast a beat before the SPA-level redirect caught up.
    setOnLogout(() => {
      setAccessToken(null);
      setUser(null);
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    });

    // On first load, try to restore the session from the refresh cookie.
    (async () => {
      try {
        const { data } = await api.post('/api/auth/refresh');
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
      } catch {
        // Not logged in — expected on a fresh visit.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/api/auth/login', { username, password });
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* best-effort */
    }
    clearOfflineDrafts();
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
