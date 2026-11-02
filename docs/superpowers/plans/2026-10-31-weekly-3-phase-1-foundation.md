# Weekly 3.0, Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Weekly 2.0 into Daybook's ES-module architecture (`src/lib`, `src/background`, `src/ui`, `test/`) with **no behaviour change**. Every existing unit test and end-to-end check must still pass.

**Architecture:**
- Each task builds new ES modules under `src/` next to the legacy root files, and switches one entry point (worker, popup, welcome, report) to them. The extension keeps working after every task.
- The final tasks delete the legacy root files, flip the package to `"type": "module"`, and make the build ship `src/`.

**Tech Stack:**
- Chrome MV3 with a module service worker; plain ES2022 modules, no bundler.
- `node:test`; TypeScript `tsc --strict` over JSDoc (dev-only).
- Playwright plus Chromium for end-to-end tests; `zlib` for the zip.

**Spec:** `docs/superpowers/specs/2026-10-31-weekly-merge-design.md` (this plan implements §8 Phase 1).

**Deviation from the spec, deliberate:** Daybook's `storage.js` and `schema.js` are task-shaped (`tasks`, `reminderState`, `uiState`). Bringing them in before tasks exist would add dead code. Phase 1 brings in Daybook's `dates.js` and the `storage.mutate()` *pattern* through a new `src/lib/settings.js`. `storage.js` and `schema.js` arrive in Phase 2 with tasks.

## Global Constraints

- No version control: never run `git`. A task's last step is "update the checklist", not "commit". Rollback point: `snapshots/weekly-2.0.0-source-2026-10-31.zip`.
- `src/lib/` never touches the DOM. `src/ui/` never calls `chrome.storage` directly; it goes through `src/lib/settings.js`, `src/lib/activity/*` or `src/lib/report/*`.
- No `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src/`. Build DOM with `h()` from `src/ui/components/dom.js`. `test/no-innerhtml.test.js` enforces this.
- No file over 300 lines and no function over 50 lines.
- Dates are local-calendar ISO strings (`YYYY-MM-DD`). Never `new Date('YYYY-MM-DD')`. Use `src/lib/dates.js`.
- Storage keys, user-visible copy, element ids and CSS classes are unchanged in Phase 1. The end-to-end suite is the contract.
- Node ≥ 22. No runtime dependencies. Dev dependencies only: `typescript@^5.5.4`, `@types/chrome@^0.0.268` (Daybook's versions).
- Typecheck scope in Phase 1: `src/lib/**` and `src/background/**`. `src/ui/**` joins in Phase 2.
- Every task ends with `npm test` green. Tasks that switch an entry point also end with `npm run e2e` green.

## File map (end state of Phase 1)

```
manifest.json                      paths → src/…; background {service_worker, type: module}
package.json                       "type": "module"; test/test:ny/test:in/typecheck/e2e/build/zip/package scripts
jsconfig.json                      Daybook's, include src/lib + src/background
scripts/build.mjs  scripts/zip.mjs ship manifest.json + icons/ + src/ (skip package.json, *.test.js)
src/lib/dates.js                   Daybook, verbatim
src/lib/week.js                    WORK_DAYS, isWorkday, weekStart, shiftDate, dayKey, expiredKeys, fmtDuration, RETENTION_DAYS
src/lib/settings.js                DEFAULTS, getSettings, updateSettings, onSettingsChanged (storage.local)
src/lib/activity/classify.js       from classify.js
src/lib/activity/range.js          loadRange, isIgnored, hasEntries (from common.js)
src/lib/activity/history.js        estimateFromVisits, readVisits, backfillFromHistory, removeHistoryEstimates, requestHistory
src/lib/report/draft.js            from draft.js
src/lib/report/ai.js               from ai.js
src/lib/report/integrations.js     from integrations.js
src/lib/report/trends.js           computeTrends (pure, from data.js renderTrends)
src/lib/portability.js             exportPayload, parseImport, cleanEntry (from data.js)
src/background/tracker.js          refresh/commit/retract/countSwitch/addMs (from background.js)
src/background/service-worker.js   wiring: listeners, setup, purge, reminder, notifications
src/ui/components/dom.js           h(), clear(), $ / $$
src/ui/styles.css                  from styles.css
src/ui/popup/{popup.html,popup.css,popup.js}
src/ui/welcome/{welcome.html,welcome.css,welcome.js}
src/ui/report/report.html  report.css  main.js  week-view.js  categories-view.js  draft-panel.js
              ai-panel.js  share-panel.js  notes-panel.js  settings-panel.js  data-panel.js  history-panel.js
test/helpers/chrome-stub.js        Daybook's stub + idle/tabs/windows/action additions
test/dates.test.js                 Daybook, verbatim
test/week.test.js  test/settings.test.js  test/no-innerhtml.test.js
test/activity/{classify,range,history}.test.js
test/report/{draft,trends}.test.js  test/portability.test.js  test/background/tracker.test.js
test/e2e/run.mjs  test/e2e/full.mjs
```

Deleted at the end of the phase: root `background.js common.js classify.js draft.js history.js history-ui.js ai.js ai-ui.js integrations.js data.js report.js report.html report.css popup.js popup.html popup.css welcome.js welcome.html welcome.css styles.css` and `tests/`.

---

### Task 1: Tooling, Daybook dates, week helpers

**Files:**
- Create: `src/package.json`, `test/package.json` (temporary, `{"type":"module"}`; deleted in Task 12)
- Create: `jsconfig.json`, `src/lib/dates.js`, `src/lib/week.js`, `test/dates.test.js`, `test/week.test.js`, `test/helpers/chrome-stub.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `src/lib/dates.js`, with Daybook's exports unchanged: `toISODate(d?: Date): string`, `today()`, `fromISODate(iso): Date|null`, `addDays(iso: string, n): string`, `daysBetween`, `weekday(iso)`, `nextOccurrence`, `todayAt`, `parseTime`, `isValidTime`, `relativeLabel`, `shortDate`, `longDate`, `stampDate`, `dayName`, `clockTime`, `isPast`, `isToday`, `isValidISODate`, `tomorrow`.
- Produces: `src/lib/week.js`:
  - `RETENTION_DAYS = 90`, `WORK_DAYS = 5`
  - `isWorkday(d: Date|number|string): boolean`
  - `dayKey(d: Date|number): string`
  - `shiftDate(d: Date|number, n: number): Date`
  - `weekStart(off?: number, from?: Date): Date`
  - `expiredKeys(keys: string[], now?: number): string[]`
  - `fmtDuration(ms: number): string`
- Produces: `test/helpers/chrome-stub.js`, exporting `installChromeStub(): { chrome, log, stores: { local, sync, session } }` with the setters `setIdle(state)`, `setFocusedTab(tab|null)`, `setWindowFocused(bool)` on the returned object.

- [ ] **Step 1: Copy Daybook's dates module, its test and its stub verbatim**

```bash
cd /Users/sharajrewoo/DemoReposQA/weekly
mkdir -p src/lib test/helpers
cp ../Daybook/src/lib/dates.js src/lib/dates.js
cp ../Daybook/test/dates.test.js test/dates.test.js
cp ../Daybook/test/helpers/chrome-stub.js test/helpers/chrome-stub.js
cp ../Daybook/jsconfig.json jsconfig.json
printf '{ "type": "module" }\n' > src/package.json
printf '{ "type": "module" }\n' > test/package.json
```

- [ ] **Step 2: Point jsconfig at the Phase 1 typecheck scope**

Replace the `include` line in `jsconfig.json`:

```json
  "include": ["src/lib/**/*.js", "src/background/**/*.js"]
```

- [ ] **Step 3: Write the failing week helpers test**

Create `test/week.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORK_DAYS, isWorkday, dayKey, shiftDate, weekStart, expiredKeys, fmtDuration } from '../src/lib/week.js';

