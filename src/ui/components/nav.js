// The one header nav every Weekly page shares: Update, Tasks, Calendar, Notes, Stats (only when
// switched on in Settings → Advanced) and Settings. The app's views are hash links, so the same
// links work in the app and from the other pages.
import { h } from './dom.js';
import { getSettings } from '../../lib/settings.js';

/** @typedef {'update' | 'tasks' | 'calendar' | 'notes' | 'stats' | 'settings'} NavId */
/** @type {[NavId, string, string][]} */
const ITEMS = [
  ['update', 'Update', '../report/report.html'],
  ['tasks', 'Tasks', '../app/app.html#tasks'],
  ['calendar', 'Calendar', '../app/app.html#calendar'],
  ['notes', 'Notes', '../app/app.html#notes'],
  ['stats', 'Stats', '../app/app.html#stats'],
  ['settings', 'Settings', '../settings/settings.html'],
];

/** @param {NavId | null} id */
export function setCurrent(id) {
  for (const [k] of ITEMS) {
    const a = document.getElementById(`nav-${k}`);
    if (!a) continue;
    if (k === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

/** Fills <nav id="mainNav">. @param {NavId | null} active @returns {Promise<boolean>} whether Stats is switched on */
export async function mountNav(active) {
  const showStats = await getSettings().then((s) => s.showStats, () => false);
  const nav = document.getElementById('mainNav');
  nav?.replaceChildren(...ITEMS.filter(([k]) => k !== 'stats' || showStats)
    .map(([k, label, href]) => h('a', { id: `nav-${k}`, href }, label)));
  setCurrent(active);
  return showStats;
}
