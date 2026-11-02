// Light, dark or the computer's choice (F6, L8). Every Weekly page imports this
// first: it marks <html data-theme> from Settings and follows later changes, so
// a choice made in one tab reaches the others without a reload. System leaves the
// attribute off and styles.css follows prefers-color-scheme.
import { getSettings, onSettingsChanged } from '../../lib/settings.js';

/** @param {string} theme */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset['theme'] = theme;
  else delete root.dataset['theme'];
  // theme-boot.js reads this mirror before first paint; chrome.storage stays the source of truth.
  try { localStorage.setItem('weekly:theme', theme); } catch { /* storage blocked: the page just themes a moment later */ }
}

void getSettings().then((s) => applyTheme(s.theme), () => undefined);
onSettingsChanged((s) => applyTheme(s.theme));