test('a working week is Monday to Friday', () => {
  assert.equal(WORK_DAYS, 5);
  const days = [26, 27, 28, 29, 30, 31].map((d) => isWorkday(new Date(2026, 9, d)));
  assert.deepEqual(days, [true, true, true, true, true, false]);
  assert.equal(isWorkday(new Date(2026, 10, 1)), false);
  assert.equal(isWorkday('2026-10-30'), true);
});

test('dayKey accepts dates and timestamps and uses the local calendar', () => {
  assert.equal(dayKey(new Date(2026, 9, 30, 23, 30)), '2026-10-30');
  assert.equal(dayKey(new Date(2026, 9, 30, 0, 5).getTime()), '2026-10-30');
});

test('shiftDate crosses months without UTC drift', () => {
  assert.equal(dayKey(shiftDate(new Date(2026, 9, 31), 1)), '2026-11-01');
  assert.equal(dayKey(shiftDate(new Date(2026, 2, 1), -1)), '2026-02-28');
});

test('weeks start on Monday', () => {
  assert.equal(dayKey(weekStart(0, new Date(2026, 9, 31))), '2026-10-26');
  assert.equal(dayKey(weekStart(-1, new Date(2026, 9, 26))), '2026-10-19');
});

test('purge picks every dated key older than 90 days, nothing else', () => {
  const now = new Date(2026, 9, 31).getTime();
  const keys = ['day:2026-07-01', 'day:2026-10-30', 'meta:2026-07-01', 'excluded:2026-06-29', 'draft:weekly:2026-06-29',
    'imp:abc:2026-07-01', 'imp:abc:2026-10-01', 'settings', 'notes', 'deviceId'];
  assert.deepEqual(expiredKeys(keys, now), ['day:2026-07-01', 'meta:2026-07-01', 'excluded:2026-06-29', 'draft:weekly:2026-06-29', 'imp:abc:2026-07-01']);
});

test('fmtDuration rounds to minutes', () => {
  assert.equal(fmtDuration(0), '0m');
  assert.equal(fmtDuration(59 * 60000), '59m');
  assert.equal(fmtDuration(60 * 60000), '1h');
  assert.equal(fmtDuration(125 * 60000), '2h 5m');
});
```

- [ ] **Step 4: Update package.json scripts and dev dependencies**

Replace the `scripts` and add `devDependencies` (keep `name`, `version`, `private`, `description`, `engines`):

```json
  "scripts": {
    "test": "npm run test:legacy && npm run test:ny && npm run test:in",
    "test:legacy": "node --test \"tests/*.test.js\"",
    "test:ny": "TZ=America/New_York node --test \"test/**/*.test.js\"",
    "test:in": "TZ=Asia/Kolkata node --test \"test/**/*.test.js\"",
    "typecheck": "tsc -p jsconfig.json",
    "e2e": "node test/e2e/run.mjs",
    "build": "node scripts/build.mjs",
    "zip": "npm run build && node scripts/zip.mjs",
    "package": "npm test && npm run typecheck && npm run zip"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "typescript": "^5.5.4"
  },
```

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` written. `.gitignore` already ignores `node_modules/`.

- [ ] **Step 5: Run the tests to see the week test fail**

Run: `npm run test:ny`
Expected: `dates.test.js` passes. `week.test.js` fails with `Cannot find module '…/src/lib/week.js'`.

- [ ] **Step 6: Implement `src/lib/week.js`**

```js
// Weekly's working-week helpers. Built on Daybook's local-calendar dates.js:
// a day is a local YYYY-MM-DD, never UTC.
import { toISODate } from './dates.js';

export const RETENTION_DAYS = 90;
/** A week is Monday to Friday; weekend activity is recorded but not reported. */
export const WORK_DAYS = 5;

/** @param {Date | number} d */
export const dayKey = (d) => toISODate(new Date(d));

/** @param {Date | number | string} d */
export function isWorkday(d) {
  const date = typeof d === 'string' ? new Date(`${d}T12:00:00`) : new Date(d);
  const g = date.getDay();
  return g >= 1 && g <= 5;
}

/** @param {Date | number} d @param {number} n @returns {Date} */
export function shiftDate(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday 00:00 of the week `off` weeks from `from`. @returns {Date} */
export function weekStart(off = 0, from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
  return d;
}

/** Every stored key ending in a date older than the retention cutoff. */
export function expiredKeys(/** @type {string[]} */ keys, now = Date.now()) {
  const cutoff = dayKey(now - RETENTION_DAYS * 864e5);
  return keys.filter((k) => {
    const m = k.match(/(\d{4}-\d{2}-\d{2})$/);
    return !!m && /** @type {string} */ (m[1]) < cutoff;
  });
}

/** @param {number} ms */
export function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
}
```

Note: `isWorkday('YYYY-MM-DD')` builds local noon from the string's parts (`T12:00:00` with no zone is parsed as local time), so it is safe in any timezone.

- [ ] **Step 7: Extend the Chrome stub with what Weekly's tracker needs**

In `test/helpers/chrome-stub.js`, inside `installChromeStub()`, add state before `const chrome = {`:

```js
  const state = { idle: 'active', focused: true, tab: /** @type {any} */ (null) };
```

Replace the `windows: { … }` block's closing `onRemoved` line with:

```js
      onRemoved: event('windows.onRemoved'),
      async getLastFocused() { return { id: 1, focused: state.focused }; },
      onFocusChanged: event('windows.onFocusChanged'),
```

Replace `async query() { return [{ id: 99 }]; },` in `tabs` with:

```js
      async query() { return state.tab ? [state.tab] : []; },
      onActivated: event('tabs.onActivated'),
      onUpdated: event('tabs.onUpdated'),
```

Add a new member after `action: { … },`:

```js
    idle: {
      async queryState() { return state.idle; },
      setDetectionInterval() {},
      onStateChanged: event('idle.onStateChanged'),
    },
```

Change the return line to:

```js
  return {
    chrome, log, stores: { local, sync, session },
    setIdle: (s) => { state.idle = s; },
    setFocusedTab: (t) => { state.tab = t; },
    setWindowFocused: (f) => { state.focused = f; },
  };
```

Also change `getURL` to `chrome-extension://weekly/${p}`.

- [ ] **Step 8: Run all tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: the legacy suite passes (16), and `test:ny` and `test:in` pass (`dates` plus 6 week tests). `tsc` exits 0.

- [ ] **Step 9: Update the checklist**

Tick Task 1 in this file.

---

### Task 2: End-to-end suite inside the repo (baseline on today's code)

**Files:**
- Create: `test/e2e/run.mjs`, `test/e2e/full.mjs` (from `/private/tmp/claude-502/-Users-sharajrewoo-DemoReposQA-weekly/72fd09de-3d34-46a3-9ef4-8fde9a9b0819/scratchpad/full-e2e.mjs`)

