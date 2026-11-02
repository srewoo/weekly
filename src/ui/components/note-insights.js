// The 7-day insights (F5): notes created and done per local day, oldest first.
// Counts only, so private notes are counted without being read.
import { h, clear } from './dom.js';
import { insights } from '../../lib/notes.js';
import { today, fromISODate } from '../../lib/dates.js';

/** @typedef {import('../../lib/notes.js').Note} Note */

/** @param {string} iso */
const short = (iso) => fromISODate(iso)?.toLocaleDateString(undefined, { weekday: 'short' }) ?? iso;

/** @param {HTMLElement} host @param {Note[]} notes */
export function renderInsights(host, notes) {
  const r = insights(notes, today());
  const max = Math.max(1, ...r.days.map((d) => Math.max(d.created, d.done)));
  /** @param {number} n */
  const pct = (n) => `${Math.round((n / max) * 100)}%`;
  clear(host);
  host.append(h('h3', {}, 'Last 7 days'),
    h('p', { class: 'ins-sum' }, `${r.created} created · ${r.done} done · ${r.open} open · ${r.pinned} pinned`),
    h('div', { class: 'ins-days' }, r.days.map((d) => h('div', { class: 'ins-day', dataset: { iso: d.iso },
      attrs: { role: 'img', 'aria-label': `${short(d.iso)}: ${d.created} created, ${d.done} done` } },
    h('span', { class: 'ins-bars' }, h('i', { class: 'c', style: { height: pct(d.created) } }), h('i', { class: 'd', style: { height: pct(d.done) } })),
    h('span', { class: 'ins-n' }, `${d.created}/${d.done}`),
    h('span', { class: 'ins-name' }, short(d.iso))))),
    h('p', { class: 'hint' }, h('i', { class: 'key c' }), ' created ', h('i', { class: 'key d' }), ' done'));
}
