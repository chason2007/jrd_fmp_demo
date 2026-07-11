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
    // If a refresh ever fails mid-session, drop the user.
    setOnLogout(() => {
      setAccessToken(null);
      setUser(null);
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
