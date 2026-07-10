import axios from 'axios';

// Same-origin in dev (Vite proxies /api). Override with VITE_API_URL if needed.
const BASE = import.meta.env.VITE_API_URL ?? '';

// The access token lives in memory only — never localStorage — to limit XSS theft.
let accessToken = null;
let onLogout = () => {};

export const setAccessToken = (t) => { accessToken = t; };
export const setOnLogout = (fn) => { onLogout = fn; };

export const api = axios.create({ baseURL: BASE, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// On a 401 (expired access token), try once to refresh via the httpOnly cookie,
// then replay the original request. If refresh fails, log the user out.
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post('/api/auth/refresh');
        const { data } = await refreshing;
        refreshing = null;
        setAccessToken(data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        onLogout();
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  },
);

/** Pull a safe, human-friendly message out of an axios error. */
export function errorMessage(err, fallback = 'Something went wrong') {
  const serverError = err?.response?.data?.error;
  if (serverError) {
    if (typeof serverError === 'string') return serverError;
    if (typeof serverError === 'object') {
      return serverError.message || serverError.code || JSON.stringify(serverError);
    }
  }

  const data = err?.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      if (data.message && typeof data.message === 'string') return data.message;
      if (data.error && typeof data.error === 'string') return data.error;
    }
  }

  if (err?.message && typeof err.message === 'string') return err.message;
  return fallback;
}