**Interfaces:**
- Produces: `npm run e2e`. It builds, copies `dist/weekly` to `.e2e/ext`, pre-grants the test permissions in the copied manifest, and runs `full.mjs`. It exits non-zero on any failed check.
- Produces: the `PAGES` map at the top of `full.mjs`: `{ report, popup, welcome }`, each a path relative to the extension root. Later tasks change only this map.

- [ ] **Step 1: Copy the harness**

```bash
mkdir -p test/e2e
cp /private/tmp/claude-502/-Users-sharajrewoo-DemoReposQA-weekly/72fd09de-3d34-46a3-9ef4-8fde9a9b0819/scratchpad/full-e2e.mjs test/e2e/full.mjs
```

- [ ] **Step 2: Make `full.mjs` path-driven**

At the top of `test/e2e/full.mjs`:

1. Replace the `createRequire` line with:

```js
const require = createRequire(process.env.PLAYWRIGHT_PATH ?? '/Users/sharajrewoo/.npm/_npx/9833c18b2d85bc59/node_modules/');
```

2. Replace `const [S, exe, headed] = process.argv.slice(2);` and the next line (`const ext = …, shots = …`) with:

```js
const [ext, exe, outDir, headed] = process.argv.slice(2);
const S = outDir, shots = outDir + '/shots';
export const PAGES = { report: 'report.html', popup: 'popup.html', welcome: 'welcome.html' };
```

3. Replace every literal page URL:
   - `` `${X}/report.html` `` → `` `${X}/${PAGES.report}` ``
   - `` `${X}/popup.html` `` → `` `${X}/${PAGES.popup}` ``
   - `p.url().endsWith('/welcome.html')` → `p.url().endsWith('/' + PAGES.welcome)`
   - `welcome.url().endsWith('/report.html')` → `welcome.url().endsWith('/' + PAGES.report)`

   Verify none remain: `grep -nE "'/?(report|popup|welcome)\.html|/(report|popup|welcome)\.html\`" test/e2e/full.mjs` returns only the `PAGES` line.

4. At the end, replace the final `console.log(...passed)` / `await ctx.close();` with:

```js
console.log(`\n${results.length - fails.length}/${results.length} passed`);
await ctx.close();
process.exit(fails.length ? 1 : 0);
```

- [ ] **Step 3: Write the runner**

Create `test/e2e/run.mjs`:

```js
// Builds the extension, copies it, pre-grants the permissions headless Chromium
// cannot click through, and runs the end-to-end suite against the copy.
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const root = new URL('../..', import.meta.url).pathname;
const work = join(root, '.e2e');
const ext = join(work, 'ext');

execFileSync('node', [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
cpSync(join(root, 'dist/weekly'), ext, { recursive: true });

const manifestPath = join(ext, 'manifest.json');
const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
m.permissions = [...new Set([...(m.permissions ?? []), 'history'])];
m.host_permissions = ['https://acme.atlassian.net/*', 'https://gitlab.com/*', 'https://hooks.slack.com/*'];
writeFileSync(manifestPath, JSON.stringify(m, null, 2));

const pwDir = join(homedir(), 'Library/Caches/ms-playwright');
const chromium = process.env.CHROMIUM_PATH ?? (() => {
  const dir = readdirSync(pwDir).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  if (!dir) throw new Error('No Playwright Chromium found; set CHROMIUM_PATH');
  const app = readdirSync(join(pwDir, dir)).find((d) => d.startsWith('chrome-mac'));
  const bundle = readdirSync(join(pwDir, dir, app)).find((d) => d.endsWith('.app'));
  const bin = join(pwDir, dir, app, bundle, 'Contents/MacOS');
  return join(bin, readdirSync(bin)[0]);
})();

execFileSync('node', [join(root, 'test/e2e/full.mjs'), ext, chromium, work], { stdio: 'inherit' });
```

Add `.e2e/` to `.gitignore` under "Build output".

- [ ] **Step 4: Run the baseline**

Run: `npm run e2e`
Expected: ends with `103/103 passed` and exit code 0. If any check fails on today's unmodified code, stop and report it. The baseline must be green before the restructure starts.

- [ ] **Step 5: Update the checklist**

---

### Task 3: `classify` as an ES module

**Files:**
- Create: `src/lib/activity/classify.js`, `test/activity/classify.test.js`

**Interfaces:**
- Produces: `classify(rawUrl: string, rawTitle: string, opts?: {rules?: string[], ticketPrefixes?: string[]}): {key, category, task, tickets: string[]}`, plus `cleanTitle(title): string`, `findTickets(text, allowed?): string[]` and `parseRules(lines): {pattern, category, label}[]`.

- [ ] **Step 1: Port the test**

Copy `tests/classify.test.js` to `test/activity/classify.test.js`. Replace its first three lines with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, findTickets, parseRules } from '../../src/lib/activity/classify.js';
```

Run: `npm run test:ny`
Expected: FAIL with "Cannot find module …/src/lib/activity/classify.js".

- [ ] **Step 2: Create the module**

```bash
mkdir -p src/lib/activity
cp classify.js src/lib/activity/classify.js
```

In `src/lib/activity/classify.js`:
- Prefix the declarations with `export`: `function cleanTitle`, `function findTickets`, `function parseRules`, `function classify`.
- Delete the last line, `if (typeof module !== 'undefined') module.exports = …`.
- Add JSDoc above `classify`:

```js
/**
 * @param {string} rawUrl
 * @param {string} rawTitle
 * @param {{ rules?: string[], ticketPrefixes?: string[] }} [opts]
 * @returns {{ key: string, category: string, task: string, tickets: string[] }}
 */
```

- [ ] **Step 3: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass. If `tsc` reports implicit-any or possibly-undefined errors inside `classify.js`, fix each with a JSDoc type or a `?? ''` / `?? []` at the access. Logic stays unchanged.

- [ ] **Step 4: Update the checklist**

---

### Task 4: `draft` as an ES module

**Files:**
- Create: `src/lib/report/draft.js`, `test/report/draft.test.js`

**Interfaces:**
- Produces: `buildWeekly({rangeLabel, items, notes?, showTime?, status?, hideNames?}): string`, `buildStandup({prevLabel, prevItems, todayItems, notes?, status?, hideNames?}): string`, `groupTickets(items, status)`, `anonymize(items)`, and the constants `KNOWN: string[]`, `WEEKDAYS: string[]`.
- An item is `{key, category, task, url, ms, days: Set<number>, tickets: Set<string>, est?: boolean}`.

- [ ] **Step 1: Port the test**

Copy `tests/draft.test.js` to `test/report/draft.test.js`. Replace its `require` lines with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekly, buildStandup } from '../../src/lib/report/draft.js';
```

Run: `npm run test:ny`. Expected: FAIL (module not found).

- [ ] **Step 2: Create the module**

```bash
mkdir -p src/lib/report && cp draft.js src/lib/report/draft.js
```

- Prefix with `export`: `const WEEKDAYS`, `const KNOWN`, `function groupTickets`, `function anonymize`, `function buildWeekly`, `function buildStandup`.
- Delete the `module.exports` line.
- Replace the local `fmtMs` definition with `import { fmtDuration as fmtMs } from '../week.js';` at the top.

