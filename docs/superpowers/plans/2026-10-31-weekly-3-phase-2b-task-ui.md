# Weekly 3.0, Phase 2b: Task UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Weekly its task UI: a side panel (Today and Week tabs, the old popup's tracking footer) that the toolbar icon opens, an app tab (Calendar with day sheets, and Daybook's task views), undo and keyboard shortcuts, and a leading **Done** section in the weekly update.

**Architecture:**
- The toolbar icon opens Chrome's side panel (`src/ui/panel/`). The popup is deleted; its features live in the panel footer and Week tab.
- The full app is one tab, `src/ui/app/app.html`, with two views (Calendar, Tasks) and two dialogs (day sheet, editor). The week report keeps its page and URL; the app links to it and to its Settings.
- Shared UI lives in `src/ui/components/`: the typed `h()` builder, a task row with a ⋯ menu, bands, the undo toast, keys. Every task write goes through `components/task-actions.js`, which offers Undo and reports failures.
- Screens never patch the DOM after a write. They re-render from `onTasksChanged`, so the panel, the app and the report stay in step.
- Pure derivations the screens draw (Today bands, month grid, Done range) are in `src/lib/planner.js`, re-exported by `src/lib/tasks.js`, and unit-tested in two timezones.

**Tech Stack:**
- Chrome MV3 (module service worker, `chrome.sidePanel`); plain ES2022 modules, no bundler.
- Native `<dialog>` and `<details>` for the sheet, the editor, the ⋯ menu and collapsible bands.
- `node:test` in two timezones; `tsc --strict` over JSDoc; Playwright + Chromium end-to-end, including its fake clock for the midnight rollover.

**Spec:**
- `docs/superpowers/specs/2026-10-31-weekly-feature-parity.md`: Phase 2b rows D2, D3, D4, D5, D6, D7 (UI), D10 (in-page keys), L1 (UI), L2, L3 (day-sheet slot), L4, L5, L9, L10, W2 (Done section). This file wins on scope.
- `docs/superpowers/specs/2026-10-31-weekly-merge-design.md`: §3.1 side panel, §3.2 app tab and Done section, §4 data rules, §5 code rules, §6 errors. This file wins on how.
- Phase 2a's "Interfaces exported for Phase 2b" (`docs/superpowers/plans/2026-10-31-weekly-3-phase-2a-data.md`) and its ledger (`…-phase-2a-ledger.md`): the task domain this plan consumes.

