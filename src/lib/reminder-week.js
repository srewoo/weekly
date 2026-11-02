/**
 * The week so far, for the reminders: tasks done plus tracked tickets and merge requests.
 * Counts only. The pure parts (weekCounts, readyLine, progressLine) are unit-tested; load() reads storage.
 */
import { loadRange } from './activity/range.js';
import { weekStart, WORK_DAYS } from './week.js';
import { getTasks, doneThisWeek } from './tasks.js';
import { getSettings } from './settings.js';

/** @typedef {{ done: number, tickets: number, mrs: number }} WeekCounts */

/** @param {number} n @param {string} one @param {string} many */
const num = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * @param {Iterable<{ category: string, ms: number }>} items tracked items for the week
 * @param {number} done tasks done this week @param {number} [minMinutes]
 * @returns {WeekCounts}
 */
export function weekCounts(items, done, minMinutes = 0) {
  const c = { done, tickets: 0, mrs: 0 };
  for (const e of items) {
    if (e.ms < minMinutes * 60000) continue;
    if (e.category === 'Tickets') c.tickets++;
    else if (e.category === 'Merge requests') c.mrs++;
  }
  return c;
}

/** "5 done, 3 tickets, 2 merge requests", leaving out what is zero. @param {WeekCounts} c */
const parts = (c) => [c.done && `${c.done} done`, c.tickets && num(c.tickets, 'ticket', 'tickets'),
  c.mrs && num(c.mrs, 'merge request', 'merge requests')].filter(Boolean).join(', ');

/** The last working day's lead line. @param {WeekCounts} c */
export const readyLine = (c) => `Your weekly update is ready${parts(c) ? `: ${parts(c)}` : ''}.`;

/** Other evenings: one line of progress. @param {WeekCounts} c */
export const progressLine = (c) => `This week so far: ${c.done} done${c.tickets || c.mrs ? `, ${parts({ ...c, done: 0 })} tracked` : ''}.`;

/** @returns {Promise<WeekCounts>} */
export async function loadWeekCounts() {
  const [range, tasks, s] = await Promise.all([loadRange(weekStart(0), WORK_DAYS), getTasks(), getSettings()]);
  return weekCounts(Object.values(range.merged), doneThisWeek(tasks), s.minMinutes);
}