- [ ] **Step 3: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`. Expected: all pass. Add JSDoc types where `tsc` asks; logic stays unchanged.

- [ ] **Step 4: Update the checklist**

---

### Task 5: Settings, activity range and history as ES modules

**Files:**
- Create: `src/lib/settings.js`, `src/lib/activity/range.js`, `src/lib/activity/history.js`
- Test: `test/settings.test.js`, `test/activity/range.test.js`, `test/activity/history.test.js`

**Interfaces:**
- Produces `src/lib/settings.js`:
  - `DEFAULTS` (object identical to `common.js`'s `DEFAULTS`)
  - `getSettings(): Promise<Settings>`
  - `updateSettings(patch): Promise<Settings>`, serialised through a promise-chain lock, like Daybook's `mutate()`
  - `onSettingsChanged(cb): () => void`
  - All of these use `chrome.storage.local` key `settings`.
- Produces `src/lib/activity/range.js`:
  - `isIgnored(url, list): boolean`
  - `hasEntries(o): boolean`
  - `loadRange(start: Date, n: number): Promise<{start, days: Date[], merged, perDay: number[], perDayCat, switches: number[], estimated: boolean[], histTried: boolean[]}>`. The behaviour is identical to `common.js`.
- Produces `src/lib/activity/history.js`:
  - `HISTORY_DAYS = 15`, `GAP_CAP`, `TAIL`
  - `estimateFromVisits(visits, settings, classifyFn)`
  - `readVisits(start, end)`
  - `requestHistory(): Promise<boolean>`
  - `backfillFromHistory(): Promise<number>`
  - `removeHistoryEstimates(): Promise<void>`

- [ ] **Step 1: Write the settings test**

`test/settings.test.js`:

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

let stub;
beforeEach(() => { stub = installChromeStub(); });

test('defaults fill in missing fields; storage is local, never sync', async () => {
  const { getSettings, DEFAULTS } = await import('../src/lib/settings.js');
  stub.stores.local.settings = { minMinutes: 5 };
  const s = await getSettings();
  assert.equal(s.minMinutes, 5);
  assert.equal(s.idleSeconds, DEFAULTS.idleSeconds);
  assert.deepEqual(stub.stores.sync, {});
});

test('concurrent updates are serialised and none is lost', async () => {
  const { updateSettings, getSettings } = await import('../src/lib/settings.js');
  await Promise.all([updateSettings({ role: 'sales' }), updateSettings({ minMinutes: 7 }), updateSettings({ paused: true })]);
  const s = await getSettings();
  assert.equal(s.role, 'sales');
  assert.equal(s.minMinutes, 7);
  assert.equal(s.paused, true);
});
```

- [ ] **Step 2: Implement `src/lib/settings.js`**

```js
// Weekly's settings. Local storage only: syncing them through the Google
// account would break the "stays on this computer" promise.
export const DEFAULTS = Object.freeze({
  idleSeconds: 120, minMinutes: 2, ignoreDomains: [], paused: false,
  rules: [], ticketPrefixes: [], reminder: false, slackWebhook: '', template: 'weekly', role: 'general', anonymize: false,
});
const KEY = 'settings';
let queue = Promise.resolve();

/** @returns {Promise<typeof DEFAULTS & Record<string, unknown>>} */
export async function getSettings() {
  const blob = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(blob[KEY] ?? {}) };
}

/** Read-modify-write behind a promise chain, so two callers never drop each other's change. */
export function updateSettings(/** @type {Record<string, unknown>} */ patch) {
  const run = queue.then(async () => {
    const next = { ...(await getSettings()), ...patch };
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
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

Run: `npm run test:ny`. Expected: the settings tests PASS.

- [ ] **Step 3: Write the range test**

`test/activity/range.test.js`:

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

let stub;
beforeEach(() => { stub = installChromeStub(); });
const e = (category, task, min) => ({ category, task, url: 'https://x.test/', ms: min * 60000, first: 1, last: 2, tickets: [] });

test('merges this device, imported devices, and history only for untracked days', async () => {
  const { loadRange } = await import('../../src/lib/activity/range.js');
  Object.assign(stub.stores.local, {
    imports: ['laptop'],
    'day:2026-10-26': { 'jira:A-1': e('Tickets', 'A-1', 30) },
    'imp:laptop:2026-10-26': { 'jira:A-1': e('Tickets', 'A-1', 15) },
    'hist:2026-10-26': { 'site:x': e('Browsing', 'x', 99) },          // ignored: live data exists
    'hist:2026-10-27': { 'site:y': e('Browsing', 'y', 20) },          // used: no live data
    'meta:2026-10-26': { switches: 4 },
  });
  const r = await loadRange(new Date(2026, 9, 26), 2);
  assert.equal(r.merged['jira:A-1'].ms, 45 * 60000);
  assert.equal(r.merged['site:x'], undefined);
  assert.equal(r.merged['site:y'].est, true);
  assert.deepEqual(r.estimated, [false, true]);
  assert.deepEqual(r.histTried, [true, true]);
  assert.deepEqual(r.switches, [4, 0]);
});

test('isIgnored matches the domain and its subdomains, and rejects bad URLs', async () => {
  const { isIgnored } = await import('../../src/lib/activity/range.js');
  assert.equal(isIgnored('https://m.youtube.com/x', ['youtube.com']), true);
  assert.equal(isIgnored('https://notyoutube.com/', ['youtube.com']), false);
  assert.equal(isIgnored('not a url', []), true);
});
```

- [ ] **Step 4: Implement `src/lib/activity/range.js`**

Copy the bodies of `isIgnored`, `hasEntries` and `loadRange` from `common.js` lines 47–86 verbatim, with these exact substitutions:
- `addDays(start, i)` → `shiftDate(start, i)`
- `dates = days.map(dayKey)` stays as it is (the `dayKey` import below).

Add the header:

```js
import { dayKey, shiftDate } from '../week.js';
```

Prefix all three with `export`.

Run: `npm run test:ny`. Expected: the range tests PASS.

- [ ] **Step 5: Port the history test and module**

