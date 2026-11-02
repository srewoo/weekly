/**
 * The derived task views the UI renders: due-state predicates, ordering,
 * sections, counts, search and filter. Pure: no storage, no DOM. From Daybook.
 *
 * Overdue is computed here at read time and never stored: a task due yesterday
 * becomes overdue when the clock rolls past midnight, with nobody around to
 * write a flag. Recurring tasks have no due date and are never "undated";
 * recurrence.js answers which of them fall on a day.
 */

import { PRIORITY_RANK, UNDATED_KEY } from './schema.js';
import { today, daysBetween, addDays, stampDate } from './dates.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {import('./schema.js').Priority} Priority */

/** @typedef {'today' | 'week' | 'upcoming' | 'open' | 'completed' | 'overdue'} ViewId */

/**
 * Days the week view spans, counting today. Rolling rather than Mon–Sun: the
 * question a task list answers is "what is coming", and a calendar week
 * answers less of it every day until Sunday, when it answers nothing.
 */
export const WEEK_SPAN = 7;

/* ------------------------------------------------------------- derivation */

/** @param {Task} t @param {string} [ref] @returns {boolean} */
export const isOverdue = (t, ref = today()) =>
  t.repeat === null && t.status === 'open' && t.dueDate !== null && daysBetween(ref, t.dueDate) < 0;

/** @param {Task} t @param {string} [ref] @returns {boolean} */
export const isDueToday = (t, ref = today()) => t.status === 'open' && t.dueDate === ref;

/** @param {Task} t @param {string} [ref] @returns {boolean} */
export const isUpcoming = (t, ref = today()) =>
  t.status === 'open' && t.dueDate !== null && daysBetween(ref, t.dueDate) > 0;

/** @param {Task} t @returns {boolean} */
export const isUndated = (t) => t.status === 'open' && t.dueDate === null && t.repeat === null;

/** Open, dated, and falling inside the rolling window. @param {Task} t @param {string} [ref] @returns {boolean} */
export const isInWeek = (t, ref = today()) => {
  if (t.status !== 'open' || t.dueDate === null) return false;
  const n = daysBetween(ref, t.dueDate);
  return n >= 0 && n < WEEK_SPAN;
};

/* ------------------------------------------------------------------ order */

/**
 * Due date, then priority, then creation. Undated tasks sort after dated ones —
 * an explicit date is a stronger signal than none at all.
 * @param {Task} a @param {Task} b @returns {number}
 */
export function byDueThenPriority(a, b) {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return p !== 0 ? p : a.createdAt - b.createdAt;
}

/** @param {Task} a @param {Task} b @returns {number} */
export const byCompletedDesc = (a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt);

/* ------------------------------------------------------------------ views */

/**
 * @typedef {object} Section
 * @property {string} label
 * @property {boolean} flagged
 * @property {Task[]} tasks
 * @property {string} [key]           stable id for a collapsible band: ISO date, or 'undated'
 * @property {boolean} [collapsible]  whether the heading is a disclosure control
 * @property {boolean} [defaultOpen]  its state before the user has touched it
 */

/**
 * Group a list into the labelled bands the design draws down the spine.
 * Empty bands are dropped rather than rendered as a heading over nothing.
 *
 * @param {Task[]} tasks
 * @param {ViewId} view
 * @param {string} [ref]
 * @returns {Section[]}
 */
export function sectionsFor(tasks, view, ref = today()) {
  /** @param {string} label @param {Task[]} list @param {boolean} [flagged] @returns {Section[]} */
  const band = (label, list, flagged = false) => (list.length ? [{ label, flagged, tasks: list }] : []);

  const overdue = tasks.filter((t) => isOverdue(t, ref)).sort(byDueThenPriority);
  const due = tasks.filter((t) => isDueToday(t, ref)).sort(byDueThenPriority);

  switch (view) {
    case 'today': {
      // Completed-today stays visible so a tick is reversible without hunting.
      const closed = tasks
        .filter((t) => t.status === 'done' && t.completedAt !== null && sameDay(t.completedAt, ref))
        .sort(byCompletedDesc);
      return [...band('Overdue', overdue, true), ...band('Today', due), ...band('Closed today', closed)];
    }
    case 'week':
      return weekSections(tasks, overdue, ref);
    case 'overdue':
      return band('Overdue', overdue, true);
    case 'upcoming': {
      const up = tasks.filter((t) => isUpcoming(t, ref)).sort(byDueThenPriority);
      return band('Upcoming', up);
    }
    case 'open': {
      const undated = tasks.filter(isUndated).sort(byDueThenPriority);
      const dated = tasks.filter((t) => t.status === 'open' && t.dueDate !== null).sort(byDueThenPriority);
      return [...band('Overdue', overdue, true),
              ...band('Today', due),
              ...band('Upcoming', dated.filter((t) => isUpcoming(t, ref))),
              ...band('No date', undated)];
    }
    case 'completed': {
      const done = tasks.filter((t) => t.status === 'done').sort(byCompletedDesc);
      return band('Completed', done);
    }
    default:
      return [];
  }
}

/**
 * The seven day bands are kept even when empty. Dropping them would be
 * consistent with every other view and wrong here: a week that hides its
 * clear days no longer shows you that Friday is free, only that Friday is
 * gone. The shape of the week *is* the information.
 * @param {Task[]} tasks @param {Task[]} overdue @param {string} ref @returns {Section[]}
 */
function weekSections(tasks, overdue, ref) {
  /** @type {Section[]} */
  const out = overdue.length ? [{ label: 'Overdue', flagged: true, tasks: overdue }] : [];
  for (let i = 0; i < WEEK_SPAN; i++) {
    const iso = addDays(ref, i);
    out.push({
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : stampDate(iso),
      flagged: false,
      tasks: tasks.filter((t) => t.status === 'open' && t.dueDate === iso).sort(byDueThenPriority),
      key: iso,
      collapsible: true,
      defaultOpen: i === 0,
    });
  }
  const loose = tasks.filter(isUndated).sort(byDueThenPriority);
  if (loose.length) {
    out.push({ label: 'No date', flagged: false, tasks: loose,
               key: UNDATED_KEY, collapsible: true, defaultOpen: false });
  }
  return out;
}

/** @param {number} ts @param {string} iso @returns {boolean} */
function sameDay(ts, iso) {
  const d = new Date(ts);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return local === iso;
}

/**
 * @param {Task[]} tasks
 * @param {string} [ref]
 * @returns {Record<ViewId, number>}
 */
export function viewCounts(tasks, ref = today()) {
  return {
    today: tasks.filter((t) => isOverdue(t, ref) || isDueToday(t, ref)).length,
    week: tasks.filter((t) => isOverdue(t, ref) || isInWeek(t, ref)).length,
    overdue: tasks.filter((t) => isOverdue(t, ref)).length,
    upcoming: tasks.filter((t) => isUpcoming(t, ref)).length,
    open: tasks.filter((t) => t.status === 'open' && t.repeat === null).length,
    completed: tasks.filter((t) => t.status === 'done').length,
  };
}

/**
 * Case-insensitive substring match across title and description.
 * @param {Task[]} tasks @param {string} query @returns {Task[]}
 */
export function search(tasks, query) {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter(
    (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  );
}

/** @param {Task[]} tasks @param {Priority | 'all'} p @returns {Task[]} */
export const filterPriority = (tasks, p) => (p === 'all' ? tasks : tasks.filter((t) => t.priority === p));
