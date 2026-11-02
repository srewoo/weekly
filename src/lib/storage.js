/**
 * The only module that talks to chrome.storage for tasks, UI state and reminder state.
 * From Daybook; storage.local only (settings live in settings.js, also local).
 *
 * Every write to the task list is a read-modify-write of a single array. The
 * side panel, the app tab, the reminder window and the service worker can all
 * issue one at the same instant: the evening alarm firing while you tick a
 * checkbox is the ordinary case. Two naive callers interleave as
 * read(A) read(B) write(A) write(B), and B silently discards A's change.
 *
 * Cross-context design: `withLock()` runs each read-modify-write under a Web
 * Lock. Every extension page and the service worker share one origin, so they
 * share one lock manager, and requests are granted in the order they were made.
 * That closes the popup-vs-worker race Phase 1 left open in settings.js. Where
 * `navigator.locks` is missing (Node tests), it falls back to a promise chain
 * per lock name, which serialises within one context only.
 */

import { migrate, coerceReminderState, coerceUiState, SCHEMA_VERSION } from './schema.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {import('./schema.js').ReminderState} ReminderState */
/** @typedef {import('./schema.js').UiState} UiState */

const KEY_TASKS = 'tasks';
const KEY_VERSION = 'schemaVersion';
const KEY_REMINDER = 'reminderState';
const KEY_UI = 'uiState';
export const TASKS_LOCK = 'weekly:tasks';
export const UI_LOCK = 'weekly:ui';
export const REMINDER_LOCK = 'weekly:reminders';

/** @type {Map<string, Promise<unknown>>} */
const chains = new Map();

/**
 * Run `fn` exclusively under the lock `name`, after every earlier request for it.
 * A throwing `fn` rejects its own promise and never blocks the next caller.
 * @template T
 * @param {string} name
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function withLock(name, fn) {
  const locks = globalThis.navigator?.locks;
  // request() resolves with fn's awaited result; lib.dom types it one Promise too deep.
  if (locks) return /** @type {Promise<T>} */ (/** @type {unknown} */ (locks.request(name, fn)));
  const run = (chains.get(name) ?? Promise.resolve()).then(fn);
  chains.set(name, run.catch(() => undefined));
  return run;
}

/* ------------------------------------------------------------------ tasks */

/** Unlocked read + in-memory migration; never writes. */
async function read() {
  return migrate(await chrome.storage.local.get([KEY_TASKS, KEY_VERSION]));
}

/**
 * Reads and, on a version change, persists only `tasks` and `schemaVersion`.
 * The write-back goes through mutate() so it re-reads under the lock and can
 * never overwrite a concurrent mutation with a stale migrated list.
 * @returns {Promise<Task[]>}
 */
export async function getTasks() {
  const { tasks, changed } = await read();
  if (!changed) return tasks;
  return mutate((cur) => ({ tasks: cur, result: cur }));
}

/**
 * Serialised read-modify-write. `fn` receives the current list and returns the
 * next one; it must be pure and must not close over a list read earlier.
 * Uses read(), not getTasks(): Web Locks are not re-entrant.
 *
 * @template T
 * @param {(tasks: Task[]) => { tasks: Task[], result: T }} fn
 * @returns {Promise<T>}
 */
export function mutate(fn) {
  return withLock(TASKS_LOCK, async () => {
    const { tasks, result } = fn((await read()).tasks);
    await chrome.storage.local.set({ [KEY_TASKS]: tasks, [KEY_VERSION]: SCHEMA_VERSION });
    return result;
  });
}

/**
 * Wholesale replacement, used by import and by "delete all".
 * @param {Task[]} tasks
 * @returns {Promise<void>}
 */
export async function replaceTasks(tasks) {
  await mutate(() => ({ tasks, result: undefined }));
}

/* --------------------------------------------------------------- ui state */

/** Which day bands are open. A per-machine presentation detail. @returns {Promise<UiState>} */
export async function getUiState() {
  const blob = await chrome.storage.local.get(KEY_UI);
  return coerceUiState(blob[KEY_UI]);
}

/**
 * Read-modify-write under UI_LOCK. Pass a function to change one band from the
 * current map: the side panel and the app tab each hold their own copy, and
 * writing a whole stale copy would drop the other's toggle.
 * @param {Partial<UiState> | ((current: UiState) => Partial<UiState>)} patch
 * @returns {Promise<UiState>}
 */
export function updateUiState(patch) {
  return withLock(UI_LOCK, async () => {
    const current = await getUiState();
    const next = coerceUiState({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
    await chrome.storage.local.set({ [KEY_UI]: next });
    return next;
  });
}

/* --------------------------------------------------------- reminder state */

/** @returns {Promise<ReminderState>} */
export async function getReminderState() {
  const blob = await chrome.storage.local.get(KEY_REMINDER);
  return coerceReminderState(blob[KEY_REMINDER]);
}

/**
 * Read-modify-write under REMINDER_LOCK: the worker marks a slot shown while
 * the reminder window snoozes, and neither may drop the other's field.
 * @param {Partial<ReminderState>} patch
 * @returns {Promise<ReminderState>}
 */
export function updateReminderState(patch) {
  return withLock(REMINDER_LOCK, async () => {
    const next = coerceReminderState({ ...(await getReminderState()), ...patch });
    await chrome.storage.local.set({ [KEY_REMINDER]: next });
    return next;
  });
}

/* ------------------------------------------------------------ change feed */

/**
 * Subscribe to task changes made by *any* context, so an open panel or tab
 * re-renders when the evening check moves everything to tomorrow.
 *
 * @param {(tasks: Task[]) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function onTasksChanged(onChange) {
  /** @type {Parameters<typeof chrome.storage.onChanged.addListener>[0]} */
  const listener = (changes, area) => {
    if (area !== 'local' || !(KEY_TASKS in changes)) return;
    const { tasks } = migrate({ tasks: changes[KEY_TASKS]?.newValue, schemaVersion: SCHEMA_VERSION });
    onChange(tasks);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