Copy `tests/history.test.js` to `test/activity/history.test.js`, replacing its first five lines with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../../src/lib/activity/classify.js';
import { estimateFromVisits, GAP_CAP, TAIL } from '../../src/lib/activity/history.js';
```

Then `cp history.js src/lib/activity/history.js` and edit it:
- Add the imports:

```js
import { classify } from './classify.js';
import { isIgnored, hasEntries } from './range.js';
import { getSettings } from '../settings.js';
import { dayKey, shiftDate } from '../week.js';
```

- `export` every top-level `const` and `function`.
- `addDays(today, …)` → `shiftDate(today, …)`; `addDays(start, i)` → `shiftDate(start, i)`.
- Delete the `module.exports` line.

Run: `npm test && npm run typecheck`. Expected: all pass.

- [ ] **Step 6: Update the checklist**

---

### Task 6: Module service worker

**Files:**
- Create: `src/background/tracker.js`, `src/background/service-worker.js`, `test/background/tracker.test.js`
- Modify: `manifest.json` (`background`)

**Interfaces:**
- Consumes: `classify` (Task 3); `getSettings`/`DEFAULTS` (Task 5); `isIgnored` (Task 5); `dayKey`, `expiredKeys` and `RETENTION_DAYS` (Task 1).
- Produces `src/background/tracker.js`: `refresh(): Promise<void>`, `commit(end: number): Promise<void>`, `retract(idleStart: number): Promise<void>`, and `MAX_CHUNK`. The behaviour is identical to `background.js` lines 1–126.
- Produces `src/background/service-worker.js`: the listener wiring, `setup()`, `purgeOld()`, `scheduleReminder()` and the notification click handler, identical to `background.js` lines 128–189.

- [ ] **Step 1: Write the tracker test**

This ports the scratchpad `bg-harness.js` and `retract-check.js` scenarios into `test/background/tracker.test.js`:

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

let stub, T, now;
const realNow = Date.now;
const JIRA = { id: 1, url: 'https://acme.atlassian.net/browse/ENGX-1', title: '[ENGX-1] Fix login - Jira', active: true };
const DEAL = { id: 2, url: 'https://app.hubspot.com/contacts/1/record/0-3/7', title: 'Acme deal | HubSpot', active: true };
const min = (k, day = '2026-10-30') => (stub.stores.local['day:' + day]?.[k]?.ms ?? 0) / 60000;
const tick = async (m = 1) => { now += m * 60000; await T.refresh(); };

beforeEach(async () => {
  stub = installChromeStub();
  now = new Date(2026, 9, 30, 10, 0).getTime();
  Date.now = () => now;
  T = await import(`../../src/background/tracker.js?${Math.random()}`);   // fresh module state per test
  stub.setFocusedTab(JIRA);
  await T.refresh();
});
test.after(() => { Date.now = realNow; });

test('counts active minutes on the focused tab', async () => {
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(min('jira:ENGX-1'), 5);
});

test('takes back time credited after the last input when idle is detected', async () => {
  for (let i = 0; i < 5; i++) await tick();
  await tick(); await tick();
  assert.equal(min('jira:ENGX-1'), 7);
  stub.setIdle('idle'); await T.refresh();
  assert.equal(min('jira:ENGX-1'), 5);
  await tick(); await tick();
  assert.equal(min('jira:ENGX-1'), 5);
});

test('counts a switch when the task changes', async () => {
  await tick();
  stub.setFocusedTab(DEAL); await tick(); await tick();
  assert.equal(min('app:app.hubspot.com/contacts/1/record/0-3/7'), 1);
  assert.equal(stub.stores.local['meta:2026-10-30'].switches, 1);
});

test('ignored domains never become the current session', async () => {
  stub.stores.local.settings = { ignoreDomains: ['youtube.com'] };
  stub.setFocusedTab({ id: 3, url: 'https://www.youtube.com/watch?v=1', title: 'x', active: true });
  await tick();
  assert.equal(stub.stores.session.current, null);
});

test('no phantom entry when the day is deleted before idle is detected', async () => {
  for (let i = 0; i < 3; i++) await tick();
  delete stub.stores.local['day:2026-10-30'];
  stub.setIdle('idle'); await T.refresh();
  const day = stub.stores.local['day:2026-10-30'];
  assert.ok(!day || Object.keys(day).length === 0);
});
```

Run: `npm run test:ny`. Expected: FAIL (module not found).

- [ ] **Step 2: Create `src/background/tracker.js`**

Copy `background.js` lines 1–126 (from `MAX_CHUNK` through the end of `refresh()`), excluding `importScripts`, the `serial`/badge block and `purgeOld`. Add the header:

```js
import { classify } from '../lib/activity/classify.js';
import { isIgnored } from '../lib/activity/range.js';
import { getSettings } from '../lib/settings.js';
import { dayKey } from '../lib/week.js';
```

`export` `MAX_CHUNK`, `refresh`, `commit` and `retract`. Keep `getCurrent`/`setCurrent`/`addMs`/`countSwitch` module-private. The code inside is unchanged.

Run: `npm run test:ny`. Expected: the 5 tracker tests PASS.

- [ ] **Step 3: Create `src/background/service-worker.js`**

```js
import { refresh } from './tracker.js';
import { getSettings, DEFAULTS } from '../lib/settings.js';
import { expiredKeys, RETENTION_DAYS } from '../lib/week.js';
```

Then copy, verbatim from `background.js`:
- the `serial` queue and `errored` badge block (lines 21–31);
- `purgeOld`, `nextFriday`, `scheduleReminder`, `setup` and `openReport`;
- every `chrome.*.addListener` registration down to the end of the file.

Change `openReport` to use `chrome.runtime.getURL('report.html')` for now (Task 11 moves the report). Change the welcome URL in `onInstalled` to `'welcome.html'` for now (Task 10 moves it).

- [ ] **Step 4: Switch the manifest to the module worker**

In `manifest.json` replace `"background": { "service_worker": "background.js" }` with:

```json
  "background": { "service_worker": "src/background/service-worker.js", "type": "module" },
```

The build script still copies root files only. Update `scripts/build.mjs` now so `src/` ships:

- After the line `cpSync(join(root, 'icons'), …)`, add:

```js
cpSync(join(root, 'src'), join(out, 'src'), { recursive: true, filter: (p) => !p.endsWith('.DS_Store') && !p.endsWith('package.json') });
```

- Replace the `importScripts` reference check with an ES-import walk:

```js
// Walk static imports from the worker and every <script type="module">, so a missing module fails the build.
const seen = new Set();
const walk = (file) => {
  if (seen.has(file)) return;
  seen.add(file);
  refs.push(file);
  const src = readFileSync(join(root, file), 'utf8');
  for (const [, spec] of src.matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) {
    walk(join(file, '..', spec).replace(/^\.\//, ''));
  }
};
walk(manifest.background.service_worker);
```

- Make HTML `src`/`href` references resolve relative to the HTML file's own folder: `refs.push(join(dirname(f), ref))`, importing `dirname` from `node:path`. Call `walk(...)` for each `type="module"` script found.

Run: `npm test && npm run typecheck && npm run e2e`
Expected: unit tests pass; `tsc` is clean; e2e shows `103/103 passed`. The e2e Install checks prove the module worker starts and seeds `deviceId` and the alarm.

- [ ] **Step 5: Delete the legacy worker and update the checklist**

```bash
rm background.js
```

Run: `npm run build`. Expected: "Built Weekly…" with no missing references.

---

### Task 7: DOM builder and the no-innerHTML rule

**Files:**
- Create: `src/ui/components/dom.js`, `test/no-innerhtml.test.js`

**Interfaces:**
- Produces: `h(tag: string, props?: Record<string, unknown>, ...children: (Node|string|null|false|undefined|Array)[]): HTMLElement`.
  - `props` keys: `class`, `dataset` (object), `style` (object), `on` (`{event: fn}`), `attrs` (object for `aria-*`/`role`/`for`/`title`), and any other key, which is set as a DOM property (`checked`, `disabled`, `href`, `textContent`, `type`, `value`, `id`, `hidden`).
  - String children become text nodes.
- Produces: `clear(el): void` (removes all children), `$(sel, root?)` and `$$(sel, root?)`.

- [ ] **Step 1: Write the static rule test**

`test/no-innerhtml.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const files = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
});

test('no HTML-string sinks anywhere in src/', () => {
  const offenders = files(root).filter((f) => /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});
```

Run: `npm run test:ny`. Expected: PASS (nothing in `src/` uses them yet). The test guards the UI tasks that follow.

- [ ] **Step 2: Implement `src/ui/components/dom.js`**

```js
// One way to build DOM in Weekly: text is always text. User input and imported
// files never become markup.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'attrs') for (const [a, val] of Object.entries(v)) el.setAttribute(a, String(val));
    else el[k] = v;
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}
```

- [ ] **Step 3: Update the checklist**

---

### Task 8: Popup as an ES-module page

**Files:**
- Create: `src/ui/styles.css` (copied from `styles.css`), `src/ui/popup/popup.html`, `src/ui/popup/popup.css`, `src/ui/popup/popup.js`
- Modify: `manifest.json` (`action.default_popup`), `test/e2e/full.mjs` (`PAGES.popup`)
- Delete: `popup.html`, `popup.css`, `popup.js`

