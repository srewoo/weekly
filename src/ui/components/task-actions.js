// Every task write the screens make, each with its undo (spec D6, D7, L2).
// The screens never patch the DOM: storage changes re-render them.
// A failed write is said out loud in the toast (spec §6), never dropped.
import { createTask, setDone, toggleOn, updateTask, reschedule, copyToDay, deleteTask, restoreTask, archiveRecurring, restoreRecurring, isDoneOn } from '../../lib/tasks.js';
import { getSettings } from '../../lib/settings.js';
import { shortDate, today, addDays } from '../../lib/dates.js';
import { toast, report, GONE } from './undo.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {import('../../lib/tasks.js').Priority} Priority */
/** @typedef {import('../../lib/tasks.js').TaskDraft} TaskDraft */

/** Thrown when a write found no such task (deleted in another tab): updateTask & co resolve null. */
class Gone extends Error {}
/** @template T @param {T | null} r @returns {T} */
const applied = (r) => { if (r === null) throw new Gone(); return r; };

/**
 * @template {unknown[]} A
 * @param {(...args: A) => Promise<unknown>} fn
 * @returns {(...args: A) => Promise<boolean>} resolves false (after telling the user) if the write failed
 */
const guarded = (fn) => async (...args) => {
  try { await fn(...args); return true; } catch (e) {
    if (e instanceof Gone) toast(GONE); else report(e);
    // Put the screen back to what storage says (a ticked box or select may have moved).
    document.dispatchEvent(new Event('tasks:stale'));
    return false;
  }
};

/** Add a task with the settings' default priority (D2). */
export const add = guarded(/** @param {TaskDraft} draft */ async (draft) =>
  createTask(draft, /** @type {Priority} */ ((await getSettings()).defaultPriority)));

/** Tick or untick: a recurring task for `iso`, a one-off for good. */
export const toggle = guarded(/** @param {Task} t @param {string} iso */ async (t, iso) => {
  const nowDone = !isDoneOn(t, iso);
  // Undoing an untick restores the original completedAt, not now.
  /** @param {boolean} done */
  const write = (done) => (t.repeat ? toggleOn(t.id, iso, done) : setDone(t.id, done, t.completedAt ?? undefined));
  applied(await write(nowDone));
  toast(`${nowDone ? 'Done' : 'Reopened'}: ${t.title}`, () => write(!nowDone));
});

/** Change the due date (move to another day); null clears it. */
export const moveTo = guarded(/** @param {Task} t @param {string | null} iso */ async (t, iso) => {
  const was = t.dueDate;
  applied(await updateTask(t.id, { dueDate: iso }));
  toast(iso ? `Moved to ${shortDate(iso)}.` : 'Date cleared.', () => updateTask(t.id, { dueDate: was }));
});

/** Move open one-offs to tomorrow (D7). */
export const moveToTomorrow = guarded(/** @param {Task[]} tasks */ async (tasks) => {
  const open = tasks.filter((t) => t.repeat === null && t.status === 'open');
  const moved = await reschedule(open.map((t) => t.id));
  const n = moved.length;
  if (!n) { toast('Nothing to move.'); return; }
  toast(`Moved ${n} task${n === 1 ? '' : 's'} to tomorrow.`,
    () => Promise.all(open.filter((t) => moved.includes(t.id)).map((t) => updateTask(t.id, { dueDate: t.dueDate }))));
});

/** Copy a one-off to another day as a new open task (L2). */
export const copyTo = guarded(/** @param {Task} t @param {string} iso */ async (t, iso) => {
  const copy = applied(await copyToDay(t.id, iso));
  toast(`Copied to ${shortDate(iso)}.`, () => deleteTask(copy.id));
});

/**
 * Delete. A recurring task stops from `iso` and keeps its history (spec §4);
 * a one-off is removed and restored exactly, id and all, on undo.
 */
export const remove = guarded(/** @param {Task} t @param {string} [iso] */ async (t, iso = today()) => {
  if (t.repeat) {
    const until = t.repeat.until;
    applied(await archiveRecurring(t.id, iso));
    toast(`Stopped repeating “${t.title}”. Past days keep their ticks.`, () => restoreRecurring(t.id, until));
    return;
  }
  const snapshot = { ...t };
  applied((await deleteTask(t.id)) || null);
  toast('Task deleted.', () => restoreTask(snapshot));
});

/** Repeat a stopped daily task again (L6); Undo stops it on the same day as before. */
export const restart = guarded(/** @param {Task} t */ async (t) => {
  const until = t.repeat?.until;
  if (!t.repeat || !until) return;
  applied(await restoreRecurring(t.id));
  toast(`“${t.title}” repeats again.`, () => archiveRecurring(t.id, addDays(until, 1)));
});

/**
 * Delete for good (L6): the task and every tick it had. The one hard delete of a
 * daily task, so it asks first; Undo still puts it back, id and ticks included.
 */
export const purge = guarded(/** @param {Task} t */ async (t) => {
  if (!confirm(`Delete “${t.title}” and all its ticks? The calendar and stats forget it.`)) return;
  const snapshot = { ...t };
  applied((await deleteTask(t.id)) || null);
  toast('Deleted for good.', () => restoreTask(snapshot));
});

export const setPriority = guarded(/** @param {Task} t @param {Priority} p */ async (t, p) => applied(await updateTask(t.id, { priority: p })));
