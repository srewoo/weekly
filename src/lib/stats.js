/**
 * Stats from dailies.html (L7): streaks, the year heatmap, weekday rates,
 * per-task completion and the summary cards. Pure: no storage, no DOM.
 *
 * A day's "done of total" is the calendar's (dayCompletion): its recurring
 * tasks plus its one-off tasks. Days with nothing on them are skipped: they
 * neither break a streak nor count towards one, so a Mon–Fri task keeps its
 * streak over the weekend. Today counts once it is perfect; until then it is
 * still in progress and does not break the current streak either.
 */

import { addDays, fromISODate } from './dates.js';
import { dayCompletion, occursOn, occurrences, isArchived } from './recurrence.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {{ iso: string, done: number, total: number }} DayRow */
/** @typedef {{ task: Task, hit: number, live: number, rate: number | null }} TaskRate */

export const YEAR_DAYS = 365;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** @param {DayRow} r */
export const isPerfect = (r) => r.total > 0 && r.done === r.total;

/** Share done, 0–100, or null for a day with nothing on it. @param {DayRow} r */
export const pct = (r) => (r.total ? Math.round((r.done / r.total) * 100) : null);

/**
 * The `days` local days ending with `to`, oldest first.
 * @param {Task[]} tasks @param {string} to @param {number} [days]
 * @returns {DayRow[]}
 */
export function yearRows(tasks, to, days = YEAR_DAYS) {
  return Array.from({ length: days }, (_, i) => {
    const iso = addDays(to, i - days + 1);
    return { iso, ...dayCompletion(tasks, iso) };
  });
}

/** @param {DayRow[]} rows @returns {{ current: number, longest: number }} */
export function streaks(rows) {
  let longest = 0, run = 0;
  for (const r of rows) {
    if (!r.total) continue;
    run = isPerfect(r) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = /** @type {DayRow} */ (rows[i]);
    if (!r.total) continue;
    if (isPerfect(r)) current++;
    else if (i < rows.length - 1) break;   // an unfinished today is still in progress
  }
  return { current, longest };
}

/**
 * Average share done per weekday (0 = Sunday), over days with something on them.
 * @param {DayRow[]} rows @returns {(number | null)[]}
 */
export function weekdayRates(rows) {
  const sum = Array(7).fill(0), n = Array(7).fill(0);
  for (const r of rows) {
    if (!r.total) continue;
    const wd = /** @type {Date} */ (fromISODate(r.iso)).getDay();
    sum[wd] += r.done / r.total;
    n[wd]++;
  }
  return sum.map((s, i) => (n[i] ? s / n[i] : null));
}

/**
 * How often each recurring task was ticked on the days it occurred, inside the
 * window ending `to` (never the future), best first; tasks with no day yet last.
 * @param {Task[]} tasks @param {string} to @param {number} [days]
 * @returns {TaskRate[]}
 */
export function taskRates(tasks, to, days = YEAR_DAYS) {
  const from = addDays(to, 1 - days);
  return tasks.filter((t) => t.repeat !== null).map((task) => {
    const live = occurrences(task, from, to);
    const hit = task.doneDates.filter((d) => d >= from && d <= to && occursOn(task, d)).length;
    return { task, hit, live, rate: live ? hit / live : null };
  }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.task.createdAt - b.task.createdAt);
}

/**
 * The summary cards.
 * @param {DayRow[]} rows @param {Task[]} tasks @param {{ day: string | null, enc: unknown }[]} notes
 * @returns {{ current: number, longest: number, perfect: number, average: number, daily: number, noteDays: number }}
 */
export function summary(rows, tasks, notes) {
  const tracked = rows.filter((r) => r.total > 0);
  const first = rows[0]?.iso ?? '', last = rows.at(-1)?.iso ?? '';
  const noteDays = new Set(notes.filter((n) => !n.enc && n.day && n.day >= first && n.day <= last).map((n) => n.day));
  return {
    ...streaks(rows),
    perfect: tracked.filter(isPerfect).length,
    average: tracked.length ? Math.round((tracked.reduce((s, r) => s + r.done / r.total, 0) / tracked.length) * 100) : 0,
    daily: tasks.filter((t) => t.repeat !== null && !isArchived(t, last)).length,
    noteDays: noteDays.size,
  };
}

/**
 * The heatmap's columns: one per week, Monday first, like the calendar.
 * The first column is padded with nulls; `months` labels a column when its month starts.
 * @param {DayRow[]} rows @returns {{ weeks: (DayRow | null)[][], months: string[] }}
 */
export function heatmap(rows) {
  if (!rows.length) return { weeks: [], months: [] };
  const lead = (/** @type {Date} */ (fromISODate(rows[0]?.iso ?? '')).getDay() + 6) % 7;
  /** @type {(DayRow | null)[]} */
  const cells = [...Array(lead).fill(null), ...rows];
  /** @type {(DayRow | null)[][]} */
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  let month = -1;
  const months = weeks.map((w) => {
    const first = w.find((c) => c !== null);
    const m = first ? /** @type {Date} */ (fromISODate(first.iso)).getMonth() : month;
    if (m === month) return '';
    month = m;
    return MONTHS[m] ?? '';
  });
  // A first column with only a month's last days would print its name on top of the next month's.
  if (months[0] && months[1]) months[0] = '';
  return { weeks, months };
}