**Interfaces:**
- Consumes: `h`, `clear`, `$` (Task 7); `getSettings`, `updateSettings` (Task 5); `dayKey`, `fmtDuration` (Task 1).

- [ ] **Step 1: Point the e2e test at the new location (red)**

In `test/e2e/full.mjs` set `PAGES.popup = 'src/ui/popup/popup.html'`.

Run: `npm run e2e`. Expected: the Popup checks FAIL (page not found).

- [ ] **Step 2: Create the popup files**

```bash
mkdir -p src/ui/popup && cp styles.css src/ui/styles.css && cp popup.css src/ui/popup/popup.css && cp popup.html src/ui/popup/popup.html
```

In `src/ui/popup/popup.html`:
- Stylesheet hrefs become `../styles.css` and `popup.css`.
- Replace both `<script>` tags with `<script type="module" src="popup.js"></script>`.

Create `src/ui/popup/popup.js` from `popup.js` with these changes:
- Imports:

```js
import { $, h, clear } from '../components/dom.js';
import { getSettings, updateSettings } from '../../lib/settings.js';
import { dayKey, fmtDuration as fmt } from '../../lib/week.js';
```

- Replace the `$('#top').innerHTML = …` statement with:

```js
  clear($('#top'));
  $('#top').append(...items.filter((e) => e.category !== 'Browsing').slice(0, 5)
    .map((e) => h('li', {}, e.task, h('span', {}, fmt(e.ms)))));
```

- Pause handler: `await updateSettings({ paused: !(await getSettings()).paused }); render();` (drop the `setTimeout`).
- `$('#open').onclick` URL becomes `'report.html'` for now (Task 11 updates it).
- The `notes` read/write stays on `chrome.storage.local` directly *for Phase 1 only*. Notes move into `lib/notes.js` in Phase 4. Mark it with: `// ponytail: direct storage access until lib/notes.js lands in Phase 4`.

In `manifest.json` set `"default_popup": "src/ui/popup/popup.html"`. Then `rm popup.html popup.css popup.js`.

- [ ] **Step 3: Run everything**

Run: `npm test && npm run e2e`. Expected: unit tests green and `103/103 passed`, including all Popup checks and the no-innerHTML test.

- [ ] **Step 4: Update the checklist**

---

### Task 9: Report library modules (ai, integrations, trends, portability)

**Files:**
- Create: `src/lib/report/ai.js`, `src/lib/report/integrations.js`, `src/lib/report/trends.js`, `src/lib/portability.js`
- Test: `test/report/trends.test.js`, `test/portability.test.js`

**Interfaces:**
- Produces `ai.js`: `AI_LANG`, `aiAvailability(): Promise<string>`, `aiSystemPrompt(role, template): string`, `aiRewrite(draft, {role, template, onText, onProgress, signal}): Promise<string>`. Copied from `ai.js` with `export` added.
- Produces `integrations.js`: `statusTargets(items)`, `missingOrigins(items)`, `requestOrigins(origins)`, `fetchStatuses(items)`, `validSlackWebhook(url)`, `toSlack(md)`, `postToSlack(webhook, md)`. Copied from `integrations.js` with `export` added.
- Produces `trends.js`: `NON_FOCUS`, `computeTrends(range, weeks): {label, total, focus, meet, switches}[]`. This is the pure arithmetic of `renderTrends`; the DOM part moves to the UI in Task 11.
- Produces `portability.js`:
  - `MAX_IMPORT_BYTES`
  - `cleanEntry(e)`
  - `exportPayload(all: Record<string, unknown>): object`, the filter from `exportAll`
  - `parseImport(text: string, ownDeviceId: string, existingNotes: object[]): {writes: Record<string, object>, deviceId: string, days: number, newNotes: object[]}`, which throws `Error` with the existing user-facing messages
  - `applyImport(file: File): Promise<{days, notes}>`, which reads, parses and writes

- [ ] **Step 1: Write the trends and portability tests**

`test/report/trends.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrends } from '../../src/lib/report/trends.js';

test('sums Mon–Fri only, splits focus from meetings, averages switches over active days', () => {
  const day = (ms, cats, sw) => ({ ms, cats, sw });
  const week = [day(3600e3, { Tickets: 3000e3, Meetings: 600e3 }, 4), day(0, {}, 0), day(1800e3, { Browsing: 1800e3 }, 2),
    day(0, {}, 0), day(0, {}, 0), day(7200e3, { Tickets: 7200e3 }, 9), day(0, {}, 0)];   // Sat has time: must be ignored
  const range = { start: new Date(2026, 9, 26), perDay: week.map((d) => d.ms), perDayCat: week.map((d) => d.cats), switches: week.map((d) => d.sw) };
  const [row] = computeTrends(range, 1);
  assert.equal(row.total, 5400e3);
  assert.equal(row.meet, 600e3);
  assert.equal(row.focus, 3000e3);
  assert.equal(row.switches, 3);
  assert.equal(row.label, '10-26');
});
```

`test/portability.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImport, cleanEntry, exportPayload } from '../src/lib/portability.js';

const file = (o) => JSON.stringify(o);

test('export keeps activity, notes and device id, never settings', () => {
  const out = exportPayload({ 'day:2026-10-30': {}, 'meta:2026-10-30': {}, notes: [], deviceId: 'd1', settings: { slackWebhook: 'secret' } });
  assert.deepEqual(Object.keys(out).sort(), ['day:2026-10-30', 'deviceId', 'meta:2026-10-30', 'notes']);
});

test('import stores days under imp:<device>:<date>, drops bad entries and javascript: URLs', () => {
  const r = parseImport(file({ deviceId: 'laptop-2', 'day:2026-10-30': {
    good: { category: 'Tickets', task: 'A', url: 'https://x.test', ms: 60000 },
    evil: { category: '<b>', task: '<script>', url: 'javascript:alert(1)', ms: 1 },
    bad: { ms: -5 } } }), 'this-device', []);
  assert.deepEqual(Object.keys(r.writes), ['imp:laptop-2:2026-10-30']);
  const day = r.writes['imp:laptop-2:2026-10-30'];
  assert.equal(day.evil.url, '');
  assert.equal(day.bad, undefined);
  assert.equal(r.days, 1);
});

test('import refuses this browser’s own export and malformed files', () => {
  assert.throws(() => parseImport(file({ deviceId: 'me' }), 'me', []), /came from this browser/);
  assert.throws(() => parseImport('{nope', 'me', []), /Not a valid export file/);
  assert.throws(() => parseImport(file({}), 'me', []), /no device ID/);
});

test('cleanEntry caps ms at a day and strings at 500 chars', () => {
  const e = cleanEntry({ category: 'x'.repeat(900), task: 't', url: 'https://a', ms: 9e9 });
  assert.equal(e.ms, 864e5);
  assert.equal(e.category.length, 500);
});
```

Run: `npm run test:ny`. Expected: FAIL (modules not found).

- [ ] **Step 2: Create the four modules**

- `ai.js` and `integrations.js`: `cp` each from the root into `src/lib/report/`, then `export` every top-level `const`/`function`.
- `trends.js`:

