/**
 * What the task screens draw, derived from the task list: the side panel's
 * Today bands, the calendar's month grid, and the week's Done count. Pure: no
 * storage, no DOM. The screens re-derive from these on every change.
 */

import { today, addDays, daysBetween, weekday, toISODate } from './dates.js';
import { UNDATED_KEY } from './schema.js';
import { isOverdue, isUndated, byDueThenPriority, byCompletedDesc } from './task-views.js';
import { recurringOn, dayCompletion, doneInRange } from './recurrence.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {ReturnType<typeof doneInRange>} Done */

/**
 * @typedef {object} Band
 * @property {string} key          'overdue' | 'today' | UNDATED_KEY
 * @property {string} label
 * @property {Task[]} tasks
 * @property {boolean} flagged
 * @property {boolean} collapsible
 * @property {boolean} defaultOpen
 */

/**
 * The side panel's Today tab (spec §3.1): Overdue, Today (recurring first, then
 * due today, then one-offs closed today so a tick stays reversible), No date
 * (collapsed). Overdue and No date are dropped when empty; Today always shows.
 * @param {Task[]} tasks @param {string} [ref]
 * @returns {Band[]}
 */
export function todayBands(tasks, ref = today()) {
  const overdue = tasks.filter((t) => isOverdue(t, ref)).sort(byDueThenPriority);
  const due = tasks.filter((t) => t.status === 'open' && t.repeat === null && t.dueDate === ref).sort(byDueThenPriority);
  const closed = tasks
    .filter((t) => t.repeat === null && t.status === 'done' && t.completedAt !== null && toISODate(new Date(t.completedAt)) === ref)
    .sort(byCompletedDesc);
  const undated = tasks.filter(isUndated).sort(byDueThenPriority);
  /** @type {Band[]} */
  const out = [];
  if (overdue.length) out.push({ key: 'overdue', label: 'Overdue', tasks: overdue, flagged: true, collapsible: false, defaultOpen: true });
  out.push({ key: 'today', label: 'Today', tasks: [...recurringOn(tasks, ref), ...due, ...closed], flagged: false, collapsible: false, defaultOpen: true });
  if (undated.length) out.push({ key: UNDATED_KEY, label: 'No date', tasks: undated, flagged: false, collapsible: true, defaultOpen: false });
  return out;
}

/**
 * @typedef {object} DayCell
 * @property {string} iso
 * @property {number} day        day of the month
 * @property {'past' | 'today' | 'future'} when
 * @property {number} done
 * @property {number} total
 * @property {number | null} pct  shading, 0–100; null = not shaded
 */

/**
 * One month for the calendar, Monday first. Past days are shaded whenever they
 * had tasks; today only once something is ticked, so a fresh day never opens
 * painted as a failure (dailies.html's rule). Future days are never shaded.
 * @param {number} year @param {number} month 0–11
 * @param {Task[]} tasks @param {string} [ref]
 * @returns {{ blanks: number, cells: DayCell[] }}
 */
export function monthGrid(year, month, tasks, ref = today()) {
  const first = toISODate(new Date(year, month, 1));
  const length = new Date(year, month + 1, 0).getDate();
  /** @type {DayCell[]} */
  const cells = [];
  for (let i = 0; i < length; i++) {
    const iso = addDays(first, i);
    const n = daysBetween(ref, iso);
    const when = n < 0 ? 'past' : n === 0 ? 'today' : 'future';
    const { done, total } = dayCompletion(tasks, iso);
    const shaded = total > 0 && (when === 'past' || (when === 'today' && done > 0));
    cells.push({ iso, day: i + 1, when, done, total, pct: shaded ? Math.round((done / total) * 100) : null });
  }
  return { blanks: (weekday(first) + 6) % 7, cells };
}

/**
 * The Done section's range for the week starting `monIso`: Monday to Friday,
 * clamped to `ref` so "n of m days" never counts days still to come.
 * @param {string} monIso @param {string} [ref]
 * @returns {{ from: string, to: string }}
 */
export function doneRange(monIso, ref = today()) {
  const fri = addDays(monIso, 4);
  return { from: monIso, to: fri < ref ? fri : ref };
}

/** Monday of the week containing `ref`. @param {string} [ref] @returns {string} */
export const mondayOf = (ref = today()) => addDays(ref, -((weekday(ref) + 6) % 7));

/** Tasks done this week, recurring ticks counted per day. @param {Task[]} tasks @param {string} [ref] @returns {number} */
export function doneThisWeek(tasks, ref = today()) {
  const { from, to } = doneRange(mondayOf(ref), ref);
  if (to < from) return 0;
  const done = doneInRange(tasks, from, to);
  return done.oneOffs.length + done.recurring.reduce((n, r) => n + r.done, 0);
}

/** The report's exclusion key for a Done item. @param {Task} t */
export const doneKey = (t) => `task:${t.id}`;

/** Drop the Done items the user unticked for this week. @param {Done} done @param {Set<string>} excluded @returns {Done} */
export const withoutExcluded = (done, excluded) => ({
  oneOffs: done.oneOffs.filter((t) => !excluded.has(doneKey(t))),
  recurring: done.recurring.filter((r) => !excluded.has(doneKey(r.task))),
});
