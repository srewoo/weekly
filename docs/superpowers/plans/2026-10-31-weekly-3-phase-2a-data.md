# Weekly 3.0, Phase 2a: Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Daybook's task data layer into Weekly (schema v2 with recurrence, one locked `mutate()`, task writes, views, Done-section data), split `classify`, close the Phase 1 data-layer leftovers, and set an explicit CSP. Phase 2a changes no UI.

**Architecture:**
- `src/lib/schema.js` and `src/lib/storage.js` come from Daybook, on `storage.local` only. Settings stay in `src/lib/settings.js`.
- Daybook's `tasks.js` is over 300 lines, so it is split three ways:
  - `task-views.js`: pure due-state predicates, sections, counts and search.
  - `recurrence.js`: pure per-day questions (`occursOn`, `dayCompletion`, `doneInRange`).
  - `tasks.js`: every write, plus re-exports of the other two, so the UI imports the task domain from one place.
- Writes to tasks and settings run under a Web Lock (`withLock`), shared by every extension page and the service worker. Node tests fall back to a per-context promise chain.

**Tech Stack:**
- Chrome MV3 with a module service worker; plain ES2022 modules, no bundler.
- `node:test` in two timezones; `tsc --strict` over JSDoc; Playwright + Chromium for end-to-end tests.

**Spec:**
- `docs/superpowers/specs/2026-10-31-weekly-feature-parity.md`: Phase 2a rows D1, D12, D13, D14, L1 (model) and L6 (model), plus the `classify` split.
- `docs/superpowers/specs/2026-10-31-weekly-merge-design.md`: §4 is authoritative for `Task` and storage, and §5 sets the rules.
- Phase 1 carry-overs: `docs/superpowers/plans/2026-10-31-weekly-3-phase-1-ledger.md`.

**Deliberate scope cuts, each recorded in the self-review:**
- **Notes:** Weekly 2's `{id, ts, text}` notes are left alone. They migrate in Phase 4.
- **Settings:** Daybook's reminder settings (`coerceSettings` and its 5 tests) arrive with reminders in Phase 3. Only `defaultPriority` joins Weekly's `DEFAULTS` now.
- **Reminder tests:** Daybook's `reminders.test.js` (20 tests) and `service-worker.test.js` (8 tests) come with `reminders.js` in Phase 3.
- **Task export:** Daybook's `exportTasks()` needs the `downloads` permission and the Phase 5 export UI, so it waits for Phase 5.

## Global Constraints

- **No version control.**
  - Never run `git`. The controller keeps the ledger, so no step commits.
  - Never edit this plan file.
  - Rollback point: `snapshots/weekly-2.0.0-source-2026-10-31.zip`.
- **Storage:**
  - Local storage only. Nothing reads or writes `chrome.storage.sync`.
  - Weekly 2's keys (`day:*`, `hist:*`, `meta:*`, `imp:*:*`, `excluded:*`, `draft:*:*`, `notes`, `settings`, `deviceId`, `imports`, `shareOk`) are never rewritten by migration.
  - Nothing in Phase 2a calls `getTasks()` at worker startup. The end-to-end check "delete all keeps only settings and device ID" depends on it.
- **Layering:**
  - `src/lib/` never touches the DOM.
  - `src/ui/` is not changed in Phase 2a. Phase 1's documented direct-storage exceptions stand.
- **No HTML sinks:** no `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src/`, and `test/no-innerhtml.test.js` stays green.
- **Size:** no file over 300 lines and no function over 50 lines.
- **Dates:** local-calendar ISO strings (`YYYY-MM-DD`). Never `new Date('YYYY-MM-DD')`; use `src/lib/dates.js`.
- **Node and tests:**
  - Node ≥ 22.
  - `node --test` takes globs, never a directory. A directory fails on Node 22.
  - Every test file lives under `test/`, never `src/`, because the build ships `src/` wholesale.
- **Dependencies:** no runtime dependencies. Dev dependencies stay `typescript@^5.5.4` and `@types/chrome@^0.0.268`.
- **Typecheck:** `npm run typecheck` (`tsc --strict`, `noUncheckedIndexedAccess`) covers `src/lib/**` and `src/background/**` and must stay clean.
- **Gates:**
  - Every task ends with `npm test` green, which runs New York and Kolkata time.
  - Tasks 5 and 8 also end with `npm run e2e` reporting `104/104 passed`. There is no UI change.

## File map (end state of Phase 2a)

```
manifest.json                         + content_security_policy.extension_pages (D13)
README.md                             Layout lists the new lib files; storage rule mentions withLock
src/lib/schema.js          new       Task v2 (repeat, doneDates), coerce*, migrate, SCHEMA_VERSION = 2
src/lib/storage.js         new       withLock, getTasks, mutate, replaceTasks, uiState, reminderState, onTasksChanged
src/lib/task-views.js      new       Daybook views: isOverdue … sectionsFor, viewCounts, search, filterPriority
src/lib/recurrence.js      new       occursOn, isDoneOn, isArchived, recurringOn, extrasOn, dayCompletion, occurrences, doneInRange
src/lib/tasks.js           new       createTask, updateTask, setDone, toggleDone, toggleOn, archiveRecurring,
                                      restoreRecurring, deleteTask, reschedule, copyToDay; re-exports views + recurrence
src/lib/task-portability.js new      Daybook backup parseImport, mergeTasks, replaceAll, deleteEverything
src/lib/settings.js        modified  defaultPriority; updateSettings under withLock
src/lib/week.js            modified  isWorkday via fromISODate; expiredKeys calendar-day cutoff
src/lib/activity/classify.js modified per-family matchers, each ≤ 50 lines
src/background/service-worker.js modified settings changes via onSettingsChanged
test/schema.test.js  test/uistate.test.js  test/storage.test.js  test/tasks.test.js
test/tasks-week.test.js  test/task-portability.test.js        Daybook ports
test/schema-v2.test.js  test/storage-v2.test.js  test/recurrence.test.js  test/tasks-recurring.test.js
test/background/service-worker.test.js  test/activity/classify-golden.test.js  test/manifest.test.js   new
test/settings.test.js  test/week.test.js                       extended
```

