// The month grid (spec L4): each day shaded by the share of its tasks done,
// marker wash → marker; today ringed; future days muted.
import { $, h, clear } from '../components/dom.js';
import { monthGrid } from '../../lib/tasks.js';
import { today, fromISODate, longDate } from '../../lib/dates.js';
import * as sheet from './day-sheet.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

const shown = { year: 0, month: 0 };
/** @type {Task[]} */
let last = [];

/** @param {import('../../lib/tasks.js').DayCell} c */
function cell(c) {
  const label = `${longDate(c.iso)}${c.total ? `: ${c.done} of ${c.total} done` : c.when === 'future' ? '' : ': no tasks'}`;
  const btn = h('button', {
    class: ['cal-day', c.pct !== null && 'heat', c.pct === 100 && 'full', c.when === 'today' && 'today', c.when === 'future' && 'future'].filter(Boolean).join(' '),
    dataset: { iso: c.iso },
    attrs: { 'aria-label': label },
    on: { click: () => sheet.open(c.iso) },
  }, h('span', { class: 'num' }, String(c.day)), c.total && c.when !== 'future' ? h('span', { class: 'ratio' }, `${c.done}/${c.total}`) : null);
  if (c.pct !== null) btn.style.setProperty('--p', String(c.pct));
  return btn;
}

/** @param {Task[]} tasks */
export function render(tasks) {
  last = tasks;
  const { blanks, cells } = monthGrid(shown.year, shown.month, tasks, today());
  $('#calTitle').textContent = new Date(shown.year, shown.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  $('#calEmpty').hidden = tasks.length > 0;
  const grid = $('#calGrid');
  clear(grid);
  grid.append(...Array.from({ length: blanks }, () => h('span', { class: 'cal-blank' })), ...cells.map(cell));
}

/** Show the month containing `iso`. @param {string} iso */
export function goTo(iso) {
  const d = fromISODate(iso) ?? new Date();
  shown.year = d.getFullYear();
  shown.month = d.getMonth();
  render(last);
}

export const goToday = () => goTo(today());

/** @param {number} n months */
export function step(n) {
  const d = new Date(shown.year, shown.month + n, 1);
  shown.year = d.getFullYear();
  shown.month = d.getMonth();
  render(last);
}

export function init() {
  const d = new Date();
  shown.year = d.getFullYear();
  shown.month = d.getMonth();
  $('#prevMonth').onclick = () => step(-1);
  $('#nextMonth').onclick = () => step(1);
  $('#todayBtn').onclick = goToday;
}
