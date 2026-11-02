/**
 * Task writes, plus one import site for the whole task domain: the UI imports
 * views and recurrence from here rather than reaching into three modules.
 * From Daybook, extended with recurrence (spec §4).
 */

import { mutate, getTasks } from './storage.js';
import { newId, TITLE_MAX, DESC_MAX, PRIORITIES, coerceDays, coerceTask } from './schema.js';
import { today, tomorrow, isValidISODate, addDays } from './dates.js';
import { occursOn } from './recurrence.js';

export { getTasks };
export * from './task-views.js';
export * from './recurrence.js';
export * from './planner.js';
export { PRIORITIES, PRIORITY_LABEL, TITLE_MAX, DESC_MAX, UNDATED_KEY, WORKWEEK } from './schema.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {import('./schema.js').Priority} Priority */

/**
 * @typedef {object} TaskDraft
 * @property {string} title
 * @property {string} [description]
 * @property {Priority} [priority]
 * @property {string | null} [dueDate]          ignored when `repeat` is set
 * @property {{ days?: number[] } | null} [repeat]  recurring from today; days default Mon–Fri
 */

/** @param {unknown} p @returns {p is Priority} */
const isPriority = (p) => PRIORITIES.includes(/** @type {Priority} */ (p));

/**
 * @param {TaskDraft} draft
 * @param {Priority} [fallbackPriority]  the settings' defaultPriority; anything invalid means 'medium'
 * @returns {Promise<Task>}
 */
export async function createTask(draft, fallbackPriority = 'medium') {
  const title = draft.title.trim().slice(0, TITLE_MAX);
  if (!title) throw new Error('A task needs a title.');

  const now = Date.now();
  const repeat = draft.repeat ? { days: coerceDays(draft.repeat.days), from: today(), until: null } : null;
  /** @type {Task} */
  const task = {
    id: newId(),
    title,
    description: (draft.description ?? '').slice(0, DESC_MAX),
    priority: isPriority(draft.priority) ? draft.priority : isPriority(fallbackPriority) ? fallbackPriority : 'medium',
    dueDate: !repeat && draft.dueDate && isValidISODate(draft.dueDate) ? draft.dueDate : null,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    repeat,
    doneDates: [],
  };
  await mutate((tasks) => ({ tasks: [...tasks, task], result: undefined }));
  return task;
}

/**
 * Apply `fn` to the task with `id` in one serialised write. `fn` returns the
 * changed task, or null to leave it alone. Resolves to the saved task or null.
 * @param {string} id
 * @param {(t: Task) => Task | null} fn
 * @returns {Promise<Task | null>}
 */
function patchOne(id, fn) {
  return mutate((tasks) => {
    /** @type {Task | null} */
    let updated = null;
    const next = tasks.map((t) => {
      const changed = t.id === id ? fn(t) : null;
      if (!changed) return t;
      updated = { ...changed, updatedAt: Date.now() };
      return updated;
    });
    return { tasks: next, result: updated };
  });
}

/**
 * A recurring task's dueDate stays null whatever the patch says.
 * @param {string} id
 * `repeatDays` changes a recurring task's weekdays (ignored for a one-off; nothing usable keeps the old days).
 * ponytail: the new days apply to past days too (the calendar re-reads them); split into old/new tasks if history must hold.
 * @param {Partial<Pick<Task, 'title' | 'description' | 'priority' | 'dueDate'>> & { repeatDays?: number[] }} patch
 * @returns {Promise<Task | null>}
 */
export async function updateTask(id, patch) {
  return patchOne(id, (t) => {
    const title = patch.title !== undefined ? patch.title.trim().slice(0, TITLE_MAX) : t.title;
    return {
      ...t,
      title: title || t.title,
      description: patch.description !== undefined ? patch.description.slice(0, DESC_MAX) : t.description,
      priority: isPriority(patch.priority) ? patch.priority : t.priority,
      dueDate: t.repeat || patch.dueDate === undefined ? t.dueDate
        : patch.dueDate && isValidISODate(patch.dueDate) ? patch.dueDate : null,
      repeat: t.repeat && Array.isArray(patch.repeatDays) && patch.repeatDays.length
        ? { ...t.repeat, days: coerceDays(patch.repeatDays) } : t.repeat,
    };
  });
}

/**
 * Close or reopen a one-off task. Recurring tasks are ticked per day with
 * toggleOn(); setDone leaves them alone and resolves null.
 * @param {string} id
 * @param {boolean} done
 * @param {number} [at] completedAt to stamp when closing, default now (an undo passes the original)
 * @returns {Promise<Task | null>}
 */
