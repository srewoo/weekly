// Classic script, first in every page's <head> (MV3 forbids inline): sets the theme
// from theme.js's localStorage mirror before first paint, so a dark page never
// flashes light. theme.js then confirms it from chrome.storage.
try {
  const t = localStorage.getItem('weekly:theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset['theme'] = t;
} catch { /* no mirror yet: System until theme.js runs */ }
