import { dayKey, shiftDate } from '../week.js';
import { classify } from './classify.js';
import { readSettings } from '../settings.js';

/**
 * Your site rules apply to every week, not only from when they were written: an entry the
 * tracker filed under Browsing is classified again with today's rules when it is loaded.
 * @param {string} k @param {any} e @param {{ rules: string[], ticketPrefixes: string[] }} s @returns {[string, any]}
 */
export function reclassify(k, e, s) {
  if (!s.rules.length || !e.url || (e.category !== 'Browsing' && !k.startsWith('rule:'))) return [k, e];
  const c = classify(e.url, e.title || '', s);
  return c.category === 'Browsing' ? [k, e] : [c.key, { ...e, category: c.category, task: c.task }];
}

/** @param {string} url @param {string[] | undefined} list */
export function isIgnored(url, list) {
  try {
    const h = new URL(url).hostname;
    return (list || []).some(d => d && (h === d || h.endsWith('.' + d)));
  } catch (e) { return true; }
}

/** @param {object | null | undefined} o */
export const hasEntries = o => !!o && Object.keys(o).length > 0;

// Load `n` days from `start`: this device's log plus imported devices' logs.
// A day with no live tracking falls back to its history estimate (hist:<date>), flagged as estimated.
/**
 * @param {Date} start @param {number} n
 * @returns {Promise<{start: Date, days: Date[], merged: Record<string, any>, perDay: number[], perDayCat: Record<string, number>[], awayPerDay: number[], switches: number[], estimated: boolean[], histTried: boolean[]}>}
 */
export async function loadRange(start, n) {
  const days = [...Array(n)].map((_, i) => shiftDate(start, i));
  const dates = days.map(dayKey);
  const { imports = [] } = await chrome.storage.local.get('imports');
  const prefixes = ['day:', 'hist:', 'meta:', ...imports.map((/** @type {string} */ id) => `imp:${id}:`)];
  const st = await chrome.storage.local.get([...dates.flatMap(d => prefixes.map(p => p + d)), 'settings']);
  const s = readSettings(st.settings);
  /** @type {Record<string, any>} */ const merged = Object.create(null);  // null-proto: a stored '__proto__' key stays plain data
  /** @type {number[]} */ const perDay = [];
  /** @type {number[]} */ const switches = [];
  /** @type {number[]} */ const awayPerDay = [];
  /** @type {Record<string, number>[]} */ const perDayCat = [];
  /** @type {boolean[]} */ const estimated = [];
  /** @type {boolean[]} */ const histTried = [];
  dates.forEach((date, i) => {
    // Estimates only ever cover time before live tracking began that day (history.js), so both are counted.
    const hist = st['hist:' + date];
    /** @type {[any, boolean][]} */
    const sources = [[st['day:' + date], false], ...imports.map((/** @type {string} */ id) => [st[`imp:${id}:${date}`], false]), [hist, true]];
    let tot = 0, away = 0;
    /** @type {Record<string, number>} */
    const cats = Object.create(null);
    for (const [src, est] of sources) for (const [k0, e0] of Object.entries(src || {})) {
      if (!e0 || typeof e0.ms !== 'number') continue;
      const [k, e] = reclassify(k0, e0, s);
      // "Tracked in Chrome" totals and trends stay Chrome-only; Outside Chrome is listed, not summed.
      if (k !== 'away') { tot += e.ms; cats[e.category] = (cats[e.category] || 0) + e.ms; } else away += e.ms;
      const m = merged[k] || (merged[k] = { key: k, category: e.category, task: e.task, url: e.url, ms: 0, last: 0, days: new Set(), tickets: new Set(), est: false });
      m.ms += e.ms; m.days.add(i); m.est ||= est;
      (e.tickets || []).forEach((/** @type {string} */ t) => m.tickets.add(t));
      if (e.last >= m.last) Object.assign(m, { task: e.task, url: e.url, last: e.last, category: e.category });
    }
    perDay.push(tot); perDayCat.push(cats); awayPerDay.push(away);
    estimated.push(hasEntries(hist));
    histTried.push(('hist:' + date) in st);
    switches.push((st['meta:' + date] || {}).switches || 0);
  });
  return { start, days, merged, perDay, perDayCat, awayPerDay, switches, estimated, histTried };
}