export async function setDone(id, done, at = Date.now()) {
  return patchOne(id, (t) => (t.repeat ? null : {
    ...t,
    status: done ? 'done' : 'open',
    completedAt: done ? at : null,
  }));
}

/** @param {string} id @returns {Promise<Task | null>} */
export async function toggleDone(id) {
  return patchOne(id, (t) => {
    if (t.repeat) return null;
    const done = t.status === 'open';
    return { ...t, status: done ? 'done' : 'open', completedAt: done ? Date.now() : null };
  });
}

/**
 * Tick or untick a recurring task for one day. Null if the task is not
 * recurring or does not occur on `iso`. `want` sets the state (a no-op if it
 * already is); absent, it flips. Undo passes it so it never flips the wrong way.
 * @param {string} id @param {string} iso @param {boolean} [want]
 * @returns {Promise<Task | null>}
 */
export async function toggleOn(id, iso, want) {
  return patchOne(id, (t) => {
    if (!occursOn(t, iso)) return null;
    const has = t.doneDates.includes(iso);
    if ((want ?? !has) === has) return t;
    const doneDates = has
      ? t.doneDates.filter((d) => d !== iso)
      : [...t.doneDates, iso].sort();
    return { ...t, doneDates };
  });
}

/**
 * "Delete" for a recurring task: it stops the day before `iso`, so every past
 * day in the calendar keeps its history. Null for a one-off.
 * @param {string} id @param {string} [iso] the day of the delete, default today
 * @returns {Promise<Task | null>}
 */
export async function archiveRecurring(id, iso = today()) {
  return patchOne(id, (t) => (t.repeat ? { ...t, repeat: { ...t.repeat, until: addDays(iso, -1) } } : null));
}

/**
 * Undo an archive: the task occurs again, ending on `until` (its earlier end date, default none).
 * ponytail: one `until`, so days inside the archived gap count again on restore;
 * store archive ranges if the calendar must show the gap.
 * @param {string} id
 * @param {string | null} [until]
 * @returns {Promise<Task | null>}
 */
export async function restoreRecurring(id, until = null) {
  return patchOne(id, (t) => (t.repeat ? { ...t, repeat: { ...t.repeat, until } } : null));
}

/**
 * Hard delete, for any task. For a recurring task this erases its history,
 * so the UI confirms first and offers archiveRecurring() as the normal delete.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteTask(id) {
  return mutate((tasks) => {
    const next = tasks.filter((t) => t.id !== id);
    return { tasks: next, result: next.length !== tasks.length };
  });
}

/**
 * Move open one-off tasks to `date`: the evening loop's "Move to tomorrow" and
 * the day sheet's "move to another day". Recurring and closed tasks are skipped.
 * @param {string[]} ids
 * @param {string} [date]
 * @returns {Promise<string[]>} the ids that moved (the caller's Undo restores only these)
 */
export async function reschedule(ids, date = tomorrow()) {
  if (!isValidISODate(date)) return [];
  const set = new Set(ids);
  return mutate((tasks) => {
    /** @type {string[]} */
    const moved = [];
    const next = tasks.map((t) => {
      if (!set.has(t.id) || t.status !== 'open' || t.repeat) return t;
      moved.push(t.id);
      return { ...t, dueDate: date, updatedAt: Date.now() };
    });
    return { tasks: next, result: moved };
  });
}

/**
 * Copy a one-off task to another day as a new open task.
 * Null if the task is missing or recurring, or the date is not a real day.
 * @param {string} id @param {string} iso
 * @returns {Promise<Task | null>}
 */
export async function copyToDay(id, iso) {
  if (!isValidISODate(iso)) return null;
  return mutate((tasks) => {
    const src = tasks.find((t) => t.id === id && t.repeat === null);
    if (!src) return { tasks, result: null };
    const now = Date.now();
    /** @type {Task} */
    const copy = { ...src, id: newId(), dueDate: iso, status: 'open', completedAt: null, createdAt: now, updatedAt: now };
    return { tasks: [...tasks, copy], result: copy };
  });
}

/**
 * Put a deleted task back exactly as it was, id and completedAt included: the
 * undo for deleteTask. A task with that id already present wins.
 * @param {Task} snapshot
 * @returns {Promise<boolean>} whether it was restored
 */
export async function restoreTask(snapshot) {
  const task = coerceTask(snapshot);
  return mutate((tasks) => (!task || tasks.some((t) => t.id === task.id)
    ? { tasks, result: false }
    : { tasks: [...tasks, task], result: true }));
}
