// Theme persistence. The user's explicit choice ('dark'/'light') is stored and
// reflected as data-theme on <html>. With no stored choice we remove the
// attribute and let the OS preference drive it (see the prefers-color-scheme
// block in index.css).
const KEY = 'theme';

/** Apply the stored choice to <html> as early as possible (call before render to avoid a flash). */
export function applyStoredTheme() {
  const s = localStorage.getItem(KEY);
  if (s === 'dark' || s === 'light') {
    document.documentElement.setAttribute('data-theme', s);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/** The theme actually showing right now — the stored choice, or the OS preference. */
export function getEffectiveTheme() {
  const s = localStorage.getItem(KEY);
  if (s === 'dark' || s === 'light') return s;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Persist and apply an explicit theme choice. */
export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}
