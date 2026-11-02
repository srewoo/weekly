// The daily tasks list on the Stats view (spec L6, L7): each recurring task's
// completion over the last year, Stop repeating (history kept), Repeat again,
// and Delete for good, the one confirmed hard delete of a daily task.
import { $, h, clear } from '../components/dom.js';
import { taskRates } from '../../lib/stats.js';
import { isArchived } from '../../lib/tasks.js';
import { today, shortDate } from '../../lib/dates.js';
import * as act from '../components/task-actions.js';

/** @typedef {import('../../lib/stats.js').TaskRate} TaskRate */

/** @param {TaskRate} r @param {boolean} stopped */
function row(r, stopped) {
  const t = r.task;
  const p = r.rate === null ? null : Math.round(r.rate * 100);
  const when = stopped && t.repeat?.until ? `stopped ${shortDate(t.repeat.until)} · ` : '';
  return h('li', { class: 'rate-row', dataset: { id: t.id } },
    h('div', { class: 't-main' }, h('span', { class: 't-title' }, t.title),
      h('span', { class: 't-meta' }, `${when}${r.live ? `${r.hit} of ${r.live} day${r.live === 1 ? '' : 's'}` : 'no days yet'}`)),
    h('span', { class: 'wd-track' }, p === null ? null : h('i', { style: { width: `${p}%` } })),
    h('span', { class: 'wd-pct' }, p === null ? '–' : `${p}%`),
    h('div', { class: 'rate-acts' },
      stopped
        ? h('button', { class: 'quiet restart', attrs: { 'aria-label': `Repeat ${t.title} again` }, on: { click: () => void act.restart(t) } }, 'Repeat again')
        : h('button', { class: 'quiet stop', attrs: { 'aria-label': `Stop repeating ${t.title}` }, on: { click: () => void act.remove(t, today()) } }, 'Stop repeating'),
      h('button', { class: 'quiet danger purge', attrs: { 'aria-label': `Delete ${t.title} for good` },
        on: { click: () => void act.purge(t) } }, 'Delete…')));
}

/** @param {import('../../lib/tasks.js').Task[]} tasks */
export function render(tasks) {
  const ref = today();
  const rates = taskRates(tasks, ref);
  const active = rates.filter((r) => !isArchived(r.task, ref));
  const stopped = rates.filter((r) => isArchived(r.task, ref));
  clear($('#dailyRates'));
  $('#dailyRates').append(...(active.length ? active.map((r) => row(r, false))
    : [h('li', { class: 'none' }, 'No daily tasks yet. Add one in a day’s sheet on the Calendar.')]));
  $('#stoppedWrap').hidden = !stopped.length;
  $('#stoppedCount').textContent = String(stopped.length);
  clear($('#stoppedList'));
  $('#stoppedList').append(...stopped.map((r) => row(r, true)));
}
