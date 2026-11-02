/**
 * The shape of every task-side record Weekly persists, plus validation and migration.
 * From Daybook; settings stay in settings.js (storage.local, never sync).
 *
 * Anything crossing a trust boundary (an imported JSON file, a blob written by an
 * older or newer version) goes through `coerce*` before the UI sees it.
 */

import { isValidISODate, daysBetween, toISODate, today as todayISO } from './dates.js';

/** The key the trailing "No date" band collapses under. It has no date to age out. */
export const UNDATED_KEY = 'undated';

/** v1: Daybook's task. v2: adds `repeat` and `doneDates` (Weekly 3). */
export const SCHEMA_VERSION = 2;

/** @typedef {'high' | 'medium' | 'low'} Priority */
/** @typedef {'open' | 'done'} Status */

/**
 * A recurring task occurs on `days` (0=Sun … 6=Sat) from `from` until `until`, inclusive.
 * @typedef {object} Repeat
 * @property {number[]} days
 * @property {string} from            ISO local date
 * @property {string | null} until    ISO local date, or null while active
 */

/**
 * @typedef {object} Task
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {Priority} priority
 * @property {string | null} dueDate      ISO local date, or null (always null when recurring)
 * @property {Status} status              always 'open' when recurring
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number | null} completedAt
 * @property {Repeat | null} repeat
 * @property {string[]} doneDates         days a recurring task was ticked, sorted; [] for one-offs
 */

/**
 * Which collapsible day bands the user has opened or closed. Absent keys mean
 * "whatever the view says by default", so the map only holds deliberate overrides.
 *
 * @typedef {object} UiState
 * @property {Record<string, 'open' | 'closed'>} dayState  keyed by ISO date, or 'undated'
 */

/**
 * @typedef {object} ReminderState
 * @property {string | null} morningLastShown
 * @property {string | null} eveningLastShown
 */

export const PRIORITIES = /** @type {const} */ (['high', 'medium', 'low']);
export const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
export const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

export const TITLE_MAX = 200;
export const DESC_MAX = 2000;
/** Ten years of daily ticks; bounds what an imported file can make us store. */
export const DONE_DATES_MAX = 3660;
export const WORKWEEK = Object.freeze([1, 2, 3, 4, 5]);

/** @returns {UiState} */
export const defaultUiState = () => ({ dayState: {} });

/** @returns {ReminderState} */
export const defaultReminderState = () => ({
  morningLastShown: null,
  eveningLastShown: null,
});

/**
 * Collision-resistant local id. `crypto.getRandomValues` is available in the
 * service worker and every extension page, so there is no Math.random fallback.
 * @returns {string}
 */
export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (const b of bytes) out += b.toString(36).padStart(2, '0');
  return `t_${out.slice(0, 12)}`;
}

const isObj = /** @param {unknown} v @returns {v is Record<string, unknown>} */ (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** @param {unknown} v @param {number} max @returns {string} */
const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);

/** @param {unknown} v @param {number} fallback @returns {number} */
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** @param {unknown} v @returns {v is string} */
const isoDate = (v) => typeof v === 'string' && isValidISODate(v);

/** @param {unknown} v @returns {Priority | null} */
export const coercePriority = (v) =>
  typeof v === 'string' && PRIORITIES.includes(/** @type {Priority} */ (v.toLowerCase()))
    ? /** @type {Priority} */ (v.toLowerCase())
    : null;

/**
 * Weekdays 0–6, unique and sorted. Nothing usable means Monday to Friday:
 * a recurring task that can never occur is a silent bug, not a choice.
 * @param {unknown} raw @returns {number[]}
 */
export function coerceDays(raw) {
  const days = Array.isArray(raw)
    ? [...new Set(raw.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b)
    : [];
  return days.length ? days : [...WORKWEEK];
}

/** @param {unknown} raw @param {number} createdAt @returns {Repeat | null} */
function coerceRepeat(raw, createdAt) {
  if (!isObj(raw)) return null;
  return {
    days: coerceDays(raw['days']),
    from: isoDate(raw['from']) ? raw['from'] : toISODate(new Date(createdAt)),
    until: isoDate(raw['until']) ? raw['until'] : null,
  };
}

/** @param {unknown} raw @returns {string[]} */
function coerceDoneDates(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isoDate))].sort().slice(-DONE_DATES_MAX);
}

