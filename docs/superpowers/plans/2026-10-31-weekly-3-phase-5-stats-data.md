# Weekly 3.0, Phase 5: Stats, Theme, Optional Tracking and Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Pre-flight (controller):** this plan was written and replayed against the Phase 4 plan's end state (`docs/superpowers/plans/2026-10-31-weekly-3-phase-4-notes.md`, all eight tasks applied on top of the Phase 3 plan's end state: 286 unit tests per timezone, 238/238 end-to-end, `Packed 84 files`). **The real post-Phase-4 tree may differ from that replay base**: the review fix waves of Phases 2b, 3 and 4 change lines this plan replaces (known 2b differences: `setDone(id, done, at = Date.now())`, `restoreRecurring(id, until = null)`, `task-actions` resolving true/false and dispatching `tasks:stale`, `undo.js` exporting `GONE`; Phase 3's parked findings are fixed in Task 4 here; Phase 4 adds a sender check to `runtime.onMessage`). Before dispatching Task 1, check every ``In `<file>`, replace:`` block below against the real files (each old block must match exactly once), reconcile any drift in the ledger, and re-derive the expected test counts from the real baseline (each task states its delta). Files this plan edits that earlier phases also wrote: `manifest.json`, `README.md`, `src/lib/{settings,schema,storage,task-views,notes,note-views,portability,task-portability}.js`, `src/lib/activity/status.js`, `src/background/{service-worker,tracker,reminders,onpage,crypto-broker}.js`, `src/content/onpage-note.js`, `src/ui/styles.css`, `src/ui/components/task-actions.js`, `src/ui/panel/{panel,footer}.js`, `src/ui/app/{app.html,app.js,app.css}`, `src/ui/remind/remind.js`, `src/ui/welcome/{welcome.html,welcome.js,welcome.css}`, `src/ui/report/{main,settings-panel,reminder-settings,data-panel}.js`, `src/ui/report/{report.html,report.css}`, `test/helpers/chrome-stub.js`, `test/{manifest,settings,schema,storage-locks,tasks,portability,task-portability}.test.js`, `test/activity/status.test.js`, `test/background/{service-worker,tracker,reminders,onpage}.test.js`, `test/e2e/{run,full,reminders}.mjs`.

**Goal:** Give Weekly dailies.html's stats (L7) and its daily-task management (L6: stop repeating with history kept, repeat again, delete for good), a light/dark/system theme on every page and the on-page note (F6, L8), tracking as a choice ("Track my week?", `tabs` optional, W3), and one import that reads a Weekly export, a Daybook backup or a ForgetMeNot export with Add or Replace (D11, F7), with Weekly's export carrying the PIN record.