Daybook test ledger (101 tests in Daybook's suite):

| Daybook file | Tests | Phase 2a |
|---|---|---|
| `dates.test.js` | 11 | already ported in Phase 1 |
| `schema.test.js` | 16 | 11 ported (Task 1); 5 settings tests go to Phase 3 |
| `uistate.test.js` | 7 | ported, with the date-bomb test fixed (Task 2) |
| `storage.test.js` | 5 | ported (Task 3) |
| `tasks.test.js` | 13 | ported (Task 3) |
| `week.test.js` | 11 | ported as `tasks-week.test.js` (Task 3) |
| `portability.test.js` | 10 | ported as `task-portability.test.js` (Task 4) |
| `reminders.test.js` | 20 | Phase 3 (with `reminders.js`) |
| `service-worker.test.js` | 8 | Phase 3 (with the reminder worker) |

Total: 68 of 101 run after Phase 2a, and the other 33 are scheduled for Phase 3.

---

### Task 1: Schema v2

**Files:**
- Create: `src/lib/schema.js`, `test/schema.test.js` (Daybook port), `test/schema-v2.test.js`

**Interfaces:**
- Consumes: `src/lib/dates.js` (`isValidISODate`, `daysBetween`, `toISODate`, `today`).
- Produces (`src/lib/schema.js`):
  - Types:
    - `Task {id, title, description, priority, dueDate: string|null, status: 'open'|'done', createdAt, updatedAt, completedAt: number|null, repeat: Repeat|null, doneDates: string[]}`
    - `Repeat {days: number[], from: string, until: string|null}`
    - `Priority`, `UiState`, `ReminderState`
  - Constants: `SCHEMA_VERSION = 2`, `UNDATED_KEY`, `PRIORITIES`, `PRIORITY_RANK`, `PRIORITY_LABEL`, `TITLE_MAX = 200`, `DESC_MAX = 2000`, `DONE_DATES_MAX = 3660`, `WORKWEEK`.
  - Functions:
    - `newId(): string`
    - `coercePriority(v: unknown): Priority|null`
    - `coerceDays(raw: unknown): number[]`
    - `coerceTask(raw: unknown): Task|null`
    - `coerceTaskList(raw): {tasks, dropped, duplicates}`
    - `coerceUiState(raw, ref?): UiState`
    - `coerceReminderState(raw): ReminderState`
    - `defaultUiState()`, `defaultReminderState()`
    - `migrate(raw): {tasks: Task[], schemaVersion: number, changed: boolean}`

- [ ] **Step 1: Port Daybook's schema test**

```bash
cd /Users/sharajrewoo/DemoReposQA/weekly
cp ../Daybook/test/schema.test.js test/schema.test.js
```

Edit `test/schema.test.js` exhaustively:
1. Replace the import block (Daybook lines 6–9) with:

```js
import {
  coerceTask, coerceTaskList, coerceReminderState,
  migrate, newId, SCHEMA_VERSION, TITLE_MAX, DESC_MAX,
} from '../src/lib/schema.js';
```

2. Delete the four tests named `coerceSettings falls back to defaults for any unusable input`, `coerceSettings rejects an invalid time but keeps the rest of the slot`, `coerceSettings sanitises the days array` and `coerceSettings tolerates an unknown field from a future version` (Daybook lines 73–93).
3. Delete the last test, `defaultPopupView accepts the three views and defaults to week` (Daybook lines 126–132). These five tests move to Phase 3 with the reminder settings.

Run: `grep -c "^test(" test/schema.test.js`
Expected: `11`

- [ ] **Step 2: Write the failing v2 test**

Create `test/schema-v2.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { addDays } from '../src/lib/dates.js';
import { coerceTask, coerceDays, coercePriority, migrate, SCHEMA_VERSION, DONE_DATES_MAX } from '../src/lib/schema.js';

test('the schema is version 2', () => {
  assert.equal(SCHEMA_VERSION, 2);
});

test('a one-off task gets repeat null and no done dates', () => {
  const t = coerceTask({ title: 'Send the deck', doneDates: ['2026-10-30'] });
  assert.equal(t?.repeat, null);
  assert.deepEqual(t?.doneDates, [], 'a one-off is ticked by status, never by date');
});

test('a recurring task keeps its days, from and until', () => {
  const t = coerceTask({ title: 'Standup notes', repeat: { days: [5, 1, 3], from: '2026-10-01', until: '2026-10-30' } });
  assert.deepEqual(t?.repeat, { days: [1, 3, 5], from: '2026-10-01', until: '2026-10-30' });
});

test('a recurring task never carries a due date or a closed status', () => {
  const t = coerceTask({ title: 'x', repeat: {}, dueDate: '2026-10-30', status: 'done', completedAt: 5 });
  assert.equal(t?.dueDate, null);
  assert.equal(t?.status, 'open');
  assert.equal(t?.completedAt, null);
});

test('repeat with junk falls back to weekdays, counted from the created date', () => {
  const createdAt = new Date(2026, 9, 12, 15, 0).getTime();
  const t = coerceTask({ title: 'x', createdAt, repeat: { days: [9, 'x'], from: '2026-02-31', until: 'never' } });
  assert.deepEqual(t?.repeat, { days: [1, 2, 3, 4, 5], from: '2026-10-12', until: null });
});

test('done dates are validated, de-duplicated, sorted and capped', () => {
  const t = coerceTask({ title: 'x', repeat: {}, doneDates: ['2026-10-30', 'nope', '2026-10-28', '2026-10-30', '2026-02-31', 7] });
  assert.deepEqual(t?.doneDates, ['2026-10-28', '2026-10-30']);
  const many = Array.from({ length: DONE_DATES_MAX + 10 }, (_, i) => addDays('2000-01-01', i));
  const huge = coerceTask({ title: 'x', repeat: {}, doneDates: many });
  assert.equal(huge?.doneDates.length, DONE_DATES_MAX);
  assert.equal(huge?.doneDates.at(-1), many.at(-1), 'the cap keeps the most recent days');
});

test('coerceDays keeps 0–6 integers only and never returns an empty week', () => {
  assert.deepEqual(coerceDays([6, 0, 0, 3]), [0, 3, 6]);
  assert.deepEqual(coerceDays([]), [1, 2, 3, 4, 5]);
  assert.deepEqual(coerceDays('mon'), [1, 2, 3, 4, 5]);
});

test('coercePriority accepts any case and rejects the rest', () => {
  assert.equal(coercePriority('LOW'), 'low');
  assert.equal(coercePriority('urgent'), null);
  assert.equal(coercePriority(undefined), null);
});

test('migrate v1 → v2 backfills repeat and doneDates and reports the change', () => {
  const v1 = { schemaVersion: 1, tasks: [{ id: 'a', title: 'Daybook task', priority: 'high', dueDate: '2026-10-30' }] };
  const out = migrate(v1);
  assert.equal(out.changed, true);
  assert.equal(out.schemaVersion, 2);
  assert.equal(out.tasks[0]?.repeat, null);
  assert.deepEqual(out.tasks[0]?.doneDates, []);
  assert.equal(out.tasks[0]?.dueDate, '2026-10-30', 'v1 fields survive');
});

test('migrate v2 → v2 is a no-op that keeps recurrence', () => {
  const t = coerceTask({ title: 'x', repeat: { days: [1], from: '2026-10-05', until: null }, doneDates: ['2026-10-26'] });
  const out = migrate({ schemaVersion: 2, tasks: [t] });
  assert.equal(out.changed, false);
  assert.deepEqual(out.tasks, [t]);
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npm run test:ny`
Expected: `schema.test.js` and `schema-v2.test.js` fail with `Cannot find module '…/src/lib/schema.js'`. Everything else passes.

- [ ] **Step 4: Create `src/lib/schema.js`**

This is Daybook's `schema.js` with the `Settings` typedef, `defaultSettings`, `coerceSettings` and `POPUP_VIEWS` removed (settings stay in `settings.js`), `SCHEMA_VERSION` set to 2, and `repeat`/`doneDates` added. Write the whole file:

```js
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
 * @property {number | null} snoozeUntil
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
  snoozeUntil: null,
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
    snoozeUntil: typeof raw['snoozeUntil'] === 'number' && Number.isFinite(raw['snoozeUntil'])
      ? raw['snoozeUntil']
      : null,
  };
}

/**
 * Bring the stored task blob up to the current schema version.
 *
 * v0 → v1: pre-versioned data (and every Weekly 2 profile, which has no tasks).
 * v1 → v2: adds `repeat: null` and `doneDates: []`.
 * Both steps are the same pass: `coerceTaskList` backfills every field. Only
 * `tasks` and `schemaVersion` are ever written; Weekly 2's keys (activity,
 * notes, settings) are not read or touched here. Notes move in Phase 4.
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
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected:
- Both timezones pass: 67 existing tests, 11 in `schema.test.js` and 10 in `schema-v2.test.js`.
- `tsc` exits 0.

---

### Task 2: Storage with one cross-context lock

**Files:**
- Create: `src/lib/storage.js`, `test/uistate.test.js` (Daybook port, date bomb fixed), `test/storage-v2.test.js`

**Interfaces:**
- Consumes (Task 1): `migrate`, `coerceUiState`, `coerceReminderState`, `defaultReminderState`, `SCHEMA_VERSION`.
- Produces (`src/lib/storage.js`):
  - Lock:
    - `withLock<T>(name: string, fn: () => Promise<T>): Promise<T>`
    - `TASKS_LOCK = 'weekly:tasks'`
  - Tasks:
    - `getTasks(): Promise<Task[]>`
    - `mutate<T>(fn: (tasks: Task[]) => {tasks: Task[], result: T}): Promise<T>`
    - `replaceTasks(tasks): Promise<void>`
  - UI state: `getUiState(): Promise<UiState>`, `updateUiState(patch): Promise<UiState>`
  - Reminder state: `getReminderState()`, `updateReminderState(patch)`, `resetReminderState()`
  - Change feed: `onTasksChanged(cb: (tasks: Task[]) => void): () => void`
- No settings functions. Daybook's sync-backed `getSettings`, `updateSettings` and `onSettingsChanged` are not ported, because `src/lib/settings.js` owns settings.

- [ ] **Step 1: Write the uistate test, relative to today**

Daybook's `uistate.test.js:27` writes a fixed date (`2026-08-20`) and reads it back through `getUiState()`, which prunes days before *today*. The test passed until that date went by. The fix keeps every assertion and makes every date relative to today. Create `test/uistate.test.js`:

```js
/**
 * Popup UI state — which day bands the user has opened or closed.
 *
 * It lives in storage.local rather than sync on purpose: sync caps at 100KB
 * across every key, and a per-day map that grew unbounded would eventually
 * start throwing QUOTA_BYTES in the middle of a settings write.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const { getUiState, updateUiState } = await import('../src/lib/storage.js');
const { coerceUiState, defaultUiState } = await import('../src/lib/schema.js');
const { today, addDays } = await import('../src/lib/dates.js');

// Relative to the real today: getUiState() prunes against today(), so a fixed
// date here turns into a failing test the day after it passes.
const REF = today();
/** @param {number} n */
const day = (n) => addDays(REF, n);

async function reset() {
  for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k];
}

test('an absent blob reads as the default, not a crash', async () => {
  await reset();
  assert.deepEqual(await getUiState(), defaultUiState());
});

test('a day the user closed is still closed on the next read', async () => {
  await reset();
  await updateUiState({ dayState: { [REF]: 'closed' } });
  assert.equal((await getUiState()).dayState[REF], 'closed');
});

test('a day the user opened is remembered too — overrides run both ways', () => {
  const state = coerceUiState({ dayState: { [REF]: 'open' } }, REF);
  assert.equal(state.dayState[REF], 'open');
});

test('days before today are pruned, so the map cannot grow without bound', () => {
  const state = coerceUiState({
    dayState: { [day(-19)]: 'open', [day(-1)]: 'closed', [REF]: 'closed', [day(5)]: 'open' },
  }, REF);
  assert.deepEqual(Object.keys(state.dayState).sort(), [REF, day(5)]);
});

test('the undated band is exempt from pruning — it has no date to age out', () => {
  const state = coerceUiState({ dayState: { undated: 'open' } }, REF);
  assert.equal(state.dayState.undated, 'open');
});

test('junk in the blob is dropped rather than rendered', () => {
  const state = coerceUiState({
    dayState: { 'not-a-date': 'open', [REF]: 'sideways', [day(1)]: 'open' },
  }, REF);
  assert.deepEqual(state.dayState, { [day(1)]: 'open' });
});

test('a non-object blob falls back to the default', () => {
  assert.deepEqual(coerceUiState('nonsense', REF), defaultUiState());
  assert.deepEqual(coerceUiState(null, REF), defaultUiState());
});
```

- [ ] **Step 2: Write the failing storage test**

Create `test/storage-v2.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const { getTasks, mutate, withLock, TASKS_LOCK } = await import('../src/lib/storage.js');

const WEEKLY2 = {
  'day:2026-10-30': { 'jira:ENGX-1': { category: 'Tickets', task: 'ENGX-1', url: '', ms: 60000, first: 1, last: 2, tickets: [] } },
  'meta:2026-10-30': { switches: 3 },
  notes: [{ id: 1, ts: 1761800000000, text: 'Called the vendor' }],
  settings: { role: 'hr', anonymize: true },
  deviceId: 'dev-1',
};

function reset(/** @type {Record<string, unknown>} */ seed) {
  for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k];
  Object.assign(ctx.stores.local, structuredClone(seed));
}

test('first read on a Weekly 2 profile adds tasks + schemaVersion and touches nothing else', async () => {
  reset(WEEKLY2);
  assert.deepEqual(await getTasks(), []);
  const { tasks, schemaVersion, ...rest } = ctx.stores.local;
  assert.deepEqual(tasks, []);
  assert.equal(schemaVersion, 2);
  assert.deepEqual(rest, WEEKLY2, 'activity, notes ({id,ts,text}), settings and deviceId are untouched');
});

test('a stored v1 list is upgraded in place on read', async () => {
  reset({ schemaVersion: 1, tasks: [{ id: 'a', title: 'From Daybook', priority: 'low', status: 'open', createdAt: 1, updatedAt: 1, completedAt: null, dueDate: null, description: '' }] });
  const [t] = await getTasks();
  assert.equal(t?.repeat, null);
  assert.deepEqual(t?.doneDates, []);
  assert.equal(ctx.stores.local.schemaVersion, 2);
});

test('mutate takes the shared Web Lock when the platform has one', async () => {
  reset({});
  /** @type {string[]} */
  const names = [];
  let tail = Promise.resolve();
  const locks = { request: (/** @type {string} */ name, /** @type {() => Promise<unknown>} */ fn) => {
    names.push(name);
    const run = tail.then(fn);
    tail = run.then(() => undefined, () => undefined);
    return run;
  } };
  Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true });
  try {
    await mutate((tasks) => ({ tasks, result: undefined }));
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  }
  assert.deepEqual(names, [TASKS_LOCK]);
  assert.equal(TASKS_LOCK, 'weekly:tasks');
});

test('without Web Locks, withLock still runs callers in order and survives a throw', async () => {
  /** @type {number[]} */
  const order = [];
  const slow = withLock('t', async () => { await new Promise((r) => setTimeout(r, 20)); order.push(1); });
  const boom = withLock('t', async () => { throw new Error('boom'); });
  const fast = withLock('t', async () => { order.push(3); });
  await slow;
  await assert.rejects(boom, /boom/);
  await fast;
  assert.deepEqual(order, [1, 3]);
});
```

Run: `npm run test:ny`
Expected: `uistate.test.js` and `storage-v2.test.js` fail with `Cannot find module '…/src/lib/storage.js'`.

- [ ] **Step 3: Create `src/lib/storage.js`**

The file is Daybook's `storage.js` with these changes:
- The settings section is removed.
- `withLock` is added, and `mutate` runs under it.
- The header records the cross-context design. This is the Phase 1 deferred design note on the popup-vs-worker settings race.

```js
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