/**
 * Coerce one untrusted record into a Task, or reject it.
 * A record with no usable title is not a task and is dropped rather than
 * repaired: a blank row is worse than a missing one.
 *
 * @param {unknown} raw
 * @returns {Task | null}
 */
export function coerceTask(raw) {
  if (!isObj(raw)) return null;
  const title = str(raw['title'], TITLE_MAX).trim();
  if (!title) return null;

  const createdAt = num(raw['createdAt'], Date.now());
  const repeat = coerceRepeat(raw['repeat'], createdAt);
  // A recurring task is ticked per day in doneDates; its status never closes.
  const status = !repeat && raw['status'] === 'done' ? 'done' : 'open';

  return {
    id: typeof raw['id'] === 'string' && raw['id'].trim() ? raw['id'].trim().slice(0, 64) : newId(),
    title,
    description: str(raw['description'], DESC_MAX),
    priority: coercePriority(raw['priority']) ?? 'medium',
    dueDate: !repeat && isoDate(raw['dueDate']) ? raw['dueDate'] : null,
    status,
    createdAt,
    updatedAt: num(raw['updatedAt'], createdAt),
    completedAt: status === 'done' ? num(raw['completedAt'], createdAt) : null,
    repeat,
    doneDates: repeat ? coerceDoneDates(raw['doneDates']) : [],
  };
}

/**
 * @param {unknown} raw
 * @returns {{ tasks: Task[], dropped: number, duplicates: number }}
 */
export function coerceTaskList(raw) {
  if (!Array.isArray(raw)) return { tasks: [], dropped: 0, duplicates: 0 };
  /** @type {Task[]} */
  const tasks = [];
  const seen = new Set();
  let dropped = 0, duplicates = 0;
  for (const item of raw) {
    const t = coerceTask(item);
    if (!t) { dropped++; continue; }
    if (seen.has(t.id)) { duplicates++; continue; }
    seen.add(t.id);
    tasks.push(t);
  }
  return { tasks, dropped, duplicates };
}

/**
 * Coerce a stored UI-state blob, dropping day overrides that have aged out.
 *
 * Pruning happens on every read rather than on a schedule: the panel opens
 * often and nothing else would ever get round to it, and without it the map
 * grows by up to seven keys a week for the life of the profile.
 *
 * @param {unknown} raw
 * @param {string} [ref] today, as an ISO local date
 * @returns {UiState}
 */
export function coerceUiState(raw, ref = todayISO()) {
  const d = defaultUiState();
  if (!isObj(raw) || !isObj(raw['dayState'])) return d;

  /** @type {Record<string, 'open' | 'closed'>} */
  const dayState = {};
  for (const [key, value] of Object.entries(raw['dayState'])) {
    if (value !== 'open' && value !== 'closed') continue;
    if (key === UNDATED_KEY) { dayState[key] = value; continue; }
    if (!isValidISODate(key) || daysBetween(ref, key) < 0) continue;
    dayState[key] = value;
  }
  return { dayState };
}

/**
 * @param {unknown} raw
 * @returns {ReminderState}
 */
export function coerceReminderState(raw) {
  const d = defaultReminderState();
  if (!isObj(raw)) return d;
  /** @param {unknown} v @returns {string | null} */
  const day = (v) => (isoDate(v) ? v : null);
  return {
    morningLastShown: day(raw['morningLastShown']),
    eveningLastShown: day(raw['eveningLastShown']),
  };
}

/**
 * Bring the stored task blob up to the current schema version.
 *
 * v0 → v1: pre-versioned data (and every Weekly 2 profile, which has no tasks).
 * v1 → v2: adds `repeat: null` and `doneDates: []`.
 * Both steps are the same pass: `coerceTaskList` backfills every field. Only
 * `tasks` and `schemaVersion` are ever written; Weekly 2's keys (activity,
 * notes, settings) are not read or touched here: notes.js converts notes by shape.
 *
 * @param {unknown} raw  `{ tasks, schemaVersion }` as read from storage
 * @returns {{ tasks: Task[], schemaVersion: number, changed: boolean }}
 */
export function migrate(raw) {
  const blob = isObj(raw) ? raw : {};
  const from = num(blob['schemaVersion'], 0);
  const { tasks } = coerceTaskList(blob['tasks']);
  return { tasks, schemaVersion: SCHEMA_VERSION, changed: from !== SCHEMA_VERSION };
}