**Deliberate scope cuts, each recorded in the self-review:**
- **Notes tab and on-page note:** Phase 4. The panel's tab list is built so Phase 4 appends one entry.
- **Day note:** the day sheet's note slot lists and adds Weekly 2 notes dated to that day (`src/lib/week-notes.js`). Phase 4 replaces the store with day notes; the slot and its ids stay.
- **Settings view:** the app links to the report's Settings (`report.html#settings`). Reminder and PIN settings arrive with Phases 3 and 4.
- **Recurring-task management page** (rename, reorder, archive list, purge: dailies' "Daily Tasks" page, L6 UI): Phase 5. In 2b a daily task is added, ticked, edited and stopped from the day sheet.
- **Done section in the standup format:** not in the spec; the standup is unchanged.

## Global Constraints

- **No version control.**
  - Never run `git`. No step commits; the controller keeps the ledger.
  - Never edit this plan file.
  - Rollback point: `snapshots/weekly-2.0.0-source-2026-10-31.zip`.
- **Layering:**
  - `src/lib/` never touches the DOM.
  - `src/ui/` never calls `chrome.storage` in new code. The task domain comes only from `src/lib/tasks.js` (writes, views, recurrence, planner, and the constants `PRIORITIES`, `PRIORITY_LABEL`, `TITLE_MAX`, `DESC_MAX`, `UNDATED_KEY`, `WORKWEEK`); `onTasksChanged`, `getUiState` and `updateUiState` come from `src/lib/storage.js`. The one exception is the report's delete-all, which calls `deleteEverything()` from `src/lib/task-portability.js`.
  - Phase 1's documented direct-storage exceptions (Ruling R2) stay legacy-only, on the report page. No new ones.
- **Locks:** Web Locks are not re-entrant. A `mutate()` callback is synchronous and never calls `getTasks()`. A toggle computed from current settings uses `updateSettings((current) => patch)`.
- **No HTML sinks:** no `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src/`. Build DOM with `h()` from `src/ui/components/dom.js`. `h()` throws on markup props and `on*` attributes and drops unsafe URLs; `test/no-innerhtml.test.js` stays green.
- **Size:** no file in `src/` over 300 lines and no function over 50 lines. `test/e2e/full.mjs` is the one exception carried from Phase 1; new end-to-end checks go in their own modules, each function ≤ 50 lines.
- **Dates:** local-calendar ISO strings (`YYYY-MM-DD`). Never `new Date('YYYY-MM-DD')`; use `src/lib/dates.js`. A one-off's day is its `dueDate`; a recurring task's day is the day it is ticked for.
- **Storage:** local only; nothing reads or writes `chrome.storage.sync`. Weekly 2's keys are never rewritten.
- **Errors:** a failed write is said in plain words (`report()` in `components/undo.js`), never swallowed; a full disk or quota is explained.
- **Look:** Weekly's visual language only (paper, navy ink, the yellow marker, Charter serif; tokens in `src/ui/styles.css`). Daybook and dailies.html supply behaviour and layout, not colours or fonts. No remote fonts.
- **Node and tests:**
  - Node ≥ 22. `node --test` takes globs, never a directory.
  - Every test file lives under `test/`, never `src/`.
  - The end-to-end harness computes dates in Node and passes them in; only `chrome.*` runs inside `sw.evaluate` (Phase 1 Ruling R1). New pages are opened directly as extension URLs (`PAGES.panel`, `PAGES.app`).
- **Dependencies:** no runtime dependencies. Dev dependencies stay `typescript@^5.5.4` and `@types/chrome@^0.0.268`.
- **Typecheck:** `npm run typecheck` (`tsc --strict`, `noUncheckedIndexedAccess`) covers `src/lib/**`, `src/background/**` and, from Task 3, `src/ui/components/**`, `src/ui/panel/**` and `src/ui/app/**`. The legacy report and welcome pages stay out (see Task 3's decision).
- **Gates:** every task ends with `npm test` green (New York and Kolkata). Tasks 3–8 also end with `npm run e2e` green.

## File map (end state of Phase 2b)

```
manifest.json                       + "sidePanel" permission, side_panel.default_path; action.default_popup removed
jsconfig.json                       include + src/ui/components, src/ui/panel, src/ui/app
scripts/build.mjs                   checks the side panel page; ignores ?query/#fragment in page links
README.md                           Install, Tasks section, Layout, rules, typecheck row
src/background/service-worker.js    sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
src/lib/planner.js         new      todayBands, monthGrid, doneRange, mondayOf, doneThisWeek, doneKey, withoutExcluded
src/lib/tasks.js           modified re-exports planner + constants; restoreTask
src/lib/settings.js        modified updateSettings(patch | fn); defaultPriority validated
src/lib/week-notes.js      new      getWeekNotes, addWeekNote, deleteWeekNote, notesOn (Weekly 2 notes until Phase 4)
src/lib/activity/status.js new      trackerStatus, onTrackingChanged
src/lib/report/draft.js    modified DoneTasks, recurringLabel, doneLines; buildWeekly({ done })
src/ui/styles.css          modified search and date inputs styled like other fields
src/ui/components/dom.js   typed    h, clear, $, $$ (behaviour unchanged)
src/ui/components/undo.js  new      toast, undoLast, report
src/ui/components/keys.js  new      bindKeys, onNewDay, isTyping
src/ui/components/task-actions.js new  add, toggle, moveTo, moveToTomorrow, copyTo, remove, setPriority (each with Undo)
src/ui/components/task-row.js new   taskRow: tick box, title, meta, ⋯ menu
src/ui/components/bands.js new      renderBands (collapsible bands are <details>)
src/ui/components/tasks.css new     rows, bands, menu, toast, dialogs
src/ui/panel/panel.html panel.css panel.js   new   tabs (TABS), Open Weekly, keys, rollover
src/ui/panel/today-tab.js week-tab.js footer.js  new
src/ui/popup/                       deleted
src/ui/app/app.html app.css app.js           new   Calendar and Tasks views, day sheet and editor dialogs, routes
src/ui/app/calendar-view.js day-sheet.js tasks-view.js task-editor.js  new
src/ui/report/main.js      modified W.done, live reload on task changes, #settings opens Settings
src/ui/report/draft-panel.js categories-view.js report.html data-panel.js  modified
test/planner.test.js  test/tasks-restore.test.js  test/week-notes.test.js  test/activity/status.test.js
test/band-state.test.js  test/report/draft-done.test.js                         new
test/settings.test.js  test/background/service-worker.test.js  test/helpers/chrome-stub.js   extended
test/e2e/panel.mjs  panel-tasks.mjs  app.mjs  app-tasks.mjs  done.mjs           new
test/e2e/full.mjs                   PAGES (panel, app), idleSeconds 14400, section 4 → side panel, 5b Done, delete-all check, rollover
```

---

### Task 1: Task-domain additions: planner, restoreTask, settings by function

**Files:**
- Create: `src/lib/planner.js`, `test/planner.test.js`, `test/tasks-restore.test.js`
- Modify: `src/lib/tasks.js` (re-exports; `restoreTask` appended), `src/lib/settings.js` (`updateSettings`)
- Modify: `test/settings.test.js` (append)

**Interfaces:**
- Consumes (Phase 2a): `isOverdue`, `isUndated`, `byDueThenPriority`, `byCompletedDesc` (task-views.js); `recurringOn`, `dayCompletion`, `doneInRange` (recurrence.js); `mutate` (storage.js); `coerceTask`, `UNDATED_KEY`, `PRIORITIES` (schema.js).
- Produces (`src/lib/planner.js`, pure, re-exported by `src/lib/tasks.js`):
  - `todayBands(tasks, ref?) → Band[]`, `Band = {key: 'overdue'|'today'|UNDATED_KEY, label, tasks, flagged, collapsible, defaultOpen}`
  - `monthGrid(year, month0, tasks, ref?) → {blanks: number, cells: DayCell[]}`, `DayCell = {iso, day, when: 'past'|'today'|'future', done, total, pct: number|null}`
  - `doneRange(monIso, ref?) → {from, to}`; `mondayOf(ref?) → iso`; `doneThisWeek(tasks, ref?) → number`
  - `doneKey(task) → 'task:<id>'`; `withoutExcluded(done, excluded: Set<string>) → done`
- Produces (`src/lib/tasks.js`): `restoreTask(snapshot: Task) → Promise<boolean>` (the undo for `deleteTask`), and re-exports `PRIORITIES, PRIORITY_LABEL, TITLE_MAX, DESC_MAX, UNDATED_KEY, WORKWEEK` so the UI never imports `schema.js`.
- Produces (`src/lib/settings.js`): `updateSettings(patch | (current) => patch)`. The function form runs inside the settings lock. An invalid `defaultPriority` is stored as `'medium'`.

- [ ] **Step 1: Write the failing planner test**

Create `test/planner.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { todayBands, monthGrid, doneRange, mondayOf, doneThisWeek, doneKey, withoutExcluded } from '../src/lib/planner.js';
import { doneInRange } from '../src/lib/recurrence.js';
import { coerceTask } from '../src/lib/schema.js';

/** @param {object} patch */
const task = (patch) => /** @type {import('../src/lib/schema.js').Task} */ (coerceTask({ title: 'untitled', ...patch }));
/** Local noon on a day, so completedAt never sits near midnight in either test timezone. @param {string} iso */
const noon = (iso) => new Date(`${iso}T12:00:00`).getTime();

// Thu 29 Oct 2026 is "today" throughout; the week runs Mon 26 – Fri 30 Oct.
const REF = '2026-10-29';
const STANDUP = task({ id: 'su', title: 'Standup notes', createdAt: 1,
  repeat: { days: [1, 2, 3, 4, 5], from: '2026-10-26', until: null }, doneDates: ['2026-10-26', '2026-10-27'] });
const LATE = task({ id: 'late', title: 'Late', dueDate: '2026-10-27', createdAt: 2 });
const DUE = task({ id: 'due', title: 'Due', dueDate: REF, priority: 'high', createdAt: 3 });
const LOOSE = task({ id: 'loose', title: 'Loose', createdAt: 4 });
const CLOSED = task({ id: 'closed', title: 'Closed', status: 'done', completedAt: noon(REF), createdAt: 5 });
const OLD = task({ id: 'old', title: 'Old', status: 'done', completedAt: noon('2026-10-26'), dueDate: '2026-10-26', createdAt: 6 });

test('todayBands: Overdue, Today with recurring first then due then closed today, No date collapsed', () => {
  const bands = todayBands([LOOSE, CLOSED, DUE, LATE, STANDUP, OLD], REF);
  assert.deepEqual(bands.map((b) => [b.key, b.tasks.map((t) => t.id)]),
    [['overdue', ['late']], ['today', ['su', 'due', 'closed']], ['undated', ['loose']]]);
  assert.equal(bands[0]?.flagged, true);
  assert.deepEqual([bands[2]?.collapsible, bands[2]?.defaultOpen], [true, false]);
});

test('todayBands always shows Today and drops empty Overdue and No date', () => {
  assert.deepEqual(todayBands([], REF).map((b) => [b.key, b.tasks.length]), [['today', 0]]);
});

test('todayBands leaves out recurring tasks on days they do not occur', () => {
  assert.deepEqual(todayBands([STANDUP], '2026-10-31')[0]?.tasks, []);
});

test('monthGrid starts on Monday and shades past days, today only once ticked, never the future', () => {
  const { blanks, cells } = monthGrid(2026, 9, [STANDUP, DUE], REF);
  assert.equal(blanks, 3, '1 Oct 2026 is a Thursday');
  assert.equal(cells.length, 31);
  /** @param {string} iso */
  const cell = (iso) => cells.find((c) => c.iso === iso);
  assert.deepEqual(cell('2026-10-26'), { iso: '2026-10-26', day: 26, when: 'past', done: 1, total: 1, pct: 100 });
  assert.deepEqual([cell('2026-10-28')?.pct, cell('2026-10-28')?.total], [0, 1], 'a missed past day is shaded at 0%');
  assert.deepEqual([cell(REF)?.when, cell(REF)?.total, cell(REF)?.pct], ['today', 2, null], 'nothing ticked yet today');
  assert.deepEqual([cell('2026-10-30')?.when, cell('2026-10-30')?.pct], ['future', null]);
  assert.equal(cell('2026-10-25')?.total, 0, 'before the task started');
});

test('monthGrid shades today once something is ticked', () => {
  const ticked = { ...STANDUP, doneDates: [REF] };
  assert.equal(monthGrid(2026, 9, [ticked, DUE], REF).cells[28]?.pct, 50);
});

test('monthGrid handles a Monday first day and February', () => {
  const feb = monthGrid(2027, 1, [], REF);
  assert.deepEqual([feb.blanks, feb.cells.length], [0, 28]);
});

test('doneRange runs Monday to Friday, clamped to today', () => {
  assert.deepEqual(doneRange('2026-10-26', REF), { from: '2026-10-26', to: REF });
  assert.deepEqual(doneRange('2026-10-26', '2026-11-01'), { from: '2026-10-26', to: '2026-10-30' });
  assert.deepEqual(doneRange('2026-10-19', REF), { from: '2026-10-19', to: '2026-10-23' });
});

test('mondayOf: weekends belong to the week before', () => {
  assert.equal(mondayOf(REF), '2026-10-26');
  assert.equal(mondayOf('2026-10-26'), '2026-10-26');
  assert.equal(mondayOf('2026-11-01'), '2026-10-26');
});

test('doneThisWeek counts closed one-offs and each recurring tick', () => {
  assert.equal(doneThisWeek([STANDUP, CLOSED, OLD, DUE], REF), 4);
  assert.equal(doneThisWeek([STANDUP], '2026-11-02'), 0, 'a new week starts at zero');
});

test('withoutExcluded drops unticked Done items by their task key', () => {
  const done = doneInRange([STANDUP, CLOSED, OLD], '2026-10-26', REF);
  const kept = withoutExcluded(done, new Set([doneKey(OLD), doneKey(STANDUP)]));
  assert.deepEqual(kept.oneOffs.map((t) => t.id), ['closed']);
  assert.deepEqual(kept.recurring, []);
  assert.equal(doneKey(OLD), 'task:old');
});
```

- [ ] **Step 2: Write the failing restore test**

Create `test/tasks-restore.test.js`:

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

let stub;
beforeEach(() => { stub = installChromeStub(); });

test('restoreTask brings a deleted task back exactly: id, status and completedAt', async () => {
  const { createTask, setDone, deleteTask, restoreTask, getTasks } = await import('../src/lib/tasks.js');
  const t = await createTask({ title: 'Ship the login fix', dueDate: '2026-10-29' });
  const done = await setDone(t.id, true);
  assert.ok(done);
  await deleteTask(t.id);
  assert.equal(await restoreTask(done), true);
  assert.deepEqual(await getTasks(), [done]);
});

test('restoreTask never duplicates an id that is already there, and refuses junk', async () => {
  const { createTask, restoreTask, getTasks } = await import('../src/lib/tasks.js');
  const t = await createTask({ title: 'Once' });
  assert.equal(await restoreTask({ ...t, title: 'Twice' }), false);
  assert.equal(await restoreTask({ title: '' }), false);
  assert.deepEqual((await getTasks()).map((x) => x.title), ['Once']);
  assert.equal(stub.stores.local.tasks.length, 1);
});

test('the planner and the task constants come through the task domain’s one import site', async () => {
  const tasks = await import('../src/lib/tasks.js');
  for (const name of ['todayBands', 'monthGrid', 'doneRange', 'doneThisWeek', 'doneKey', 'withoutExcluded', 'mondayOf']) {
    assert.equal(typeof tasks[name], 'function', name);
  }
  assert.deepEqual([tasks.PRIORITIES, tasks.UNDATED_KEY, tasks.WORKWEEK], [['high', 'medium', 'low'], 'undated', [1, 2, 3, 4, 5]]);
});
```

- [ ] **Step 3: Append the failing settings tests**

Append to `test/settings.test.js`:

```js

test('updateSettings takes a function, run inside the lock: concurrent toggles never lose a flip', async () => {
  const { updateSettings, getSettings } = await import('../src/lib/settings.js');
  await updateSettings((s) => ({ paused: !s.paused }));
  assert.equal((await getSettings()).paused, true, 'one toggle flips it');
  await Promise.all([updateSettings((s) => ({ paused: !s.paused })), updateSettings((s) => ({ paused: !s.paused }))]);
  assert.equal((await getSettings()).paused, true, 'two quick toggles end where they started');
});

test('an invalid defaultPriority is never stored', async () => {
  const { updateSettings, getSettings } = await import('../src/lib/settings.js');
  await updateSettings({ defaultPriority: 'high' });
  assert.equal((await getSettings()).defaultPriority, 'high');
  await updateSettings({ defaultPriority: 'urgent' });
  assert.equal((await getSettings()).defaultPriority, 'medium');
});
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `npm run test:ny`

Expected: 6 failures. `planner.test.js` fails with `Cannot find module '…/src/lib/planner.js'`; the three `tasks-restore.test.js` tests fail (`restoreTask is not a function`, and the planner is not re-exported); the two new settings tests fail (a function patch is spread as no keys, so nothing flips, and `'urgent'` is stored).

- [ ] **Step 5: Create `src/lib/planner.js`**

Create `src/lib/planner.js`:

```js
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
```

- [ ] **Step 6: Re-export the planner and the constants from `src/lib/tasks.js`**

In `src/lib/tasks.js`, replace:

```js
import { newId, TITLE_MAX, DESC_MAX, PRIORITIES, coerceDays } from './schema.js';
```

with:

```js
import { newId, TITLE_MAX, DESC_MAX, PRIORITIES, coerceDays, coerceTask } from './schema.js';
```

In `src/lib/tasks.js`, replace:

```js
export * from './recurrence.js';
```

with:

```js
export * from './recurrence.js';
export * from './planner.js';
export { PRIORITIES, PRIORITY_LABEL, TITLE_MAX, DESC_MAX, UNDATED_KEY, WORKWEEK } from './schema.js';
```

- [ ] **Step 7: Append `restoreTask`**

Append to `src/lib/tasks.js`. The `mutate()` callback is synchronous and never calls `getTasks()`: Web Locks are not re-entrant, so that would deadlock.

```js

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
```

- [ ] **Step 8: Let `updateSettings` take a function and validate `defaultPriority`**

In `src/lib/settings.js`, replace:

```js
import { withLock } from './storage.js';
```

with:

```js
import { withLock } from './storage.js';
import { PRIORITIES } from './schema.js';
```

In `src/lib/settings.js`, replace:

```js
/** Read-modify-write under one lock, so two callers never drop each other's change. */
export function updateSettings(/** @type {Record<string, unknown>} */ patch) {
  return withLock(SETTINGS_LOCK, async () => {
    const next = { ...(await getSettings()), ...patch };
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  });
}
```

with:

```js
/**
 * Read-modify-write under one lock, so two callers never drop each other's change.
 * Pass a function to compute the patch from the current settings inside the lock
 * (a toggle such as Pause must not read outside it). An invalid defaultPriority
 * falls back to the default rather than reaching createTask.
 * @param {Record<string, unknown> | ((current: Awaited<ReturnType<typeof getSettings>>) => Record<string, unknown>)} patch
 */
export function updateSettings(patch) {
  return withLock(SETTINGS_LOCK, async () => {
    const current = await getSettings();
    const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
    if (!/** @type {readonly string[]} */ (PRIORITIES).includes(String(next.defaultPriority))) next.defaultPriority = DEFAULTS.defaultPriority;
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  });
}
```

- [ ] **Step 9: Run the tests, the typecheck and the size check**

Run: `npm test && npm run typecheck`

Expected: `# tests 187`, `# fail 0` in each timezone, and `tsc` exits 0. `wc -l src/lib/tasks.js src/lib/planner.js` reports 227 and 110.

---

### Task 2: Owners for week notes and tracker status (no new direct-storage exceptions)

**Files:**
- Create: `src/lib/week-notes.js`, `src/lib/activity/status.js`
- Create: `test/week-notes.test.js`, `test/activity/status.test.js`

**Interfaces:**
- Consumes: `withLock` (storage.js); `today`, `toISODate`, `fromISODate` (dates.js).
- Produces (`src/lib/week-notes.js`), the owner of Weekly 2's `notes` key for new UI until Phase 4: `getWeekNotes() → Promise<WeekNote[]>`, `addWeekNote(text, iso?) → Promise<WeekNote|null>` (now for today, local noon for another day; null when blank), `deleteWeekNote(id)`, `notesOn(notes, iso) → WeekNote[]`, `NOTES_LOCK = 'weekly:notes'`, `NOTE_MAX = 1000`. `WeekNote = {id: number, ts: number, text: string}`, unchanged from Weekly 2.
- Produces (`src/lib/activity/status.js`): `trackerStatus() → Promise<{current: {url, title?}|null, error: string|null}>` (reads `storage.session`), `onTrackingChanged(cb) → unsubscribe` (fires for local `day:`/`imp:`/`hist:`/`settings` and session `current`/`error`).

- [ ] **Step 1: Write the failing notes test**

Create `test/week-notes.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const stub = installChromeStub();
const { getWeekNotes, addWeekNote, deleteWeekNote, notesOn } = await import('../src/lib/week-notes.js');
const { today, addDays, toISODate } = await import('../src/lib/dates.js');

test('a note for today is stamped now and keeps Weekly 2’s {id, ts, text} shape', async () => {
  const before = Date.now();
  const n = await addWeekNote('  Phone screen with 2 candidates  ');
  assert.equal(n?.text, 'Phone screen with 2 candidates');
  assert.ok(n && n.ts >= before && n.ts <= Date.now());
  assert.deepEqual(Object.keys(stub.stores.local.notes[0]).sort(), ['id', 'text', 'ts']);
});

test('a note for another day lands on that local day, at noon', async () => {
  const day = addDays(today(), -3);
  const n = await addWeekNote('Offsite planning', day);
  assert.equal(toISODate(new Date(n?.ts ?? 0)), day);
  assert.equal(new Date(n?.ts ?? 0).getHours(), 12);
  assert.deepEqual(notesOn(await getWeekNotes(), day).map((x) => x.text), ['Offsite planning']);
});

test('blank notes are ignored; ids stay unique when added in the same millisecond', async () => {
  assert.equal(await addWeekNote('   '), null);
  const [a, b] = await Promise.all([addWeekNote('one'), addWeekNote('two')]);
  assert.notEqual(a?.id, b?.id);
});

test('delete removes only that note; existing Weekly 2 notes are read as they are', async () => {
  stub.stores.local.notes = [{ id: 1, ts: 5, text: 'legacy' }, { id: 2, ts: 6, text: 'keep' }];
  await deleteWeekNote(1);
  assert.deepEqual(await getWeekNotes(), [{ id: 2, ts: 6, text: 'keep' }]);
  stub.stores.local.notes = 'corrupt';
  assert.deepEqual(await getWeekNotes(), []);
});
```

- [ ] **Step 2: Write the failing status test**

Create `test/activity/status.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

const stub = installChromeStub();
const { trackerStatus, onTrackingChanged } = await import('../../src/lib/activity/status.js');

test('trackerStatus reads the worker’s session state, null when absent', async () => {
  assert.deepEqual(await trackerStatus(), { current: null, error: null });
  stub.stores.session.current = { url: 'https://a.example/', title: 'A' };
  stub.stores.session.error = 'QUOTA_BYTES quota exceeded';
  assert.deepEqual(await trackerStatus(), { current: { url: 'https://a.example/', title: 'A' }, error: 'QUOTA_BYTES quota exceeded' });
});

test('onTrackingChanged fires for tracked days, settings and session status only', () => {
  let n = 0;
  const off = onTrackingChanged(() => n++);
  const [fire] = stub.log.listeners['storage.onChanged'] ?? [];
  fire?.({ 'day:2026-10-29': {} }, 'local');
  fire?.({ settings: {} }, 'local');
  fire?.({ current: {} }, 'session');
  fire?.({ tasks: {} }, 'local');
  fire?.({ notes: {} }, 'local');
  fire?.({ settings: {} }, 'sync');
  assert.equal(n, 3);
  off();
  assert.equal(stub.log.listeners['storage.onChanged']?.length, 0);
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npm run test:ny`

Expected: both files fail with `Cannot find module`.

- [ ] **Step 4: Create `src/lib/week-notes.js`**

Create `src/lib/week-notes.js`:

```js
/**
 * Weekly 2's notes ({id, ts, text}): work done outside Chrome, listed under
 * "Other work" in the update. This module is their only owner for new code
 * (side panel, day sheet) until Phase 4 migrates them into notes.js.
 * The report's notes panel still has its documented direct-storage exception.
 */
import { withLock } from './storage.js';
import { toISODate, fromISODate, today } from './dates.js';

/** @typedef {{ id: number, ts: number, text: string }} WeekNote */

const KEY = 'notes';
export const NOTES_LOCK = 'weekly:notes';
export const NOTE_MAX = 1000;

/** @returns {Promise<WeekNote[]>} */
export async function getWeekNotes() {
  const { [KEY]: notes } = await chrome.storage.local.get(KEY);
  return Array.isArray(notes) ? notes : [];
}

/**
 * Add a note dated to `iso`: now for today, local noon for any other day.
 * @param {string} text @param {string} [iso]
 * @returns {Promise<WeekNote | null>} null when the text is blank
 */
export function addWeekNote(text, iso = today()) {
  const clean = text.trim().slice(0, NOTE_MAX);
  if (!clean) return Promise.resolve(null);
  return withLock(NOTES_LOCK, async () => {
    const notes = await getWeekNotes();
    const ts = iso === today() ? Date.now() : (fromISODate(iso)?.getTime() ?? Date.now()) + 12 * 36e5;
    const note = { id: Math.max(Date.now(), ...notes.map((n) => n.id + 1)), ts, text: clean };
    await chrome.storage.local.set({ [KEY]: [...notes, note] });
    return note;
  });
}

/** @param {number} id @returns {Promise<void>} */
export function deleteWeekNote(id) {
  return withLock(NOTES_LOCK, async () => {
    await chrome.storage.local.set({ [KEY]: (await getWeekNotes()).filter((n) => n.id !== id) });
  });
}

/** The notes dated to one local day. @param {WeekNote[]} notes @param {string} iso */
export const notesOn = (notes, iso) => notes.filter((n) => toISODate(new Date(n.ts)) === iso);
```

- [ ] **Step 5: Create `src/lib/activity/status.js`**

Create `src/lib/activity/status.js`:

```js
// What the tracker is doing right now, for the side panel footer. The worker
// writes `current` and `error` to storage.session; this is their read side.

/** @typedef {{ url: string, title?: string }} Current */

/** @returns {Promise<{ current: Current | null, error: string | null }>} */
export async function trackerStatus() {
  const { current, error } = await chrome.storage.session.get(['current', 'error']);
  return { current: current ?? null, error: typeof error === 'string' ? error : null };
}

/**
 * Call `cb` when tracked time, settings or the tracker's status change.
 * @param {() => void} cb @returns {() => void} unsubscribe
 */
export function onTrackingChanged(cb) {
  /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
  const listener = (changes, area) => {
    const keys = Object.keys(changes);
    if (area === 'session' ? keys.some((k) => k === 'current' || k === 'error')
      : area === 'local' && keys.some((k) => k === 'settings' || /^(day|imp|hist):/.test(k))) cb();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
```

- [ ] **Step 6: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`

Expected: `# tests 193`, `# fail 0` in both timezones; `tsc` exits 0.

---

### Task 3: The side panel replaces the popup: tracking footer and Week tab

**Files:**
- Modify: `manifest.json`, `src/background/service-worker.js:50`, `scripts/build.mjs:24`, `jsconfig.json`
- Modify: `test/helpers/chrome-stub.js`, `test/background/service-worker.test.js` (append)
- Replace: `src/ui/components/dom.js` (same behaviour, JSDoc-typed)
- Create: `src/ui/components/undo.js`, `src/ui/components/tasks.css`
- Create: `src/ui/panel/panel.html`, `src/ui/panel/panel.css`, `src/ui/panel/panel.js`, `src/ui/panel/footer.js`, `src/ui/panel/week-tab.js`
- Delete: `src/ui/popup/` (popup.html, popup.css, popup.js)
- Modify: `src/ui/report/data-panel.js` (delete-all)
- Create: `test/e2e/panel.mjs`; Modify: `test/e2e/full.mjs` (PAGES, `idleSeconds`, section 4, delete-all check)

**Interfaces:**
- Consumes (Task 1): `doneThisWeek`, `getTasks` (tasks.js), `updateSettings(fn)`. Consumes (Task 2): `addWeekNote`, `trackerStatus`, `onTrackingChanged`. Consumes (2a): `onTasksChanged` (storage.js), `deleteEverything` (task-portability.js).
- Produces (`src/ui/panel/panel.js`): `TABS: {id, label, mount(host), refresh()}[]` (each tab gets `#tab-<id>` and `#panel-<id>`), `openApp()` (opens `src/ui/app/app.html` in a tab).
- Produces (`src/ui/components/undo.js`): `toast(message, undo?)`, `undoLast() → Promise<boolean>`, `report(error)` (plain-language "not saved" toast; quota explained).
- Produces (`src/ui/components/dom.js`): `h`, `clear`, `$`, `$$` unchanged; `$`/`$$` are generic (`$<T>(sel) → T`, default `HTMLElement`).
- Produces (`test/e2e/panel.mjs`): `unlabeled(page) → Promise<string[]>`, `panelChecks(t) → panelPage`. The harness object `t` in `full.mjs`: `{ctx, X, sw, check, watch, store, wait, shots, PAGES, iso: {today, yesterday, tomorrow, dayAfter}, workday, weekend, focusTab}`.
- Decision: `src/ui` joins the typecheck for the new code only (`components/`, `panel/`, `app/`). The legacy report and welcome pages stay out until they are rewritten: typing them now would be a rewrite of working Phase 1 code with no behaviour change.

- [ ] **Step 1: Write the panel end-to-end checks**

Create `test/e2e/panel.mjs`:

```js
// Side panel checks (spec §3.1). The panel page is opened directly as an extension URL.
// `t` is the harness context built in full.mjs.

/** Visible controls with no label, aria-label, text or placeholder. */
export const unlabeled = page => page.evaluate(() => [...document.querySelectorAll('input,select,textarea,button')]
  .filter(el => el.offsetParent && !(el.labels?.length) && !el.getAttribute('aria-label') && !el.textContent.trim() && !el.placeholder)
  .map(el => el.id || el.outerHTML.slice(0, 60)));

export async function panelChecks(t) {
  const { ctx, X, sw, check, watch, store, wait, shots, PAGES, focusTab } = t;
  const manifest = await sw.evaluate(() => chrome.runtime.getManifest());
  check('Panel', 'toolbar icon opens the side panel, no popup', manifest.side_panel?.default_path === PAGES.panel && !manifest.action.default_popup && manifest.permissions.includes('sidePanel'), JSON.stringify(manifest.action));
  const behavior = await sw.evaluate(() => chrome.sidePanel.getPanelBehavior());
  check('Panel', 'panel opens on toolbar click', behavior.openPanelOnActionClick === true, JSON.stringify(behavior));

  const pan = watch(await ctx.newPage());
  await pan.setViewportSize({ width: 360, height: 800 });
  await pan.goto(`${X}/${PAGES.panel}`); await focusTab(); await wait(1200); await pan.reload(); await wait(500);
  check('Panel', 'footer shows time tracked today', /\d+m|\d+h/.test(await pan.textContent('#todayTotal')), await pan.textContent('#todayTotal'));
  check('Panel', 'shows what is being tracked now', /^Now: /.test(await pan.textContent('#now')), await pan.textContent('#now'));
  await pan.click('#pause'); await wait(400);
  check('Panel', 'pause works', (await pan.textContent('#now')) === 'Tracking is paused.' && (await store()).settings.paused === true);
  await pan.click('#pause'); await wait(400);
  check('Panel', 'resume works', (await store()).settings.paused === false && (await pan.textContent('#pause')) === 'Pause');
  await pan.fill('#note', 'Phone screen with 2 candidates'); await pan.press('#note', 'Enter'); await wait(300);
  check('Panel', 'note added with Enter', (await store()).notes?.some(n => n.text === 'Phone screen with 2 candidates'));
  await sw.evaluate(() => chrome.storage.session.set({ error: 'QUOTA_BYTES quota exceeded' })); await wait(300);
  check('Panel', 'storage-full error explained in plain words, live', /Storage is full/.test(await pan.textContent('#err')), await pan.textContent('#err'));
  await sw.evaluate(() => chrome.storage.session.remove('error')); await wait(300);
  check('Panel', 'error banner clears when the error does', !(await pan.isVisible('#err')));
  check('Panel', 'privacy line shown', /Stays on this computer/.test(await pan.textContent('.privacy')));
  await pan.click('#tab-week'); await wait(500);
  check('Panel', 'Week tab: Mon–Fri strip', (await pan.locator('#weekDays .wday .name').allTextContents()).map(s => s.split(' ')[0]).join(',') === 'Mon,Tue,Wed,Thu,Fri');
  check('Panel', 'Week tab: today’s top work', (await pan.locator('#top li').allTextContents()).some(s => s.includes('ENGX-1')));
  const [reportTab] = await Promise.all([ctx.waitForEvent('page'), pan.click('#openReport')]);
  await reportTab.waitForLoadState();
  check('Panel', '"Open full report" opens the report', reportTab.url().endsWith('/' + PAGES.report), reportTab.url());
  await reportTab.close();
  check('Layout', 'every panel control has a label', (await unlabeled(pan)).length === 0, (await unlabeled(pan)).join(', '));
  check('Layout', 'panel: no sideways scrolling at 360 px', await pan.evaluate(() => document.documentElement.scrollWidth <= 360));
  await pan.screenshot({ path: shots + '/2-panel.png' });
  return pan;
}
```

- [ ] **Step 2: Point the harness at the side panel**

Every Popup check moves to `panel.mjs` under the area `Panel`, with the same names where the behaviour is the same. The popup's "Open report" button becomes the Week tab's **Open full report →**. The first change hardens a Phase 1 harness setting: with `idleSeconds: 3600`, Chrome reports the machine idle after an hour without real input and every tracking check fails on an unattended run (found while validating this plan).

In `test/e2e/full.mjs`, replace:

```js
await sw.evaluate(() => chrome.storage.local.set({ settings: { paused: true, minMinutes: 0, idleSeconds: 3600 } }));
```

with:

```js
// 14400 s (4 h) is the chrome.idle maximum: an unattended run must not count as idle because nobody touched the machine for an hour.
await sw.evaluate(() => chrome.storage.local.set({ settings: { paused: true, minMinutes: 0, idleSeconds: 14400 } }));
```

In `test/e2e/full.mjs`, replace:

```js
export const PAGES = { report: 'src/ui/report/report.html', popup: 'src/ui/popup/popup.html', welcome: 'src/ui/welcome/welcome.html' };
```

with:

```js
export const PAGES = { report: 'src/ui/report/report.html', panel: 'src/ui/panel/panel.html', app: 'src/ui/app/app.html', welcome: 'src/ui/welcome/welcome.html' };
```

In `test/e2e/full.mjs`, replace:

```js
// ===== 4. Popup =====
const pop = watch(await ctx.newPage());
await pop.goto(`${X}/${PAGES.popup}`); await tabs['https://acme.atlassian.net/browse/ENGX-1'].bringToFront(); await wait(1200); await pop.reload(); await wait(400);
check('Popup', 'shows today’s top work', (await pop.locator('#top li').allTextContents()).some(t => t.includes('ENGX-1')));
check('Popup', 'shows what is being tracked now', /^Now: /.test(await pop.textContent('#now')), await pop.textContent('#now'));
await pop.click('#pause'); await wait(400);
check('Popup', 'pause works', (await pop.textContent('#now')) === 'Tracking is paused.' && (await store()).settings.paused === true);
await pop.click('#pause'); await wait(400);
check('Popup', 'resume works', (await store()).settings.paused === false);
await pop.fill('#note', 'Phone screen with 2 candidates'); await pop.press('#note', 'Enter'); await wait(300);
check('Popup', 'note added with Enter', (await store()).notes?.some(n => n.text === 'Phone screen with 2 candidates'));
await sw.evaluate(() => chrome.storage.session.set({ error: 'QUOTA_BYTES quota exceeded' }));
await pop.reload(); await wait(300);
check('Popup', 'storage-full error explained in plain words', /Storage is full/.test(await pop.textContent('#err')), await pop.textContent('#err'));
check('Popup', 'privacy line shown', /Stays on this computer/.test(await pop.textContent('.privacy')));
await sw.evaluate(() => chrome.storage.session.remove('error'));
await pop.screenshot({ path: shots + '/2-popup.png' });
```

with:

```js
// ===== 4. Side panel (replaces the popup) =====
const { panelChecks } = await import('./panel.mjs');
const iso = { today: dayKey(new Date()), yesterday: dayKey(addDays(new Date(), -1)), tomorrow: dayKey(addDays(new Date(), 1)), dayAfter: dayKey(addDays(new Date(), 2)) };
const harness = { ctx, X, sw, check, watch, store, wait, shots, PAGES, iso, workday, weekend,
  focusTab: () => tabs['https://acme.atlassian.net/browse/ENGX-1'].bringToFront() };
const pan = await panelChecks(harness);
```

In `test/e2e/full.mjs`, replace:

```js
check('Data', 'delete all keeps only settings and device ID', Object.keys(st).sort().join(',') === 'deviceId,settings', Object.keys(st).join(','));
```

with:

```js
// The first task read writes `tasks` and `schemaVersion`; delete-all empties tasks through the task lock.
check('Data', 'delete all keeps only settings and device ID (tasks emptied)', Object.keys(st).sort().join(',') === 'deviceId,schemaVersion,settings,tasks' && st.tasks.length === 0, Object.keys(st).join(','));
```

- [ ] **Step 3: Run the end-to-end suite to see it fail**

Run: `npm run e2e`

Expected: FAIL. `[Panel] toolbar icon opens the side panel, no popup` fails, and the run stops at `chrome.sidePanel.getPanelBehavior()`: `chrome.sidePanel` is undefined until the manifest asks for the permission. Every tracking check before it still passes.

- [ ] **Step 4: Teach the Chrome stub the side panel**

In `test/helpers/chrome-stub.js`, replace:

```js
    badge: {},
```

with:

```js
    badge: {},
    panelBehavior: /** @type {object | null} */ (null),
```

In `test/helpers/chrome-stub.js`, replace:

```js
    idle: {
      async queryState()
```

with:

```js
    sidePanel: {
      async setPanelBehavior(o) { log.panelBehavior = o; },
    },
    idle: {
      async queryState()
```

- [ ] **Step 5: Write the failing worker test**

Append to `test/background/service-worker.test.js`:

```js

test('the toolbar icon opens the side panel', () => {
  assert.deepEqual(stub.log.panelBehavior, { openPanelOnActionClick: true });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npm run test:ny`

Expected: `the toolbar icon opens the side panel` fails (`null` is not `{ openPanelOnActionClick: true }`).

- [ ] **Step 7: Make the toolbar icon open the side panel**

Do this together with the manifest change below: without the `sidePanel` permission, `chrome.sidePanel` is undefined and this line stops the worker in Chrome (the unit stub does not catch that).

In `src/background/service-worker.js`, replace:

```js
const openReport = () =>
```

with:

```js
// The toolbar icon opens the side panel (spec §3.1). Set on every worker start: it is cheap and idempotent.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => console.error('[weekly] side panel', e));

const openReport = () =>
```

- [ ] **Step 8: Run the unit tests**

Run: `npm test`

Expected: `# fail 0` in both timezones.

- [ ] **Step 9: Declare the side panel and drop the popup**

In `manifest.json`, replace:

```json
"permissions": ["tabs", "storage", "unlimitedStorage", "idle", "alarms", "notifications"],
```

with:

```json
"permissions": ["tabs", "storage", "unlimitedStorage", "idle", "alarms", "notifications", "sidePanel"],
```

In `manifest.json`, replace:

```json
  "action": {
    "default_popup": "src/ui/popup/popup.html",
    "default_title": "Weekly",
```

with:

```json
  "side_panel": { "default_path": "src/ui/panel/panel.html" },
  "action": {
    "default_title": "Weekly",
```

- [ ] **Step 10: Check the side panel page at build time**

In `scripts/build.mjs`, replace:

```js
  manifest.background.service_worker, manifest.action.default_popup,
```

with:

```js
  manifest.background.service_worker, manifest.side_panel.default_path,
```

- [ ] **Step 11: Bring the new UI into the typecheck**

In `jsconfig.json`, replace:

```json
  "include": ["src/lib/**/*.js", "src/background/**/*.js"]
```

with:

```json
  "include": ["src/lib/**/*.js", "src/background/**/*.js", "src/ui/components/**/*.js", "src/ui/panel/**/*.js", "src/ui/app/**/*.js"]
```

- [ ] **Step 12: Type the DOM builder**

Replace the whole of `src/ui/components/dom.js` with the typed version below. Behaviour is unchanged: `test/ui/dom.test.js` pins it. The only refactor is `setAttrs()`, pulled out to keep `h()` short.

```js
// One way to build DOM in Weekly: text is always text. User input and imported
// files never become markup.
/** @template {Element} [T=HTMLElement] @param {string} sel @param {ParentNode} [root] @returns {T} */
export const $ = (sel, root = document) => /** @type {T} */ (root.querySelector(sel));
/** @template {Element} [T=HTMLElement] @param {string} sel @param {ParentNode} [root] @returns {T[]} */
export const $$ = (sel, root = document) => /** @type {T[]} */ (Array.from(root.querySelectorAll(sel)));

/** @param {Node} el */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// Markup sinks and inline handlers are refused outright: a caller passing one is a bug.
const BLOCKED = new Set(['innerHTML', 'outerHTML', 'srcdoc', 'insertAdjacentHTML', 'setHTMLUnsafe']);
/** @param {string} k */
const isBlocked = (k) => BLOCKED.has(k) || (k !== 'on' && /^on/i.test(k));
// URL-bearing props only accept http(s), mailto, chrome-extension, #fragments and relative paths.
const URL_KEYS = new Set(['href', 'src', 'action', 'formAction']);
const SAFE_URL = /^(?:https?:|mailto:|chrome-extension:|#|[^:]*$)/i;
/** @param {unknown} v */
const safeUrl = (v) => SAFE_URL.test(String(v).trim());
// attrs names are case-insensitive in HTML, so they are checked lowercased.
const BLOCKED_ATTRS = new Set(['srcdoc']);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

/** @typedef {Node | string | number | null | undefined | false | ChildList} Child */
/** @typedef {Array<Child>} ChildList */
/** @typedef {Record<string, unknown> & { class?: string, dataset?: Record<string, string>, style?: Partial<CSSStyleDeclaration>, on?: Record<string, (e: never) => void>, attrs?: Record<string, string | number | boolean> }} Props */

/** @param {HTMLElement} el @param {Record<string, string | number | boolean>} attrs */
function setAttrs(el, attrs) {
  for (const [a, val] of Object.entries(attrs)) {
    const name = a.toLowerCase();
    if (BLOCKED_ATTRS.has(name) || name.startsWith('on')) throw new Error(`h(): attribute "${a}" is not allowed; build DOM from children and use the on: {} prop`);
    if (URL_ATTRS.has(name) && !safeUrl(val)) { console.warn(`[weekly] h(): dropped unsafe ${a}`); continue; }
    el.setAttribute(a, String(val));
  }
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag @param {Props | null} [props] @param {...Child} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (isBlocked(k)) throw new Error(`h(): "${k}" is not allowed; build DOM from children and use the on: {} prop`);
    if (URL_KEYS.has(k) && !safeUrl(v)) { console.warn(`[weekly] h(): dropped unsafe ${k}`); continue; }
    if (k === 'class') el.className = String(v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(/** @type {Record<string, EventListener>} */ (v))) el.addEventListener(ev, fn);
    else if (k === 'attrs') setAttrs(el, /** @type {Record<string, string>} */ (v));
    else /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (el))[k] = v;
  }
  /** @param {Child} c */
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}
```

- [ ] **Step 13: Create the toast**

Create `src/ui/components/undo.js`:

```js
// The toast: one message at a time. With an undo it carries an Undo button, and
// ⌘Z / Ctrl+Z does the same (spec D6); only the latest action is undoable, like
// Daybook. A failed write is reported here too, in plain words (spec §6).
import { h } from './dom.js';

/** @type {(() => Promise<unknown>) | null} */
let pending = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;

/** Show a message; with `undo`, offer to reverse the action. @param {string} message @param {(() => Promise<unknown>) | null} [undo] */
export function toast(message, undo = null) {
  document.querySelector('.toast')?.remove();
  clearTimeout(timer);
  pending = undo;
  const node = h('div', { class: 'toast', attrs: { role: 'status', 'aria-live': 'polite' } }, h('span', {}, message),
    undo ? h('button', { class: 'quiet', on: { click: () => void undoLast() } }, 'Undo') : null);
  // Inside an open modal dialog (the day sheet), or it would sit inert behind it.
  (document.querySelector('dialog[open]') ?? document.body).append(node);
  timer = setTimeout(() => { node.remove(); if (pending === undo) pending = null; }, 8000);
}

/** Reverse the latest offered action, if any. @returns {Promise<boolean>} whether something was undone */
export async function undoLast() {
  const fn = pending;
  pending = null;
  document.querySelector('.toast')?.remove();
  if (!fn) return false;
  try { await fn(); toast('Undone.'); } catch (e) { report(e); }
  return true;
}

/** Tell the user a change was not saved, in plain words. @param {unknown} e */
export function report(e) {
  const msg = e instanceof Error ? e.message : String(e);
  toast(/quota/i.test(msg) ? 'Storage is full, so that change was not saved. Export and delete old weeks in the report’s Settings.'
    : `That change was not saved: ${msg}`);
}
```

- [ ] **Step 14: Create the shared task styles**

Create `src/ui/components/tasks.css`. The panel and the app both load it: rows, bands, the ⋯ menu, the toast and dialogs, in Weekly's palette (ledger rules, navy for actions, the yellow marker for "done").

```css
/* Task rows, bands, the ⋯ menu, the toast and dialogs: shared by the side panel and the app tab.
   Weekly's language: ledger rules, navy ink for actions, the yellow marker for "done". */
.band { margin: 0 0 14px; }
.band > h3, .band > summary { display: flex; gap: 8px; align-items: baseline; font: 600 15px/1.3 var(--serif);
  border-bottom: 2px solid var(--ink); padding: 4px 0; margin: 0; }
.band > summary { cursor: pointer; list-style: none; }
.band > summary::-webkit-details-marker { display: none; }
.band > summary::before { content: '▸'; color: var(--muted); font-size: 12px; }
.band[open] > summary::before { content: '▾'; }
.band-label { flex: 1; }
.band-count { color: var(--muted); font: 12px var(--sans); font-variant-numeric: tabular-nums; }
.band.flagged > h3, .band.flagged > summary { color: var(--danger); border-bottom-color: var(--danger); }
.band h3 button { font: 600 12px var(--sans); min-height: 24px; padding: 2px 8px; }
.none { color: var(--muted); font-size: 13px; margin: 8px 0; }

.rows { list-style: none; margin: 0; padding: 0; }
.row { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 8px; align-items: start;
  padding: 7px 0 7px 6px; border-bottom: 1px solid var(--rule); border-left: 3px solid transparent; }
.row.p-high { border-left-color: var(--navy); }
.row.p-medium { border-left-color: var(--rule-strong); }
.row input[type=checkbox] { margin-top: 3px; }
.t-main { display: grid; min-width: 0; }
.t-title { overflow-wrap: anywhere; }
.t-meta { color: var(--muted); font-size: 12px; }
.row.late .t-meta { color: var(--danger); }
.row.is-done .t-title { color: var(--muted); text-decoration: line-through; text-decoration-color: var(--marker); text-decoration-thickness: 2px; }
.row.daily .t-meta::before { content: '↻ '; }

.more { position: relative; }
.more > summary { list-style: none; cursor: pointer; padding: 0 6px; border-radius: 4px; color: var(--navy); font-weight: 700; }
.more > summary::-webkit-details-marker { display: none; }
.more[open] > summary { background: var(--marker-wash); }
.menu { position: absolute; right: 0; z-index: 5; display: grid; gap: 6px; min-width: 200px; padding: 10px;
  background: var(--sheet); border: 1px solid var(--rule-strong); border-radius: 4px; box-shadow: 0 6px 18px rgb(0 0 0 / 0.12); }
.menu label { display: grid; gap: 2px; font-size: 12px; color: var(--muted); }
.menu button { justify-self: start; }

.toast { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 20; display: flex; gap: 10px;
  align-items: center; max-width: calc(100% - 24px); padding: 8px 12px; border-radius: 4px; background: var(--ink); color: var(--sheet); font-size: 13px; }
.toast button { color: var(--marker); border-color: transparent; min-height: 26px; }

.addrow { display: flex; gap: 6px; }
.addrow input[type=text] { flex: 1; min-width: 0; }
.msg { margin: 6px 0 0; font-size: 12px; color: var(--muted); }
.msg:empty { display: none; }

dialog { border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--sheet); color: var(--ink);
  padding: 18px; width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 48px); }
dialog::backdrop { background: rgb(20 23 31 / 0.45); }
dialog h2 { font: 600 22px/1.2 var(--serif); margin: 0; }
dialog h3 { font: 600 14px/1.3 var(--serif); margin: 16px 0 4px; border-bottom: 1px solid var(--ink); padding-bottom: 2px; }
.dlg-head { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
.dlg-foot { display: flex; gap: 8px; justify-content: end; margin-top: 14px; }
```

- [ ] **Step 15: Create the panel page**

Create `src/ui/panel/panel.html`:

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Weekly</title>
<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../components/tasks.css"><link rel="stylesheet" href="panel.css"></head>
<body>
<header class="phead">
  <nav id="tabs" class="tabs" role="tablist" aria-label="Side panel"></nav>
  <button id="openApp" class="quiet" title="Open the full app (O)">Open Weekly ↗</button>
</header>
<main id="tabPanels" class="pbody"></main>
<footer class="pfoot">
  <p id="err" class="err" role="alert" hidden></p>
  <div class="trow">
    <span class="label">Tracked today</span>
    <span id="todayTotal" class="total">0m</span>
    <button id="pause"></button>
  </div>
  <p id="now" class="now"></p>
  <form id="noteForm" class="addrow">
    <input id="note" type="text" maxlength="1000" placeholder="Did something outside Chrome? Note it" aria-label="Note for this week">
    <button id="addNote">Add</button>
  </form>
  <p id="noteMsg" class="msg" role="status"></p>
  <p class="privacy">Stays on this computer. Records tab addresses and titles only.</p>
</footer>
<script type="module" src="panel.js"></script>
</body></html>
```

- [ ] **Step 16: Create the panel styles**

Create `src/ui/panel/panel.css`:

```css
/* The side panel: a narrow sheet. Tabs on the head rule, tasks in the middle, tracking in the footer. */
body { background: var(--sheet); min-height: 100vh; display: flex; flex-direction: column; }
.phead { display: flex; justify-content: space-between; align-items: end; gap: 8px; padding: 10px 12px 0; border-bottom: 2px solid var(--ink); }
.tabs { display: flex; gap: 2px; }
.tabs button { border: 0; border-bottom: 3px solid transparent; border-radius: 0; color: var(--muted); padding: 6px 10px; margin-bottom: -2px; }
.tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--marker); }
#openApp { font-size: 12px; margin-bottom: 4px; }
.pbody { flex: 1; padding: 12px; overflow-y: auto; }
.pbody section { display: grid; gap: 12px; align-content: start; }
.pfoot { border-top: 1px solid var(--rule); padding: 10px 12px 12px; display: grid; gap: 6px; background: var(--paper); }
.trow { display: flex; align-items: baseline; gap: 8px; }
.trow .label { color: var(--muted); font-size: 12px; }
.total { flex: 1; font: 600 22px/1 var(--serif); font-variant-numeric: tabular-nums; }
.now { margin: 0; color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.err { margin: 0; font-size: 12px; color: var(--danger); }
.privacy { margin: 0; text-align: center; }
.wdays { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--rule); border-radius: 4px; }
.wday { padding: 6px; border-right: 1px solid var(--rule); min-width: 0; }
.wday:last-child { border-right: 0; }
.wday.today { box-shadow: inset 0 3px 0 var(--navy); }
.wday .name { color: var(--muted); font-size: 11px; }
.wday .hrs { font: 600 15px/1.2 var(--serif); font-variant-numeric: tabular-nums; }
.stat { margin: 0; font: 600 16px/1.3 var(--serif); }
.stat .mark { font-variant-numeric: tabular-nums; }
.top { margin: 0; padding-left: 18px; display: grid; gap: 3px; font-size: 13px; }
.top li span { color: var(--muted); float: right; padding-left: 8px; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 17: Create the footer (Weekly 2's popup, kept whole)**

Create `src/ui/panel/footer.js`:

```js
// The panel footer: Weekly 2's popup, kept whole (time today, what is being
// tracked, pause, a quick note, the storage-full banner, the privacy line).
import { $ } from '../components/dom.js';
import { getSettings, updateSettings } from '../../lib/settings.js';
import { loadRange } from '../../lib/activity/range.js';
import { trackerStatus, onTrackingChanged } from '../../lib/activity/status.js';
import { addWeekNote } from '../../lib/week-notes.js';
import { report } from '../components/undo.js';
import { fmtDuration } from '../../lib/week.js';

export async function refresh() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [day, settings, { current, error }] = await Promise.all([loadRange(start, 1), getSettings(), trackerStatus()]);
  $('#todayTotal').textContent = fmtDuration(day.perDay[0] ?? 0);
  $('#now').textContent = settings.paused ? 'Tracking is paused.'
    : current ? 'Now: ' + (current.title || current.url) : 'Not tracking (idle, Chrome not focused, or an ignored site).';
  $('#pause').textContent = settings.paused ? 'Resume' : 'Pause';
  $('#err').hidden = !error;
  $('#err').textContent = !error ? ''
    : /quota/i.test(error) ? 'Storage is full, so recording has stopped. Open the report, then Settings → Your data to export and delete old weeks.'
    : `Recording stopped because of an error: ${error}`;
}

/** @param {SubmitEvent} e */
async function addNote(e) {
  e.preventDefault();
  const note = /** @type {HTMLInputElement} */ ($('#note'));
  if (!(await addWeekNote(note.value))) return;
  note.value = '';
  $('#noteMsg').textContent = 'Added to this week’s notes.';
}

export function init() {
  // The toggle is computed inside the settings lock, so a double click can't race itself.
  $('#pause').onclick = () => void updateSettings((s) => ({ paused: !s.paused })).catch(report);
  $('#noteForm').addEventListener('submit', (e) => void addNote(/** @type {SubmitEvent} */ (e)).catch(report));
  onTrackingChanged(() => void refresh());
  void refresh();
}
```

- [ ] **Step 18: Create the Week tab**

Create `src/ui/panel/week-tab.js`:

```js
// Week tab: the Mon–Fri strip of tracked hours, tasks done this week, today's
// top work, and the way into the full report (spec §3.1).
import { h, clear } from '../components/dom.js';
import { getTasks, doneThisWeek } from '../../lib/tasks.js';
import { onTasksChanged } from '../../lib/storage.js';
import { loadRange } from '../../lib/activity/range.js';
import { onTrackingChanged } from '../../lib/activity/status.js';
import { weekStart, dayKey, fmtDuration, WORK_DAYS } from '../../lib/week.js';
import { WEEKDAYS } from '../../lib/report/draft.js';

const strip = h('div', { id: 'weekDays', class: 'wdays', attrs: { role: 'group', 'aria-label': 'Time tracked per day' } });
const done = h('p', { id: 'doneCount', class: 'stat' });
const top = h('ol', { id: 'top', class: 'top' });

async function renderTracking() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [week, day] = await Promise.all([loadRange(weekStart(0), WORK_DAYS), loadRange(start, 1)]);
  const todayKey = dayKey(new Date());
  clear(strip);
  strip.append(...week.days.map((d, i) => h('div', { class: dayKey(d) === todayKey ? 'wday today' : 'wday' },
    h('div', { class: 'name' }, `${WEEKDAYS[i]} ${d.getDate()}`), h('div', { class: 'hrs' }, week.perDay[i] ? fmtDuration(week.perDay[i] ?? 0) : '–'))));
  const items = Object.values(day.merged).sort((a, b) => b.ms - a.ms);
  clear(top);
  top.append(...items.filter((e) => e.category !== 'Browsing').slice(0, 5).map((e) => h('li', {}, e.task, h('span', {}, fmtDuration(e.ms)))));
}

async function renderDone() {
  const n = doneThisWeek(await getTasks());
  clear(done);
  done.append(h('span', { class: 'mark' }, String(n)), ` task${n === 1 ? '' : 's'} done this week`);
}

export function refresh() { void renderTracking(); void renderDone(); }

/** @param {HTMLElement} host */
export function mount(host) {
  host.append(strip, done, h('h3', { class: 'label' }, 'Top work today'), top,
    h('button', { id: 'openReport', class: 'primary', on: { click: () => void chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/report/report.html') }) } }, 'Open full report →'));
  onTasksChanged(() => void renderDone());
  onTrackingChanged(() => void renderTracking());
  refresh();
}
```

- [ ] **Step 19: Create the panel shell**

Create `src/ui/panel/panel.js`. Task 4 puts the Today tab first and adds the keys; until then the Week tab is the only tab.

```js
// The side panel (spec §3.1). Tabs are a list: Phase 4 adds Notes by appending
// one entry to TABS. Each tab mounts once into its own tabpanel and keeps
// itself current from storage changes.
import { $, h } from '../components/dom.js';
import * as weekTab from './week-tab.js';
import * as footer from './footer.js';

/** @typedef {{ id: string, label: string, mount: (host: HTMLElement) => void, refresh: () => void }} Tab */

/** @type {Tab[]} */
export const TABS = [
  { id: 'week', label: 'Week', mount: weekTab.mount, refresh: weekTab.refresh },
];

export const openApp = () => chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/app/app.html') });

/** @param {string} id */
function select(id) {
  for (const t of TABS) {
    $(`#tab-${t.id}`).setAttribute('aria-selected', String(t.id === id));
    $(`#panel-${t.id}`).hidden = t.id !== id;
  }
}

