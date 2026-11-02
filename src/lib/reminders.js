/**
 * What the morning brief and the evening check say (spec §3.3, D8), from Daybook's
 * reminders.js. Pure: no storage and no chrome.*, so the worker (which decides
 * whether to show a reminder) and the reminder window (which draws it) derive the
 * same thing from the same task list. Scheduling lives in src/background/reminders.js.
 */

import { today, weekday, toISODate } from './dates.js';
import { isOverdue, isDueToday, byDueThenPriority } from './task-views.js';
import { recurringOn, isDoneOn } from './recurrence.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {'morning' | 'evening'} Slot */

export const SLOTS = /** @type {const} */ (['morning', 'evening']);

/**
 * @typedef {object} ReminderPayload
 * @property {Slot} slot
 * @property {string} date
 * @property {Task[]} overdue      open one-offs due before today, carried over
 * @property {Task[]} today        daily tasks not yet ticked today, then open one-offs due today
 * @property {number} closedToday  one-offs closed today plus daily tasks ticked today
 * @property {boolean} empty       nothing in either list
 * @property {boolean} weekEnds    today is the last working day: the evening links to the week report
 */

/**
 * Morning: what is due today, and what is overdue. Evening: the same lists, as
 * what is still open. Undated tasks never appear: they were never claimed for
 * today, and surfacing them every morning is how a reminder becomes noise.
 * @param {Slot} slot @param {Task[]} tasks @param {number[]} days working days, 0=Sun … 6=Sat
 * @param {string} [ref]
 * @returns {ReminderPayload}
 */
export function buildPayload(slot, tasks, days, ref = today()) {
  const overdue = tasks.filter((t) => isOverdue(t, ref)).sort(byDueThenPriority);
  const daily = recurringOn(tasks, ref);
  const due = tasks.filter((t) => t.repeat === null && isDueToday(t, ref)).sort(byDueThenPriority);
  const todays = [...daily.filter((t) => !isDoneOn(t, ref)), ...due];
  const closed = tasks.filter((t) => t.repeat === null && t.status === 'done' && t.completedAt !== null
    && toISODate(new Date(t.completedAt)) === ref).length;
  return {
    slot, date: ref, overdue, today: todays,
    closedToday: closed + daily.filter((t) => isDoneOn(t, ref)).length,
    empty: overdue.length + todays.length === 0,
    weekEnds: isLastWorkday(days, ref),
  };
}

/** @param {number[]} days @param {string} [ref] */
export const isReminderDay = (days, ref = today()) => days.includes(weekday(ref));

/**
 * The last of `days` in the Monday–Sunday week holding `ref` (Friday by default).
 * Its evening check carries the weekly-update nudge that replaced Weekly 2's
 * Friday 4 pm reminder.
 * @param {number[]} days @param {string} [ref]
 */
export function isLastWorkday(days, ref = today()) {
  const mon0 = (/** @type {number} */ d) => (d + 6) % 7;
  return isReminderDay(days, ref) && !days.some((d) => mon0(d) > mon0(weekday(ref)));
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
/** @param {number} n @param {string} one @param {string} many */
export const count = (n, one, many) => `${WORDS[n] ?? n} ${n === 1 ? one : many}`;

/** The window's headline. @param {ReminderPayload} p */
export function headline(p) {
  const n = p.overdue.length + p.today.length;
  if (p.slot === 'morning') return `${count(n, 'thing', 'things')} due today.`;
  return p.empty ? 'Nothing left open.' : `${count(n, 'task', 'tasks')} still open.`;
}

/** @param {ReminderPayload} p */
export function subline(p) {
  if (p.slot === 'morning') return p.overdue.length ? `${count(p.overdue.length, 'task', 'tasks')} carried over.` : 'Nothing carried over.';
  return `You closed ${p.closedToday} today.`;
}

/**
 * The system notification: the path that reaches you when Chrome is not the
 * app in front. Counts only, as in Daybook; the window has the titles.
 * On the last working day the update leads, when `ready` (readyLine) is given.
 * @param {ReminderPayload} p @param {string} [ready]
 * @returns {{ title: string, message: string }}
 */
export function notificationText(p, ready = '') {
  const lead = p.weekEnds && ready;
  return lead ? { title: ready.replace(/\.$/, ''), message: 'Review and copy it.' }
    : { title: headline(p).replace(/\.$/, ''), message: subline(p) + (p.slot === 'evening' && p.weekEnds ? ' Your weekly update is drafted and ready to review.' : '') };
}
