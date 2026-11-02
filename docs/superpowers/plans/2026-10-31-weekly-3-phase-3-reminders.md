# Weekly 3.0, Phase 3: Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Pre-flight (controller):** this plan was written and replayed against the Phase 2b plan's end state (`docs/superpowers/plans/2026-10-31-weekly-3-phase-2b-task-ui.md`, all eight tasks applied: 200 unit tests per timezone, 176/176 end-to-end). The real post-2b tree may differ slightly: Phase 2b's review fix waves can change lines this plan replaces. Before dispatching Task 1, check every ``In `<file>`, replace:`` block below against the real files (each old block must match exactly once) and reconcile any drift in the ledger. The files this plan touches that 2b also wrote are `src/lib/storage.js`, `src/lib/settings.js`, `src/ui/panel/today-tab.js`, `src/ui/app/tasks-view.js`, `src/background/service-worker.js`, `src/ui/welcome/*`, `src/ui/report/{report.html,report.css,settings-panel.js,main.js}`, `test/helpers/chrome-stub.js`, `test/background/service-worker.test.js`, `test/settings.test.js`, `test/manifest.test.js`, `test/e2e/full.mjs`, `jsconfig.json`, `manifest.json` and `README.md`.

**Goal:** Give Weekly Daybook's reminders: a morning brief and an evening check on one-shot, DST-safe alarms at configurable times and working days, shown in one reused reminder window with a system notification and a catch-up on browser start; the evening's Move to tomorrow (one task and all); Alt+T and Alt+Shift+T; and retire Weekly 2's Friday 4 pm reminder, whose weekly-update nudge moves into the last working day's evening check.

**Architecture:**
- `src/lib/reminders.js` is pure: from the task list and the working days it says what a reminder lists (`buildPayload`), whether today is a reminder day or the week's last working day, and the headline and notification text. The worker and the reminder window derive the same thing from it.
- `src/background/reminders.js` is the engine, ported from Daybook: one-shot alarms recomputed from the local clock after every fire, `fire()` with Daybook's guards (disabled, not a working day, already shown today, empty morning), one popup window reused through its id in session storage, a system notification, catch-up on `runtime.onStartup`, snooze, and orphan-alarm cleanup (which removes Weekly 2's Friday `reminder` alarm on update). The service worker routes alarms, notification clicks, window closes, two runtime messages and two commands to it, all through its existing serial queue except `sidePanel.open`, which must stay inside the command's user gesture.
- `src/ui/remind/` is the reminder window: Phase 2b's task rows and bands, a **Tomorrow** button per one-off in the evening, **Move all to tomorrow**, Snooze, and on the last working day a link to the week report.
- Reminder settings live in the merged settings object (`src/lib/settings.js`, now validated by `readSettings`) and are edited in the report's Settings (the page the app's **Settings** link opens) in a new **Reminders** group.
- `updateUiState` and `updateReminderState` move under Web Locks (deferred from Phase 2a); `updateUiState` takes a function so two pages toggling different bands never overwrite each other.

**Tech Stack:**
- Chrome MV3: `chrome.alarms` (one-shot `when`), `chrome.windows` (popup), `chrome.notifications`, `chrome.commands`, `chrome.sidePanel.open`, `chrome.storage.session`. No new permissions: `alarms`, `notifications` and `sidePanel` are already in the manifest; `windows` and `commands` need none.
- Plain ES2022 modules, no bundler; `node:test` in two timezones; `tsc --strict` over JSDoc; Playwright + Chromium end-to-end.

**Spec:**
- `docs/superpowers/specs/2026-10-31-weekly-feature-parity.md`: rows D7 (evening "Move all to tomorrow"), D8, D9 and D10 (commands). This file wins on scope.
- `docs/superpowers/specs/2026-10-31-weekly-merge-design.md`: §3.2 (Settings: Reminders group), §3.3 (Reminders), §3.5 step 4 (welcome), §4 (writes under locks; local storage only), §5 (code rules), §6 (errors), §7 (testing), §8 Phase 3 row. This file wins on how.
- Phase 2a ledger (`…-phase-2a-ledger.md`): "updateUiState/updateReminderState lock deferred to Phase 3"; "schemaVersion 2 versions the tasks blob only" (untouched here).
- Phase 2b plan, "Interfaces exported for Phase 3 and Phase 4": `app.html#day=YYYY-MM-DD`, `app.html#tasks`, `report.html#settings`, `chrome.sidePanel.open({ windowId })` from the command handler, `taskRow`, `renderBands`, `moveToTomorrow`, `bindKeys`, `onNewDay`, `updateSettings((current) => patch)`.

## Global Constraints

- **No version control.**
  - Never run `git`. No step commits; the controller keeps the ledger.
  - Never edit this plan file.
  - Rollback point: `snapshots/weekly-2.0.0-source-2026-10-31.zip`.
- **Layering:**
  - `src/lib/` never touches the DOM, and `src/lib/reminders.js` touches no `chrome.*` at all.
  - `src/ui/` never calls `chrome.storage` in new code. The reminder window reads tasks through `src/lib/tasks.js`, settings through `src/lib/settings.js`, and asks the worker (runtime messages) for anything that needs alarms or windows.
  - Alarms, windows, notifications and the reminder window's id belong to the worker (`src/background/reminders.js`).
- **Locks:** Web Locks are not re-entrant. A `mutate()` callback is synchronous and never calls `getTasks()`. Every read-modify-write of `tasks`, `settings`, `uiState` and `reminderState` runs under its lock. A toggle computed from the current value passes a function (`updateSettings((s) => …)`, `updateUiState((s) => …)`).
- **Alarms:** one-shot `when` alarms only, recomputed from the local clock with `nextOccurrence()` (`src/lib/dates.js`) after every fire. Never `periodInMinutes` for a reminder (a 24 h period drifts an hour across DST). The only periodic alarm stays Weekly's one-minute `tick`.
- **No HTML sinks:** no `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src/`. Build DOM with `h()` from `src/ui/components/dom.js`; `test/no-innerhtml.test.js` stays green.
- **Size:** no file in `src/` over 300 lines and no function over 50 lines. `test/e2e/full.mjs` stays the one exception carried from Phase 1; new end-to-end checks go in `test/e2e/reminders.mjs`, each function ≤ 50 lines.
- **Dates:** local-calendar ISO strings (`YYYY-MM-DD`); never `new Date('YYYY-MM-DD')`; use `src/lib/dates.js`. A week is Monday to Friday by default (`days: [1, 2, 3, 4, 5]`, 0 = Sunday).
- **Storage:** local only; nothing reads or writes `chrome.storage.sync`. The reminder window's id lives in `chrome.storage.session`. Weekly 2's activity keys are never rewritten.
- **Errors:** a failed write in a page is said in plain words (`report()` in `components/undo.js`); a failed worker handler shows the "!" badge through the worker's serial queue (spec §6). A failed notification is logged and never stops the window.
- **Look:** Weekly's visual language only (tokens in `src/ui/styles.css`). No remote fonts.
- **Node and tests:**
  - Node ≥ 22. `node --test` takes globs, never a directory.
  - Every test file lives under `test/`. Unit tests run in `TZ=America/New_York` and `TZ=Asia/Kolkata` (`npm test`); the DST tests use 8 March and 1 November 2026, New York's changes, and pass trivially in Kolkata.
  - End-to-end: dates are computed in Node and passed in; `sw.evaluate` callbacks use only `chrome.*`, built-ins and their argument (Phase 1 Ruling R1). Pages are opened directly as extension URLs (`PAGES.remind`).
- **Dependencies:** no runtime dependencies. Dev dependencies stay `typescript@^5.5.4` and `@types/chrome@^0.0.268`.
- **Typecheck:** `npm run typecheck` covers `src/lib/**`, `src/background/**`, `src/ui/components/**`, `src/ui/panel/**`, `src/ui/app/**` and, from Task 3, `src/ui/remind/**`. The report and welcome pages stay out, as in Phase 2b.
- **Gates:** every task ends with `npm test` green in both timezones and `npm run typecheck` clean. Tasks 1–6 also end with `npm run e2e` green.

## File map (end state of Phase 3)

```
manifest.json                         + commands: open-panel (Alt+T), open-app (Alt+Shift+T)
jsconfig.json                         include + src/ui/remind
README.md                             Install step 3, Reminders section, Friday reminder removed, Layout, locks
src/lib/storage.js           modified updateUiState(patch | fn) under UI_LOCK; updateReminderState under REMINDER_LOCK
src/lib/settings.js          modified reminder defaults; readSettings validates; Weekly 2's `reminder` flag mapped, then dropped
src/lib/reminders.js         new      SLOTS, buildPayload, isReminderDay, isLastWorkday, count, headline, subline, notificationText
src/background/reminders.js  new      ALARM, NOTIFICATION_PREFIX, rescheduleAll, clearOrphanAlarms, slotForAlarm, fire, catchUp,
                                      openReminderWindow, forgetWindowIfClosed, showNotification, snooze
src/background/service-worker.js modified Friday reminder removed; reminders wired; messages; commands
src/ui/remind/remind.html remind.css remind.js   new   the reminder window
src/ui/panel/today-tab.js    modified band toggle via updateUiState(fn)
src/ui/app/tasks-view.js     modified band toggle via updateUiState(fn)
src/ui/welcome/welcome.html welcome.js   modified  Friday checkbox → reminders checkbox
src/ui/report/report.html report.css settings-panel.js main.js   modified  Reminders group in Settings
src/ui/report/reminder-settings.js   new   fillReminders, readReminders, Preview buttons
test/storage-locks.test.js  test/reminders.test.js  test/background/reminders.test.js   new
test/settings.test.js  test/background/service-worker.test.js  test/manifest.test.js  test/helpers/chrome-stub.js   extended
test/e2e/reminders.mjs                new   window, engine, settings and command checks
test/e2e/full.mjs                     PAGES.remind; welcome check; reminders off for the run; section 5c; Friday checks removed
```

---
### Task 1: Locks for uiState and reminderState

The Phase 2a ledger deferred this to Phase 3: from Task 4 the worker marks a slot shown while the reminder window can snooze, so `reminderState` gets a second writer. `uiState` already has two (the side panel and the app tab), and each writes back its own whole copy of the band map, so a lock alone would not stop one page dropping the other's toggle: the callers now pass a function that changes only their band.

**Files:**
- Create: `test/storage-locks.test.js`
- Modify: `src/lib/storage.js` (lock names; `updateUiState`, `updateReminderState`)
- Modify: `src/ui/panel/today-tab.js`, `src/ui/app/tasks-view.js` (band toggles)

