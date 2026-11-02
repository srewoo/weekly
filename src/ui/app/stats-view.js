// The Stats view (spec L7, from dailies.html): the figures, a year of days shaded
// like the calendar, how each weekday goes, and the daily tasks (daily-tasks.js).
import { $, h, clear } from '../components/dom.js';
import { yearRows, summary, heatmap, weekdayRates, pct, WEEKDAYS } from '../../lib/stats.js';
import { today, longDate } from '../../lib/dates.js';
import * as daily from './daily-tasks.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/stats.js').DayRow} DayRow */

/** @param {ReturnType<typeof summary>} s */
function figures(s) {
  const fig = (/** @type {string | number} */ n, /** @type {string} */ label) =>
    h('div', { class: 'figure' }, h('b', {}, String(n)), h('span', {}, label));
  clear($('#statFigures'));
  $('#statFigures').append(
    fig(s.current, s.current === 1 ? 'day in a row, so far' : 'days in a row, so far'),
    fig(s.longest, 'longest run'),
    fig(s.perfect, 'days with everything done'),
    fig(`${s.average}%`, 'done on an average day'),
    fig(s.daily, s.daily === 1 ? 'daily task' : 'daily tasks'),
    fig(s.noteDays, 'days with a note'));
}

/** @param {DayRow | null} c */
function square(c) {
  if (!c) return h('i', { class: 'hm-cell blank' });
  const p = pct(c);
  const el = h('i', { class: p === null ? 'hm-cell' : `hm-cell on heat${p === 100 ? ' full' : ''}`, dataset: { iso: c.iso },
    title: `${longDate(c.iso)}: ${c.total ? `${c.done} of ${c.total} done` : 'nothing on'}` });
  if (p !== null) el.style.setProperty('--p', String(p));
  return el;
}

/** @param {DayRow[]} rows */
function year(rows) {
  const { weeks, months } = heatmap(rows);
  clear($('#hmMonths'));
  clear($('#heatmap'));
  const days = rows.filter((r) => r.total > 0);
  $('#heatmap').setAttribute('aria-label', `A year of days, shaded by how much of each got done. ${days.filter((r) => r.done === r.total).length} of ${days.length} days with tasks had everything done.`);
  $('#hmMonths').append(...months.map((m) => h('span', {}, m)));
  $('#heatmap').append(...weeks.flat().map(square));
}

/** Monday first, like the rest of Weekly. @param {DayRow[]} rows */
function weekdays(rows) {
  const rates = weekdayRates(rows);
  const order = [1, 2, 3, 4, 5, 6, 0];
  clear($('#weekdayBars'));
  $('#weekdayBars').append(...order.map((d) => {
    const r = rates[d] ?? null;
    const p = r === null ? null : Math.round(r * 100);
    return h('div', { class: 'wd-row' }, h('span', {}, WEEKDAYS[d]),
      h('span', { class: 'wd-track' }, p === null ? null : h('i', { style: { width: `${p}%` } })),
      h('span', { class: 'wd-pct' }, p === null ? '–' : `${p}%`));
  }));
  const known = order.filter((d) => rates[d] !== null);
  const best = known.reduce((b, d) => ((rates[d] ?? 0) > (rates[b] ?? 0) ? d : b), known[0] ?? -1);
  const worst = known.reduce((w, d) => ((rates[d] ?? 0) < (rates[w] ?? 0) ? d : w), known[0] ?? -1);
  $('#weekdayNote').textContent = known.length && rates[best] !== rates[worst]
    ? `Strongest on ${WEEKDAYS[best]}, weakest on ${WEEKDAYS[worst]}.`
    : known.length ? '' : 'Nothing to go on yet. Tick a few days and this fills in.';
}

/** @param {Task[]} tasks @param {Note[]} notes */
export function render(tasks, notes) {
  const rows = yearRows(tasks, today());
  figures(summary(rows, tasks, notes));
  year(rows);
  weekdays(rows);
  daily.render(tasks);
}
