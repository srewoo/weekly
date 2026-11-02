/**
 * Recurring tasks and per-day questions: what falls on a day, what was done on
 * it, how much of it was done, and what was done across a range (the weekly
 * update's Done section). Pure: no storage, no DOM.
 *
 * A recurring task occurs on its weekdays from `repeat.from` to `repeat.until`
 * (inclusive). It is ticked per day in `doneDates`; its status stays 'open'.
 * An "extra" task for a day is a one-off task whose dueDate is that day.
 */

import { fromISODate, toISODate, addDays, daysBetween, today } from './dates.js';
import { PRIORITY_RANK } from './schema.js';

/** @typedef {import('./schema.js').Task} Task */

/** @param {Task} t @returns {boolean} */
export const isRecurring = (t) => t.repeat !== null;

/** Archived = its last day is before `ref`. History stays; it just stops occurring. @param {Task} t @param {string} [ref] */
export const isArchived = (t, ref = today()) => t.repeat !== null && t.repeat.until !== null && t.repeat.until < ref;

/** @param {Task} t @param {string} iso @returns {boolean} */
export function occursOn(t, iso) {
  const r = t.repeat;
  const d = fromISODate(iso);
  if (!r || !d || iso < r.from || (r.until !== null && iso > r.until)) return false;
  return r.days.includes(d.getDay());
}

/** Recurring: ticked that day. One-off: closed (its day is its dueDate). @param {Task} t @param {string} iso */
export const isDoneOn = (t, iso) => (t.repeat ? t.doneDates.includes(iso) : t.status === 'done');

/** @param {Task} a @param {Task} b @returns {number} */
const byPriorityThenCreated = (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt;

/** The day sheet's "Daily tasks". @param {Task[]} tasks @param {string} iso @returns {Task[]} */
export const recurringOn = (tasks, iso) => tasks.filter((t) => occursOn(t, iso)).sort(byPriorityThenCreated);

/** The day sheet's "Extra tasks for this day", open and done. @param {Task[]} tasks @param {string} iso @returns {Task[]} */
export const extrasOn = (tasks, iso) =>
  tasks.filter((t) => t.repeat === null && t.dueDate === iso).sort(byPriorityThenCreated);

/**
 * Calendar shading: the share of a day's tasks that are done.
 * @param {Task[]} tasks @param {string} iso
 * @returns {{ done: number, total: number }}
 */
export function dayCompletion(tasks, iso) {
  const day = [...recurringOn(tasks, iso), ...extrasOn(tasks, iso)];
  return { done: day.filter((t) => isDoneOn(t, iso)).length, total: day.length };
}

/** How many days in [fromIso, toIso] a recurring task occurs on. @param {Task} t @param {string} fromIso @param {string} toIso */
export function occurrences(t, fromIso, toIso) {
  let n = 0;
  for (let i = 0; i <= daysBetween(fromIso, toIso); i++) if (occursOn(t, addDays(fromIso, i))) n++;
  return n;
}

/**
 * @typedef {object} RecurringDone
 * @property {Task} task
 * @property {number} done  days ticked inside the range
 * @property {number} of    days it occurred inside the range
 */

/**
 * The weekly update's Done section for [fromIso, toIso], inclusive. Callers clamp
 * `toIso` to today if "of" should not count days still to come.
 * - oneOffs: closed one-off tasks whose completedAt falls in the range, by priority then completion time.
 * - recurring: each recurring task ticked at least once in the range, with its count, by priority.
 *
 * @param {Task[]} tasks @param {string} fromIso @param {string} toIso
 * @returns {{ oneOffs: Task[], recurring: RecurringDone[] }}
 */
export function doneInRange(tasks, fromIso, toIso) {
  /** @param {string} iso */
  const inRange = (iso) => iso >= fromIso && iso <= toIso;
  const oneOffs = tasks
    .filter((t) => t.repeat === null && t.completedAt !== null && inRange(toISODate(new Date(t.completedAt))))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.completedAt ?? 0) - (b.completedAt ?? 0));
  const recurring = tasks
    .filter(isRecurring)
    .sort(byPriorityThenCreated)
    .map((task) => ({ task, done: task.doneDates.filter(inRange).length, of: occurrences(task, fromIso, toIso) }))
    .filter((r) => r.done > 0);
  return { oneOffs, recurring };
}
