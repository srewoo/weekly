// Trends (last 8 weeks): shown only when Stats and Trends are switched on in Settings → Advanced.
import { h, clear, $ } from '../components/dom.js';
import { weekStart, fmtDuration as fmt } from '../../lib/week.js';
import { loadRange } from '../../lib/activity/range.js';
import { computeTrends } from '../../lib/report/trends.js';

export async function renderTrends(el, weeks = 8) {
  const rows = computeTrends(await loadRange(weekStart(-(weeks - 1)), weeks * 7), weeks);
  // Outside Chrome (IDE, desktop meetings) is its own bar: without it a week of desktop calls looks like a light week.
  const max = Math.max(...rows.map(x => x.total + x.away), 3600000);
  const label = (x, i) => (i === rows.length - 1 ? 'This week (so far)' : x.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const bar = (ms, cls) => h('i', { class: cls, style: { width: `${(ms / max) * 100}%` } });
  clear(el);
  el.append(
    h('p', { class: 'hint' }, h('i', { class: 'key focus' }), 'Focused work ', h('i', { class: 'key meet' }),
      'Meetings ', h('i', { class: 'key away' }), 'Outside Chrome. Time counts Chrome only. Switches = times per day you moved to a different task.'),
    h('table', { class: 'trends' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Week of'), h('th', {}, 'Time'), h('th', {}), h('th', {}, 'Switches/day'))),
      h('tbody', {}, rows.map((x, i) => h('tr', {},
        h('td', {}, label(x, i)), h('td', {}, fmt(x.total)),
        h('td', { class: 'bars' }, bar(x.focus, 'focus'), bar(x.meet, 'meet'), x.away ? bar(x.away, 'away') : null),
        h('td', {}, x.switches || '–'))))));
}

export function init() {
  $('#trendsPanel').addEventListener('toggle', e => { if (e.target.open) renderTrends($('#trends')); });
}