**Interfaces:**
- Consumes (Phase 2a): `withLock(name, fn)`, `getUiState()`, `getReminderState()`, `coerceUiState`, `coerceReminderState`.
- Produces (`src/lib/storage.js`):
  - `UI_LOCK = 'weekly:ui'`, `REMINDER_LOCK = 'weekly:reminders'`
  - `updateUiState(patch: Partial<UiState> | ((current: UiState) => Partial<UiState>)) → Promise<UiState>`, under `UI_LOCK`
  - `updateReminderState(patch: Partial<ReminderState>) → Promise<ReminderState>`, under `REMINDER_LOCK` (Task 4's `fire()` and `snooze()` call it)

- [ ] **Step 1: Write the failing test**

Create `test/storage-locks.test.js`:

```js
// uiState and reminderState writes are serialised read-modify-writes (deferred
// from Phase 2a): the evening window and the worker both write reminderState,
// and the side panel and the app tab both write uiState.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const { getUiState, updateUiState, getReminderState, updateReminderState, UI_LOCK, REMINDER_LOCK } = await import('../src/lib/storage.js');
const { today } = await import('../src/lib/dates.js');

const DAY = today();
const reset = () => { for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k]; };

test('two reminderState writes at the same instant both land', async () => {
  reset();
  await Promise.all([updateReminderState({ morningLastShown: DAY }), updateReminderState({ eveningLastShown: DAY })]);
  const s = await getReminderState();
  assert.equal(s.morningLastShown, DAY);
  assert.equal(s.eveningLastShown, DAY, 'the second write must not start from a read taken before the first landed');
});

test('two uiState band toggles from different pages both land (function form)', async () => {
  reset();
  await Promise.all([
    updateUiState((cur) => ({ dayState: { ...cur.dayState, undated: 'open' } })),
    updateUiState((cur) => ({ dayState: { ...cur.dayState, [DAY]: 'closed' } })),
  ]);
  assert.deepEqual((await getUiState()).dayState, { undated: 'open', [DAY]: 'closed' });
});

test('both take their own Web Lock when the platform has one', async () => {
  reset();
  /** @type {string[]} */
  const names = [];
  const locks = { request: (/** @type {string} */ name, /** @type {() => Promise<unknown>} */ fn) => { names.push(name); return fn(); } };
  Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true });
  try {
    await updateUiState({ dayState: {} });
    await updateReminderState({ snoozeUntil: null });
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  }
  assert.deepEqual(names, [UI_LOCK, REMINDER_LOCK]);
  assert.deepEqual([UI_LOCK, REMINDER_LOCK], ['weekly:ui', 'weekly:reminders']);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `TZ=America/New_York node --test test/storage-locks.test.js`

Expected: 3 tests, all `not ok`. The first two fail on lost writes (`eveningLastShown` is `null`; the band map keeps only one key), the third because `UI_LOCK` and `REMINDER_LOCK` are not exported yet.

- [ ] **Step 3: Put both writes under their locks**

In `src/lib/storage.js`, replace:

```js
export const TASKS_LOCK = 'weekly:tasks';
```

with:

```js
export const TASKS_LOCK = 'weekly:tasks';
export const UI_LOCK = 'weekly:ui';
export const REMINDER_LOCK = 'weekly:reminders';
```

In `src/lib/storage.js`, replace:

```js
/**
 * @param {Partial<UiState>} patch
 * @returns {Promise<UiState>}
 */
export async function updateUiState(patch) {
  const next = coerceUiState({ ...(await getUiState()), ...patch });
  await chrome.storage.local.set({ [KEY_UI]: next });
  return next;
}
```

with:

```js
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
```

In `src/lib/storage.js`, replace:

```js
/**
 * @param {Partial<ReminderState>} patch
 * @returns {Promise<ReminderState>}
 */
export async function updateReminderState(patch) {
  const next = coerceReminderState({ ...(await getReminderState()), ...patch });
  await chrome.storage.local.set({ [KEY_REMINDER]: next });
  return next;
}
```

with:

```js
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
```

- [ ] **Step 4: Toggle one band, not the whole map**

In `src/ui/panel/today-tab.js`, replace:

```js
    onToggle: (key, open) => { dayState = { ...dayState, [key]: open ? 'open' : 'closed' }; void updateUiState({ dayState }); },
```

with:

```js
    onToggle: (key, open) => {
      const v = open ? 'open' : 'closed';
      dayState = { ...dayState, [key]: v };
      void updateUiState((cur) => ({ dayState: { ...cur.dayState, [key]: v } }));
    },
```

In `src/ui/app/tasks-view.js`, replace:

```js
    onToggle: (key, open) => { ui.dayState = { ...ui.dayState, [key]: open ? 'open' : 'closed' }; void updateUiState({ dayState: ui.dayState }); },
```

with:

```js
    onToggle: (key, open) => {
      const v = open ? 'open' : 'closed';
      ui.dayState = { ...ui.dayState, [key]: v };
      void updateUiState((cur) => ({ dayState: { ...cur.dayState, [key]: v } }));
    },
```

- [ ] **Step 5: Run the tests**

Run: `TZ=America/New_York node --test test/storage-locks.test.js && npm test && npm run typecheck`

Expected: `# pass 3`; then `# tests 203`, `# pass 203`, `# fail 0` in each timezone (200 + 3); typecheck clean.

- [ ] **Step 6: Run the end-to-end suite**

Run: `npm run e2e`

Expected: `176/176 passed`. The `[Panel tasks] band state is saved (uiState)`, `… survives a reload` and `[Tasks] opening a day band is remembered (uiState)` checks cover the two callers.

---

### Task 2: Reminder settings and what a reminder says

**Files:**
- Create: `src/lib/reminders.js`, `test/reminders.test.js`
- Replace: `src/lib/settings.js` (reminder defaults; `readSettings` validates every read and write)
- Modify: `test/settings.test.js` (append)

**Interfaces:**
- Consumes (Phase 2a/2b): `isOverdue`, `isDueToday`, `byDueThenPriority` (`task-views.js`); `recurringOn`, `isDoneOn` (`recurrence.js`); `today`, `weekday`, `toISODate`, `isValidTime` (`dates.js`); `PRIORITIES` (`schema.js`); `withLock` (`storage.js`).
- Produces (`src/lib/settings.js`):
  - `DEFAULTS` gains `morning: { enabled: true, time: '09:00' }`, `evening: { enabled: true, time: '18:00' }`, `days: [1, 2, 3, 4, 5]`, `systemNotification: true`, `catchUpOnStartup: true` (Daybook's defaults). `reminder: false` stays until Task 4 retires it.
  - `Settings` typedef; `readSettings(raw: unknown) → Settings`: defaults filled, a bad time, day or flag falls back to its default, days deduplicated and sorted, an invalid `defaultPriority` becomes `'medium'`. `getSettings`, `updateSettings` (stores only validated values) and `onSettingsChanged` all go through it.
- Produces (`src/lib/reminders.js`, pure):
  - `Slot = 'morning' | 'evening'`; `SLOTS`
  - `buildPayload(slot, tasks, days, ref?) → ReminderPayload = { slot, date, overdue: Task[], today: Task[], closedToday: number, empty: boolean, weekEnds: boolean }`. `today` lists daily tasks not ticked today, then open one-offs due today. Undated tasks never appear.
  - `isReminderDay(days, ref?)`, `isLastWorkday(days, ref?)` (the last of `days` in the Monday–Sunday week)
  - `count(n, one, many)`, `headline(p)`, `subline(p)`, `notificationText(p) → { title, message }` (the evening of the last working day adds the weekly-update nudge)

- [ ] **Step 1: Write the failing payload test**

Create `test/reminders.test.js`:

```js
// What the morning brief and the evening check say: Daybook's payload tests, plus
// daily tasks, the working-days rule and the weekly-update nudge (spec §3.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { buildPayload, isReminderDay, isLastWorkday, headline, subline, notificationText } from '../src/lib/reminders.js';
import { coerceTask } from '../src/lib/schema.js';

/** @param {object} patch */
const task = (patch) => /** @type {import('../src/lib/schema.js').Task} */ (coerceTask({ title: 'a task', ...patch }));
/** Local noon, so completedAt never sits near midnight in either test timezone. @param {string} iso */
const noon = (iso) => new Date(`${iso}T12:00:00`).getTime();

// Thu 29 Oct 2026.
const REF = '2026-10-29';
const WEEKDAYS = [1, 2, 3, 4, 5];
const STANDUP = task({ id: 'su', title: 'Standup', repeat: { days: WEEKDAYS, from: '2026-10-26', until: null }, doneDates: [] });

test('morning: due today plus overdue; closed today counted, not listed', () => {
  const p = buildPayload('morning', [
    task({ id: 'late', dueDate: '2026-10-28' }),
    task({ id: 'due', dueDate: REF }),
    task({ id: 'ahead', dueDate: '2026-11-02' }),
    task({ id: 'none' }),
    task({ id: 'done', dueDate: REF, status: 'done', completedAt: noon(REF) }),
  ], WEEKDAYS, REF);
  assert.deepEqual(p.overdue.map((t) => t.id), ['late']);
  assert.deepEqual(p.today.map((t) => t.id), ['due']);
  assert.equal(p.closedToday, 1);
  assert.equal(p.empty, false);
});

test('undated tasks never enter a reminder', () => {
  const p = buildPayload('morning', [task({ id: 'none' }), task({ id: 'none2' })], WEEKDAYS, REF);
  assert.equal(p.empty, true, 'an undated task was never claimed for today');
});

test('a daily task is listed first until it is ticked for today; then it counts as closed', () => {
  const open = buildPayload('evening', [task({ id: 'due', dueDate: REF }), STANDUP], WEEKDAYS, REF);
  assert.deepEqual(open.today.map((t) => t.id), ['su', 'due']);
  const ticked = buildPayload('evening', [{ ...STANDUP, doneDates: [REF] }], WEEKDAYS, REF);
  assert.equal(ticked.empty, true);
  assert.equal(ticked.closedToday, 1);
});

test('a daily task on a day it does not occur is not listed', () => {
  assert.equal(buildPayload('morning', [STANDUP], [0, 1, 2, 3, 4, 5, 6], '2026-10-31').empty, true, 'Saturday');
});

test('isReminderDay reads the settings.days convention (0=Sun)', () => {
  assert.equal(isReminderDay(WEEKDAYS, REF), true, 'Thursday');
  assert.equal(isReminderDay(WEEKDAYS, '2026-10-31'), false, 'Saturday');
  assert.equal(isReminderDay(WEEKDAYS, '2026-11-01'), false, 'Sunday');
});

test('the last working day: Friday by default, Thursday for a Mon–Thu week, Sunday when Sunday is worked', () => {
  assert.equal(isLastWorkday(WEEKDAYS, '2026-10-30'), true, 'Friday');
  assert.equal(isLastWorkday(WEEKDAYS, REF), false, 'Thursday');
  assert.equal(isLastWorkday([1, 2, 3, 4], REF), true, 'Mon–Thu week');
  assert.equal(isLastWorkday([0, 1, 2, 3, 4, 5], '2026-10-30'), false, 'Sunday still to come');
  assert.equal(isLastWorkday([0, 1, 2, 3, 4, 5], '2026-11-01'), true, 'Sunday ends the Monday week');
  assert.equal(isLastWorkday(WEEKDAYS, '2026-10-31'), false, 'not a working day at all');
  assert.equal(buildPayload('evening', [], WEEKDAYS, '2026-10-30').weekEnds, true);
});

test('headline and notification: counts in words, the weekly-update nudge only on the last evening', () => {
  const late = task({ id: 'late', dueDate: '2026-10-28' });
  const morning = buildPayload('morning', [late, task({ dueDate: REF })], WEEKDAYS, REF);
  assert.equal(headline(morning), 'Two things due today.');
  assert.equal(subline(morning), 'One task carried over.');
  const thursday = buildPayload('evening', [late], WEEKDAYS, REF);
  assert.deepEqual(notificationText(thursday), { title: 'One task still open', message: 'You closed 0 today.' });
  const friday = buildPayload('evening', [], WEEKDAYS, '2026-10-30');
  assert.equal(headline(friday), 'Nothing left open.');
  assert.match(notificationText(friday).message, /weekly update is drafted/);
  assert.doesNotMatch(notificationText(buildPayload('morning', [late], WEEKDAYS, '2026-10-30')).message, /weekly update/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `TZ=America/New_York node --test test/reminders.test.js`

Expected: FAIL with `Cannot find module '…/src/lib/reminders.js'`.

- [ ] **Step 3: Write the failing settings tests**

Append to `test/settings.test.js`:

```js
test('reminder defaults: 09:00 brief, 18:00 check, Monday to Friday, notification and catch-up on (spec §3.3)', async () => {
  const { getSettings } = await import('../src/lib/settings.js');
  const s = await getSettings();
  assert.deepEqual(s.morning, { enabled: true, time: '09:00' });
  assert.deepEqual(s.evening, { enabled: true, time: '18:00' });
  assert.deepEqual(s.days, [1, 2, 3, 4, 5]);
  assert.equal(s.systemNotification, true);
  assert.equal(s.catchUpOnStartup, true);
});

test('bad reminder values fall back to the defaults; days are deduplicated and sorted', async () => {
  const { getSettings, updateSettings } = await import('../src/lib/settings.js');
  stub.stores.local.settings = { morning: { enabled: 'yes', time: '25:00' }, evening: { enabled: false, time: '17:30' }, days: [5, 9, 'x', 1, 1, 0], catchUpOnStartup: 1 };
  const s = await getSettings();
  assert.deepEqual(s.morning, { enabled: true, time: '09:00' });
  assert.deepEqual(s.evening, { enabled: false, time: '17:30' });
  assert.deepEqual(s.days, [0, 1, 5]);
  assert.equal(s.catchUpOnStartup, true);
  await updateSettings({ morning: { enabled: true, time: '' } });
  assert.equal(stub.stores.local.settings.morning.time, '09:00', 'an emptied time field is never stored');
});

test('onSettingsChanged hands listeners validated reminder settings', async () => {
  const { onSettingsChanged } = await import('../src/lib/settings.js');
  /** @type {any[]} */
  const seen = [];
  onSettingsChanged((s) => seen.push(s));
  const [listener] = stub.log.listeners['storage.onChanged'] ?? [];
  listener?.({ settings: { newValue: { days: 'weekdays', evening: { enabled: true, time: '7pm' } } } }, 'local');
  assert.deepEqual(seen[0]?.days, [1, 2, 3, 4, 5]);
  assert.equal(seen[0]?.evening.time, '18:00');
});
```

- [ ] **Step 4: Run them to see them fail**

Run: `TZ=America/New_York node --test test/settings.test.js`

Expected: 10 tests, 3 `not ok` (the new ones): there are no reminder defaults yet (`s.morning` is `undefined`) and nothing is validated (`days` stays `'weekdays'`).

- [ ] **Step 5: Write the payload module**

Create `src/lib/reminders.js`:

```js
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
 * @param {ReminderPayload} p
 * @returns {{ title: string, message: string }}
 */
export function notificationText(p) {
  const nudge = p.slot === 'evening' && p.weekEnds ? ' Your weekly update is drafted and ready to review.' : '';
  return { title: headline(p).replace(/\.$/, ''), message: subline(p) + nudge };
}
```

- [ ] **Step 6: Validate settings, with the reminder defaults**

Replace `src/lib/settings.js` with:

```js
// Weekly's settings. Local storage only: syncing them through the Google
// account would break the "stays on this computer" promise.
// Writes run under the shared Web Lock (see storage.js), so the side panel, the
// app and report tabs and the service worker never drop each other's change.
import { withLock } from './storage.js';
import { PRIORITIES } from './schema.js';
import { isValidTime } from './dates.js';

export const DEFAULTS = Object.freeze({
  idleSeconds: 120, minMinutes: 2, ignoreDomains: [], paused: false,
  rules: [], ticketPrefixes: [], reminder: false, slackWebhook: '', template: 'weekly', role: 'general', anonymize: false,
  defaultPriority: 'medium',
  // Reminders (spec §3.3), Daybook's defaults: local times, and the days they fire on (0=Sun … 6=Sat).
  // readSettings always returns fresh copies of these, so no caller can change the defaults.
  morning: { enabled: true, time: '09:00' },
  evening: { enabled: true, time: '18:00' },
  days: [1, 2, 3, 4, 5],
  systemNotification: true,
  catchUpOnStartup: true,
});
const KEY = 'settings';
export const SETTINGS_LOCK = 'weekly:settings';

/** @typedef {{ enabled: boolean, time: string }} Slot */
/**
 * @typedef {{ idleSeconds: number, minMinutes: number, ignoreDomains: string[], paused: boolean, rules: string[],
 *   ticketPrefixes: string[], reminder: boolean, slackWebhook: string, template: string, role: string, anonymize: boolean,
 *   defaultPriority: string, morning: Slot, evening: Slot, days: number[], systemNotification: boolean,
 *   catchUpOnStartup: boolean } & Record<string, unknown>} Settings
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** @param {unknown} v @param {boolean} d */
const flag = (v, d) => (typeof v === 'boolean' ? v : d);

/**
 * The stored blob over the defaults, validated where a bad value would break a
 * caller: a reminder time, day or flag, and the default priority.
 * @param {unknown} raw
 * @returns {Settings}
 */
export function readSettings(raw) {
  const stored = isObj(raw) ? raw : {};
  const s = /** @type {Settings} */ ({ ...DEFAULTS, ...stored });
  /** @param {unknown} v @param {Slot} d @returns {Slot} */
  const slot = (v, d) => {
    const o = isObj(v) ? v : {};
    const time = o['time'];
    return { enabled: flag(o['enabled'], d.enabled), time: typeof time === 'string' && isValidTime(time) ? time : d.time };
  };
  const days = Array.isArray(s.days)
    ? [...new Set(s.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b)
    : [...DEFAULTS.days];
  return {
    ...s, days,
    morning: slot(s.morning, DEFAULTS.morning),
    evening: slot(s.evening, DEFAULTS.evening),
    systemNotification: flag(s.systemNotification, DEFAULTS.systemNotification),
    catchUpOnStartup: flag(s.catchUpOnStartup, DEFAULTS.catchUpOnStartup),
    defaultPriority: /** @type {readonly unknown[]} */ (PRIORITIES).includes(s.defaultPriority) ? s.defaultPriority : DEFAULTS.defaultPriority,
  };
}

/** @returns {Promise<Settings>} */
export async function getSettings() {
  const blob = await chrome.storage.local.get(KEY);
  return readSettings(blob[KEY]);
}

/**
 * Read-modify-write under one lock, so two callers never drop each other's change.
 * Pass a function to compute the patch from the current settings inside the lock
 * (a toggle such as Pause must not read outside it). What is stored is validated
 * by readSettings, so an invalid time or priority never reaches a caller.
 * @param {Record<string, unknown> | ((current: Settings) => Record<string, unknown>)} patch
 * @returns {Promise<Settings>}
 */
export function updateSettings(patch) {
  return withLock(SETTINGS_LOCK, async () => {
    const current = await getSettings();
    const next = readSettings({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  });
}

/** @param {(s: Settings) => void} cb */
export function onSettingsChanged(cb) {
  /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
  const listener = (changes, area) => {
    if (area === 'local' && KEY in changes) cb(readSettings(changes[KEY]?.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
```

- [ ] **Step 7: Run the tests**

Run: `TZ=America/New_York node --test test/reminders.test.js test/settings.test.js && npm test && npm run typecheck`

Expected: `# pass 17`; then `# tests 213`, `# pass 213`, `# fail 0` in each timezone (203 + 7 + 3); typecheck clean.

- [ ] **Step 8: Run the end-to-end suite**

Run: `npm run e2e`

Expected: `176/176 passed` (every page reads settings through `readSettings` now; nothing visible changes).

---

### Task 3: The reminder window

The window the worker will open in Task 4, built and checked first by opening it directly as an extension URL. It reuses Phase 2b's rows (tick, ⋯ menu, Undo) and bands; it never calls `chrome.storage`.

**Files:**
- Create: `src/ui/remind/remind.html`, `src/ui/remind/remind.css`, `src/ui/remind/remind.js`
- Create: `test/e2e/reminders.mjs`
- Modify: `jsconfig.json` (typecheck the window), `test/e2e/full.mjs` (`PAGES.remind`, section 5c)

**Interfaces:**
- Consumes: `buildPayload`, `headline`, `subline` (Task 2); `getSettings`, `onSettingsChanged` (Task 2); `getTasks` (`tasks.js`), `onTasksChanged` (`storage.js`); `taskRow`, `renderBands`, `moveToTomorrow`, `report`, `bindKeys`, `onNewDay` (Phase 2b components).
- Produces:
  - Page `src/ui/remind/remind.html?slot=morning|evening` (anything else is `morning`). Ids: `#eyebrow`, `#headline`, `#sub`, `#list` (bands `[data-band="overdue"]` "Carried over" and `[data-band="today"]` "Today"; rows `li.row`; evening one-offs carry `button.later` "Tomorrow"), `#weekNudge` with `#openReport`, `#moveAll`, `#openApp`, `#dismiss`.
  - **Open Weekly** opens `src/ui/app/app.html#day=<today>` and **Open the week report →** opens `src/ui/report/report.html`, each as a normal tab, then the window closes itself.
  - `test/e2e/reminders.mjs`: `seed(sw, { tasks?, settings? })` (appends tasks and merges settings straight into storage) and `reminderWindowChecks(t)`.

- [ ] **Step 1: Write the failing end-to-end checks**

Create `test/e2e/reminders.mjs`:

```js
// Reminders (spec §3.3; D7, D8, D9): the reminder window, the alarms that open it,
// its settings and the keyboard commands. Dates are computed here in Node and
// passed in; sw.evaluate callbacks use only chrome.* and their argument (R1).

/** A one-off task as storage holds it. */
const oneOff = (id, title, dueDate) => ({ id, title, description: '', priority: 'medium', dueDate, status: 'open',
  createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, repeat: null, doneDates: [] });

/** Add tasks, and set reminder settings, straight into storage. */
export const seed = (sw, { tasks = [], settings = {} }) => sw.evaluate(async ({ add, patch }) => {
  const st = await chrome.storage.local.get(['tasks', 'settings']);
  await chrome.storage.local.set({ tasks: [...(st.tasks ?? []), ...add], settings: { ...(st.settings ?? {}), ...patch } });
}, { add: tasks, patch: settings });

const task = async (store, id) => ((await store()).tasks ?? []).find(x => x.id === id);

// The window's page, opened directly as an extension URL (the worker opens it from Task 4 on).
export async function reminderWindowChecks(t) {
  const { ctx, X, sw, check, watch, store, wait, PAGES, iso } = t;
  const c = (name, ok, detail) => check('Reminder', name, ok, detail);
  // Today is the only working day, so it is also the last one: the evening carries the weekly-update nudge.
  await seed(sw, { tasks: [oneOff('rem-late', 'Send the invoice', iso.yesterday), oneOff('rem-due', 'Review the PR', iso.today)],
    settings: { days: [new Date().getDay()] } });
  const win = watch(await ctx.newPage());
  await win.goto(`${X}/${PAGES.remind}?slot=evening`); await wait(800);
  const inBand = (band, title) => win.locator(`[data-band="${band}"] li.row`, { hasText: title }).count();
  c('evening check: Carried over, then Today (D8)', await inBand('overdue', 'Send the invoice') === 1 && await inBand('today', 'Review the PR') === 1
    && /still open\.$/.test(await win.textContent('#headline')), await win.textContent('#headline'));
  await win.locator('li.row', { hasText: 'Review the PR' }).locator('button.later').click(); await wait(500);
  c('Move to tomorrow on one task (D7)', (await task(store, 'rem-due')).dueDate === iso.tomorrow && await inBand('today', 'Review the PR') === 0);
  await win.click('#moveAll'); await wait(500);
  c('Move all to tomorrow (D7)', (await task(store, 'rem-late')).dueDate === iso.tomorrow && await win.locator('[data-band="overdue"]').count() === 0);
  await win.click('.toast button'); await wait(500);
  c('Move all is undoable', (await task(store, 'rem-late')).dueDate === iso.yesterday);
  const unlabeled = await win.evaluate(() => [...document.querySelectorAll('input,select,button')].filter(el => !el.hidden && !(el.labels?.length) && !el.getAttribute('aria-label') && !el.textContent.trim()).length);
  check('Layout', 'every reminder-window control has a label', unlabeled === 0, unlabeled);
  c('last working day: the evening links to the week report', await win.isVisible('#weekNudge'));
  const [rep2] = await Promise.all([ctx.waitForEvent('page'), win.click('#openReport')]);
  await rep2.waitForLoadState(); await wait(300);
  c('"Open the week report" opens the report and closes the window', rep2.url().endsWith('/' + PAGES.report) && win.isClosed(), rep2.url());
  await rep2.close();
  const brief = watch(await ctx.newPage());
  await brief.goto(`${X}/${PAGES.remind}?slot=morning`); await wait(800);
  c('morning brief: what is due, no Move all, no nudge', /due today\.$/.test(await brief.textContent('#headline')) && !(await brief.isVisible('#moveAll')) && !(await brief.isVisible('#weekNudge')), await brief.textContent('#headline'));
  const [app] = await Promise.all([ctx.waitForEvent('page'), brief.click('#openApp')]);
  await app.waitForLoadState(); await wait(600);
  c('"Open Weekly" opens that day in the app', app.url().endsWith(`/${PAGES.app}#day=${iso.today}`) && await app.evaluate(() => document.querySelector('#daySheet').open), app.url());
  await app.close();
  await seed(sw, { settings: { days: [1, 2, 3, 4, 5] } });
}
```

In `test/e2e/full.mjs`, replace:

```js
app: 'src/ui/app/app.html', welcome: 'src/ui/welcome/welcome.html' };
```

with:

```js
app: 'src/ui/app/app.html', welcome: 'src/ui/welcome/welcome.html', remind: 'src/ui/remind/remind.html' };
```

In `test/e2e/full.mjs`, replace:

```js
await doneChecks(harness, rep, pan);
```

with:

```js
await doneChecks(harness, rep, pan);

// ===== 5c. Reminders =====
const { reminderWindowChecks } = await import('./reminders.mjs');
await reminderWindowChecks(harness);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run e2e`

Expected: the 134 checks before section 5c pass; then the run stops with `page.goto: net::ERR_FILE_NOT_FOUND at chrome-extension://…/src/ui/remind/remind.html?slot=evening` (there is no reminder page yet).

- [ ] **Step 3: Write the window**

Create `src/ui/remind/remind.html`:

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Weekly reminder</title>
<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../components/tasks.css"><link rel="stylesheet" href="remind.css"></head>
<body>
<header class="rhead">
  <p id="eyebrow" class="eyebrow"></p>
  <h1 id="headline"></h1>
  <p id="sub" class="sub"></p>
</header>
<main id="list" class="rbody"></main>
<p id="weekNudge" class="nudge" hidden>That’s your week. Your weekly update is drafted and ready to review.
  <button id="openReport" class="quiet">Open the week report →</button></p>
<footer class="rfoot">
  <button id="moveAll" class="primary" hidden>Move all to tomorrow</button>
  <button id="openApp">Open Weekly</button>
  <span class="spacer"></span>
  <button id="dismiss" class="quiet">Dismiss</button>
</footer>
<script type="module" src="remind.js"></script>
</body></html>
```

Create `src/ui/remind/remind.css`:

```css
/* The reminder window: a small popup. Header, the task bands, then a footer of actions. */
body { min-height: 100vh; display: flex; flex-direction: column; background: var(--sheet); border-top: 3px solid var(--navy); }
body.evening { border-top-color: var(--marker); }
.rhead { padding: 16px 20px 10px; border-bottom: 1px solid var(--rule); }
.eyebrow { margin: 0; font: 600 11px var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.rhead h1 { margin: 6px 0 2px; font: 400 24px/1.2 var(--serif); }
.sub { margin: 0; color: var(--muted); font-size: 13px; }
.rbody { flex: 1; overflow-y: auto; padding: 12px 20px; }
.rbody .row { grid-template-columns: 18px minmax(0, 1fr) auto auto; }
.allclear { margin: 8px 0; font: italic 16px/1.4 var(--serif); color: var(--muted); }
.nudge { margin: 0; padding: 8px 20px; background: var(--marker-wash); color: var(--marker-ink); font-size: 13px; }
.rfoot { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 10px 20px; border-top: 1px solid var(--rule); background: var(--paper); }
.spacer { flex: 1; }
```

Create `src/ui/remind/remind.js`:

```js
// The reminder window (spec §3.3; D7, D8): the morning brief or the evening check,
// chosen by ?slot=morning|evening. The worker opens it, one window, reused.
// Rows are the shared task rows (tick, ⋯ menu, Undo). The evening adds Move to
// tomorrow on each one-off and Move all to tomorrow, and on the last working day
// it links to the week report: the nudge that replaced Weekly 2's Friday reminder.
import { $, h } from '../components/dom.js';
import { renderBands } from '../components/bands.js';
import { taskRow } from '../components/task-row.js';
import { bindKeys, onNewDay } from '../components/keys.js';
import { report } from '../components/undo.js';
import * as act from '../components/task-actions.js';
import { getTasks } from '../../lib/tasks.js';
import { onTasksChanged } from '../../lib/storage.js';
import { getSettings, onSettingsChanged } from '../../lib/settings.js';
import { buildPayload, headline, subline } from '../../lib/reminders.js';
import { today, stampDate } from '../../lib/dates.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

const slot = new URLSearchParams(location.search).get('slot') === 'evening' ? 'evening' : 'morning';
/** @type {{ tasks: Task[], days: number[] }} */
const state = { tasks: [], days: [] };

/** One task row; in the evening a one-off also gets its own Move to tomorrow. @param {Task} t @param {string} day */
function row(t, day) {
  const li = taskRow(t, { day });
  if (slot === 'evening' && t.repeat === null) {
    li.append(h('button', { class: 'quiet later', attrs: { 'aria-label': `Move to tomorrow: ${t.title}` },
      on: { click: () => void act.moveToTomorrow([t]) } }, 'Tomorrow'));
  }
  return li;
}

function render() {
  const day = today();
  const p = buildPayload(slot, state.tasks, state.days, day);
  document.body.classList.toggle('evening', slot === 'evening');
  $('#eyebrow').textContent = `${slot === 'morning' ? 'Morning' : 'End of day'} · ${stampDate(day)}`;
  $('#headline').textContent = headline(p);
  $('#sub').textContent = subline(p);
  const bands = [
    { key: 'overdue', label: 'Carried over', tasks: p.overdue, flagged: true },
    { key: 'today', label: 'Today', tasks: p.today },
  ].filter((b) => b.tasks.length);
  renderBands($('#list'), bands, (t) => row(t, day));
  if (p.empty) $('#list').append(h('p', { class: 'allclear' }, `You closed ${p.closedToday} today and nothing rolled over.`));
  $('#moveAll').hidden = slot !== 'evening' || ![...p.overdue, ...p.today].some((t) => t.repeat === null);
  $('#weekNudge').hidden = !(slot === 'evening' && p.weekEnds);
}

/** Open a Weekly page as a normal tab, then close this window. @param {string} path */
async function openTab(path) {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL(path) });
    window.close();
  } catch (e) { report(e); }
}

async function init() {
  $('#moveAll').onclick = () => {
    const p = buildPayload(slot, state.tasks, state.days);
    void act.moveToTomorrow([...p.overdue, ...p.today]);
  };
  $('#openApp').onclick = () => void openTab(`src/ui/app/app.html#day=${today()}`);
  $('#openReport').onclick = () => void openTab('src/ui/report/report.html');
  $('#dismiss').onclick = () => window.close();
  bindKeys({});
  onNewDay(render);
  onTasksChanged((next) => { state.tasks = next; render(); });
  onSettingsChanged((s) => { state.days = s.days; render(); });
  const [tasks, settings] = await Promise.all([getTasks(), getSettings()]);
  Object.assign(state, { tasks, days: settings.days });
  render();
}

void init();
```

In `jsconfig.json`, replace:

```json
"src/ui/app/**/*.js"]
```

with:

```json
"src/ui/app/**/*.js", "src/ui/remind/**/*.js"]
```

- [ ] **Step 4: Run the unit tests and the typecheck**

Run: `npm test && npm run typecheck`

Expected: `# tests 213`, `# pass 213` in each timezone; typecheck clean (it now covers `src/ui/remind`).

- [ ] **Step 5: Run the end-to-end suite**

Run: `npm run e2e`

Expected: `185/185 passed` (176 + 9 in `reminders.mjs`).

---

### Task 4: The reminder engine replaces the Friday reminder

Daybook's `reminders.js` scheduling and delivery, ported into the worker: one-shot alarms chained after every fire (DST-safe), Daybook's guards, one reused popup window, the system notification, catch-up on browser start and snooze. Weekly 2's Friday reminder goes: its code, its two checkboxes and its `reminder` setting. Its alarm is cleared as an orphan on update, and its flag decides whether an upgraded profile gets the new reminders at all.

**Files:**
- Create: `src/background/reminders.js`, `test/background/reminders.test.js`
- Modify: `src/background/service-worker.js` (Friday code out; alarms, notification clicks, window closes, messages and catch-up in)
- Modify: `src/lib/settings.js` (Weekly 2's `reminder` flag), `src/ui/welcome/welcome.html`, `src/ui/welcome/welcome.js`, `src/ui/report/report.html`, `src/ui/report/settings-panel.js` (the Friday checkboxes)
- Modify: `src/ui/remind/remind.html`, `src/ui/remind/remind.js` (Snooze 1 h)
- Modify: `test/helpers/chrome-stub.js` (a created window has a tab), `test/settings.test.js` (append)
- Replace: `test/background/service-worker.test.js`
- Modify: `test/e2e/reminders.mjs` (append), `test/e2e/full.mjs` (welcome check, reminders off for the run, section 5c, Friday checks out)

**Interfaces:**
- Consumes: `getSettings` (Task 2), `getTasks`, `getReminderState`, `updateReminderState` (Task 1), `buildPayload`, `isReminderDay`, `notificationText`, `SLOTS` (Task 2), `today`, `nextOccurrence`, `todayAt` (`dates.js`).
- Produces (`src/background/reminders.js`, worker only):
  - `ALARM = { morning: 'weekly:morning', evening: 'weekly:evening', snooze: 'weekly:snooze' }`; `NOTIFICATION_PREFIX = 'weekly:remind:'` (ids `weekly:remind:morning|evening`)
  - `rescheduleAll(from = new Date())`: clears both slot alarms and creates each enabled one at `nextOccurrence(time, from)`
  - `clearOrphanAlarms() → string[]`: clears every alarm except the three above and `tick`
  - `slotForAlarm(name) → Slot | null`
  - `fire(slot, { force? }) → 'shown' | 'skipped-disabled' | 'skipped-day' | 'skipped-shown' | 'skipped-empty'`
  - `catchUp(from = new Date())`, `openReminderWindow(slot)`, `forgetWindowIfClosed(windowId)`, `showNotification(payload)`, `snooze(minutes = 60)`
  - Session key `reminderWindowId` (the one window's id).
- Produces (worker messages, answered `{ ok: true }`): `{ type: 'reminder:preview', slot }` opens the window without touching the schedule; `{ type: 'reminder:snooze' }` snoozes the evening check for an hour.
- Produces (`src/lib/settings.js`): `reminder` is gone from `DEFAULTS` and from every settings object `readSettings` returns.
- Produces (`test/e2e/reminders.mjs`): `reminderEngineChecks(t)`.

- [ ] **Step 1: Write the failing engine tests**

In `test/helpers/chrome-stub.js`, replace:

```js
        const id = log.windowsCreated.length + 1;
```

with:

```js
        const id = 100 + log.windowsCreated.length;   // never 1, the focused browser window
```

In `test/helpers/chrome-stub.js`, replace:

```js
      async query() { return state.tab ? [state.tab] : []; },
```

with:

```js
      // A window this stub created (the reminder window) holds one tab; any other query sees the focused tab.
      async query(q) {
        if (log.windowsCreated.some((w) => w.id === q?.windowId)) return [{ id: 1000 + q.windowId, windowId: q.windowId }];
        return state.tab ? [state.tab] : [];
      },
```

Create `test/background/reminders.test.js`:

```js
// The reminder engine: Daybook's decision matrix (each case would take a real day
// to check by hand), the one reused window, catch-up, and the DST-safe one-shot alarms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

const ctx = installChromeStub();
const { fire, catchUp, rescheduleAll, clearOrphanAlarms, snooze, forgetWindowIfClosed, ALARM } = await import('../../src/background/reminders.js');
const { coerceTask } = await import('../../src/lib/schema.js');
const { toISODate, addDays } = await import('../../src/lib/dates.js');

const TODAY = toISODate();
const YESTERDAY = addDays(TODAY, -1);
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Fresh storage and logs. Every weekday is on, so the day of the week never decides a test by accident. */
async function seed(settings = {}, tasks = [], reminderState = {}) {
  for (const store of Object.values(ctx.stores)) for (const k of Object.keys(store)) delete store[k];
  for (const list of [ctx.log.windowsCreated, ctx.log.windowsUpdated, ctx.log.tabsUpdated, ctx.log.notifications]) list.length = 0;
  ctx.log.alarms.clear();
  await ctx.chrome.storage.local.set({
    settings: { days: EVERY_DAY, ...settings },
    tasks: tasks.map((t) => coerceTask({ title: 'a task', ...t })),
    schemaVersion: 2,
    reminderState: { morningLastShown: null, eveningLastShown: null, snoozeUntil: null, ...reminderState },
  });
}

test('a normal morning fires and opens exactly one popup window, with a notification', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  assert.equal(await fire('morning'), 'shown');
  assert.equal(ctx.log.windowsCreated.length, 1);
  assert.equal(ctx.log.windowsCreated[0].type, 'popup');
  assert.match(ctx.log.windowsCreated[0].url, /src\/ui\/remind\/remind\.html\?slot=morning$/);
  assert.equal(ctx.log.notifications.length, 1, 'system notification is on by default');
  assert.equal(ctx.log.notifications[0].id, 'weekly:remind:morning');
});

test('the morning brief is skipped when there is nothing to report, and marked shown', async () => {
  await seed({}, []);
  assert.equal(await fire('morning'), 'skipped-empty');
  assert.equal(ctx.log.windowsCreated.length, 0);
  const { reminderState } = await ctx.chrome.storage.local.get('reminderState');
  assert.equal(reminderState.morningLastShown, TODAY, 'marking it shown stops catch-up re-evaluating it all day');
});

test('the evening check always shows, including the all-clear', async () => {
  await seed({}, []);
  assert.equal(await fire('evening'), 'shown');
  assert.match(ctx.log.windowsCreated[0].url, /slot=evening/);
});

test('a slot fires at most once per day', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  assert.equal(await fire('morning'), 'shown');
  assert.equal(await fire('morning'), 'skipped-shown');
  assert.equal(ctx.log.windowsCreated.length, 1, 'no second window');
});

test('a disabled slot does not fire', async () => {
  await seed({ morning: { enabled: false, time: '09:00' } }, [{ dueDate: TODAY }]);
  assert.equal(await fire('morning'), 'skipped-disabled');
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('a day that is not a working day does not fire', async () => {
  await seed({ days: [] }, [{ dueDate: TODAY }]);
  assert.equal(await fire('morning'), 'skipped-day');
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('force overrides every guard, so Preview and a snooze always show', async () => {
  await seed({ days: [], morning: { enabled: false, time: '09:00' } }, [], { morningLastShown: TODAY });
  assert.equal(await fire('morning', { force: true }), 'shown');
});

test('the system notification can be turned off independently of the window', async () => {
  await seed({ systemNotification: false }, [{ dueDate: TODAY }]);
  await fire('morning');
  assert.equal(ctx.log.windowsCreated.length, 1);
  assert.equal(ctx.log.notifications.length, 0);
});

test('a second reminder reuses the open window instead of stacking a new one', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  await fire('morning');
  await fire('evening');
  assert.equal(ctx.log.windowsCreated.length, 1, 'still one OS window');
  assert.equal(ctx.log.windowsUpdated.length, 1, 'the existing one is focused');
  assert.match(ctx.log.tabsUpdated.at(-1).url, /slot=evening/, 'and navigated to the new slot');
});

test('a window the user closed is forgotten, so the next reminder opens a new one', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  await fire('morning');
  await forgetWindowIfClosed(ctx.log.windowsCreated[0].id);
  await fire('evening');
  assert.equal(ctx.log.windowsCreated.length, 2);
});

test('catch-up delivers a slot whose time has passed today', async () => {
  await seed({ morning: { enabled: true, time: '09:00' }, evening: { enabled: false, time: '18:00' } }, [{ dueDate: TODAY }]);
  await catchUp(new Date(`${TODAY}T10:40:00`));
  assert.equal(ctx.log.windowsCreated.length, 1);
});

test('catch-up does not fire a slot that is still ahead', async () => {
  await seed({ morning: { enabled: true, time: '23:59' }, evening: { enabled: false, time: '18:00' } }, [{ dueDate: TODAY }]);
  await catchUp(new Date(`${TODAY}T10:40:00`));
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('catch-up cannot double-fire a slot already shown today', async () => {
  await seed({ evening: { enabled: false, time: '18:00' } }, [{ dueDate: TODAY }], { morningLastShown: TODAY });
  await catchUp(new Date(`${TODAY}T10:40:00`));
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('catch-up with both slots past leaves the evening check on screen', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  await catchUp(new Date(`${TODAY}T20:00:00`));
  assert.equal(ctx.log.windowsCreated.length, 1);
  assert.match(ctx.log.tabsUpdated.at(-1).url, /slot=evening/);
});

test('catch-up respects its own setting', async () => {
  await seed({ catchUpOnStartup: false }, [{ dueDate: TODAY }]);
  await catchUp(new Date(`${TODAY}T20:00:00`));
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('rescheduleAll creates one-shot alarms in the future, never a 24 h period', async () => {
  await seed({});
  await rescheduleAll();
  const morning = ctx.log.alarms.get(ALARM.morning);
  const evening = ctx.log.alarms.get(ALARM.evening);
  assert.ok(morning && evening);
  assert.ok(morning.when > Date.now(), 'an alarm in the past fires at once, in a loop');
  assert.equal(morning.periodInMinutes, undefined, 'a fixed period drifts across DST');
  assert.equal(new Date(morning.when).getHours(), 9);
  assert.equal(new Date(evening.when).getHours(), 18);
});

test('rescheduleAll leaves out a disabled slot and clears its old alarm', async () => {
  await seed({});
  await rescheduleAll();
  await ctx.chrome.storage.local.set({ settings: { days: EVERY_DAY, evening: { enabled: false, time: '18:00' } } });
  await rescheduleAll();
  assert.ok(!ctx.log.alarms.has(ALARM.evening), 'a stale alarm would keep firing after the toggle');
  assert.ok(ctx.log.alarms.has(ALARM.morning));
});

test('DST spring forward (8 Mar 2026 in New York): the next brief is still 09:00 local', async () => {
  await seed({});
  await rescheduleAll(new Date(2026, 2, 7, 9, 1));
  const at = new Date(ctx.log.alarms.get(ALARM.morning).when);
  assert.deepEqual([at.getDate(), at.getHours(), at.getMinutes()], [8, 9, 0]);
});

test('DST fall back (1 Nov 2026 in New York): the evening check is still 18:00 local', async () => {
  await seed({});
  await rescheduleAll(new Date(2026, 9, 31, 18, 1));
  const at = new Date(ctx.log.alarms.get(ALARM.evening).when);
  assert.deepEqual([at.getDate(), at.getHours(), at.getMinutes()], [1, 18, 0]);
});

test('a week of chained fires across the clock change stays on 09:00, where +24 h would drift', async () => {
  await seed({ evening: { enabled: false, time: '18:00' } });
  let from = new Date(2026, 2, 5, 9, 0, 30);
  const hours = [];
  let shifted = false;
  for (let i = 0; i < 6; i++) {
    await rescheduleAll(from);
    const when = ctx.log.alarms.get(ALARM.morning).when;
    hours.push(new Date(when).getHours());
    if (new Date(from.getTime() + 864e5).getHours() !== 9) shifted = true;   // where a fixed period would have landed
    from = new Date(when + 30_000);                                          // the alarm fires; the next is chained from then
  }
  assert.deepEqual(hours, [9, 9, 9, 9, 9, 9]);
  if (new Date(2026, 2, 7).getTimezoneOffset() !== new Date(2026, 2, 9).getTimezoneOffset()) {
    assert.ok(shifted, 'in a DST zone, +24 h from one fire would land at 10:00 after spring forward');
  }
});

test('orphans are cleared: Weekly 2’s Friday alarm goes, the tick, slots and a pending snooze stay', async () => {
  await seed({});
  await rescheduleAll();
  ctx.chrome.alarms.create('reminder', { when: Date.now() + 60_000 });
  ctx.chrome.alarms.create('tick', { periodInMinutes: 1 });
  await snooze(60);
  assert.deepEqual(await clearOrphanAlarms(), ['reminder']);
  for (const name of [ALARM.morning, ALARM.evening, ALARM.snooze, 'tick']) assert.ok(ctx.log.alarms.has(name), name);
  assert.deepEqual(await clearOrphanAlarms(), [], 'a no-op when there are none');
});

test('snooze brings the evening check back in an hour and records it', async () => {
  await seed({});
  const before = Date.now();
  await snooze(60);
  const when = ctx.log.alarms.get(ALARM.snooze).when;
  assert.ok(when >= before + 3_600_000 && when <= Date.now() + 3_600_000);
  const { reminderState } = await ctx.chrome.storage.local.get('reminderState');
  assert.equal(reminderState.snoozeUntil, when);
});

test('the evening payload is what the window lists: yesterday’s open task is carried over', async () => {
  await seed({}, [{ id: 'late', dueDate: YESTERDAY }]);
  assert.equal(await fire('evening'), 'shown');
  assert.equal(ctx.log.notifications[0].title, 'One task still open');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `TZ=America/New_York node --test test/background/reminders.test.js`

Expected: FAIL with `Cannot find module '…/src/background/reminders.js'`.

- [ ] **Step 3: Write the failing worker and settings tests**

Replace `test/background/service-worker.test.js` with:

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

/** Call every listener the worker registered for a chrome event. */
const emit = (/** @type {string} */ name, /** @type {unknown[]} */ ...args) => {
  for (const fn of stub.log.listeners[name] ?? []) fn(...args);
};
/** What a settings change reschedules from: storage, read under the lock. */
const setSettings = (/** @type {object} */ settings) => stub.chrome.storage.local.set({ settings });

test('a local settings change reschedules the morning and evening alarms', async () => {
  await setSettings({ morning: { enabled: false, time: '09:00' } });
  fire({ settings: { newValue: {} } }, 'local');
  await settle();
  assert.equal(stub.log.alarms.has('weekly:morning'), false, 'turning the brief off clears its alarm');
  assert.ok(stub.log.alarms.has('weekly:evening'));
  await setSettings({});
  fire({ settings: { newValue: {} } }, 'local');
  await settle();
  assert.ok(stub.log.alarms.has('weekly:morning'), 'turning it back on schedules it');
});

test('other areas and other keys never touch the reminders', async () => {
  stub.log.alarms.clear();
  fire({ settings: { newValue: {} } }, 'sync');
  fire({ tasks: { newValue: [] } }, 'local');
  await settle();
  assert.equal(stub.log.alarms.size, 0);
});

test('Weekly 2’s Friday alarm is cleared on update; the new slots are scheduled', async () => {
  stub.chrome.alarms.create('reminder', { when: Date.now() + 60_000 });
  emit('runtime.onInstalled', { reason: 'update' });
  await settle();
  assert.equal(stub.log.alarms.has('reminder'), false);
  assert.ok(stub.log.alarms.has('weekly:morning') && stub.log.alarms.has('weekly:evening') && stub.log.alarms.has('tick'));
});

test('an evening alarm shows the check and chains the next one', async () => {
  await setSettings({ days: [0, 1, 2, 3, 4, 5, 6] });
  stub.log.alarms.delete('weekly:evening');
  emit('alarms.onAlarm', { name: 'weekly:evening' });
  await settle();
  assert.match(stub.log.windowsCreated.at(-1)?.url ?? '', /slot=evening/);
  assert.ok(stub.log.alarms.get('weekly:evening').when > Date.now());
});

test('a browser start catches up a check whose time has passed (D9)', async () => {
  await setSettings({ morning: { enabled: false, time: '09:00' }, evening: { enabled: true, time: '00:00' }, days: [0, 1, 2, 3, 4, 5, 6] });
  await stub.chrome.storage.local.remove('reminderState');
  const before = stub.log.windowsCreated.length + stub.log.tabsUpdated.length;
  emit('runtime.onStartup');
  await settle();
  assert.equal(stub.log.windowsCreated.length + stub.log.tabsUpdated.length, before + 1);
  assert.match(stub.log.tabsUpdated.at(-1)?.url ?? stub.log.windowsCreated.at(-1)?.url ?? '', /slot=evening/);
});

test('clicking a reminder notification opens its window; Weekly 2’s old notification id is ignored', async () => {
  const before = stub.log.windowsCreated.length + stub.log.tabsUpdated.length;
  emit('notifications.onClicked', 'reminder');
  emit('notifications.onClicked', 'weekly:remind:morning');
  await settle();
  assert.equal(stub.log.windowsCreated.length + stub.log.tabsUpdated.length, before + 1);
  assert.match(stub.log.tabsUpdated.at(-1)?.url ?? '', /slot=morning/);
});

test('messages: Preview opens the window, Snooze sets the snooze alarm; others are not answered', async () => {
  /** @type {unknown[]} */
  const answers = [];
  emit('runtime.onMessage', { type: 'reminder:preview', slot: 'evening' }, {}, (/** @type {unknown} */ r) => answers.push(r));
  emit('runtime.onMessage', { type: 'reminder:snooze' }, {}, (/** @type {unknown} */ r) => answers.push(r));
  emit('runtime.onMessage', { type: 'something-else' }, {}, (/** @type {unknown} */ r) => answers.push(r));
  await settle();
  assert.deepEqual(answers, [{ ok: true }, { ok: true }]);
  assert.match(stub.log.tabsUpdated.at(-1)?.url ?? '', /slot=evening/);
  assert.ok(stub.log.alarms.has('weekly:snooze'));
});

test('the worker listens to storage once, through onSettingsChanged', () => {
  assert.equal(stub.log.listeners['storage.onChanged']?.length, 1);
});

test('the toolbar icon opens the side panel', () => {
  assert.deepEqual(stub.log.panelBehavior, { openPanelOnActionClick: true });
});
```

Append to `test/settings.test.js`:

```js
test('a Weekly 2 profile: its Friday reminder flag turns both slots on or off, then is dropped', async () => {
  const { getSettings, updateSettings } = await import('../src/lib/settings.js');
  stub.stores.local.settings = { role: 'hr', reminder: false };
  const off = await getSettings();
  assert.deepEqual([off.morning.enabled, off.evening.enabled, 'reminder' in off], [false, false, false]);
  stub.stores.local.settings = { role: 'hr', reminder: true };
  const on = await getSettings();
  assert.deepEqual([on.morning.enabled, on.evening.enabled], [true, true]);
  await updateSettings({ role: 'sales' });
  assert.equal('reminder' in stub.stores.local.settings, false, 'the old flag is not written back');
  assert.deepEqual(stub.stores.local.settings.morning, { enabled: true, time: '09:00' });
  stub.stores.local.settings = { ...stub.stores.local.settings, reminder: false };
  assert.equal((await getSettings()).morning.enabled, true, 'once the slots exist, a stray old flag decides nothing');
});
```

- [ ] **Step 4: Run them to see them fail**

Run: `TZ=America/New_York node --test test/background/service-worker.test.js test/settings.test.js`

Expected: 20 tests, 7 `not ok`: six of the seven new worker tests (no `weekly:morning` alarm, no window, `answers` empty; `other areas and other keys never touch the reminders` already holds) and the Weekly 2 settings test (`reminder` is still in the object).

- [ ] **Step 5: Write the engine**

Create `src/background/reminders.js`:

```js
/**
 * The reminder engine (spec §3.3; D8, D9), ported from Daybook's reminders.js.
 *
 * One-shot alarms, never `periodInMinutes: 1440`: a 24-hour period is 24 hours of
 * elapsed time, not "09:00 tomorrow", so across a DST change the brief would
 * arrive an hour off and never correct itself. Each fire schedules exactly one
 * successor, recomputed from the local calendar (dates.nextOccurrence).
 *
 * One reminder window, reused. Its id lives in session storage; the worker runs
 * every reminder handler through its serial queue, so the alarm and the startup
 * catch-up can never both decide to open a window at the same moment.
 */

import { getSettings } from '../lib/settings.js';
import { getTasks, getReminderState, updateReminderState } from '../lib/storage.js';
import { buildPayload, isReminderDay, notificationText, SLOTS } from '../lib/reminders.js';
import { today, nextOccurrence, todayAt } from '../lib/dates.js';

/** @typedef {import('../lib/reminders.js').Slot} Slot */

export const ALARM = Object.freeze({ morning: 'weekly:morning', evening: 'weekly:evening', snooze: 'weekly:snooze' });
/** Alarms the worker owns besides these. Anything else (Weekly 2's Friday 'reminder') is an orphan. */
const KEEP = ['tick'];
export const NOTIFICATION_PREFIX = 'weekly:remind:';
const WINDOW_KEY = 'reminderWindowId';
const WINDOW_SIZE = { width: 520, height: 600 };

/**
 * Rebuild both slot alarms from current settings. The one entry point for install,
 * startup, a settings change and each fire.
 * @param {Date} [from]
 */
export async function rescheduleAll(from = new Date()) {
  const s = await getSettings();
  await Promise.all([chrome.alarms.clear(ALARM.morning), chrome.alarms.clear(ALARM.evening)]);
  for (const slot of SLOTS) {
    if (s[slot].enabled) await chrome.alarms.create(ALARM[slot], { when: nextOccurrence(s[slot].time, from) });
  }
}

/**
 * Drop every alarm that is no longer ours. Alarms outlive the code that made them,
 * so Weekly 2's Friday alarm would otherwise keep waking the worker on update.
 * @returns {Promise<string[]>} the names it cleared
 */
export async function clearOrphanAlarms() {
  const known = new Set([...Object.values(ALARM), ...KEEP]);
  const orphans = (await chrome.alarms.getAll()).map((a) => a.name).filter((n) => !known.has(n));
  await Promise.all(orphans.map((n) => chrome.alarms.clear(n)));
  return orphans;
}

/** @param {string} name @returns {Slot | null} */
export const slotForAlarm = (name) => (name === ALARM.morning ? 'morning' : name === ALARM.evening ? 'evening' : null);

/**
 * Decide whether `slot` should show now, and show it. `force` (Preview, a snooze)
 * skips every guard. The morning brief is skipped when there is nothing to report;
 * the evening check always shows, because the all-clear is what it is for.
 * @param {Slot} slot @param {{ force?: boolean }} [opts]
 * @returns {Promise<'shown' | 'skipped-disabled' | 'skipped-day' | 'skipped-shown' | 'skipped-empty'>}
 */
export async function fire(slot, opts = {}) {
  const s = await getSettings();
  const ref = today();
  const key = slot === 'morning' ? 'morningLastShown' : 'eveningLastShown';
  if (!opts.force) {
    if (!s[slot].enabled) return 'skipped-disabled';
    if (!isReminderDay(s.days, ref)) return 'skipped-day';
    if ((await getReminderState())[key] === ref) return 'skipped-shown';
  }
  const payload = buildPayload(slot, await getTasks(), s.days, ref);
  if (slot === 'morning' && payload.empty && !opts.force) {
    await updateReminderState({ [key]: ref });
    return 'skipped-empty';
  }
  await openReminderWindow(slot);
  if (s.systemNotification) await showNotification(payload);
  await updateReminderState({ [key]: ref, snoozeUntil: null });
  return 'shown';
}

/**
 * Catch-up on browser start: alarms cannot wake a closed browser, so opening the
 * laptop at 10:40 must still bring the 09:00 brief. Morning first, so when both
 * are due the evening check is the one left on screen.
 * @param {Date} [from]
 */
export async function catchUp(from = new Date()) {
  const s = await getSettings();
  if (!s.catchUpOnStartup) return;
  for (const slot of SLOTS) {
    if (s[slot].enabled && from.getTime() > todayAt(s[slot].time, from)) await fire(slot);
  }
}

/** Open the reminder window, or reuse and focus the one already open. @param {Slot} slot */
export async function openReminderWindow(slot) {
  const url = chrome.runtime.getURL(`src/ui/remind/remind.html?slot=${slot}`);
  const existing = (await chrome.storage.session.get(WINDOW_KEY))[WINDOW_KEY];
  if (typeof existing === 'number') {
    try {
      await chrome.windows.update(existing, { focused: true, drawAttention: true });
      // No url filter, so this needs no "tabs" permission: only the id is read.
      const [tab] = await chrome.tabs.query({ windowId: existing });
      if (tab?.id !== undefined) { await chrome.tabs.update(tab.id, { url }); return; }
    } catch { /* closed since; open a new one below */ }
  }
  const win = await chrome.windows.create({ url, type: 'popup', focused: true, ...WINDOW_SIZE });
  await chrome.storage.session.set({ [WINDOW_KEY]: win.id });
}

/** @param {number} closedId */
export async function forgetWindowIfClosed(closedId) {
  if ((await chrome.storage.session.get(WINDOW_KEY))[WINDOW_KEY] === closedId) await chrome.storage.session.remove(WINDOW_KEY);
}

/**
 * The path that reaches you when Chrome is not the app in front: a Chrome
 * window cannot take focus from Slack or a terminal; a notification can.
 * @param {import('../lib/reminders.js').ReminderPayload} payload
 */
export async function showNotification(payload) {
  const { title, message } = notificationText(payload);
  try {
    await chrome.notifications.create(NOTIFICATION_PREFIX + payload.slot, {
      type: 'basic', iconUrl: chrome.runtime.getURL('icons/128.png'), title, message, requireInteraction: true,
    });
  } catch (e) {
    console.warn('[weekly] notification failed; the reminder window still opened', e);
  }
}

/** Bring the evening check back in `minutes`. @param {number} [minutes] */
export async function snooze(minutes = 60) {
  const when = Date.now() + minutes * 60_000;
  await updateReminderState({ snoozeUntil: when });
  await chrome.alarms.create(ALARM.snooze, { when });
}
```

- [ ] **Step 6: Wire it into the worker; the Friday reminder goes**

In `src/background/service-worker.js`, replace:

```js
import { refresh } from './tracker.js';
import { getSettings, onSettingsChanged } from '../lib/settings.js';
```

with:

```js
import { refresh } from './tracker.js';
import * as reminders from './reminders.js';
import { getSettings, onSettingsChanged } from '../lib/settings.js';
```

In `src/background/service-worker.js`, replace:

```js
function nextFriday(now = new Date()) {
  const d = new Date(now); d.setHours(16, 0, 0, 0);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  if (d <= now) d.setDate(d.getDate() + 7);
  return d.getTime();
}

/** @param {{ reminder?: boolean }} s */
async function scheduleReminder(s) {
  if (s.reminder) await chrome.alarms.create('reminder', { when: nextFriday() });
  else await chrome.alarms.clear('reminder');
}

async function setup() {
```

with:

```js
async function setup() {
```

In `src/background/service-worker.js`, replace:

```js
  await chrome.alarms.create('tick', { periodInMinutes: 1 });
  await scheduleReminder(s);
```

with:

```js
  await chrome.alarms.create('tick', { periodInMinutes: 1 });
  // The morning brief and evening check replace Weekly 2's Friday reminder; its alarm is an orphan now.
  await reminders.clearOrphanAlarms();
  await reminders.rescheduleAll();
```

In `src/background/service-worker.js`, replace:

```js
const openReport = () => chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/report/report.html') });

chrome.runtime.onInstalled.addListener(({ reason }) => {
```

with:

```js
chrome.runtime.onInstalled.addListener(({ reason }) => {
```

In `src/background/service-worker.js`, replace:

```js
chrome.runtime.onStartup.addListener(() => serial(setup));
```

with:

```js
chrome.runtime.onStartup.addListener(() => { serial(setup); serial(() => reminders.catchUp()); });
```

In `src/background/service-worker.js`, replace:

```js
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'tick') serial(refresh);
  if (a.name === 'reminder') serial(async () => {
    await chrome.notifications.create('reminder', {
      type: 'basic', iconUrl: chrome.runtime.getURL('icons/128.png'), title: 'Weekly update time',
      message: 'Your draft is ready. Review it and send it before you log off.',
    });
    await scheduleReminder(await getSettings());
  });
});
chrome.notifications.onClicked.addListener(id => { if (id === 'reminder') openReport(); });
onSettingsChanged((s) => {
  chrome.idle.setDetectionInterval(Math.max(15, s.idleSeconds));
  serial(() => scheduleReminder(s));
  serial(refresh);
});
```

with:

```js
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'tick') serial(refresh);
  // A snoozed evening check was already marked shown today, so it comes back forced.
  if (a.name === reminders.ALARM.snooze) serial(() => reminders.fire('evening', { force: true }));
  const slot = reminders.slotForAlarm(a.name);
  // Each fire chains its own successor, so the time follows the local clock across DST and sleep.
  if (slot) serial(async () => { await reminders.fire(slot); await reminders.rescheduleAll(); });
});
chrome.notifications.onClicked.addListener(id => {
  if (!id.startsWith(reminders.NOTIFICATION_PREFIX)) return;
  serial(async () => {
    await chrome.notifications.clear(id);
    await reminders.openReminderWindow(id.endsWith('morning') ? 'morning' : 'evening');
  });
});
chrome.windows.onRemoved.addListener(id => serial(() => reminders.forgetWindowIfClosed(id)));
// The reminder window and Settings ask the worker for what only it does: the window and the alarms.
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  const type = /** @type {{ type?: unknown }} */ (msg)?.type;
  const slot = /** @type {{ slot?: unknown }} */ (msg)?.slot === 'evening' ? 'evening' : 'morning';
  if (type === 'reminder:preview') serial(() => reminders.openReminderWindow(slot));
  else if (type === 'reminder:snooze') serial(() => reminders.snooze(60));
  else return false;
  respond({ ok: true });
  return false;
});
onSettingsChanged((s) => {
  chrome.idle.setDetectionInterval(Math.max(15, s.idleSeconds));
  serial(() => reminders.rescheduleAll());
  serial(refresh);
});
```

- [ ] **Step 7: Map Weekly 2's Friday flag, then drop it**

In `src/lib/settings.js`, replace:

```js
  rules: [], ticketPrefixes: [], reminder: false, slackWebhook: '', template: 'weekly', role: 'general', anonymize: false,
```

with:

```js
  rules: [], ticketPrefixes: [], slackWebhook: '', template: 'weekly', role: 'general', anonymize: false,
```

In `src/lib/settings.js`, replace:

```js
 *   ticketPrefixes: string[], reminder: boolean, slackWebhook: string, template: string, role: string, anonymize: boolean,
```

with:

```js
 *   ticketPrefixes: string[], slackWebhook: string, template: string, role: string, anonymize: boolean,
```

In `src/lib/settings.js`, replace:

```js
 * caller: a reminder time, day or flag, and the default priority.
```

with:

```js
 * caller: a reminder time, day or flag, and the default priority. A Weekly 2
 * profile has no reminder slots yet, only its Friday `reminder` flag; that flag
 * turns both slots on or off, so an upgrade never opens windows nobody asked for.
```

In `src/lib/settings.js`, replace:

```js
  const s = /** @type {Settings} */ ({ ...DEFAULTS, ...stored });
```

with:

```js
  const { reminder, ...s } = /** @type {Settings} */ ({ ...DEFAULTS, ...stored });
  const legacy = typeof reminder === 'boolean' && !isObj(stored['morning']) ? reminder : null;
```

In `src/lib/settings.js`, replace:

```js
    return { enabled: flag(o['enabled'], d.enabled), time: typeof time === 'string' && isValidTime(time) ? time : d.time };
```

with:

```js
    return { enabled: legacy ?? flag(o['enabled'], d.enabled), time: typeof time === 'string' && isValidTime(time) ? time : d.time };
```

- [ ] **Step 8: The Friday checkboxes go**

In `src/ui/welcome/welcome.html`, replace:

```html
      <label class="check"><input type="checkbox" id="reminder"> Remind me on Fridays at 4 pm</label>
```

with:

```html
      <label class="check"><input type="checkbox" id="reminders"> A morning brief at 9:00 and an evening check at 18:00, Monday to Friday</label>
```

In `src/ui/welcome/welcome.js`, replace:

```js
// First-run page: role, history backfill, reminder and name hiding. Each choice saves as soon as it changes.
```

with:

```js
// First-run page: role, history backfill, reminders and name hiding. Each choice saves as soon as it changes.
```

In `src/ui/welcome/welcome.js`, replace:

```js
  $('#reminder').checked = s.reminder;
```

with:

```js
  $('#reminders').checked = s.morning.enabled || s.evening.enabled;
```

In `src/ui/welcome/welcome.js`, replace:

```js
$('#reminder').onchange = e => updateSettings({ reminder: e.target.checked });
```

with:

```js
$('#reminders').onchange = e => {
  const on = e.target.checked;
  updateSettings(s => ({ morning: { ...s.morning, enabled: on }, evening: { ...s.evening, enabled: on } }));
};
```

In `src/ui/report/report.html`, replace:

```html
        <legend>Reminders and sharing</legend>
        <label class="check"><input type="checkbox" id="reminder"> Remind me on Fridays at 4 pm</label>
```

with:

```html
        <legend>Sharing</legend>
```

In `src/ui/report/settings-panel.js`, replace:

```js
  $('#ticketPrefixes').value = s.ticketPrefixes.join(', ');
  $('#reminder').checked = s.reminder;
```

with:

```js
  $('#ticketPrefixes').value = s.ticketPrefixes.join(', ');
```

In `src/ui/report/settings-panel.js`, replace:

```js
    reminder: $('#reminder').checked,
    slackWebhook: webhook,
```

with:

```js
    slackWebhook: webhook,
```

Task 5 adds the **Reminders** group to Settings.

- [ ] **Step 9: Snooze 1 h in the evening window**

In `src/ui/remind/remind.html`, replace:

```html
  <span class="spacer"></span>
  <button id="dismiss" class="quiet">Dismiss</button>
```

with:

```html
  <span class="spacer"></span>
  <button id="snooze" class="quiet" hidden>Snooze 1 h</button>
  <button id="dismiss" class="quiet">Dismiss</button>
```

In `src/ui/remind/remind.js`, replace:

```js
  $('#weekNudge').hidden = !(slot === 'evening' && p.weekEnds);
}
```

with:

```js
  $('#weekNudge').hidden = !(slot === 'evening' && p.weekEnds);
  $('#snooze').hidden = slot !== 'evening' || p.empty;
}
```

In `src/ui/remind/remind.js`, replace:

```js
  } catch (e) { report(e); }
}

async function init() {
```

with:

```js
  } catch (e) { report(e); }
}

/** The worker owns the alarms: it brings the evening check back in an hour. */
async function snooze() {
  try {
    await chrome.runtime.sendMessage({ type: 'reminder:snooze' });
    window.close();
  } catch (e) { report(e); }
}

async function init() {
```

In `src/ui/remind/remind.js`, replace:

```js
  $('#dismiss').onclick = () => window.close();
```

with:

```js
  $('#snooze').onclick = () => void snooze();
  $('#dismiss').onclick = () => window.close();
```

- [ ] **Step 10: Run the unit tests and the typecheck**

Run: `npm test && npm run typecheck && (grep -rnE "#reminder'|\.reminder\b|reminder: " src || echo 'no Friday reminder left')`

Expected: `# tests 242`, `# pass 242`, `# fail 0` in each timezone (213 + 23 engine + 5 worker + 1 settings); typecheck clean; `no Friday reminder left`.

- [ ] **Step 11: End-to-end: the engine's checks, and the Friday checks go**

Append to `test/e2e/reminders.mjs`:

```js
const popups = sw => sw.evaluate(() => chrome.windows.getAll({ windowTypes: ['popup'] }));
/** Fire a reminder alarm now; with `opens`, wait for the reminder window page it opens. */
async function fireAlarm(t, name, opens) {
  const { ctx, sw, wait } = t;
  const fired = sw.evaluate(n => chrome.alarms.create(n, { when: Date.now() + 100 }), name);
  if (!opens) { await fired; await wait(1500); return null; }
  const [page] = await Promise.all([ctx.waitForEvent('page', { predicate: p => p.url().includes(opens), timeout: 8000 }), fired]);
  await page.waitForLoadState(); await wait(800);
  return t.watch(page);
}

// The worker's side: one-shot alarms, the one reused window, the notification, once a day, snooze.
export async function reminderEngineChecks(t) {
  const { sw, check, store, wait, iso } = t;
  const c = (name, ok, detail) => check('Reminders', name, ok, detail);
  await seed(sw, { settings: { morning: { enabled: true, time: '09:00' }, evening: { enabled: true, time: '18:00' }, days: [new Date().getDay()] } });
  await sw.evaluate(() => chrome.storage.local.remove('reminderState')); await wait(500);
  const at = async name => { const a = await sw.evaluate(n => chrome.alarms.get(n), name); return a && { ...a, d: new Date(a.scheduledTime) }; };
  const [m, e] = [await at('weekly:morning'), await at('weekly:evening')];
  c('one-shot alarms at 09:00 and 18:00, no repeat period (D8)', m && e && !m.periodInMinutes && !e.periodInMinutes && m.d > new Date() && e.d > new Date()
    && m.d.getHours() === 9 && m.d.getMinutes() === 0 && e.d.getHours() === 18 && e.d.getMinutes() === 0, JSON.stringify([m, e]));
  const win = await fireAlarm(t, 'weekly:evening', 'slot=evening');
  c('the evening alarm opens the reminder window, a popup (D8)', (await popups(sw)).length === 1 && await win.locator('li.row', { hasText: 'Send the invoice' }).count() === 1);
  c('with a system notification (D9)', Object.keys(await sw.evaluate(() => chrome.notifications.getAll())).includes('weekly:remind:evening'));
  const next = await at('weekly:evening');
  c('the fired alarm chains the next one, again at 18:00', next && next.d > new Date() && next.d.getHours() === 18, JSON.stringify(next));
  c('the check is marked shown for today', (await store()).reminderState?.eveningLastShown === iso.today, JSON.stringify((await store()).reminderState));
  await fireAlarm(t, 'weekly:morning');
  c('the morning brief reuses the same window (D9)', (await popups(sw)).length === 1 && win.url().includes('slot=morning'), win.url());
  await fireAlarm(t, 'weekly:evening');
  c('a slot shows at most once a day', win.url().includes('slot=morning'), win.url());
  await win.evaluate(() => chrome.runtime.sendMessage({ type: 'reminder:preview', slot: 'evening' })); await wait(1200);
  await win.click('#snooze'); await wait(800);
  const snoozed = await at('weekly:snooze');
  c('Snooze 1 h closes the window and brings the check back in an hour', win.isClosed() && snoozed && Math.abs(snoozed.scheduledTime - Date.now() - 3_600_000) < 60_000, JSON.stringify(snoozed));
  const again = await fireAlarm(t, 'weekly:snooze', 'slot=evening');
  c('the snoozed check comes back in a new window once the old one is gone', !!again && (await popups(sw)).length === 1);
  await again.click('#dismiss'); await wait(600);
  c('Dismiss closes the window and the worker forgets it', again.isClosed() && !(await sw.evaluate(() => chrome.storage.session.get('reminderWindowId'))).reminderWindowId);
  // Off again, so a real 09:00 or 18:00 can never open a window in the middle of the rest of the suite.
  await seed(sw, { settings: { morning: { enabled: false, time: '09:00' }, evening: { enabled: false, time: '18:00' }, days: [1, 2, 3, 4, 5] } });
}
```

In `test/e2e/full.mjs`, replace:

```js
  await welcome.check('#reminder'); await wait(300);
  check('Welcome', 'Friday reminder can be turned on', (await store()).settings.reminder === true && !!(await sw.evaluate(() => chrome.alarms.get('reminder'))));
```

with:

```js
  const slots = async () => (await sw.evaluate(() => chrome.alarms.getAll())).filter(a => /^weekly:(morning|evening)$/.test(a.name)).length;
  const on0 = await welcome.isChecked('#reminders') && await slots() === 2;
  await welcome.uncheck('#reminders'); await wait(500);
  const s1 = (await store()).settings;
  check('Welcome', 'reminders start on and can be turned off (no Friday alarm)', on0 && !s1.morning.enabled && !s1.evening.enabled && await slots() === 0
    && !(await sw.evaluate(() => chrome.alarms.get('reminder'))), JSON.stringify(s1));
```

The harness's history phase overwrites all settings. It now keeps the reminders off too: with Daybook's defaults on, a run that crosses 09:00 or 18:00 would have a real reminder window open in the middle of other checks. `reminders.mjs` turns them on for its own checks and off again afterwards.

In `test/e2e/full.mjs`, replace:

```js
await sw.evaluate(() => chrome.storage.local.set({ settings: { paused: true, minMinutes: 0, idleSeconds: 14400 } }));
```

with:

```js
// Reminders stay off for the run, so a real 09:00 or 18:00 never opens a window mid-suite; reminders.mjs turns them on itself.
await sw.evaluate(() => chrome.storage.local.set({ settings: { paused: true, minMinutes: 0, idleSeconds: 14400,
  morning: { enabled: false, time: '09:00' }, evening: { enabled: false, time: '18:00' } } }));
```

In `test/e2e/full.mjs`, replace:

```js
const { reminderWindowChecks } = await import('./reminders.mjs');
await reminderWindowChecks(harness);
```

with:

```js
const { reminderWindowChecks, reminderEngineChecks } = await import('./reminders.mjs');
await reminderWindowChecks(harness);
await reminderEngineChecks(harness);
```

In `test/e2e/full.mjs`, replace:

```js
await rep.fill('#rules', 'acme.atlassian.net/browse => Client work | Acme ticket');
await rep.check('#reminder');
```

with:

```js
await rep.fill('#rules', 'acme.atlassian.net/browse => Client work | Acme ticket');
```

In `test/e2e/full.mjs`, replace:

```js
check('Settings', 'saved', st.settings.role === 'marketing' && st.settings.reminder && st.settings.rules.length === 1, JSON.stringify(st.settings));
const rem = await sw.evaluate(() => chrome.alarms.get('reminder'));
const when = rem && new Date(rem.scheduledTime);
check('Settings', 'Friday 4 pm reminder scheduled', when && when.getDay() === 5 && when.getHours() === 16 && when > new Date(), when?.toString());
await sw.evaluate(() => chrome.alarms.create('reminder', { when: Date.now() + 100 })); await wait(2000);
const fired = await sw.evaluate(async () => ({ err: (await chrome.storage.session.get('error')).error, badge: await chrome.action.getBadgeText({}), alarm: await chrome.alarms.get('reminder') }));
const next = fired.alarm && new Date(fired.alarm.scheduledTime);
check('Settings', 'Friday reminder fires and reschedules without error', !fired.err && fired.badge === '' && next && next.getDay() === 5 && next.getHours() === 16 && next > new Date(), JSON.stringify(fired));
```

with:

```js
check('Settings', 'saved', st.settings.role === 'marketing' && st.settings.rules.length === 1, JSON.stringify(st.settings));
```

- [ ] **Step 12: Run the end-to-end suite**

Run: `npm run e2e`

Expected: `193/193 passed`: 185, less the two Friday checks in Settings, plus the 10 engine checks. The Welcome check keeps its count under its new name.

Catch-up on browser start is proved by the unit tests (`catch-up …` in `reminders.test.js` and `a browser start catches up a check whose time has passed (D9)` in `service-worker.test.js`), not end-to-end: Chromium reinstalls a `--load-extension` extension on every launch, so a relaunched test browser fires `runtime.onInstalled` with reason `install`, never `runtime.onStartup` (checked while validating this plan).

---

### Task 5: Reminders in Settings

The spec puts the reminder settings in the app's Settings. Until a Settings view exists in the app, the app's **Settings** link opens the report's Settings (`report.html#settings`, Phase 2b), so the **Reminders** group goes there, between Tracking and Sharing, and is saved with the rest of the form.

**Files:**
- Create: `src/ui/report/reminder-settings.js`
- Modify: `src/ui/report/report.html` (the group), `src/ui/report/report.css`, `src/ui/report/settings-panel.js`, `src/ui/report/main.js`
- Modify: `test/e2e/reminders.mjs` (append), `test/e2e/full.mjs` (section 5c)

**Interfaces:**
- Consumes: `updateSettings`, `readSettings` validation (Task 2); the worker's `reminder:preview` message (Task 4); `msg` (`report/main.js`).
- Produces: ids `#morningOn`, `#morningTime`, `#eveningOn`, `#eveningTime`, `#remindDays input[value=0…6]`, `#systemNotification`, `#catchUpOnStartup`, `#previewMorning`, `#previewEvening`; `fillReminders(settings)`, `readReminders() → patch`, `init()` (`reminder-settings.js`); `reminderSettingsChecks(t, rep)` (`reminders.mjs`).

- [ ] **Step 1: Write the failing end-to-end checks**

Append to `test/e2e/reminders.mjs`:

```js
// Settings → Reminders, on the report page (spec §3.2; D8).
export async function reminderSettingsChecks(t, rep) {
  const { ctx, sw, check, store, wait } = t;
  const c = (name, ok, detail) => check('Settings', name, ok, detail);
  await rep.bringToFront(); await rep.reload(); await wait(1200);   // the form is filled on load; reminders.mjs changed storage since
  await rep.click('#openSettings'); await wait(300);
  const days = await rep.locator('#remindDays input:checked').evaluateAll(els => els.map(e => e.value).join(','));
  c('Reminders group shows the stored times and working days', await rep.inputValue('#morningTime') === '09:00' && await rep.inputValue('#eveningTime') === '18:00'
    && days === '1,2,3,4,5' && !(await rep.isChecked('#morningOn')), days);
  await rep.check('#morningOn'); await rep.fill('#morningTime', '08:30');
  await rep.check('#eveningOn'); await rep.fill('#eveningTime', '17:45');
  await rep.uncheck('#remindDays input[value="5"]'); await rep.uncheck('#systemNotification');
  await rep.click('#saveSettings'); await wait(800);
  const s = (await store()).settings;
  c('reminder times, working days and notification saved (D8)', s.morning.enabled && s.morning.time === '08:30' && s.evening.enabled && s.evening.time === '17:45'
    && s.days.join() === '1,2,3,4' && s.systemNotification === false, JSON.stringify(s));
  const at = n => sw.evaluate(name => chrome.alarms.get(name), n).then(a => a && new Date(a.scheduledTime));
  const [m, e] = [await at('weekly:morning'), await at('weekly:evening')];
  c('the alarms move to the new times at once', m?.getHours() === 8 && m.getMinutes() === 30 && e?.getHours() === 17 && e.getMinutes() === 45, `${m} ${e}`);
  const shown = (await store()).reminderState;
  const [win] = await Promise.all([ctx.waitForEvent('page', { predicate: p => p.url().includes('slot=evening'), timeout: 8000 }), rep.click('#previewEvening')]);
  await win.waitForLoadState(); await wait(600);
  c('Preview opens the reminder window and leaves today’s schedule alone', JSON.stringify((await store()).reminderState) === JSON.stringify(shown)
    && (await at('weekly:evening'))?.getTime() === e?.getTime());
  await win.click('#dismiss'); await wait(400);
  // Back to off for the rest of the suite (a real 08:30 or 17:45 must not open a window mid-run).
  await rep.uncheck('#morningOn'); await rep.uncheck('#eveningOn');
  await rep.check('#remindDays input[value="5"]'); await rep.check('#systemNotification');
  await rep.click('#saveSettings'); await wait(500);
}
```

In `test/e2e/full.mjs`, replace:

```js
const { reminderWindowChecks, reminderEngineChecks } = await import('./reminders.mjs');
await reminderWindowChecks(harness);
await reminderEngineChecks(harness);
```

with:

```js
const { reminderWindowChecks, reminderEngineChecks, reminderSettingsChecks } = await import('./reminders.mjs');
await reminderWindowChecks(harness);
await reminderEngineChecks(harness);
await reminderSettingsChecks(harness, rep);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run e2e`

Expected: the 153 checks up to and including the engine checks pass; then the run stops with `page.inputValue: Timeout 30000ms exceeded` waiting for `#morningTime` (no Reminders group yet).

- [ ] **Step 3: Add the Reminders group**

Create `src/ui/report/reminder-settings.js`:

```js
// Settings → Reminders (spec §3.2): the morning and evening times, the working
// days, the system notification and catch-up. Saved with the rest of the form;
// lib/settings.js validates what is stored. Preview asks the worker to open the
// reminder window now, without touching today's schedule.
import { $, $$ } from '../components/dom.js';
import { msg } from './main.js';

export function fillReminders(s) {
  $('#morningOn').checked = s.morning.enabled;
  $('#morningTime').value = s.morning.time;
  $('#eveningOn').checked = s.evening.enabled;
  $('#eveningTime').value = s.evening.time;
  $$('#remindDays input').forEach(i => { i.checked = s.days.includes(Number(i.value)); });
  $('#systemNotification').checked = s.systemNotification;
  $('#catchUpOnStartup').checked = s.catchUpOnStartup;
}

/** The Reminders group as a settings patch. */
export const readReminders = () => ({
  morning: { enabled: $('#morningOn').checked, time: $('#morningTime').value },
  evening: { enabled: $('#eveningOn').checked, time: $('#eveningTime').value },
  days: $$('#remindDays input:checked').map(i => Number(i.value)),
  systemNotification: $('#systemNotification').checked,
  catchUpOnStartup: $('#catchUpOnStartup').checked,
});

const preview = slot => chrome.runtime.sendMessage({ type: 'reminder:preview', slot })
  .catch(e => msg('#settingsMsg', `Couldn’t open the preview (${e.message}).`));

export function init() {
  $('#previewMorning').onclick = () => preview('morning');
  $('#previewEvening').onclick = () => preview('evening');
}
```

In `src/ui/report/report.html`, replace:

```html
      <fieldset>
        <legend>Sharing</legend>
```

with:

```html
      <fieldset>
        <legend>Reminders</legend>
        <div class="slot">
          <label class="check"><input type="checkbox" id="morningOn"> Morning brief: what’s due today and what’s carried over</label>
          <input id="morningTime" type="time" aria-label="Morning brief time">
        </div>
        <div class="slot">
          <label class="check"><input type="checkbox" id="eveningOn"> Evening check: what’s still open, to move to tomorrow</label>
          <input id="eveningTime" type="time" aria-label="Evening check time">
        </div>
        <div id="remindDays" class="wd-pick" role="group" aria-label="Working days">
          <label class="check"><input type="checkbox" value="1"> Mon</label>
          <label class="check"><input type="checkbox" value="2"> Tue</label>
          <label class="check"><input type="checkbox" value="3"> Wed</label>
          <label class="check"><input type="checkbox" value="4"> Thu</label>
          <label class="check"><input type="checkbox" value="5"> Fri</label>
          <label class="check"><input type="checkbox" value="6"> Sat</label>
          <label class="check"><input type="checkbox" value="0"> Sun</label>
        </div>
        <label class="check"><input type="checkbox" id="systemNotification"> Also show a system notification (it reaches you when Chrome isn’t in front)</label>
        <label class="check"><input type="checkbox" id="catchUpOnStartup"> Show a missed reminder when Chrome starts</label>
        <div class="row">
          <button id="previewMorning" type="button">Preview the brief</button>
          <button id="previewEvening" type="button">Preview the check</button>
        </div>
        <p class="hint">The evening check on your last working day also links to your weekly update.</p>
      </fieldset>
      <fieldset>
        <legend>Sharing</legend>
```

In `src/ui/report/report.css`, replace:

```css
.check { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--muted); }
```

with:

```css
.check { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--muted); }
.slot { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
.wd-pick { display: flex; flex-wrap: wrap; gap: 0 14px; }
input[type=time] { font: inherit; color: var(--ink); background: var(--sheet); border: 1px solid var(--rule-strong); border-radius: 4px; padding: 4px 6px; margin-top: 10px; }
```

In `src/ui/report/settings-panel.js`, replace:

```js
import { msg, load } from './main.js';
```

with:

```js
import { msg, load } from './main.js';
import { fillReminders, readReminders } from './reminder-settings.js';
```

In `src/ui/report/settings-panel.js`, replace:

```js
  $('#slackWebhook').value = s.slackWebhook;
}
```

with:

```js
  $('#slackWebhook').value = s.slackWebhook;
  fillReminders(s);
}
```

In `src/ui/report/settings-panel.js`, replace:

```js
    slackWebhook: webhook,
  });
  fillSettings(settings);
  msg('#settingsMsg', 'Settings saved.');
```

with:

```js
    slackWebhook: webhook,
    ...readReminders(),
  });
  fillSettings(settings);
  msg('#settingsMsg', settings.days.length ? 'Settings saved.' : 'Settings saved. No working days are ticked, so no reminders will show.');
```

In `src/ui/report/main.js`, replace:

```js
import * as settings from './settings-panel.js';
```

with:

```js
import * as settings from './settings-panel.js';
import * as reminderSettings from './reminder-settings.js';
```

In `src/ui/report/main.js`, replace:

```js
[categories, draft, aiPanel, share, notes, settings, data, history].forEach((m) => m.init());
```

with:

```js
[categories, draft, aiPanel, share, notes, settings, reminderSettings, data, history].forEach((m) => m.init());
```

- [ ] **Step 4: Run the unit tests**

Run: `npm test && npm run typecheck`

Expected: `# tests 242`, `# pass 242` in each timezone; typecheck clean (the report page is outside its scope, as in Phase 2b).

- [ ] **Step 5: Run the end-to-end suite**

Run: `npm run e2e`

Expected: `197/197 passed` (193 + 4). The existing `[Layout] every control has a label` check now covers the new group too.

---

### Task 6: Commands: Alt+T and Alt+Shift+T

Daybook bound Alt+T to `_execute_action` (its popup) and Alt+Shift+T to its full list. Weekly names both commands and handles them in the worker, as Phase 2b's interfaces say: `chrome.sidePanel.open({ windowId })` for the panel (a command counts as the user gesture, so it is called at once, not queued) and a new tab on `app.html#tasks` for the app.

**Files:**
- Modify: `manifest.json` (`commands`), `src/background/service-worker.js` (`commands.onCommand`)
- Modify: `test/helpers/chrome-stub.js` (`sidePanel.open`), `test/background/service-worker.test.js` (append), `test/manifest.test.js` (append)
- Modify: `test/e2e/reminders.mjs` (append), `test/e2e/full.mjs` (section 5c)

**Interfaces:**
- Produces: commands `open-panel` (suggested `Alt+T`) and `open-app` (suggested `Alt+Shift+T`); `commandChecks(t)` (`reminders.mjs`).

- [ ] **Step 1: Write the failing tests**

In `test/helpers/chrome-stub.js`, replace:

```js
    panelBehavior: /** @type {object | null} */ (null),
```

with:

```js
    panelBehavior: /** @type {object | null} */ (null),
    panelsOpened: /** @type {object[]} */ ([]),
```

In `test/helpers/chrome-stub.js`, replace:

```js
      async setPanelBehavior(o) { log.panelBehavior = o; },
```

with:

```js
      async setPanelBehavior(o) { log.panelBehavior = o; },
      async open(o) { log.panelsOpened.push(o); },
```

Append to `test/background/service-worker.test.js`:

```js
test('Alt+T opens the side panel in the window the command came from (D10)', () => {
  emit('commands.onCommand', 'open-panel', { id: 7, windowId: 3 });
  assert.deepEqual(stub.log.panelsOpened, [{ windowId: 3 }]);
});

test('Alt+Shift+T opens the app on its Tasks view (D10)', async () => {
  emit('commands.onCommand', 'open-app', { id: 7, windowId: 3 });
  await settle();
  assert.equal(stub.log.tabsCreated.at(-1)?.url, 'chrome-extension://weekly/src/ui/app/app.html#tasks');
});
```

Append to `test/manifest.test.js`:

```js
test('commands: Alt+T opens the side panel, Alt+Shift+T the app (spec D10)', () => {
  assert.equal(manifest.commands?.['open-panel']?.suggested_key?.default, 'Alt+T');
  assert.equal(manifest.commands?.['open-app']?.suggested_key?.default, 'Alt+Shift+T');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `TZ=America/New_York node --test test/background/service-worker.test.js test/manifest.test.js`

Expected: 13 tests, 3 `not ok`: `panelsOpened` is `[]`, no tab was created for `app.html#tasks`, and `manifest.commands` is `undefined`.

- [ ] **Step 3: Register and handle the commands**

In `manifest.json`, replace:

```json
  "icons": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" },
  "content_security_policy": {
```

with:

```json
  "icons": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" },
  "commands": {
    "open-panel": { "suggested_key": { "default": "Alt+T" }, "description": "Open the Weekly side panel" },
    "open-app": { "suggested_key": { "default": "Alt+Shift+T" }, "description": "Open Weekly in a tab" }
  },
  "content_security_policy": {
```

In `src/background/service-worker.js`, replace:

```js
onSettingsChanged((s) => {
```

with:

```js
// Keyboard commands (D10): Alt+T opens the side panel, Alt+Shift+T the app on its Tasks view.
// sidePanel.open must run inside the command's user gesture, so it is called at once, not queued.
chrome.commands.onCommand.addListener((command, tab) => {
  const fail = (/** @type {unknown} */ e) => console.error('[weekly] command', command, e);
  if (command === 'open-panel' && tab?.windowId !== undefined) chrome.sidePanel.open({ windowId: tab.windowId }).catch(fail);
  if (command === 'open-app') chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/app/app.html#tasks') }).catch(fail);
});
onSettingsChanged((s) => {
```

- [ ] **Step 4: Run the unit tests**

Run: `npm test && npm run typecheck`

Expected: `# tests 245`, `# pass 245`, `# fail 0` in each timezone (242 + 3); typecheck clean.

- [ ] **Step 5: End-to-end: the commands are registered**

Pressing a command is browser UI: Playwright's keyboard reaches the page, not Chrome's shortcut handler (checked while validating this plan: Alt+Shift+T on a page opens nothing). So the end-to-end check proves Chrome registered both commands with their keys, and the unit tests above prove what each does.

Append to `test/e2e/reminders.mjs`:

```js
// Keyboard commands (D10). Chrome registers them from the manifest; pressing them is browser UI that
// a headless page cannot reach, so the handlers are unit-tested (service-worker.test.js).
export async function commandChecks(t) {
  const { sw, check } = t;
  const cmds = Object.fromEntries((await sw.evaluate(() => chrome.commands.getAll())).map(c => [c.name, c.shortcut]));
  check('Commands', 'Alt+T opens the side panel and Alt+Shift+T the app: both registered (D10)',
    /^(Alt|⌥)\+?T$/.test(cmds['open-panel'] ?? '') && /^(Alt\+Shift|⇧⌥|⌥⇧)\+?T$/.test(cmds['open-app'] ?? ''), JSON.stringify(cmds));
}
```

In `test/e2e/full.mjs`, replace:

```js
const { reminderWindowChecks, reminderEngineChecks, reminderSettingsChecks } = await import('./reminders.mjs');
await reminderWindowChecks(harness);
await reminderEngineChecks(harness);
await reminderSettingsChecks(harness, rep);
```

with:

```js
const { reminderWindowChecks, reminderEngineChecks, reminderSettingsChecks, commandChecks } = await import('./reminders.mjs');
await reminderWindowChecks(harness);
await reminderEngineChecks(harness);
await reminderSettingsChecks(harness, rep);
await commandChecks(harness);
```

- [ ] **Step 6: Run the end-to-end suite**

Run: `npm run e2e`

Expected: `198/198 passed` (197 + 1). On macOS Chrome reports the shortcuts as `⌥T` and `⌥⇧T`; the check accepts both spellings.

---

### Task 7: README and the phase gate

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above. Produces: no code.

- [ ] **Step 1: Update the README**

In `README.md`, replace:

```markdown
3. A welcome page opens: pick your role, optionally fill in the last 15 days from Chrome history, and choose the Friday reminder.
```

with:

```markdown
3. A welcome page opens: pick your role, optionally fill in the last 15 days from Chrome history, and keep or turn off the morning and evening reminders.
```

In `README.md`, replace:

```markdown
## Optional extras (each asks for permission first)
```

with:

```markdown
## Reminders
- **Morning brief** (09:00): what's due today, daily tasks first, and what's overdue. Skipped when there's nothing to report.
- **Evening check** (18:00): what's still open, with **Tomorrow** on each task and **Move all to tomorrow**. It always shows: "nothing left open" is the point. On your last working day it also links to the week report, where your update is drafted.
- Both open in one small window that is reused, with a system notification that reaches you when Chrome isn't the app in front. One missed while Chrome was closed shows when Chrome starts. **Snooze 1 h** brings the evening check back.
- **Settings → Reminders** sets the times, the working days (Monday to Friday by default), the notification and catch-up. **Preview** opens the window now.
- Anywhere in Chrome: **Alt+T** opens the side panel and **Alt+Shift+T** opens Weekly in a tab. Change them at `chrome://extensions/shortcuts`.

## Optional extras (each asks for permission first)
```

In `README.md`, replace:

```markdown
- **Live status**: shows Jira status and MR/PR state (Done, merged…) using your existing browser login. Click **Allow** on the banner.
- **Friday reminder**: a notification at 4 pm with your draft ready.
```

with:

```markdown
- **Live status**: shows Jira status and MR/PR state (Done, merged…) using your existing browser login. Click **Allow** on the banner.
```

In `README.md`, replace:

```markdown
| `npm run typecheck` | `tsc --strict` over `src/lib`, `src/background` and the task UI (`src/ui/components`, `src/ui/panel`, `src/ui/app`) (JSDoc types) |
```

with:

```markdown
| `npm run typecheck` | `tsc --strict` over `src/lib`, `src/background` and the task UI (`src/ui/components`, `src/ui/panel`, `src/ui/app`, `src/ui/remind`) (JSDoc types) |
```

In `README.md`, replace:

```markdown
  week-notes.js    Weekly 2's notes until Phase 4 (side panel, day sheet)
```

with:

```markdown
  week-notes.js    Weekly 2's notes until Phase 4 (side panel, day sheet)
  reminders.js     what the morning brief and evening check say (pure)
```

In `README.md`, replace:

```markdown
src/background/    the MV3 service worker and tracker
src/ui/            panel/ (side panel), app/ (calendar, tasks), welcome, report tab
```

with:

```markdown
src/background/    the MV3 service worker, tracker and reminder engine (alarms, the reminder window)
src/ui/            panel/ (side panel), app/ (calendar, tasks), remind/ (reminder window), welcome, report tab
```

In `README.md`, replace:

```markdown
The side panel and the app tab have no exceptions:
```

with:

```markdown
The side panel, the app tab and the reminder window have no exceptions:
```

In `README.md`, replace:

```markdown
Every read-modify-write of `tasks` and `settings` runs under a Web Lock
```

with:

```markdown
Every read-modify-write of `tasks`, `settings`, `uiState` and `reminderState` runs under a Web Lock
```
- [ ] **Step 2: Check sizes and layering**

Run: `find src -name '*.js' -exec wc -l {} + | sort -n | tail -5 && wc -l src/background/reminders.js src/lib/reminders.js src/lib/settings.js src/ui/remind/remind.js && (grep -rn 'chrome.storage' src/ui/panel src/ui/app src/ui/components src/ui/remind || echo 'no direct storage in new UI') && (grep -n 'chrome\.[a-z]' src/lib/reminders.js || echo 'reminders.js is pure') && (grep -rn 'alarms.create(.*periodInMinutes' src | grep -v "'tick'" || echo 'no periodic reminder alarm') && (grep -rnE 'storage\.sync' src || echo 'no storage.sync')`

Expected: the largest files are still `task-views.js` (195), `classify.js` (203), `tasks.js` (227) and `schema.js` (250), then the total; the new ones are `src/background/reminders.js` 139, `src/lib/reminders.js` 91, `src/lib/settings.js` 99 and `src/ui/remind/remind.js` 86. Then `no direct storage in new UI`, `reminders.js is pure`, `no periodic reminder alarm` and `no storage.sync`. `test/e2e/full.mjs` stays the one file over 300 lines (401).

- [ ] **Step 3: Run the phase gate**

Run: `npm run package && npm run e2e`

Expected:
- `npm test`: `# tests 245`, `# pass 245`, `# fail 0` in each timezone (200 from Phase 2b plus 45 new).
- typecheck clean.
- `Packed 69 files → dist/weekly-2.0.0.zip`.
- e2e: `198/198 passed`.

- [ ] **Step 4: Report**

Report to the controller: test counts per timezone, the e2e total, the four largest files, and any check that needed a retry. None is expected to be timing-sensitive beyond the existing `wait()` pauses; the reminder checks wait up to 8 s for a window to appear.

---

## Interfaces exported for Phase 4

**Settings**
- `readSettings(raw)` (`src/lib/settings.js`) is the one place a stored settings blob is validated. A Phase 4 setting (the auto-lock delay, say) goes into `DEFAULTS`, the `Settings` typedef and, if a bad value would break a caller, `readSettings`.
- The report's Settings is still where settings are edited. A Phase 4 group (Notes PIN: set, change, remove) follows `reminder-settings.js`: a module exporting `init()` (and `fill…`/`read…` if it is saved with the form), registered in the list at the end of `src/ui/report/main.js`.

**Worker**
- `chrome.runtime.onMessage` in `src/background/service-worker.js` answers `reminder:preview` and `reminder:snooze` and returns `false` for anything else. Phase 4's `notes:*`, `crypto:*` and `panel:openOnPage` belong in the same listener; a handler that answers after an `await` must `return true`.
- `clearOrphanAlarms()` (`src/background/reminders.js`) clears every alarm except `tick` and the three in `ALARM` on every install, update and browser start. A Phase 4 alarm (for example the PIN auto-lock) must be added to `KEEP` in that file, or it is deleted at the next start.
- Commands: Alt+N (spec §3.4) is the third suggested key (Chrome allows four). Add it to `manifest.json` `commands` and to the existing `chrome.commands.onCommand` listener, and call `chrome.scripting.executeScript` at once there, like `sidePanel.open`: the user gesture does not survive the serial queue.
- Every other worker handler runs through `serial()`, so a failure shows the "!" badge (spec §6).

**Reminders**
- The reminder window lists tasks only, and the notification carries counts only, never titles. Notes, private or not, never reach either.
- `updateReminderState` and `updateUiState` are locked (`REMINDER_LOCK`, `UI_LOCK`). A band toggle passes a function: `updateUiState((cur) => ({ dayState: { ...cur.dayState, [key]: v } }))`.
- `src/lib/reminders.js` is pure and takes the working days as an argument; `isLastWorkday(days)` is the rule for "the last working day" anywhere else (for example a Friday prompt in the Notes view).

**Tests**
- `test/helpers/chrome-stub.js`: windows created by code get ids from 100; `tabs.query({ windowId })` returns that window's one tab; `sidePanel.open` is logged in `log.panelsOpened`.
- `test/e2e/reminders.mjs` exports `seed(sw, { tasks, settings })`, which appends tasks and merges settings straight into storage. The harness keeps the reminders off for the whole run; a module that needs them turns them on and off again itself.
- Chromium reinstalls a `--load-extension` extension on every launch, so `runtime.onStartup` cannot be driven end to end; prove startup behaviour with the worker unit test (emit `runtime.onStartup` on the stub).

## Self-review (done at authoring time)

**1. Spec coverage: every Phase 3 row, its task, and the check that proves it**

| Row | Requirement | Task | Proved by |
|---|---|---|---|
| D7 (evening) | Move to tomorrow (one) and Move all to tomorrow, in the evening check | 3 | `[Reminder] Move to tomorrow on one task (D7)`, `[Reminder] Move all to tomorrow (D7)`, `[Reminder] Move all is undoable`; the panel's 2b checks still pass |
| D8 | Morning brief and evening check | 2, 3, 4 | `[Reminder] evening check: Carried over, then Today (D8)`, `[Reminder] morning brief: what is due, no Move all, no nudge`, `[Reminders] the evening alarm opens the reminder window, a popup (D8)`; unit `reminders.test.js` (7), engine tests `a normal morning fires…`, `…skipped when there is nothing to report…`, `the evening check always shows…`, `a slot fires at most once per day`, `a disabled slot does not fire`, `a day that is not a working day does not fire`, `force overrides every guard…` |
| D8 | One-shot, DST-safe alarms | 4 | `[Reminders] one-shot alarms at 09:00 and 18:00, no repeat period (D8)`, `[Reminders] the fired alarm chains the next one, again at 18:00`; unit `rescheduleAll creates one-shot alarms…`, `DST spring forward (8 Mar 2026 in New York)…`, `DST fall back (1 Nov 2026 in New York)…`, `a week of chained fires across the clock change stays on 09:00, where +24 h would drift`, worker `an evening alarm shows the check and chains the next one`; Phase 2a's `nextOccurrence tracks wall-clock across a DST transition` |
| D8 | Configurable times and working days | 2, 5 | `[Settings] Reminders group shows the stored times and working days`, `[Settings] reminder times, working days and notification saved (D8)`, `[Settings] the alarms move to the new times at once`, `[Welcome] reminders start on and can be turned off (no Friday alarm)`; unit settings `reminder defaults…`, `bad reminder values fall back…`, `onSettingsChanged hands listeners validated reminder settings`, worker `a local settings change reschedules the morning and evening alarms` |
| D9 | Single reused reminder window | 4 | `[Reminders] the morning brief reuses the same window (D9)`, `[Reminders] the snoozed check comes back in a new window once the old one is gone`, `[Reminders] Dismiss closes the window and the worker forgets it`; unit `a second reminder reuses the open window…`, `a window the user closed is forgotten…` |
| D9 | System notification | 4, 5 | `[Reminders] with a system notification (D9)`; unit `the system notification can be turned off…`, worker `clicking a reminder notification opens its window…` |
| D9 | Catch-up on startup | 4 | unit `catch-up delivers a slot whose time has passed today`, `…still ahead`, `…cannot double-fire…`, `…both slots past leaves the evening check on screen`, `…respects its own setting`; worker `a browser start catches up a check whose time has passed (D9)` (end to end is impossible: see Task 4, Step 12) |
| D10 (commands) | Alt+T opens the panel, Alt+Shift+T the app | 6 | `[Commands] Alt+T opens the side panel and Alt+Shift+T the app: both registered (D10)`; unit `Alt+T opens the side panel in the window the command came from (D10)`, `Alt+Shift+T opens the app on its Tasks view (D10)`, manifest `commands: …` |
| §3.3 | Replaces the Friday 4 pm reminder; the weekly-update nudge stays | 2, 3, 4 | `[Reminder] last working day: the evening links to the week report`, `[Reminder] "Open the week report" opens the report and closes the window`, the Welcome check (no `reminder` alarm); unit `the last working day…`, `headline and notification: … the weekly-update nudge only on the last evening`, `orphans are cleared: Weekly 2’s Friday alarm goes…`, worker `Weekly 2’s Friday alarm is cleared on update…`, settings `a Weekly 2 profile: its Friday reminder flag…` |
| §3.2 | Settings: morning time, evening time, working days, notification, catch-up | 5 | the four `[Settings]` checks above and `[Settings] Preview opens the reminder window and leaves today’s schedule alone` |
| 2a ledger | `updateUiState` / `updateReminderState` under the lock | 1 | unit `storage-locks.test.js` (3); e2e band-state checks from 2b |
| §6 | Failures said plainly | 3, 4 | page writes go through `task-actions` (`report()`); worker handlers through `serial()` ("!" badge); `[Errors] no page errors or console errors anywhere` still passes |

**End-to-end checks added (24, all in `test/e2e/reminders.mjs`; plus the Welcome check renamed and two Friday checks removed: 176 → 198):**
- `reminderWindowChecks` (9): `[Reminder] evening check: Carried over, then Today (D8)`; `[Reminder] Move to tomorrow on one task (D7)`; `[Reminder] Move all to tomorrow (D7)`; `[Reminder] Move all is undoable`; `[Layout] every reminder-window control has a label`; `[Reminder] last working day: the evening links to the week report`; `[Reminder] "Open the week report" opens the report and closes the window`; `[Reminder] morning brief: what is due, no Move all, no nudge`; `[Reminder] "Open Weekly" opens that day in the app`
- `reminderEngineChecks` (10): `[Reminders] one-shot alarms at 09:00 and 18:00, no repeat period (D8)`; `the evening alarm opens the reminder window, a popup (D8)`; `with a system notification (D9)`; `the fired alarm chains the next one, again at 18:00`; `the check is marked shown for today`; `the morning brief reuses the same window (D9)`; `a slot shows at most once a day`; `Snooze 1 h closes the window and brings the check back in an hour`; `the snoozed check comes back in a new window once the old one is gone`; `Dismiss closes the window and the worker forgets it`
- `reminderSettingsChecks` (4): `[Settings] Reminders group shows the stored times and working days`; `reminder times, working days and notification saved (D8)`; `the alarms move to the new times at once`; `Preview opens the reminder window and leaves today’s schedule alone`
- `commandChecks` (1): `[Commands] Alt+T opens the side panel and Alt+Shift+T the app: both registered (D10)`

**Unit tests added (45):** `storage-locks.test.js` 3, `reminders.test.js` 7, `settings.test.js` +4, `background/reminders.test.js` 23, `background/service-worker.test.js` +7 (seven replace Phase 2a's two Friday tests, its two others stay, then two for the commands), `manifest.test.js` +1.

**2. Placeholder scan:** none. Every new file is written in full; every change to an existing file is an exact replace or append against the file as the previous task left it. The whole plan was replayed step by step on a copy of the Phase 2b end state, including each "see it fail" run, with every task ending green.

**3. Type consistency:**
- `Slot` is `'morning' | 'evening'` in `src/lib/reminders.js`; `SLOTS`, `ALARM`, `slotForAlarm`, `fire`, `openReminderWindow` and the window's `?slot=` all use the same two names, and notification ids are `NOTIFICATION_PREFIX + slot`.
- `ReminderPayload` (Task 2) is what `fire()` (Task 4) passes to `showNotification` and what `remind.js` (Task 3) draws; its fields are `overdue`, `today`, `closedToday`, `empty`, `weekEnds`.
- `Settings.morning/evening` are `{ enabled, time }` and `days` is `number[]` (0 = Sunday) in `settings.js`, `reminders.js`, the welcome page, `reminder-settings.js` and every e2e `seed`.
- `updateUiState` accepts a patch or a function in Task 1; Phase 2b's `band-state.test.js` and `uistate.test.js` still pass a patch.
- Message types `reminder:preview` (with `slot`) and `reminder:snooze` match between the worker (Task 4), `remind.js` (Task 4) and `reminder-settings.js` (Task 5).

**Decisions the specs did not settle:**
- **Where the reminder settings live:** in the report's Settings, the page the app's **Settings** link opens (Phase 2b). There is no Settings view in the app yet; when one comes, `reminder-settings.js` moves with the rest of the form.
- **Defaults and upgrades:** a new install gets Daybook's defaults (brief 09:00, check 18:00, Monday to Friday, notification and catch-up on). The welcome page's single checkbox turns both off. A Weekly 2 profile follows its Friday flag: off (the default there) keeps both off, so an upgrade never starts opening windows nobody asked for. The flag is dropped at the next settings write.
- **The weekly-update nudge:** no separate alarm. The evening check on the last working day (the last of the working days in the Monday–Sunday week; Friday by default) shows "That’s your week…" with **Open the week report →**, and its notification adds "Your weekly update is drafted and ready to review."
- **Daily tasks in reminders:** a daily task due today and not yet ticked is listed under Today, first, and a tick counts towards "You closed n today". It has no **Tomorrow** button (it comes back tomorrow anyway).
- **Morning bulk move:** not offered. Daybook's "Carry over the late ones" is the ⋯ menu's Move to tomorrow on each row; only the evening has **Move all to tomorrow**.
- **After Move all:** the window stays open and re-renders (the all-clear, or what is left) so **Undo** stays reachable. Daybook closed it after 1.8 s.
- **Snooze:** kept from Daybook, one hour, evening only.
- **Badge:** Daybook's due-count badge is not ported: Weekly's badge already means "a recording failure" ("!").
- **Alt+Shift+T** always opens a new app tab on Tasks; Daybook focused an already-open one, which needs extra state for little gain.
- **Spring-forward gap:** a time inside the skipped hour (02:30 on 8 March in New York) fires at 03:30, as in Daybook.
- **Orphan cleanup** runs on every install, update and browser start, which is how the Friday alarm disappears on update.
- **e2e:** reminders are off for the whole run except inside `reminders.mjs` (environment hardening: a run crossing 09:00 or 18:00 would otherwise have a real reminder window open mid-suite); catch-up on browser start and pressing a command cannot be driven in Chromium under test and are proved by unit tests.