import { migrate, coerceReminderState, coerceUiState, defaultReminderState, SCHEMA_VERSION } from './schema.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {import('./schema.js').ReminderState} ReminderState */
/** @typedef {import('./schema.js').UiState} UiState */

const KEY_TASKS = 'tasks';
const KEY_VERSION = 'schemaVersion';
const KEY_REMINDER = 'reminderState';
const KEY_UI = 'uiState';
export const TASKS_LOCK = 'weekly:tasks';

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

/** Reads and, on a version change, writes back only `tasks` and `schemaVersion`. @returns {Promise<Task[]>} */
export async function getTasks() {
  const blob = await chrome.storage.local.get([KEY_TASKS, KEY_VERSION]);
  const { tasks, changed } = migrate(blob);
  if (changed) {
    await chrome.storage.local.set({ [KEY_TASKS]: tasks, [KEY_VERSION]: SCHEMA_VERSION });
  }
  return tasks;
}

/**
 * Serialised read-modify-write. `fn` receives the current list and returns the
 * next one; it must be pure and must not close over a list read earlier.
 *
 * @template T
 * @param {(tasks: Task[]) => { tasks: Task[], result: T }} fn
 * @returns {Promise<T>}
 */
export function mutate(fn) {
  return withLock(TASKS_LOCK, async () => {
    const { tasks, result } = fn(await getTasks());
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
 * @param {Partial<UiState>} patch
 * @returns {Promise<UiState>}
 */
export async function updateUiState(patch) {
  const next = coerceUiState({ ...(await getUiState()), ...patch });
  await chrome.storage.local.set({ [KEY_UI]: next });
  return next;
}

/* --------------------------------------------------------- reminder state */

/** @returns {Promise<ReminderState>} */
export async function getReminderState() {
  const blob = await chrome.storage.local.get(KEY_REMINDER);
  return coerceReminderState(blob[KEY_REMINDER]);
}

/**
 * @param {Partial<ReminderState>} patch
 * @returns {Promise<ReminderState>}
 */
export async function updateReminderState(patch) {
  const next = coerceReminderState({ ...(await getReminderState()), ...patch });
  await chrome.storage.local.set({ [KEY_REMINDER]: next });
  return next;
}

/** @returns {Promise<void>} */
export async function resetReminderState() {
  await chrome.storage.local.set({ [KEY_REMINDER]: defaultReminderState() });
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
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected:
- Both timezones pass, including `uistate.test.js` (7) and `storage-v2.test.js` (4).
- `tsc` exits 0.

To confirm the date-bomb fix, run `TZ=America/New_York node --test ../Daybook/test/uistate.test.js`. Daybook's original still fails `a day the user closed is still closed on the next read`; Weekly's copy passes.

---

### Task 3: Tasks, views and recurrence

**Files:**
- Create: `src/lib/task-views.js`, `src/lib/recurrence.js`, `src/lib/tasks.js`
- Create (Daybook ports): `test/tasks.test.js`, `test/tasks-week.test.js` (Daybook's `week.test.js`, renamed because Weekly already has `test/week.test.js`), `test/storage.test.js`
- Create (new): `test/recurrence.test.js`, `test/tasks-recurring.test.js`

**Interfaces:**
- Consumes:
  - Task 1: `Task`, `PRIORITY_RANK`, `PRIORITIES`, `UNDATED_KEY`, `TITLE_MAX`, `DESC_MAX`, `newId`, `coerceDays`.
  - Task 2: `mutate`, `getTasks`.
- Produces from `src/lib/task-views.js` (pure, from Daybook):
  - `WEEK_SPAN = 7`
  - Predicates: `isOverdue(t, ref?)`, `isDueToday(t, ref?)`, `isUpcoming(t, ref?)`, `isUndated(t)`, `isInWeek(t, ref?)`
  - Ordering: `byDueThenPriority(a, b)`, `byCompletedDesc(a, b)`
  - Views:
    - `sectionsFor(tasks, view: 'today'|'week'|'upcoming'|'open'|'completed'|'overdue', ref?): Section[]`
    - `viewCounts(tasks, ref?): Record<ViewId, number>`
    - `search(tasks, query): Task[]`
    - `filterPriority(tasks, p: Priority|'all'): Task[]`
  - Recurring tasks have `dueDate: null` and never count as undated.
- Produces from `src/lib/recurrence.js` (pure):
  - `isRecurring(t): boolean`, `isArchived(t, ref?): boolean`
  - `occursOn(t, iso): boolean`, `isDoneOn(t, iso): boolean`
  - `recurringOn(tasks, iso): Task[]`, `extrasOn(tasks, iso): Task[]`
  - `dayCompletion(tasks, iso): {done: number, total: number}`
  - `occurrences(t, fromIso, toIso): number`
  - `doneInRange(tasks, fromIso, toIso): {oneOffs: Task[], recurring: {task: Task, done: number, of: number}[]}`
- Produces from `src/lib/tasks.js`, the one import site for the UI:
  - Re-exports: `getTasks`, everything from `task-views.js`, everything from `recurrence.js`.
  - Writes:
    - `createTask(draft: {title, description?, priority?, dueDate?, repeat?: {days?: number[]}|null}, fallbackPriority?): Promise<Task>`
    - `updateTask(id, patch): Promise<Task|null>`
    - `setDone(id, done): Promise<Task|null>`, `toggleDone(id): Promise<Task|null>`
    - `toggleOn(id, iso): Promise<Task|null>`
    - `archiveRecurring(id, iso?): Promise<Task|null>`, `restoreRecurring(id): Promise<Task|null>`
    - `deleteTask(id): Promise<boolean>` (the hard delete, or purge)
    - `reschedule(ids: string[], date?): Promise<number>` (also "move to another day")
    - `copyToDay(id, iso): Promise<Task|null>`

- [ ] **Step 1: Port Daybook's task tests verbatim**

```bash
cd /Users/sharajrewoo/DemoReposQA/weekly
cp ../Daybook/test/tasks.test.js test/tasks.test.js
cp ../Daybook/test/week.test.js test/tasks-week.test.js
cp ../Daybook/test/storage.test.js test/storage.test.js
```

No edits are needed. Every import path (`../src/lib/tasks.js`, `../src/lib/schema.js`, `../src/lib/storage.js`, `../src/lib/dates.js`) resolves in Weekly. `storage.test.js` seeds `schemaVersion: 1`, which now also exercises the v1 → v2 upgrade on every reset.

- [ ] **Step 2: Write the failing recurrence tests**

Create `test/recurrence.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { occursOn, isDoneOn, isArchived, recurringOn, extrasOn, dayCompletion, occurrences, doneInRange } from '../src/lib/recurrence.js';
import { sectionsFor, viewCounts } from '../src/lib/task-views.js';
import { coerceTask } from '../src/lib/schema.js';

/** @param {object} patch */
const task = (patch) => /** @type {import('../src/lib/schema.js').Task} */ (coerceTask({ title: 'untitled', ...patch }));

// Week of Mon 26 Oct – Fri 30 Oct 2026; Sun 1 Nov is the US fall-back day.
const STANDUP = task({ id: 'su', title: 'Standup notes', createdAt: 1,
  repeat: { days: [1, 2, 3, 4, 5], from: '2026-10-26', until: null }, doneDates: ['2026-10-26', '2026-10-27', '2026-10-29'] });
const GYM = task({ id: 'gym', title: 'Gym', priority: 'low', createdAt: 2,
  repeat: { days: [0, 3], from: '2026-10-01', until: '2026-10-28' }, doneDates: ['2026-10-28'] });

test('occursOn honours weekdays, from and until, inclusive', () => {
  assert.equal(occursOn(STANDUP, '2026-10-26'), true, 'the first day counts');
  assert.equal(occursOn(STANDUP, '2026-10-25'), false, 'not before from');
  assert.equal(occursOn(STANDUP, '2026-10-31'), false, 'Saturday is not a working day');
  assert.equal(occursOn(GYM, '2026-10-28'), true, 'the until day still counts');
  assert.equal(occursOn(GYM, '2026-11-01'), false, 'archived after until');
  assert.equal(occursOn(STANDUP, '2026-02-31'), false, 'a day that does not exist never occurs');
  assert.equal(occursOn(task({ dueDate: '2026-10-26' }), '2026-10-26'), false, 'a one-off never recurs');
});

test('occursOn walks across the DST change on the local calendar', () => {
  const sunday = task({ repeat: { days: [0], from: '2026-10-01', until: null } });
  assert.equal(occursOn(sunday, '2026-11-01'), true);
  assert.equal(occursOn(sunday, '2026-11-02'), false);
  assert.equal(occurrences(sunday, '2026-10-25', '2026-11-08'), 3);
});

test('isDoneOn: recurring by doneDates, one-off by status', () => {
  assert.equal(isDoneOn(STANDUP, '2026-10-27'), true);
  assert.equal(isDoneOn(STANDUP, '2026-10-28'), false);
  assert.equal(isDoneOn(task({ status: 'done', completedAt: 1 }), '2026-10-28'), true);
});

test('isArchived means until is before the reference day', () => {
  assert.equal(isArchived(GYM, '2026-10-29'), true);
  assert.equal(isArchived(GYM, '2026-10-28'), false);
  assert.equal(isArchived(STANDUP, '2026-12-01'), false);
});

test('a day lists its recurring tasks and its extra tasks separately', () => {
  const extra = task({ id: 'x', dueDate: '2026-10-28', priority: 'high' });
  const all = [STANDUP, GYM, extra, task({ id: 'other', dueDate: '2026-10-29' })];
  assert.deepEqual(recurringOn(all, '2026-10-28').map((t) => t.id), ['su', 'gym'], 'priority, then created');
  assert.deepEqual(extrasOn(all, '2026-10-28').map((t) => t.id), ['x']);
});

test('dayCompletion is done over total for that day', () => {
  const extraDone = task({ dueDate: '2026-10-28', status: 'done', completedAt: 5 });
  const extraOpen = task({ dueDate: '2026-10-28' });
  assert.deepEqual(dayCompletion([STANDUP, GYM, extraDone, extraOpen], '2026-10-28'), { done: 2, total: 4 });
  assert.deepEqual(dayCompletion([STANDUP], '2026-10-31'), { done: 0, total: 0 }, 'an empty day has nothing to shade');
});

test('doneInRange lists one-offs by priority then completion, recurring with counts', () => {
  const at = (/** @type {number} */ d, /** @type {number} */ h) => new Date(2026, 9, d, h).getTime();
  const lowEarly = task({ id: 'le', priority: 'low', status: 'done', completedAt: at(26, 9) });
  const highLate = task({ id: 'hl', priority: 'high', status: 'done', completedAt: at(30, 17) });
  const highEarly = task({ id: 'he', priority: 'high', status: 'done', completedAt: at(27, 9) });
  const lastWeek = task({ id: 'lw', status: 'done', completedAt: at(23, 9) });
  const open = task({ id: 'op', dueDate: '2026-10-27' });
  const never = task({ id: 'nv', repeat: { days: [1], from: '2026-10-01', until: null } });
  const r = doneInRange([lowEarly, highLate, highEarly, lastWeek, open, STANDUP, GYM, never], '2026-10-26', '2026-10-30');
  assert.deepEqual(r.oneOffs.map((t) => t.id), ['he', 'hl', 'le']);
  assert.deepEqual(r.recurring.map(({ task: t, done, of }) => [t.id, done, of]), [['su', 3, 5], ['gym', 1, 1]],
    'listed only if ticked at least once; "of" counts the days it occurred');
});

test('doneInRange uses the local day of completedAt', () => {
  const lateNight = task({ status: 'done', completedAt: new Date(2026, 9, 30, 23, 50).getTime() });
  assert.equal(doneInRange([lateNight], '2026-10-26', '2026-10-30').oneOffs.length, 1);
  assert.equal(doneInRange([lateNight], '2026-10-31', '2026-11-06').oneOffs.length, 0);
});

test('recurring tasks never leak into the dated views or the No date band', () => {
  const s = sectionsFor([STANDUP], 'week', '2026-10-28');
  assert.equal(s.flatMap((x) => x.tasks).length, 0);
  assert.equal(sectionsFor([STANDUP], 'open', '2026-10-28').length, 0);
  assert.equal(viewCounts([STANDUP], '2026-10-28').open, 0);
});
```

Create `test/tasks-recurring.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const {
  createTask, getTasks, setDone, updateTask, reschedule, deleteTask,
  toggleOn, archiveRecurring, restoreRecurring, copyToDay, occursOn,
} = await import('../src/lib/tasks.js');
const { today, addDays, weekday } = await import('../src/lib/dates.js');

async function reset() {
  for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k];
}
const everyDay = { days: [0, 1, 2, 3, 4, 5, 6] };
const find = async (/** @type {string} */ id) => (await getTasks()).find((t) => t.id === id);

test('a recurring task starts today, defaults to Mon–Fri, and has no due date', async () => {
  await reset();
  const t = await createTask({ title: 'Standup notes', repeat: {}, dueDate: '2030-01-01' });
  assert.deepEqual(t.repeat, { days: [1, 2, 3, 4, 5], from: today(), until: null });
  assert.equal(t.dueDate, null);
  assert.deepEqual(t.doneDates, []);
  assert.deepEqual(await find(t.id), t, 'what was returned is what was stored');
});

test('createTask uses a valid fallback priority and ignores a bogus one', async () => {
  await reset();
  assert.equal((await createTask({ title: 'a' }, 'high')).priority, 'high');
  assert.equal((await createTask({ title: 'b' }, /** @type {any} */ ('urgent'))).priority, 'medium');
  assert.equal((await createTask({ title: 'c', priority: 'low' }, 'high')).priority, 'low');
});

test('toggleOn ticks and unticks one day; status never closes', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  const d = today();
  assert.deepEqual((await toggleOn(t.id, d))?.doneDates, [d]);
  assert.equal((await find(t.id))?.status, 'open');
  assert.deepEqual((await toggleOn(t.id, d))?.doneDates, []);
});

test('toggleOn refuses a day the task does not occur on, and one-off tasks', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  assert.equal(await toggleOn(t.id, addDays(today(), -1)), null, 'before it started');
  const one = await createTask({ title: 'once', dueDate: today() });
  assert.equal(await toggleOn(one.id, today()), null);
  const offDay = await createTask({ title: 'not today', repeat: { days: [(weekday() + 1) % 7] } });
  assert.equal(await toggleOn(offDay.id, today()), null);
});

test('setDone, updateTask and reschedule cannot give a recurring task a status or a date', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  assert.equal(await setDone(t.id, true), null);
  assert.equal((await updateTask(t.id, { dueDate: today(), title: 'Renamed' }))?.dueDate, null);
  assert.equal(await reschedule([t.id], addDays(today(), 1)), 0);
  const saved = await find(t.id);
  assert.equal(saved?.status, 'open');
  assert.equal(saved?.title, 'Renamed', 'the rest of the patch still applies');
});

test('archive stops a recurring task yesterday and keeps its history; restore reopens it', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  await toggleOn(t.id, today());
  const archived = await archiveRecurring(t.id, addDays(today(), 3));
  assert.equal(archived?.repeat?.until, addDays(today(), 2));
  assert.deepEqual(archived?.doneDates, [today()]);
  assert.equal(occursOn(/** @type {any} */ (archived), addDays(today(), 3)), false);
  assert.equal((await restoreRecurring(t.id))?.repeat?.until, null);
  const one = await createTask({ title: 'once' });
  assert.equal(await archiveRecurring(one.id), null, 'a one-off has nothing to archive');
});

test('deleteTask is the hard delete (purge) for any task', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  assert.equal(await deleteTask(t.id), true);
  assert.equal(await find(t.id), undefined);
});

test('copyToDay makes an open copy on the new day; the original stays', async () => {
  await reset();
  const t = await createTask({ title: 'Send invoice', priority: 'high', dueDate: today() });
  await setDone(t.id, true);
  const target = addDays(today(), 2);
  const copy = await copyToDay(t.id, target);
  assert.ok(copy && copy.id !== t.id);
  assert.equal(copy.dueDate, target);
  assert.equal(copy.status, 'open');
  assert.equal(copy.priority, 'high');
  assert.equal((await find(t.id))?.status, 'done');
  assert.equal((await getTasks()).length, 2);
  assert.equal(await copyToDay(t.id, '2026-02-31'), null);
});

test('moving an extra task to another day is reschedule([id], day)', async () => {
  await reset();
  const t = await createTask({ title: 'Call vendor', dueDate: today() });
  assert.equal(await reschedule([t.id], addDays(today(), 4)), 1);
  assert.equal((await find(t.id))?.dueDate, addDays(today(), 4));
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npm run test:ny`
Expected: the five new or ported files fail with `Cannot find module '…/src/lib/tasks.js'` (or `recurrence.js`). Everything else passes.

- [ ] **Step 4: Create `src/lib/task-views.js` from Daybook's derivation half**

Daybook's `tasks.js` is 314 lines. Its lines 17–192 hold the views, and they are pure.

```bash
cat > src/lib/task-views.js <<'EOF'
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

EOF
sed -n '17,192p' ../Daybook/src/lib/tasks.js >> src/lib/task-views.js
```

Then make exactly these four edits in `src/lib/task-views.js`:

1. In `isUndated`, replace:

```js
export const isUndated = (t) => t.status === 'open' && t.dueDate === null;
```

with:

```js
export const isUndated = (t) => t.status === 'open' && t.dueDate === null && t.repeat === null;
```

2. In `viewCounts`, replace:

```js
    open: tasks.filter((t) => t.status === 'open').length,
```

with:

```js
    open: tasks.filter((t) => t.status === 'open' && t.repeat === null).length,
```

3. `sectionsFor` is 62 lines in Daybook, over the 50-line limit. Replace its whole `case 'week': { … }` block, from `case 'week': {` through the `}` after `return out;`, with:

```js
    case 'week':
      return weekSections(tasks, overdue, ref);
```

4. Insert this function directly above the line `/** @param {number} ts @param {string} iso @returns {boolean} */` that precedes `function sameDay`:

```js
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
```

The predicates `isOverdue`, `isDueToday`, `isUpcoming` and `isInWeek` need no guard, because they all require `dueDate !== null` and a recurring task's `dueDate` is always null (Task 1).

- [ ] **Step 5: Create `src/lib/recurrence.js`**

```js
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
```

- [ ] **Step 6: Create `src/lib/tasks.js`**

This is Daybook's CRUD half (its lines 194–314), extended for recurrence. Every write runs inside one `mutate()`. Write the whole file:

```js
/**
 * Task writes, plus one import site for the whole task domain: the UI imports
 * views and recurrence from here rather than reaching into three modules.
 * From Daybook, extended with recurrence (spec §4).
 */

import { mutate, getTasks } from './storage.js';
import { newId, TITLE_MAX, DESC_MAX, PRIORITIES, coerceDays } from './schema.js';
import { today, tomorrow, isValidISODate, addDays } from './dates.js';
import { occursOn } from './recurrence.js';

export { getTasks };
export * from './task-views.js';
export * from './recurrence.js';

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
 * @param {Partial<Pick<Task, 'title' | 'description' | 'priority' | 'dueDate'>>} patch
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
    };
  });
}

/**
 * Close or reopen a one-off task. Recurring tasks are ticked per day with
 * toggleOn(); setDone leaves them alone and resolves null.
 * @param {string} id
 * @param {boolean} done
 * @returns {Promise<Task | null>}
 */
export async function setDone(id, done) {
  return patchOne(id, (t) => (t.repeat ? null : {
    ...t,
    status: done ? 'done' : 'open',
    completedAt: done ? Date.now() : null,
  }));
}

/** @param {string} id @returns {Promise<Task | null>} */
export async function toggleDone(id) {
  const all = await getTasks();
  const t = all.find((x) => x.id === id);
  if (!t) return null;
  return setDone(id, t.status === 'open');
}

/**
 * Tick or untick a recurring task for one day. Null if the task is not
 * recurring or does not occur on `iso`.
 * @param {string} id @param {string} iso
 * @returns {Promise<Task | null>}
 */
export async function toggleOn(id, iso) {
  return patchOne(id, (t) => {
    if (!occursOn(t, iso)) return null;
    const doneDates = t.doneDates.includes(iso)
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
 * Undo an archive: the task occurs again with no end date.
 * ponytail: one `until`, so days inside the archived gap count again on restore;
 * store archive ranges if the calendar must show the gap.
 * @param {string} id
 * @returns {Promise<Task | null>}
 */
export async function restoreRecurring(id) {
  return patchOne(id, (t) => (t.repeat ? { ...t, repeat: { ...t.repeat, until: null } } : null));
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
 * @returns {Promise<number>} how many moved
 */
export async function reschedule(ids, date = tomorrow()) {
  const set = new Set(ids);
  return mutate((tasks) => {
    let moved = 0;
    const next = tasks.map((t) => {
      if (!set.has(t.id) || t.status !== 'open' || t.repeat) return t;
      moved++;
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
```

- [ ] **Step 7: Run the tests, the typecheck and the size check**

Run: `npm test && npm run typecheck`
Expected:
- Both timezones pass: `tasks.test.js` 13, `tasks-week.test.js` 11, `storage.test.js` 5, `recurrence.test.js` 9, `tasks-recurring.test.js` 9.
- `tsc` exits 0.

Run: `wc -l src/lib/task-views.js src/lib/recurrence.js src/lib/tasks.js`
Expected: about 210, 100 and 210 lines, each ≤ 300. `sectionsFor` is about 39 lines and `weekSections` about 25.

---

### Task 4: Daybook backup import for tasks

**Files:**
- Create: `src/lib/task-portability.js`, `test/task-portability.test.js`

**Interfaces:**
- Consumes (Task 2): `getTasks`, `replaceTasks`, `mutate`. Consumes (Task 1): `coerceTaskList`.
- Produces (`src/lib/task-portability.js`, Daybook's names):
  - `parseImport(text: string): {tasks: Task[], dropped: number, duplicates: number, recognised: boolean}`. It throws `That file isn't valid JSON.` or `That file has no tasks in it.`
  - `mergeTasks(incoming: Task[]): Promise<{added, skipped}>`. Existing ids win.
  - `replaceAll(incoming: Task[]): Promise<{added, removed}>`
  - `deleteEverything(): Promise<number>`
- Phase 5 folds these into the three-format import in `src/lib/portability.js`. Daybook's `exportTasks()` is not ported, because it needs the `downloads` permission and the Phase 5 export UI.

- [ ] **Step 1: Port the test**

```bash
cd /Users/sharajrewoo/DemoReposQA/weekly
cp ../Daybook/test/portability.test.js test/task-portability.test.js
```

Edit `test/task-portability.test.js` line 6 only: `await import('../src/lib/portability.js')` → `await import('../src/lib/task-portability.js')`.

Run: `npm run test:ny`
Expected: `task-portability.test.js` fails with `Cannot find module '…/src/lib/task-portability.js'`.

- [ ] **Step 2: Create the module from Daybook's file**

Daybook's `portability.js` layout:
- Lines 1–8: the header.
- Lines 10–12: imports.
- Line 14: the `Task` typedef.
- Line 16: `FORMAT`.
- Lines 18–24: the `Envelope` typedef.
- Lines 26–52: `exportTasks`.
- Lines 54–128: parse, merge, replace and delete.

```bash
{ cat <<'EOF'
/**
 * Daybook backup import (merge or replace) and delete-all for tasks.
 * From Daybook's portability.js. Export and the three-format import UI arrive in
 * Phase 5, which folds this into lib/portability.js. Every imported record goes
 * through coerceTask, like anything else that crosses a trust boundary.
 */

import { getTasks, replaceTasks, mutate } from './storage.js';
import { coerceTaskList } from './schema.js';

EOF
sed -n '14,17p;54,128p' ../Daybook/src/lib/portability.js; } > src/lib/task-portability.js
```

No other edits. Imported Daybook v1 records go through `coerceTask`, so they arrive as v2 with `repeat: null` and `doneDates: []`.

- [ ] **Step 3: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: `task-portability.test.js` passes 10 in both timezones, and `tsc` exits 0.

---

### Task 5: Settings under the lock, default priority, worker wiring

**Files:**
- Modify: `src/lib/settings.js`, `src/background/service-worker.js:2,75-82`
- Modify: `test/settings.test.js` (append)
- Create: `test/background/service-worker.test.js`

**Interfaces:**
- Consumes (Task 2): `withLock(name, fn)`.
- Produces (`src/lib/settings.js`):
  - `DEFAULTS.defaultPriority = 'medium'`. Phase 2b passes it as `createTask(draft, settings.defaultPriority)`.
  - `SETTINGS_LOCK = 'weekly:settings'`.
  - `getSettings`, `updateSettings(patch)` and `onSettingsChanged(cb): () => void` keep their signatures.

- [ ] **Step 1: Pin the worker's settings behaviour before changing it**

Create `test/background/service-worker.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

const stub = installChromeStub();
await import('../../src/background/service-worker.js');

/** Deliver a storage change to every onChanged listener the worker registered. */
const fire = (/** @type {object} */ changes, /** @type {string} */ area) => {
  for (const fn of stub.log.listeners['storage.onChanged'] ?? []) fn(changes, area);
};
const settle = () => new Promise((r) => setTimeout(r, 30));

test('a local settings change re-schedules the Friday reminder', async () => {
  fire({ settings: { newValue: { reminder: true } } }, 'local');
  await settle();
  assert.ok(stub.log.alarms.has('reminder'), 'turning the reminder on creates the alarm');
  fire({ settings: { newValue: { reminder: false } } }, 'local');
  await settle();
  assert.equal(stub.log.alarms.has('reminder'), false, 'turning it off clears it');
});

test('other areas and other keys never touch the reminder', async () => {
  fire({ settings: { newValue: { reminder: true } } }, 'sync');
  fire({ tasks: { newValue: [] } }, 'local');
  await settle();
  assert.equal(stub.log.alarms.has('reminder'), false);
});

test('the worker listens to storage once, through onSettingsChanged', () => {
  assert.equal(stub.log.listeners['storage.onChanged']?.length, 1);
});
```

Run: `npm run test:ny`
Expected: PASS (3). This is a characterisation test: it pins today's behaviour so the rewiring in Step 4 is provably behaviour-neutral.

- [ ] **Step 2: Append the settings tests**

Append to `test/settings.test.js`:

```js

test('a failed write rejects that caller only; the next update still lands', async () => {
  const { updateSettings, getSettings } = await import('../src/lib/settings.js');
  const realSet = stub.chrome.storage.local.set;
  stub.chrome.storage.local.set = async () => { throw new Error('QUOTA_BYTES quota exceeded'); };
  await assert.rejects(updateSettings({ role: 'sales' }), /QUOTA_BYTES/);
  stub.chrome.storage.local.set = realSet;
  await updateSettings({ minMinutes: 9 });
  const s = await getSettings();
  assert.equal(s.minMinutes, 9);
  assert.equal(s.role, 'general', 'the failed patch was not half-applied');
});

test('onSettingsChanged fires for local settings only, merged over defaults, and unsubscribes', async () => {
  const { onSettingsChanged, DEFAULTS } = await import('../src/lib/settings.js');
  /** @type {Record<string, unknown>[]} */
  const seen = [];
  const off = onSettingsChanged((s) => seen.push(s));
  const [listener] = stub.log.listeners['storage.onChanged'] ?? [];
  listener?.({ settings: { newValue: { role: 'hr' } } }, 'sync');
  listener?.({ notes: { newValue: [] } }, 'local');
  listener?.({ settings: { newValue: { role: 'hr' } } }, 'local');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.role, 'hr');
  assert.equal(seen[0]?.idleSeconds, DEFAULTS.idleSeconds);
  off();
  assert.equal(stub.log.listeners['storage.onChanged']?.length, 0);
});

test('tasks get a default priority from settings', async () => {
  const { DEFAULTS } = await import('../src/lib/settings.js');
  assert.equal(DEFAULTS.defaultPriority, 'medium');
});
```

Run: `npm run test:ny`
Expected:
- `tasks get a default priority from settings` fails (`undefined !== 'medium'`).
- The other two pass. They pin Phase 1 behaviour that was never tested: the failed-write queue recovery and the area filter.

- [ ] **Step 3: Rewrite `src/lib/settings.js`**

```js
// Weekly's settings. Local storage only: syncing them through the Google
// account would break the "stays on this computer" promise.
// Writes run under the shared Web Lock (see storage.js), so the popup, the
// report tab and the service worker never drop each other's change.
import { withLock } from './storage.js';

export const DEFAULTS = Object.freeze({
  idleSeconds: 120, minMinutes: 2, ignoreDomains: [], paused: false,
  rules: [], ticketPrefixes: [], reminder: false, slackWebhook: '', template: 'weekly', role: 'general', anonymize: false,
  defaultPriority: 'medium',
});
const KEY = 'settings';
export const SETTINGS_LOCK = 'weekly:settings';

/** @returns {Promise<typeof DEFAULTS & Record<string, unknown>>} */
export async function getSettings() {
  const blob = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(blob[KEY] ?? {}) };
}

/** Read-modify-write under one lock, so two callers never drop each other's change. */
export function updateSettings(/** @type {Record<string, unknown>} */ patch) {
  return withLock(SETTINGS_LOCK, async () => {
    const next = { ...(await getSettings()), ...patch };
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  });
}

/** @param {(s: Awaited<ReturnType<typeof getSettings>>) => void} cb */
export function onSettingsChanged(cb) {
  /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
  const listener = (changes, area) => {
    if (area === 'local' && KEY in changes) cb({ ...DEFAULTS, ...(changes[KEY]?.newValue ?? {}) });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
```

- [ ] **Step 4: Wire `onSettingsChanged` into the worker**

In `src/background/service-worker.js`, replace line 2:

```js
import { getSettings, DEFAULTS } from '../lib/settings.js';
```

with:

```js
import { getSettings, onSettingsChanged } from '../lib/settings.js';
```

Replace the last listener (lines 75–82):

```js
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    const s = { ...DEFAULTS, ...(changes.settings.newValue || {}) };
    chrome.idle.setDetectionInterval(Math.max(15, s.idleSeconds));
    serial(() => scheduleReminder(s));
    serial(refresh);
  }
});
```

with:

```js
onSettingsChanged((s) => {
  chrome.idle.setDetectionInterval(Math.max(15, s.idleSeconds));
  serial(() => scheduleReminder(s));
  serial(refresh);
});
```

- [ ] **Step 5: Run the unit tests, the typecheck and the end-to-end suite**

Run: `npm test && npm run typecheck`
Expected: every test passes in both timezones, including `settings.test.js` (5) and `service-worker.test.js` (3). `tsc` exits 0.

Run: `npm run e2e`
Expected: `104/104 passed`. Real Chromium now takes `navigator.locks` for every settings write: the welcome role, pause and resume, and the report's settings.

---

### Task 6: Week helpers on the local calendar

**Files:**
- Modify: `src/lib/week.js:3,12-17,34-36`
- Modify: `test/week.test.js` (append)

**Interfaces:**
- Produces: the signatures are unchanged.
  - `isWorkday(d: Date|number|string): boolean`. A string that is not a real local `YYYY-MM-DD` is `false`.
  - `expiredKeys(keys, now?)`. The cutoff is `RETENTION_DAYS` calendar days before `now`'s local day.

- [ ] **Step 1: Write the failing tests**

Append to `test/week.test.js`:

```js

test('isWorkday reads a date string on the local calendar and refuses days that do not exist', () => {
  assert.equal(isWorkday('2026-10-26'), true);
  assert.equal(isWorkday('2026-10-31'), false);
  assert.equal(isWorkday('2026-02-31'), false, 'no rollover to 3 March');
  assert.equal(isWorkday('next tuesday'), false);
});

test('weekStart stays on local midnight Monday across both DST changes', () => {
  // US fall-back is Sun 1 Nov 2026; spring-forward is Sun 8 Mar 2026.
  const fall = weekStart(1, new Date(2026, 9, 30, 12));
  assert.equal(dayKey(fall), '2026-11-02');
  assert.equal(fall.getHours(), 0);
  assert.equal(dayKey(weekStart(0, new Date(2026, 10, 1, 23, 30))), '2026-10-26', 'the fall-back Sunday belongs to the week before');
  const spring = weekStart(1, new Date(2026, 2, 6, 12));
  assert.equal(dayKey(spring), '2026-03-09');
  assert.equal(spring.getHours(), 0);
});

test('the 90-day purge cutoff counts calendar days, not 24-hour blocks', () => {
  // 90 × 24 h back from late evening on 30 Nov crosses the fall-back hour and
  // lands on 2 Sep in New York; on the calendar, 90 days back is 1 Sep.
  const now = new Date(2026, 10, 30, 23, 30).getTime();
  assert.deepEqual(expiredKeys(['day:2026-08-31', 'day:2026-09-01', 'day:2026-09-02'], now), ['day:2026-08-31']);
});
```

- [ ] **Step 2: Run them to see the failures**

Run: `npm test`
Expected:
- `test:ny` fails two tests:
  - `isWorkday … refuses days that do not exist`, because `new Date('2026-02-31T12:00:00')` rolls over to Tuesday 3 March.
  - `the 90-day purge cutoff …`, which returns `['day:2026-08-31','day:2026-09-01']`.
- The DST `weekStart` test passes. It pins the existing behaviour.
- `test:in` fails only the `isWorkday` test, because Kolkata has no DST.

- [ ] **Step 3: Fix `src/lib/week.js`**

Replace line 3:

```js
import { toISODate } from './dates.js';
```

with:

```js
import { toISODate, fromISODate, addDays } from './dates.js';
```

Replace `isWorkday`:

```js
/** @param {Date | number | string} d */
export function isWorkday(d) {
  const date = typeof d === 'string' ? new Date(`${d}T12:00:00`) : new Date(d);
  const g = date.getDay();
  return g >= 1 && g <= 5;
}
```

with:

```js
/** A string must be a real local YYYY-MM-DD; anything else is not a workday. @param {Date | number | string} d */
export function isWorkday(d) {
  const date = typeof d === 'string' ? fromISODate(d) : new Date(d);
  const g = date?.getDay() ?? -1;
  return g >= 1 && g <= 5;
}
```

Replace the first three lines of `expiredKeys`:

```js
/** Every stored key ending in a date older than the retention cutoff. */
export function expiredKeys(/** @type {string[]} */ keys, now = Date.now()) {
  const cutoff = dayKey(now - RETENTION_DAYS * 864e5);
```

with:

```js
/** Every stored key ending in a date more than RETENTION_DAYS calendar days before `now`. */
export function expiredKeys(/** @type {string[]} */ keys, now = Date.now()) {
  const cutoff = addDays(dayKey(now), -RETENTION_DAYS);
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: `week.test.js` passes 9 in both timezones, everything else stays green, and `tsc` exits 0.

---

### Task 7: `classify` as per-family matchers

**Files:**
- Create: `test/activity/classify-golden.test.js`
- Modify: `src/lib/activity/classify.js:51-154` (the `classify` function; lines 1–50 are unchanged)

**Interfaces:**
- Produces: `classify(rawUrl, rawTitle, opts?)`, `cleanTitle`, `findTickets` and `parseRules` keep exact signatures and outputs.
  - `classify` now returns the exported typedef `Item`, which is `{key, category, task, tickets}`.
  - Private helpers: `context()`, `byRule`, `atlassian`, `codeHost`, `workspace`, `tools`, `businessApps`, `aiAndEnvironments` and `MATCHERS`. Each is ≤ 50 lines.

- [ ] **Step 1: Capture golden outputs before touching the code**

Create `test/activity/classify-golden.test.js`. Every expected value below was produced by the Phase 1 `classify()`, and each row exercises one branch.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../../src/lib/activity/classify.js';

// Golden outputs captured from the Phase 1 classify() before the matcher split.
// One row per branch family; the split must not change a single field.
const CASES = [
  ["https://acme.atlassian.net/wiki/spaces/ENG/pages/12345/Design", "Design - Confluence", {},
    { key: "confluence:12345", category: "Docs & specs", task: "Design", tickets: [] }],
  ["https://confluence.acme.io/display/X", "X", {},
    { key: "confluence:/display/X", category: "Docs & specs", task: "X", tickets: [] }],
  ["https://acme.atlassian.net/browse/ENGX-151", "[ENGX-151] Fix login - Jira", {},
    { key: "jira:ENGX-151", category: "Tickets", task: "ENGX-151: Fix login", tickets: ["ENGX-151"] }],
  ["https://acme.atlassian.net/jira/software/projects/ENGX/boards/7?selectedIssue=ENGX-9", "Board - Jira", {},
    { key: "jira:ENGX-9", category: "Tickets", task: "ENGX-9", tickets: ["ENGX-9"] }],
  ["https://acme.atlassian.net/jira/software/projects/ENGX/boards/7", "ENGX board - Jira", {},
    { key: "jira-board:jira/software/projects/ENGX", category: "Planning", task: "Jira: ENGX board", tickets: [] }],
  ["https://gitlab.com/acme/hermes/-/merge_requests/42", "ENGX-151 fix login (!42) · Merge requests · hermes · GitLab", {},
    { key: "mr:acme/hermes!42", category: "Merge requests", task: "hermes !42: ENGX-151 fix login", tickets: ["ENGX-151"] }],
  ["https://github.com/acme/api/pull/7", "Add retries · Pull Request #7 · acme/api", {},
    { key: "mr:acme/api!7", category: "Merge requests", task: "api !7: Add retries", tickets: [] }],
  ["https://github.com/acme/api/issues/9", "Crash · Issue #9", {},
    { key: "issue:acme/api#9", category: "Planning", task: "api #9: Crash", tickets: [] }],
  ["https://gitlab.com/acme/hermes/-/pipelines/991", "Pipeline", {},
    { key: "ci:acme/hermes", category: "CI/CD", task: "hermes pipelines & jobs", tickets: [] }],
  ["https://github.com/acme/api", "acme/api", {},
    { key: "repo:acme/api", category: "Code", task: "acme/api", tickets: [] }],
  ["https://github.com/", "GitHub", {},
    { key: "code:github.com", category: "Code", task: "github.com", tickets: [] }],
  ["https://docs.google.com/document/d/abc-DEF_1/edit", "Q3 plan - Google Docs", {},
    { key: "gdoc:abc-DEF_1", category: "Docs & specs", task: "Q3 plan", tickets: [] }],
  ["https://docs.google.com/a/b", "x", {},
    { key: "site:docs.google.com", category: "Browsing", task: "docs.google.com", tickets: [] }],
  ["https://meet.google.com/abc-defg-hij", "Meet - Weekly sync", {},
    { key: "meet:meet.google.com/abc-defg-hij", category: "Meetings", task: "Weekly sync", tickets: [] }],
  ["https://acme.zoom.us/j/1", "", {},
    { key: "meet:acme.zoom.us/j/1", category: "Meetings", task: "acme.zoom.us", tickets: [] }],
  ["https://calendar.google.com/calendar/u/0/r", "Calendar", {},
    { key: "calendar", category: "Meetings", task: "Calendar", tickets: [] }],
  ["https://mail.google.com/mail/u/0/#inbox", "Inbox (3) - Gmail", {},
    { key: "email", category: "Communication", task: "Email", tickets: [] }],
  ["https://outlook.office.com/mail/", "Mail", {},
    { key: "email", category: "Communication", task: "Email", tickets: [] }],
  ["https://acme.slack.com/archives/C1", "general - Slack", {},
    { key: "slack", category: "Communication", task: "Slack", tickets: [] }],
  ["https://www.figma.com/file/KEY/Name", "Name – Figma", {},
    { key: "figma:KEY", category: "Design", task: "Name", tickets: [] }],
  ["https://metabase.acme.io/dashboard/4-sales", "Sales", {},
    { key: "data:metabase.acme.io/dashboard/4-sales", category: "Analysis & monitoring", task: "Sales", tickets: [] }],
  ["https://app.datadoghq.com/apm/services", "APM", {},
    { key: "data:app.datadoghq.com/apm/services", category: "Analysis & monitoring", task: "APM", tickets: [] }],
  ["https://web.postman.co/workspace", "Postman", {},
    { key: "postman", category: "Local dev & testing", task: "Postman", tickets: [] }],
  ["https://www.notion.so/acme/Page-123", "Page", {},
    { key: "notion:/acme/Page-123", category: "Docs & specs", task: "Page", tickets: [] }],
  ["https://www.linkedin.com/sales/lead/abc,def", "Lead | Sales Navigator", {},
    { key: "app:linkedin/sales/lead/abc,def", category: "Sales & CRM", task: "Lead | Sales Navigator", tickets: [] }],
  ["https://www.linkedin.com/talent/hire/123/discover", "Recruiter", {},
    { key: "app:linkedin/talent/hire/123/discover", category: "Recruiting & HR", task: "Recruiter", tickets: [] }],
  ["https://www.linkedin.com/messaging/thread/1", "(2) Messaging | LinkedIn", {},
    { key: "linkedin-messaging", category: "Communication", task: "LinkedIn messages", tickets: [] }],
  ["https://www.linkedin.com/feed/", "Feed | LinkedIn", {},
    { key: "site:linkedin.com", category: "Browsing", task: "linkedin.com", tickets: [] }],
  ["https://blog.acme.com/wp-admin/post.php?post=1", "Edit Post", {},
    { key: "app:blog.acme.com/wp-admin", category: "SEO & marketing", task: "WordPress (blog.acme.com)", tickets: [] }],
  ["https://acme.lightning.force.com/lightning/r/Opportunity/006xx/view", "Acme renewal | Salesforce", {},
    { key: "app:acme.lightning.force.com/lightning/r/Opportunity/006xx/view", category: "Sales & CRM", task: "Acme renewal", tickets: [] }],
  ["https://app.greenhouse.io/people/123", "Jane Doe - Greenhouse", {},
    { key: "app:app.greenhouse.io/people/123", category: "Recruiting & HR", task: "Jane Doe", tickets: [] }],
  ["https://claude.ai/chat/xyz", "Claude", {},
    { key: "ai:claude.ai/chat/xyz", category: "AI assistants", task: "Claude", tickets: [] }],
  ["http://localhost:3000/login", "Login", {},
    { key: "local:localhost:3000", category: "Local dev & testing", task: "Local app (localhost:3000)", tickets: [] }],
  ["http://app.test/x", "x", {},
    { key: "local:app.test", category: "Local dev & testing", task: "Local app (app.test)", tickets: [] }],
  ["https://staging.app.acme.com/x", "x", {},
    { key: "env:staging.app.acme.com", category: "Test environments", task: "staging.app.acme.com", tickets: [] }],
  ["https://dev.to/post", "post", {},
    { key: "site:dev.to", category: "Browsing", task: "dev.to", tickets: [] }],
  ["https://news.ycombinator.com/item?id=1", "HN", {},
    { key: "site:news.ycombinator.com", category: "Browsing", task: "news.ycombinator.com", tickets: [] }],
  ["not a url", "Some title", {},
    { key: "other:not a url", category: "Browsing", task: "Some title", tickets: [] }],
  ["https://acme.my.site.com/partners/x", "Portal", {"rules": ["acme.my.site.com/partners => Sales & CRM | Partner portal"]},
    { key: "rule:Sales & CRM:Partner portal", category: "Sales & CRM", task: "Partner portal", tickets: [] }],
  ["https://acme.my.site.com/partners/x", "Portal", {"rules": ["acme.my.site.com/partners => Sales & CRM"]},
    { key: "rule:Sales & CRM:acme.my.site.com", category: "Sales & CRM", task: "Portal", tickets: [] }],
  ["https://example.com/x", "ENGX-1 and MKT-2 and UTF-8", {"ticketPrefixes": ["MKT"]},
    { key: "site:example.com", category: "Browsing", task: "example.com", tickets: ["MKT-2"] }],
];

test('every branch family classifies exactly as before the split', () => {
  for (const [url, title, opts, expected] of CASES) {
    assert.deepEqual(classify(url, title, opts), expected, url);
  }
});
```

Run: `npm test`
Expected: PASS against the current code in both timezones. If any row fails, stop: the expected value was mis-copied, and the code must not change until the row matches today's output.

- [ ] **Step 2: Replace the `classify` function with matchers**

In `src/lib/activity/classify.js`, delete everything from the JSDoc block above `export function classify` (line 51) to the end of the file. In its place, write:

```js
/** @typedef {{ key: string, category: string, task: string, tickets: string[] }} Item */
/**
 * What every matcher needs, computed once per URL.
 * @typedef {object} Ctx
 * @property {URL} u
 * @property {string} host       hostname without www.
 * @property {string} path
 * @property {string[]} seg      non-empty path segments
 * @property {string} title      the raw tab title, or ''
 * @property {string} t          the cleaned title, or the host
 * @property {string[]} tickets
 * @property {string[] | undefined} rules
 * @property {(category: string, key: string, task: string) => Item} r
 * @property {(...names: string[]) => boolean} has
 */

/** @param {URL} u @param {string} rawUrl @param {string} title @param {{ rules?: string[], ticketPrefixes?: string[] }} opts @returns {Ctx} */
function context(u, rawUrl, title, opts) {
  const host = u.hostname.replace(/^www\./, '');
  const tickets = findTickets(title + ' ' + rawUrl, opts.ticketPrefixes);
  const labels = host.split(/[.-]/);
  return {
    u, host, path: u.pathname, seg: u.pathname.split('/').filter(Boolean), title,
    t: cleanTitle(title) || host, tickets, rules: opts.rules,
    r: (category, key, task) => ({ category, key, task, tickets }),
    // "gitlab" matches gitlab.com and gitlab.acme.io but not mygitlabblog.com
    has: (...names) => names.some(n => host === n || host.endsWith('.' + n) || (!n.includes('.') && labels.includes(n))),
  };
}

/** The user's own rules win over everything built in. @param {Ctx} c @returns {Item | null} */
function byRule(c) {
  for (const rule of parseRules(c.rules)) {
    if ((c.host + c.path).toLowerCase().includes(rule.pattern))
      return c.r(rule.category, `rule:${rule.category}:${rule.label || c.host}`, rule.label || c.t);
  }
  return null;
}

/** Jira & Confluence. @param {Ctx} c @returns {Item | null} */
function atlassian(c) {
  const { u, host, path, seg, title, t, tickets, r, has } = c;
  if (!host.endsWith('atlassian.net') && !has('jira', 'confluence')) return null;
  if (path.startsWith('/wiki') || has('confluence')) {
    const m = path.match(/\/pages\/(\d+)/);
    return r('Docs & specs', 'confluence:' + (m ? m[1] : path), t);
  }
  const issue = (path.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/) || [])[1] || u.searchParams.get('selectedIssue');
  if (issue) {
    const summary = !title.includes(issue) ? '' : t.replace(/\[?\b[A-Z][A-Z0-9]+-\d+\b\]?/, '').replace(/^[\s:–-]+/, '').trim();
    return { ...r('Tickets', 'jira:' + issue, summary ? `${issue}: ${summary}` : issue), tickets: [...new Set([issue, ...tickets])] };
  }
  return r('Planning', 'jira-board:' + seg.slice(0, 4).join('/'), 'Jira: ' + t);
}

/** GitLab / GitHub. @param {Ctx} c @returns {Item | null} */
function codeHost(c) {
  const { host, path, seg, title, t, r, has } = c;
  if (!has('gitlab', 'github.com')) return null;
  const gl = path.match(/^\/(.+?)\/-\/(merge_requests|issues|pipelines|jobs|commit)\/([\w]+)/);
  const gh = path.match(/^\/([^/]+\/[^/]+)\/(pull|issues|actions\/runs|commit)\/([\w]+)/);
  const m = gl || gh;
  const nice = (title.split(' · ')[0] || t).trim();
  if (m) {
    const project = m[1] ?? '', kind = m[2], id = m[3];
    const short = project.split('/').pop();
    if (kind === 'merge_requests' || kind === 'pull')
      return r('Merge requests', `mr:${project}!${id}`, `${short} !${id}: ${nice.replace(/\s*\(!\d+\)\s*$/, '')}`);
    if (kind === 'issues') return r('Planning', `issue:${project}#${id}`, `${short} #${id}: ${nice}`);
    return r('CI/CD', `ci:${project}`, `${short} pipelines & jobs`);
  }
  if (seg.length >= 2) return r('Code', 'repo:' + seg.slice(0, 2).join('/'), seg.slice(0, 2).join('/'));
  return r('Code', 'code:' + host, host);
}

/** Google Workspace & communication. @param {Ctx} c @returns {Item | null} */
function workspace(c) {
  const { host, path, t, r, has } = c;
  if (host === 'docs.google.com') {
    const m = path.match(/\/(document|spreadsheets|presentation|forms)\/d\/([\w-]+)/);
    if (m) return r('Docs & specs', 'gdoc:' + m[2], t);
  }
  if (host === 'meet.google.com' || has('zoom.us', 'teams.microsoft.com')) {
    return r('Meetings', 'meet:' + host + path, t.replace(/^Meet\s*[-–]\s*/, '') || 'Call');
  }
  if (host === 'calendar.google.com') return r('Meetings', 'calendar', 'Calendar');
  if (host === 'mail.google.com' || has('outlook.office.com', 'outlook.office365.com', 'outlook.live.com')) return r('Communication', 'email', 'Email');
  if (has('slack.com')) return r('Communication', 'slack', 'Slack');
  return null;
}

/** Design, data, monitoring. @param {Ctx} c @returns {Item | null} */
function tools(c) {
  const { host, path, seg, t, r, has } = c;
  if (has('figma.com')) return r('Design', 'figma:' + (seg[1] || path), t);
  if (has('metabase', 'mixpanel.com', 'datadoghq.com', 'datadoghq.eu', 'grafana', 'pagerduty.com', 'snowflakecomputing.com', 'snowflake.com', 'kibana', 'sentry.io'))
    return r('Analysis & monitoring', 'data:' + host + '/' + seg.slice(0, 2).join('/'), t);
  if (has('postman.com', 'postman.co')) return r('Local dev & testing', 'postman', 'Postman');
  if (has('notion.so')) return r('Docs & specs', 'notion:' + path, t);
  return null;
}

/** LinkedIn's work areas, WordPress admin, then the business-app list. @param {Ctx} c @returns {Item | null} */
function businessApps(c) {
  const { host, seg, t, r, has } = c;
  // LinkedIn: Sales Navigator and Recruiter are work; the feed is browsing.
  if (has('linkedin.com')) {
    if (seg[0] === 'sales') return r('Sales & CRM', 'app:linkedin/' + seg.slice(0, 3).join('/'), t);
    if (seg[0] === 'talent') return r('Recruiting & HR', 'app:linkedin/' + seg.slice(0, 4).join('/'), t);
    if (seg[0] === 'messaging') return r('Communication', 'linkedin-messaging', 'LinkedIn messages');
  }
  if (seg[0] === 'wp-admin') return r('SEO & marketing', 'app:' + host + '/wp-admin', `WordPress (${host})`);
  for (const [category, hosts] of APPS) {
    if (has(...hosts)) return r(category, 'app:' + host + '/' + seg.slice(0, 5).join('/'), t);
  }
  return null;
}

/** AI assistants, then local and test environments. @param {Ctx} c @returns {Item | null} */
function aiAndEnvironments(c) {
  const { u, host, path, t, r, has } = c;
  if (has('claude.ai', 'chatgpt.com', 'gemini.google.com', 'perplexity.ai', 'copilot.microsoft.com'))
    return r('AI assistants', 'ai:' + host + path, t);
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname) || /\.(localhost|test)$/.test(u.hostname))
    return r('Local dev & testing', 'local:' + u.host, `Local app (${u.host})`);
  // Needs 3+ labels so a public site like dev.to isn't mistaken for an environment.
  if (host.split('.').length >= 3 && /(^|[.-])(staging|integration|qa|dev|sandbox|preprod|uat)([.-]|$)/.test(host))
    return r('Test environments', 'env:' + host, host);
  return null;
}

/** First match wins, in this order. */
const MATCHERS = [byRule, atlassian, codeHost, workspace, tools, businessApps, aiAndEnvironments];

/**
 * @param {string} rawUrl
 * @param {string} rawTitle
 * @param {{ rules?: string[], ticketPrefixes?: string[] }} [opts]
 * @returns {Item}
 */
export function classify(rawUrl, rawTitle, opts = {}) {
  const title = rawTitle || '';
  let u;
  try { u = new URL(rawUrl); } catch (e) {
    return { key: 'other:' + rawUrl, category: 'Browsing', task: title || rawUrl, tickets: [] };
  }
  const c = context(u, rawUrl, title, opts);
  for (const match of MATCHERS) {
    const hit = match(c);
    if (hit) return hit;
  }
  return c.r('Browsing', 'site:' + c.host, c.host);
}
```

The order is unchanged:

`rules → Atlassian → GitLab/GitHub → Google/meetings/mail/Slack → Figma/data/Postman/Notion → LinkedIn/wp-admin/APPS → AI/local/environments → site`

- [ ] **Step 3: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected:
- `classify-golden.test.js` (1) and `classify.test.js` (6) pass in both timezones.
- `tsc` exits 0.
- `wc -l src/lib/activity/classify.js` reports about 203 lines. The largest function, `codeHost`, is about 21 lines.

---

### Task 8: Explicit CSP, README, phase gate

**Files:**
- Modify: `manifest.json` (add `content_security_policy`)
- Create: `test/manifest.test.js`
- Modify: `README.md` (the "Layout" block and the rules paragraph under it)

**Interfaces:**
- Produces: `manifest.content_security_policy.extension_pages === "script-src 'self'; object-src 'none'; base-uri 'none'"`, Daybook's exact policy.

- [ ] **Step 1: Write the failing manifest test**

Create `test/manifest.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('extension pages run only our own scripts: explicit CSP (spec D13)', () => {
  assert.equal(manifest.content_security_policy?.extension_pages,
    "script-src 'self'; object-src 'none'; base-uri 'none'");
});
```

Run: `npm run test:ny`
Expected: FAIL with `undefined !== "script-src 'self'; object-src 'none'; base-uri 'none'"`.

- [ ] **Step 2: Add the CSP to `manifest.json`**

Replace the last two lines of `manifest.json`:

```json
  "icons": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

with:

```json
  "icons": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'none'"
  }
}
```

Every page already loads only `<script type="module" src="…">` from the extension, with no inline scripts or `on*=` attributes. Confirm with:

```bash
grep -rn "<script" src/ui                                   # expect 3 hits, each with src=
grep -rnE " on[a-z]+=" src/ui || echo "no inline handlers"  # expect: no inline handlers
```

- [ ] **Step 3: Update the README Layout**

In `README.md`, replace the Layout block's `src/lib/` lines:

```
src/lib/           domain: no DOM
  dates.js         local-calendar arithmetic (never UTC)
  week.js          week/day helpers and duration formatting
  settings.js      the only owner of the settings key
  portability.js   export / import
```

with:

```
src/lib/           domain: no DOM
  dates.js         local-calendar arithmetic (never UTC)
  week.js          week/day helpers and duration formatting
  settings.js      the only owner of the settings key
  schema.js        task shape, validation, migration (schemaVersion 2)
  storage.js       tasks, uiState, reminderState; mutate() and withLock()
  tasks.js         task writes; the one import site for task views and recurrence
  task-views.js    due-state predicates, sections, counts, search
  recurrence.js    recurring tasks, day completion, Done-section data
  task-portability.js  Daybook backup import (merge / replace), delete all tasks
  portability.js   export / import
```

Append this paragraph after the paragraph that begins "Two rules keep this honest":

```markdown
Every read-modify-write of `tasks` and `settings` runs under a Web Lock (`withLock` in `lib/storage.js`). The popup, the report tab and the service worker share one lock manager, so none of them can drop another's change. Node tests fall back to a per-context promise chain.
```

- [ ] **Step 4: Run the phase gate**

Run: `npm test && npm run typecheck && npm run e2e`
Expected:
- `npm test`: `# tests 167`, `# pass 167`, `# fail 0` in each timezone. That is 67 from Phase 1 plus 100 new.
- `typecheck`: clean.
- e2e: `104/104 passed`. The CSP is enforced on the popup, welcome and report pages, and the console-error check stays clean.

Run the size checks:

```bash
find src -name '*.js' | xargs wc -l | sort -n | tail -4
grep -rnE "storage\.sync" src || echo "no storage.sync"
```

Expected:
- The largest files are `schema.js` (about 250), `tasks.js` and `task-views.js` (about 210) and `classify.js` (about 203). All are ≤ 300.
- `no storage.sync`.

- [ ] **Step 5: Report**

Report to the controller:
- The test counts per timezone and the e2e result.
- The largest files.
- The Daybook test ledger: 68 of 101 ported, with 33 scheduled for Phase 3 (20 `reminders`, 8 `service-worker`, 5 `coerceSettings`/`defaultPopupView`).
- The deliberate decisions listed in the self-review.

---

## Interfaces exported for Phase 2b

The UI imports the task domain only from `src/lib/tasks.js`, plus the change feed and UI state from `src/lib/storage.js`. It never calls `chrome.storage` for tasks.

| Need (2b) | Call |
|---|---|
| Read all tasks / live updates | `getTasks()`; `onTasksChanged(cb) → unsubscribe` (storage.js) |
| Quick add (D2) | `createTask({ title }, settings.defaultPriority)`; a daily task is `createTask({ title, repeat: { days } })` |
| Edit (D5) | `updateTask(id, { title?, description?, priority?, dueDate? })` |
| Tick a one-off / undo | `setDone(id, done)`, `toggleDone(id)` |
| Undo a delete / an archive (D6) | `mergeTasks([snapshot])` (task-portability.js) restores the exact task with its id and `completedAt`; `restoreRecurring(id)` |
| Tick a recurring task for a day (L1, L5) | `toggleOn(id, iso)` |
| Delete a one-off / purge (D5, L6) | `deleteTask(id)` (a confirmed hard delete for recurring tasks) |
| Delete a recurring task, keep history (L6) | `archiveRecurring(id, iso?)`; restore with `restoreRecurring(id)`; filter with `isArchived(t, ref?)` |
| Move to tomorrow / another day (D7, L2) | `reschedule(ids, date?)` |
| Copy an extra task to another day (L2) | `copyToDay(id, iso)` |
| Today / Week / All views and counts (D3) | `sectionsFor(tasks, view, ref?)`, `viewCounts(tasks, ref?)`, `WEEK_SPAN`; recurring tasks for the Today band via `recurringOn(tasks, today())` |
| Search and priority filter (D4) | `search(tasks, q)`, `filterPriority(tasks, p)` |
| Calendar shading (L4) | `dayCompletion(tasks, iso) → {done, total}` |
| Day sheet (L5) | `recurringOn(tasks, iso)`, `extrasOn(tasks, iso)`, `isDoneOn(t, iso)`, `occursOn(t, iso)` |
| Done section (W2) | `doneInRange(tasks, monIso, min(friIso, today)) → {oneOffs, recurring: [{task, done, of}]}` |
| Collapsible day bands (D3) | `getUiState()`, `updateUiState({ dayState })` (storage.js); `UNDATED_KEY` (schema.js) |
| Labels and limits | `PRIORITIES`, `PRIORITY_LABEL`, `TITLE_MAX`, `DESC_MAX` (schema.js) |

Heads-up for Phase 2b: the first `getTasks()` call writes `tasks` and `schemaVersion`. Once a 2b surface reads tasks, the end-to-end check "delete all keeps only settings and device ID" (`test/e2e/full.mjs:381`) needs updating to allow those two keys.

## Self-review (done at authoring time)

**1. Spec coverage**

| Requirement | Task |
|---|---|
| D1: task fields (title, description, priority, due date or none, status, timestamps) | 1 (`Task`, `coerceTask`), 3 (`createTask`, `updateTask`) |
| D12: schema version + migration (v0/v1 → v2, `repeat: null`, `doneDates: []`, Weekly 2 keys untouched, notes left for Phase 4) | 1 (`migrate`, `SCHEMA_VERSION = 2`), 2 (`storage-v2.test.js` first-read test) |
| D13: explicit CSP | 8 |
| D14: Daybook suite carried over, Node-22-runnable, two timezones, uistate date bomb fixed | 1, 2, 3, 4 (68 of 101; 33 named and scheduled for Phase 3); globs only; 2 (`uistate.test.js` relative to today) |
| L1 model: daily recurring tasks counted from their created date | 1 (`Repeat`, `from` defaults to the created day), 3 (`createTask({repeat})`, `occursOn`, `toggleOn`) |
| L6 model: archive keeps history, restore, purge | 3 (`archiveRecurring` sets `until` to the day before, `restoreRecurring`, `deleteTask`, `isArchived`) |
| §4 extra tasks = tasks with a dueDate; copy/move to another day | 3 (`extrasOn`, `copyToDay`, `reschedule`) |
| §4/§3.2 calendar shading ratio, Done-section data | 3 (`dayCompletion`, `doneInRange`) |
| §4 local storage only; one serialised `mutate()` | 2 (`withLock`, `mutate`); 8 (`storage.sync` grep) |
| Keep uiState/reminderState accessors | 2 |
| `classify` split, ≤ 50-line functions, identical behaviour | 7 (golden test first) |
| Phase 1 deferred: expiredKeys calendar-day cutoff | 6 |
| Phase 1 deferred: isWorkday via fromISODate | 6 |
| Phase 1 deferred: weekStart DST test | 6 |
| Phase 1 deferred: settings failed-write and onSettingsChanged tests | 5 |
| Phase 1 deferred: wire onSettingsChanged into the worker | 5 |
| Phase 1 deferred: popup/worker settings race design note | 2 (storage.js header), 5 (settings under `withLock`), 8 (README) |
| ≤ 300 lines per file / ≤ 50 lines per function | 3 (`tasks.js` split; `weekSections` extracted), 7, 8 (size check) |
| `tsc --strict`, `noUncheckedIndexedAccess` | every task |
| `no-innerhtml` stays green; e2e 104/104; no UI change | 5, 8 |

**2. Placeholder scan:** none. Every new file is written in full, and every port is an exact `cp` or `sed -n` with an exhaustive list of edits. Line numbers refer to the files as they stand at the start of Phase 2a.

**3. Type consistency:**
- `Task.repeat` and `Task.doneDates` are defined in Task 1 and used with the same names in Tasks 2–4.
- `withLock` and `TASKS_LOCK` (Task 2) are consumed by Task 5 as `withLock(SETTINGS_LOCK, …)`.
- `coerceDays` (Task 1) is used by `createTask` (Task 3).
- `occursOn` lives in `recurrence.js` and is imported by `tasks.js`.
- `deleteTask` is the purge; no `purgeTask` alias exists. Moving is `reschedule([id], iso)`; no `moveToDay` alias exists.

**Decisions the spec did not settle:**
- **The `tasks.js` split:** the 300-line rule forces three files: `tasks.js`, which re-exports the other two, plus `task-views.js` and `recurrence.js`. Daybook's 62-line `sectionsFor` loses its week case to `weekSections`.
- **Web Locks:** they are used instead of only writing a design note. They close the cross-context race for tasks and settings in about 8 lines, and Node falls back to the per-context chain.
- **`doneInRange(...).recurring[].of`:** it counts occurrences within the range passed in, so the caller clamps the range to today.
- **`restoreRecurring`:** it clears `until`, so days in the archived gap count again. This is marked `ponytail:` with the upgrade path (archive ranges).
- **`coerceDays`:** an empty or invalid `days` value becomes Mon–Fri. `doneDates` is capped at 3660 entries (ten years). Phase 3 must not reuse `coerceDays` for reminder days if "no reminder days" is meant to be valid.
- **Recurring tasks are immune to one-off writes:** `setDone`, `reschedule` and `updateTask({dueDate})` leave them alone, so their status stays `open` and their `dueDate` stays null.
- **`createTask` fallback:** it validates `fallbackPriority`, because `settings.js` does not coerce stored settings.