function init() {
  for (const t of TABS) {
    $('#tabs').append(h('button', { id: `tab-${t.id}`, attrs: { role: 'tab', 'aria-controls': `panel-${t.id}` }, on: { click: () => select(t.id) } }, t.label));
    const host = h('section', { id: `panel-${t.id}`, attrs: { role: 'tabpanel', 'aria-labelledby': `tab-${t.id}` } });
    $('#tabPanels').append(host);
    t.mount(host);
  }
  select('week');
  $('#openApp').onclick = () => void openApp();
  footer.init();
}

init();
```

- [ ] **Step 20: Delete the popup**

Run: `rm -r src/ui/popup`

Nothing else references it: the manifest, the build and the e2e harness were switched above.

- [ ] **Step 21: Delete-all empties tasks through the task lock**

The Week tab reads tasks, so `tasks` and `schemaVersion` now exist. Delete-all keeps those keys and empties the list with `deleteEverything()`, under the task lock.

In `src/ui/report/data-panel.js`, replace:

```js
import { exportAll, applyImport } from '../../lib/portability.js';
```

with:

```js
import { exportAll, applyImport } from '../../lib/portability.js';
import { deleteEverything } from '../../lib/task-portability.js';
```

In `src/ui/report/data-panel.js`, replace:

```js
async function clearAll() {
  if (!confirm('Delete all tracked activity, notes, drafts and imported devices? Settings are kept.')) return;
```

with:

```js
// Settings and the device ID stay. Tasks are emptied through the task lock, never removed behind its back.
const KEEP = new Set(['settings', 'deviceId', 'tasks', 'schemaVersion']);

async function clearAll() {
  if (!confirm('Delete all tracked activity, notes, drafts, tasks and imported devices? Settings are kept.')) return;
```

In `src/ui/report/data-panel.js`, replace:

```js
  await chrome.storage.local.remove(Object.keys(all).filter(k => k !== 'settings' && k !== 'deviceId'));
  msg('#settingsMsg', 'All activity and notes deleted.');
```

with:

```js
  await chrome.storage.local.remove(Object.keys(all).filter(k => !KEEP.has(k)));
  await deleteEverything();
  msg('#settingsMsg', 'All activity, notes and tasks deleted.');
```

- [ ] **Step 22: Run the unit tests, the typecheck and the end-to-end suite**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 194`, `# fail 0` in both timezones; `tsc` exits 0; e2e `112/112 passed`. The 7 Popup checks are now 15 `[Panel]` and `[Layout]` checks, including the toolbar behaviour, the live error banner and the Week tab.

---

### Task 4: Today tab: quick add, bands, tick, ⋯ menu, undo, keys, rollover

**Files:**
- Create: `src/ui/components/keys.js`, `src/ui/components/task-actions.js`, `src/ui/components/task-row.js`, `src/ui/components/bands.js`
- Create: `src/ui/panel/today-tab.js`; Replace: `src/ui/panel/panel.js` (Today first, keys, rollover)
- Modify: `src/ui/styles.css:59,63` (search and date inputs)
- Create: `test/band-state.test.js`, `test/e2e/panel-tasks.mjs`; Modify: `test/e2e/full.mjs`

**Interfaces:**
- Consumes (Task 1): `todayBands`, `restoreTask`, `UNDATED_KEY`, `PRIORITIES`, `PRIORITY_LABEL` (tasks.js). Consumes (Task 3): `toast`, `report`, `undoLast` (undo.js), `TABS`. Consumes (2a): `createTask`, `setDone`, `toggleOn`, `updateTask`, `reschedule`, `copyToDay`, `deleteTask`, `archiveRecurring`, `restoreRecurring`, `isDoneOn`, `isOverdue` (tasks.js); `onTasksChanged`, `getUiState`, `updateUiState` (storage.js).
- Produces (`src/ui/components/task-actions.js`), each resolving `true`, or `false` after a "not saved" toast: `add(draft)` (default priority from settings), `toggle(task, iso)`, `moveTo(task, iso|null)`, `moveToTomorrow(tasks)`, `copyTo(task, iso)`, `remove(task, iso?)` (recurring: Stop repeating from `iso`), `setPriority(task, p)`. Each write except `add` and `setPriority` offers Undo.
- Produces (`src/ui/components/task-row.js`): `taskRow(task, {day, onEdit?, copy?}) → <li class="row">` with a tick box, title, meta line and a `<details class="more">` ⋯ menu (Priority, Due, Move to tomorrow, Clear date, Copy to, Edit…, Delete or Stop repeating). Ticks and deletes apply to `day`.
- Produces (`src/ui/components/bands.js`): `renderBands(host, bands, row, {isOpen?, onToggle?, action?, empty?})`. Collapsible bands are `<details data-band=key>` and report only user toggles.
- Produces (`src/ui/components/keys.js`): `bindKeys(map)` (single keys outside fields and dialogs; ⌘Z/Ctrl+Z → `undoLast()`; Esc closes ⋯ menus), `onNewDay(cb)` (focus/visibility after midnight), `isTyping(target)`.

- [ ] **Step 1: Pin the band state the No date band relies on**

Create `test/band-state.test.js`. It pins the round trip for the first collapsible band: the No date band is keyed by `UNDATED_KEY`, and `coerceUiState` keeps that key while dropping past days.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const stub = installChromeStub();
const { getUiState, updateUiState } = await import('../src/lib/storage.js');
const { coerceUiState, UNDATED_KEY } = await import('../src/lib/schema.js');
const { todayBands, createTask, getTasks } = await import('../src/lib/tasks.js');
const { today, addDays } = await import('../src/lib/dates.js');

test('the No date band is keyed by UNDATED_KEY, so its open state round-trips through uiState', async () => {
  await createTask({ title: 'Read the Q4 plan' });
  const band = todayBands(await getTasks()).find((b) => b.collapsible);
  assert.equal(band?.key, UNDATED_KEY);
  await updateUiState({ dayState: { [UNDATED_KEY]: 'open' } });
  assert.equal((await getUiState()).dayState[UNDATED_KEY], 'open');
});

test('coerceUiState keeps the undated key and future days, drops past days and junk', () => {
  const ref = today();
  const raw = { dayState: { [UNDATED_KEY]: 'closed', [addDays(ref, 1)]: 'open', [ref]: 'open',
    [addDays(ref, -1)]: 'open', 'not-a-date': 'open', [addDays(ref, 2)]: 'maybe' } };
  assert.deepEqual(coerceUiState(raw, ref).dayState, { [UNDATED_KEY]: 'closed', [addDays(ref, 1)]: 'open', [ref]: 'open' });
  assert.deepEqual(coerceUiState('junk', ref), { dayState: {} });
});

test('a stored uiState is read through coerceUiState', async () => {
  stub.stores.local.uiState = { dayState: { [addDays(today(), -3)]: 'open', [UNDATED_KEY]: 'open' } };
  assert.deepEqual((await getUiState()).dayState, { [UNDATED_KEY]: 'open' });
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:ny`

Expected: PASS (3). These pin Phase 2a behaviour that the Today tab now depends on.

- [ ] **Step 3: Write the panel task checks**

Create `test/e2e/panel-tasks.mjs`:

```js
// Task flows in the side panel's Today tab (D2, D3, D5, D6, D7, D10, L10).
import { unlabeled } from './panel.mjs';

const helpers = (t, pan) => ({
  byTitle: async title => ((await t.store()).tasks ?? []).find(x => x.title === title),
  row: title => pan.locator('#todayList li.row', { hasText: title }),
  toastUndo: () => pan.click('.toast button'),
  check2: (name, ok, detail) => t.check('Panel tasks', name, ok, detail),
});

export async function panelTaskChecks(t, pan) {
  const { wait, iso } = t;
  const { byTitle, row, toastUndo, check2 } = helpers(t, pan);
  await pan.reload(); await wait(500);
  check2('Today tab is the default', (await pan.getAttribute('#tab-today', 'aria-selected')) === 'true' && await pan.isVisible('#addTitle'));
  await pan.fill('#addTitle', 'Ship the login fix'); await pan.press('#addTitle', 'Enter'); await wait(400);
  const ship = await byTitle('Ship the login fix');
  check2('quick add with Enter: due today, default priority (D2)', ship?.dueDate === iso.today && ship.priority === 'medium' && await row('Ship the login fix').count() === 1, JSON.stringify(ship));
  await pan.fill('#addTitle', 'Call Acme Corp about renewal'); await pan.click('#panel-today form button'); await wait(400);
  check2('the Add button adds too', !!(await byTitle('Call Acme Corp about renewal')));
  await row('Ship the login fix').locator('input[type=checkbox]').check(); await wait(400);
  check2('tick closes a one-off; it stays in Today, struck through', (await byTitle('Ship the login fix')).status === 'done' && await row('Ship the login fix').evaluate(el => el.classList.contains('is-done')));
  await toastUndo(); await wait(400);
  check2('Undo in the toast reopens it (D6)', (await byTitle('Ship the login fix')).status === 'open');
  await row('Ship the login fix').locator('input[type=checkbox]').check(); await wait(400);
  await pan.keyboard.press('ControlOrMeta+z'); await wait(400);
  check2('⌘Z / Ctrl+Z undoes the last tick (D6)', (await byTitle('Ship the login fix')).status === 'open');
  await row('Ship the login fix').locator('input[type=checkbox]').check(); await wait(400);
  await row('Call Acme').locator('summary').click();
  await row('Call Acme').locator('select').selectOption('high'); await wait(400);
  check2('priority from the ⋯ menu', (await byTitle('Call Acme Corp about renewal')).priority === 'high');
  await row('Call Acme').locator('summary').click();
  await row('Call Acme').locator('input.move').fill(iso.yesterday); await wait(400);
  check2('due date from the ⋯ menu; a past day lands in Overdue', await pan.locator('[data-band="overdue"] li', { hasText: 'Call Acme' }).count() === 1);
  await pan.click('[data-band="overdue"] button.moveAll'); await wait(400);
  check2('Move all to tomorrow (D7)', (await byTitle('Call Acme Corp about renewal')).dueDate === iso.tomorrow && await pan.locator('[data-band="overdue"]').count() === 0);
  await toastUndo(); await wait(400);
  check2('Move all is undoable', (await byTitle('Call Acme Corp about renewal')).dueDate === iso.yesterday);
  await row('Call Acme').locator('summary').click(); await row('Call Acme').locator('button.tomorrow').click(); await wait(400);
  check2('Move to tomorrow, one task (D7)', (await byTitle('Call Acme Corp about renewal')).dueDate === iso.tomorrow && await row('Call Acme').count() === 0);
}

// The No date band and its saved state, delete + undo, N, and labels on a full panel.
export async function panelBandChecks(t, pan) {
  const { check, store, wait } = t;
  const { byTitle, row, toastUndo, check2 } = helpers(t, pan);
  await pan.fill('#addTitle', 'Read the Q4 plan'); await pan.press('#addTitle', 'Enter'); await wait(400);
  await row('Read the Q4 plan').locator('summary').click(); await row('Read the Q4 plan').locator('button', { hasText: 'Clear date' }).click(); await wait(400);
  const undated = pan.locator('details[data-band="undated"]');
  check2('No date band starts collapsed', await undated.count() === 1 && (await undated.getAttribute('open')) === null);
  await pan.click('details[data-band="undated"] > summary'); await wait(400);
  check2('band state is saved (uiState)', (await store()).uiState?.dayState?.undated === 'open', JSON.stringify((await store()).uiState));
  await pan.reload(); await wait(600);
  check2('band state survives a reload', (await pan.locator('details[data-band="undated"]').getAttribute('open')) !== null);
  const q4 = await byTitle('Read the Q4 plan');
  await row('Read the Q4 plan').locator('summary').click(); await row('Read the Q4 plan').locator('button.delete').click(); await wait(400);
  check2('delete from the ⋯ menu (D5)', !(await byTitle('Read the Q4 plan')));
  await toastUndo(); await wait(400);
  check2('Undo restores the deleted task, same id (D6)', (await byTitle('Read the Q4 plan'))?.id === q4.id);
  await pan.evaluate(() => document.activeElement?.blur());
  await pan.keyboard.press('n');
  check('Keys', 'N focuses the add box (panel)', await pan.evaluate(() => document.activeElement?.id === 'addTitle'));
  check('Layout', 'every control in a full panel has a label', (await unlabeled(pan)).length === 0, (await unlabeled(pan)).join(', '));
}

// Rollover (L10): a panel left open past midnight shows the new day on focus.
// Playwright's clock is per browser context, so this runs last: every page opened after it sees the fake time.
export async function rolloverCheck(t) {
  const { ctx, X, check, watch, wait, PAGES, iso } = t;
  const roll = watch(await ctx.newPage());
  await roll.clock.install({ time: new Date(`${iso.today}T23:59:30`) });
  await roll.goto(`${X}/${PAGES.panel}`); await wait(800);
  await roll.fill('#addTitle', 'Water the plants'); await roll.press('#addTitle', 'Enter'); await wait(400);
  const plants = () => roll.locator('#todayList li.row', { hasText: 'Water the plants' });
  await plants().locator('summary').click(); await plants().locator('input.move').fill(iso.tomorrow); await wait(400);
  const before = await plants().count();
  await roll.clock.fastForward(40000);
  await roll.evaluate(() => window.dispatchEvent(new Event('focus'))); await wait(600);
  check('Rollover', 'an open panel moves to the new day on focus (L10)', before === 0 && await roll.locator('[data-band="today"] li', { hasText: 'Water the plants' }).count() === 1);
  await roll.close();
}
```

- [ ] **Step 4: Run them from the harness**

In `test/e2e/full.mjs`, replace:

```js
const pan = await panelChecks(harness);
```

with:

```js
const pan = await panelChecks(harness);
const { panelTaskChecks, panelBandChecks, rolloverCheck } = await import('./panel-tasks.mjs');
await panelTaskChecks(harness, pan);
await panelBandChecks(harness, pan);
```

In `test/e2e/full.mjs`, replace:

```js
check('Errors', 'no page errors or console errors anywhere',
```

with:

```js
await rolloverCheck(harness);
check('Errors', 'no page errors or console errors anywhere',
```

`rolloverCheck` runs last on purpose: Playwright's clock is per browser context, so every page opened after it would see the fake time.

- [ ] **Step 5: Run the end-to-end suite to see it fail**

Run: `npm run e2e`

Expected: FAIL. The run stops with a `TimeoutError` waiting for `#tab-today`, the first line of `panelTaskChecks`.

- [ ] **Step 6: Create the keyboard and rollover helpers**

Create `src/ui/components/keys.js`:

```js
// Page-level keyboard shortcuts and the midnight rollover, shared by the side
// panel and the app tab.
import { today } from '../../lib/dates.js';
import { undoLast } from './undo.js';

const NOT_TEXT = new Set(['checkbox', 'radio', 'button', 'submit', 'reset']);
/** A field that takes keystrokes. A focused checkbox does not, so N or ⌘Z still work after a tick. @param {EventTarget | null} t */
export const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName)
  || (t instanceof HTMLInputElement && !NOT_TEXT.has(t.type)));

/**
 * Single-key shortcuts (N, /, O, T, arrows…) fire only when no field has focus
 * and no modifier is held. ⌘Z / Ctrl+Z undoes the last action outside fields,
 * where the browser's own text undo belongs. Esc closes any open ⋯ menu; open
 * dialogs close themselves on Esc.
 * @param {Record<string, (e: KeyboardEvent) => void>} map keyed by KeyboardEvent.key, letters lowercase
 */
export function bindKeys(map) {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('details.more[open]').forEach((d) => d.removeAttribute('open'));
    if (isTyping(e.target)) return;
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); void undoLast(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    const fn = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (fn) { e.preventDefault(); fn(e); }
  });
}

/**
 * Call `cb` when the page comes back after midnight (spec L10): a panel or tab
 * left open overnight must stop calling yesterday "today".
 * @param {() => void} cb
 */
export function onNewDay(cb) {
  let day = today();
  const check = () => {
    if (document.visibilityState !== 'visible' || today() === day) return;
    day = today();
    cb();
  };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
}
```

- [ ] **Step 7: Create the task actions**

Create `src/ui/components/task-actions.js`:

```js
// Every task write the screens make, each with its undo (spec D6, D7, L2).
// The screens never patch the DOM: storage changes re-render them.
// A failed write is said out loud in the toast (spec §6), never dropped.
import { createTask, setDone, toggleOn, updateTask, reschedule, copyToDay, deleteTask, restoreTask, archiveRecurring, restoreRecurring, isDoneOn } from '../../lib/tasks.js';
import { getSettings } from '../../lib/settings.js';
import { shortDate, today } from '../../lib/dates.js';
import { toast, report } from './undo.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {import('../../lib/tasks.js').Priority} Priority */
/** @typedef {import('../../lib/tasks.js').TaskDraft} TaskDraft */

/**
 * @template {unknown[]} A
 * @param {(...args: A) => Promise<unknown>} fn
 * @returns {(...args: A) => Promise<boolean>} resolves false (after telling the user) if the write failed
 */
const guarded = (fn) => async (...args) => {
  try { await fn(...args); return true; } catch (e) { report(e); return false; }
};

/** Add a task with the settings' default priority (D2). */
export const add = guarded(/** @param {TaskDraft} draft */ async (draft) =>
  createTask(draft, /** @type {Priority} */ ((await getSettings()).defaultPriority)));

/** Tick or untick: a recurring task for `iso`, a one-off for good. */
export const toggle = guarded(/** @param {Task} t @param {string} iso */ async (t, iso) => {
  const nowDone = !isDoneOn(t, iso);
  if (t.repeat) await toggleOn(t.id, iso);
  else await setDone(t.id, nowDone);
  if (nowDone) toast(`Done: ${t.title}`, () => (t.repeat ? toggleOn(t.id, iso) : setDone(t.id, false)));
});

/** Change the due date (move to another day); null clears it. */
export const moveTo = guarded(/** @param {Task} t @param {string | null} iso */ async (t, iso) => {
  const was = t.dueDate;
  await updateTask(t.id, { dueDate: iso });
  toast(iso ? `Moved to ${shortDate(iso)}.` : 'Date cleared.', () => updateTask(t.id, { dueDate: was }));
});

/** Move open one-offs to tomorrow (D7). */
export const moveToTomorrow = guarded(/** @param {Task[]} tasks */ async (tasks) => {
  const open = tasks.filter((t) => t.repeat === null && t.status === 'open');
  const n = await reschedule(open.map((t) => t.id));
  toast(n === 1 ? 'Moved to tomorrow.' : `Moved ${n} tasks to tomorrow.`,
    () => Promise.all(open.map((t) => updateTask(t.id, { dueDate: t.dueDate }))));
});

/** Copy a one-off to another day as a new open task (L2). */
export const copyTo = guarded(/** @param {Task} t @param {string} iso */ async (t, iso) => {
  const copy = await copyToDay(t.id, iso);
  if (copy) toast(`Copied to ${shortDate(iso)}.`, () => deleteTask(copy.id));
  else toast('Pick a date to copy to.');
});

/**
 * Delete. A recurring task stops from `iso` and keeps its history (spec §4);
 * a one-off is removed and restored exactly, id and all, on undo.
 */
export const remove = guarded(/** @param {Task} t @param {string} [iso] */ async (t, iso = today()) => {
  if (t.repeat) {
    await archiveRecurring(t.id, iso);
    toast(`Stopped repeating “${t.title}”. Past days keep their ticks.`, () => restoreRecurring(t.id));
    return;
  }
  const snapshot = { ...t };
  await deleteTask(t.id);
  toast('Task deleted.', () => restoreTask(snapshot));
});

export const setPriority = guarded(/** @param {Task} t @param {Priority} p */ async (t, p) => updateTask(t.id, { priority: p }));
```

- [ ] **Step 8: Create the task row**

Create `src/ui/components/task-row.js`:

```js
// One task row: tick box, title, meta line and a ⋯ menu (spec §3.1: priority and
// due date are set from the menu, never in the add box). Text only, via h().
import { h } from './dom.js';
import { relativeLabel, clockTime } from '../../lib/dates.js';
import { isOverdue, isDoneOn, PRIORITIES, PRIORITY_LABEL } from '../../lib/tasks.js';
import * as act from './task-actions.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {import('../../lib/tasks.js').Priority} Priority */

/**
 * @typedef {object} RowOptions
 * @property {string} day                   the day the row stands for: ticks and deletes apply to it
 * @property {(t: Task) => void} [onEdit]   adds "Edit…" to the menu
 * @property {boolean} [copy]               adds "Copy to" (one-offs)
 */

/** @param {Task} t @param {string} day @param {boolean} done */
function metaText(t, day, done) {
  if (t.repeat) return `${t.repeat.days.length === 7 ? 'Every day' : 'Daily'} · ${PRIORITY_LABEL[t.priority]}`;
  if (done && t.completedAt) return `Done ${clockTime(t.completedAt)}`;
  return `${t.dueDate ? relativeLabel(t.dueDate, day) : 'No date'} · ${PRIORITY_LABEL[t.priority]}`;
}

/** @param {Task} t @param {string} label @param {(iso: string) => void} fn @param {string} cls */
const dateField = (t, label, fn, cls) => h('label', {}, label, h('input', {
  type: 'date', class: cls, value: cls === 'move' ? (t.dueDate ?? '') : '',
  attrs: { 'aria-label': `${label} for ${t.title}` },
  on: { change: (/** @type {Event} */ e) => { const v = /** @type {HTMLInputElement} */ (e.target).value; if (v) fn(v); } },
}));

/** @param {Task} t @param {RowOptions} o */
function menu(t, o) {
  const pri = h('select', { attrs: { 'aria-label': `Priority for ${t.title}` },
    on: { change: (/** @type {Event} */ e) => void act.setPriority(t, /** @type {Priority} */ (/** @type {HTMLSelectElement} */ (e.target).value)) } },
  PRIORITIES.map((p) => h('option', { value: p, selected: p === t.priority }, PRIORITY_LABEL[p])));
  const oneOff = t.repeat === null;
  return h('details', { class: 'more' },
    h('summary', { attrs: { 'aria-label': `More for ${t.title}` } }, '⋯'),
    h('div', { class: 'menu' },
      h('label', {}, 'Priority', pri),
      oneOff ? dateField(t, 'Due', (iso) => void act.moveTo(t, iso), 'move') : null,
      oneOff && t.status === 'open' ? h('button', { class: 'quiet tomorrow', on: { click: () => void act.moveToTomorrow([t]) } }, 'Move to tomorrow') : null,
      oneOff && t.dueDate ? h('button', { class: 'quiet', on: { click: () => void act.moveTo(t, null) } }, 'Clear date') : null,
      oneOff && o.copy ? dateField(t, 'Copy to', (iso) => void act.copyTo(t, iso), 'copy') : null,
      o.onEdit ? h('button', { class: 'quiet edit', on: { click: () => o.onEdit?.(t) } }, 'Edit…') : null,
      h('button', { class: 'quiet danger delete', on: { click: () => void act.remove(t, o.day) } },
        oneOff ? 'Delete' : 'Stop repeating')));
}

/** @param {Task} t @param {RowOptions} o @returns {HTMLLIElement} */
export function taskRow(t, o) {
  const done = isDoneOn(t, o.day);
  const late = !done && isOverdue(t, o.day);
  return h('li', { class: ['row', `p-${t.priority}`, done && 'is-done', late && 'late', t.repeat && 'daily'].filter(Boolean).join(' '), dataset: { id: t.id } },
    h('input', { type: 'checkbox', checked: done, attrs: { 'aria-label': `Done: ${t.title}` },
      on: { change: () => void act.toggle(t, o.day) } }),
    h('div', { class: 't-main' }, h('span', { class: 't-title' }, t.title), h('span', { class: 't-meta' }, metaText(t, o.day, done))),
    menu(t, o));
}
```

- [ ] **Step 9: Create the bands**

Create `src/ui/components/bands.js`:

```js
// Labelled bands of task rows. A collapsible band is a native <details>, so it
// opens with the keyboard for free; its state is reported through onToggle.
import { h, clear } from './dom.js';

/**
 * @typedef {object} BandLike
 * @property {string} label
 * @property {import('../../lib/tasks.js').Task[]} tasks
 * @property {boolean} [flagged]
 * @property {string} [key]
 * @property {boolean} [collapsible]
 * @property {boolean} [defaultOpen]
 */

/**
 * @param {HTMLElement} host
 * @param {BandLike[]} bands
 * @param {(t: import('../../lib/tasks.js').Task) => HTMLElement} row
 * @param {{ isOpen?: (b: BandLike) => boolean, onToggle?: (key: string, open: boolean) => void, action?: (b: BandLike) => HTMLElement | null, empty?: string }} [opts]
 */
export function renderBands(host, bands, row, opts = {}) {
  clear(host);
  for (const b of bands) {
    const list = b.tasks.length ? h('ul', { class: 'rows' }, b.tasks.map(row)) : h('p', { class: 'none' }, opts.empty ?? 'Nothing here.');
    const head = [h('span', { class: 'band-label' }, b.label), h('span', { class: 'band-count' }, b.tasks.length ? String(b.tasks.length) : '–')];
    const cls = ['band', b.flagged && 'flagged'].filter(Boolean).join(' ');
    if (b.collapsible && b.key) {
      const key = b.key;
      let shown = opts.isOpen?.(b) ?? b.defaultOpen ?? true;
      // Setting `open` fires a toggle event too; report only the user's changes.
      const onToggle = (/** @type {Event} */ e) => {
        const now = /** @type {HTMLDetailsElement} */ (e.target).open;
        if (now !== shown) { shown = now; opts.onToggle?.(key, now); }
      };
      host.append(h('details', { class: cls, open: shown, dataset: { band: key }, on: { toggle: onToggle } },
      h('summary', {}, head), list));
    } else {
      host.append(h('section', { class: cls, dataset: { band: b.key ?? b.label } },
        h('h3', {}, head, opts.action?.(b) ?? null), list));
    }
  }
}
```

- [ ] **Step 10: Create the Today tab**

Create `src/ui/panel/today-tab.js`:

```js
// Today tab: one-line add for today, then Overdue / Today / No date (spec §3.1).
import { h } from '../components/dom.js';
import { renderBands } from '../components/bands.js';
import { taskRow } from '../components/task-row.js';
import * as act from '../components/task-actions.js';
import { getTasks, todayBands, UNDATED_KEY } from '../../lib/tasks.js';
import { onTasksChanged, getUiState, updateUiState } from '../../lib/storage.js';
import { today } from '../../lib/dates.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

const input = h('input', { type: 'text', id: 'addTitle', maxLength: 200, placeholder: 'Add a task for today…', attrs: { 'aria-label': 'New task for today' } });
const list = h('div', { id: 'todayList' });
/** @type {Task[]} */
let tasks = [];
/** @type {Record<string, 'open' | 'closed'>} */
let dayState = {};

export function refresh() {
  const day = today();
  renderBands(list, todayBands(tasks, day), (t) => taskRow(t, { day }), {
    isOpen: (b) => (b.key && dayState[b.key] ? dayState[b.key] === 'open' : b.defaultOpen ?? true),
    onToggle: (key, open) => { dayState = { ...dayState, [key]: open ? 'open' : 'closed' }; void updateUiState({ dayState }); },
    action: (b) => {
      const open = b.tasks.filter((t) => t.repeat === null && t.status === 'open');
      return b.key !== UNDATED_KEY && open.length ? h('button', { class: 'moveAll', on: { click: () => void act.moveToTomorrow(open) } }, 'Move all to tomorrow') : null;
    },
    empty: 'Nothing for today yet.',
  });
}

/** @param {SubmitEvent} e */
async function add(e) {
  e.preventDefault();
  const title = input.value.trim();
  if (title && await act.add({ title, dueDate: today() })) input.value = '';
}

export const focusAdd = () => input.focus();

/** @param {HTMLElement} host */
export function mount(host) {
  host.append(h('form', { class: 'addrow', on: { submit: (/** @type {SubmitEvent} */ e) => void add(e) } }, input, h('button', { class: 'primary' }, 'Add')), list);
  onTasksChanged((next) => { tasks = next; refresh(); });
  void Promise.all([getTasks(), getUiState()]).then(([t, ui]) => { tasks = t; dayState = ui.dayState; refresh(); });
}
```

- [ ] **Step 11: Put Today first and add the keys**

Replace the whole of `src/ui/panel/panel.js` with:

```js
// The side panel (spec §3.1). Tabs are a list: Phase 4 adds Notes by appending
// one entry to TABS. Each tab mounts once into its own tabpanel and keeps
// itself current from storage changes.
import { $, h } from '../components/dom.js';
import { bindKeys, onNewDay } from '../components/keys.js';
import * as todayTab from './today-tab.js';
import * as weekTab from './week-tab.js';
import * as footer from './footer.js';

/** @typedef {{ id: string, label: string, mount: (host: HTMLElement) => void, refresh: () => void }} Tab */

/** @type {Tab[]} */
export const TABS = [
  { id: 'today', label: 'Today', mount: todayTab.mount, refresh: todayTab.refresh },
  { id: 'week', label: 'Week', mount: weekTab.mount, refresh: weekTab.refresh },
];

export const openApp = () => chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/app/app.html') });

/** @param {string} id */
function select(id) {
  for (const t of TABS) {
    $(`#tab-${t.id}`).setAttribute('aria-selected', String(t.id === id));
    $(`#panel-${t.id}`).hidden = t.id !== id;
  }
}

function init() {
  for (const t of TABS) {
    $('#tabs').append(h('button', { id: `tab-${t.id}`, attrs: { role: 'tab', 'aria-controls': `panel-${t.id}` }, on: { click: () => select(t.id) } }, t.label));
    const host = h('section', { id: `panel-${t.id}`, attrs: { role: 'tabpanel', 'aria-labelledby': `tab-${t.id}` } });
    $('#tabPanels').append(host);
    t.mount(host);
  }
  select('today');
  $('#openApp').onclick = () => void openApp();
  footer.init();
  bindKeys({
    n: () => { select('today'); todayTab.focusAdd(); },
    o: () => void openApp(),
  });
  onNewDay(() => { TABS.forEach((t) => t.refresh()); void footer.refresh(); });
}

init();
```

- [ ] **Step 12: Style search and date inputs like the other fields**

In `src/ui/styles.css`, replace:

```css
input[type=text], input[type=number], textarea, select {
```

with:

```css
input[type=text], input[type=number], input[type=search], input[type=date], textarea, select {
```

In `src/ui/styles.css`, replace:

```css
input[type=text], input[type=number], textarea { width: 100%; }
```

with:

```css
input[type=text], input[type=number], input[type=search], textarea { width: 100%; }
```

- [ ] **Step 13: Run the unit tests, the typecheck and the end-to-end suite**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 197`, `# fail 0` in both timezones; `tsc` exits 0; e2e `131/131 passed`, including every `[Panel tasks]` check, `[Keys] N focuses the add box (panel)` and `[Rollover] an open panel moves to the new day on focus (L10)`.

---

### Task 5: App tab: Calendar month grid and day sheet

**Files:**
- Create: `src/ui/app/app.html`, `src/ui/app/app.css`, `src/ui/app/app.js`, `src/ui/app/calendar-view.js`, `src/ui/app/day-sheet.js`
- Modify: `scripts/build.mjs:43` (ignore `#…` in page links)
- Modify: `src/ui/report/report.html:15` (link to the app), `src/ui/report/main.js` (`#settings` opens Settings)
- Create: `test/e2e/app.mjs`; Modify: `test/e2e/full.mjs`

**Interfaces:**
- Consumes (Task 1): `monthGrid`, `WORKWEEK` (tasks.js). Consumes (Task 2): `getWeekNotes`, `addWeekNote`, `deleteWeekNote`, `notesOn`. Consumes (Task 4): `taskRow`, `add`, `bindKeys`, `onNewDay`, `report`. Consumes (2a): `recurringOn`, `extrasOn`, `dayCompletion` (tasks.js).
- Produces (`src/ui/app/calendar-view.js`): `init()`, `render(tasks)`, `goTo(iso)`, `goToday()`, `step(months)`. Cells are `<button class="cal-day" data-iso>` with classes `today`/`future` and an inline `color-mix` background when shaded.
- Produces (`src/ui/app/day-sheet.js`): `init()`, `render(tasks)`, `open(iso)`. The sheet is `<dialog id="daySheet">` with `#sheetDaily`, `#dailyForm` (`#dailyTitle`, `#dailyDays` = Weekdays | Every day), `#sheetExtras`, `#extraForm`, `#sheetNotes`, `#noteForm` (`#dayNote`).
- Produces (routes): `app.html#calendar`, `app.html#day=YYYY-MM-DD` (opens that day's sheet; Phase 3 reminders link here), and `report.html#settings` (opens the report's Settings).

- [ ] **Step 1: Write the calendar and day-sheet checks**

Create `test/e2e/app.mjs`:

```js
// The app tab (spec §3.2): Calendar, day sheet, Tasks view, keys and links (D3–D6, D10, L1–L5, L9).
export async function calendarChecks(t, pan) {
  const { ctx, check, watch, wait, PAGES, iso } = t;
  await pan.bringToFront(); await pan.evaluate(() => document.activeElement?.blur());
  const [app] = await Promise.all([ctx.waitForEvent('page'), pan.keyboard.press('o')]);
  watch(app); await app.waitForLoadState(); await wait(800);
  check('Keys', 'O in the side panel opens the full app', app.url().includes('/' + PAGES.app), app.url());
  check('App', 'opens on the Calendar', await app.isVisible('#calGrid') && app.url().endsWith('#calendar'), app.url());
  check('Calendar', 'month grid starts on Monday, today ringed', (await app.locator('.cal-labels span').first().textContent()) === 'Mon' && await app.locator(`.cal-day.today[data-iso="${iso.today}"]`).count() === 1);
  const title0 = await app.textContent('#calTitle');
  await app.keyboard.press('ArrowRight'); await wait(200);
  const nextDays = await app.locator('.cal-day').count();
  check('Calendar', 'next month: every day is muted as future (L4)', (await app.textContent('#calTitle')) !== title0 && await app.locator('.cal-day.future').count() === nextDays);
  await app.keyboard.press('ArrowLeft'); await app.keyboard.press('ArrowLeft'); await wait(200);
  const prevTitle = await app.textContent('#calTitle');
  await app.keyboard.press('t'); await wait(200);
  check('Keys', '← → change month, T jumps to today (L9)', prevTitle !== title0 && (await app.textContent('#calTitle')) === title0);
  return app;
}

// The day sheet: daily tasks, extra tasks, move, copy, note slot, Esc, Stop repeating, #day= route.
export async function daySheetChecks(t, app, pan) {
  const { X, check, store, wait, shots, PAGES, iso } = t;
  const byTitle = async title => ((await store()).tasks ?? []).find(x => x.title === title);
  await app.click(`.cal-day[data-iso="${iso.today}"]`); await wait(400);
  check('Day sheet', 'clicking a day opens its sheet (L5)', await app.evaluate(() => document.querySelector('#daySheet').open) && /\S/.test(await app.textContent('#sheetTitle')));
  await app.fill('#dailyTitle', 'Standup notes'); await app.selectOption('#dailyDays', 'every'); await app.press('#dailyTitle', 'Enter'); await wait(500);
  const su = await byTitle('Standup notes');
  check('Day sheet', 'add a daily recurring task, counted from today (L1)', su?.repeat?.days?.length === 7 && su.repeat.from === iso.today && await app.locator('#sheetDaily li', { hasText: 'Standup notes' }).count() === 1, JSON.stringify(su?.repeat));
  await app.locator('#sheetDaily li', { hasText: 'Standup notes' }).locator('input[type=checkbox]').check(); await wait(400);
  check('Day sheet', 'tick a daily task for this day (L5)', (await byTitle('Standup notes')).doneDates.includes(iso.today) && (await byTitle('Standup notes')).status === 'open');
  await app.fill('#extraTitle', 'Prepare demo'); await app.press('#extraTitle', 'Enter'); await wait(400);
  check('Day sheet', 'add an extra task for this day (L2)', (await byTitle('Prepare demo'))?.dueDate === iso.today && await app.locator('#sheetExtras li', { hasText: 'Prepare demo' }).count() === 1);
  const extra = () => app.locator('#sheetExtras li', { hasText: 'Prepare demo' });
  await extra().locator('summary').click(); await extra().locator('input.move').fill(iso.tomorrow); await wait(400);
  check('Day sheet', 'move an extra task to another day (L2)', (await byTitle('Prepare demo')).dueDate === iso.tomorrow && await extra().count() === 0);
  const ship = () => app.locator('#sheetExtras li', { hasText: 'Ship the login fix' });
  await ship().locator('summary').click(); await ship().locator('input.copy').fill(iso.dayAfter); await wait(400);
  const ships = ((await store()).tasks ?? []).filter(x => x.title === 'Ship the login fix');
  check('Day sheet', 'copy an extra task to another day, unticked (L2)', ships.length === 2 && ships.some(x => x.dueDate === iso.dayAfter && x.status === 'open') && ships.some(x => x.dueDate === iso.today && x.status === 'done'), JSON.stringify(ships.map(x => [x.dueDate, x.status])));
  await app.click('.toast button'); await wait(400);
  check('Day sheet', 'a copy is undoable', ((await store()).tasks ?? []).filter(x => x.title === 'Ship the login fix').length === 1);
  await app.fill('#dayNote', 'Offsite planning'); await app.press('#dayNote', 'Enter'); await wait(400);
  check('Day sheet', 'note slot: a note for this day (L3)', await app.locator('#sheetNotes li', { hasText: 'Offsite planning' }).count() === 1 && (await store()).notes.some(n => n.text === 'Offsite planning'));
  check('Day sheet', 'progress shows the day’s share done', /^\d+ of \d+ done$/.test(await app.textContent('#sheetSub')), await app.textContent('#sheetSub'));
  await app.screenshot({ path: shots + '/6-day-sheet.png' });
  await app.keyboard.press('Escape'); await wait(300);
  check('Keys', 'Esc closes the day sheet (L9)', !(await app.evaluate(() => document.querySelector('#daySheet').open)));
  const bg = await app.locator(`.cal-day[data-iso="${iso.today}"]`).evaluate(el => el.style.background);
  check('Calendar', 'today is shaded once something is ticked (L4)', /color-mix/.test(bg), bg);

  await app.click(`.cal-day[data-iso="${iso.today}"]`); await wait(300);
  const daily = () => app.locator('#sheetDaily li', { hasText: 'Standup notes' });
  await daily().locator('summary').click(); await daily().locator('button.delete').click(); await wait(400);
  const stopped = await byTitle('Standup notes');
  check('Day sheet', 'Stop repeating ends it before this day, keeps its ticks', stopped.repeat.until === iso.yesterday && stopped.doneDates.includes(iso.today) && await daily().count() === 0);
  await app.click('.toast button'); await wait(400);
  check('Day sheet', 'Stop repeating is undoable', (await byTitle('Standup notes')).repeat.until === null && await daily().count() === 1);
  await app.keyboard.press('Escape');
  await app.goto(`${X}/${PAGES.app}#day=${iso.tomorrow}`); await wait(700);
  check('App', '#day=YYYY-MM-DD opens that day’s sheet', await app.evaluate(() => document.querySelector('#daySheet').open) && await extra().count() === 1);
  await app.keyboard.press('Escape'); await wait(200);
  await app.screenshot({ path: shots + '/7-calendar.png' });
  await pan.reload(); await wait(600);
  check('Panel tasks', 'Today band lists daily tasks first (L1)', (await pan.locator('[data-band="today"] li .t-title').first().textContent()) === 'Standup notes');
}
```

- [ ] **Step 2: Run them from the harness**

In `test/e2e/full.mjs`, replace:

```js
await panelBandChecks(harness, pan);
```

with:

```js
await panelBandChecks(harness, pan);
const { calendarChecks, daySheetChecks } = await import('./app.mjs');
const app = await calendarChecks(harness, pan);
await daySheetChecks(harness, app, pan);
```

- [ ] **Step 3: Run the end-to-end suite to see it fail**

Run: `npm run e2e`

Expected: FAIL. `[Keys] O in the side panel opens the full app` and `[App] opens on the Calendar` fail (the new tab lands on Chrome's error page), and the run stops at the first calendar lookup.

- [ ] **Step 4: Create the app page**

Create `src/ui/app/app.html`. Task 6 adds the Tasks view, its nav button and the editor dialog.

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Weekly</title>
<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../components/tasks.css"><link rel="stylesheet" href="app.css"></head>
<body>
<header class="atop">
  <h1>Weekly</h1>
  <nav class="anav" aria-label="Weekly">
    <button id="nav-calendar" data-view="calendar">Calendar</button>
    <a id="nav-report" href="../report/report.html">Week report</a>
    <a id="nav-settings" href="../report/report.html#settings">Settings</a>
  </nav>
</header>

<main>
  <section id="view-calendar" class="view" aria-labelledby="calTitle">
    <div class="cal-head">
      <h2 id="calTitle"></h2>
      <div class="cal-nav">
        <button id="prevMonth" aria-label="Previous month">←</button>
        <button id="todayBtn">Today</button>
        <button id="nextMonth" aria-label="Next month">→</button>
      </div>
    </div>
    <div class="cal-labels" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
    <div id="calGrid" class="cal-grid"></div>
    <p class="hint">Shading shows how much of each day’s tasks got done. ← → change month, T jumps to today.</p>
  </section>
</main>

<dialog id="daySheet" aria-labelledby="sheetTitle">
  <div class="dlg-head">
    <div><h2 id="sheetTitle"></h2><p id="sheetSub" class="sub"></p></div>
    <button id="sheetClose" class="quiet" aria-label="Close">✕</button>
  </div>
  <div class="progress"><i id="sheetBar"></i></div>
  <h3>Daily tasks</h3>
  <ul id="sheetDaily" class="rows"></ul>
  <form id="dailyForm" class="addrow">
    <input id="dailyTitle" type="text" maxlength="200" placeholder="Add a daily task…" aria-label="New daily task">
    <select id="dailyDays" aria-label="Repeats on">
      <option value="weekdays">Weekdays</option>
      <option value="every">Every day</option>
    </select>
    <button>Add</button>
  </form>
  <h3>Extra tasks for this day</h3>
  <ul id="sheetExtras" class="rows"></ul>
  <form id="extraForm" class="addrow">
    <input id="extraTitle" type="text" maxlength="200" placeholder="Add a one-off task…" aria-label="New task for this day">
    <button>Add</button>
  </form>
  <h3>Notes</h3>
  <ul id="sheetNotes" class="notes"></ul>
  <form id="noteForm" class="addrow">
    <input id="dayNote" type="text" maxlength="1000" placeholder="What happened outside Chrome?" aria-label="Note for this day">
    <button>Add</button>
  </form>
</dialog>
<script type="module" src="app.js"></script>
</body></html>
```

- [ ] **Step 5: Create the app styles**

Create `src/ui/app/app.css`:

```css
/* The app tab: a ledger header, then one view at a time. */
.atop { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: end;
  padding: 22px clamp(16px, 4vw, 48px) 14px; border-bottom: 2px solid var(--ink); background: var(--sheet); }
h1 { font: 600 clamp(24px, 3vw, 34px)/1.1 var(--serif); margin: 0; }
h2 { font: 600 22px/1.2 var(--serif); margin: 0; }
.anav { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.anav button[aria-current="page"] { background: var(--marker-wash); border-color: var(--marker); color: var(--ink); }
.anav a { padding: 5px 10px; font-weight: 600; }
main { padding: 20px clamp(16px, 4vw, 48px) 60px; max-width: 1100px; }
.hint { color: var(--muted); font-size: 13px; }
.sub { margin: 4px 0 0; color: var(--muted); font-size: 13px; }

.cal-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.cal-nav { display: flex; gap: 6px; }
.cal-labels, .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.cal-labels span { color: var(--muted); font-size: 12px; text-align: center; }
.cal-day { position: relative; aspect-ratio: 1 / 0.8; display: flex; flex-direction: column; justify-content: space-between;
  align-items: start; padding: 6px 8px; border: 1px solid var(--rule); border-radius: 4px; background: var(--sheet); color: var(--ink); font-weight: 400; }
.cal-day .num { font: 600 16px/1 var(--serif); }
.cal-day .ratio { font-size: 11px; color: var(--marker-ink); font-variant-numeric: tabular-nums; }
.cal-day.future { color: var(--faint); background: transparent; }
.cal-day.today { outline: 2px solid var(--navy); outline-offset: 1px; }
.cal-day:hover { border-color: var(--navy); }

.progress { height: 6px; border-radius: 3px; background: var(--marker-wash); margin: 10px 0 4px; overflow: hidden; }
.progress i { display: block; height: 100%; background: var(--marker); }
.notes { list-style: none; margin: 0; padding: 0; }
.notes li { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--rule); }
@media (max-width: 560px) { .cal-day { aspect-ratio: auto; min-height: 48px; padding: 4px; } .cal-day .ratio { display: none; } }
```

- [ ] **Step 6: Create the month grid**

Create `src/ui/app/calendar-view.js`:

```js
// The month grid (spec L4): each day shaded by the share of its tasks done,
// marker wash → marker; today ringed; future days muted.
import { $, h, clear } from '../components/dom.js';
import { monthGrid } from '../../lib/tasks.js';
import { today, fromISODate, longDate } from '../../lib/dates.js';
import * as sheet from './day-sheet.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

const shown = { year: 0, month: 0 };
/** @type {Task[]} */
let last = [];

/** @param {import('../../lib/tasks.js').DayCell} c */
function cell(c) {
  const label = `${longDate(c.iso)}${c.total ? `: ${c.done} of ${c.total} done` : ''}`;
  return h('button', {
    class: ['cal-day', c.when === 'today' && 'today', c.when === 'future' && 'future'].filter(Boolean).join(' '),
    dataset: { iso: c.iso }, attrs: { 'aria-label': label },
    style: c.pct === null ? {} : { background: `color-mix(in srgb, var(--marker) ${c.pct}%, var(--marker-wash))` },
    on: { click: () => sheet.open(c.iso) },
  }, h('span', { class: 'num' }, String(c.day)), c.total && c.when !== 'future' ? h('span', { class: 'ratio' }, `${c.done}/${c.total}`) : null);
}

/** @param {Task[]} tasks */
export function render(tasks) {
  last = tasks;
  const { blanks, cells } = monthGrid(shown.year, shown.month, tasks, today());
  $('#calTitle').textContent = new Date(shown.year, shown.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const grid = $('#calGrid');
  clear(grid);
  grid.append(...Array.from({ length: blanks }, () => h('span', { class: 'cal-blank' })), ...cells.map(cell));
}

/** Show the month containing `iso`. @param {string} iso */
export function goTo(iso) {
  const d = fromISODate(iso) ?? new Date();
  shown.year = d.getFullYear();
  shown.month = d.getMonth();
  render(last);
}

export const goToday = () => goTo(today());

/** @param {number} n months */
export function step(n) {
  const d = new Date(shown.year, shown.month + n, 1);
  shown.year = d.getFullYear();
  shown.month = d.getMonth();
  render(last);
}

export function init() {
  const d = new Date();
  shown.year = d.getFullYear();
  shown.month = d.getMonth();
  $('#prevMonth').onclick = () => step(-1);
  $('#nextMonth').onclick = () => step(1);
  $('#todayBtn').onclick = goToday;
}
```

- [ ] **Step 7: Create the day sheet**

Create `src/ui/app/day-sheet.js`. Daily tasks are created with `repeat.days` = Mon–Fri ("Weekdays", the spec default) or all seven days. The note slot (L3) lists and adds Weekly 2 notes dated to that day, so they reach the update's "Other work"; Phase 4 swaps the store for day notes.

```js
// The day sheet (spec L5, L2, L3): daily tasks to tick for that day, extra
// tasks for that day (add, tick, delete, move or copy to another day), and the
// day's notes. A native <dialog>: Esc closes it (L9).
import { $, h, clear } from '../components/dom.js';
import { taskRow } from '../components/task-row.js';
import { add } from '../components/task-actions.js';
import { report } from '../components/undo.js';
import { recurringOn, extrasOn, dayCompletion, WORKWEEK } from '../../lib/tasks.js';
import { getWeekNotes, addWeekNote, deleteWeekNote, notesOn } from '../../lib/week-notes.js';
import { longDate, today } from '../../lib/dates.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

/** @type {string | null} */
let day = null;
/** @type {Task[]} */
let last = [];

const dialog = () => /** @type {HTMLDialogElement} */ ($('#daySheet'));
/** @param {string} sel */
const field = (sel) => /** @type {HTMLInputElement} */ ($(sel));

/** @param {HTMLElement} host @param {Task[]} list @param {string} iso @param {string} none */
function rows(host, list, iso, none) {
  clear(host);
  if (!list.length) host.append(h('li', { class: 'none' }, none));
  else host.append(...list.map((t) => taskRow(t, { day: iso, copy: true })));
}

async function renderNotes() {
  if (!day) return;
  const iso = day;
  const list = $('#sheetNotes');
  clear(list);
  list.append(...notesOn(await getWeekNotes(), iso).map((n) => h('li', {}, h('span', {}, n.text),
    h('button', { class: 'quiet', attrs: { 'aria-label': `Delete note: ${n.text}` },
      on: { click: () => deleteWeekNote(n.id).then(renderNotes, report) } }, '✕'))));
}

/** @param {Task[]} tasks */
export function render(tasks) {
  last = tasks;
  if (!day || !dialog().open) return;
  const iso = day;
  const { done, total } = dayCompletion(tasks, iso);
  $('#sheetTitle').textContent = longDate(iso);
  $('#sheetSub').textContent = total ? `${done} of ${total} done` : 'Nothing planned yet.';
  $('#sheetBar').style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
  rows($('#sheetDaily'), recurringOn(tasks, iso), iso, iso < today() ? 'No daily tasks ran on this day.' : 'No daily tasks yet. Add one below.');
  rows($('#sheetExtras'), extrasOn(tasks, iso), iso, 'No extra tasks for this day.');
}

/** @param {string} iso */
export function open(iso) {
  day = iso;
  if (!dialog().open) dialog().showModal();
  render(last);
  void renderNotes();
}

/** @param {string} sel @param {(title: string, iso: string) => Promise<boolean>} fn resolves false when nothing was saved */
function onAdd(sel, fn) {
  const form = /** @type {HTMLFormElement} */ ($(sel));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = /** @type {HTMLInputElement} */ (form.querySelector('input'));
    if (!day || !input.value.trim() || !(await fn(input.value, day))) return;
    input.value = '';
    input.focus();
  });
}

export function init() {
  $('#sheetClose').onclick = () => dialog().close();
  dialog().addEventListener('close', () => { day = null; if (location.hash.startsWith('#day=')) history.replaceState(null, '', '#calendar'); });
  onAdd('#dailyForm', (title) => add({ title, repeat: { days: field('#dailyDays').value === 'every' ? [0, 1, 2, 3, 4, 5, 6] : [...WORKWEEK] } }));
  onAdd('#extraForm', (title, iso) => add({ title, dueDate: iso }));
  onAdd('#noteForm', (text, iso) => addWeekNote(text, iso).then(() => renderNotes()).then(() => true, (e) => { report(e); return false; }));
}
```

- [ ] **Step 8: Create the app shell**

Create `src/ui/app/app.js`. Task 6 replaces it whole when the Tasks view arrives.

```js
// The full app tab (spec §3.2). The Calendar is a view here; the week report
// and its settings stay on the report page and are linked.
// Hash routes: #calendar (default), #day=YYYY-MM-DD (opens that day's sheet).
import { $ } from '../components/dom.js';
import { bindKeys, onNewDay } from '../components/keys.js';
import { getTasks } from '../../lib/tasks.js';
import { onTasksChanged } from '../../lib/storage.js';
import { isValidISODate } from '../../lib/dates.js';
import * as calendar from './calendar-view.js';
import * as sheet from './day-sheet.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

/** @type {Task[]} */
let tasks = [];

function render() {
  calendar.render(tasks);
  sheet.render(tasks);
}

function route() {
  const day = location.hash.match(/^#day=(\d{4}-\d{2}-\d{2})$/)?.[1];
  render();
  if (day && isValidISODate(day)) { calendar.goTo(day); sheet.open(day); }
  else history.replaceState(null, '', '#calendar');
}

async function init() {
  $('#nav-calendar').setAttribute('aria-current', 'page');
  calendar.init();
  sheet.init();
  bindKeys({
    t: () => calendar.goToday(),
    ArrowLeft: () => calendar.step(-1),
    ArrowRight: () => calendar.step(1),
  });
  onNewDay(render);
  window.addEventListener('hashchange', route);
  onTasksChanged((next) => { tasks = next; render(); });
  tasks = await getTasks();
  route();
}

void init();
```

- [ ] **Step 9: Let the build accept links with a fragment**

The app links to `../report/report.html#settings`; without this the build reports `report.html#settings` as a missing file.

In `scripts/build.mjs`, replace:

```js
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) if (!external.test(ref)) refs.push(join(dirname(f), ref));
```

with:

```js
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) if (!external.test(ref)) refs.push(join(dirname(f), ref.replace(/[?#].*$/, '')));
```

- [ ] **Step 10: Link the report to the app**

In `src/ui/report/report.html`, replace:

```html
    <button id="openSettings" class="quiet">Settings</button>
```

with:

```html
    <button id="openSettings" class="quiet">Settings</button>
    <a id="openApp" class="quiet" href="../app/app.html">Tasks and calendar</a>
```

- [ ] **Step 11: Open the report's Settings from `#settings`**

In `src/ui/report/main.js`, replace:

```js
import { renderHistBanner } from './history-panel.js';
```

with:

```js
import { renderHistBanner } from './history-panel.js';
import { openSettings } from './settings-panel.js';
```

In `src/ui/report/main.js`, replace:

```js
  // ponytail: direct storage until lib/storage.js (Phase 2)
  chrome.storage.local.remove('excluded');
```

with:

```js
  if (location.hash === '#settings') openSettings();
  // ponytail: direct storage until lib/storage.js (Phase 2)
  chrome.storage.local.remove('excluded');
```

`settings-panel.js` already imports `main.js`; the cycle is safe because neither module touches the other's exports at load time (Phase 1 rule).

- [ ] **Step 12: Run the unit tests, the typecheck and the end-to-end suite**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 197`, `# fail 0` in both timezones; `tsc` exits 0; e2e `151/151 passed`, including every `[Calendar]` and `[Day sheet]` check, `[Keys] Esc closes the day sheet (L9)` and `[Panel tasks] Today band lists daily tasks first (L1)`.

---

### Task 6: App tab: Tasks view with search, filter, edit and undo

**Files:**
- Create: `src/ui/app/tasks-view.js`, `src/ui/app/task-editor.js`
- Modify: `src/ui/app/app.html` (nav button, Tasks section, editor dialog), `src/ui/app/app.css` (append)
- Replace: `src/ui/app/app.js`; Modify: `src/ui/app/day-sheet.js` (Edit… in its rows)
- Create: `test/e2e/app-tasks.mjs`; Modify: `test/e2e/full.mjs`

**Interfaces:**
- Consumes (2a): `sectionsFor`, `viewCounts`, `search`, `filterPriority`, `updateTask` (tasks.js); `getUiState`, `updateUiState` (storage.js). Consumes (Task 4): `renderBands`, `taskRow`, `add`, `toast`, `bindKeys`.
- Produces (`src/ui/app/tasks-view.js`): `init()`, `render(tasks)`, `focusAdd()`, `focusSearch()`. Views: Today, Week (rolling 7 days of collapsible day bands, state in `uiState`), Overdue, Upcoming, All open, Completed; `#q` search (title and description), `#pfilter` priority filter, `#taskAdd` one-line add.
- Produces (`src/ui/app/task-editor.js`): `init()`, `openEditor(task)` (title, description, priority, due date; Save offers Undo).
- Produces (`src/ui/app/app.js`): routes `#calendar`, `#tasks`, `#day=YYYY-MM-DD`; keys N (Tasks add box), / (search), T and ← → (calendar only).

- [ ] **Step 1: Write the Tasks view checks**

Create `test/e2e/app-tasks.mjs`:

```js
// The app's Tasks view: views, search, filter, edit, delete + undo, keys, links (D2–D6, D10).
import { unlabeled } from './panel.mjs';

export async function taskViewChecks(t, app) {
  const { check, store, wait, iso } = t;
  const byTitle = async title => ((await store()).tasks ?? []).find(x => x.title === title);
  const rows = async () => (await app.locator('#taskList li.row .t-title').allTextContents());
  const view = async id => { await app.click(`#taskViews [data-view="${id}"]`); await wait(250); };
  await app.click('#nav-tasks'); await wait(400);
  check('Tasks', 'Tasks view with Daybook’s views and counts (D3)', app.url().endsWith('#tasks') &&
    (await app.locator('#taskViews button').allTextContents()).map(s => s.replace(/\d+$/, '')).join(',') === 'Today,Week,Overdue,Upcoming,All open,Completed');
  await app.fill('#taskTitle', 'Book travel'); await app.press('#taskTitle', 'Enter'); await wait(400);
  check('Tasks', 'one-line add in the app (D2)', (await byTitle('Book travel'))?.dueDate === iso.today && (await rows()).includes('Book travel'));
  await app.fill('#q', 'acme'); await wait(250); await view('open');
  check('Tasks', 'search filters by title (D4)', (await rows()).join('|') === 'Call Acme Corp about renewal', (await rows()).join('|'));
  await app.press('#q', 'Escape'); await wait(200);
  check('Tasks', 'Esc clears the search', (await app.inputValue('#q')) === '' && (await rows()).length > 1);
  await app.selectOption('#pfilter', 'high'); await wait(250);
  check('Tasks', 'priority filter (D4)', (await rows()).join('|') === 'Call Acme Corp about renewal', (await rows()).join('|'));
  await app.selectOption('#pfilter', 'all'); await wait(200);
}

// Week bands, edit, delete + ⌘Z, Completed, keys, layout, the Settings link.
export async function taskEditChecks(t, app) {
  const { check, store, wait, iso } = t;
  const byTitle = async title => ((await store()).tasks ?? []).find(x => x.title === title);
  const rows = async () => (await app.locator('#taskList li.row .t-title').allTextContents());
  const view = async id => { await app.click(`#taskViews [data-view="${id}"]`); await wait(250); };
  await view('week');
  const tomorrowBand = app.locator(`details[data-band="${iso.tomorrow}"]`);
  check('Tasks', 'Week: a rolling 7 days of day bands, later days collapsed (D3)', await app.locator('#taskList details[data-band]').count() >= 7 && (await tomorrowBand.getAttribute('open')) === null);
  await tomorrowBand.locator(':scope > summary').click(); await wait(300);
  check('Tasks', 'opening a day band is remembered (uiState)', (await store()).uiState.dayState[iso.tomorrow] === 'open');
  await view('open');
  const acme = () => app.locator('#taskList li.row', { hasText: 'Call Acme' });
  await acme().locator('summary').click(); await acme().locator('button.edit').click(); await wait(200);
  await app.fill('#eTitle', 'Call Acme Corp about the renewal'); await app.fill('#eDesc', 'Bring the Q4 numbers');
  await app.selectOption('#ePriority', 'low'); await app.click('#eSave'); await wait(400);
  const edited = await byTitle('Call Acme Corp about the renewal');
  check('Tasks', 'edit title, description and priority (D5)', edited?.description === 'Bring the Q4 numbers' && edited.priority === 'low', JSON.stringify(edited));
  await app.fill('#q', 'Q4 numbers'); await wait(250);
  check('Tasks', 'search covers descriptions (D4)', (await rows()).join('|') === 'Call Acme Corp about the renewal');
  await app.fill('#q', ''); await wait(200);
  await acme().locator('summary').click(); await acme().locator('button.delete').click(); await wait(400);
  check('Tasks', 'delete (D5)', !(await byTitle('Call Acme Corp about the renewal')));
  await app.evaluate(() => document.activeElement?.blur());
  await app.keyboard.press('ControlOrMeta+z'); await wait(400);
  check('Tasks', '⌘Z / Ctrl+Z undoes a delete (D6)', (await byTitle('Call Acme Corp about the renewal'))?.id === edited.id);
  await view('completed');
  check('Tasks', 'Completed view lists closed tasks', (await rows()).includes('Ship the login fix'));
  await app.evaluate(() => document.activeElement?.blur());
  await app.keyboard.press('/');
  check('Keys', '/ focuses search (app)', await app.evaluate(() => document.activeElement?.id === 'q'));
  await app.evaluate(() => document.activeElement?.blur());
  await app.click('#nav-calendar'); await app.keyboard.press('n');
  check('Keys', 'N goes to the add box from anywhere in the app', await app.evaluate(() => document.activeElement?.id === 'taskTitle') && app.url().endsWith('#tasks'));
  check('Layout', 'every app control has a label', (await unlabeled(app)).length === 0, (await unlabeled(app)).join(', '));
  await app.setViewportSize({ width: 400, height: 900 }); await wait(200);
  check('Layout', 'app: no sideways scrolling at phone width', await app.evaluate(() => document.documentElement.scrollWidth <= 400));
  await app.setViewportSize({ width: 1280, height: 900 });
  await app.click('#nav-settings'); await wait(900);
  check('App', 'Settings link opens the report’s settings', app.url().includes('report.html#settings') && await app.isVisible('#role'));
  await app.close();
}
```

- [ ] **Step 2: Run them from the harness**

In `test/e2e/full.mjs`, replace:

```js
await daySheetChecks(harness, app, pan);
```

with:

```js
await daySheetChecks(harness, app, pan);
const { taskViewChecks, taskEditChecks } = await import('./app-tasks.mjs');
await taskViewChecks(harness, app);
await taskEditChecks(harness, app);
```

- [ ] **Step 3: Run the end-to-end suite to see it fail**

Run: `npm run e2e`

Expected: FAIL. The run stops with a `TimeoutError` at the first `#nav-tasks` click.

- [ ] **Step 4: Add the Tasks view and the editor to the page**

In `src/ui/app/app.html`, replace:

```html
    <button id="nav-calendar" data-view="calendar">Calendar</button>
```

with:

```html
    <button id="nav-calendar" data-view="calendar">Calendar</button>
    <button id="nav-tasks" data-view="tasks">Tasks</button>
```

In `src/ui/app/app.html`, replace:

```html
  </section>
</main>
```

with:

```html
  </section>

  <section id="view-tasks" class="view" aria-label="Tasks" hidden>
    <nav id="taskViews" class="tviews" aria-label="Task views"></nav>
    <div class="tmain">
      <div class="tools">
        <input id="q" type="search" placeholder="Search tasks ( / )" aria-label="Search tasks" autocomplete="off">
        <select id="pfilter" aria-label="Filter by priority">
          <option value="all">All priorities</option>
          <option value="high">High only</option>
          <option value="medium">Medium only</option>
          <option value="low">Low only</option>
        </select>
      </div>
      <form id="taskAdd" class="addrow">
        <input id="taskTitle" type="text" maxlength="200" placeholder="Add a task for today… ( N )" aria-label="New task for today">
        <button class="primary">Add</button>
      </form>
      <div id="taskList"></div>
    </div>
  </section>
</main>
```

In `src/ui/app/app.html`, replace:

```html
</dialog>
<script type="module" src="app.js"></script>
```

with:

```html
</dialog>

<dialog id="editor" aria-labelledby="editorTitle">
  <form id="editorForm" method="dialog">
    <h2 id="editorTitle">Edit task</h2>
    <label class="field">Title <input id="eTitle" type="text" maxlength="200" required></label>
    <label class="field">Description <textarea id="eDesc" rows="4" maxlength="2000"></textarea></label>
    <label class="field">Priority
      <select id="ePriority"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
    <label class="field">Due date <input id="eDue" type="date"></label>
    <div class="dlg-foot">
      <button id="eCancel" value="cancel" formnovalidate>Cancel</button>
      <button id="eSave" value="save" class="primary">Save</button>
    </div>
  </form>
</dialog>
<script type="module" src="app.js"></script>
```

- [ ] **Step 5: Style the Tasks view**

Append to `src/ui/app/app.css`:

```css

.tviews { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
.tviews button { display: flex; gap: 6px; }
.tviews button[aria-current="true"] { background: var(--marker-wash); border-color: var(--marker); color: var(--ink); }
.tviews .n { color: var(--muted); font-weight: 400; font-variant-numeric: tabular-nums; }
.tviews button.alert .n { color: var(--danger); }
.tools { display: flex; gap: 8px; margin-bottom: 8px; }
.tools input { flex: 1; }
#taskAdd { margin-bottom: 14px; }
.field { display: grid; gap: 4px; margin-top: 10px; font-size: 13px; color: var(--muted); }
```

- [ ] **Step 6: Create the editor**

Create `src/ui/app/task-editor.js`:

```js
// Edit a task's title, description, priority and due date (spec D5).
import { $ } from '../components/dom.js';
import { updateTask } from '../../lib/tasks.js';
import { toast } from '../components/undo.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

/** @type {Task | null} */
let editing = null;
const dialog = () => /** @type {HTMLDialogElement} */ ($('#editor'));
/** @param {string} sel */
const field = (sel) => /** @type {HTMLInputElement} */ ($(sel));

/** @param {Task} t */
export function openEditor(t) {
  editing = t;
  field('#eTitle').value = t.title;
  field('#eDesc').value = t.description;
  field('#ePriority').value = t.priority;
  field('#eDue').value = t.dueDate ?? '';
  field('#eDue').closest('label')?.toggleAttribute('hidden', t.repeat !== null);
  dialog().returnValue = '';   // Esc keeps the last returnValue; never let it read as "save"
  if (!dialog().open) dialog().showModal();
  field('#eTitle').focus();
}

async function save() {
  const t = editing;
  editing = null;
  if (!t || dialog().returnValue !== 'save') return;
  const before = { title: t.title, description: t.description, priority: t.priority, dueDate: t.dueDate };
  await updateTask(t.id, { title: field('#eTitle').value, description: field('#eDesc').value,
    priority: /** @type {Task['priority']} */ (field('#ePriority').value), dueDate: field('#eDue').value || null });
  toast('Saved.', () => updateTask(t.id, before));
}

export function init() {
  dialog().addEventListener('close', () => void save());
}
```

- [ ] **Step 7: Create the Tasks view**

Create `src/ui/app/tasks-view.js`:

```js
// The Tasks view (spec D3, D4, D5): Daybook's views with counts, search, a
// priority filter, one-line add, and rows whose ⋯ menu edits, moves and deletes.
import { $, h, clear } from '../components/dom.js';
import { renderBands } from '../components/bands.js';
import { taskRow } from '../components/task-row.js';
import { add } from '../components/task-actions.js';
import { sectionsFor, viewCounts, search, filterPriority } from '../../lib/tasks.js';
import { getUiState, updateUiState } from '../../lib/storage.js';
import { today } from '../../lib/dates.js';
import { openEditor } from './task-editor.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {import('../../lib/tasks.js').ViewId} ViewId */
/** @typedef {import('../../lib/tasks.js').Priority} Priority */

/** @type {{ id: ViewId, label: string, alert?: boolean }[]} */
const VIEWS = [
  { id: 'today', label: 'Today' }, { id: 'week', label: 'Week' }, { id: 'overdue', label: 'Overdue', alert: true },
  { id: 'upcoming', label: 'Upcoming' }, { id: 'open', label: 'All open' }, { id: 'completed', label: 'Completed' },
];
/** @type {Record<ViewId, string>} */
const EMPTY = { today: 'Nothing due today.', week: 'Nothing due this week.', overdue: 'Nothing overdue.',
  upcoming: 'Nothing scheduled ahead.', open: 'Nothing open.', completed: 'Nothing completed yet.' };

/** @type {{ view: ViewId, query: string, priority: Priority | 'all', dayState: Record<string, 'open' | 'closed'> }} */
const ui = { view: 'today', query: '', priority: 'all', dayState: {} };
/** @type {Task[]} */
let last = [];

/** @param {Task[]} tasks */
function renderNav(tasks) {
  const counts = viewCounts(tasks, today());
  const nav = $('#taskViews');
  clear(nav);
  nav.append(...VIEWS.map((v) => h('button', { class: v.alert ? 'alert' : '', dataset: { view: v.id },
    attrs: { 'aria-current': String(v.id === ui.view) }, on: { click: () => { ui.view = v.id; render(last); } } },
  v.label, h('span', { class: 'n' }, String(counts[v.id])))));
}

/** @param {Task[]} tasks */
export function render(tasks) {
  last = tasks;
  renderNav(tasks);
  const day = today();
  const visible = filterPriority(search(tasks.filter((t) => t.repeat === null), ui.query), ui.priority);
  const bands = sectionsFor(visible, ui.view, day);
  const blank = ui.view === 'week' ? bands.every((b) => !b.tasks.length) : !bands.length;
  if (blank) {
    clear($('#taskList'));
    $('#taskList').append(h('p', { class: 'none' }, ui.query ? `Nothing matches “${ui.query}”.` : EMPTY[ui.view]));
    return;
  }
  renderBands($('#taskList'), bands, (t) => taskRow(t, { day, copy: true, onEdit: openEditor }), {
    isOpen: (b) => (b.key && ui.dayState[b.key] ? ui.dayState[b.key] === 'open' : b.defaultOpen ?? true),
    onToggle: (key, open) => { ui.dayState = { ...ui.dayState, [key]: open ? 'open' : 'closed' }; void updateUiState({ dayState: ui.dayState }); },
    empty: 'Nothing on this day.',
  });
}

export const focusAdd = () => $('#taskTitle').focus();
export const focusSearch = () => $('#q').focus();

export function init() {
  const q = /** @type {HTMLInputElement} */ ($('#q'));
  q.addEventListener('input', () => { ui.query = q.value; render(last); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape' && q.value) { e.preventDefault(); q.value = ''; ui.query = ''; render(last); } });
  const pf = /** @type {HTMLSelectElement} */ ($('#pfilter'));
  pf.addEventListener('change', () => { ui.priority = /** @type {Priority | 'all'} */ (pf.value); render(last); });
  $('#taskAdd').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = /** @type {HTMLInputElement} */ ($('#taskTitle'));
    if (input.value.trim() && await add({ title: input.value, dueDate: today() })) input.value = '';
  });
  void getUiState().then((s) => { ui.dayState = s.dayState; });
}
```

- [ ] **Step 8: Route between Calendar and Tasks**

Replace the whole of `src/ui/app/app.js` with:

```js
// The full app tab (spec §3.2). Calendar and Tasks are views here; the week
// report and its settings stay on the report page and are linked.
// Hash routes: #calendar (default), #tasks, #day=YYYY-MM-DD (opens that day's sheet).
import { $, $$ } from '../components/dom.js';
import { bindKeys, onNewDay } from '../components/keys.js';
import { getTasks } from '../../lib/tasks.js';
import { onTasksChanged } from '../../lib/storage.js';
import { isValidISODate } from '../../lib/dates.js';
import * as calendar from './calendar-view.js';
import * as tasksView from './tasks-view.js';
import * as sheet from './day-sheet.js';
import * as editor from './task-editor.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {'calendar' | 'tasks'} View */

/** @type {{ tasks: Task[], view: View }} */
const state = { tasks: [], view: 'calendar' };

function render() {
  if (state.view === 'calendar') calendar.render(state.tasks);
  else tasksView.render(state.tasks);
  sheet.render(state.tasks);
}

/** @param {View} view @param {boolean} [keepHash] */
function show(view, keepHash = false) {
  state.view = view;
  for (const v of /** @type {View[]} */ (['calendar', 'tasks'])) {
    $(`#view-${v}`).hidden = v !== view;
    if (v === view) $(`#nav-${v}`).setAttribute('aria-current', 'page');
    else $(`#nav-${v}`).removeAttribute('aria-current');
  }
  if (!keepHash) history.replaceState(null, '', `#${view}`);
  render();
}

function route() {
  const day = location.hash.match(/^#day=(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (day && isValidISODate(day)) { show('calendar', true); calendar.goTo(day); sheet.open(day); return; }
  show(location.hash === '#tasks' ? 'tasks' : 'calendar');
}

async function init() {
  $$('.anav button').forEach((b) => b.addEventListener('click', () => show(/** @type {View} */ (b.dataset['view']))));
  calendar.init();
  tasksView.init();
  sheet.init();
  editor.init();
  bindKeys({
    n: () => { show('tasks'); tasksView.focusAdd(); },
    '/': () => { show('tasks'); tasksView.focusSearch(); },
    t: () => { if (state.view === 'calendar') calendar.goToday(); },
    ArrowLeft: () => { if (state.view === 'calendar') calendar.step(-1); },
    ArrowRight: () => { if (state.view === 'calendar') calendar.step(1); },
  });
  onNewDay(render);
  window.addEventListener('hashchange', route);
  onTasksChanged((next) => { state.tasks = next; render(); });
  state.tasks = await getTasks();
  route();
}

void init();
```

- [ ] **Step 9: Offer Edit… in the day sheet too**

In `src/ui/app/day-sheet.js`, replace:

```js
import { longDate, today } from '../../lib/dates.js';
```

with:

```js
import { longDate, today } from '../../lib/dates.js';
import { openEditor } from './task-editor.js';
```

In `src/ui/app/day-sheet.js`, replace:

```js
taskRow(t, { day: iso, copy: true })
```

with:

```js
taskRow(t, { day: iso, copy: true, onEdit: openEditor })
```

- [ ] **Step 10: Run the unit tests, the typecheck and the end-to-end suite**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 197`, `# fail 0` in both timezones; `tsc` exits 0; e2e `168/168 passed`, including every `[Tasks]` check, `[Keys] / focuses search (app)`, `[Layout] every app control has a label` and `[App] Settings link opens the report’s settings`.

---

### Task 7: Done section in the weekly update

**Files:**
- Modify: `src/lib/report/draft.js` (`DoneTasks`, `recurringLabel`, `doneLines`, `buildWeekly({done})`)
- Create: `test/report/draft-done.test.js`
- Modify: `src/ui/report/main.js` (load tasks, `W.done`, live reload), `src/ui/report/draft-panel.js:31`, `src/ui/report/categories-view.js`, `src/ui/report/report.html` (helper text)
- Create: `test/e2e/done.mjs`; Modify: `test/e2e/full.mjs`

**Interfaces:**
- Consumes (Task 1): `doneRange`, `doneKey`, `withoutExcluded` (tasks.js). Consumes (2a): `doneInRange` (tasks.js), `onTasksChanged` (storage.js).
- Produces (`src/lib/report/draft.js`): `buildWeekly({..., done?: DoneTasks})`; `DoneTasks = {oneOffs: {title}[], recurring: {task: {title}, done, of}[]}`; `recurringLabel(r) → "Standup notes (4 of 5 days)"`. The Done section comes first, one-offs then recurring; `hideNames` never touches it.
- Produces (report): `W.done` (this week's `doneInRange` over `doneRange(monday)`); Done rows are tickable with `data-key="task:<id>"`, stored in the same `excluded:<monday>` list as other items.

- [ ] **Step 1: Write the failing Done tests**

Create `test/report/draft-done.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekly } from '../../src/lib/report/draft.js';

const item = (key, category, task, ms) => ({ key, category, task, ms, days: new Set([0]), tickets: new Set() });
const done = {
  oneOffs: [{ title: 'Ship the login fix' }, { title: 'Call Acme Corp about renewal' }],
  recurring: [{ task: { title: 'Standup notes' }, done: 5, of: 5 }, { task: { title: 'Inbox zero' }, done: 1, of: 1 }],
};

test('the Done section leads the update: one-offs, then recurring with their counts', () => {
  const md = buildWeekly({ rangeLabel: 'Oct 26 to Oct 30', items: [item('jira:ENGX-1', 'Tickets', 'ENGX-1: Fix login', 36e5)], done });
  assert.match(md, /^## Weekly update: Oct 26 to Oct 30\n\n### Done\n- Ship the login fix\n- Call Acme Corp about renewal\n- Standup notes \(5 of 5 days\)\n- Inbox zero \(1 of 1 day\)\n\n### Tickets\n/);
});

test('hiding names never touches task titles: they are the user’s own words', () => {
  const md = buildWeekly({ rangeLabel: 'x', items: [item('app:c', 'Sales & CRM', 'Acme Corp renewal', 1e6)], done, hideNames: true });
  assert.match(md, /- Call Acme Corp about renewal/);
  assert.match(md, /### Sales and customers\n- Customer 1/);
});

test('no Done section when nothing was done, and a Done-only week is not "empty"', () => {
  assert.doesNotMatch(buildWeekly({ rangeLabel: 'x', items: [], done: { oneOffs: [], recurring: [] } }), /### Done/);
  const md = buildWeekly({ rangeLabel: 'x', items: [], done: { oneOffs: [{ title: 'Wrote the spec' }], recurring: [] } });
  assert.match(md, /### Done\n- Wrote the spec\n$/);
  assert.doesNotMatch(md, /No work-related activity/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run test:ny`

Expected: 3 failures in `draft-done.test.js`: `buildWeekly` ignores `done`.

- [ ] **Step 3: Build the Done section**

In `src/lib/report/draft.js`, replace:

```js
/** @typedef {{ text: string }} Note */
```

with:

```js
/** @typedef {{ text: string }} Note */
/** @typedef {{ oneOffs: { title: string }[], recurring: { task: { title: string }, done: number, of: number }[] }} DoneTasks */
```

In `src/lib/report/draft.js`, replace:

```js
// People and customers become numbered stand-ins
```

with:

```js
/** "Standup notes (4 of 5 days)". @param {DoneTasks['recurring'][number]} r */
export const recurringLabel = r => `${r.task.title} (${r.done} of ${r.of} day${r.of === 1 ? '' : 's'})`;

// Tasks completed in the week lead the update (spec §3.2). Titles are the user's own words: never anonymised.
/** @param {DoneTasks | undefined} done @returns {string[]} */
function doneLines(done) {
  if (!done || !done.oneOffs.length && !done.recurring.length) return [];
  return ['### Done', ...done.oneOffs.map(t => `- ${t.title}`), ...done.recurring.map(r => `- ${recurringLabel(r)}`), ''];
}

// People and customers become numbered stand-ins
```

In `src/lib/report/draft.js`, replace:

```js
/**
 * @param {{ rangeLabel: string, items: Item[], notes?: Note[], showTime?: boolean, status?: Record<string, string>, hideNames?: boolean }} opts
 * @returns {string}
 */
export function buildWeekly({ rangeLabel, items, notes = [], showTime, status, hideNames = false }) {
  const body = [...workLines(hideNames ? anonymize(items) : items, { showTime, status }), ...notesLines(notes)];
```

with:

```js
/**
 * @param {{ rangeLabel: string, items: Item[], notes?: Note[], done?: DoneTasks, showTime?: boolean, status?: Record<string, string>, hideNames?: boolean }} opts
 * @returns {string}
 */
export function buildWeekly({ rangeLabel, items, notes = [], done, showTime, status, hideNames = false }) {
  const body = [...doneLines(done), ...workLines(hideNames ? anonymize(items) : items, { showTime, status }), ...notesLines(notes)];
```

- [ ] **Step 4: Run the unit tests and the typecheck**

Run: `npm test && npm run typecheck`

Expected: `# fail 0` in both timezones, including `draft-done.test.js` (3) and the unchanged `draft.test.js`; `tsc` exits 0.

- [ ] **Step 5: Write the Done end-to-end checks**

Create `test/e2e/done.mjs`. The report covers Monday to Friday, so `redate()` moves today's ticks onto `workday` (today on a weekday, Friday at the weekend), the same way the harness already moves tracked time.

```js
// The Done section of the weekly update (spec §3.2, W2), on the report page.
export async function doneChecks(t, rep, pan) {
  const { sw, check, store, wait, workday, iso } = t;
  // The report covers Mon–Fri. Re-date today's ticks onto `workday` (today on a weekday, Friday at the weekend).
  const redate = () => sw.evaluate(async ({ wd, today }) => {
    const { tasks } = await chrome.storage.local.get('tasks');
    const noon = new Date(`${wd}T12:00:00`).getTime();
    for (const x of tasks) {
      if (x.completedAt && new Date(x.completedAt).toDateString() === new Date(`${today}T12:00:00`).toDateString()) x.completedAt = noon;
      if (x.repeat) { x.repeat.from = x.repeat.from > wd ? wd : x.repeat.from; x.doneDates = x.doneDates.map(d => (d === today ? wd : d)); }
    }
    await chrome.storage.local.set({ tasks });
  }, { wd: workday, today: iso.today });
  await redate(); await rep.bringToFront(); await rep.reload(); await wait(1500);
  const first = rep.locator('#categories .cat').first();
  check('Done', 'Done leads the activity list, tickable like other items', (await first.locator('h3').textContent()) === 'Done' && await first.locator('input[data-key^="task:"]').count() >= 2);
  let md = await rep.inputValue('#md');
  check('Done', 'draft opens with a Done section: one-offs, then recurring with its count (W2)', /^## Weekly update: .*\n\n### Done\n- Ship the login fix\n- Standup notes \(1 of 1 day\)\n/.test(md), md.slice(0, 200));
  const ship = ((await store()).tasks).find(x => x.title === 'Ship the login fix');
  await rep.uncheck(`input[data-key="task:${ship.id}"]`); await wait(400);
  md = await rep.inputValue('#md');
  check('Done', 'unticking a Done item drops it from this week’s draft', !md.includes('- Ship the login fix') && md.includes('Standup notes (1 of 1 day)'));
  check('Done', 'the untick is stored with the week’s exclusions', Object.entries(await store()).some(([k, v]) => k.startsWith('excluded:') && v.includes(`task:${ship.id}`)));
  await rep.check(`input[data-key="task:${ship.id}"]`); await wait(400);
  await rep.check('#anonymize'); await wait(400);
  check('Done', 'hide names leaves task titles as written; the hint says so', (await rep.inputValue('#md')).includes('- Ship the login fix') && /tasks and notes appear as you wrote them/.test(await rep.textContent('#anonHint')));
  await rep.uncheck('#anonymize'); await wait(300);
  // Another context (here the worker) reopens the task: the open report must follow without a reload.
  const setShip = done => sw.evaluate(async ({ id, done, wd }) => {
    const { tasks } = await chrome.storage.local.get('tasks');
    const x = tasks.find(y => y.id === id);
    x.status = done ? 'done' : 'open'; x.completedAt = done ? new Date(`${wd}T12:00:00`).getTime() : null;
    await chrome.storage.local.set({ tasks });
  }, { id: ship.id, done, wd: workday });
  await setShip(false); await wait(1200);
  check('Done', 'an open report follows task changes made elsewhere', !(await rep.inputValue('#md')).includes('- Ship the login fix'));
  await setShip(true); await wait(1200);
  check('Done', 'and puts the task back when it is ticked again', (await rep.inputValue('#md')).includes('- Ship the login fix'));
  await pan.bringToFront(); await pan.click('#tab-week'); await wait(500);
  check('Done', 'side panel Week tab: tasks done this week, daily ticks counted per day', /^2 tasks done this week$/.test(await pan.textContent('#doneCount')), await pan.textContent('#doneCount'));
  await pan.click('#tab-today');
}
```

- [ ] **Step 6: Run them after the report checks**

In `test/e2e/full.mjs`, replace:

```js
// ===== 6. Settings =====
```

with:

```js
// ===== 5b. Done section =====
const { doneChecks } = await import('./done.mjs');
await doneChecks(harness, rep, pan);

// ===== 6. Settings =====
```

- [ ] **Step 7: Run the end-to-end suite to see it fail**

Run: `npm run e2e`

Expected: FAIL. `[Done] Done leads the activity list, tickable like other items` and `[Done] draft opens with a Done section…` fail, and the run stops at the first Done checkbox.

- [ ] **Step 8: Load this week's Done tasks with the report**

In `src/ui/report/main.js`, replace:

```js
import { showDraft, refreshDraft } from './draft-panel.js';
```

with:

```js
import { showDraft, refreshDraft } from './draft-panel.js';
import { getTasks, doneInRange, doneRange } from '../../lib/tasks.js';
import { onTasksChanged } from '../../lib/storage.js';
```

In `src/ui/report/main.js`, replace:

```js
  const [range, settings, st] = await Promise.all([loadRange(start, WORK_DAYS), getSettings(), chrome.storage.local.get(['notes', wk, 'shareOk'])]);
  const end = shiftDate(start, WORK_DAYS);
```

with:

```js
  const [range, settings, st, tasks] = await Promise.all([loadRange(start, WORK_DAYS), getSettings(), chrome.storage.local.get(['notes', wk, 'shareOk']), getTasks()]);
  const end = shiftDate(start, WORK_DAYS);
  const { from, to } = doneRange(dayKey(start));
```

In `src/ui/report/main.js`, replace:

```js
  W = { ...range, end, notes, settings, excluded: new Set(st[wk] || []), shareOk: st.shareOk || {} };
```

with:

```js
  // Tasks done this week (spec §3.2): the Done section and its tickable rows.
  const done = to < from ? { oneOffs: [], recurring: [] } : doneInRange(tasks, from, to);
  W = { ...range, end, notes, done, settings, excluded: new Set(st[wk] || []), shareOk: st.shareOk || {} };
```

In `src/ui/report/main.js`, replace:

```js
  if (location.hash === '#settings') openSettings();
```

with:

```js
  onTasksChanged(() => { clearTimeout(reloadT); reloadT = setTimeout(() => load(false), 300); });
  if (location.hash === '#settings') openSettings();
```

- [ ] **Step 9: Pass the ticked Done items to the draft**

In `src/ui/report/draft-panel.js`, replace:

```js
import { buildWeekly, buildStandup } from '../../lib/report/draft.js';
```

with:

```js
import { buildWeekly, buildStandup } from '../../lib/report/draft.js';
import { withoutExcluded } from '../../lib/tasks.js';
```

In `src/ui/report/draft-panel.js`, replace:

```js
      notes: W.notes, showTime: $('#incTime').checked,
```

with:

```js
      notes: W.notes, done: withoutExcluded(W.done, W.excluded), showTime: $('#incTime').checked,
```

- [ ] **Step 10: List Done first, tickable like other items**

In `src/ui/report/categories-view.js`, replace:

```js
import { WEEKDAYS, KNOWN } from '../../lib/report/draft.js';
```

with:

```js
import { WEEKDAYS, KNOWN, recurringLabel } from '../../lib/report/draft.js';
```

In `src/ui/report/categories-view.js`, replace:

```js
import { refreshDraft } from './draft-panel.js';
```

with:

```js
import { refreshDraft } from './draft-panel.js';
import { doneKey } from '../../lib/tasks.js';
```

In `src/ui/report/categories-view.js`, replace:

```js
export function renderCategories(W, statuses) {
  const el = $('#categories');
  clear(el);
  const items = aboveMin(W.merged);
```

with:

```js
// Tasks done this week, tickable like any other item (spec §3.2).
function doneSection(W) {
  const rows = [...W.done.oneOffs.map(t => [t, t.title]), ...W.done.recurring.map(r => [r.task, recurringLabel(r)])];
  if (!rows.length) return null;
  return h('section', { class: 'cat done' },
    h('div', { class: 'cat-head' }, h('h3', {}, 'Done'), h('span', {}, `${rows.length} task${rows.length === 1 ? '' : 's'}`)),
    rows.map(([t, label]) => {
      const off = W.excluded.has(doneKey(t));
      return h('div', { class: off ? 'item off' : 'item' },
        h('input', { type: 'checkbox', dataset: { key: doneKey(t) }, checked: !off, attrs: { 'aria-label': 'Include in update' } }),
        h('span', { class: 'task' }, label), h('span', { class: 'meta' }));
    }));
}

export function renderCategories(W, statuses) {
  const el = $('#categories');
  clear(el);
  const items = aboveMin(W.merged);
  const done = doneSection(W);
  if (done) el.append(done);
```

The existing `change` handler on `#categories` already stores any `data-key` in `excluded:<monday>`, so Done rows need no new wiring.

- [ ] **Step 11: Say what Hide names does not touch**

In `src/ui/report/report.html`, replace:

```html
        <label class="check"><input type="checkbox" id="anonymize"> Hide people and customer names</label>
      </div>
```

with:

```html
        <label class="check"><input type="checkbox" id="anonymize" aria-describedby="anonHint"> Hide people and customer names</label>
      </div>
      <p id="anonHint" class="hint">Applies to tracked CRM, HR and support items. Your tasks and notes appear as you wrote them.</p>
```

- [ ] **Step 12: Run the unit tests, the typecheck and the end-to-end suite**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 200`, `# fail 0` in both timezones; `tsc` exits 0; e2e `176/176 passed`, including every `[Done]` check. The existing report checks are unchanged: Done is a new leading section and touches nothing below it.

---

### Task 8: README, size checks, phase gate

**Files:**
- Modify: `README.md` (Install, The update, new Tasks section, Layout, rules, typecheck row)

**Interfaces:**
- Consumes: everything above. Produces: no code.

- [ ] **Step 1: Update the README**

In `README.md`, replace:

```markdown
4. Pin **Weekly**. Click it any time for today's summary, or **Open weekly report**.
```

with:

```markdown
4. Pin **Weekly**. Its icon opens the side panel: today's tasks, the week, time tracked today and **Pause**. **Open Weekly** opens the calendar and task views.
```

In `README.md`, replace:

```markdown
- **Hide people and customer names**: candidates, customers and support cases become "Candidate 1", "Customer 2"… so a draft is safe to paste into a shared channel. It's on by default for HR, sales and support roles.
```

with:

```markdown
- **Hide people and customer names**: candidates, customers and support cases become "Candidate 1", "Customer 2"… so a draft is safe to paste into a shared channel. It's on by default for HR, sales and support roles. Task titles and notes are your own words and appear as you wrote them.
```

In `README.md`, replace:

```markdown
## Optional extras (each asks for permission first)
```

with:

```markdown
## Tasks
- **Side panel** (the toolbar icon): add a task for today in one line and tick it off. A task's **⋯** menu sets its priority and due date, moves it to tomorrow or deletes it. Bands: **Overdue**, **Today** (daily tasks first) and **No date**. **Undo** in the message, or ⌘Z / Ctrl+Z, reverses the last tick, move or delete. Keys: N new task, O open the app.
- **Calendar** (**Open Weekly**): each day is shaded by how much of its tasks got done. Click a day for its sheet: daily tasks to tick, extra tasks for that day (move or copy them to another day) and notes. ← → change month, T jumps to today, Esc closes the sheet.
- **Tasks**: Today, Week, Overdue, Upcoming, All open and Completed, with search ( / ) and a priority filter. **Edit…** in a task's ⋯ menu changes its title, description, priority and date.
- **Done**: tasks closed Monday to Friday lead the weekly update. A daily task appears once with its count, e.g. "Standup notes (4 of 5 days)". Untick any of them to leave it out of that week.

## Optional extras (each asks for permission first)
```

In `README.md`, replace:

```markdown
  task-portability.js  Daybook backup import (merge / replace), delete all tasks
  portability.js   export / import
  activity/        classify, history, range loading
```

with:

```markdown
  task-portability.js  Daybook backup import (merge / replace), delete all tasks
  planner.js       what the task screens draw: Today bands, month grid, Done range (via tasks.js)
  week-notes.js    Weekly 2's notes until Phase 4 (side panel, day sheet)
  portability.js   export / import
  activity/        classify, history, range loading, tracker status
```

In `README.md`, replace:

```markdown
src/ui/            popup, welcome, report tab (components/dom.js builds all DOM)
```

with:

```markdown
src/ui/            panel/ (side panel), app/ (calendar, tasks), welcome, report tab
  components/      dom.js (h() builds all DOM), task rows, bands, undo toast, keys
```

In `README.md`, replace:

```markdown
keys with no lib owner yet (the popup's `day:<today>` read and session state, notes, `excluded:*`, `draft:*`, `shareOk`, clear-all, `onChanged` listeners, and the report's one-time legacy `remove('excluded')` cleanup). Settings always go through `lib/settings.js`.
```

with:

```markdown
keys with no lib owner yet, all on the report page (notes, `excluded:*`, `draft:*`, `shareOk`, clear-all's activity keys, `onChanged` listeners, and the one-time legacy `remove('excluded')` cleanup). Settings always go through `lib/settings.js`. The side panel and the app tab have no exceptions: tasks come from `lib/tasks.js`, notes from `lib/week-notes.js`, tracker status from `lib/activity/status.js`.
```

In `README.md`, replace:

```markdown
The popup, the report tab and the service worker share one lock manager
```

with:

```markdown
The side panel, the app and report tabs and the service worker share one lock manager
```

In `README.md`, replace:

```markdown
Node tests fall back to a per-context promise chain.
```

with:

```markdown
Node tests fall back to a per-context promise chain. Locks are not re-entrant: a `mutate()` callback is synchronous and never calls `getTasks()`.
```

In `README.md`, replace:

```markdown
| `npm run typecheck` | `tsc --strict` over `src/lib` and `src/background` (JSDoc types) |
```

with:

```markdown
| `npm run typecheck` | `tsc --strict` over `src/lib`, `src/background` and the task UI (`src/ui/components`, `src/ui/panel`, `src/ui/app`) (JSDoc types) |
```

- [ ] **Step 2: Check sizes and layering**

Run: `find src -name '*.js' | xargs wc -l | sort -n | tail -4 && (grep -rn 'chrome.storage' src/ui/panel src/ui/app src/ui/components || echo 'no direct storage in new UI') && (grep -rnE "lib/(schema|task-views|recurrence|planner)\.js'" src/ui || echo 'task domain only via tasks.js') && (grep -rnE 'storage\.sync' src || echo 'no storage.sync')`

Expected: the largest files are `schema.js` (250), `tasks.js` (227), `classify.js` (203) and `task-views.js` (195), all ≤ 300; then `no direct storage in new UI`, `task domain only via tasks.js` and `no storage.sync`. `test/e2e/full.mjs` stays the one file over 300 lines, as in Phases 1 and 2a (396 lines; the new checks live in their own modules).

- [ ] **Step 3: Run the phase gate**

Run: `npm run package && npm run e2e`

Expected:
- `npm test`: `# tests 200`, `# pass 200`, `# fail 0` in each timezone (172 from Phase 2a plus 28 new).
- `typecheck`: clean.
- `Packed 63 files → dist/weekly-2.0.0.zip`.
- e2e: `176/176 passed`: Phase 2a's 104, less the 7 Popup checks that moved to the panel, plus 79 checks in the five new modules.

- [ ] **Step 4: Report**

Report to the controller: test counts per timezone, the e2e total, the four largest files, and any check that needed a retry (none are expected to be timing-sensitive beyond the existing `wait()` pauses).

---

## Interfaces exported for Phase 3 and Phase 4

**Where things open**

| Need | Call or URL |
|---|---|
| Open the full app (command Alt+Shift+T, notification click) | `chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/app/app.html#tasks') })`; the panel's `openApp()` (`src/ui/panel/panel.js`) does the same without a hash |
| Open one day's sheet (morning brief, evening check, carry-over) | `src/ui/app/app.html#day=YYYY-MM-DD`; an invalid date falls back to `#calendar` |
| Open the report's Settings (reminder times, PIN, tracking) | `src/ui/report/report.html#settings`; the app's **Settings** link already points here |
| Open the side panel (command Alt+T) | `chrome.sidePanel.open({ windowId })` from the command handler (a command counts as the user gesture). The panel already opens on toolbar click via `setPanelBehavior` in the worker |

**Reusable UI (Phase 3's reminder window, Phase 4's Notes)**

- `taskRow(task, { day, onEdit?, copy? })` and `renderBands(host, bands, row, opts)` render any task list. The evening check can render open tasks with `taskRow` and call `moveToTomorrow(tasks)` (one or all) from `components/task-actions.js`, which brings Undo with it. The worker-side equivalent is `reschedule(ids)` (tasks.js).
- `toast`, `undoLast`, `report` (`components/undo.js`); `bindKeys(map)`, `onNewDay(cb)` (`components/keys.js`). Every new page calls `bindKeys` once so ⌘Z/Ctrl+Z and Esc behave the same everywhere.
- `src/ui/components/tasks.css` styles rows, bands, the toast and `<dialog>`; link it from any new page.
- `updateSettings((current) => patch)` for any toggle. Phase 3 adds the reminder settings and, per the 2a ledger, puts `updateUiState` and `updateReminderState` under the lock (the evening window becomes a second `reminderState` writer).

**Phase 4 (notes)**

- **Notes tab in the side panel:** insert `{ id: 'notes', label: 'Notes', mount, refresh }` into `TABS` in `src/ui/panel/panel.js` at index 1 (spec order: Today, Notes, Week). `mount(host)` receives an empty `<section role="tabpanel" id="panel-notes">`; `refresh()` is called after midnight. Nothing else in the panel changes.
- **Notes view in the app:** add `<button id="nav-notes" data-view="notes">` to `.anav` and `<section id="view-notes" class="view" hidden>` to `app.html`, add `'notes'` to the `View` union and the list in `show()` (`app.js`), and route `#notes`.
- **Day note slot:** the day sheet's `#sheetNotes` list and `#noteForm` / `#dayNote` stay; replace `renderNotes()` and the `#noteForm` handler in `day-sheet.js` with the note whose `day` is the sheet's day and whose title is empty (spec §4).
- **Weekly 2 notes:** `src/lib/week-notes.js` is the only owner of the `notes` key for new UI (the panel footer's quick note and the day sheet). Phase 4 migrates `notes` to `Note[]`, moves those two callers to `notes.js`, and deletes `week-notes.js`. The report still reads `notes` directly (`main.js`, `draft-panel.js`, `notes-panel.js`, R2 exceptions); Phase 4 moves them too.
- **Migration:** `schemaVersion: 2` versions only the tasks blob. The notes migration must bump to 3, or detect Weekly 2 notes by shape (`{id: number, ts: number, text: string}`); it must never gate on `schemaVersion < 2`, which is already true on every profile that ran Phase 2.
- **Footer note:** the footer's quick-note form (`#noteForm`, `#note`) is where **Note on this page** goes (spec §3.1).
- **Done section:** unchanged by notes. Phase 4's "Other work from day notes" keeps using `buildWeekly({ notes })`; private notes never reach it.

## Self-review (done at authoring time)

**1. Spec coverage: every Phase 2b parity row, its task, and the check that proves it**

| Row | Requirement | Task | Proved by |
|---|---|---|---|
| D2 | One-line quick add (side panel + app) | 4, 6 | `[Panel tasks] quick add with Enter: due today, default priority (D2)`, `[Panel tasks] the Add button adds too`, `[Tasks] one-line add in the app (D2)` |
| D3 | Views Today, Overdue, Upcoming, All open, Completed; Today/Week/All with a rolling 7-day Week of collapsible day bands (`uiState`) | 4, 6 | `[Tasks] Tasks view with Daybook’s views and counts (D3)`, `[Tasks] Week: a rolling 7 days of day bands, later days collapsed (D3)`, `[Tasks] opening a day band is remembered (uiState)`, `[Tasks] Completed view lists closed tasks`, `[Panel tasks] No date band starts collapsed`, `[Panel tasks] band state is saved (uiState)`, `[Panel tasks] band state survives a reload`; unit `band-state.test.js` (3), `planner.test.js` todayBands (3) |
| D4 | Search + priority filter | 6 | `[Tasks] search filters by title (D4)`, `[Tasks] search covers descriptions (D4)`, `[Tasks] priority filter (D4)`, `[Tasks] Esc clears the search` |
| D5 | Edit (title, description, priority, due date), delete | 4, 6 | `[Tasks] edit title, description and priority (D5)`, `[Panel tasks] priority from the ⋯ menu`, `[Panel tasks] due date from the ⋯ menu; a past day lands in Overdue`, `[Panel tasks] delete from the ⋯ menu (D5)`, `[Tasks] delete (D5)` |
| D6 | Undo for complete and delete (toast + ⌘/Ctrl+Z) | 1, 4, 6 | `[Panel tasks] Undo in the toast reopens it (D6)`, `[Panel tasks] ⌘Z / Ctrl+Z undoes the last tick (D6)`, `[Panel tasks] Undo restores the deleted task, same id (D6)`, `[Tasks] ⌘Z / Ctrl+Z undoes a delete (D6)`; unit `tasks-restore.test.js` (3) |
| D7 (UI) | Move to tomorrow (one) and Move all to tomorrow | 4 | `[Panel tasks] Move to tomorrow, one task (D7)`, `[Panel tasks] Move all to tomorrow (D7)`, `[Panel tasks] Move all is undoable` |
| D10 (in-page) | `N` new, `/` search, `O` open app, ⌘Z undo, Esc close | 4, 5, 6 | `[Keys] N focuses the add box (panel)`, `[Keys] O in the side panel opens the full app`, `[Keys] / focuses search (app)`, `[Keys] N goes to the add box from anywhere in the app`, the two ⌘Z checks above, `[Keys] Esc closes the day sheet (L9)`, `[Tasks] Esc clears the search` |
| L1 (UI) | Daily recurring tasks, counted from their created date | 5 | `[Day sheet] add a daily recurring task, counted from today (L1)`, `[Day sheet] tick a daily task for this day (L5)`, `[Panel tasks] Today band lists daily tasks first (L1)`, `[Day sheet] Stop repeating ends it before this day, keeps its ticks`, `[Day sheet] Stop repeating is undoable` |
| L2 | Extra tasks per day; copy or move to another day | 5 | `[Day sheet] add an extra task for this day (L2)`, `[Day sheet] move an extra task to another day (L2)`, `[Day sheet] copy an extra task to another day, unticked (L2)`, `[Day sheet] a copy is undoable` |
| L3 (slot) | Day-sheet note slot | 2, 5 | `[Day sheet] note slot: a note for this day (L3)`; unit `week-notes.test.js` (4) |
| L4 | Month grid shaded by completion; today ring; future muted; prev/next + Today | 1, 5 | `[Calendar] month grid starts on Monday, today ringed`, `[Calendar] next month: every day is muted as future (L4)`, `[Calendar] today is shaded once something is ticked (L4)`, `[Keys] ← → change month, T jumps to today (L9)`; unit `planner.test.js` monthGrid (3) |
| L5 | Day sheet: recurring tasks to tick, extra tasks, note | 5 | `[Day sheet] clicking a day opens its sheet (L5)`, `[Day sheet] tick a daily task for this day (L5)`, `[Day sheet] progress shows the day’s share done`, `[App] #day=YYYY-MM-DD opens that day’s sheet` |
| L9 | Esc closes the sheet, arrows move months, `T` today | 5 | `[Keys] Esc closes the day sheet (L9)`, `[Keys] ← → change month, T jumps to today (L9)` |
| L10 | Rollover on focus/visibility | 4 | `[Rollover] an open panel moves to the new day on focus (L10)` (Playwright fake clock); the app uses the same `onNewDay` |
| W2 (2b) | Done section: one-offs by completion in Mon–Fri, priority then time; recurring once with "(n of m days)" if ticked ≥ 1; untickable per week; Hide names does not apply, helper text says so | 1, 7 | `[Done] Done leads the activity list, tickable like other items`, `[Done] draft opens with a Done section: one-offs, then recurring with its count (W2)`, `[Done] unticking a Done item drops it from this week’s draft`, `[Done] the untick is stored with the week’s exclusions`, `[Done] hide names leaves task titles as written; the hint says so`, `[Done] an open report follows task changes made elsewhere`, `[Done] and puts the task back when it is ticked again`, `[Done] side panel Week tab: tasks done this week, daily ticks counted per day`; unit `draft-done.test.js` (3), `planner.test.js` doneRange/doneThisWeek/withoutExcluded (4) |
| §3.1 | Toolbar icon opens the side panel; popup removed; popup features in the panel | 3 | `[Panel] toolbar icon opens the side panel, no popup`, `[Panel] panel opens on toolbar click`, the 11 other `[Panel]` checks (time today, now, pause, resume, note, storage-full error and its clearing, privacy line, Week strip, top work, Open full report); unit `the toolbar icon opens the side panel` |
| §3.2 | App tab with Calendar, Tasks, Week report and Settings | 5, 6 | `[App] opens on the Calendar`, `[App] Settings link opens the report’s settings`, `[Layout] every app control has a label`, `[Layout] app: no sideways scrolling at phone width` |
| W1 | Weekly 2 features survive | every task | 96 of the 97 Phase 2a checks outside the popup section pass unchanged; the 97th, delete-all, is renamed `[Data] delete all keeps only settings and device ID (tasks emptied)` |
| 2a carry-overs | `updateSettings(fn)` for Pause; `defaultPriority` validated on write; delete-all via `deleteEverything()`; `coerceUiState` / `UNDATED_KEY` pinned with the first collapsible band; `mutate()` callbacks synchronous | 1, 3, 4 | unit `updateSettings takes a function…`, `an invalid defaultPriority is never stored`, `band-state.test.js`; e2e `[Data] delete all keeps only settings and device ID (tasks emptied)` |

**End-to-end checks in the new modules (79: the 7 former Popup checks, moved, plus 72 new), by file:**

- `test/e2e/panel.mjs` (15): `[Panel] toolbar icon opens the side panel, no popup`; `[Panel] panel opens on toolbar click`; `[Panel] footer shows time tracked today`; `[Panel] shows what is being tracked now`; `[Panel] pause works`; `[Panel] resume works`; `[Panel] note added with Enter`; `[Panel] storage-full error explained in plain words, live`; `[Panel] error banner clears when the error does`; `[Panel] privacy line shown`; `[Panel] Week tab: Mon–Fri strip`; `[Panel] Week tab: today’s top work`; `[Panel] "Open full report" opens the report`; `[Layout] every panel control has a label`; `[Layout] panel: no sideways scrolling at 360 px`
- `test/e2e/panel-tasks.mjs` (19): `[Panel tasks] Today tab is the default`; `[Panel tasks] quick add with Enter: due today, default priority (D2)`; `[Panel tasks] the Add button adds too`; `[Panel tasks] tick closes a one-off; it stays in Today, struck through`; `[Panel tasks] Undo in the toast reopens it (D6)`; `[Panel tasks] ⌘Z / Ctrl+Z undoes the last tick (D6)`; `[Panel tasks] priority from the ⋯ menu`; `[Panel tasks] due date from the ⋯ menu; a past day lands in Overdue`; `[Panel tasks] Move all to tomorrow (D7)`; `[Panel tasks] Move all is undoable`; `[Panel tasks] Move to tomorrow, one task (D7)`; `[Panel tasks] No date band starts collapsed`; `[Panel tasks] band state is saved (uiState)`; `[Panel tasks] band state survives a reload`; `[Panel tasks] delete from the ⋯ menu (D5)`; `[Panel tasks] Undo restores the deleted task, same id (D6)`; `[Keys] N focuses the add box (panel)`; `[Layout] every control in a full panel has a label`; `[Rollover] an open panel moves to the new day on focus (L10)`
- `test/e2e/app.mjs` (20): `[Keys] O in the side panel opens the full app`; `[App] opens on the Calendar`; `[Calendar] month grid starts on Monday, today ringed`; `[Calendar] next month: every day is muted as future (L4)`; `[Keys] ← → change month, T jumps to today (L9)`; `[Day sheet] clicking a day opens its sheet (L5)`; `[Day sheet] add a daily recurring task, counted from today (L1)`; `[Day sheet] tick a daily task for this day (L5)`; `[Day sheet] add an extra task for this day (L2)`; `[Day sheet] move an extra task to another day (L2)`; `[Day sheet] copy an extra task to another day, unticked (L2)`; `[Day sheet] a copy is undoable`; `[Day sheet] note slot: a note for this day (L3)`; `[Day sheet] progress shows the day’s share done`; `[Keys] Esc closes the day sheet (L9)`; `[Calendar] today is shaded once something is ticked (L4)`; `[Day sheet] Stop repeating ends it before this day, keeps its ticks`; `[Day sheet] Stop repeating is undoable`; `[App] #day=YYYY-MM-DD opens that day’s sheet`; `[Panel tasks] Today band lists daily tasks first (L1)`
- `test/e2e/app-tasks.mjs` (17): `[Tasks] Tasks view with Daybook’s views and counts (D3)`; `[Tasks] one-line add in the app (D2)`; `[Tasks] search filters by title (D4)`; `[Tasks] Esc clears the search`; `[Tasks] priority filter (D4)`; `[Tasks] Week: a rolling 7 days of day bands, later days collapsed (D3)`; `[Tasks] opening a day band is remembered (uiState)`; `[Tasks] edit title, description and priority (D5)`; `[Tasks] search covers descriptions (D4)`; `[Tasks] delete (D5)`; `[Tasks] ⌘Z / Ctrl+Z undoes a delete (D6)`; `[Tasks] Completed view lists closed tasks`; `[Keys] / focuses search (app)`; `[Keys] N goes to the add box from anywhere in the app`; `[Layout] every app control has a label`; `[Layout] app: no sideways scrolling at phone width`; `[App] Settings link opens the report’s settings`
- `test/e2e/done.mjs` (8): `[Done] Done leads the activity list, tickable like other items`; `[Done] draft opens with a Done section: one-offs, then recurring with its count (W2)`; `[Done] unticking a Done item drops it from this week’s draft`; `[Done] the untick is stored with the week’s exclusions`; `[Done] hide names leaves task titles as written; the hint says so`; `[Done] an open report follows task changes made elsewhere`; `[Done] and puts the task back when it is ticked again`; `[Done] side panel Week tab: tasks done this week, daily ticks counted per day`

**2. Placeholder scan:** none. Every new file is written in full; every change to an existing file is an exact replace or append against the file as Phase 2a left it (the 2a ledger's final fix wave included). The whole plan was replayed step by step on a copy of the post-2a repo, including each "see it fail" run.

**3. Type consistency:**
- `Band.key` is `'overdue' | 'today' | UNDATED_KEY`; `todayBands` (Task 1) produces it, `renderBands` and `today-tab.js` (Task 4) read `data-band` with the same values, and the e2e checks select `[data-band="overdue"]`, `[data-band="today"]`, `details[data-band="undated"]`.
- `DayCell` (Task 1) is consumed by `calendar-view.js` (Task 5) as `import('../../lib/tasks.js').DayCell`.
- `doneKey(task) = 'task:<id>'` (Task 1) is the `data-key` in `categories-view.js` and the value stored in `excluded:<monday>` (Task 7); `withoutExcluded` filters with the same key.
- `DoneTasks` in `draft.js` (Task 7) is structurally the `doneInRange` result; `recurringLabel` formats both the draft line and the report row.
- `restoreTask` (Task 1) is the only undo for `deleteTask`; `task-actions.remove` (Task 4) calls it. No UI imports `mergeTasks`.
- `updateSettings(fn)` (Task 1) is used by the footer's Pause (Task 3).
- `taskRow(t, { day, onEdit?, copy? })` is called by `today-tab.js` (`{ day }`), `day-sheet.js` (`{ day, copy, onEdit }` from Task 6) and `tasks-view.js` (`{ day, copy, onEdit }`).
- `TABS` entries are `{ id, label, mount, refresh }` in Task 3 and Task 4, and in the Phase 4 instructions above.

**Decisions the specs did not settle:**
- **Delete everything in the report** now also empties tasks, through `deleteEverything()` under the task lock, and keeps the `tasks` and `schemaVersion` keys. Its confirmation says so.
- **Typecheck scope:** `src/ui/components`, `src/ui/panel` and `src/ui/app` join; the legacy report and welcome pages do not. `dom.js` gains JSDoc types with no behaviour change. Typing the report means rewriting working Phase 1 code, which is out of this phase's scope.
- **Popup features:** the time today, now-tracking line, Pause, quick note, error banner and privacy line sit in the panel footer. "Today's top work" and **Open full report →** sit on the Week tab. "Note on this page" waits for Phase 4.
- **Where D3 lives:** the side panel keeps the spec's Today/Week tabs, with Week showing tracked hours. Daybook's Today/Week/All views and the rolling 7-day collapsible Week are in the app's Tasks view, with Overdue, Upcoming and Completed.
- **Add box date:** every one-line add (panel and app) creates a task due today. The date and priority change from the ⋯ menu, as spec §3.1 says for the panel.
- **Daily task days:** the day sheet's add row offers Weekdays (spec default `[1..5]`) or Every day. There is no per-weekday picker.
- **Deleting a daily task** from a row means **Stop repeating** from that row's day (`archiveRecurring`), with Undo. A confirmed hard delete waits for the Phase 5 management page (L6 UI).
- **Day note slot:** it uses Weekly 2 notes dated to the day (`week-notes.js`), so they also reach the update's "Other work". Phase 4 swaps the store.
- **Undo depth:** only the latest action, as in Daybook. ⌘Z/Ctrl+Z is ignored while a text field has focus, so the browser's own text undo still works there.
- **Done range:** Monday to Friday, clamped to today, so "n of m days" never counts days still to come. A past week uses its full Monday–Friday.
- **Calendar:** the week starts on Monday (Weekly's week), where dailies.html started on Sunday. Shading is `color-mix(var(--marker) p%, var(--marker-wash))`.
- **Toasts inside dialogs:** the toast attaches to the open `<dialog>` when there is one; otherwise it would sit inert behind the modal day sheet.
- **e2e when unattended:** the harness's `idleSeconds` goes from 3600 to 14400, the `chrome.idle` maximum. With 3600 the suite, Phase 2a's baseline included, fails every tracking check once the machine has had no real input for an hour.
- **e2e at weekends:** Done checks re-date today's ticks onto `workday`, the harness's Friday-at-weekends day, the same way it already moves tracked time. The Week tab and the draft use the same rule, so the checks are identical on weekdays and weekends.