```js
import { dayKey, shiftDate, WORK_DAYS } from '../week.js';
export const NON_FOCUS = ['Meetings', 'Communication', 'Browsing', 'AI assistants'];

/** Pure weekly roll-up of a loadRange(start, weeks*7) result; Mon–Fri only. */
export function computeTrends(range, weeks) {
  return [...Array(weeks)].map((_, w) => {
    let total = 0, meet = 0, focus = 0, sw = 0, active = 0;
    for (let i = w * 7; i < w * 7 + WORK_DAYS; i++) {
      const cats = range.perDayCat[i] ?? {};
      const ms = range.perDay[i] ?? 0;
      total += ms;
      meet += cats.Meetings || 0;
      focus += ms - NON_FOCUS.reduce((s, c) => s + (cats[c] || 0), 0);
      if (ms) { active++; sw += range.switches[i] ?? 0; }
    }
    return { label: dayKey(shiftDate(range.start, w * 7)).slice(5), total, focus, meet, switches: active ? Math.round(sw / active) : 0 };
  });
}
```

- `portability.js`:
  - Copy `cleanEntry` and `MAX_IMPORT_BYTES` from `data.js`.
  - `exportPayload(all)` returns `Object.fromEntries(Object.entries(all).filter(([k]) => /^(day|meta):/.test(k) || k === 'notes' || k === 'deviceId'))`.
  - `parseImport(text, ownDeviceId, existingNotes)` is the body of `importFile` from `JSON.parse` through building `writes`/`newNotes`, with the `chrome.storage` reads replaced by the parameters. Keep the existing error messages verbatim.
  - `applyImport(file)` does the size check, `file.text()`, reads `deviceId`/`imports`/`notes`, calls `parseImport`, then performs the existing single `chrome.storage.local.set(...)`.

Run: `npm test && npm run typecheck`. Expected: all pass.

- [ ] **Step 3: Update the checklist**

---

### Task 10: Welcome page as an ES-module page

**Files:**
- Create: `src/ui/welcome/welcome.html`, `src/ui/welcome/welcome.css`, `src/ui/welcome/welcome.js`
- Modify: `src/background/service-worker.js` (welcome URL), `test/e2e/full.mjs` (`PAGES.welcome`)
- Delete: `welcome.html`, `welcome.css`, `welcome.js`

- [ ] **Step 1: Point the e2e test at the new location (red)**

Set `PAGES.welcome = 'src/ui/welcome/welcome.html'`. Run `npm run e2e`. Expected: the Welcome checks FAIL.

- [ ] **Step 2: Move the page**

`cp` the three files into `src/ui/welcome/`. In the HTML, the CSS hrefs become `../styles.css` and `welcome.css`, and the four scripts become one `<script type="module" src="welcome.js"></script>`. In `welcome.js`:
- Imports:

```js
import { $ } from '../components/dom.js';
import { getSettings, updateSettings } from '../../lib/settings.js';
import { requestHistory, backfillFromHistory } from '../../lib/activity/history.js';
```

- Delete the local `$` and `save()`, replacing `save(patch)` calls with `updateSettings(patch)`.
- The `#done` handler's URL becomes `'report.html'` for now.

In `service-worker.js`, the `onInstalled` URL becomes `chrome.runtime.getURL('src/ui/welcome/welcome.html')`. Then remove the three root files.

- [ ] **Step 3: Run everything**

Run: `npm test && npm run e2e`. Expected: green and `103/103 passed`.

- [ ] **Step 4: Update the checklist**

---

### Task 11: Report page as ES modules without innerHTML

**Files:**
- Create in `src/ui/report/`:
  - `report.html`, `report.css` (copied from the root)
  - `main.js`: state, `load()`, `render()` orchestration, storage listener
  - `week-view.js`: `renderSummary(W)`, `renderDays(W)`
  - `categories-view.js`: `renderCategories(W, statuses, onToggle)`
  - `draft-panel.js`: `generateDraft`, `showDraft`, `refreshDraft`, `saveDraft`, `setEdited`, template and anonymize handlers
  - `ai-panel.js`: from `ai-ui.js`
  - `share-panel.js`: copy, copy-prompt, Slack, `okToShare`
  - `notes-panel.js`: add, delete, render notes
  - `settings-panel.js`: `fillSettings`, save, `openSettings`
  - `data-panel.js`: export, import, clear, trends table via `computeTrends`
  - `history-panel.js`: from `history-ui.js`, plus the banner render
- Modify: `test/e2e/full.mjs` (`PAGES.report`); the `openReport` URL in `service-worker.js`; the `#open` URL in `popup.js`; the `#done` URL in `welcome.js`. All become `src/ui/report/report.html`.
- Delete: `report.html`, `report.css`, `report.js`, `ai.js`, `ai-ui.js`, `integrations.js`, `data.js`, `history.js`, `history-ui.js`, `draft.js`, `classify.js`, `common.js`, `styles.css`

**Interfaces:**
- `main.js` owns `const W` (the loaded week, same shape as today), `statuses`, `weekOffset` and `pendingOrigins`. It exports `getW()`, `load(fetchStatus?: boolean)`, `render()` and `msg(sel, text)` for the panels.
- Each panel module exports `init()`, which wires its event handlers, and imports what it needs from `main.js`.
- Every former `.innerHTML = template` becomes `clear(el)` plus `el.append(...h(...))`, building the same elements, classes, ids, `data-*` attributes and text. The e2e suite asserts them.

- [ ] **Step 1: Point the e2e test at the new location (red)**

Set `PAGES.report = 'src/ui/report/report.html'`. Run `npm run e2e`. Expected: Report, Draft, Weeks, Notes, Settings, Slack, AI, Trends, Data, Security, Layout and History checks FAIL.

- [ ] **Step 2: Move the HTML and CSS**

`cp report.html report.css src/ui/report/`. In `report.html`:
- The hrefs become `../styles.css` and `report.css`.
- All eleven `<script>` tags become one `<script type="module" src="main.js"></script>`.

- [ ] **Step 3: Rebuild the four HTML-string renderers with `h()`**

These are the only `innerHTML` sites in `report.js`. Translate each one element for element.

`week-view.js`, `renderDays(W)` (was `$('#days').innerHTML = …`):

```js
import { h, clear, $ } from '../components/dom.js';
import { dayKey, fmtDuration as fmt } from '../../lib/week.js';
import { WEEKDAYS } from '../../lib/report/draft.js';

export function renderDays(W) {
  const max = Math.max(...W.perDay, 3600000);
  const todayKey = dayKey(new Date());
  clear($('#days'));
  $('#days').append(...W.days.map((d, i) => h('div', {
    class: ['day', dayKey(d) === todayKey && 'today', W.estimated[i] && 'est'].filter(Boolean).join(' '),
    attrs: W.estimated[i] ? { title: 'Estimated from Chrome history' } : {},
  },
    h('div', { class: 'name' }, `${WEEKDAYS[i]} ${d.getDate()}`),
    h('div', { class: 'hrs' }, W.perDay[i] ? (W.estimated[i] ? '~' : '') + fmt(W.perDay[i]) : '–'),
    h('div', { class: 'stroke', style: { width: `${Math.max(W.perDay[i] ? 6 : 0, (W.perDay[i] / max) * 100)}%` } }))));
}
```