**Architecture:**
- `src/lib/stats.js` is pure: the year of days (`dayCompletion` per day, as the calendar shades them), streaks, weekday rates, per-task rates, the summary figures and the heatmap's Monday-first columns. The app gets a fourth view, **Stats** (`#stats`): `src/ui/app/stats-view.js` draws it, `src/ui/app/daily-tasks.js` lists every daily task with its rate and the L6 actions, which go through `src/ui/components/task-actions.js` like every other task write.
- The theme is one setting (`theme: 'system' | 'light' | 'dark'`). `src/ui/components/theme.js`, imported first by every page, marks `<html data-theme>` and follows `onSettingsChanged`; `styles.css` keeps one set of tokens with the dark values under `[data-theme="dark"]` and under `prefers-color-scheme` unless `[data-theme="light"]`. The on-page note gets the theme as data in the worker's `notes:list` answer.
- Tracking needs `tabs`, now optional. `src/lib/activity/status.js` owns the permission (`trackingAllowed`, `allowTracking`, `stopTracking`); the tracker records nothing without it, the worker looks again on `permissions.onAdded/onRemoved`, and the welcome page, the panel footer and Settings → Tracking say where it stands.
- Import is two steps, validated before anything is written (spec §6). `src/lib/backup.js` (pure) recognises the format and coerces everything (`coerceTask`, `coerceNote`, `coerceSecurity`, `importableSettings`, `cleanEntry`); `src/lib/portability.js` writes it: notes first (through the worker's new `crypto:import` when private notes come with their PIN record, since only the worker opens, seals and writes the record), then tasks, settings and activity. The report's Settings → Your data shows what a file holds and asks Add or Replace, and the PINs private notes need.

**Tech Stack:**
- Chrome MV3: `chrome.permissions` (`contains`, `request` inside a click, `remove`, `onAdded`, `onRemoved`), `chrome.storage.local`, `chrome.runtime` messages, WebCrypto in the worker.
- Plain ES2022 modules, no bundler; `node:test` in two timezones; `tsc --strict` over JSDoc; Playwright + Chromium end-to-end.

**Spec:**
- `docs/superpowers/specs/2026-10-31-weekly-feature-parity.md`: rows L6 (UI), L7, F6, L8, D11, F7, W3. This file wins on scope.
- `docs/superpowers/specs/2026-10-31-weekly-merge-design.md`: §3.2 (app views; Settings: tracking on/off grants or revokes `tabs`), §3.5 (welcome order), §3.6 (permissions), §4 (Task archive and hard delete, Import, the security record), §5 (code rules), §6 (errors: a rejected import says which field or format failed, nothing partially written), §7 (testing: the three import formats from real backup files; tracking off → no `tabs`). This file wins on how.
- Phase 2b ledger: a confirmed hard delete of a daily task lives on the Phase 5 management page (L6 UI).
- Phase 3 review, parked for Phase 5: m3 (a cleared reminder time saves the default and says "Settings saved."), m5 (`overdue` does not exclude recurring tasks), `resetReminderState` (no lock, no caller), `snoozeUntil` (written, never read). All four are Task 4.
- Phase 4 plan, "Interfaces exported for Phase 5": notes enter storage only through `notes.js` (`coerceNote`, `mergeNotes`, `mutateNotes`); ForgetMeNot's private notes keep a plain title and are re-sealed in the worker (`openNote` then `sealNote`); the `security` record is written only by the worker, so adopting an imported one is a new `crypto:*` message validated by `coerceSecurity` (≥ 100,000 rounds); Delete everything keeps `security`; the theme reaches the closed-Shadow-DOM note as data; a new app view is a nav button, a section and a `show()` entry; worker listener order `crypto:*` → `notes:*`/`panel:*` → reminders.

## Global Constraints

- **No version control.**
  - Never run `git`. No step commits; the controller keeps the ledger.
  - Never edit this plan file.
  - Rollback point: `snapshots/weekly-2.0.0-source-2026-10-31.zip`.
- **Layering:**
  - `src/lib/` never touches the DOM. `src/lib/stats.js` and `src/lib/backup.js` touch no `chrome.*` at all.
  - `src/ui/` never calls `chrome.storage` in new code: tasks from `lib/tasks.js`, notes from `lib/notes.js`, settings from `lib/settings.js`, the `tabs` permission from `lib/activity/status.js`, export and import from `lib/portability.js`.
  - The `security` record is written only by `src/background/crypto-broker.js`; the key exists only in its memory. `crypto:import` is a `crypto:*` message, so the broker answers it for Weekly's own pages only (`fromExtensionPage`), never for a content script.
- **Privacy:** local storage only (`chrome.storage.local`; nothing reads or writes `storage.sync`). Without the `tabs` permission nothing is recorded. An export carries private notes only as ciphertext, the PIN record but never the PIN, and settings without the Slack webhook (a secret). No network calls except the existing opt-ins. No remote fonts.
- **Untrusted input:** an imported file is untrusted. Every task goes through `coerceTask`, every note through `coerceNote`, the PIN record through `coerceSecurity`, settings through `importableSettings`, activity through `cleanEntry`. Keys `__proto__`, `constructor` and `prototype` never reach an object that is later indexed or merged; nothing imported goes through `Object.assign`. Files over 20 MB are refused before they are read. Validate first, then write (spec §6).
- **No HTML sinks:** no `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src/`. Pages build DOM with `h()` from `src/ui/components/dom.js`; the content script with `createElement` and `textContent`. `test/no-innerhtml.test.js` stays green.
- **Size:** no file in `src/` over 300 lines and no function over 50 lines. `test/e2e/full.mjs` stays the one file over 300 lines (Phase 1 exception); new end-to-end checks go in their own files under `test/e2e/`, each function ≤ 50 lines.
- **Dates:** local-calendar ISO strings (`YYYY-MM-DD`); never `new Date('YYYY-MM-DD')`; use `src/lib/dates.js` (`addDays`, `fromISODate`). Streaks are tested across both US DST changes and New Year.
- **Errors:** a failed write in a page is said in plain words (`report()` in `components/undo.js`, or the report's `#settingsMsg`); a refused import says why and writes nothing; a denied permission leaves the feature off with one line saying so, never an uncaught promise (spec §6).
- **Look:** Weekly's visual language only: the tokens in `src/ui/styles.css` (paper, navy ink, the yellow marker, Charter serif), ruled sections rather than cards, one filled button per surface. No new colours outside the tokens, except the content script, which repeats the token values because a web page cannot load them.
- **Node and tests:**
  - Node ≥ 22. `node --test` takes globs, never a directory.
  - Every test file lives under `test/`. Unit tests run in `TZ=America/New_York` and `TZ=Asia/Kolkata` (`npm test`).
  - Import tests use real backup files: `test/fixtures/daybook-backup.json` was written by Daybook's own `exportTasks()` and `test/fixtures/forgetmenot-backup.json` by ForgetMeNot's own `FMNStore.exportAll()` (PIN `1234`, one private note), both in this plan verbatim.
  - End-to-end: dates are computed in Node and passed in; `sw.evaluate` callbacks use only `chrome.*`, built-ins and their argument (Phase 1 Ruling R1). Pages are opened directly as extension URLs. Keys are pressed only inside Playwright's Chromium, never on the desktop; nothing synthesises mouse or keyboard events on the owner's desktop.
  - The harness pre-grants `tabs` and `history` as before (it now moves them from optional to required in its copy); a second, untouched copy of the build runs `test/e2e/no-tabs.mjs`.
- **Dependencies:** no runtime dependencies. Dev dependencies stay `typescript@^5.5.4` and `@types/chrome@^0.0.268`.
- **Typecheck:** `npm run typecheck` covers `src/lib/**`, `src/background/**`, `src/content/**`, `src/ui/components/**`, `src/ui/panel/**`, `src/ui/app/**`, `src/ui/remind/**`. The report and welcome pages stay out, as before.
- **Gates:** every task ends with `npm test` green in both timezones and `npm run typecheck` clean; every task that changes a page, the worker or the harness also ends with `npm run e2e` green (both runs: `N/N passed` and, from Task 5, `No tabs: 9/9 passed`).

## File map (end state of Phase 5)

```
manifest.json                         tabs moves from permissions to optional_permissions
README.md                             tracking as a choice, Stats, daily tasks, Appearance, backups, Layout
src/lib/stats.js             new      yearRows, streaks, weekdayRates, taskRates, summary, heatmap, pct, isPerfect, YEAR_DAYS, MONTHS, WEEKDAYS
src/lib/backup.js            new      readBackup, describeBackup, replaces, cleanEntry; types Backup, Sealed, Format
src/lib/portability.js       rewritten exportPayload (+ tasks, security, settings without the webhook), exportAll, openBackup, applyBackup, MAX_IMPORT_BYTES
src/lib/task-portability.js  modified parseImport removed (backup.js reads files); mergeTasks, replaceAll, deleteEverything stay
src/lib/settings.js          modified theme + THEMES; importableSettings
src/lib/note-views.js        modified mergeNoteLists (pure; mergeNotes and the broker share it)
src/lib/notes.js             modified mergeNotes uses mergeNoteLists
src/lib/schema.js storage.js modified snoozeUntil and resetReminderState removed (Phase 3 parked)
src/lib/task-views.js        modified isOverdue excludes recurring tasks (Phase 3 parked m5)
src/lib/activity/status.js   rewritten trackingAllowed, allowTracking, stopTracking; trackerStatus().tracking; onTrackingChanged hears the permission
src/background/tracker.js    modified records nothing without tabs
src/background/service-worker.js modified permissions.onAdded/onRemoved → refresh
src/background/reminders.js  modified snooze() sets only the alarm
src/background/onpage.js     modified notes:list carries the theme
src/background/crypto-broker.js modified crypto:import; resealAll shared with change/remove PIN
src/content/onpage-note.js   modified .dark from the theme in notes:list
src/ui/styles.css            modified dark tokens under [data-theme="dark"] or the system's dark unless [data-theme="light"]
src/ui/components/theme.js   new      applyTheme; every page imports it first
src/ui/components/task-actions.js modified restart, purge (L6)
src/ui/app/stats-view.js daily-tasks.js   new  the Stats view (L7) and the daily tasks list (L6)
src/ui/app/app.html app.js app.css   modified  Stats nav button, #view-stats, route #stats
src/ui/panel/panel.js footer.js      modified  theme; "Tracking is off" without tabs
src/ui/remind/remind.js              modified  theme
src/ui/welcome/welcome.html welcome.js welcome.css   modified  "Track my week?" first; history step only with tracking on
src/ui/report/report.html report.css main.js settings-panel.js reminder-settings.js data-panel.js   modified  Appearance, Tracking on/off, reminder-time check, import panel
src/ui/report/import-panel.js new     choose a file, see what it holds, Add or Replace, PINs, Import
test/stats.test.js test/backup.test.js test/background/crypto-import.test.js   new
test/fixtures/daybook-backup.json test/fixtures/forgetmenot-backup.json        new (real backups)
test/portability.test.js              rewritten around openBackup / applyBackup
test/settings.test.js test/tasks.test.js test/schema.test.js test/storage-locks.test.js test/task-portability.test.js test/manifest.test.js   extended or adjusted
test/activity/status.test.js test/background/{tracker,service-worker,reminders,onpage}.test.js test/helpers/chrome-stub.js   extended
test/e2e/stats.mjs theme.mjs no-tabs.mjs data.mjs   new
test/e2e/run.mjs full.mjs reminders.mjs   harness: tabs pre-granted from optional, the no-tabs run; new files wired in; section 9 import flow
```

---

### Task 1: The stats, pure (L7)

dailies.html's numbers, computed from the same day completion the calendar shades: the year of days, current and longest streak, weekday rates, per-task completion and the summary figures. No page uses it yet.

**Why days with nothing on them are skipped** (dailies broke the streak on them): Weekly's daily tasks default to Monday to Friday, so every weekend would break every streak. A day with no tasks neither extends nor breaks a run. **Why today does not break the current streak:** at 10:00 today is not done yet; dailies showed 0 until evening. Today counts once it is perfect.

**Files:**
- Create: `src/lib/stats.js`
- Create: `test/stats.test.js`

**Interfaces:**
- Consumes: `addDays`, `fromISODate` (`src/lib/dates.js`); `dayCompletion(tasks, iso) → {done, total}`, `occursOn`, `occurrences(t, from, to)`, `isArchived(t, ref)` (`src/lib/recurrence.js`).
- Produces (`src/lib/stats.js`):
  - `YEAR_DAYS = 365`, `MONTHS` (`'Jan'…'Dec'`), `WEEKDAYS` (`'Sun'…'Sat'`, index = `getDay()`)
  - type `DayRow = {iso, done, total}`, `TaskRate = {task, hit, live, rate: number | null}`
  - `isPerfect(row)`, `pct(row) → 0–100 | null`
  - `yearRows(tasks, to, days = 365) → DayRow[]` oldest first, ending with `to`
  - `streaks(rows) → {current, longest}`
  - `weekdayRates(rows) → (number | null)[7]` (0 = Sunday)
  - `taskRates(tasks, to, days = 365) → TaskRate[]` every recurring task (stopped ones too), best first, `rate: null` last
  - `summary(rows, tasks, notes) → {current, longest, perfect, average, daily, noteDays}` (`daily` counts active daily tasks; `noteDays` counts days with a plain note)
  - `heatmap(rows) → {weeks: (DayRow | null)[][], months: string[]}` Monday-first columns, the first padded with nulls; a column is labelled when its first day starts a new month

- [ ] **Step 1: Write the failing tests**

Create `test/stats.test.js`:

```js
// Stats (L7): the year of days, streaks, weekday rates, per-task rates, summary
// cards and the heatmap layout. Runs in New York (two DST changes a year) and
// Kolkata (none), across the year boundary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { yearRows, streaks, weekdayRates, taskRates, summary, heatmap, pct, YEAR_DAYS } from '../src/lib/stats.js';
import { coerceTask } from '../src/lib/schema.js';
import { addDays, fromISODate } from '../src/lib/dates.js';

/** @param {object} patch */
const task = (patch) => /** @type {import('../src/lib/schema.js').Task} */ (coerceTask({ title: 'untitled', createdAt: 1, ...patch }));
/** Every Mon–Fri from `from` to `to`, inclusive. @param {string} from @param {string} to */
const workdays = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if ((fromISODate(d)?.getDay() ?? 0) % 6 !== 0) out.push(d);
  return out;
};
// Mon–Fri from 1 Dec 2026, ticked every working day from Mon 21 Dec to Fri 8 Jan.
const STANDUP = task({ id: 'su', title: 'Standup', repeat: { days: [1, 2, 3, 4, 5], from: '2026-12-01', until: null },
  doneDates: workdays('2026-12-21', '2027-01-08') });

test('a year is 365 consecutive local days ending today, across both DST changes and New Year', () => {
  const rows = yearRows([], '2027-01-05');
  assert.equal(rows.length, YEAR_DAYS);
  assert.equal(rows[0]?.iso, '2026-01-06');
  assert.equal(rows.at(-1)?.iso, '2027-01-05');
  for (let i = 1; i < rows.length; i++) assert.equal(rows[i]?.iso, addDays(rows[i - 1]?.iso ?? '', 1));
  for (const d of ['2026-03-08', '2026-11-01', '2026-12-31', '2027-01-01']) assert.ok(rows.some((r) => r.iso === d), d);
});

test('streaks run across New Year and skip weekends, which have nothing on them', () => {
  const s = streaks(yearRows([STANDUP], '2027-01-08'));
  assert.deepEqual(s, { current: 15, longest: 15 });
});

test('an unfinished today does not break the current streak; a missed day does', () => {
  assert.equal(streaks(yearRows([STANDUP], '2027-01-11')).current, 15, 'Monday 11 Jan is still in progress');
  assert.deepEqual(streaks(yearRows([STANDUP], '2027-01-12')), { current: 0, longest: 15 }, 'Monday was missed');
  const ticked = { ...STANDUP, doneDates: [...STANDUP.doneDates, '2027-01-11'] };
  assert.equal(streaks(yearRows([ticked], '2027-01-11')).current, 16, 'today counts once it is perfect');
});

test('a streak across the US spring-forward Sunday counts every day once', () => {
  const daily = task({ repeat: { days: [0, 1, 2, 3, 4, 5, 6], from: '2026-03-01', until: null },
    doneDates: ['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12'] });
  assert.deepEqual(streaks(yearRows([daily], '2026-03-12')), { current: 8, longest: 8 });
});

test('weekday rates average each weekday’s share done; days with nothing on them are left out', () => {
  const rates = weekdayRates(yearRows([STANDUP], '2027-01-08'));
  assert.equal(rates[0], null, 'Sunday');
  assert.equal(rates[6], null, 'Saturday');
  // Mondays in December and January: 7, 14 not ticked; 21, 28 Dec and 4 Jan ticked → 3 of 5.
  assert.equal(rates[1], 3 / 5);
  // Fridays: 4, 11, 18 Dec not; 25 Dec, 1 Jan, 8 Jan ticked → 3 of 6.
  assert.equal(rates[5], 3 / 6);
});

test('per-task rates count only the days a task occurred, never the future, best first', () => {
  const gym = task({ id: 'gym', title: 'Gym', createdAt: 2, repeat: { days: [3], from: '2026-12-01', until: '2026-12-16' },
    doneDates: ['2026-12-02', '2026-12-09', '2026-12-16', '2026-12-23'] });
  const later = task({ id: 'later', title: 'Starts tomorrow', createdAt: 3, repeat: { days: [1, 2, 3, 4, 5], from: '2027-01-09', until: null } });
  const rates = taskRates([later, STANDUP, gym, task({ title: 'one-off', dueDate: '2027-01-08' })], '2027-01-08');
  assert.deepEqual(rates.map((r) => [r.task.id, r.hit, r.live]), [['gym', 3, 3], ['su', 15, 29], ['later', 0, 0]]);
  assert.equal(rates[0]?.rate, 1);
  assert.equal(rates[2]?.rate, null);
});

test('summary cards: streaks, perfect days, average, active daily tasks, days with a plain note', () => {
  const stopped = task({ id: 'old', repeat: { days: [1], from: '2026-01-01', until: '2026-06-01' } });
  const rows = yearRows([STANDUP, stopped], '2027-01-08');
  const notes = [{ day: '2027-01-04', enc: null }, { day: '2027-01-04', enc: null }, { day: '2027-01-05', enc: { iv: 'a', ct: 'b' } },
    { day: null, enc: null }, { day: '2025-01-01', enc: null }];
  const s = summary(rows, [STANDUP, stopped], notes);
  assert.equal(s.current, 15);
  assert.equal(s.perfect, 15);
  assert.equal(s.daily, 1, 'a stopped task is not an active daily task');
  assert.equal(s.noteDays, 1, 'one day with plain notes inside the year; private and undated notes do not count');
  const tracked = rows.filter((r) => r.total > 0).length;
  assert.equal(s.average, Math.round((15 / tracked) * 100));
});

test('the heatmap is Monday-first weeks, padded at the start, each month labelled once', () => {
  const rows = yearRows([STANDUP], '2027-01-08');
  const { weeks, months } = heatmap(rows);
  const lead = ((fromISODate(rows[0]?.iso ?? '')?.getDay() ?? 0) + 6) % 7;
  assert.equal(weeks[0]?.filter((c) => c === null).length, lead);
  assert.equal(weeks.flat().filter(Boolean).length, YEAR_DAYS);
  assert.ok(weeks.slice(0, -1).every((w) => w.length === 7));
  assert.equal(months.length, weeks.length);
  assert.equal(months.filter(Boolean).length, 13, 'twelve months, with January twice');
  // A column is labelled by its Monday: the week of Fri 1 Jan starts on 28 Dec, so January's label is on 4 Jan's column.
  assert.equal(weeks[months.lastIndexOf('Jan')]?.[0]?.iso, '2027-01-04');
  assert.equal(pct({ iso: '', done: 1, total: 3 }), 33);
  assert.equal(pct({ iso: '', done: 0, total: 0 }), null);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/stats.test.js`

Expected: the file fails to load: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/src/lib/stats.js'`; `# tests 1`, `# fail 1`.

- [ ] **Step 3: Write the stats**

Create `src/lib/stats.js`:

```js
/**
 * Stats from dailies.html (L7): streaks, the year heatmap, weekday rates,
 * per-task completion and the summary cards. Pure: no storage, no DOM.
 *
 * A day's "done of total" is the calendar's (dayCompletion): its recurring
 * tasks plus its one-off tasks. Days with nothing on them are skipped: they
 * neither break a streak nor count towards one, so a Mon–Fri task keeps its
 * streak over the weekend. Today counts once it is perfect; until then it is
 * still in progress and does not break the current streak either.
 */

import { addDays, fromISODate } from './dates.js';
import { dayCompletion, occursOn, occurrences, isArchived } from './recurrence.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {{ iso: string, done: number, total: number }} DayRow */
/** @typedef {{ task: Task, hit: number, live: number, rate: number | null }} TaskRate */

export const YEAR_DAYS = 365;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** @param {DayRow} r */
export const isPerfect = (r) => r.total > 0 && r.done === r.total;

/** Share done, 0–100, or null for a day with nothing on it. @param {DayRow} r */
export const pct = (r) => (r.total ? Math.round((r.done / r.total) * 100) : null);

/**
 * The `days` local days ending with `to`, oldest first.
 * @param {Task[]} tasks @param {string} to @param {number} [days]
 * @returns {DayRow[]}
 */
export function yearRows(tasks, to, days = YEAR_DAYS) {
  return Array.from({ length: days }, (_, i) => {
    const iso = addDays(to, i - days + 1);
    return { iso, ...dayCompletion(tasks, iso) };
  });
}

/** @param {DayRow[]} rows @returns {{ current: number, longest: number }} */
export function streaks(rows) {
  let longest = 0, run = 0;
  for (const r of rows) {
    if (!r.total) continue;
    run = isPerfect(r) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = /** @type {DayRow} */ (rows[i]);
    if (!r.total) continue;
    if (isPerfect(r)) current++;
    else if (i < rows.length - 1) break;   // an unfinished today is still in progress
  }
  return { current, longest };
}

/**
 * Average share done per weekday (0 = Sunday), over days with something on them.
 * @param {DayRow[]} rows @returns {(number | null)[]}
 */
export function weekdayRates(rows) {
  const sum = Array(7).fill(0), n = Array(7).fill(0);
  for (const r of rows) {
    if (!r.total) continue;
    const wd = /** @type {Date} */ (fromISODate(r.iso)).getDay();
    sum[wd] += r.done / r.total;
    n[wd]++;
  }
  return sum.map((s, i) => (n[i] ? s / n[i] : null));
}

/**
 * How often each recurring task was ticked on the days it occurred, inside the
 * window ending `to` (never the future), best first; tasks with no day yet last.
 * @param {Task[]} tasks @param {string} to @param {number} [days]
 * @returns {TaskRate[]}
 */
export function taskRates(tasks, to, days = YEAR_DAYS) {
  const from = addDays(to, 1 - days);
  return tasks.filter((t) => t.repeat !== null).map((task) => {
    const live = occurrences(task, from, to);
    const hit = task.doneDates.filter((d) => d >= from && d <= to && occursOn(task, d)).length;
    return { task, hit, live, rate: live ? hit / live : null };
  }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.task.createdAt - b.task.createdAt);
}

/**
 * The summary cards.
 * @param {DayRow[]} rows @param {Task[]} tasks @param {{ day: string | null, enc: unknown }[]} notes
 * @returns {{ current: number, longest: number, perfect: number, average: number, daily: number, noteDays: number }}
 */
export function summary(rows, tasks, notes) {
  const tracked = rows.filter((r) => r.total > 0);
  const first = rows[0]?.iso ?? '', last = rows.at(-1)?.iso ?? '';
  const noteDays = new Set(notes.filter((n) => !n.enc && n.day && n.day >= first && n.day <= last).map((n) => n.day));
  return {
    ...streaks(rows),
    perfect: tracked.filter(isPerfect).length,
    average: tracked.length ? Math.round((tracked.reduce((s, r) => s + r.done / r.total, 0) / tracked.length) * 100) : 0,
    daily: tasks.filter((t) => t.repeat !== null && !isArchived(t, last)).length,
    noteDays: noteDays.size,
  };
}

/**
 * The heatmap's columns: one per week, Monday first, like the calendar.
 * The first column is padded with nulls; `months` labels a column when its month starts.
 * @param {DayRow[]} rows @returns {{ weeks: (DayRow | null)[][], months: string[] }}
 */
export function heatmap(rows) {
  if (!rows.length) return { weeks: [], months: [] };
  const lead = (/** @type {Date} */ (fromISODate(rows[0]?.iso ?? '')).getDay() + 6) % 7;
  /** @type {(DayRow | null)[]} */
  const cells = [...Array(lead).fill(null), ...rows];
  /** @type {(DayRow | null)[][]} */
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  let month = -1;
  const months = weeks.map((w) => {
    const first = w.find((c) => c !== null);
    const m = first ? /** @type {Date} */ (fromISODate(first.iso)).getMonth() : month;
    if (m === month) return '';
    month = m;
    return MONTHS[m] ?? '';
  });
  return { weeks, months };
}
```

- [ ] **Step 4: Run the gate**

Run: `npm test && npm run typecheck`

Expected: `# tests 294`, `# pass 294`, `# fail 0` in each timezone (286 + 8); typecheck prints nothing after its header. The end-to-end suite is unchanged (no page imports `stats.js` yet).

---

### Task 2: The Stats view, with the daily tasks list (L7, L6)

A fourth app view, **Stats** (`#stats`): six figures on a ruled strip like the report's week, a year of days shaded like the calendar, weekday bars, and every daily task with its rate. The daily tasks list is where L6 lives: **Stop repeating** (archive: `until` = yesterday, past ticks kept), **Repeat again** for stopped ones (under a "Stopped daily tasks" disclosure, dailies' "retired tasks"), and **Delete…**, the one confirmed hard delete of a daily task (Phase 2b ledger), with Undo. It asks with `confirm()`, as Weekly's own Delete everything does.

**Files:**
- Create: `src/ui/app/stats-view.js`, `src/ui/app/daily-tasks.js`, `test/e2e/stats.mjs`
- Modify: `src/ui/components/task-actions.js`, `src/ui/app/app.html`, `src/ui/app/app.js`, `src/ui/app/app.css`, `test/e2e/full.mjs`

**Interfaces:**
- Consumes (Task 1): `yearRows`, `summary`, `heatmap`, `weekdayRates`, `taskRates`, `pct`, `WEEKDAYS`. Consumes (2a/2b/4): `archiveRecurring(id, iso)`, `restoreRecurring(id)`, `deleteTask(id)`, `restoreTask(snapshot)`, `isArchived` (`lib/tasks.js`); `toast`, `report` (`components/undo.js`); `mountNotes(host, { onRender })` (`components/notes-view.js`); `today`, `addDays`, `shortDate`, `longDate` (`lib/dates.js`).
- Produces: `restart(t)` and `purge(t)` in `components/task-actions.js` (both resolve true/false like the other guarded actions); `render(tasks, notes)` in `app/stats-view.js`; `render(tasks)` in `app/daily-tasks.js`; `View = 'calendar' | 'tasks' | 'notes' | 'stats'` in `app.js`, route `#stats`; DOM ids `#nav-stats`, `#view-stats`, `#statFigures` (`.figure` × 6), `#hmMonths`, `#heatmap` (`.hm-cell[data-iso]`, `.blank` for padding), `#weekdayBars` (`.wd-row`), `#weekdayNote`, `#dailyRates`, `#stoppedWrap`, `#stoppedCount`, `#stoppedList`; row buttons `.stop`, `.restart`, `.purge`. `test/e2e/stats.mjs` exports `statsChecks(t)`.

- [ ] **Step 1: Write the failing end-to-end checks**

They seed a daily task from 20 days ago ticked on the last 10 (10 of 21 days, 48%), open `#stats`, then stop, restart, refuse a delete, delete with Undo, and delete it for good, so later checks (the Done section) never see it.

Create `test/e2e/stats.mjs`:

```js
// Stats and the daily tasks list (spec L6, L7). Dates are computed in Node and passed
// in; sw.evaluate callbacks use only chrome.*, built-ins and their argument (R1).
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return isoOf(d); };

// A daily task from 20 days ago, ticked on the last 10 days: 10 of 21 days.
const PROBE = 'Stats probe';
const seedProbe = (sw) => sw.evaluate(({ title, from, done }) => chrome.storage.local.get('tasks').then(({ tasks = [] }) => chrome.storage.local.set({ tasks: [...tasks,
  { id: 't_statsprobe1', title, description: '', priority: 'medium', dueDate: null, status: 'open', createdAt: 1, updatedAt: 1, completedAt: null,
    repeat: { days: [0, 1, 2, 3, 4, 5, 6], from, until: null }, doneDates: done }] })),
{ title: PROBE, from: daysAgo(20), done: Array.from({ length: 10 }, (_, i) => daysAgo(9 - i)) });

export async function statsChecks(t) {
  const { ctx, X, sw, check, watch, wait, PAGES, iso, shots } = t;
  await seedProbe(sw);
  const app = watch(await ctx.newPage());
  await app.goto(`${X}/${PAGES.app}#stats`); await wait(900);
  check('Stats', '#stats opens the Stats view with six figures (L7)', await app.isVisible('#view-stats') && await app.locator('#statFigures .figure').count() === 6
    && (await app.getAttribute('#nav-stats', 'aria-current')) === 'page');
  const cells = await app.locator('#heatmap .hm-cell:not(.blank)').count();
  const months = (await app.locator('#hmMonths span').allTextContents()).filter(Boolean);
  const todayCell = await app.getAttribute(`#heatmap .hm-cell[data-iso="${iso.today}"]`, 'title');
  check('Stats', 'a year of days: 365 squares ending today, months labelled (L7)', cells === 365 && months.length >= 12 && / of \d+ done/.test(todayCell ?? ''), `${cells} ${months.join(',')} ${todayCell}`);
  const wd = (await app.locator('#weekdayBars .wd-row span:first-child').allTextContents()).join(',');
  check('Stats', 'weekday bars run Monday to Sunday (L7)', wd === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', wd);
  const probe = app.locator('#dailyRates li', { hasText: PROBE });
  check('Stats', 'per-task rate counts the days it was due: 10 of 21, 48% (L7)', /10 of 21 days/.test(await probe.textContent()) && (await probe.locator('.wd-pct').textContent()) === '48%', await probe.textContent());
  await app.screenshot({ path: shots + '/stats.png', fullPage: true });
  await app.setViewportSize({ width: 400, height: 900 }); await wait(200);
  check('Layout', 'Stats: no sideways scrolling at phone width; the year scrolls in its own strip', await app.evaluate(() => document.documentElement.scrollWidth <= 400));
  await app.setViewportSize({ width: 1280, height: 900 });
  await dailyTaskChecks(t, app);
  await app.close();
}

async function dailyTaskChecks(t, app) {
  const { check, store, wait } = t;
  const probeTask = async () => ((await store()).tasks ?? []).find((x) => x.id === 't_statsprobe1');
  await app.locator('#dailyRates li', { hasText: PROBE }).locator('button.stop').click(); await wait(500);
  const stopped = await probeTask();
  check('Daily tasks', 'Stop repeating keeps its history and moves it to Stopped (L6)', stopped?.repeat?.until === daysAgo(1) && stopped.doneDates.length === 10
    && await app.isVisible('#stoppedWrap') && await app.locator('#stoppedList li', { hasText: PROBE }).count() === 1, JSON.stringify(stopped?.repeat));
  await app.click('#stoppedWrap summary');
  await app.locator('#stoppedList li', { hasText: PROBE }).locator('button.restart').click(); await wait(500);
  check('Daily tasks', 'Repeat again brings it back (L6)', (await probeTask())?.repeat?.until === null && await app.locator('#dailyRates li', { hasText: PROBE }).count() === 1);
  app.once('dialog', (d) => d.dismiss());
  await app.locator('#dailyRates li', { hasText: PROBE }).locator('button.purge').click(); await wait(400);
  check('Daily tasks', 'Delete asks first; Cancel keeps the task (L6)', !!(await probeTask()));
  app.once('dialog', (d) => d.accept());
  await app.locator('#dailyRates li', { hasText: PROBE }).locator('button.purge').click(); await wait(500);
  const gone = !(await probeTask()) && await app.locator('#dailyRates li', { hasText: PROBE }).count() === 0;
  await app.click('.toast button'); await wait(500);
  const back = await probeTask();
  check('Daily tasks', 'Delete for good removes it and its ticks; Undo puts it back whole (L6)', gone && back?.doneDates.length === 10, JSON.stringify(back?.repeat));
  app.once('dialog', (d) => d.accept());
  await app.locator('#dailyRates li', { hasText: PROBE }).locator('button.purge').click(); await wait(500);
  const { unlabeled } = await import('./panel.mjs');
  check('Layout', 'every Stats control has a label', !(await probeTask()) && (await unlabeled(app)).length === 0, (await unlabeled(app)).join(', '));
}
```

In `test/e2e/full.mjs`, replace:

```js
await onPageChecks(harness, pan);

```

with:

```js
await onPageChecks(harness, pan);
const { statsChecks } = await import('./stats.mjs');
await statsChecks(harness);

```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run e2e`

Expected: `FAIL [Stats] #stats opens the Stats view with six figures (L7)`; the run then stops with `page.getAttribute: Timeout 30000ms exceeded` waiting for `#heatmap .hm-cell[data-iso="<today>"]`, and `npm run e2e` exits non-zero.

- [ ] **Step 3: Add the two daily-task actions**

In `src/ui/components/task-actions.js`, replace:

```js
import { shortDate, today } from '../../lib/dates.js';
```

with:

```js
import { shortDate, today, addDays } from '../../lib/dates.js';
```

In `src/ui/components/task-actions.js`, replace:

```js

export const setPriority = guarded(/** @param {Task} t @param {Priority} p */ async (t, p) => updateTask(t.id, { priority: p }));
```

with:

```js

/** Repeat a stopped daily task again (L6); Undo stops it on the same day as before. */
export const restart = guarded(/** @param {Task} t */ async (t) => {
  const until = t.repeat?.until;
  if (!t.repeat || !until) return;
  await restoreRecurring(t.id);
  toast(`“${t.title}” repeats again.`, () => archiveRecurring(t.id, addDays(until, 1)));
});

/**
 * Delete for good (L6): the task and every tick it had. The one hard delete of a
 * daily task, so it asks first; Undo still puts it back, id and ticks included.
 */
export const purge = guarded(/** @param {Task} t */ async (t) => {
  if (!confirm(`Delete “${t.title}” and all its ticks? The calendar and stats forget it.`)) return;
  const snapshot = { ...t };
  await deleteTask(t.id);
  toast('Deleted for good.', () => restoreTask(snapshot));
});

export const setPriority = guarded(/** @param {Task} t @param {Priority} p */ async (t, p) => updateTask(t.id, { priority: p }));
```

- [ ] **Step 4: Write the Stats view and the daily tasks list**

Create `src/ui/app/stats-view.js`:

```js
// The Stats view (spec L7, from dailies.html): the figures, a year of days shaded
// like the calendar, how each weekday goes, and the daily tasks (daily-tasks.js).
import { $, h, clear } from '../components/dom.js';
import { yearRows, summary, heatmap, weekdayRates, pct, WEEKDAYS } from '../../lib/stats.js';
import { today, longDate } from '../../lib/dates.js';
import * as daily from './daily-tasks.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/stats.js').DayRow} DayRow */

/** The calendar's shading: marker wash → marker. @param {number | null} p */
const shade = (p) => (p === null ? {} : { background: `color-mix(in srgb, var(--marker) ${p}%, var(--marker-wash))` });

/** @param {ReturnType<typeof summary>} s */
function figures(s) {
  const fig = (/** @type {string | number} */ n, /** @type {string} */ label) =>
    h('div', { class: 'figure' }, h('b', {}, String(n)), h('span', {}, label));
  clear($('#statFigures'));
  $('#statFigures').append(
    fig(s.current, s.current === 1 ? 'day in a row, so far' : 'days in a row, so far'),
    fig(s.longest, 'longest run'),
    fig(s.perfect, 'days with everything done'),
    fig(`${s.average}%`, 'done on an average day'),
    fig(s.daily, s.daily === 1 ? 'daily task' : 'daily tasks'),
    fig(s.noteDays, 'days with a note'));
}

/** @param {DayRow | null} c */
function square(c) {
  if (!c) return h('i', { class: 'hm-cell blank' });
  const p = pct(c);
  return h('i', { class: p === null ? 'hm-cell' : 'hm-cell on', style: shade(p), dataset: { iso: c.iso },
    title: `${longDate(c.iso)}: ${c.total ? `${c.done} of ${c.total} done` : 'nothing on'}` });
}

/** @param {DayRow[]} rows */
function year(rows) {
  const { weeks, months } = heatmap(rows);
  clear($('#hmMonths'));
  clear($('#heatmap'));
  $('#hmMonths').append(...months.map((m) => h('span', {}, m)));
  $('#heatmap').append(...weeks.flat().map(square));
}

/** Monday first, like the rest of Weekly. @param {DayRow[]} rows */
function weekdays(rows) {
  const rates = weekdayRates(rows);
  const order = [1, 2, 3, 4, 5, 6, 0];
  clear($('#weekdayBars'));
  $('#weekdayBars').append(...order.map((d) => {
    const r = rates[d] ?? null;
    const p = r === null ? null : Math.round(r * 100);
    return h('div', { class: 'wd-row' }, h('span', {}, WEEKDAYS[d]),
      h('span', { class: 'wd-track' }, p === null ? null : h('i', { style: { width: `${p}%` } })),
      h('span', { class: 'wd-pct' }, p === null ? '–' : `${p}%`));
  }));
  const known = order.filter((d) => rates[d] !== null);
  const best = known.reduce((b, d) => ((rates[d] ?? 0) > (rates[b] ?? 0) ? d : b), known[0] ?? -1);
  const worst = known.reduce((w, d) => ((rates[d] ?? 0) < (rates[w] ?? 0) ? d : w), known[0] ?? -1);
  $('#weekdayNote').textContent = known.length && rates[best] !== rates[worst]
    ? `Strongest on ${WEEKDAYS[best]}, weakest on ${WEEKDAYS[worst]}.`
    : known.length ? '' : 'Nothing to go on yet. Tick a few days and this fills in.';
}

/** @param {Task[]} tasks @param {Note[]} notes */
export function render(tasks, notes) {
  const rows = yearRows(tasks, today());
  figures(summary(rows, tasks, notes));
  year(rows);
  weekdays(rows);
  daily.render(tasks);
}
```

Create `src/ui/app/daily-tasks.js`:

```js
// The daily tasks list on the Stats view (spec L6, L7): each recurring task's
// completion over the last year, Stop repeating (history kept), Repeat again,
// and Delete for good, the one confirmed hard delete of a daily task.
import { $, h, clear } from '../components/dom.js';
import { taskRates } from '../../lib/stats.js';
import { isArchived } from '../../lib/tasks.js';
import { today, shortDate } from '../../lib/dates.js';
import * as act from '../components/task-actions.js';

/** @typedef {import('../../lib/stats.js').TaskRate} TaskRate */

/** @param {TaskRate} r @param {boolean} stopped */
function row(r, stopped) {
  const t = r.task;
  const p = r.rate === null ? null : Math.round(r.rate * 100);
  const when = stopped && t.repeat?.until ? `stopped ${shortDate(t.repeat.until)} · ` : '';
  return h('li', { class: 'rate-row', dataset: { id: t.id } },
    h('div', { class: 't-main' }, h('span', { class: 't-title' }, t.title),
      h('span', { class: 't-meta' }, `${when}${r.live ? `${r.hit} of ${r.live} day${r.live === 1 ? '' : 's'}` : 'no days yet'}`)),
    h('span', { class: 'wd-track' }, p === null ? null : h('i', { style: { width: `${p}%` } })),
    h('span', { class: 'wd-pct' }, p === null ? '–' : `${p}%`),
    h('div', { class: 'rate-acts' },
      stopped
        ? h('button', { class: 'quiet restart', on: { click: () => void act.restart(t) } }, 'Repeat again')
        : h('button', { class: 'quiet stop', on: { click: () => void act.remove(t, today()) } }, 'Stop repeating'),
      h('button', { class: 'quiet danger purge', attrs: { 'aria-label': `Delete ${t.title} for good` },
        on: { click: () => void act.purge(t) } }, 'Delete…')));
}

/** @param {import('../../lib/tasks.js').Task[]} tasks */
export function render(tasks) {
  const ref = today();
  const rates = taskRates(tasks, ref);
  const active = rates.filter((r) => !isArchived(r.task, ref));
  const stopped = rates.filter((r) => isArchived(r.task, ref));
  clear($('#dailyRates'));
  $('#dailyRates').append(...(active.length ? active.map((r) => row(r, false))
    : [h('li', { class: 'none' }, 'No daily tasks yet. Add one in a day’s sheet on the Calendar.')]));
  $('#stoppedWrap').hidden = !stopped.length;
  $('#stoppedCount').textContent = String(stopped.length);
  clear($('#stoppedList'));
  $('#stoppedList').append(...stopped.map((r) => row(r, true)));
}
```

- [ ] **Step 5: Add the view to the app**

In `src/ui/app/app.html`, replace:

```html
    <button id="nav-notes" data-view="notes">Notes</button>
    <a id="nav-report" href="../report/report.html">Week report</a>
```

with:

```html
    <button id="nav-notes" data-view="notes">Notes</button>
    <button id="nav-stats" data-view="stats">Stats</button>
    <a id="nav-report" href="../report/report.html">Week report</a>
```

In `src/ui/app/app.html`, replace:

```html
  </section>
</main>
```

with:

```html
  </section>

  <section id="view-stats" class="view" aria-labelledby="statsTitle" hidden>
    <h2 id="statsTitle" class="vh">Stats</h2>
    <div id="statFigures" class="figures"></div>
    <h3>The last 365 days</h3>
    <div class="hm-scroll">
      <div id="hmMonths" class="hm-months" aria-hidden="true"></div>
      <div id="heatmap" class="heatmap" role="img" aria-label="A year of days, shaded by how much of each got done"></div>
    </div>
    <p class="hint">Each square is a day, shaded like the calendar. Blank squares had nothing on them.</p>
    <h3>By weekday</h3>
    <div id="weekdayBars" class="wd-bars"></div>
    <p id="weekdayNote" class="hint"></p>
    <h3>Daily tasks</h3>
    <p class="hint">How often each one was ticked on the days it was due, over the last year.</p>
    <ul id="dailyRates" class="rows rates"></ul>
    <details id="stoppedWrap" class="stopped" hidden>
      <summary>Stopped daily tasks (<span id="stoppedCount">0</span>)</summary>
      <p class="hint">They no longer appear on new days. Their past ticks still count in the calendar and here.</p>
      <ul id="stoppedList" class="rows rates"></ul>
    </details>
  </section>
</main>
```

In `src/ui/app/app.js`, replace:

```js
// Hash routes: #calendar (default), #tasks, #notes, #day=YYYY-MM-DD (opens that day's sheet).
```

with:

```js
// Hash routes: #calendar (default), #tasks, #notes, #stats, #day=YYYY-MM-DD (opens that day's sheet).
```

In `src/ui/app/app.js`, replace:

```js
import * as editor from './task-editor.js';
import { mountNotes } from '../components/notes-view.js';
```

with:

```js
import * as editor from './task-editor.js';
import * as stats from './stats-view.js';
import { mountNotes } from '../components/notes-view.js';
```

In `src/ui/app/app.js`, replace:

```js
/** @typedef {'calendar' | 'tasks' | 'notes'} View */

/** @type {{ tasks: Task[], view: View }} */
const state = { tasks: [], view: 'calendar' };
```

with:

```js
/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {'calendar' | 'tasks' | 'notes' | 'stats'} View */
const VIEWS = /** @type {View[]} */ (['calendar', 'tasks', 'notes', 'stats']);

/** @type {{ tasks: Task[], notes: Note[], view: View }} */
const state = { tasks: [], notes: [], view: 'calendar' };
```

In `src/ui/app/app.js`, replace:

```js
  else if (state.view === 'tasks') tasksView.render(state.tasks);
  sheet.render(state.tasks);
```

with:

```js
  else if (state.view === 'tasks') tasksView.render(state.tasks);
  else if (state.view === 'stats') stats.render(state.tasks, state.notes);
  sheet.render(state.tasks);
```

In `src/ui/app/app.js`, replace:

```js
  for (const v of /** @type {View[]} */ (['calendar', 'tasks', 'notes'])) {
```

with:

```js
  for (const v of VIEWS) {
```

In `src/ui/app/app.js`, replace:

```js
  show(location.hash === '#tasks' ? 'tasks' : location.hash === '#notes' ? 'notes' : 'calendar');
```

with:

```js
  const view = /** @type {View} */ (location.hash.slice(1));
  show(VIEWS.includes(view) ? view : 'calendar');
```

In `src/ui/app/app.js`, replace:

```js
  // Notes keep themselves current; the insights redraw with them (F5).
  mountNotes($('#notesHost'), { onRender: (notes) => renderInsights($('#insights'), notes) });
```

with:

```js
  // Notes keep themselves current; the insights redraw with them (F5), and Stats counts days with a note.
  mountNotes($('#notesHost'), { onRender: (notes) => {
    state.notes = notes;
    renderInsights($('#insights'), notes);
    if (state.view === 'stats') render();
  } });
```

In `src/ui/app/app.css`, replace:

```css
@media (max-width: 760px) { .notes-view:not([hidden]) { grid-template-columns: 1fr; } }

```

with:

```css
@media (max-width: 760px) { .notes-view:not([hidden]) { grid-template-columns: 1fr; } }

/* Stats (L7): figures on a ruled strip like the report's week, a year of days shaded like the calendar. */
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
#view-stats h3 { font: 600 16px/1.3 var(--serif); margin: 26px 0 8px; border-bottom: 2px solid var(--ink); padding-bottom: 4px; }
.figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); border: 1px solid var(--rule); border-radius: 4px; background: var(--sheet); }
.figure { display: grid; gap: 2px; padding: 10px 12px 12px; border-right: 1px solid var(--rule); }
.figure b { font: 600 28px/1.1 var(--serif); font-variant-numeric: tabular-nums; }
.figure span { color: var(--muted); font-size: 12px; }
.hm-scroll { overflow-x: auto; padding-bottom: 6px; }
.hm-months, .heatmap { display: grid; grid-auto-flow: column; grid-auto-columns: 12px; gap: 3px; width: max-content; }
.heatmap { grid-template-rows: repeat(7, 12px); }
.hm-months span { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: visible; height: 16px; }
.hm-cell { width: 12px; height: 12px; border-radius: 2px; border: 1px solid var(--rule); }
.hm-cell.on { border-color: transparent; }
.hm-cell.blank { border-color: transparent; }
.wd-bars { display: grid; gap: 4px; max-width: 560px; }
.wd-row, .rate-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 10px; align-items: center; font-size: 13px; }
.wd-track { height: 10px; border-radius: 2px; background: var(--marker-wash); overflow: hidden; }
.wd-track i { display: block; height: 100%; background: var(--marker); border-radius: 2px 6px 3px 7px; }
.wd-pct { color: var(--muted); font-variant-numeric: tabular-nums; text-align: right; }
.rates .rate-row { grid-template-columns: minmax(0, 1.4fr) minmax(80px, 1fr) 44px auto; padding: 7px 0; border-bottom: 1px solid var(--rule); }
.rate-acts { display: flex; gap: 2px; }
.stopped { margin-top: 14px; }
.stopped summary { cursor: pointer; color: var(--navy); font-weight: 600; }
@media (max-width: 560px) { .rates .rate-row { grid-template-columns: minmax(0, 1fr) 44px; } .rates .wd-track { display: none; } .rate-acts { grid-column: 1 / -1; } }

```

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 294` in each timezone, typecheck clean, `248/248 passed` (238 + 10: `[Stats]` 4, `[Layout]` 2, `[Daily tasks]` 4). Look at `.e2e/shots/stats.png`: the figures sit on one ruled strip, the year is a grid of small squares in marker shades, the bars are marker strokes on a wash, the daily tasks are ruled rows with quiet buttons; nothing new is a card or a colour outside the tokens.

---

### Task 3: Theme: light, dark or the computer's (F6, L8)

One setting, `theme`, default `'system'`. Every page imports `components/theme.js` first; it sets `<html data-theme="light|dark">` (nothing for System) and follows later changes, so a choice made in the report reaches an open side panel without a reload. `styles.css` keeps one set of light tokens and lists the dark values twice: under `[data-theme="dark"]`, and under `prefers-color-scheme: dark` unless `[data-theme="light"]` (the boring, compatible way; `light-dark()` would need a Chrome 123 floor). The control is a select in Settings → Appearance that saves at once. The on-page note cannot load Weekly's stylesheet: the worker's `notes:list` answer carries `theme`, and the note sets a `.dark` class on its box.

No settings migration is written: `readSettings` fills `theme` from the defaults on every read, so the Phase 3 order of `onInstalled` (`migrateFridayFlag` then `setup` on update, `updateSettings({})` then `setup` on install) is untouched.

**Files:**
- Create: `src/ui/components/theme.js`, `test/e2e/theme.mjs`
- Modify: `src/lib/settings.js`, `src/background/onpage.js`, `src/content/onpage-note.js`, `src/ui/styles.css`, `src/ui/panel/panel.js`, `src/ui/app/app.js`, `src/ui/remind/remind.js`, `src/ui/report/main.js`, `src/ui/welcome/welcome.js`, `src/ui/report/report.html`, `src/ui/report/settings-panel.js`, `test/settings.test.js`, `test/background/onpage.test.js`, `test/e2e/full.mjs`

**Interfaces:**
- Consumes: `getSettings`, `updateSettings`, `onSettingsChanged`, `readSettings` (`lib/settings.js`).
- Produces: `DEFAULTS.theme = 'system'`, `THEMES = ['system', 'light', 'dark']`, `Settings.theme: string` (`lib/settings.js`); `applyTheme(theme)` (`components/theme.js`); `notes:list` answers `{ ok, theme, notes }`; `#theme` select in the report's Settings. `test/e2e/theme.mjs` exports `themeChecks(t, rep, pan)`; it leaves the theme on System and the pages on a light colour scheme.

- [ ] **Step 1: Write the failing unit tests**

In `test/settings.test.js`, replace:

```js
  assert.equal((await getSettings()).morning.enabled, true, 'once the slots exist, a stray old flag decides nothing');
});

```

with:

```js
  assert.equal((await getSettings()).morning.enabled, true, 'once the slots exist, a stray old flag decides nothing');
});

test('theme: light, dark or system (F6); system by default, anything else falls back to it', async () => {
  const { getSettings, updateSettings, readSettings, THEMES } = await import('../src/lib/settings.js');
  assert.deepEqual(THEMES, ['system', 'light', 'dark']);
  assert.equal((await getSettings()).theme, 'system');
  assert.equal((await updateSettings({ theme: 'dark' })).theme, 'dark');
  assert.equal(readSettings({ theme: 'neon' }).theme, 'system');
  assert.equal(readSettings({ theme: { toString: () => 'dark' } }).theme, 'system');
});

```

In `test/background/onpage.test.js`, replace:

```js

test('notes:save creates or edits a plain note; it cannot touch a private one or make one', async () => {
```

with:

```js

test('notes:list carries the theme as data, since the page’s note cannot load Weekly’s styles (F6)', async () => {
  assert.equal((await ask({ type: 'notes:list' })).theme, 'system');
  await chrome.storage.local.set({ settings: { theme: 'dark' } });
  assert.equal((await ask({ type: 'notes:list' })).theme, 'dark');
  await chrome.storage.local.remove('settings');
});

test('notes:save creates or edits a plain note; it cannot touch a private one or make one', async () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/settings.test.js test/background/onpage.test.js`

Expected: `not ok … - notes:list carries the theme as data, since the page’s note cannot load Weekly’s styles (F6)` and `not ok … - theme: light, dark or system (F6); system by default, anything else falls back to it`; `# fail 2`.

- [ ] **Step 3: Add the setting, and send it to the on-page note**

In `src/lib/settings.js`, replace:

```js
  catchUpOnStartup: true,
});
const KEY = 'settings';
```

with:

```js
  catchUpOnStartup: true,
  // Light, dark, or whatever the computer uses (F6, L8).
  theme: 'system',
});
export const THEMES = Object.freeze(['system', 'light', 'dark']);
const KEY = 'settings';
```

In `src/lib/settings.js`, replace:

```js
 *   catchUpOnStartup: boolean } & Record<string, unknown>} Settings
```

with:

```js
 *   catchUpOnStartup: boolean, theme: string } & Record<string, unknown>} Settings
```

In `src/lib/settings.js`, replace:

```js
    defaultPriority: /** @type {readonly unknown[]} */ (PRIORITIES).includes(s.defaultPriority) ? s.defaultPriority : DEFAULTS.defaultPriority,
  };
```

with:

```js
    defaultPriority: /** @type {readonly unknown[]} */ (PRIORITIES).includes(s.defaultPriority) ? s.defaultPriority : DEFAULTS.defaultPriority,
    theme: /** @type {readonly unknown[]} */ (THEMES).includes(s.theme) ? s.theme : DEFAULTS.theme,
  };
```

In `src/background/onpage.js`, replace:

```js
import { getNotes, createNote, updateNote, deleteNote, sortNotes } from '../lib/notes.js';

```

with:

```js
import { getNotes, createNote, updateNote, deleteNote, sortNotes } from '../lib/notes.js';
import { getSettings } from '../lib/settings.js';

```

In `src/background/onpage.js`, replace:

```js
  'notes:list': async () => ({ ok: true, notes: sortNotes((await getNotes()).filter((n) => !n.enc)).slice(0, LIST_MAX).map(forPage) }),
```

with:

```js
  // The theme travels as data: a web page cannot load Weekly's stylesheet (F6).
  'notes:list': async () => ({ ok: true, theme: (await getSettings()).theme,
    notes: sortNotes((await getNotes()).filter((n) => !n.enc)).slice(0, LIST_MAX).map(forPage) }),
```

- [ ] **Step 4: Run them to see them pass**

Run: `node --test test/settings.test.js test/background/onpage.test.js`

Expected: `# fail 0`.

- [ ] **Step 5: Write the failing end-to-end checks**

Create `test/e2e/theme.mjs`:

```js
// Theme: light, dark or the computer's (spec F6, L8), on every page and, as data, the on-page note.
// Dark paper and dark sheet (the side panel and the reminder window sit on the sheet); light paper.
const DARK = 'rgb(20, 23, 31)', DARK_SHEET = 'rgb(28, 32, 42)', LIGHT = 'rgb(246, 244, 238)';
const bg = (p) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
const isDark = (c) => c === DARK || c === DARK_SHEET;

export async function themeChecks(t, rep, pan) {
  const { ctx, X, check, watch, store, wait, PAGES } = t;
  await rep.bringToFront(); await rep.emulateMedia({ colorScheme: 'light' });
  if (!await rep.isVisible('#role')) await rep.click('summary:has-text("Settings")');
  const opts = (await rep.locator('#theme option').allTextContents()).join(',');
  check('Theme', 'Settings offers the computer’s choice, Light or Dark; the computer’s by default (F6)', opts === 'Same as this computer,Light,Dark' && (await rep.inputValue('#theme')) === 'system', opts);
  await rep.selectOption('#theme', 'dark'); await wait(500);
  check('Theme', 'Dark applies to the report at once, whatever the computer uses (F6)', (await store()).settings.theme === 'dark' && await bg(rep) === DARK, await bg(rep));
  const app = watch(await ctx.newPage()); await app.goto(`${X}/${PAGES.app}`); await wait(600);
  check('Theme', 'the side panel follows without a reload, and the app opens dark (F6)', isDark(await bg(pan)) && await bg(app) === DARK, `${await bg(pan)} ${await bg(app)}`);
  const others = [];
  for (const path of [PAGES.welcome, `${PAGES.remind}?slot=morning`]) {
    const p = watch(await ctx.newPage()); await p.goto(`${X}/${path}`); await wait(600);
    others.push(await bg(p)); await p.close();
  }
  check('Theme', 'the welcome page and the reminder window use it too (F6)', others.every(isDark), others.join(' '));
  const r = await rep.evaluate(() => chrome.runtime.sendMessage({ type: 'notes:list' }));
  check('Theme', 'the on-page note is told the theme as data, not a stylesheet (F6)', r?.ok && r.theme === 'dark', JSON.stringify(r?.theme));
  await rep.selectOption('#theme', 'light'); await wait(400);
  await app.emulateMedia({ colorScheme: 'dark' }); await wait(200);
  check('Theme', 'Light stays light when the computer is dark (F6)', await bg(app) === LIGHT, await bg(app));
  await rep.selectOption('#theme', 'system'); await wait(400);
  const sysDark = await bg(app);
  await app.emulateMedia({ colorScheme: 'light' }); await wait(200);
  check('Theme', 'the computer’s choice follows it, dark then light (L8)', sysDark === DARK && await bg(app) === LIGHT, `${sysDark} ${await bg(app)}`);
  await app.close();
}
```

In `test/e2e/full.mjs`, replace:

```js
await commandChecks(harness);

```

with:

```js
await commandChecks(harness);
const { themeChecks } = await import('./theme.mjs');
await themeChecks(harness, rep, pan);

```

- [ ] **Step 6: Run them to see them fail**

Run: `npm run e2e`

Expected: `FAIL [Theme] Settings offers the computer’s choice, Light or Dark; the computer’s by default (F6)`, then the run stops with `page.selectOption: Timeout 30000ms exceeded` waiting for `#theme`, and `npm run e2e` exits non-zero.

- [ ] **Step 7: Theme the stylesheet and every page**

In `src/ui/styles.css`, replace:

```css
@media (prefers-color-scheme: dark) {
  :root {
```

with:

```css
/* Dark: chosen in Settings (data-theme="dark"), or the computer's choice when the theme is System (F6, L8). */
:root[data-theme="dark"] {
  --paper: #14171f;
  --sheet: #1c202a;
  --ink: #e9e6dd;
  --muted: #a0a7b6;
  --faint: #7d8494;
  --rule: #2d3340;
  --rule-strong: #6b7385;
  --navy: #9dbcec;
  --on-navy: #0f1a30;
  --marker: #e0bd3a;
  --marker-ink: #1a1500;
  --marker-wash: #3a3312;
  --danger: #f0958e;
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
```

Create `src/ui/components/theme.js`:

```js
// Light, dark or the computer's choice (F6, L8). Every Weekly page imports this
// first: it marks <html data-theme> from Settings and follows later changes, so
// a choice made in one tab reaches the others without a reload. System leaves the
// attribute off and styles.css follows prefers-color-scheme.
import { getSettings, onSettingsChanged } from '../../lib/settings.js';

/** @param {string} theme */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset['theme'] = theme;
  else delete root.dataset['theme'];
}

void getSettings().then((s) => applyTheme(s.theme), () => undefined);
onSettingsChanged((s) => applyTheme(s.theme));
```

In `src/ui/panel/panel.js`, replace:

```js
// itself current from storage changes.
import { $, h } from '../components/dom.js';
```

with:

```js
// itself current from storage changes.
import '../components/theme.js';
import { $, h } from '../components/dom.js';
```

In `src/ui/app/app.js`, replace:

```js
// Hash routes: #calendar (default), #tasks, #notes, #stats, #day=YYYY-MM-DD (opens that day's sheet).
import { $, $$ } from '../components/dom.js';
```

with:

```js
// Hash routes: #calendar (default), #tasks, #notes, #stats, #day=YYYY-MM-DD (opens that day's sheet).
import '../components/theme.js';
import { $, $$ } from '../components/dom.js';
```

In `src/ui/remind/remind.js`, replace:

```js
// it links to the week report: the nudge that replaced Weekly 2's Friday reminder.
import { $, h } from '../components/dom.js';
```

with:

```js
// it links to the week report: the nudge that replaced Weekly 2's Friday reminder.
import '../components/theme.js';
import { $, h } from '../components/dom.js';
```

In `src/ui/report/main.js`, replace:

```js
// Report page: owns the loaded week and orchestrates loading and rendering. Panels wire their own controls.
import { $ } from '../components/dom.js';
```

with:

```js
// Report page: owns the loaded week and orchestrates loading and rendering. Panels wire their own controls.
import '../components/theme.js';
import { $ } from '../components/dom.js';
```

In `src/ui/welcome/welcome.js`, replace:

```js
// First-run page: role, history backfill, reminders and name hiding. Each choice saves as soon as it changes.
import { $ } from '../components/dom.js';
```

with:

```js
// First-run page: role, history backfill, reminders and name hiding. Each choice saves as soon as it changes.
import '../components/theme.js';
import { $ } from '../components/dom.js';
```

- [ ] **Step 8: Add the control to Settings**

In `src/ui/report/report.html`, replace:

```html
      <fieldset>
        <legend>Tracking</legend>
```

with:

```html
      <fieldset>
        <legend>Appearance</legend>
        <label>Theme
          <select id="theme">
            <option value="system">Same as this computer</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select></label>
        <p class="hint">Changes every Weekly page, and the note you open on a web page, straight away.</p>
      </fieldset>
      <fieldset>
        <legend>Tracking</legend>
```

In `src/ui/report/settings-panel.js`, replace:

```js
  $('#slackWebhook').value = s.slackWebhook;
  fillReminders(s);
```

with:

```js
  $('#slackWebhook').value = s.slackWebhook;
  $('#theme').value = s.theme;
  fillReminders(s);
```

In `src/ui/report/settings-panel.js`, replace:

```js
  $('#saveSettings').onclick = saveSettings;
  $('#openSettings').onclick = openSettings;
```

with:

```js
  $('#saveSettings').onclick = saveSettings;
  // The theme applies at once (every page follows settings), not on Save.
  $('#theme').onchange = e => updateSettings({ theme: e.target.value }).catch(err => msg('#settingsMsg', err.message));
  $('#openSettings').onclick = openSettings;
```

- [ ] **Step 9: Theme the on-page note from the data it is given**

In `src/content/onpage-note.js`, replace:

```js
@media (prefers-color-scheme: dark) {
  .box, input, textarea, select { background: #1c202a; color: #e9e6dd; border-color: #6b7385; }
  button { color: #9dbcec; border-color: #6b7385; } button.primary { background: #9dbcec; border-color: #9dbcec; color: #0f1a30; }
  li button.open { color: #e9e6dd; } ul, li { border-color: #2d3340; } .msg { color: #a0a7b6; }
}`;
```

with:

```js
.dark, .dark input, .dark textarea, .dark select { background: #1c202a; color: #e9e6dd; border-color: #6b7385; }
.dark button { color: #9dbcec; } .dark button:not(.quiet) { border-color: #6b7385; }
.dark button.primary { background: #9dbcec; border-color: #9dbcec; color: #0f1a30; }
.dark li button.open { color: #e9e6dd; } .dark ul, .dark li { border-color: #2d3340; } .dark .msg { color: #a0a7b6; }`;
```

In `src/content/onpage-note.js`, replace:

```js
    const r = await ask('notes:list');
    list.replaceChildren(...(r.ok ? r.notes.map(row) : []));
```

with:

```js
    const r = await ask('notes:list');
    // Weekly's theme arrives as data (F6): Dark, Light, or the computer's choice for System.
    box.classList.toggle('dark', r.theme === 'dark' || (r.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches));
    list.replaceChildren(...(r.ok ? r.notes.map(row) : []));
```

- [ ] **Step 10: Run the gate**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 296` in each timezone (294 + 2), typecheck clean, `255/255 passed` (248 + 7 `[Theme]`). The existing `[Layout] dark mode applies` check still passes: with the theme on System, the report follows the emulated dark scheme.

---

### Task 4: The Phase 3 review's parked findings

Four small fixes the Phase 3 review parked for this phase, before the import (Task 8) brings in tasks Weekly did not write:
- **m3:** clearing a reminder time and pressing Save stored the default and said "Settings saved." Now Save refuses in words and stores nothing.
- **m5:** `isOverdue` did not exclude recurring tasks. A coerced recurring task always has `dueDate: null`, but a hand-edited or third-party file that reaches storage some other way must still never put a daily task in Overdue.
- **`resetReminderState`** had no lock and no caller: deleted.
- **`snoozeUntil`** was written and never read (the snooze is the alarm): dropped from the type, the defaults, the coercion and both writers. A stored one is dropped by `coerceReminderState` on the next write.

**Files:**
- Modify: `src/lib/task-views.js`, `src/lib/schema.js`, `src/lib/storage.js`, `src/background/reminders.js`, `src/ui/report/reminder-settings.js`, `src/ui/report/settings-panel.js`
- Test: `test/tasks.test.js`, `test/schema.test.js`, `test/storage-locks.test.js`, `test/background/reminders.test.js`, `test/e2e/reminders.mjs`

**Interfaces:**
- Produces: `ReminderState = {morningLastShown, eveningLastShown}` (no `snoozeUntil`); `snooze(minutes)` only sets the `weekly:snooze` alarm; `reminderError() → string` (`''` when the Reminders group is valid) in `report/reminder-settings.js`.
- Removes: `resetReminderState` (`lib/storage.js`). Nothing imports it.

- [ ] **Step 1: Write the failing unit tests**

In `test/tasks.test.js`, replace:

```js
  assert.ok(!isOverdue(DONE_LATE, REF), 'a completed task is never late');
});
```

with:

```js
  assert.ok(!isOverdue(DONE_LATE, REF), 'a completed task is never late');
});

test('a recurring task is never overdue, even one carrying a stray due date (a hand-edited import)', () => {
  const daily = { ...task({ id: 'd', repeat: { days: [1, 2, 3, 4, 5], from: '2026-08-01', until: null } }), dueDate: '2026-08-01' };
  assert.ok(!isOverdue(daily, REF));
  assert.deepEqual(sectionsFor([daily, LATE], 'overdue', REF).flatMap((s) => s.tasks.map((t) => t.id)), ['late']);
});
```

In `test/schema.test.js`, replace:

```js
  const r = coerceReminderState({ morningLastShown: 'yesterday', eveningLastShown: '2026-08-19', snoozeUntil: 'soon' });
  assert.equal(r.morningLastShown, null);
  assert.equal(r.eveningLastShown, '2026-08-19');
  assert.equal(r.snoozeUntil, null);
```

with:

```js
  const r = coerceReminderState({ morningLastShown: 'yesterday', eveningLastShown: '2026-08-19', snoozeUntil: 1 });
  assert.equal(r.morningLastShown, null);
  assert.equal(r.eveningLastShown, '2026-08-19');
  assert.deepEqual(Object.keys(r), ['morningLastShown', 'eveningLastShown'], 'a stored snoozeUntil (never read) is dropped');
```

In `test/storage-locks.test.js`, replace:

```js
    await updateReminderState({ snoozeUntil: null });
```

with:

```js
    await updateReminderState({ morningLastShown: null });
```

In `test/background/reminders.test.js`, replace:

```js
    reminderState: { morningLastShown: null, eveningLastShown: null, snoozeUntil: null, ...reminderState },
```

with:

```js
    reminderState: { morningLastShown: null, eveningLastShown: null, ...reminderState },
```

In `test/background/reminders.test.js`, replace:

```js
test('snooze brings the evening check back in an hour and records it', async () => {
```

with:

```js
test('snooze brings the evening check back in an hour; the alarm is the only record', async () => {
```

In `test/background/reminders.test.js`, replace:

```js
  assert.equal(reminderState.snoozeUntil, when);
```

with:

```js
  assert.deepEqual(reminderState, { morningLastShown: null, eveningLastShown: null }, 'nothing reads a snooze time, so none is stored');
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`

Expected: three failures in the New York run (`npm test` stops there): `not ok … - snooze brings the evening check back in an hour; the alarm is the only record`, `not ok … - coerceReminderState discards non-dates so catch-up cannot be fooled` and `not ok … - a recurring task is never overdue, even one carrying a stray due date (a hand-edited import)`; `# tests 297`, `# fail 3`.

- [ ] **Step 3: Fix them**

In `src/lib/task-views.js`, replace:

```js
  t.status === 'open' && t.dueDate !== null && daysBetween(ref, t.dueDate) < 0;
```

with:

```js
  t.repeat === null && t.status === 'open' && t.dueDate !== null && daysBetween(ref, t.dueDate) < 0;
```

In `src/lib/schema.js`, replace:

```js
 * @property {number | null} snoozeUntil
```

with:

```js

```

In `src/lib/schema.js`, replace:

```js
 * @property {string | null} eveningLastShown

 */
```

with:

```js
 * @property {string | null} eveningLastShown
 */
```

In `src/lib/schema.js`, replace:

```js
  snoozeUntil: null,
```

with:

```js

```

In `src/lib/schema.js`, replace:

```js
  eveningLastShown: null,

});
```

with:

```js
  eveningLastShown: null,
});
```

In `src/lib/schema.js`, replace:

```js
    snoozeUntil: typeof raw['snoozeUntil'] === 'number' && Number.isFinite(raw['snoozeUntil'])
      ? raw['snoozeUntil']
      : null,
```

with:

```js

```

In `src/lib/schema.js`, replace:

```js
    eveningLastShown: day(raw['eveningLastShown']),

  };
```

with:

```js
    eveningLastShown: day(raw['eveningLastShown']),
  };
```

In `src/lib/storage.js`, replace:

```js
import { migrate, coerceReminderState, coerceUiState, defaultReminderState, SCHEMA_VERSION } from './schema.js';
```

with:

```js
import { migrate, coerceReminderState, coerceUiState, SCHEMA_VERSION } from './schema.js';
```

In `src/lib/storage.js`, replace:

```js
/** @returns {Promise<void>} */
export async function resetReminderState() {
  await chrome.storage.local.set({ [KEY_REMINDER]: defaultReminderState() });
}

```

with:

```js

```

In `src/lib/storage.js`, replace:

```js


/* ------------------------------------------------------------ change feed */
```

with:

```js

/* ------------------------------------------------------------ change feed */
```

In `src/background/reminders.js`, replace:

```js
  await updateReminderState({ [key]: ref, snoozeUntil: null });
```

with:

```js
  await updateReminderState({ [key]: ref });
```

In `src/background/reminders.js`, replace:

```js
  const when = Date.now() + minutes * 60_000;
  await updateReminderState({ snoozeUntil: when });
  await chrome.alarms.create(ALARM.snooze, { when });
```

with:

```js
  await chrome.alarms.create(ALARM.snooze, { when: Date.now() + minutes * 60_000 });
```

- [ ] **Step 4: Run them to see them pass**

Run: `npm test && npm run typecheck`

Expected: `# tests 297`, `# pass 297`, `# fail 0` in each timezone (296 + 1); typecheck clean.

- [ ] **Step 5: Write the failing end-to-end check (m3)**

In `test/e2e/reminders.mjs`, replace:

```js
  await win.click('#dismiss'); await wait(400);
  // Back to off for the rest of the suite (a real 08:30 or 17:45 must not open a window mid-run).
```

with:

```js
  await win.click('#dismiss'); await wait(400);
  await rep.fill('#morningTime', ''); await rep.click('#saveSettings'); await wait(500);
  c('a cleared reminder time is refused in words, not saved as the default', /Enter a time for the morning brief/.test(await rep.textContent('#settingsMsg'))
    && (await store()).settings.morning.time === '08:30', await rep.textContent('#settingsMsg'));
  await rep.fill('#morningTime', '08:30');
  // Back to off for the rest of the suite (a real 08:30 or 17:45 must not open a window mid-run).
```

- [ ] **Step 6: Run it to see it fail**

Run: `npm run e2e`

Expected: `FAIL [Settings] a cleared reminder time is refused in words, not saved as the default` (the message is "Settings saved." and the stored time is back to 09:00); `255/256 passed`.

- [ ] **Step 7: Refuse an empty reminder time on Save**

In `src/ui/report/reminder-settings.js`, replace:

```js
import { $, $$ } from '../components/dom.js';
import { msg } from './main.js';
```

with:

```js
import { $, $$ } from '../components/dom.js';
import { isValidTime } from '../../lib/dates.js';
import { msg } from './main.js';
```

In `src/ui/report/reminder-settings.js`, replace:

```js

const preview = slot => chrome.runtime.sendMessage({ type: 'reminder:preview', slot })
```

with:

```js

/** What is wrong with the Reminders group, in words, or '' (a cleared time would otherwise save as the default). */
export function reminderError() {
  if (!isValidTime($('#morningTime').value)) return 'Enter a time for the morning brief, for example 09:00.';
  if (!isValidTime($('#eveningTime').value)) return 'Enter a time for the evening check, for example 18:00.';
  return '';
}

const preview = slot => chrome.runtime.sendMessage({ type: 'reminder:preview', slot })
```

In `src/ui/report/settings-panel.js`, replace:

```js
import { fillReminders, readReminders } from './reminder-settings.js';
```

with:

```js
import { fillReminders, readReminders, reminderError } from './reminder-settings.js';
```

In `src/ui/report/settings-panel.js`, replace:

```js
  if (webhook && !validSlackWebhook(webhook)) return msg('#settingsMsg', 'That isn’t a Slack webhook URL (https://hooks.slack.com/services/...).');
  const settings = await updateSettings({
```

with:

```js
  if (webhook && !validSlackWebhook(webhook)) return msg('#settingsMsg', 'That isn’t a Slack webhook URL (https://hooks.slack.com/services/...).');
  if (reminderError()) return msg('#settingsMsg', reminderError());
  const settings = await updateSettings({
```

- [ ] **Step 8: Run the gate**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 297` in each timezone, typecheck clean, `256/256 passed`.

---

### Task 5: Track my week? (`tabs` optional, W3)

`tabs` moves to `optional_permissions`, so installing Weekly shows no "read your browsing history" warning (spec §1 success criterion 2). Tracking is on exactly when Chrome has granted `tabs`:
- The tracker checks the permission on every look and records nothing without it. The check matters even when Weekly can see one tab: Alt+N's `activeTab` would otherwise hand the tracker that page's address.
- The worker looks again on `permissions.onAdded` / `onRemoved`. This replaces the spec's `tracking:setEnabled` message: Chrome already tells the worker, so a message would only duplicate the event.
- The welcome page starts with **Track my week?** (spec §3.5). **Yes** calls `permissions.request` inside the click; **No thanks** leaves it off. The history fill (step 3) shows only with tracking on.
- Settings → Tracking gets the on/off checkbox (spec §3.2), which requests or removes `tabs` at once.
- The panel footer says "Tracking is off" and hides Pause.

The end-to-end harness keeps pre-granting `tabs` and `history` (moved from optional to required in its copy, since headless Chromium cannot click a permission prompt), and runs a second, untouched copy of the build through `test/e2e/no-tabs.mjs`.

**Files:**
- Create: `test/e2e/no-tabs.mjs`
- Replace whole: `src/lib/activity/status.js`
- Modify: `manifest.json`, `src/background/tracker.js`, `src/background/service-worker.js`, `src/ui/panel/footer.js`, `src/ui/welcome/welcome.html`, `src/ui/welcome/welcome.js`, `src/ui/welcome/welcome.css`, `src/ui/report/report.html`, `src/ui/report/settings-panel.js`
- Test: `test/helpers/chrome-stub.js`, `test/manifest.test.js`, `test/background/tracker.test.js`, `test/activity/status.test.js`, `test/background/service-worker.test.js`, `test/e2e/run.mjs`, `test/e2e/full.mjs`

**Interfaces:**
- Produces (`src/lib/activity/status.js`): `trackingAllowed() → Promise<boolean>`, `allowTracking() → Promise<boolean>` (call it straight from a click), `stopTracking() → Promise<boolean>`, `trackerStatus() → { current, error, tracking }`, `onTrackingChanged(cb)` also fires on `permissions.onAdded/onRemoved`.
- Produces (stub): `chrome.permissions.{contains, request, remove, onAdded, onRemoved}`; `setGranted(list)` (default `['tabs']`).
- DOM: `#trackStep` (first step), `#trackYes`, `#trackNo`, `#trackMsg`, `#fillStep` (hidden until tracking is on) on the welcome page; `#trackingOn`, `#trackingMsg` in the report's Settings → Tracking.

- [ ] **Step 1: Give the Chrome stub permissions, and write the failing unit tests**

In `test/helpers/chrome-stub.js`, replace:

```js
  const state = { idle: 'active', focused: true, tab: /** @type {any} */ (null), injectFails: false };
```

with:

```js
  // Permissions granted now; `tabs` is optional in the manifest (W3) and granted here unless a test says otherwise.
  const state = { idle: 'active', focused: true, tab: /** @type {any} */ (null), injectFails: false, granted: new Set(['tabs']) };
```

In `test/helpers/chrome-stub.js`, replace:

```js
    commands: { onCommand: event('commands.onCommand') },
    scripting: {
```

with:

```js
    commands: { onCommand: event('commands.onCommand') },
    permissions: {
      async contains(q) { return (q?.permissions ?? []).every((p) => state.granted.has(p)); },
      async request(q) { for (const p of q?.permissions ?? []) state.granted.add(p); return true; },
      async remove(q) { for (const p of q?.permissions ?? []) state.granted.delete(p); return true; },
      onAdded: event('permissions.onAdded'),
      onRemoved: event('permissions.onRemoved'),
    },
    scripting: {
```

In `test/helpers/chrome-stub.js`, replace:

```js
    setInjectFails: (f) => { state.injectFails = f; },
  };
```

with:

```js
    setInjectFails: (f) => { state.injectFails = f; },
    setGranted: (list) => { state.granted = new Set(list); },
  };
```

In `test/manifest.test.js`, replace:

```js
  assert.equal(manifest.content_scripts, undefined, 'injected on demand only');
});

```

with:

```js
  assert.equal(manifest.content_scripts, undefined, 'injected on demand only');
});

test('tabs is optional: the install asks for no browsing-history warning; Weekly asks when you turn tracking on (W3, spec §3.6)', () => {
  assert.equal(manifest.permissions.includes('tabs'), false);
  assert.ok(manifest.optional_permissions.includes('tabs') && manifest.optional_permissions.includes('history'));
});

```

In `test/background/tracker.test.js`, replace:

```js
  assert.ok(!day || Object.keys(day).length === 0);
});

```

with:

```js
  assert.ok(!day || Object.keys(day).length === 0);
});

test('without the tabs permission nothing is recorded; granting it starts tracking at the next look (W3)', async () => {
  await tick();
  stub.setGranted([]);
  await T.refresh();   // what the worker does on permissions.onRemoved
  for (let i = 0; i < 3; i++) await tick();
  assert.equal(min('jira:ENGX-1'), 1, 'only the minute before the permission went');
  assert.equal(stub.stores.session.current, null);
  stub.setGranted(['tabs']);
  await tick(); await tick();
  assert.equal(min('jira:ENGX-1'), 2);
});

```

In `test/activity/status.test.js`, replace:

```js
  assert.deepEqual(await trackerStatus(), { current: null, error: null });
  stub.stores.session.current = { url: 'https://a.example/', title: 'A' };
  stub.stores.session.error = 'QUOTA_BYTES quota exceeded';
  assert.deepEqual(await trackerStatus(), { current: { url: 'https://a.example/', title: 'A' }, error: 'QUOTA_BYTES quota exceeded' });
});

test('onTrackingChanged fires for tracked days, settings and session status only', () => {
```

with:

```js
  assert.deepEqual(await trackerStatus(), { current: null, error: null, tracking: true });
  stub.stores.session.current = { url: 'https://a.example/', title: 'A' };
  stub.stores.session.error = 'QUOTA_BYTES quota exceeded';
  assert.deepEqual(await trackerStatus(), { current: { url: 'https://a.example/', title: 'A' }, error: 'QUOTA_BYTES quota exceeded', tracking: true });
  stub.setGranted([]);
  assert.equal((await trackerStatus()).tracking, false, 'no tabs permission: tracking is off (W3)');
});

test('turning tracking on asks Chrome for tabs; off gives it back (W3)', async () => {
  const { allowTracking, stopTracking, trackingAllowed } = await import('../../src/lib/activity/status.js');
  stub.setGranted([]);
  assert.equal(await allowTracking(), true);
  assert.equal(await trackingAllowed(), true);
  await stopTracking();
  assert.equal(await trackingAllowed(), false);
});

test('onTrackingChanged fires for tracked days, settings, session status and the tabs permission only', () => {
```

In `test/activity/status.test.js`, replace:

```js
  off();
  assert.equal(stub.log.listeners['storage.onChanged']?.length, 0);
```

with:

```js
  for (const name of ['permissions.onAdded', 'permissions.onRemoved']) for (const fn of stub.log.listeners[name] ?? []) fn({ permissions: ['tabs'] });
  assert.equal(n, 5, 'granting or revoking tabs redraws the footer');
  off();
  assert.equal(stub.log.listeners['storage.onChanged']?.length, 0);
  assert.equal(stub.log.listeners['permissions.onAdded']?.length, 0);
```

In `test/background/service-worker.test.js`, replace:

```js
  assert.deepEqual(answers, [{ ok: true, tab: 'notes' }, { ok: true, tab: null }], 'the panel opens on Notes once');
});

```

with:

```js
  assert.deepEqual(answers, [{ ok: true, tab: 'notes' }, { ok: true, tab: null }], 'the panel opens on Notes once');
});

test('granting or revoking tabs makes the tracker look again: revoked, nothing is being timed (W3)', async () => {
  stub.setFocusedTab({ id: 7, url: 'https://acme.atlassian.net/browse/ENGX-7', title: 'ENGX-7', active: true });
  emit('permissions.onAdded', { permissions: ['tabs'] });
  await settle();
  assert.equal(stub.stores.session.current?.tabId, 7);
  stub.setGranted([]);
  emit('permissions.onRemoved', { permissions: ['tabs'] });
  await settle();
  assert.equal(stub.stores.session.current, null);
  stub.setGranted(['tabs']);
  stub.setFocusedTab(null);
});

```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`

Expected: six failures in the New York run (`npm test` stops there): `trackerStatus reads the worker’s session state, null when absent`, `turning tracking on asks Chrome for tabs; off gives it back (W3)`, `onTrackingChanged fires for tracked days, settings, session status and the tabs permission only`, `granting or revoking tabs makes the tracker look again: revoked, nothing is being timed (W3)`, `without the tabs permission nothing is recorded; granting it starts tracking at the next look (W3)`, `tabs is optional: the install asks for no browsing-history warning; Weekly asks when you turn tracking on (W3, spec §3.6)`; `# tests 301`, `# fail 6`.

- [ ] **Step 3: Make tabs optional, and track only with it**

In `manifest.json`, replace:

```json
  "permissions": ["tabs", "storage", "unlimitedStorage", "idle", "alarms", "notifications", "sidePanel", "scripting", "activeTab"],
  "optional_permissions": ["history"],
```

with:

```json
  "permissions": ["storage", "unlimitedStorage", "idle", "alarms", "notifications", "sidePanel", "scripting", "activeTab"],
  "optional_permissions": ["tabs", "history"],
```

Replace the whole of `src/lib/activity/status.js` with:

```js
// What the tracker is doing right now, for the side panel footer, and whether it
// may track at all. The worker writes `current` and `error` to storage.session;
// this is their read side. Tracking needs the optional "tabs" permission (W3,
// spec §3.6): without it Weekly is tasks and notes, and nothing is recorded.

/** @typedef {{ url: string, title?: string }} Current */

const TABS = { permissions: ['tabs'] };

/** @returns {Promise<boolean>} */
export const trackingAllowed = () => chrome.permissions.contains(TABS);
/** Asks Chrome; call it straight from a click, since Chrome only asks during a user gesture. @returns {Promise<boolean>} */
export const allowTracking = () => chrome.permissions.request(TABS);
/** @returns {Promise<boolean>} */
export const stopTracking = () => chrome.permissions.remove(TABS);

/** @returns {Promise<{ current: Current | null, error: string | null, tracking: boolean }>} */
export async function trackerStatus() {
  const [{ current, error }, tracking] = await Promise.all([chrome.storage.session.get(['current', 'error']), trackingAllowed()]);
  return { current: current ?? null, error: typeof error === 'string' ? error : null, tracking };
}

/**
 * Call `cb` when tracked time, settings, the tracker's status or the tabs permission change.
 * @param {() => void} cb @returns {() => void} unsubscribe
 */
export function onTrackingChanged(cb) {
  /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
  const listener = (changes, area) => {
    const keys = Object.keys(changes);
    if (area === 'session' ? keys.some((k) => k === 'current' || k === 'error')
      : area === 'local' && keys.some((k) => k === 'settings' || /^(day|imp|hist):/.test(k))) cb();
  };
  const perms = () => cb();
  // @types/chrome 0.0.268 leaves removeListener off these two events; Chrome has it.
  const events = /** @type {chrome.events.Event<() => void>[]} */ (/** @type {unknown} */ ([chrome.permissions.onAdded, chrome.permissions.onRemoved]));
  chrome.storage.onChanged.addListener(listener);
  for (const e of events) e.addListener(perms);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
    for (const e of events) e.removeListener(perms);
  };
}
```

In `src/background/tracker.js`, replace:

```js
import { dayKey } from '../lib/week.js';

```

with:

```js
import { dayKey } from '../lib/week.js';
import { trackingAllowed } from '../lib/activity/status.js';

```

In `src/background/tracker.js`, replace:

```js
// Look at what is focused right now and start/stop timing accordingly.
export async function refresh() {
```

with:

```js
// Look at what is focused right now and start/stop timing accordingly.
// Without the tabs permission (tracking off, W3) nothing is in front: the open session is closed and none starts.
// The check matters even then: Alt+N's activeTab would otherwise show one page's address.
export async function refresh() {
```

In `src/background/tracker.js`, replace:

```js
  if (!s.paused) {
```

with:

```js
  if (!s.paused && await trackingAllowed()) {
```

In `src/background/service-worker.js`, replace:

```js
chrome.idle.onStateChanged.addListener(() => serial(refresh));
chrome.alarms.onAlarm.addListener(a => {
```

with:

```js
chrome.idle.onStateChanged.addListener(() => serial(refresh));
// Tracking on or off in Settings or the welcome page grants or gives back "tabs" (W3): look again at once.
chrome.permissions.onAdded.addListener(() => serial(refresh));
chrome.permissions.onRemoved.addListener(() => serial(refresh));
chrome.alarms.onAlarm.addListener(a => {
```

- [ ] **Step 4: Run them to see them pass**

Run: `npm test && npm run typecheck`

Expected: `# tests 301`, `# pass 301`, `# fail 0` in each timezone (297 + 4); typecheck clean. (`@types/chrome` 0.0.268 leaves `removeListener` off the two permission events; `status.js` casts them once, with a comment.)

- [ ] **Step 5: Write the failing end-to-end checks, and the no-tabs run**

In `test/e2e/run.mjs`, replace:

```js
// cannot click through, and runs the end-to-end suite against the copy.
```

with:

```js
// cannot click through, and runs the end-to-end suite against the copy. A second,
// untouched copy runs the no-tabs checks: tracking off, everything else working (W3).
```

In `test/e2e/run.mjs`, replace:

```js
cpSync(join(root, 'dist/weekly'), ext, { recursive: true });

```

with:

```js
cpSync(join(root, 'dist/weekly'), ext, { recursive: true });
const noTabs = join(work, 'ext-notabs');
cpSync(join(root, 'dist/weekly'), noTabs, { recursive: true });

```

In `test/e2e/run.mjs`, replace:

```js
m.permissions = [...new Set([...(m.permissions ?? []), 'history'])];
```

with:

```js
// tabs (tracking) and history are optional in the build; this copy has them from the start.
m.permissions = [...new Set([...(m.permissions ?? []), 'history', 'tabs'])];
m.optional_permissions = (m.optional_permissions ?? []).filter((p) => !m.permissions.includes(p));
```

In `test/e2e/run.mjs`, replace:

```js
execFileSync('node', [join(root, 'test/e2e/full.mjs'), ext, chromium, work], { stdio: 'inherit' });

```

with:

```js
execFileSync('node', [join(root, 'test/e2e/full.mjs'), ext, chromium, work], { stdio: 'inherit' });
execFileSync('node', [join(root, 'test/e2e/no-tabs.mjs'), noTabs, chromium, join(work, 'no-tabs')], { stdio: 'inherit' });

```

In `test/e2e/full.mjs`, replace:

```js
  check('Welcome', 'states what is and isn’t recorded', /never does/i.test(await welcome.textContent('.facts')) && /keystrokes/.test(await welcome.textContent('.facts')));
  await welcome.selectOption('#role', 'hr'); await wait(300);
```

with:

```js
  check('Welcome', 'states what is and isn’t recorded', /never does/i.test(await welcome.textContent('.facts')) && /keystrokes/.test(await welcome.textContent('.facts')));
  await welcome.click('#trackYes'); await wait(400);
  check('Welcome', '"Track my week?" comes first; yes turns tracking on and offers the history fill (W3)', (await welcome.locator('.steps > li').first().getAttribute('id')) === 'trackStep'
    && /Tracking is on/.test(await welcome.textContent('#trackMsg')) && await welcome.isVisible('#fill'), await welcome.textContent('#trackMsg'));
  await welcome.selectOption('#role', 'hr'); await wait(300);
```

Create `test/e2e/no-tabs.mjs`:

```js
// The no-tabs path (W3, spec §1 success criterion 2): the build exactly as shipped,
// nothing pre-granted. Tracking stays off and records nothing; tasks, notes, the
// report and the app all work. Run by run.mjs after full.mjs, in its own browser.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.env.PLAYWRIGHT_PATH ?? '/Users/sharajrewoo/.npm/_npx/9833c18b2d85bc59/node_modules/');
const { chromium } = require('playwright');
const [ext, exe, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const PAGES = { report: 'src/ui/report/report.html', panel: 'src/ui/panel/panel.html', app: 'src/ui/app/app.html', welcome: 'src/ui/welcome/welcome.html' };

const results = [];
const check = (area, name, ok, detail = '') => {
  results.push({ area, name, ok: !!ok, detail: String(detail).slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${area}] ${name}${detail && !ok ? ' — ' + String(detail).slice(0, 300) : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const watch = (p) => { p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`)); p.on('console', (m) => m.type() === 'error' && errors.push(`${p.url()}: ${m.text()}`)); return p; };

const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: exe, viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
await ctx.route('**/*', (route) => (/^https?:\/\//.test(route.request().url())
  ? route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ENGX-9 Fix it - Jira</title><h1>Jira</h1>' }) : route.continue()));
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const X = `chrome-extension://${sw.url().split('/')[2]}`;
const store = () => sw.evaluate(() => chrome.storage.local.get(null));
await wait(800);
// Reminders off, so a real 09:00 or 18:00 never opens a window mid-run.
await sw.evaluate(() => chrome.storage.local.set({ settings: { morning: { enabled: false, time: '09:00' }, evening: { enabled: false, time: '18:00' } } }));

const [manifest, granted] = await sw.evaluate(() => Promise.all([chrome.runtime.getManifest(), chrome.permissions.contains({ permissions: ['tabs'] })]));
check('No tabs', 'the install asks for no tabs permission, and Chrome has not granted it (W3, spec §3.6)',
  !manifest.permissions.includes('tabs') && manifest.optional_permissions.includes('tabs') && granted === false, JSON.stringify(manifest.permissions));

const welcome = ctx.pages().find((p) => p.url().endsWith('/' + PAGES.welcome));
if (welcome) watch(welcome);
check('No tabs', 'the welcome page opens on "Track my week?"; the history step waits for a yes (spec §3.5)', !!welcome
  && (await welcome.locator('.steps > li').first().getAttribute('id')) === 'trackStep' && !(await welcome.isVisible('#fill')));
await welcome?.click('#trackNo'); await wait(300);
check('No tabs', '"No thanks" leaves tracking off and says so', /Tracking is off/.test(await welcome?.textContent('#trackMsg') ?? '')
  && !(await sw.evaluate(() => chrome.permissions.contains({ permissions: ['tabs'] }))));
await welcome?.close();

const site = await ctx.newPage(); await site.goto('https://acme.atlassian.net/browse/ENGX-9'); await wait(4000);
await site.goto('https://acme.atlassian.net/browse/ENGX-10'); await wait(2000);
const st = await store();
const session = await sw.evaluate(() => chrome.storage.session.get('current'));
check('No tabs', 'browsing records nothing: no day of activity, nothing being timed', !Object.keys(st).some((k) => /^(day|meta):/.test(k)) && !session.current,
  Object.keys(st).join(','));

const pan = watch(await ctx.newPage());
await pan.setViewportSize({ width: 360, height: 800 });
await pan.goto(`${X}/${PAGES.panel}`); await wait(800);
check('No tabs', 'the side panel says tracking is off and offers no Pause', /Tracking is off/.test(await pan.textContent('#now')) && !(await pan.isVisible('#pause')),
  await pan.textContent('#now'));
await pan.fill('#addTitle', 'Plan without tracking'); await pan.press('#addTitle', 'Enter'); await wait(500);
check('No tabs', 'tasks work: one-line add in the panel', ((await store()).tasks ?? []).some((t) => t.title === 'Plan without tracking')
  && await pan.locator('#todayList li.row', { hasText: 'Plan without tracking' }).count() === 1);
await pan.click('#tab-notes'); await pan.fill('#noteBody', 'Notes need no tabs'); await pan.click('#panel-notes .note-add button.primary'); await wait(500);
check('No tabs', 'notes work: quick add in the Notes tab', ((await store()).notes ?? []).some((n) => n.body === 'Notes need no tabs'));

const rep = watch(await ctx.newPage());
await rep.goto(`${X}/${PAGES.report}#settings`); await wait(1200);
const app = watch(await ctx.newPage());
await app.goto(`${X}/${PAGES.app}#stats`); await wait(800);
check('No tabs', 'the report and the app open; Settings show tracking off', !(await rep.isChecked('#trackingOn')) && await rep.isVisible('#md')
  && await app.isVisible('#view-stats'), await rep.textContent('#trackingMsg'));
check('Errors', 'no page errors or console errors (no tabs)', errors.length === 0, errors.join(' || '));

fs.writeFileSync(outDir + '/results.json', JSON.stringify(results, null, 1));
const fails = results.filter((r) => !r.ok);
console.log(`\nNo tabs: ${results.length - fails.length}/${results.length} passed`);
await ctx.close();
process.exit(fails.length ? 1 : 0);
```

- [ ] **Step 6: Run them to see them fail**

Run: `npm run e2e`

Expected: the main run stops at the welcome page with `page.click: Timeout 30000ms exceeded` waiting for `#trackYes`, and `npm run e2e` exits non-zero before the no-tabs run starts.

- [ ] **Step 7: Ask on the welcome page, offer it in Settings, say it in the footer**

In `src/ui/welcome/welcome.html`, replace:

```html
  <p class="lede">While you work in Chrome, Weekly notes which tab you’re on. On Friday it has a draft of your weekly update or standup ready. You read it, untick anything private, and copy it.</p>
```

with:

```html
  <p class="lede">Plan the week’s tasks, keep notes, and, if you like, let Weekly note which tab you’re on. On Friday it has a draft of your weekly update or standup ready. You read it, untick anything private, and copy it.</p>
```

In `src/ui/welcome/welcome.html`, replace:

```html
      <h2>What it records</h2>
```

with:

```html
      <h2>What tracking records</h2>
```

In `src/ui/welcome/welcome.html`, replace:

```html
  <ol class="steps">
    <li>
```

with:

```html
  <ol class="steps">
    <li id="trackStep">
      <h2>Track my week?</h2>
      <p>Weekly can note which tab is in front while you work, so your update starts itself. Chrome will ask whether Weekly may “read your browsing history”: that is its name for seeing tab addresses. Say no and Weekly is your tasks and notes, with nothing recorded.</p>
      <div class="choice">
        <button id="trackYes">Yes, track my week</button>
        <button id="trackNo" class="quiet">No thanks</button>
      </div>
      <p id="trackMsg" class="msg" role="status"></p>
    </li>
    <li>
```

In `src/ui/welcome/welcome.html`, replace:

```html
    </li>
    <li>
      <h2>Start with what you already did</h2>
```

with:

```html
    </li>
    <li id="fillStep" hidden>
      <h2>Start with what you already did</h2>
```

In `src/ui/welcome/welcome.css`, replace:

```css
#done { font-size: 15px; padding: 9px 18px; }

```

with:

```css
#done { font-size: 15px; padding: 9px 18px; }
.choice { display: flex; flex-wrap: wrap; gap: 8px; }

```

In `src/ui/welcome/welcome.js`, replace:

```js
// First-run page: role, history backfill, reminders and name hiding. Each choice saves as soon as it changes.
```

with:

```js
// First-run page (spec §3.5): track my week?, role, history backfill (only with tracking on), reminders and
// name hiding. Each choice saves as soon as it changes.
```

In `src/ui/welcome/welcome.js`, replace:

```js
import { requestHistory, backfillFromHistory } from '../../lib/activity/history.js';

```

with:

```js
import { requestHistory, backfillFromHistory } from '../../lib/activity/history.js';
import { trackingAllowed, allowTracking } from '../../lib/activity/status.js';

```

In `src/ui/welcome/welcome.js`, replace:

```js

$('#fill').onclick = async () => {
```

with:

```js

// Track my week? (W3): yes asks Chrome for "tabs" inside the click; no leaves it off. Filling from history needs tracking.
const tracking = on => {
  $('#fillStep').hidden = !on;
  $('#trackMsg').textContent = on ? 'Tracking is on. Weekly notes the tab in front while you work.'
    : 'Tracking is off, so nothing is recorded. You can turn it on later in Settings → Tracking.';
};
trackingAllowed().then(on => { if (on) tracking(true); });
$('#trackYes').onclick = async () => {
  try { tracking(await allowTracking()); } catch (e) { $('#trackMsg').textContent = `Couldn’t ask Chrome (${e.message}). Tracking stays off.`; }
};
$('#trackNo').onclick = () => tracking(false);

$('#fill').onclick = async () => {
```

In `src/ui/report/report.html`, replace:

```html
        <legend>Tracking</legend>
        <label>Pause when I’m away for (seconds)
```

with:

```html
        <legend>Tracking</legend>
        <label class="check"><input type="checkbox" id="trackingOn"> Track my week: note the tab in front while I work (Chrome asks once)</label>
        <p id="trackingMsg" class="msg" role="status"></p>
        <label>Pause when I’m away for (seconds)
```

In `src/ui/report/settings-panel.js`, replace:

```js
import { fillReminders, readReminders, reminderError } from './reminder-settings.js';

```

with:

```js
import { fillReminders, readReminders, reminderError } from './reminder-settings.js';
import { trackingAllowed, allowTracking, stopTracking } from '../../lib/activity/status.js';

```

In `src/ui/report/settings-panel.js`, replace:

```js

export function openSettings() {
```

with:

```js

// Tracking on/off grants or gives back the "tabs" permission (spec §3.2, W3). Saved at once, not with the form.
async function setTracking(e) {
  const want = e.target.checked;
  let why = '';
  try { await (want ? allowTracking() : stopTracking()); } catch (err) { why = ` (${err.message})`; }
  const on = await trackingAllowed();
  e.target.checked = on;
  $('#trackingMsg').textContent = on === want
    ? (on ? 'Tracking is on.' : 'Tracking is off. Nothing new is recorded; what is already here stays.')
    : `Chrome didn’t allow that, so tracking is still ${on ? 'on' : 'off'}${why}.`;
}

export function openSettings() {
```

In `src/ui/report/settings-panel.js`, replace:

```js
  $('#saveSettings').onclick = saveSettings;
  // The theme applies at once (every page follows settings), not on Save.
```

with:

```js
  $('#saveSettings').onclick = saveSettings;
  $('#trackingOn').onchange = e => void setTracking(e);
  trackingAllowed().then(on => { $('#trackingOn').checked = on; });
  // The theme applies at once (every page follows settings), not on Save.
```

In `src/ui/panel/footer.js`, replace:

```js
  const [day, settings, { current, error }] = await Promise.all([loadRange(start, 1), getSettings(), trackerStatus()]);
  $('#todayTotal').textContent = fmtDuration(day.perDay[0] ?? 0);
  $('#now').textContent = settings.paused ? 'Tracking is paused.'
    : current ? 'Now: ' + (current.title || current.url) : 'Not tracking (idle, Chrome not focused, or an ignored site).';
```

with:

```js
  const [day, settings, { current, error, tracking }] = await Promise.all([loadRange(start, 1), getSettings(), trackerStatus()]);
  $('#todayTotal').textContent = fmtDuration(day.perDay[0] ?? 0);
  // Without the tabs permission Weekly is tasks and notes (W3): say so, and offer no Pause.
  $('#now').textContent = !tracking ? 'Tracking is off. Turn it on in Settings → Tracking.'
    : settings.paused ? 'Tracking is paused.'
    : current ? 'Now: ' + (current.title || current.url) : 'Not tracking (idle, Chrome not focused, or an ignored site).';
  $('#pause').hidden = !tracking;
```

- [ ] **Step 8: Run the gate**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 301` in each timezone, typecheck clean, `257/257 passed` (256 + `[Welcome] "Track my week?" comes first…`), then `No tabs: 9/9 passed`. Look at `.e2e/shots/0-welcome.png`: step 1 is "Track my week?" with one outlined button and a quiet "No thanks", in the page's existing numbered-step style.

---

### Task 6: Reading the three backup formats, and the fuller export (D11, F7)

`src/lib/backup.js` recognises a file and turns it into a validated `Backup`; nothing is written here (Task 8 writes). The rules:
- **Weekly** (any object with `deviceId`, or notes or `day:` keys): Weekly 2 or 3. Activity becomes `imp:<device>:<date>` as before. This browser's **own** export is no longer refused: it is how a backup is restored after Delete everything, so its tasks, notes and settings come in and only its activity (already here) is left out. Private notes are kept apart as `sealed`; the file's `security` record comes with them.
- **Daybook** (`format: 'daybook.tasks'`, or a bare array): tasks only, through `coerceTaskList`.
- **ForgetMeNot** (`app: 'ForgetMeNot'`, `schemaVersion` ≤ 2): notes and the `security` record. A private note there kept its title in plain text and sealed the body alone; `backup.js` keeps the note sealed (`coerceNote` blanks the title) and carries the plain title beside it, for the worker to seal both together (Task 7). ForgetMeNot's rule is kept: `private` without valid ciphertext is an ordinary note.
- `carries` says what **Replace** swaps: Daybook → tasks, ForgetMeNot → notes, Weekly → tasks (if the file has them), notes, settings (if any).
- Settings come only from a Weekly file and only through `importableSettings`: keys Weekly knows, each of its default's type, strings and lists capped, never the Slack webhook.

The export (`exportPayload`) now carries `tasks`, `security` (the salt and check value, never the PIN) and `settings` without `slackWebhook`, plus `app: 'Weekly', version: 3`. Drafts, history estimates and page state still stay behind. The two fixtures are real files: `daybook-backup.json` was written by Daybook's own `exportTasks()` (three tasks, one done) and `forgetmenot-backup.json` by ForgetMeNot's own `FMNStore.exportAll()` (three notes, one private, PIN `1234`).

**Files:**
- Create: `src/lib/backup.js`, `test/backup.test.js`, `test/fixtures/daybook-backup.json`, `test/fixtures/forgetmenot-backup.json`
- Modify: `src/lib/settings.js`, `src/lib/portability.js`, `test/portability.test.js`, `test/e2e/full.mjs`

**Interfaces:**
- Consumes: `coerceTaskList` (`schema.js`); `coerceNote`, `coerceCipher`, `NOTE_TITLE_MAX` (`note-views.js`); `coerceSecurity` (`crypto.js`).
- Produces (`src/lib/backup.js`):
  - types `Format = 'weekly' | 'daybook' | 'forgetmenot'`, `Sealed = {note: Note, title: string}`, `Backup = {format, carries: {tasks, notes, settings}, tasks, notes, sealed, security, settings, activity, deviceId, days, own, dropped}`
  - `readBackup(text, ownDeviceId) → Backup`, throwing in words: `Not a valid export file.`, `This isn’t a Weekly, Daybook or ForgetMeNot backup.`, `This backup was made by a newer version of ForgetMeNot.`, `This file is not a valid ForgetMeNot backup.`, `That file has no tasks in it.`, `This file has no device ID. Export it again with this version.`
  - `describeBackup(b) → string[]` (what the file holds, then what is left out and why), `replaces(b) → 'tasks' | 'notes' | 'tasks, notes and settings' | …`, `cleanEntry(e)` (moved here; `portability.js` re-exports it until Task 8)
- Produces (`src/lib/settings.js`): `importableSettings(raw) → Record<string, unknown> | null`.

- [ ] **Step 1: Add the two real backup files**

Create `test/fixtures/daybook-backup.json`:

```json
{
  "format": "daybook.tasks",
  "schemaVersion": 1,
  "exportedAt": "2026-10-31T18:43:48.996Z",
  "tasks": [
    {
      "id": "t_0j6t2i0e1j22",
      "title": "Renew the SSL certificate",
      "description": "",
      "priority": "high",
      "dueDate": "2026-11-03",
      "status": "open",
      "createdAt": 1793472228995,
      "updatedAt": 1793472228995,
      "completedAt": null
    },
    {
      "id": "t_47611e6b1y6s",
      "title": "Book the team offsite",
      "description": "Venue for 12, near the office",
      "priority": "medium",
      "dueDate": null,
      "status": "done",
      "createdAt": 1793472228996,
      "updatedAt": 1793472228996,
      "completedAt": 1793472228996
    },
    {
      "id": "t_110y1b464c6d",
      "title": "Read the Raft paper",
      "description": "",
      "priority": "low",
      "dueDate": null,
      "status": "open",
      "createdAt": 1793472228996,
      "updatedAt": 1793472228996,
      "completedAt": null
    }
  ]
}
```

Create `test/fixtures/forgetmenot-backup.json`:

```json
{
  "app": "ForgetMeNot",
  "schemaVersion": 2,
  "exportedAt": 1793472228989,
  "count": 3,
  "notes": [
    {
      "id": "n_mvwr24jg_i30x603v",
      "title": "Salary talk",
      "body": "",
      "category": "Personal",
      "pinned": false,
      "done": false,
      "private": true,
      "enc": {
        "iv": "QY7nLdeDP1w92fJR",
        "ct": "qxumKH4KV78QNQLI/nlUV049M87P2lr3g2fuikRG/i49vfmi4qm9y5wdLPOuKQ=="
      },
      "createdAt": 1793472228988,
      "updatedAt": 1793472228989,
      "completedAt": null
    },
    {
      "id": "n_mvwr24jg_w7fh25jp",
      "title": "Raft paper",
      "body": "Read section 5 first",
      "category": "To-Read",
      "pinned": false,
      "done": true,
      "private": false,
      "enc": null,
      "createdAt": 1793472228988,
      "updatedAt": 1793472228988,
      "completedAt": 1793472228988
    },
    {
      "id": "n_mvwr24jg_v3ahypru",
      "title": "Vendor call",
      "body": "Ask about SSO pricing",
      "category": "Work",
      "pinned": true,
      "done": false,
      "private": false,
      "enc": null,
      "createdAt": 1793472228988,
      "updatedAt": 1793472228988,
      "completedAt": null
    }
  ],
  "security": {
    "version": 1,
    "salt": "1msVJwRzr4fXuL0E3ep0AA==",
    "iterations": 310000,
    "verifier": {
      "iv": "IPx5iUkluXqM06HK",
      "ct": "LW/28+VR+2qnkRfNE4asVshNMPN7/JinYTXDWMng1N92GUykCj+q"
    },
    "failedAttempts": 0,
    "lockedUntil": 0,
    "createdAt": 1793472228955
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `test/backup.test.js`:

```js
// The three backup formats (D11, F7; spec §4 Import), read from real files made by
// Daybook's and ForgetMeNot's own export code (test/fixtures), and Weekly's own.
// Everything in a file is untrusted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installChromeStub } from './helpers/chrome-stub.js';

installChromeStub();
const { readBackup, describeBackup, replaces, cleanEntry } = await import('../src/lib/backup.js');
const { exportPayload } = await import('../src/lib/portability.js');
const { importableSettings } = await import('../src/lib/settings.js');
const { verify, openNote, createSecurity, sealNote } = await import('../src/lib/crypto.js');
const { coerceTask } = await import('../src/lib/schema.js');

const fixture = (/** @type {string} */ name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('a Daybook backup, made by Daybook’s own export, is read as tasks; a bare array works too', () => {
  const b = readBackup(fixture('daybook-backup.json'), 'me');
  assert.equal(b.format, 'daybook');
  assert.deepEqual(b.carries, { tasks: true, notes: false, settings: false });
  assert.deepEqual(b.tasks.map((t) => t.title), ['Renew the SSL certificate', 'Book the team offsite', 'Read the Raft paper']);
  assert.equal(b.tasks[1]?.status, 'done');
  assert.equal(b.tasks[0]?.dueDate, '2026-11-03');
  assert.ok(b.tasks.every((t) => t.repeat === null && t.doneDates.length === 0));
  assert.equal(readBackup(JSON.stringify([{ title: 'hand rolled' }]), 'me').tasks.length, 1);
  assert.deepEqual(describeBackup(b), ['A Daybook backup: 3 tasks.']);
  assert.equal(replaces(b), 'tasks');
});

test('a ForgetMeNot export, made by ForgetMeNot: plain notes, the private one kept sealed with its title aside, the PIN record', () => {
  const b = readBackup(fixture('forgetmenot-backup.json'), 'me');
  assert.equal(b.format, 'forgetmenot');
  assert.deepEqual(b.notes.map((n) => [n.title, n.category, n.pinned, n.done]), [['Raft paper', 'To-Read', false, true], ['Vendor call', 'Work', true, false]]);
  assert.equal(b.sealed.length, 1);
  assert.equal(b.sealed[0]?.title, 'Salary talk');
  assert.deepEqual([b.sealed[0]?.note.title, b.sealed[0]?.note.body, b.sealed[0]?.note.category], ['', '', 'Personal'], 'no plain text in the note itself');
  assert.equal(b.security?.iterations, 310000);
  assert.ok(!('private' in (b.sealed[0]?.note ?? {})), 'ForgetMeNot’s private flag is mapped to enc');
  assert.deepEqual(describeBackup(b), ['A ForgetMeNot backup: 3 notes (1 private).']);
  assert.equal(replaces(b), 'notes');
});

test('the private ForgetMeNot note opens with its PIN through Weekly’s crypto, title and body', async () => {
  const b = readBackup(fixture('forgetmenot-backup.json'), 'me');
  const key = await verify('1234', b.security);
  assert.ok(key, 'ForgetMeNot’s verifier is accepted');
  const s = b.sealed[0];
  assert.ok(s?.note.enc);
  assert.deepEqual(await openNote(key, s.note.enc, s.title), { title: 'Salary talk', body: 'Ask for the 10% raise in March' });
  assert.equal(await verify('4321', b.security), null);
});

test('export: activity, tasks, notes as stored, the PIN record and settings, but never the Slack webhook (F7)', () => {
  const out = exportPayload({ 'day:2026-10-30': {}, 'meta:2026-10-30': {}, notes: [], tasks: [], security: { salt: 's' }, deviceId: 'd1',
    settings: { role: 'hr', slackWebhook: 'https://hooks.slack.com/services/secret' }, uiState: {}, 'draft:x:y': 'z', 'hist:2026-10-30': {} });
  assert.deepEqual(Object.keys(out).sort(), ['app', 'day:2026-10-30', 'deviceId', 'meta:2026-10-30', 'notes', 'security', 'settings', 'tasks', 'version']);
  assert.deepEqual(out.settings, { role: 'hr' });
  assert.equal(out.app, 'Weekly');
});

test('a Weekly 3 export comes back whole: tasks, notes, private notes with the PIN record, settings, activity', async () => {
  const sec = await createSecurity('2468');
  const key = await verify('2468', sec);
  assert.ok(key);
  const priv = { id: 'n_priv', title: '', body: '', category: 'Work', enc: await sealNote(key, { title: 'Offer', body: 'Numbers' }), createdAt: 1, updatedAt: 1 };
  const file = JSON.stringify(exportPayload({ deviceId: 'laptop-2', security: sec, settings: { theme: 'dark', slackWebhook: 'x' },
    tasks: [coerceTask({ id: 't_a', title: 'Ship it' })], notes: [{ id: 'n_a', title: 'Plain', body: 'b' }, priv],
    'day:2026-10-30': { 'jira:X-1': { category: 'Tickets', task: 'X-1', url: 'https://x.test', ms: 60000 } } }));
  const b = readBackup(file, 'this-browser');
  assert.deepEqual([b.format, b.own, b.deviceId, b.days], ['weekly', false, 'laptop-2', 1]);
  assert.deepEqual(b.tasks.map((t) => t.id), ['t_a']);
  assert.deepEqual(b.notes.map((n) => n.id), ['n_a']);
  assert.equal(b.sealed[0]?.note.id, 'n_priv');
  assert.equal(b.sealed[0]?.title, '', 'Weekly seals the title inside the ciphertext');
  assert.equal(b.security?.salt, sec.salt);
  assert.deepEqual(b.settings, { theme: 'dark' });
  assert.equal(b.activity['imp:laptop-2:2026-10-30']?.['jira:X-1']?.ms, 60000);
  assert.deepEqual(describeBackup(b), ['A Weekly export: 1 task, 2 notes (1 private), 1 day of activity and settings.']);
  assert.equal(replaces(b), 'tasks, notes and settings');
});

test('this browser’s own export: tasks, notes and settings come in, its activity is already here', () => {
  const b = readBackup(JSON.stringify({ deviceId: 'me', 'day:2026-10-30': { a: { ms: 5 } }, notes: [{ id: 'n_1', body: 'x', enc: { iv: 'AAAA', ct: 'BBBB' } }] }), 'me');
  assert.deepEqual([b.own, b.deviceId, b.days, Object.keys(b.activity).length], [true, null, 0, 0]);
  assert.deepEqual(describeBackup(b), ['A Weekly export from this browser: 1 note (1 private).',
    'Its activity is already here, so only tasks, notes and settings come in.',
    '1 private note can’t be opened without the file’s PIN record, so they are left out.']);
});

test('__proto__, constructor and prototype keys never reach Object.prototype, anywhere in a file', () => {
  const p = '"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}';
  const text = `{"deviceId":"d3",${p},"settings":{${p},"role":"hr"},"tasks":[{${p},"title":"T"}],`
    + `"notes":[{${p},"title":"N"}],"day:2026-10-30":{${p},"ok":{"category":"X","task":"t","url":"","ms":5}}}`;
  const b = readBackup(text, 'me');
  assert.equal(/** @type {any} */ ({}).polluted, undefined);
  assert.deepEqual(Object.keys(b.activity['imp:d3:2026-10-30'] ?? {}), ['ok']);
  assert.deepEqual(b.settings, { role: 'hr' });
  assert.equal(Object.getPrototypeOf(b.settings), Object.prototype);
  assert.deepEqual([b.tasks[0]?.title, b.notes[0]?.title], ['T', 'N']);
  const fmn = readBackup(`{"app":"ForgetMeNot","notes":[{${p},"title":"F","body":"b"}]}`, 'me');
  assert.equal(fmn.notes[0]?.title, 'F');
  assert.equal(/** @type {any} */ ({}).polluted, undefined);
});

test('refused in words: broken JSON, a file that is no backup, a newer ForgetMeNot, an empty Daybook backup, no device ID', () => {
  assert.throws(() => readBackup('{nope', 'me'), /Not a valid export file/);
  assert.throws(() => readBackup('"text"', 'me'), /Not a valid export file/);
  assert.throws(() => readBackup('{"hello":"world"}', 'me'), /isn’t a Weekly, Daybook or ForgetMeNot backup/);
  assert.throws(() => readBackup('{"app":"ForgetMeNot","schemaVersion":3,"notes":[]}', 'me'), /newer version of ForgetMeNot/);
  assert.throws(() => readBackup('{"app":"ForgetMeNot","notes":"x"}', 'me'), /not a valid ForgetMeNot backup/);
  assert.throws(() => readBackup('{"format":"daybook.tasks","tasks":[]}', 'me'), /no tasks/);
  assert.throws(() => readBackup('{"notes":[]}', 'me'), /no device ID/);
});

test('damaged records are counted and left out, never half-imported', () => {
  const b = readBackup(JSON.stringify({ deviceId: 'd4', tasks: [{ title: 'ok' }, { title: '' }, 7], notes: [{ title: 'ok' }, {}, 'x'],
    security: { salt: 'AAAA', iterations: 1000, verifier: { iv: 'AAAA', ct: 'BBBB' } } }), 'me');
  assert.deepEqual([b.tasks.length, b.notes.length, b.dropped], [1, 1, 4]);
  assert.equal(b.security, null, 'a PIN record with a weak work factor is refused');
  assert.equal(cleanEntry({ ms: -1 }), null);
});

test('importable settings: only keys Weekly knows, of the right type, lists and strings capped, never the webhook', () => {
  const s = importableSettings({ role: 'sales', paused: 'yes', idleSeconds: 60, slackWebhook: 'https://hooks.slack.com/services/x', unknown: 1,
    rules: ['a => B', 5, { x: 1 }, 'c'.repeat(900)], days: [1, 2, 'x'], morning: { enabled: false, time: '07:00' } });
  assert.deepEqual(s, { idleSeconds: 60, rules: ['a => B', 'c'.repeat(300)], role: 'sales', morning: { enabled: false, time: '07:00' }, days: [1, 2] });
  assert.equal(importableSettings('x'), null);
});
```

In `test/portability.test.js`, replace:

```js
import { parseImport, cleanEntry, exportPayload, exportAll, applyImport, MAX_IMPORT_BYTES } from '../src/lib/portability.js';
```

with:

```js
import { parseImport, cleanEntry, exportAll, applyImport, MAX_IMPORT_BYTES } from '../src/lib/portability.js';
```

In `test/portability.test.js`, replace:

```js

test('export keeps activity, notes and device id, never settings', () => {
  const out = exportPayload({ 'day:2026-10-30': {}, 'meta:2026-10-30': {}, notes: [], deviceId: 'd1', settings: { slackWebhook: 'secret' } });
  assert.deepEqual(Object.keys(out).sort(), ['day:2026-10-30', 'deviceId', 'meta:2026-10-30', 'notes']);
});
```

with:

```js

```

In `test/portability.test.js`, replace:

```js
const file = (o) => JSON.stringify(o);


```

with:

```js
const file = (o) => JSON.stringify(o);

```

In `test/portability.test.js`, replace:

```js
test('exportAll reads storage and returns everything except settings', async () => {
```

with:

```js
test('exportAll reads storage: settings travel without the Slack webhook', async () => {
```

In `test/portability.test.js`, replace:

```js
  assert.deepEqual(Object.keys(out).sort(), ['day:2026-10-30', 'deviceId', 'meta:2026-10-30', 'notes']);
```

with:

```js
  assert.deepEqual(Object.keys(out).sort(), ['app', 'day:2026-10-30', 'deviceId', 'meta:2026-10-30', 'notes', 'settings', 'version']);
  assert.deepEqual(out.settings, {});
```

- [ ] **Step 3: Run them to see them fail**

Run: `node --test test/backup.test.js test/portability.test.js`

Expected: `test/backup.test.js` fails to load (`Cannot find module '…/src/lib/backup.js'`) and `not ok … - exportAll reads storage: settings travel without the Slack webhook`; `# fail 2`.

- [ ] **Step 4: Write the reader, the settings filter and the fuller export**

Create `src/lib/backup.js`:

```js
/**
 * The three files Weekly imports (D11, F7; spec §4 Import): Weekly's own export,
 * a Daybook backup and a ForgetMeNot export. Pure: recognise, parse and validate;
 * nothing is written here (portability.js writes, after this has accepted the file).
 *
 * A file is untrusted: every task goes through coerceTask, every note through
 * coerceNote, the PIN record through coerceSecurity, settings through
 * importableSettings, activity through cleanEntry. Keys that would reach
 * Object.prototype are skipped, and nothing imported is merged into an existing object.
 */
import { coerceTaskList } from './schema.js';
import { coerceNote, coerceCipher, NOTE_TITLE_MAX } from './note-views.js';
import { coerceSecurity } from './crypto.js';
import { importableSettings } from './settings.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {import('./note-views.js').Note} Note */
/** @typedef {import('./crypto.js').Security} Security */
/** @typedef {'weekly' | 'daybook' | 'forgetmenot'} Format */
/** A private note: its ciphertext, plus ForgetMeNot's plain title ('' from Weekly, which seals the title too). @typedef {{ note: Note, title: string }} Sealed */
/**
 * @typedef {object} Backup
 * @property {Format} format
 * @property {{ tasks: boolean, notes: boolean, settings: boolean }} carries  what Replace swaps
 * @property {Task[]} tasks
 * @property {Note[]} notes            plain notes
 * @property {Sealed[]} sealed         private notes
 * @property {Security | null} security
 * @property {Record<string, unknown> | null} settings
 * @property {Record<string, object>} activity  imp:<device>:<date> → entries
 * @property {string | null} deviceId  the other browser's id, null when there is no activity to add
 * @property {number} days
 * @property {boolean} own             this browser's own export
 * @property {number} dropped          records that could not be used
 */

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const FMN_VERSION = 2;

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One activity entry from an untrusted file. @param {any} e */
export function cleanEntry(e) {
  if (!e || typeof e !== 'object' || !Number.isFinite(e.ms) || e.ms < 0) return null;
  /** @param {unknown} v */
  const str = v => (typeof v === 'string' ? v.slice(0, 500) : '');
  const url = /^https?:\/\//.test(e.url) ? str(e.url) : '';
  return { category: str(e.category) || 'Browsing', task: str(e.task), url, ms: Math.min(e.ms, 864e5),
    first: Number(e.first) || 0, last: Number(e.last) || 0, tickets: Array.isArray(e.tickets) ? e.tickets.filter((/** @type {unknown} */ t) => typeof t === 'string').slice(0, 20) : [] };
}

/** @returns {Backup} */
const empty = () => ({ format: 'weekly', carries: { tasks: false, notes: false, settings: false }, tasks: [], notes: [], sealed: [],
  security: null, settings: null, activity: {}, deviceId: null, days: 0, own: false, dropped: 0 });

/** Plain notes and private ones, apart. @param {unknown[]} list @param {(n: Record<string, unknown>) => Sealed | Note | null} one */
function splitNotes(list, one) {
  /** @type {Note[]} */ const notes = [];
  /** @type {Sealed[]} */ const sealed = [];
  let dropped = 0;
  for (const raw of list) {
    const n = isObj(raw) ? one(raw) : null;
    if (!n) dropped++;
    else if ('note' in n) sealed.push(n);
    else notes.push(n);
  }
  return { notes, sealed, dropped };
}

/** Weekly's day:<date> keys, as imp:<device>:<date> writes. @param {Record<string, unknown>} data @param {string} dev */
function activityOf(data, dev) {
  /** @type {Record<string, object>} */
  const writes = {};
  for (const [k, v] of Object.entries(data)) {
    const m = k.match(/^day:(\d{4}-\d{2}-\d{2})$/);
    if (!m || !isObj(v)) continue;
    writes[`imp:${dev}:${m[1]}`] = Object.fromEntries(Object.entries(v).filter(([ek]) => !UNSAFE.has(ek))
      .map(([ek, ev]) => [String(ek).slice(0, 300), cleanEntry(ev)]).filter(([, ev]) => ev));
  }
  return writes;
}

/** Weekly 2 or Weekly 3. This browser's own export keeps everything but its activity, which is already here. @param {Record<string, unknown>} data @param {string | undefined} ownDeviceId @returns {Backup} */
function weekly(data, ownDeviceId) {
  const dev = data['deviceId'];
  if (typeof dev !== 'string' || !/^[\w-]{1,64}$/.test(dev)) throw new Error('This file has no device ID. Export it again with this version.');
  const own = dev === ownDeviceId;
  const activity = own ? {} : activityOf(data, dev);
  const { tasks, dropped: badTasks } = coerceTaskList(data['tasks']);
  const split = splitNotes(Array.isArray(data['notes']) ? data['notes'] : [], (raw) => {
    const n = coerceNote(raw);
    return n?.enc ? { note: n, title: '' } : n;
  });
  const settings = importableSettings(data['settings']);
  return { ...empty(), format: 'weekly', carries: { tasks: Array.isArray(data['tasks']), notes: true, settings: settings !== null },
    tasks, ...split, dropped: badTasks + split.dropped, security: coerceSecurity(data['security']), settings,
    activity, deviceId: own ? null : dev, days: Object.keys(activity).length, own };
}

/** Daybook's {format: 'daybook.tasks', tasks}, or a bare array of tasks. @param {unknown} raw @returns {Backup} */
function daybook(raw) {
  const list = Array.isArray(raw) ? raw : isObj(raw) ? raw['tasks'] : null;
  const { tasks, dropped } = coerceTaskList(list);
  if (!tasks.length && !dropped) throw new Error('That file has no tasks in it.');
  return { ...empty(), format: 'daybook', carries: { tasks: true, notes: false, settings: false }, tasks, dropped };
}

/**
 * ForgetMeNot's exportAll (v1 or v2). A private note there kept its title in plain
 * text and sealed the body alone; Weekly seals both, so the worker re-seals it.
 * @param {Record<string, unknown>} data @returns {Backup}
 */
function forgetMeNot(data) {
  const v = data['schemaVersion'];
  if (typeof v === 'number' && v > FMN_VERSION) throw new Error('This backup was made by a newer version of ForgetMeNot.');
  if (!Array.isArray(data['notes'])) throw new Error('This file is not a valid ForgetMeNot backup.');
  const split = splitNotes(data['notes'], (raw) => {
    const enc = raw['private'] === true ? coerceCipher(raw['enc']) : null;
    // ForgetMeNot's rule: private only with valid ciphertext; otherwise an ordinary note.
    const n = coerceNote({ ...raw, enc });
    if (!n || !enc) return n;
    const title = typeof raw['title'] === 'string' ? raw['title'].trim().slice(0, NOTE_TITLE_MAX) : '';
    return { note: n, title };
  });
  return { ...empty(), format: 'forgetmenot', carries: { tasks: false, notes: true, settings: false }, ...split,
    security: coerceSecurity(data['security']) };
}

/**
 * Recognise and validate a backup. Throws, in words, on a file Weekly cannot use.
 * @param {string} text @param {string | undefined} ownDeviceId @returns {Backup}
 */
export function readBackup(text, ownDeviceId) {
  /** @type {unknown} */
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('Not a valid export file.'); }
  if (Array.isArray(raw) || (isObj(raw) && raw['format'] === 'daybook.tasks')) return daybook(raw);
  if (!isObj(raw)) throw new Error('Not a valid export file.');
  if (raw['app'] === 'ForgetMeNot') return forgetMeNot(raw);
  if ('deviceId' in raw || Array.isArray(raw['notes']) || Object.keys(raw).some((k) => k.startsWith('day:'))) return weekly(raw, ownDeviceId);
  throw new Error('This isn’t a Weekly, Daybook or ForgetMeNot backup.');
}

const NAMES = { weekly: 'A Weekly export', daybook: 'A Daybook backup', forgetmenot: 'A ForgetMeNot backup' };
/** @param {number} n @param {string} one */
const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
/** @param {string[]} parts */
const list = (parts) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);

/**
 * What the file holds and what will be left out, in words, for the import panel.
 * @param {Backup} b @returns {string[]}
 */
export function describeBackup(b) {
  /** @type {string[]} */
  const parts = [];
  if (b.carries.tasks) parts.push(count(b.tasks.length, 'task'));
  if (b.carries.notes) parts.push(count(b.notes.length + b.sealed.length, 'note') + (b.sealed.length ? ` (${b.sealed.length} private)` : ''));
  if (b.days) parts.push(`${count(b.days, 'day')} of activity`);
  if (b.settings) parts.push('settings');
  const lines = [`${NAMES[b.format]}${b.own ? ' from this browser' : ''}: ${list(parts) || 'nothing to import'}.`];
  if (b.own) lines.push('Its activity is already here, so only tasks, notes and settings come in.');
  if (b.sealed.length && !b.security) lines.push(`${count(b.sealed.length, 'private note')} can’t be opened without the file’s PIN record, so they are left out.`);
  if (b.dropped) lines.push(b.dropped === 1 ? '1 damaged entry left out.' : `${b.dropped} damaged entries left out.`);
  return lines;
}

/** What Replace swaps for the file's, in words. @param {Backup} b */
export function replaces(b) {
  return list([b.carries.tasks && 'tasks', b.carries.notes && 'notes', b.carries.settings && 'settings'].filter((x) => typeof x === 'string'));
}
```

In `src/lib/settings.js`, replace:

```js

/** @returns {Promise<Settings>} */
```

with:

```js

/**
 * Settings from an imported file (a Weekly export): only keys Weekly knows, each of
 * its default's type; strings and lists capped; readSettings validates the rest.
 * Never the Slack webhook: it is a secret, so it stays on the computer it was typed on.
 * @param {unknown} raw @returns {Record<string, unknown> | null}
 */
export function importableSettings(raw) {
  if (!isObj(raw)) return null;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, d] of Object.entries(DEFAULTS)) {
    const v = Object.hasOwn(raw, k) ? raw[k] : undefined;
    if (k === 'slackWebhook' || v === undefined) continue;
    if (Array.isArray(d)) {
      // Working days are numbers; every other list (sites, rules, prefixes) is strings.
      const nums = typeof d[0] === 'number';
      if (Array.isArray(v)) out[k] = v.filter((x) => (nums ? Number.isInteger(x) : typeof x === 'string')).slice(0, 100).map((x) => (nums ? x : x.slice(0, 300)));
    } else if (typeof v === typeof d && !Array.isArray(v)) out[k] = typeof v === 'string' ? v.slice(0, 300) : v;
  }
  return out;
}

/** @returns {Promise<Settings>} */
```

In `src/lib/portability.js`, replace:

```js
import { coerceNote, mergeNotes } from './notes.js';

```

with:

```js
import { coerceNote, mergeNotes } from './notes.js';
import { cleanEntry } from './backup.js';
export { cleanEntry };

```

In `src/lib/portability.js`, replace:

```js
/** @param {Record<string, unknown>} all */
export function exportPayload(all) {
  return Object.fromEntries(Object.entries(all).filter(([k]) => /^(day|meta):/.test(k) || k === 'notes' || k === 'deviceId'));
}

/** @param {any} e */
export function cleanEntry(e) {
  if (!e || typeof e !== 'object' || !Number.isFinite(e.ms) || e.ms < 0) return null;
  /** @param {unknown} v */
  const str = v => (typeof v === 'string' ? v.slice(0, 500) : '');
  const url = /^https?:\/\//.test(e.url) ? str(e.url) : '';
  return { category: str(e.category) || 'Browsing', task: str(e.task), url, ms: Math.min(e.ms, 864e5),
    first: Number(e.first) || 0, last: Number(e.last) || 0, tickets: Array.isArray(e.tickets) ? e.tickets.filter((/** @type {unknown} */ t) => typeof t === 'string').slice(0, 20) : [] };
```

with:

```js
/**
 * What Export writes (D11, F7): activity, tasks, notes as stored (private ones as
 * ciphertext), the PIN record (a salt and a check value, never the PIN), settings
 * without the Slack webhook (a secret), and the device ID. Drafts, history
 * estimates and page state stay behind.
 * @param {Record<string, unknown>} all
 */
export function exportPayload(all) {
  /** @type {Record<string, unknown>} */
  const out = { app: 'Weekly', version: 3 };
  for (const [k, v] of Object.entries(all)) if (/^(day|meta):/.test(k) || ['notes', 'tasks', 'security', 'deviceId'].includes(k)) out[k] = v;
  const s = all['settings'];
  if (typeof s === 'object' && s !== null && !Array.isArray(s)) {
    const { slackWebhook, ...rest } = /** @type {Record<string, unknown>} */ (s);
    out['settings'] = rest;
  }
  return out;
```

- [ ] **Step 5: Run the gate, with the export check that changed**

In `test/e2e/full.mjs`, replace:

```js
check('Data', 'export leaves out settings (webhook stays private)', !('settings' in exported));
```

with:

```js
check('Data', 'export carries tasks and settings, but never the Slack webhook (F7)', Array.isArray(exported.tasks) && exported.settings?.role && !('slackWebhook' in exported.settings), JSON.stringify(exported.settings).slice(0, 200));
```

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 310`, `# pass 310`, `# fail 0` in each timezone (301 + 10 in `backup.test.js` − 1 export test folded into it); typecheck clean; `257/257 passed` (the export check now reads "export carries tasks and settings, but never the Slack webhook (F7)"); `No tabs: 9/9 passed`. The report's import still goes through the old `applyImport` until Task 8.

---

### Task 7: Private notes from a backup, in the worker (F7; spec §4 "the user confirms which PIN wins")

Only the worker may open and seal private notes and write the `security` record (Phase 4), so importing private notes is a new broker message, `crypto:import`. It is a `crypto:*` message, so it runs in the broker's queue and answers Weekly's own pages only (`fromExtensionPage`); a content script is refused. The rules:
- The file's PIN opens its private notes (`verify` on the file's record, re-validated with `coerceSecurity`, which refuses fewer than 100,000 rounds). A wrong one writes nothing. There is no lockout on the file's PIN: the file is offline anyway, and a lockout here would lock the user's own notes for someone else's file.
- **No PIN here, or Replace:** the file's record is adopted (ForgetMeNot's rule; counters reset).
- **Merge with a different PIN here** (spec §4): the user says which wins. `keep: 'mine'` seals the file's notes under the local PIN; `'theirs'` adopts the file's record and re-seals the local private notes under it too. Either way the local PIN is checked through the existing lockout (`checkPin`).
- **The same record** (your own backup: same salt and verifier) needs no second PIN.
- Every private note is sealed again, title and body together (F8); ForgetMeNot's plain title goes inside. Plain notes from the file come in the same write. Notes and record are one `transformNotes` write, or nothing is written. Merge uses the notes rule (new ids added, the newer `updatedAt` wins), now one pure `mergeNoteLists` shared by `mergeNotes` and the broker.

**Files:**
- Create: `test/background/crypto-import.test.js`
- Modify: `src/lib/note-views.js`, `src/lib/notes.js`, `src/background/crypto-broker.js`

**Interfaces:**
- Consumes (Task 6): `readBackup` (tests only). Consumes (Phase 4): `coerceSecurity`, `verify`, `openNote(key, enc, title)`, `sealNote`, `afterSuccess`, `isValidPin` (`crypto.js`); `transformNotes`, `coerceNote` (`notes.js`).
- Produces: `mergeNoteLists(current, incoming) → {notes, added}` (`note-views.js`, re-exported by `notes.js`); message `crypto:import { mode: 'merge' | 'replace', security, notes: Note[], sealed: Sealed[], pin, localPin?, keep?: 'mine' | 'theirs' } → { ok: true, added } | { ok: false, error }`, broadcast `crypto:changed` afterwards. Error texts: `The file’s PIN record is damaged, so its private notes can’t be opened.`, `That isn’t the PIN the file’s private notes were locked with.`, the lockout's `Enter your PIN: 4 to 8 digits.` / `Wrong PIN.` / `Too many wrong PINs.`, `A private note in the file could not be opened, so nothing was imported.`

- [ ] **Step 1: Write the failing tests**

Create `test/background/crypto-import.test.js`:

```js
// Private notes from a backup (D11, F7; spec §4: "if a security record already
// exists, the user confirms which PIN wins"). The worker opens them with the file's
// PIN, seals them again (title and body together) under the PIN that wins, and
// writes them with the record in one go, or writes nothing.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installChromeStub } from '../helpers/chrome-stub.js';

const stub = installChromeStub();
const broker = await import('../../src/background/crypto-broker.js');
const { createNote, getNotes } = await import('../../src/lib/notes.js');
const { readBackup } = await import('../../src/lib/backup.js');

const PAGE = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/report/report.html' };
/** @param {Record<string, unknown>} msg */
const ask = (msg, sender = PAGE) => broker.handle(msg, sender);
const FMN = readBackup(readFileSync(new URL('../fixtures/forgetmenot-backup.json', import.meta.url), 'utf8'), 'me');
/** @param {Record<string, unknown>} extra */
const importFmn = (extra) => ask({ type: 'crypto:import', mode: 'merge', security: FMN.security, notes: FMN.notes, sealed: FMN.sealed, pin: '1234', ...extra });
/** Every private note, opened by the worker's current key. */
async function opened() {
  const items = (await getNotes()).filter((n) => n.enc).map((n) => ({ id: n.id, enc: n.enc }));
  return Object.values((await ask({ type: 'crypto:decrypt', items })).plain ?? {});
}
async function myPrivateNote() {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  const r = await ask({ type: 'crypto:encrypt', title: 'Mine', body: 'My secret' });
  await createNote({ enc: r.enc, category: 'Personal' });
}

beforeEach(() => {
  for (const k of Object.keys(stub.stores.local)) delete stub.stores.local[k];
  broker.lock();
});

test('no PIN here: the file’s PIN record is adopted; ForgetMeNot’s private note is sealed again, title and body together', async () => {
  assert.deepEqual(await importFmn({}), { ok: true, added: 3 });
  assert.equal(stub.stores.local.security.salt, FMN.security?.salt);
  const priv = (await getNotes()).find((n) => n.enc);
  assert.ok(priv && priv.enc?.ct !== FMN.sealed[0]?.note.enc?.ct, 'sealed again, not copied');
  assert.equal(JSON.stringify(stub.stores.local).includes('Salary'), false, 'the plain title is not stored');
  assert.deepEqual(await opened(), [{ title: 'Salary talk', body: 'Ask for the 10% raise in March' }]);
  assert.deepEqual(await importFmn({}), { ok: true, added: 0 }, 'importing twice adds nothing; the same PIN record needs no second PIN');
});

test('a wrong PIN for the file writes nothing', async () => {
  const r = await importFmn({ pin: '9999' });
  assert.deepEqual(r, { ok: false, error: 'That isn’t the PIN the file’s private notes were locked with.' });
  assert.deepEqual(Object.keys(stub.stores.local), []);
});

test('a PIN here, keep mine: the file’s private notes move to my PIN; my record stays', async () => {
  await myPrivateNote();
  const mySalt = stub.stores.local.security.salt;
  assert.deepEqual(await importFmn({ localPin: '7391', keep: 'mine' }), { ok: true, added: 3 });
  assert.equal(stub.stores.local.security.salt, mySalt);
  broker.lock();
  assert.equal((await ask({ type: 'crypto:unlock', pin: '7391' })).ok, true);
  assert.deepEqual((await opened()).map((p) => p?.title).sort(), ['Mine', 'Salary talk']);
});

test('a PIN here, keep the file’s: my private notes move to the file’s PIN as well', async () => {
  await myPrivateNote();
  assert.deepEqual(await importFmn({ localPin: '7391', keep: 'theirs' }), { ok: true, added: 3 });
  assert.equal(stub.stores.local.security.salt, FMN.security?.salt);
  broker.lock();
  assert.equal((await ask({ type: 'crypto:unlock', pin: '7391' })).ok, false);
  assert.equal((await ask({ type: 'crypto:unlock', pin: '1234' })).ok, true);
  assert.deepEqual((await opened()).map((p) => p?.title).sort(), ['Mine', 'Salary talk']);
});

test('a PIN here: mine is checked through the lockout, and a wrong one writes nothing', async () => {
  await myPrivateNote();
  const before = JSON.stringify(stub.stores.local.notes);
  const r = await importFmn({ localPin: '0000', keep: 'mine' });
  assert.equal(r.error, 'Wrong PIN.');
  assert.equal(stub.stores.local.security.failedAttempts, 1);
  assert.equal(JSON.stringify(stub.stores.local.notes), before);
});

test('replace: the file’s notes replace mine and its PIN record wins, without asking for mine', async () => {
  await myPrivateNote();
  await createNote({ title: 'Plain of mine' });
  assert.deepEqual(await importFmn({ mode: 'replace' }), { ok: true, added: 3 });
  assert.deepEqual((await getNotes()).map((n) => n.title).sort(), ['', 'Raft paper', 'Vendor call']);
  assert.equal(stub.stores.local.security.salt, FMN.security?.salt);
});

test('only Weekly’s own pages may import; a damaged or weak PIN record is refused', async () => {
  assert.equal((await importFmn({}).then(() => ask({ type: 'crypto:import' }, { id: 'weekly', url: 'https://example.com/' }))).error, 'Not allowed.');
  for (const k of Object.keys(stub.stores.local)) delete stub.stores.local[k];
  const weak = { ...FMN.security, iterations: 1000 };
  assert.equal((await importFmn({ security: weak })).error, 'The file’s PIN record is damaged, so its private notes can’t be opened.');
  assert.deepEqual(Object.keys(stub.stores.local), []);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/background/crypto-import.test.js`

Expected: all seven fail (the broker answers `Unknown request.`); `# tests 7`, `# fail 7`.

- [ ] **Step 3: Share the merge rule**

In `src/lib/note-views.js`, replace:

```js

/** @param {Note} a @param {Note} b */
```

with:

```js

/**
 * Merge notes in (an import): new ids are added; on the same id the newer
 * `updatedAt` wins (ForgetMeNot's rule), so importing twice changes nothing.
 * @param {Note[]} current @param {Note[]} incoming @returns {{ notes: Note[], added: number }}
 */
export function mergeNoteLists(current, incoming) {
  const byId = new Map(current.map((n) => [n.id, n]));
  let added = 0;
  for (const n of incoming) {
    const old = byId.get(n.id);
    if (!old) added += 1;
    if (!old || n.updatedAt > old.updatedAt) byId.set(n.id, n);
  }
  return { notes: [...byId.values()], added };
}

/** @param {Note} a @param {Note} b */
```

In `src/lib/notes.js`, replace:

```js
import { coerceNote, coerceNoteList } from './note-views.js';
```

with:

```js
import { coerceNote, coerceNoteList, mergeNoteLists } from './note-views.js';
```

In `src/lib/notes.js`, replace:

```js
 * Merge untrusted notes in (an import): new ids are added; on the same id the
 * newer `updatedAt` wins (ForgetMeNot's rule), so importing twice changes nothing.
```

with:

```js
 * Merge untrusted notes in (an import), by mergeNoteLists' rule: new ids added,
 * the newer `updatedAt` wins, so importing twice changes nothing.
```

In `src/lib/notes.js`, replace:

```js
    const byId = new Map(cur.map((n) => [n.id, n]));
    let added = 0;
    for (const n of clean) {
      const old = byId.get(n.id);
      if (!old) added += 1;
      if (!old || n.updatedAt > old.updatedAt) byId.set(n.id, n);
    }
    return { notes: [...byId.values()], result: added };
```

with:

```js
    const { notes, added } = mergeNoteLists(cur, clean);
    return { notes, result: added };
```

- [ ] **Step 4: Add crypto:import to the broker**

In `src/background/crypto-broker.js`, replace:

```js
 * Only this worker writes the `security` record.
 */
import { isValidPin, createSecurity, verify, coerceSecurity, afterFailure, afterSuccess, lockedFor, sealNote, openNote } from '../lib/crypto.js';
import { transformNotes, coerceCipher, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../lib/notes.js';
```

with:

```js
 * Only this worker writes the `security` record, including one adopted from an
 * imported backup (crypto:import).
 */
import { isValidPin, createSecurity, verify, coerceSecurity, afterFailure, afterSuccess, lockedFor, sealNote, openNote } from '../lib/crypto.js';
import { transformNotes, coerceCipher, coerceNote, mergeNoteLists, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../lib/notes.js';
```

In `src/background/crypto-broker.js`, replace:

```js
const DECRYPT_MAX = 2000;

```

with:

```js
const DECRYPT_MAX = 2000;
const IMPORT_MAX = 10000;

```

In `src/background/crypto-broker.js`, replace:

```js
 * Re-encrypt (or, with `to` null, decrypt) every private note in one locked write.
 * One note that cannot be opened aborts the whole change: nothing is written.
 * @param {CryptoKey} from @param {CryptoKey | null} to @param {Record<string, unknown>} also
 */
const rekey = (from, to, also) => transformNotes(async (notes) => {
```

with:

```js
 * Every private note opened with `from` and sealed with `to` (with `to` null: made plain).
 * One that cannot be opened throws, so the write it is part of never happens.
 * @param {Note[]} notes @param {CryptoKey} from @param {CryptoKey | null} to @returns {Promise<Note[]>}
 */
async function resealAll(notes, from, to) {
```

In `src/background/crypto-broker.js`, replace:

```js
  return { notes: out, also };
});
```

with:

```js
  return out;
}

/** Re-encrypt (or decrypt) every private note in one locked write. @param {CryptoKey} from @param {CryptoKey | null} to @param {Record<string, unknown>} also */
const rekey = (from, to, also) => transformNotes(async (notes) => ({ notes: await resealAll(notes, from, to), also }));
```

In `src/background/crypto-broker.js`, replace:

```js

/** @type {Record<string, (m: Msg) => Promise<Reply>>} */
```

with:

```js

/** A backup's plain notes, sent by the import page: validated again here. @param {unknown} list @returns {Note[]} */
const plainFrom = (list) => (Array.isArray(list) ? list.slice(0, IMPORT_MAX) : []).flatMap((raw) => { const n = coerceNote(raw); return n && !n.enc ? [n] : []; });

/**
 * A backup's private notes, opened with the file's key and sealed with `to`. ForgetMeNot
 * kept a private note's title in plain text beside the body's ciphertext; it goes inside now (F8).
 * @param {unknown} list @param {CryptoKey} from @param {CryptoKey} to @returns {Promise<Note[]>}
 */
async function sealedFrom(list, from, to) {
  /** @type {Note[]} */
  const out = [];
  for (const item of (Array.isArray(list) ? list.slice(0, IMPORT_MAX) : [])) {
    const n = coerceNote(item?.note);
    if (!n?.enc) continue;
    const plain = await openNote(from, n.enc, text(item?.title, NOTE_TITLE_MAX))
      .catch(() => { throw new Error('A private note in the file could not be opened, so nothing was imported.'); });
    out.push({ ...n, enc: await sealNote(to, plain) });
  }
  return out;
}

/**
 * Bring a backup's notes in with its private ones (D11, F7). The file's PIN opens them;
 * they are sealed again under the PIN that wins. No PIN here, or Replace: the file's
 * record is adopted (ForgetMeNot's rule). Merge with a different PIN here: `keep` says
 * which wins (spec §4), your PIN is checked through the lockout, and 'theirs' moves your
 * private notes to the file's PIN too. The same record (your own backup) needs no second
 * PIN. Notes and record are one write, or nothing is written.
 * @param {Msg} m @returns {Promise<Reply>}
 */
async function importNotes(m) {
  const sec = coerceSecurity(m['security']);
  if (!sec) return { ok: false, error: 'The file’s PIN record is damaged, so its private notes can’t be opened.' };
  const theirs = isValidPin(m['pin']) ? await verify(m['pin'], sec) : null;
  if (!theirs) return { ok: false, error: 'That isn’t the PIN the file’s private notes were locked with.' };
  const replace = m['mode'] === 'replace';
  const local = replace ? null : await readSecurity();
  const same = local !== null && local.salt === sec.salt && local.verifier.ct === sec.verifier.ct;
  /** @type {CryptoKey | null} */
  let mine = null;
  if (local && !same) {
    const r = await checkPin(m['localPin']);
    if (!('key' in r)) return r;
    mine = /** @type {CryptoKey} */ (r.key);
  }
  const target = !mine || m['keep'] === 'theirs' ? theirs : mine;
  const incoming = [...plainFrom(m['notes']), ...await sealedFrom(m['sealed'], theirs, target)];
  let added = 0;
  await transformNotes(async (cur) => {
    const base = replace ? [] : mine && target === theirs ? await resealAll(cur, mine, theirs) : cur;
    const merged = mergeNoteLists(base, incoming);
    added = merged.added;
    return { notes: merged.notes, also: target === theirs ? { [KEY]: afterSuccess(sec) } : {} };
  });
  keep(target);
  return { ok: true, added };
}

/** @type {Record<string, (m: Msg) => Promise<Reply>>} */
```

In `src/background/crypto-broker.js`, replace:

```js
  'crypto:encrypt': encryptNote, 'crypto:decrypt': decryptNotes,
```

with:

```js
  'crypto:encrypt': encryptNote, 'crypto:decrypt': decryptNotes, 'crypto:import': importNotes,
```

In `src/background/crypto-broker.js`, replace:

```js
const CHANGES = new Set(['crypto:setPin', 'crypto:changePin', 'crypto:removePin', 'crypto:unlock', 'crypto:lock']);
```

with:

```js
const CHANGES = new Set(['crypto:setPin', 'crypto:changePin', 'crypto:removePin', 'crypto:unlock', 'crypto:lock', 'crypto:import']);
```

- [ ] **Step 5: Run the gate**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 317`, `# pass 317`, `# fail 0` in each timezone (310 + 7); typecheck clean; `257/257 passed`, `No tabs: 9/9 passed` (the PIN checks of Phase 4 still pass through the refactored `rekey`).

---

### Task 8: Import: see what a file holds, then Add or Replace (D11, F7)

`portability.js` writes what `backup.js` accepted (spec §6: validated first, then written):
1. **Notes first**, so a wrong PIN stops the import before anything changes. With private notes and their PIN record, the worker writes them (`crypto:import`, Task 7); otherwise one `mutateNotes` (Replace) or `mergeNotes` (Add). Private notes without a record are left out, and the panel said so before Import.
2. **Tasks**: `mergeTasks` (Add: tasks already here always win, Daybook's rule) or `replaceAll` (Replace).
3. **Settings**: Replace only, through `updateSettings` (validated by `readSettings`); the local Slack webhook stays.
4. **Activity** from another browser: `imp:<device>:<date>`, as before.

Replace swaps only what the file carries (`Backup.carries`), so a Daybook backup never empties notes and a ForgetMeNot export never empties tasks. Each step is one write under its own lock; a quota error after step 1 is reported in words with what was not imported, like any failed write.

The report's Settings → Your data gets **Import a backup** (it was "Import from another computer"). Choosing a file reads and validates it and shows a panel on the marker wash: what the file holds and what is left out (`describeBackup`), **Add what’s new to what’s here** or **Replace my … with the file’s** (`replaces`), the file's PIN when it has private notes, and, when merging into a browser with a PIN, your PIN and **Keep my PIN** / **Use the file’s PIN**. Nothing is written until **Import**; **Cancel** says "Nothing was imported." The old `parseImport` / `applyImport` (Weekly) and `parseImport` (Daybook, `task-portability.js`) go: `backup.js` reads every file now, and their tests move to it.

**Files:**
- Create: `src/ui/report/import-panel.js`, `test/e2e/data.mjs`
- Replace whole: `src/lib/portability.js`, `test/portability.test.js`
- Modify: `src/lib/task-portability.js`, `src/ui/report/data-panel.js`, `src/ui/report/main.js`, `src/ui/report/report.html`, `src/ui/report/report.css`, `test/task-portability.test.js`, `test/e2e/full.mjs`

**Interfaces:**
- Consumes (Task 6): `readBackup`, `describeBackup`, `replaces`, `cleanEntry`, `Backup`. Consumes (Task 7): `crypto:import`. Consumes: `mutateNotes`, `mergeNotes` (`notes.js`); `mergeTasks`, `replaceAll` (`task-portability.js`); `updateSettings` (`settings.js`); `crypto:status` (`hasPin`).
- Produces (`src/lib/portability.js`): `MAX_IMPORT_BYTES`, `exportPayload(all)`, `exportAll()`, `openBackup(file) → Backup` (size check, then `readBackup` with this browser's device ID), `applyBackup(b, { mode, pin?, localPin?, keep? }) → { tasks, notes, days }` (what was added); type `ImportChoice`.
- Removes: `parseImport`, `applyImport` and the `cleanEntry` re-export (`portability.js`); `parseImport` (`task-portability.js`).
- DOM: `#importBtn`, `#import` (file input), `#importPanel`, `#importWhat`, `input[name=importMode]` (`merge` | `replace`), `#replaceLabel`, `#importPins`, `#importPin`, `#importMine`, `#importLocalPin`, `input[name=importKeep]` (`mine` | `theirs`), `#importGo`, `#importCancel`; the result in `#settingsMsg`: `Imported N day(s) of activity, N task(s) and N note(s).`
- `test/e2e/data.mjs` exports `daybookImportChecks`, `forgetMeNotImportChecks`, `pinImportChecks` (needs `S`, the output folder), `replaceImportChecks`; they end with no PIN set, as the run did before.

- [ ] **Step 1: Write the failing unit tests**

Replace the whole of `test/portability.test.js` with:

```js
// Writing an import (D11, F7; spec §6: validated first, then written) and Export.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installChromeStub } from './helpers/chrome-stub.js';

let stub = installChromeStub();
const { exportAll, openBackup, applyBackup, MAX_IMPORT_BYTES } = await import('../src/lib/portability.js');
const { readBackup, cleanEntry } = await import('../src/lib/backup.js');

const fixture = (/** @type {string} */ name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
/** A File-like object, as the page hands over. @param {string} text */
const file = (text) => ({ size: text.length, text: async () => text });
const local = () => stub.stores.local;
beforeEach(() => { stub = installChromeStub(); });

test('a file over 20 MB is refused before it is read', async () => {
  await assert.rejects(openBackup(/** @type {any} */ ({ size: MAX_IMPORT_BYTES + 1, text: async () => '{}' })), /File is too large \(max 20 MB\)/);
});

test('a Weekly export from another browser: activity under imp:<device>:<date>, notes merged once; importing again changes nothing', async () => {
  local().deviceId = 'mine';
  const json = JSON.stringify({ deviceId: 'other', 'day:2026-10-30': { a: { category: 'C', task: 't', url: 'javascript:alert(1)', ms: 10 } },
    notes: [{ id: 1, ts: 1, text: 'n1' }], tasks: [{ id: 't_x', title: 'From the laptop' }] });
  const b = await openBackup(/** @type {any} */ (file(json)));
  assert.deepEqual(await applyBackup(b, { mode: 'merge' }), { tasks: 1, notes: 1, days: 1 });
  assert.deepEqual(await applyBackup(b, { mode: 'merge' }), { tasks: 0, notes: 0, days: 1 });
  assert.equal(local()['imp:other:2026-10-30'].a.ms, 10);
  assert.equal(local()['imp:other:2026-10-30'].a.url, '', 'a javascript: URL is dropped');
  assert.deepEqual(local().imports, ['other']);
  assert.deepEqual(local().notes.map((/** @type {{ id: string }} */ n) => n.id), ['w2-1'], 'a Weekly 2 note, converted once');
  assert.deepEqual(local().tasks.map((/** @type {{ id: string }} */ t) => t.id), ['t_x']);
});

test('this browser’s own export restores tasks and notes, and writes no activity', async () => {
  local().deviceId = 'mine';
  const b = await openBackup(/** @type {any} */ (file(JSON.stringify({ deviceId: 'mine', 'day:2026-10-30': { a: { ms: 5 } }, notes: [{ id: 'n_a', title: 'Back' }], tasks: [] }))));
  assert.deepEqual(await applyBackup(b, { mode: 'merge' }), { tasks: 0, notes: 1, days: 0 });
  assert.equal(Object.keys(local()).some((k) => k.startsWith('imp:')), false);
});

test('Replace swaps only what the file carries: a Daybook backup replaces tasks and leaves notes alone', async () => {
  local().tasks = [{ id: 'old', title: 'Mine' }];
  local().notes = [{ id: 'n_keep', title: 'Kept', body: '' }];
  const b = readBackup(fixture('daybook-backup.json'), 'mine');
  assert.deepEqual(await applyBackup(b, { mode: 'replace' }), { tasks: 3, notes: 0, days: 0 });
  assert.deepEqual(local().tasks.map((/** @type {{ title: string }} */ t) => t.title), ['Renew the SSL certificate', 'Book the team offsite', 'Read the Raft paper']);
  assert.deepEqual(local().notes.map((/** @type {{ id: string }} */ n) => n.id), ['n_keep']);
});

test('Merge keeps every task already here; Replace of a Weekly export brings its notes and settings, never a webhook', async () => {
  local().tasks = [{ id: 't_1', title: 'Edited here since' }];
  local().notes = [{ id: 'n_old', title: 'Only here', body: '' }];
  local().settings = { slackWebhook: 'https://hooks.slack.com/services/mine', theme: 'light' };
  const text = JSON.stringify({ deviceId: 'other', tasks: [{ id: 't_1', title: 'Stale copy' }], notes: [{ id: 'n_new', title: 'From the file' }],
    settings: { theme: 'dark', role: 'sales', slackWebhook: 'https://hooks.slack.com/services/theirs' } });
  await applyBackup(readBackup(text, 'mine'), { mode: 'merge' });
  assert.equal(local().tasks[0].title, 'Edited here since');
  assert.equal(local().settings.theme, 'light', 'Merge leaves settings alone');
  await applyBackup(readBackup(text, 'mine'), { mode: 'replace' });
  assert.deepEqual(local().notes.map((/** @type {{ id: string }} */ n) => n.id), ['n_new']);
  assert.deepEqual([local().settings.theme, local().settings.role, local().settings.slackWebhook], ['dark', 'sales', 'https://hooks.slack.com/services/mine']);
});

test('private notes with their PIN record go to the worker; its refusal stops the import before anything is written', async () => {
  const b = readBackup(fixture('forgetmenot-backup.json'), 'mine');
  stub.chrome.runtime.sendMessage = async (/** @type {any} */ m) => (stub.log.messages.push(m), { ok: false, error: 'That isn’t the PIN the file’s private notes were locked with.' });
  await assert.rejects(applyBackup(b, { mode: 'merge', pin: '0000' }), /isn’t the PIN/);
  const sent = /** @type {any} */ (stub.log.messages.at(-1));
  assert.deepEqual([sent.type, sent.pin, sent.sealed.length, sent.notes.length], ['crypto:import', '0000', 1, 2]);
  assert.equal(local().notes, undefined, 'nothing written');
  stub.chrome.runtime.sendMessage = async () => ({ ok: true, added: 3 });
  assert.deepEqual(await applyBackup(b, { mode: 'merge', pin: '1234' }), { tasks: 0, notes: 3, days: 0 });
});

test('a Weekly file whose private notes lack their PIN record imports its plain notes and leaves those out', async () => {
  const b = readBackup(JSON.stringify({ deviceId: 'd2', notes: [{ id: 'n_p', title: 'Plain' }, { id: 'n_s', enc: { iv: 'AAAA', ct: 'BBBB' } }] }), 'mine');
  assert.deepEqual(await applyBackup(b, { mode: 'merge' }), { tasks: 0, notes: 1, days: 0 });
  assert.deepEqual(local().notes.map((/** @type {{ id: string }} */ n) => n.id), ['n_p']);
});

test('cleanEntry caps ms at a day and strings at 500 chars', () => {
  const e = cleanEntry({ category: 'x'.repeat(900), task: 't', url: 'https://a', ms: 9e9 });
  assert.equal(e?.ms, 864e5);
  assert.equal(e?.category.length, 500);
});

test('exportAll reads storage: settings travel without the Slack webhook', async () => {
  Object.assign(local(), { 'day:2026-10-30': { a: 1 }, 'meta:2026-10-30': {}, notes: [], deviceId: 'd1', settings: { slackWebhook: 'secret' } });
  const out = await exportAll();
  assert.deepEqual(Object.keys(out).sort(), ['app', 'day:2026-10-30', 'deviceId', 'meta:2026-10-30', 'notes', 'settings', 'version']);
  assert.deepEqual(out.settings, {});
});
```

In `test/task-portability.test.js`, replace:

```js
const { parseImport, mergeTasks, replaceAll, deleteEverything } = await import('../src/lib/task-portability.js');
```

with:

```js
const { mergeTasks, replaceAll, deleteEverything } = await import('../src/lib/task-portability.js');
const { readBackup } = await import('../src/lib/backup.js');
/** A Daybook file, read the way the import reads it. @param {string} text */
const parseImport = (text) => readBackup(text, 'this-browser');
```

In `test/task-portability.test.js`, replace:

```js
test('a Daybook envelope is recognised', () => {
  const p = parseImport(envelope([{ id: 'a', title: 'one' }, { id: 'b', title: 'two' }]));
  assert.equal(p.recognised, true);
```

with:

```js
test('a Daybook envelope is recognised as a Daybook backup', () => {
  const p = parseImport(envelope([{ id: 'a', title: 'one' }, { id: 'b', title: 'two' }]));
  assert.equal(p.format, 'daybook');
```

In `test/task-portability.test.js`, replace:

```js
test('a bare array is accepted but not marked as a Daybook export', () => {
  const p = parseImport(JSON.stringify([{ title: 'hand rolled' }]));
  assert.equal(p.recognised, false);
```

with:

```js
test('a bare array is accepted as tasks', () => {
  const p = parseImport(JSON.stringify([{ title: 'hand rolled' }]));
  assert.equal(p.format, 'daybook');
```

In `test/task-portability.test.js`, replace:

```js
  assert.throws(() => parseImport('<html>nope</html>'), /valid JSON/);
  assert.throws(() => parseImport(''), /valid JSON/);
```

with:

```js
  assert.throws(() => parseImport('<html>nope</html>'), /Not a valid export file/);
  assert.throws(() => parseImport(''), /Not a valid export file/);
```

In `test/task-portability.test.js`, replace:

```js
  assert.throws(() => parseImport(JSON.stringify({ unrelated: true })), /no tasks/);
```

with:

```js
  assert.throws(() => parseImport(JSON.stringify({ unrelated: true })), /isn’t a Weekly, Daybook or ForgetMeNot backup/);
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/portability.test.js test/task-portability.test.js`

Expected: every test that calls `openBackup` or `applyBackup` fails with `TypeError: … is not a function` (seven); `cleanEntry` and `exportAll` pass, and so does `test/task-portability.test.js` (its parse tests now read files through `readBackup`); `# fail 7`.

- [ ] **Step 3: Write the failing end-to-end checks**

Section 9 of `full.mjs` moves to the two-step flow (choose, then Import), its own-export check changes meaning (restored, not refused), and `data.mjs` adds the three formats.

Create `test/e2e/data.mjs`:

```js
// Import of the three formats (D11, F7; spec §4 Import, §6), from real backup files made by
// Daybook and ForgetMeNot (test/fixtures). sw.evaluate callbacks use only chrome.*, built-ins and their argument (R1).
import fs from 'fs';
const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url).pathname;
const FMN = JSON.parse(fs.readFileSync(fixture('forgetmenot-backup.json'), 'utf8'));
const DAYBOOK = ['Renew the SSL certificate', 'Book the team offsite', 'Read the Raft paper'];

const choose = async (rep, wait, path) => { await rep.setInputFiles('#import', path); await wait(700); };
const go = async (rep, wait) => { await rep.click('#importGo'); await wait(1500); };
/** Private notes opened by the worker's current key, from the report page (an extension page may ask). */
const opened = (rep) => rep.evaluate(async () => {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const items = notes.filter((n) => n.enc).map((n) => ({ id: n.id, enc: n.enc }));
  return Object.values((await chrome.runtime.sendMessage({ type: 'crypto:decrypt', items })).plain ?? {});
});

export async function daybookImportChecks(t, rep) {
  const { check, store, wait } = t;
  await choose(rep, wait, fixture('daybook-backup.json'));
  const what = await rep.textContent('#importWhat');
  check('Import', 'a Daybook backup: the panel says what it holds before anything is written (D11)', what === 'A Daybook backup: 3 tasks.'
    && !(await store()).tasks.some((x) => x.title === DAYBOOK[0]) && (await rep.textContent('#replaceLabel')) === 'Replace my tasks with the file’s', what);
  await go(rep, wait);
  const titles = (await store()).tasks.map((x) => x.title);
  check('Import', 'Add brings its tasks in, done and due dates kept (D11)', DAYBOOK.every((x) => titles.includes(x)) && /Imported 0 days of activity, 3 tasks and 0 notes/.test(await rep.textContent('#settingsMsg'))
    && (await store()).tasks.find((x) => x.title === DAYBOOK[1])?.status === 'done', await rep.textContent('#settingsMsg'));
  await choose(rep, wait, fixture('daybook-backup.json')); await go(rep, wait);
  check('Import', 'the same backup again adds nothing: tasks match by id', (await store()).tasks.filter((x) => x.title === DAYBOOK[0]).length === 1 && /0 tasks/.test(await rep.textContent('#settingsMsg')));
}

export async function forgetMeNotImportChecks(t, rep) {
  const { check, store, wait } = t;
  await choose(rep, wait, fixture('forgetmenot-backup.json'));
  const { unlabeled } = await import('./panel.mjs');
  check('Import', 'a ForgetMeNot export asks for the PIN its private note was locked with (F7)', (await rep.textContent('#importWhat')) === 'A ForgetMeNot backup: 3 notes (1 private).'
    && await rep.isVisible('#importPin') && !(await rep.isVisible('#importLocalPin')) && (await unlabeled(rep)).length === 0, (await unlabeled(rep)).join(', '));
  await rep.fill('#importPin', '9999'); await go(rep, wait);
  check('Import', 'a wrong PIN is refused in words; nothing is written', /isn’t the PIN/.test(await rep.textContent('#settingsMsg')) && await rep.isVisible('#importPanel')
    && !(await store()).notes.some((n) => n.title === 'Vendor call') && !(await store()).security, await rep.textContent('#settingsMsg'));
  await rep.fill('#importPin', '1234'); await go(rep, wait);
  const st = await store();
  const plain = await opened(rep);
  check('Import', 'the right PIN brings its notes in; the private one is sealed again, title inside, under its PIN (F7, F8)', st.notes.some((n) => n.title === 'Vendor call' && n.pinned)
    && st.security?.salt === FMN.security.salt && !JSON.stringify(st.notes).includes('10% raise') && st.notes.filter((n) => n.enc).every((n) => !n.title && !n.body) && plain.some((p) => p?.title === 'Salary talk' && /10% raise/.test(p.body)), JSON.stringify(plain));
}

// Export carries the PIN record; a browser whose PIN has changed since takes the file's private note under its own PIN.
export async function pinImportChecks(t, rep) {
  const { sw, check, store, wait, S } = t;
  const [dl] = await Promise.all([rep.waitForEvent('download'), rep.click('#export')]);
  const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check('Data', 'export carries the PIN record (a salt and check value, never the PIN) and private notes as ciphertext (F7)', exported.security?.salt === FMN.security.salt
    && !JSON.stringify(exported.security).includes('"1234"') && exported.notes.some((n) => n.enc) && !JSON.stringify(exported).includes('10% raise'));
  const file = S + '/with-pin.json'; fs.writeFileSync(file, JSON.stringify(exported));
  await rep.evaluate(() => chrome.runtime.sendMessage({ type: 'crypto:changePin', pin: '1234', next: '5678' }));
  await sw.evaluate(() => chrome.storage.local.get('notes').then(({ notes }) => chrome.storage.local.set({ notes: notes.filter((n) => !n.enc) })));
  const mySalt = (await store()).security.salt;
  await choose(rep, wait, file);
  check('Import', 'with a different PIN here, it asks for mine too and which PIN to keep (spec §4)', await rep.isVisible('#importLocalPin') && await rep.isChecked('input[name=importKeep][value=mine]'));
  await rep.fill('#importPin', '1234'); await rep.fill('#importLocalPin', '5678'); await go(rep, wait);
  const plain = await opened(rep);
  check('Import', 'keep mine: the file’s private note comes back under my PIN; my PIN record stays', (await store()).security.salt === mySalt
    && plain.length === 1 && plain[0]?.title === 'Salary talk', `${await rep.textContent('#settingsMsg')} ${JSON.stringify(plain)}`);
}

// Replace swaps only what a file carries. The run ends with no PIN, as before (delete-all keeps the record).
export async function replaceImportChecks(t, rep) {
  const { check, store, wait } = t;
  const notesBefore = (await store()).notes.length;
  await choose(rep, wait, fixture('daybook-backup.json'));
  await rep.check('input[name=importMode][value=replace]'); await go(rep, wait);
  const st = await store();
  check('Import', 'Replace with a Daybook backup swaps the tasks for the file’s and leaves notes alone (D11)', st.tasks.map((x) => x.title).join('|') === DAYBOOK.join('|')
    && st.notes.length === notesBefore, `${st.tasks.length} ${st.notes.length}/${notesBefore}`);
  await choose(rep, wait, fixture('forgetmenot-backup.json'));
  await rep.check('input[name=importMode][value=replace]'); await wait(200);
  const asksMine = await rep.isVisible('#importLocalPin');
  await rep.fill('#importPin', '1234'); await go(rep, wait);
  const s2 = await store();
  check('Import', 'Replace with a ForgetMeNot export: the notes become the file’s and its PIN wins (F7)', !asksMine && s2.notes.map((n) => n.id).sort().join() === FMN.notes.map((n) => n.id).sort().join()
    && s2.security.salt === FMN.security.salt, s2.notes.map((n) => n.id).join());
  await rep.evaluate(() => chrome.runtime.sendMessage({ type: 'crypto:removePin', pin: '1234' })); await wait(300);
}
```

In `test/e2e/full.mjs`, replace:

```js
await rep.setInputFiles('#import', ownFile); await wait(500);
check('Data', 'importing this browser’s own export is refused', /came from this browser/.test(await rep.textContent('#settingsMsg')), await rep.textContent('#settingsMsg'));
```

with:

```js
const importFile = async f => { await rep.setInputFiles('#import', f); await wait(700); await rep.click('#importGo'); await wait(1200); };
await rep.setInputFiles('#import', ownFile); await wait(700);
check('Data', 'this browser’s own export is a backup: its activity is already here, so it is left out', /from this browser/.test(await rep.textContent('#importWhat')) && /activity is already here/.test(await rep.textContent('#importWhat')), await rep.textContent('#importWhat'));
await rep.click('#importCancel'); await wait(200);
```

In `test/e2e/full.mjs`, replace:

```js
await rep.setInputFiles('#import', otherFile); await wait(1200);
check('Data', 'import from another device', /Imported 1 days and 1 notes/.test(await rep.textContent('#settingsMsg')), await rep.textContent('#settingsMsg'));
const total1 = await rep.textContent('#summary');
check('Data', 'imported time is added to the week', total1 !== total0 && (await rep.locator('.item .task').allTextContents()).some(t => t.includes('Jane Doe')), total1);
await rep.setInputFiles('#import', otherFile); await wait(1200);
```

with:

```js
await importFile(otherFile);
check('Data', 'import from another device', /Imported 1 day of activity, 0 tasks and 1 note\./.test(await rep.textContent('#settingsMsg')), await rep.textContent('#settingsMsg'));
const total1 = await rep.textContent('#summary');
check('Data', 'imported time is added to the week', total1 !== total0 && (await rep.locator('.item .task').allTextContents()).some(t => t.includes('Jane Doe')), total1);
await importFile(otherFile);
```

In `test/e2e/full.mjs`, replace:

```js
check('Data', 'broken file rejected with a clear message', /Not a valid export file/.test(await rep.textContent('#settingsMsg')));

```

with:

```js
check('Data', 'broken file rejected with a clear message', /Not a valid export file/.test(await rep.textContent('#settingsMsg')));
const { daybookImportChecks, forgetMeNotImportChecks, pinImportChecks, replaceImportChecks } = await import('./data.mjs');
await daybookImportChecks(harness, rep);
await forgetMeNotImportChecks(harness, rep);
await pinImportChecks({ ...harness, S }, rep);
await replaceImportChecks(harness, rep);

```

- [ ] **Step 4: Run them to see them fail**

Run: `npm run e2e`

Expected: the run stops in section 9 with `page.textContent: Timeout 30000ms exceeded` waiting for `#importWhat` (the old import refused the file outright, so there is no panel); `npm run e2e` exits non-zero.

- [ ] **Step 5: Write the import's writes, and drop the old readers**

Replace the whole of `src/lib/portability.js` with:

```js
// Export and import (D11, F7; spec §4 Import, §6). backup.js reads and validates a
// file; this writes what it accepted, and builds the export.
import { mutateNotes, mergeNotes } from './notes.js';
import { mergeTasks, replaceAll } from './task-portability.js';
import { updateSettings } from './settings.js';
import { readBackup } from './backup.js';

/** @typedef {import('./backup.js').Backup} Backup */
/** @typedef {{ mode: 'merge' | 'replace', pin?: string, localPin?: string, keep?: 'mine' | 'theirs' }} ImportChoice */

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/**
 * What Export writes (D11, F7): activity, tasks, notes as stored (private ones as
 * ciphertext), the PIN record (a salt and a check value, never the PIN), settings
 * without the Slack webhook (a secret), and the device ID. Drafts, history
 * estimates and page state stay behind.
 * @param {Record<string, unknown>} all
 */
export function exportPayload(all) {
  /** @type {Record<string, unknown>} */
  const out = { app: 'Weekly', version: 3 };
  for (const [k, v] of Object.entries(all)) if (/^(day|meta):/.test(k) || ['notes', 'tasks', 'security', 'deviceId'].includes(k)) out[k] = v;
  const s = all['settings'];
  if (typeof s === 'object' && s !== null && !Array.isArray(s)) {
    const { slackWebhook, ...rest } = /** @type {Record<string, unknown>} */ (s);
    out['settings'] = rest;
  }
  return out;
}

/** Everything a backup contains, read from storage. */
export async function exportAll() {
  return exportPayload(await chrome.storage.local.get(null));
}

/** A chosen file, size-checked, then recognised and validated. Writes nothing. @param {Blob} file @returns {Promise<Backup>} */
export async function openBackup(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('File is too large (max 20 MB).');
  const { deviceId } = await chrome.storage.local.get('deviceId');
  return readBackup(await file.text(), typeof deviceId === 'string' ? deviceId : undefined);
}

/**
 * Notes in one write. With private notes and their PIN record, the worker writes
 * them: only it may open and seal them, and only it writes the record.
 * @param {Backup} b @param {ImportChoice} c @returns {Promise<number>} how many were added
 */
async function writeNotes(b, c) {
  if (!b.carries.notes) return 0;
  if (b.sealed.length && b.security) {
    const r = await chrome.runtime.sendMessage({ type: 'crypto:import', mode: c.mode, security: b.security,
      notes: b.notes, sealed: b.sealed, pin: c.pin, localPin: c.localPin, keep: c.keep });
    if (!r?.ok) throw new Error(r?.error ?? 'Weekly’s background worker did not answer, so nothing was imported.');
    return r.added;
  }
  if (c.mode === 'replace') return mutateNotes(() => ({ notes: b.notes, result: b.notes.length }));
  return mergeNotes(b.notes);
}

/**
 * Write a backup readBackup accepted (spec §6: validated first, then written). Notes
 * go first, so a wrong PIN stops the import before anything has changed; then tasks,
 * settings (Replace only) and the other browser's activity, each in one write.
 * Replace swaps only what the file carries; Merge keeps every task you already have
 * and the newer copy of a note.
 * @param {Backup} b @param {ImportChoice} c
 * @returns {Promise<{ tasks: number, notes: number, days: number }>} what was added
 */
export async function applyBackup(b, c) {
  const notes = await writeNotes(b, c);
  let tasks = 0;
  if (b.carries.tasks) tasks = (await (c.mode === 'replace' ? replaceAll(b.tasks) : mergeTasks(b.tasks))).added;
  if (c.mode === 'replace' && b.settings) await updateSettings(b.settings);
  if (b.deviceId && b.days) {
    // Imported logs live under imp:<deviceId>:<date>, so importing the same file again replaces rather than double-counts.
    const { imports = [] } = await chrome.storage.local.get('imports');
    await chrome.storage.local.set({ ...b.activity, imports: [...new Set([...imports, b.deviceId])] });
  }
  return { tasks, notes, days: b.days };
}
```

In `src/lib/task-portability.js`, replace:

```js
 * Daybook backup import (merge or replace) and delete-all for tasks.
 * From Daybook's portability.js. Export and the three-format import UI arrive in
 * Phase 5, which folds this into lib/portability.js. Every imported record goes
 * through coerceTask, like anything else that crosses a trust boundary.
```

with:

```js
 * Task writes for an import (merge or replace) and Delete everything. From Daybook's
 * portability.js; reading a file is backup.js's job (coerceTask on every record).
```

In `src/lib/task-portability.js`, replace:

```js
import { coerceTaskList } from './schema.js';

/** @typedef {import('./schema.js').Task} Task */

const FORMAT = 'daybook.tasks';

/**
 * @typedef {object} ParsedImport
 * @property {Task[]} tasks
 * @property {number} dropped      records with no usable title
 * @property {number} duplicates   repeated ids within the file
 * @property {boolean} recognised  carried the Daybook envelope
 */

/**
 * Parse and validate an import file. Never throws on bad *content* — only on
 * input that is not JSON at all, which is the one case worth reporting verbatim.
 *
 * @param {string} text
 * @returns {ParsedImport}
 */
export function parseImport(text) {
  /** @type {unknown} */
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const isEnvelope =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw) &&
    /** @type {Record<string, unknown>} */ (raw)['format'] === FORMAT;

  // A bare array is accepted too: it is what a user gets from a hand-rolled
  // script, and refusing it would be pedantry rather than safety.
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null
      ? /** @type {Record<string, unknown>} */ (raw)['tasks']
      : null;

  const { tasks, dropped, duplicates } = coerceTaskList(list);
  if (!tasks.length && !dropped) throw new Error("That file has no tasks in it.");

  return { tasks, dropped, duplicates, recognised: isEnvelope };
}
```

with:

```js

/** @typedef {import('./schema.js').Task} Task */
```

- [ ] **Step 6: Build the import panel**

In `src/ui/report/report.html`, replace:

```html
          <button id="importBtn">Import from another computer</button>
          <input id="import" type="file" accept="application/json,.json" hidden>
          <button id="clear" class="danger">Delete everything</button>
```

with:

```html
          <button id="importBtn">Import a backup</button>
          <input id="import" type="file" accept="application/json,.json" hidden>
          <button id="clear" class="danger">Delete everything</button>
        </div>
        <p class="hint">Import takes a Weekly export from this or another computer, a Daybook backup or a ForgetMeNot export.</p>
        <div id="importPanel" class="import" hidden>
          <p id="importWhat"></p>
          <div role="radiogroup" aria-label="How to import">
            <label class="check"><input type="radio" name="importMode" value="merge" checked> Add what’s new to what’s here</label>
            <label class="check"><input type="radio" name="importMode" value="replace"> <span id="replaceLabel">Replace mine with the file’s</span></label>
          </div>
          <div id="importPins" hidden>
            <label>PIN the file’s private notes were locked with
              <input id="importPin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
            <div id="importMine" hidden>
              <label>Your PIN (not needed for your own backup)
                <input id="importLocalPin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
              <div role="radiogroup" aria-label="Which PIN to keep">
                <label class="check"><input type="radio" name="importKeep" value="mine" checked> Keep my PIN for all private notes</label>
                <label class="check"><input type="radio" name="importKeep" value="theirs"> Use the file’s PIN for all private notes</label>
              </div>
            </div>
          </div>
          <div class="row">
            <button id="importGo" type="button">Import</button>
            <button id="importCancel" type="button" class="quiet">Cancel</button>
          </div>
```

In `src/ui/report/report.css`, replace:

```css
i.key { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 4px 0 8px; vertical-align: -1px; }

```

with:

```css
i.key { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 4px 0 8px; vertical-align: -1px; }
.import { background: var(--marker-wash); border-radius: 4px; padding: 10px 12px; margin-top: 10px; }
.import p { margin: 0 0 6px; font-size: 13px; }

```

Create `src/ui/report/import-panel.js`:

```js
// Settings → Your data → Import (D11, F7): choose a Weekly export, a Daybook backup
// or a ForgetMeNot export; see what it holds and what is left out; Add or Replace;
// give the PINs its private notes need. Nothing is written until Import is pressed.
import { $, $$ } from '../components/dom.js';
import { openBackup, applyBackup } from '../../lib/portability.js';
import { describeBackup, replaces } from '../../lib/backup.js';
import { msg, load } from './main.js';

/** The file read and accepted, waiting for Import or Cancel. */
let pending = null;
let hasPin = false;

const mode = () => $('input[name=importMode]:checked').value;
const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

// The file's PIN when it has private notes; yours too when you have a PIN and are adding to what's here.
function showPins() {
  const priv = !!(pending?.sealed.length && pending.security);
  $('#importPins').hidden = !priv;
  $('#importMine').hidden = !(priv && hasPin && mode() === 'merge');
}

function close() {
  pending = null;
  $('#importPanel').hidden = true;
  $('#importPin').value = $('#importLocalPin').value = '';
}

async function choose(file) {
  close();
  try { pending = await openBackup(file); } catch (e) { msg('#settingsMsg', e.message); return; }
  hasPin = !!(await chrome.runtime.sendMessage({ type: 'crypto:status' }).catch(() => null))?.hasPin;
  $('#importWhat').textContent = describeBackup(pending).join(' ');
  $('#replaceLabel').textContent = `Replace my ${replaces(pending)} with the file’s`;
  $('input[name=importMode][value=merge]').checked = true;
  $('input[name=importKeep][value=mine]').checked = true;
  msg('#settingsMsg', '');
  $('#importPanel').hidden = false;
  showPins();
}

async function go() {
  if (!pending) return;
  try {
    const r = await applyBackup(pending, { mode: mode(), pin: $('#importPin').value, localPin: $('#importLocalPin').value,
      keep: $('input[name=importKeep]:checked').value });
    close();
    msg('#settingsMsg', `Imported ${count(r.days, 'day')} of activity, ${count(r.tasks, 'task')} and ${count(r.notes, 'note')}.`);
    load();
  } catch (e) { msg('#settingsMsg', e.message); }
}

export function init() {
  $('#importBtn').onclick = () => $('#import').click();
  $('#import').onchange = e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) void choose(f);
  };
  $('#importGo').onclick = () => void go();
  $('#importCancel').onclick = () => { close(); msg('#settingsMsg', 'Nothing was imported.'); };
  $$('input[name=importMode]').forEach(i => i.addEventListener('change', showPins));
}
```

In `src/ui/report/data-panel.js`, replace:

```js
// Export, import, delete-everything and the multi-week trends table.
```

with:

```js
// Export, delete-everything and the multi-week trends table (import: import-panel.js).
```

In `src/ui/report/data-panel.js`, replace:

```js
import { exportAll, applyImport } from '../../lib/portability.js';
```

with:

```js
import { exportAll } from '../../lib/portability.js';
```

In `src/ui/report/data-panel.js`, replace:

```js
  $('#importBtn').onclick = () => $('#import').click();
  $('#import').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try { const r = await applyImport(file); msg('#settingsMsg', `Imported ${r.days} days and ${r.notes} notes.`); load(); }
    catch (err) { msg('#settingsMsg', err.message); }
    finally { e.target.value = ''; }
  };
```

with:

```js

```

In `src/ui/report/data-panel.js`, replace:

```js
  $('#export').onclick = downloadExport;

  $('#clear').onclick = clearAll;
```

with:

```js
  $('#export').onclick = downloadExport;
  $('#clear').onclick = clearAll;
```

In `src/ui/report/main.js`, replace:

```js
import * as history from './history-panel.js';
init();
[categories, draft, aiPanel, share, notes, settings, reminderSettings, pinSettings, data, history].forEach((m) => m.init());
```

with:

```js
import * as importPanel from './import-panel.js';
import * as history from './history-panel.js';
init();
[categories, draft, aiPanel, share, notes, settings, reminderSettings, pinSettings, data, importPanel, history].forEach((m) => m.init());
```

- [ ] **Step 7: Run the gate**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 318`, `# pass 318`, `# fail 0` in each timezone (317 + 1: `portability.test.js` has 9 tests where it had 8); typecheck clean; `268/268 passed` (257 + 11: `[Import]` 10 and `[Data]` 1 for the export's PIN record; the own-export check is reworded), `No tabs: 9/9 passed`.

---

### Task 9: README, size and layering checks, the phase gate

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document tracking as a choice, Stats, daily tasks, Appearance and backups**

In `README.md`, replace:

```markdown
Records which tab you're actively looking at, across every Chrome window, and turns your week into a draft update. It's built for anyone who works in Chrome: engineers, product, sales, HR and recruiting, SEO and marketing, and support. Optionally, the draft can be polished by **Chrome's built-in AI (Gemini Nano)**, which runs on your computer.
```

with:

```markdown
Plans your week's tasks, keeps your notes and, if you turn tracking on, records which tab you're actively looking at, across every Chrome window, and turns your week into a draft update. It's built for anyone who works in Chrome: engineers, product, sales, HR and recruiting, SEO and marketing, and support. Optionally, the draft can be polished by **Chrome's built-in AI (Gemini Nano)**, which runs on your computer.
```

In `README.md`, replace:

```markdown
3. A welcome page opens: pick your role, optionally fill in the last 15 days from Chrome history, and keep or turn off the morning and evening reminders.
```

with:

```markdown
3. A welcome page opens. First it asks **Track my week?**: yes and Chrome asks whether Weekly may read your tabs; no and Weekly is your tasks and notes, with nothing recorded. Then pick your role, optionally fill in the last 15 days from Chrome history (with tracking on), and keep or turn off the morning and evening reminders.
```

In `README.md`, replace:

```markdown
- Only the active tab of the focused Chrome window. Time stops when Chrome loses focus, you go idle (default 2 min), or your screen locks. When you go idle, time already counted since your last activity is taken back.
```

with:

```markdown
- Nothing, until you turn tracking on (the welcome page, or **Settings → Tracking**, which you can turn off again). Tracking needs Chrome's `tabs` permission, so the install itself asks for no access to your browsing.
- Then only the active tab of the focused Chrome window. Time stops when Chrome loses focus, you go idle (default 2 min), or your screen locks. When you go idle, time already counted since your last activity is taken back.
```

In `README.md`, replace:

```markdown
- **Tasks**: Today, Week, Overdue, Upcoming, All open and Completed, with search ( / ) and a priority filter. **Edit…** in a task's ⋯ menu changes its title, description, priority and date.
- **Done**: tasks closed Monday to Friday lead the weekly update. A daily task appears once with its count, e.g. "Standup notes (4 of 5 days)". Untick any of them to leave it out of that week.
```

with:

```markdown
- **Tasks**: Today, Week, Overdue, Upcoming, All open and Completed, with search ( / ) and a priority filter. **Edit…** in a task's ⋯ menu changes its title, description, priority and date.
- **Stats** (**Open Weekly**): days in a row with everything done (days with nothing on them don't break a run; today counts once it's done), the longest run, a year of days shaded like the calendar, how each weekday goes, and how often each daily task was ticked on the days it was due.
- **Daily tasks** (on **Stats**): **Stop repeating** ends a daily task from today and keeps its past ticks; stopped ones are listed underneath with **Repeat again**. **Delete…** removes a daily task and all its ticks, after asking (**Undo** still brings it back).
- **Done**: tasks closed Monday to Friday lead the weekly update. A daily task appears once with its count, e.g. "Standup notes (4 of 5 days)". Untick any of them to leave it out of that week.
```

In `README.md`, replace:

```markdown
- **Several computers**: **Export JSON** on one and **Import from another device** on the other. Re-importing the same device replaces its data instead of adding it twice.
```

with:

```markdown
- **Backups and other computers**: **Export** saves tasks, notes (private ones stay encrypted), the PIN record (never the PIN), settings (never the Slack webhook) and activity. **Import a backup** takes that file, a Daybook backup or a ForgetMeNot export. It says what the file holds before anything changes, then **Add** (tasks you have are never overwritten; of two copies of a note the newer stays) or **Replace** (swaps only what the file carries: a Daybook backup replaces tasks, a ForgetMeNot export notes). Private notes need the PIN they were locked with; if you have a different PIN, you choose which one to keep. Activity from another computer is kept under that computer, so importing it again replaces it rather than adding it twice. Files over 20 MB are refused.
```

In `README.md`, replace:

```markdown

## Limits
```

with:

```markdown

**Settings → Appearance** picks light, dark, or the same as your computer (the default). It applies at once to every Weekly page, including the note you open on a web page.

## Limits
```

In `README.md`, replace:

```markdown
| `npm run e2e` | Builds, loads the extension in Chromium, runs the end-to-end suite |
```

with:

```markdown
| `npm run e2e` | Builds, loads the extension in Chromium, runs the end-to-end suite, then the no-tabs checks on the build as shipped |
```

In `README.md`, replace:

```markdown
  task-portability.js  Daybook backup import (merge / replace), delete all tasks
```

with:

```markdown
  task-portability.js  task writes for an import (merge / replace), delete all tasks
```

In `README.md`, replace:

```markdown
  portability.js   export / import
  activity/        classify, history, range loading, tracker status
```

with:

```markdown
  backup.js        reads a Weekly export, a Daybook backup or a ForgetMeNot export, validated (pure)
  portability.js   export, and writing an accepted import
  stats.js         streaks, the year of days, weekday and per-task rates (pure)
  activity/        classify, history, range loading, tracker status and the tabs permission
```

In `README.md`, replace:

```markdown
src/ui/            panel/ (side panel), app/ (calendar, tasks, notes), remind/ (reminder window), welcome, report tab
  components/      dom.js (h() builds all DOM), task rows, bands, undo toast, keys, the notes view and private-note client
```

with:

```markdown
src/ui/            panel/ (side panel), app/ (calendar, tasks, notes, stats), remind/ (reminder window), welcome, report tab
  components/      dom.js (h() builds all DOM), theme.js, task rows, bands, undo toast, keys, the notes view and private-note client
```

- [ ] **Step 2: Check sizes and layering**

Run: `wc -l src/lib/stats.js src/lib/backup.js src/lib/portability.js src/background/crypto-broker.js src/ui/app/stats-view.js src/ui/app/daily-tasks.js src/ui/report/import-panel.js src/lib/activity/status.js && (grep -n 'chrome\.' src/lib/stats.js src/lib/backup.js || echo 'stats.js and backup.js are pure') && (grep -rn 'chrome.storage' src/ui/panel src/ui/app src/ui/components src/ui/remind src/ui/report/import-panel.js || echo 'no direct storage in new UI') && (grep -rnE 'storage\.sync' src || echo 'no storage.sync') && (grep -rn 'Object.assign' src/lib/backup.js src/lib/portability.js || echo 'no Object.assign on imported data')`

Expected: `stats.js` 129, `backup.js` 172, `portability.js` 81, `crypto-broker.js` 252 (the largest file in `src/`), `stats-view.js` 73, `daily-tasks.js` 43, `import-panel.js` 63, `status.js` 43; then `stats.js and backup.js are pure`, `no direct storage in new UI`, `no storage.sync`, `no Object.assign on imported data`. `test/e2e/full.mjs` stays the one file over 300 lines.

- [ ] **Step 3: Run the phase gate**

Run: `npm run package && npm run e2e`

Expected:
- `npm test`: `# tests 318`, `# pass 318`, `# fail 0` in each timezone (286 from Phase 4, plus 32).
- typecheck clean.
- `Packed 90 files → dist/weekly-2.0.0.zip` (84 + `stats.js`, `backup.js`, `theme.js`, `stats-view.js`, `daily-tasks.js`, `import-panel.js`; the fixtures are tests and are not packed).
- e2e: `268/268 passed`, then `No tabs: 9/9 passed`.

- [ ] **Step 4: Report**

Report to the controller: test counts per timezone, both e2e totals, the largest files, and any check that needed a retry. The import checks derive PIN keys several times (about 30 ms each in Node, a little more in Chromium) and wait 1.5 s after each Import; none is expected to be timing-sensitive beyond that.

---

## Interfaces exported for Phase 6 (release 3.0.0)

**Version and packaging**
- `package.json` and `manifest.json` still say `2.0.0`; `npm run build` stamps the manifest from `package.json`, so the bump is `npm version 3.0.0 --no-git-tag-version` (no git: the flag matters) and the zip becomes `dist/weekly-3.0.0.zip`. The phase gate here packs 90 files.
- The end-to-end harness (`test/e2e/run.mjs`) runs the main suite on a copy with `tabs` and `history` pre-granted, then `test/e2e/no-tabs.mjs` on the build exactly as shipped. Phase 6's "end-to-end on the built zip" can point both at the unzipped `dist/weekly-3.0.0.zip` instead of `dist/weekly`.

**Permissions to justify in `store-assets/store-listing.md`** (spec §3.6)
- Install: `storage`, `unlimitedStorage`, `idle`, `alarms`, `notifications`, `sidePanel`, `scripting`, `activeTab`. `tabs` is no longer an install permission, so the install shows no browsing-history warning; `downloads` (listed in spec §3.6) is not needed: Export saves through a blob link.
- Optional: `tabs` (tracking, asked by "Track my week?" or Settings → Tracking), `history` (Fill in from history), `https://*/*` (live status from Jira, GitLab, GitHub).
- The listing must say tracking is off until the user says yes, and what Chrome's prompt calls it ("Read your browsing history").

**Privacy policy (`store-assets/privacy-policy.html`) is stale in three places**
- "Pause tracking from the **toolbar popup**" (line 69): the toolbar opens the side panel; Pause is in its footer, and only with tracking on.
- Activity "(days, history estimates, **notes** and imported records) is deleted after 90 days" (line 52): notes and tasks are kept until the user deletes them; only activity is purged.
- It does not mention tasks, notes, private notes (PIN, PBKDF2 + AES-GCM, key in memory only), the on-page note (`activeTab` + `scripting`, injected only on Alt+N or the panel's button), tracking being optional, or that an export holds private notes as ciphertext and the PIN record but never the PIN or the Slack webhook.

**Store screenshots (`store-assets/generate.mjs`)**
- It opens `popup.html` (line 167) and writes `screenshot-4-popup.png`; that page no longer exists. The side panel is `src/ui/panel/panel.html`, the app `src/ui/app/app.html` (`#calendar`, `#tasks`, `#notes`, `#stats`), the report `src/ui/report/report.html`, the welcome page `src/ui/welcome/welcome.html`. Every page follows `settings.theme`, so a dark set of screenshots is `theme: 'dark'` in storage, not an emulated media query.
- The other screenshots predate tasks, notes, Stats and the three-step import.

**Spec items closed differently from the spec's wording** (for the release notes)
- `tracking:setEnabled` (spec §5) is not a message: the worker listens to `chrome.permissions.onAdded/onRemoved`.
- Import (spec §4) also restores this browser's own export (only its activity is skipped), and Replace swaps only what the file carries.

**Daybook and ForgetMeNot farewell updates (spec §8)** are outside this repo. Their export files are what `readBackup` reads today: Daybook `{format: 'daybook.tasks', schemaVersion: 1, tasks}` and ForgetMeNot `{app: 'ForgetMeNot', schemaVersion: 2, notes, security}`; a farewell build must not change those shapes.

## Self-review (done at authoring time)

**1. Spec coverage: every Phase 5 row, its task, and the check that proves it**

| Row | Requirement | Task | Proved by |
|---|---|---|---|
| L6 | Archive a recurring task keeping history | 2 | e2e `[Daily tasks] Stop repeating keeps its history and moves it to Stopped (L6)` |
| L6 | Restore | 2 | e2e `[Daily tasks] Repeat again brings it back (L6)` |
| L6 | Purge permanently (the confirmed hard delete, 2b ledger) | 2 | e2e `[Daily tasks] Delete asks first; Cancel keeps the task (L6)`, `Delete for good removes it and its ticks; Undo puts it back whole (L6)` |
| L7 | Current and longest streak | 1, 2 | unit `streaks run across New Year and skip weekends…`, `an unfinished today does not break the current streak; a missed day does`, `a streak across the US spring-forward Sunday counts every day once` (both timezones); e2e `[Stats] #stats opens the Stats view with six figures (L7)` |
| L7 | 365-day heatmap | 1, 2 | unit `a year is 365 consecutive local days ending today, across both DST changes and New Year`, `the heatmap is Monday-first weeks, padded at the start, each month labelled once`; e2e `[Stats] a year of days: 365 squares ending today, months labelled (L7)` |
| L7 | Weekday bars | 1, 2 | unit `weekday rates average each weekday’s share done…`; e2e `[Stats] weekday bars run Monday to Sunday (L7)` |
| L7 | Per-task completion rate | 1, 2 | unit `per-task rates count only the days a task occurred, never the future, best first`; e2e `[Stats] per-task rate counts the days it was due: 10 of 21, 48% (L7)` |
| L7 | Summary cards | 1, 2 | unit `summary cards: streaks, perfect days, average, active daily tasks, days with a plain note`; e2e six `.figure`s |
| F6 | Theme light / dark / system | 3 | unit `theme: light, dark or system (F6)…`; e2e `[Theme] Settings offers…`, `Dark applies to the report at once…`, `Light stays light when the computer is dark (F6)` |
| F6 | …on every page incl. side panel, app, report, reminder window, welcome, on-page note | 3 | e2e `[Theme] the side panel follows without a reload, and the app opens dark (F6)`, `the welcome page and the reminder window use it too (F6)`, `the on-page note is told the theme as data, not a stylesheet (F6)`; unit `notes:list carries the theme as data…` |
| L8 | Follows the OS when unset | 3 | e2e `[Theme] the computer’s choice follows it, dark then light (L8)`; `[Layout] dark mode applies` (unchanged) |
| D11 | Export (download) | 6 | unit `export: activity, tasks, notes as stored, the PIN record and settings, but never the Slack webhook (F7)`; e2e `[Data] export carries tasks and settings, but never the Slack webhook (F7)` |
| D11 | Import, merge or replace, validated | 6, 8 | unit `a Daybook backup, made by Daybook’s own export…`, `Replace swaps only what the file carries…`, `Merge keeps every task already here; Replace of a Weekly export brings its notes and settings, never a webhook`, `damaged records are counted and left out…`; e2e `[Import] a Daybook backup: the panel says what it holds before anything is written (D11)`, `Add brings its tasks in…`, `the same backup again adds nothing…`, `Replace with a Daybook backup swaps the tasks…` |
| F7 | Versioned export/import of notes + security record, merge or replace | 6, 7, 8 | unit `a ForgetMeNot export, made by ForgetMeNot…`, `the private ForgetMeNot note opens with its PIN through Weekly’s crypto…`, `a Weekly 3 export comes back whole…`, crypto-import (7 tests); e2e `[Import] a ForgetMeNot export asks for the PIN…`, `a wrong PIN is refused in words; nothing is written`, `the right PIN brings its notes in…`, `[Data] export carries the PIN record…`, `[Import] with a different PIN here, it asks for mine too and which PIN to keep (spec §4)`, `keep mine…`, `Replace with a ForgetMeNot export: the notes become the file’s and its PIN wins (F7)` |
| §4 | If a security record exists, the user confirms which PIN wins | 7, 8 | unit `a PIN here, keep mine…`, `a PIN here, keep the file’s…`, `a PIN here: mine is checked through the lockout…`; e2e `[Import] with a different PIN here…` |
| §6 | Rejected import says which field or format failed; nothing partially written | 6, 7, 8 | unit `refused in words: broken JSON, a file that is no backup, a newer ForgetMeNot, an empty Daybook backup, no device ID`, `a wrong PIN for the file writes nothing`, `private notes with their PIN record go to the worker; its refusal stops the import before anything is written`; e2e `[Data] broken file rejected with a clear message`, `[Import] a wrong PIN is refused in words; nothing is written` |
| D11 | Untrusted input, size limit, `__proto__` guards | 6, 8 | unit `__proto__, constructor and prototype keys never reach Object.prototype, anywhere in a file`, `importable settings…`, `a file over 20 MB is refused before it is read`; e2e `[Security] imported HTML is shown as text, not run`, `javascript: URL from import is dropped` (unchanged) |
| W3 | `tabs` optional | 5 | unit `tabs is optional…`; no-tabs e2e `the install asks for no tabs permission, and Chrome has not granted it (W3, spec §3.6)` |
| W3 | Welcome asks "Track my week?" and requests it | 5 | e2e `[Welcome] "Track my week?" comes first; yes turns tracking on and offers the history fill (W3)`; no-tabs `the welcome page opens on "Track my week?"…`, `"No thanks" leaves tracking off and says so` |
| W3 | Tracking off without it; everything else works | 5 | unit `without the tabs permission nothing is recorded…`, `granting or revoking tabs makes the tracker look again…`; no-tabs `browsing records nothing…`, `the side panel says tracking is off and offers no Pause`, `tasks work…`, `notes work…`, `the report and the app open; Settings show tracking off`, `[Errors] no page errors…` |
| §3.2 | Settings: tracking on/off grants or revokes `tabs` | 5 | unit `turning tracking on asks Chrome for tabs; off gives it back (W3)`; no-tabs `Settings show tracking off` |
| Phase 3 parked | m3, m5, `resetReminderState`, `snoozeUntil` | 4 | e2e `[Settings] a cleared reminder time is refused in words, not saved as the default`; unit `a recurring task is never overdue…`, `coerceReminderState discards non-dates…` (no `snoozeUntil`), `snooze brings the evening check back in an hour; the alarm is the only record` |
| W1 | Weekly 2 features survive | every task | all 238 Phase 4 checks pass; two reworded (`export carries tasks and settings…`, `this browser’s own export is a backup…`) and one message updated (`Imported 1 day of activity, 0 tasks and 1 note.`) |

**Unit tests added (32):** `stats.test.js` 8 (Task 1); `settings.test.js` +1, `background/onpage.test.js` +1 (Task 3); `tasks.test.js` +1 (Task 4; three others adjusted); `manifest.test.js` +1, `background/tracker.test.js` +1, `activity/status.test.js` +1, `background/service-worker.test.js` +1 (Task 5); `backup.test.js` 10, `portability.test.js` −1 (Task 6); `background/crypto-import.test.js` 7 (Task 7); `portability.test.js` +1 net, rewritten (Task 8). 286 → 318 per timezone.

**End-to-end checks added (30 + 9):** Task 2: 10 (`stats.mjs`). Task 3: 7 (`theme.mjs`). Task 4: 1 (`reminders.mjs`). Task 5: 1 (`full.mjs` welcome) and the separate no-tabs run, 9. Task 8: 11 (`data.mjs`). 238 → 268, plus `No tabs: 9/9`.

**2. Placeholder scan:** none. Every new file is written in full; every change to an existing file is an exact replace or a whole-file replacement against the file as the previous task left it. The plan was generated from, and replayed step by step on, a copy of the Phase 4 end state, including each "see it fail" run, with every task ending green.

**3. Type consistency:**
- `DayRow`, `TaskRate` (`stats.js`) are what `stats-view.js` and `daily-tasks.js` consume.
- `Backup`, `Sealed`, `Format` are defined once in `backup.js`; `portability.js` (`applyBackup`, `ImportChoice`), the broker (`crypto:import` reads `notes`, `sealed`, `security`, `pin`, `localPin`, `keep`, `mode`) and `import-panel.js` use the same names.
- `mergeNoteLists` (`note-views.js`) is the one merge rule; `mergeNotes` and the broker both call it.
- `trackingAllowed`, `allowTracking`, `stopTracking`, `trackerStatus().tracking` (`status.js`) are what the tracker, `footer.js`, `welcome.js` and `settings-panel.js` use.
- `Settings.theme` / `THEMES` (`settings.js`) are what `theme.js`, `settings-panel.js` and `onpage.js` read.

**Decisions the specs did not settle:**
- **Streaks:** days with nothing on them are skipped (neither break nor extend); today counts once perfect and never breaks the current streak while unfinished. dailies broke on empty days, which would break every Mon–Fri streak each weekend.
- **Stats live in the app** as a fourth view (`#stats`), Monday-first like the calendar; the figures are a ruled strip, not cards. "Days with a note" counts plain day notes only (private notes are not counted).
- **The daily tasks list is on Stats** (L6): the per-task rates are dailies' "per-task completion" and the natural place to stop, restart or delete a daily task. Stopped tasks sit under a disclosure. Delete asks with `confirm()` (as Delete everything does) and still offers Undo.
- **Theme** is a select in Settings → Appearance that saves at once; there is no extra toggle in the app header. The dark tokens are listed twice in `styles.css` rather than using `light-dark()`, which would raise the Chrome floor to 123. The on-page note's theme cannot be checked end to end (its Shadow DOM is closed); the data path is unit-tested and checked end to end through `notes:list`.
- **No `tracking:setEnabled` message:** Chrome's `permissions.onAdded/onRemoved` already reach the worker. The tracker also checks the permission itself, because `activeTab` (Alt+N) would otherwise expose one tab's address to it.
- **Tracking off hides Pause** in the panel footer and says where to turn it on; the history step of the welcome page appears only after "Yes".
- **This browser's own export imports** (restore after Delete everything); only its activity is skipped. Weekly 2 refused it.
- **Replace swaps only what the file carries.** A Daybook backup replaces tasks; a ForgetMeNot export replaces notes and its PIN wins; a Weekly export replaces tasks, notes and settings. Activity from another browser is always added under its device, as before.
- **Merge:** tasks already here always win (Daybook's rule); notes keep the newer copy (ForgetMeNot's rule).
- **PIN on import:** no PIN here or Replace → the file's record is adopted (ForgetMeNot's rule). Merge with a different PIN → the user picks Keep mine (the file's notes are sealed under it) or Use the file's (local private notes are re-sealed under the file's PIN); the local PIN goes through the lockout. The same record (your own backup) needs no second PIN. The file's PIN has no lockout (the file is offline anyway). A file that carries a PIN record but no private notes leaves the local PIN alone.
- **Private notes from ForgetMeNot** are sealed again with the title inside (F8), so after import their titles are hidden while locked, unlike in ForgetMeNot.
- **Settings travel** in a Weekly export without the Slack webhook (a secret); they are applied only on Replace, filtered by `importableSettings`, and the local webhook is kept.
- **No `downloads` permission:** Export keeps Weekly 2's blob link.
- **Phase 3 parked items** are fixed here (Task 4) rather than in a separate wave; `isOverdue` excluding recurring tasks matters once imports bring tasks Weekly did not write.