`categories-view.js`:
- `renderCategories(W, statuses)` replaces the empty-state template with `h('div', { class: 'empty' }, 'Nothing recorded for this week yet. Keep Chrome open while you work and activity will show up here within a minute.')`.
- The category template becomes this `h()` tree:
  - `section.cat`, containing `div.cat-head` (`h3` with the category name, `span` with the total) followed by one `div.item` per item (class `item` plus `off` when unticked). Each item holds:
    - `input[type=checkbox]` with `dataset: { key }`, `checked: !off` and `attrs: { 'aria-label': 'Include in update' }`;
    - `span.task`, containing an `a` (`href: e.url`, `target: '_blank'`, `rel: 'noopener'`, text `e.task`) when `e.url` is set, or the text otherwise, then the status chip `span.chip.status`, then the ticket chips `span.chip`;
    - `span.meta`, containing `(e.est ? '~' : '') + fmt(e.ms)`, then `span.dots`, which has `attrs: { 'aria-label': 'Days active' }` and one `i` per weekday with class `on` when active.

`notes-panel.js`, the `#notes` list:

```js
h('li', {}, h('span', {}, h('small', {}, WEEKDAYS[(new Date(n.ts).getDay() + 6) % 7]), n.text),
  h('button', { class: 'quiet', dataset: { del: String(n.id) }, attrs: { 'aria-label': 'Delete note' } }, '✕'))
```

`data-panel.js`, the trends table: build `p.hint` (with its two `i.key` swatches), then `table.trends` with a `thead` row (`Week of`, `Time`, empty, `Switches/day`) and one `tbody` row per `computeTrends(range, 8)` entry. The bars cell is `td.bars` containing `i.focus` and `i.meet`, with `style: { width: pct + '%' }`.

- [ ] **Step 4: Move the remaining logic into the panel modules**

Move each function from `report.js`, `ai-ui.js` and `history-ui.js` into the module named in the file list, body unchanged except:
- calls to the now-imported library functions;
- `fmt`/`dayKey`/`addDays(Date)` replaced by `fmtDuration`/`dayKey`/`shiftDate`;
- settings writes go through `updateSettings`;
- `export` added.

`main.js` ends with:

```js
import * as categories from './categories-view.js';
import * as draft from './draft-panel.js';
import * as aiPanel from './ai-panel.js';
import * as share from './share-panel.js';
import * as notes from './notes-panel.js';
import * as settings from './settings-panel.js';
import * as data from './data-panel.js';
import * as history from './history-panel.js';
[categories, draft, aiPanel, share, notes, settings, data, history].forEach((m) => m.init());
load();
```

Each file stays under 300 lines. Check: `wc -l src/ui/report/*.js`.

- [ ] **Step 5: Update the three report URLs and delete the legacy root files**

Set `src/ui/report/report.html` in `openReport` (`service-worker.js`), `#open` (`popup.js`) and `#done` (`welcome.js`). Then:

```bash
rm report.html report.css report.js ai.js ai-ui.js integrations.js data.js history.js history-ui.js draft.js classify.js common.js styles.css
```

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run e2e`
Expected: the legacy suite now finds its required files missing. That is expected, and Task 12 removes it. `test:ny`/`test:in` are green, including no-innerHTML; `tsc` is clean; e2e shows `103/103 passed`.

To keep this task's gate meaningful, run `npm run test:ny && npm run test:in && npm run typecheck && npm run e2e` instead of `npm test`.

- [ ] **Step 7: Update the checklist**

---

### Task 12: Retire the legacy tests and flip the package to ES modules

**Files:**
- Delete: `tests/`, `src/package.json`, `test/package.json`
- Modify: `package.json`, `scripts/zip.mjs` (no change expected; verify), `README.md` (Development section)

- [ ] **Step 1: Confirm every legacy test has a ported twin**

| Legacy | Ported to |
|---|---|
| `tests/classify.test.js` | `test/activity/classify.test.js` |
| `tests/draft.test.js` | `test/report/draft.test.js` |
| `tests/history.test.js` | `test/activity/history.test.js` |
| `tests/common.test.js` | `test/week.test.js` |

Run: `grep -c "^test(" tests/*.test.js test/activity/classify.test.js test/report/draft.test.js test/activity/history.test.js test/week.test.js`
Expected: each ported file has at least as many `test(` calls as its legacy twin.

- [ ] **Step 2: Flip the package**

```bash
rm -r tests src/package.json test/package.json
```

In `package.json`:
- Add `"type": "module",` after `"private": true,`.
- Set `"test": "npm run test:ny && npm run test:in"` and delete `test:legacy`.
- `scripts/build.mjs` and `scripts/zip.mjs` are already `.mjs`, so no change is needed. Confirm with `npm run build`.

- [ ] **Step 3: Update the README Development section**

Replace the table rows for `npm test`, `npm run build` and `npm run zip`, and add rows for `npm run typecheck` and `npm run e2e`:

```markdown
| `npm test` | Unit tests, run twice: New York (DST) and Kolkata time |
| `npm run typecheck` | `tsc --strict` over `src/lib` and `src/background` (JSDoc types) |
| `npm run e2e` | Builds, loads the extension in Chromium, runs the end-to-end suite |
| `npm run build` | Copies `manifest.json`, `icons/` and `src/` into `dist/weekly/`, checks every file and module import resolves |
```

Add a "Layout" section, copied from Daybook's README layout block, with Weekly's paths and the two rules: `lib/` never touches the DOM; `ui/` never touches `chrome.storage` directly, except the documented Phase 1 exception in `popup.js` and the notes panel.

- [ ] **Step 4: Run the phase gate**

Run: `npm run package && npm run e2e`
Expected:
- `npm test`: every suite passes in both timezones.
- `typecheck`: clean.
- Zip: `Packed … → dist/weekly-2.0.0.zip` (the version bump to 3.0.0 belongs to Phase 6).
- e2e: `103/103 passed`.

Also confirm with `ls` that no legacy `.js`, `.html` or `.css` files remain at the repo root:

```bash
ls *.js *.html *.css 2>/dev/null | wc -l   # expect 0
```

- [ ] **Step 5: Update the checklist and report**

Report to the user:
- the test counts;
- the e2e result;
- the file-size check, `find src -name '*.js' | xargs wc -l | sort -n | tail -5`, where every file must be ≤ 300 lines;
- the two documented direct-storage exceptions carried to Phase 4.

---

## Self-review (done at authoring time)

- **Spec coverage, Phase 1 row:**
  - `src/` + ES modules + module service worker: Tasks 3–11.
  - Daybook `dates`: Task 1. The storage lock pattern: Task 5 (`settings.js`). Full `storage`/`schema`: Phase 2, a documented deviation.
  - `innerHTML` replaced: Tasks 7, 8 and 11, enforced by test.
  - "No new features": no task adds behaviour.
  - Existing tests ported: Tasks 3–5 and 12. End-to-end suite unchanged: Task 2, plus a gate in Tasks 6, 8, 10 and 11.
  - Typecheck: Task 1 sets it up, and Tasks 3–9 gate on it.
- **Placeholder scan:** none found. Mechanical moves name exact source line ranges and exact substitutions. All new code is shown.
- **Type consistency:**
  - `dayKey`, `shiftDate`, `fmtDuration`, `weekStart`, `WORK_DAYS`, `isWorkday` and `expiredKeys` come from `src/lib/week.js` in every task.
  - `getSettings`, `updateSettings` and `DEFAULTS` come from `src/lib/settings.js`.
  - `loadRange`, `isIgnored` and `hasEntries` come from `src/lib/activity/range.js`.
  - `classify` comes from `src/lib/activity/classify.js`.
  - `computeTrends` comes from `src/lib/report/trends.js`.
  - `parseImport` and `applyImport` come from `src/lib/portability.js`.
