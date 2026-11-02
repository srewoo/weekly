# Weekly 3.0, Phase 6: Release 3.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Pre-flight (controller):** this plan was written and replayed against the Phase 5 plan's end state (`docs/superpowers/plans/2026-10-31-weekly-3-phase-5-stats-data.md`, all nine tasks applied on the Phase 4 plan's end state: 318 unit tests per timezone, `268/268 passed`, `No tabs: 9/9 passed`, `Packed 90 files`), with `store-assets/` copied from the real repo as it stood on 1 November 2026. **The real post-Phase-5 tree may differ from that replay base, and the controller must reconcile it before dispatching Task 1.** Known differences: the real tree carries the fix waves of Phases 2b, 3, 4 and 5 that plan replays do not (Phase 3: the stale-alarm check, `migrateFridayFlag`, `SNOOZE_MINUTES`, the snooze cleared with the evening slot; Phase 4: `src/background/sender.js`, the `isOurs`/`isOwnPage` gate, the KEEP-list comment in `reminders.js`, `CIPHER_MAX` 200000; Phase 5 may add more). In practice:
> - Check every ``In `<file>`, replace:`` block below against the real files: each old block must match exactly once. The blocks were chosen on lines the fix waves did not touch (for example `forgetWindowIfClosed` in `reminders.js`, the `Dismiss closes the window…` line in `test/e2e/reminders.mjs`, the one hint line in `pin-dialog.js`), but Phase 5's own fix wave may have moved some. Reconcile drift in the ledger.
> - Re-derive every expected count from the real baseline (`npm test`, `npm run e2e`): each task states its delta.
> - Task 2's README lines describe the real tree's Phase 3 fixes (a check missed during sleep is dropped on a later day; a Weekly 2 upgrade keeps reminders off unless the Friday reminder was on). Confirm both exist with `grep -n "stale\|migrateFridayFlag" src/background/service-worker.js` before Task 2; the replay base lacks them, so the replay only checks that the README edit applies.
> - Task 8's proof list names unit tests and end-to-end checks as the plans wrote them. A fix wave that renamed a check makes `npm run parity` print `not proved: …` for it: update the name in `test/parity-proofs.mjs` to the real one; never drop a proof to make the gate pass.
> - Files this plan edits that earlier phases also wrote: `manifest.json`, `package.json`, `package-lock.json` (through `npm version`), `README.md`, `src/background/reminders.js`, `src/lib/stats.js`, `src/ui/components/pin-dialog.js`, `src/ui/report/report.html`, `test/helpers/chrome-stub.js`, `test/{manifest,stats}.test.js`, `test/background/reminders.test.js`, `test/e2e/{run,reminders}.mjs`, and everything in `store-assets/`.

**Goal:** Ship Weekly 3.0.0: the version in the manifest and the zip name, the items parked for the release fixed with tests, a privacy policy and store listing for the merged product (tasks, calendar, reminders, notes with PIN privacy, the weekly update, stats), new store screenshots of the real 3.0 pages, a parity gate that proves every checklist row, and a final gate run on the zip that goes to the store. Nothing is uploaded or published: the owner submits by hand.

**Architecture:**
- The version lives in `package.json` (the build stamps it into the built manifest) and in `manifest.json`; a unit test fails while the two differ. `test/e2e/run.mjs --zip` (`npm run e2e:zip`) runs both end-to-end suites on `dist/weekly-3.0.0.zip`, unzipped, instead of on a fresh build.
- Parked fixes are small and local: closing the reminder window clears its notifications (`forgetWindowIfClosed`), the unlock dialog and Settings say what the worker really does (lock after 5 idle minutes or sooner; keep exports private, use a longer PIN), and the Stats heatmap stops printing two month names on top of each other.
- Store text is checked by `test/store-assets.test.js`: the policy's version and contents, one permission justification per manifest permission, the short description equal to the manifest's, the screenshot files equal to the ones the listing names and sized for the store, and the screenshots' demo data valid for Weekly's own `coerceTask`/`coerceNote`.
- `store-assets/generate.mjs` drives the real built extension with a fixed clock (the most recent Friday, 16:20) and fictional data from `store-assets/demo-data.mjs`; the private note is sealed by the worker's own `crypto:*` messages; dark shots set `settings.theme = 'dark'`.
- `scripts/parity.mjs` (`npm run parity`) walks the parity checklist and the proofs in `test/parity-proofs.mjs`: a unit proof must exist in its file, an end-to-end proof must have passed in the last run. `npm run release:check` is `package`, then `e2e:zip`, then `parity`.

**Tech Stack:**
- Chrome MV3; plain ES2022 modules, no bundler; `node:test` in two timezones; `tsc --strict` over JSDoc; Playwright + Chromium end-to-end (Playwright's `BrowserContext.clock` for the screenshots); `ffmpeg` and macOS `unzip` on the owner's machine.

**Spec:**
- `docs/superpowers/specs/2026-10-31-weekly-merge-design.md`: §3.6 (permissions), §4 (data, retention), §7 (build: `npm run package` → `dist/weekly-3.0.0.zip`, plus an end-to-end run on the unzipped build), §8 row 6 (Release: version 3.0.0, store screenshots, permission justifications, privacy policy; exit gate `npm run package`, then end-to-end on the built zip) and "Retiring Daybook and ForgetMeNot". This file wins on how.
- `docs/superpowers/specs/2026-10-31-weekly-feature-parity.md`: Phase 6 row, and the Definition of done ("every row is ✅, verified by a unit test or an end-to-end check named in the phase's plan"), which Task 8 turns into a gate. This file wins on scope.
- Phase 5 plan, "Interfaces exported for Phase 6": the `npm version 3.0.0 --no-git-tag-version` bump, end-to-end on the unzipped zip, the install and optional permissions to justify, the listing's "tracking is off until you say yes" and Chrome's "Read your browsing history", the three stale places in the privacy policy, and `generate.mjs` opening a `popup.html` that no longer exists.
- Ledgers: Phase 3 m2 (the reminder notification is never cleared on dismiss) and the README notes on the Weekly 2 upgrade and on a check missed during sleep, both parked to Phase 6; Phase 2b's store-assets popup references (privacy policy line 69, `generate.mjs` line 167), parked to the release. The Phase 4 final review parked two wording items to this phase: no copy may promise 5 unlocked minutes (Chrome stops an idle worker after about 30 seconds), and export copy must say to keep files private and recommend a longer PIN.

## Global Constraints

- **No version control.**
  - Never run `git`. No step commits; the controller keeps the ledger.
  - Never edit this plan file.
  - Rollback point: `snapshots/weekly-2.0.0-source-2026-10-31.zip`.
- **No outward actions.** Nothing in this plan uploads, publishes, unpublishes, submits or emails anything, and no step signs in to the Chrome Web Store dashboard. The owner does the store submission and the Daybook and ForgetMeNot farewell by hand (the checklist at the end).
- **Copy:** plain and specific. Say what the product does, in the user's words, with real numbers (9:00, 18:00, 4 to 8 digits, 90 days). No hype, no superlatives, no "seamless", "effortless", "powerful", "supercharge", "unlock". No em dashes in store copy. Every claim must be true of the code; `test/store-assets.test.js` checks the ones that can be checked. Contact: `srewoo@gmail.com`. The privacy policy is dated the release date (1 November 2026 in this plan; the owner's checklist says to change it if the submission is later).
- **Audience:** everyone who works in Chrome. The listing names engineers and QA, product managers, sales, HR and recruiting, SEO and marketing, and support.
- **Privacy:** the listing and policy say tracking is off until the user agrees, and that Chrome's prompt for it reads "Read your browsing history". Private notes: no copy says they stay unlocked for 5 minutes; they lock after 5 minutes without use or sooner. Export copy says to keep files private and to use a 6-to-8-digit PIN.
- **Layering and sinks (unchanged):** `src/lib/` never touches the DOM; `src/ui/` never calls `chrome.storage` in new code; no `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src/` (`test/no-innerhtml.test.js`). `store-assets/generate.mjs` builds its caption pages with `page.setContent`; it is a tool outside `src/` and the package, as before.
- **Size:** no file in `src/` over 300 lines and no function over 50 lines. `test/e2e/full.mjs` stays the one file over 300 lines.
- **Dates:** local-calendar ISO strings; never `new Date('YYYY-MM-DD')`; use `src/lib/dates.js`.
- **Node and tests:**
  - Node ≥ 22. `node --test` takes globs, never a directory. Every test file lives under `test/`; unit tests run in `TZ=America/New_York` and `TZ=Asia/Kolkata` (`npm test`).
  - End-to-end: pages are opened directly as extension URLs; keys and clicks happen only inside Playwright's Chromium. Nothing synthesises mouse or keyboard events on the owner's desktop.
  - Run end-to-end in a timezone whose local time is outside 23:30–01:30 (Phase 4 ruling P-E2E: date-keyed checks flake across midnight). Check `TZ=America/New_York date` first; use `TZ=America/New_York npm run e2e`, or `TZ=Europe/London` if New York is in that window.
- **Dependencies:** no runtime dependencies. Dev dependencies stay `typescript@^5.5.4` and `@types/chrome@^0.0.268`. The screenshot tool uses the Playwright that `test/e2e/full.mjs` already uses (`/Users/sharajrewoo/.npm/_npx/9833c18b2d85bc59/node_modules`) and `ffmpeg`.
- **Typecheck:** `npm run typecheck` covers `src/lib/**`, `src/background/**`, `src/content/**`, `src/ui/components/**`, `src/ui/panel/**`, `src/ui/app/**`, `src/ui/remind/**`, as before.
- **Gates:** every task ends with `npm test` green in both timezones and `npm run typecheck` clean; every task that changes a page, the worker or the harness also ends with `npm run e2e` green (`N/N passed`, then `No tabs: 9/9 passed`).

## File map (end state of Phase 6)

```
manifest.json                      version 3.0.0; description for the merged product
package.json package-lock.json     version 3.0.0 (npm version); scripts e2e:zip, parity, release:check
README.md                          missed reminders, coming from Weekly 2, notification cleared; PIN lock wording, exports kept private; e2e:zip, parity, release:check, layout
src/background/reminders.js        forgetWindowIfClosed also clears both reminder notifications (Phase 3 m2)
src/lib/stats.js                   heatmap: a first column with only a month's last days gives its label to the next month
src/ui/components/pin-dialog.js    "lock after 5 minutes without use, or sooner"
src/ui/report/report.html          Notes PIN hint: use 6 to 8 digits if you export; Your data hint: keep export files private
scripts/parity.mjs        new      the parity gate
test/parity-proofs.mjs    new      each parity row and the checks that prove it
test/wording.test.js      new      the PIN and export wording (Phase 4 parked)
test/store-assets.test.js new      policy, listing, permissions, screenshots, demo data
test/manifest.test.js test/stats.test.js test/background/reminders.test.js test/helpers/chrome-stub.js   extended
test/e2e/run.mjs                   --zip: both suites on dist/weekly-<version>.zip, unzipped
test/e2e/reminders.mjs             +1 check: the notification goes with the window
store-assets/privacy-policy.html   rewritten for 3.0.0
store-assets/store-listing.md      rewritten for 3.0.0
store-assets/README.md             new files table, how the screenshots are made
store-assets/demo-data.mjs  new    the fictional tasks and notes in the screenshots
store-assets/generate.mjs          rewritten: real 3.0 pages, fixed clock, light and dark
store-assets/screenshot-{1-report,2-panel,3-calendar,4-notes-dark,5-stats-dark}.png   regenerated / new
store-assets/screenshot-{2-anonymous,3-welcome,4-popup,5-history}.png                 deleted
store-assets/promo-small-440x280.png promo-marquee-1400x560.png icon-128.png          regenerated
```

---

### Task 1: Version 3.0.0, and the end-to-end suite on the zip itself

`npm run build` stamps the version from `package.json` into the built manifest, so a stale `manifest.json` would never reach the store; but the source manifest is what `Load unpacked` shows and what reviewers read, so both say 3.0.0 and a test keeps them equal. Spec §7 and §8 want the end-to-end run on the unzipped build: `--zip` makes the harness test the very file that is uploaded.

**Files:**
- Modify: `package.json`, `package-lock.json` (through `npm version`), `manifest.json`
- Modify: `test/e2e/run.mjs`, `README.md`
- Test: `test/manifest.test.js`

**Interfaces:**
- Consumes: `scripts/build.mjs` (stamps `package.json`'s version into `dist/weekly/manifest.json`), `scripts/zip.mjs` (writes `dist/weekly-<version>.zip`).
- Produces: `npm run e2e:zip` (`node test/e2e/run.mjs --zip`): both suites on `dist/weekly-<version>.zip`, unzipped into `.e2e/zip`; it prints `End-to-end on dist/weekly-3.0.0.zip (manifest 3.0.0)` and refuses a missing zip or a zip whose manifest version differs from `package.json`. Results land in `.e2e/results.json` and `.e2e/no-tabs/results.json` as before (Task 8 reads them).

- [ ] **Step 1: Write the failing test**

In `test/manifest.test.js`, replace:

```js
  assert.ok(manifest.optional_permissions.includes('tabs') && manifest.optional_permissions.includes('history'));
});

```

with:

```js
  assert.ok(manifest.optional_permissions.includes('tabs') && manifest.optional_permissions.includes('history'));
});

test('manifest.json and package.json carry the same version, so the zip is named after what Chrome shows', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version, pkg.version);
});

```

- [ ] **Step 2: Bump package.json and see the test fail**

Run: `npm version 3.0.0 --no-git-tag-version`

Expected: `v3.0.0`. The flag matters: there is no git here, and without it npm tries to commit and tag. It also updates both version fields in `package-lock.json`.

Run: `node --test test/manifest.test.js`

Expected: FAIL, `not ok 5 - manifest.json and package.json carry the same version, so the zip is named after what Chrome shows`, `expected: '3.0.0'`, `actual: '2.0.0'`.

- [ ] **Step 3: Bump the manifest**

In `manifest.json`, replace:

```json
  "version": "2.0.0",
```

with:

```json
  "version": "3.0.0",
```

Run: `node --test test/manifest.test.js`

Expected: `# pass 5`, `# fail 0`.

- [ ] **Step 4: Teach the harness to test the zip**

In `test/e2e/run.mjs`, replace:

```js
// untouched copy runs the no-tabs checks: tracking off, everything else working (W3).
import { execFileSync } from 'node:child_process';
```

with:

```js
// untouched copy runs the no-tabs checks: tracking off, everything else working (W3).
// With --zip it builds nothing: both runs use dist/weekly-<version>.zip, unzipped, as uploaded to the store.
import { execFileSync } from 'node:child_process';
```

In `test/e2e/run.mjs`, replace:

```js
execFileSync('node', [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
cpSync(join(root, 'dist/weekly'), ext, { recursive: true });
const noTabs = join(work, 'ext-notabs');
cpSync(join(root, 'dist/weekly'), noTabs, { recursive: true });
```

with:

```js
const fromZip = process.argv.includes('--zip');
if (!fromZip) execFileSync('node', [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const built = fromZip ? unzipRelease() : join(root, 'dist/weekly');
cpSync(built, ext, { recursive: true });
const noTabs = join(work, 'ext-notabs');
cpSync(built, noTabs, { recursive: true });

/** The store zip, unpacked: manifest.json at its root, carrying the version the zip is named after. */
function unzipRelease() {
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const zip = join(root, 'dist', `weekly-${version}.zip`);
  if (!existsSync(zip)) throw new Error(`${zip} is missing: run npm run package first`);
  const dir = join(work, 'zip');
  execFileSync('unzip', ['-q', zip, '-d', dir]);
  const shipped = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).version;
  if (shipped !== version) throw new Error(`the zip's manifest says ${shipped}, package.json ${version}`);
  console.log(`End-to-end on ${zip.slice(root.length)} (manifest ${shipped})`);
  return dir;
}
```

In `package.json`, replace:

```json
    "e2e": "node test/e2e/run.mjs",
```

with:

```json
    "e2e": "node test/e2e/run.mjs",
    "e2e:zip": "node test/e2e/run.mjs --zip",
```

In `README.md`, replace:

```markdown
| `npm run e2e` | Builds, loads the extension in Chromium, runs the end-to-end suite, then the no-tabs checks on the build as shipped |
| `npm run build` | Copies `manifest.json`, `icons/` and `src/` into `dist/weekly/` (load this folder unpacked), stamps the version from `package.json`, checks every file and module import resolves |
```

with:

```markdown
| `npm run e2e` | Builds, loads the extension in Chromium, runs the end-to-end suite, then the no-tabs checks on the build as shipped |
| `npm run e2e:zip` | The same two runs on `dist/weekly-<version>.zip`, unzipped: the file you upload to the store |
| `npm run build` | Copies `manifest.json`, `icons/` and `src/` into `dist/weekly/` (load this folder unpacked), stamps the version from `package.json`, checks every file and module import resolves |
```

In `README.md`, replace:

```markdown
To release: bump `version` in `package.json` (e.g. `npm version patch --no-git-tag-version`), then `npm run package`.
```

with:

```markdown
To release: bump `version` in `package.json` and `manifest.json` (e.g. `npm version patch --no-git-tag-version`, then the same number in `manifest.json`; a unit test fails while they differ), then `npm run package && npm run e2e:zip`. The store text, privacy policy and screenshots are in `store-assets/`; its README says how to remake the screenshots.
```

- [ ] **Step 5: Package, then run both suites on the zip**

Run: `npm run package 2>&1 | grep -E "^# (tests|pass|fail)|Packed"`

Expected: `# tests 319`, `# pass 319`, `# fail 0` twice (318 + 1), then `Packed 90 files → dist/weekly-3.0.0.zip`.

Run: `TZ=America/New_York npm run e2e:zip 2>&1 | grep -E "End-to-end|passed$|^FAIL"`

Expected: `End-to-end on dist/weekly-3.0.0.zip (manifest 3.0.0)`, `268/268 passed`, `No tabs: 9/9 passed`, no `FAIL`. (About four minutes.)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`

Expected: no output after the `tsc` line.

---

### Task 2: A dismissed reminder takes its notification with it; README on missed reminders and the upgrade (Phase 3 parked)

The morning brief and evening check show a window and, by default, a system notification with `requireInteraction: true`. Clicking the notification clears it, but closing the window (Dismiss, Snooze, Open the week report, or the window's close button) left it in the notification centre for a reminder already dealt with (Phase 3 review m2). Every way out of the window ends in `chrome.windows.onRemoved`, which the worker already routes to `forgetWindowIfClosed`, so that one function clears both slots' notifications. Clearing an id that does not exist is a no-op in Chrome.

**Files:**
- Modify: `src/background/reminders.js` (`forgetWindowIfClosed`)
- Modify: `README.md`
- Test: `test/helpers/chrome-stub.js`, `test/background/reminders.test.js`, `test/e2e/reminders.mjs`

**Interfaces:**
- Consumes: `NOTIFICATION_PREFIX` (`'weekly:remind:'`), `SLOTS` (`['morning', 'evening']`, from `src/lib/reminders.js`, already imported by `reminders.js`).
- Produces: `forgetWindowIfClosed(closedId)` clears `weekly:remind:morning` and `weekly:remind:evening` when `closedId` is the reminder window; it does nothing for any other window. The stub logs `chrome.notifications.clear(id)` in `ctx.log.notificationsCleared`.

- [ ] **Step 1: Write the failing tests**

In `test/helpers/chrome-stub.js`, replace:

```js
    notifications: [],
    alarms: /** @type {Map<string, {when: number}>} */ (new Map()),
```

with:

```js
    notifications: [],
    /** Notification ids the code cleared. */
    notificationsCleared: /** @type {string[]} */ ([]),
    alarms: /** @type {Map<string, {when: number}>} */ (new Map()),
```

In `test/helpers/chrome-stub.js`, replace:

```js
      async clear() { return true; },
```

with:

```js
      async clear(id) { log.notificationsCleared.push(id); return true; },
```

In `test/background/reminders.test.js`, replace:

```js
  for (const list of [ctx.log.windowsCreated, ctx.log.windowsUpdated, ctx.log.tabsUpdated, ctx.log.notifications]) list.length = 0;
```

with:

```js
  for (const list of [ctx.log.windowsCreated, ctx.log.windowsUpdated, ctx.log.tabsUpdated, ctx.log.notifications, ctx.log.notificationsCleared]) list.length = 0;
```

In `test/background/reminders.test.js`, replace:

```js
  assert.equal(ctx.log.windowsCreated.length, 2);
});
```

with:

```js
  assert.equal(ctx.log.windowsCreated.length, 2);
});

test('closing the reminder window clears its notifications, so none waits in the notification centre (Phase 3 m2)', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  await fire('morning');
  await forgetWindowIfClosed(9999);
  assert.deepEqual(ctx.log.notificationsCleared, [], 'another window closing changes nothing');
  await forgetWindowIfClosed(ctx.log.windowsCreated[0].id);
  assert.deepEqual(ctx.log.notificationsCleared.sort(), ['weekly:remind:evening', 'weekly:remind:morning']);
});
```

In `test/e2e/reminders.mjs`, replace:

```js
  c('Dismiss closes the window and the worker forgets it', again.isClosed() && !(await sw.evaluate(() => chrome.storage.session.get('reminderWindowId'))).reminderWindowId);
  // Off again, so a real 09:00 or 18:00 can never open a window in the middle of the rest of the suite.
```

with:

```js
  c('Dismiss closes the window and the worker forgets it', again.isClosed() && !(await sw.evaluate(() => chrome.storage.session.get('reminderWindowId'))).reminderWindowId);
  const left = Object.keys(await sw.evaluate(() => chrome.notifications.getAll())).filter((id) => id.startsWith('weekly:remind:'));
  c('the notification goes with the window: none is left in the notification centre (Phase 3 m2)', left.length === 0, left.join(', '));
  // Off again, so a real 09:00 or 18:00 can never open a window in the middle of the rest of the suite.
```

- [ ] **Step 2: Run the unit test to see it fail**

Run: `node --test test/background/reminders.test.js`

Expected: FAIL, `not ok 11 - closing the reminder window clears its notifications, so none waits in the notification centre (Phase 3 m2)` (nothing was cleared); the other 23 pass.

- [ ] **Step 3: Clear the notifications with the window**

In `src/background/reminders.js`, replace:

```js
/** @param {number} closedId */
export async function forgetWindowIfClosed(closedId) {
  if ((await chrome.storage.session.get(WINDOW_KEY))[WINDOW_KEY] === closedId) await chrome.storage.session.remove(WINDOW_KEY);
```

with:

```js
/**
 * The reminder window was closed: forget it, and take its notifications with it. They are
 * created with requireInteraction, so otherwise they would wait in the notification centre
 * for a reminder already dealt with.
 * @param {number} closedId
 */
export async function forgetWindowIfClosed(closedId) {
  if ((await chrome.storage.session.get(WINDOW_KEY))[WINDOW_KEY] !== closedId) return;
  await chrome.storage.session.remove(WINDOW_KEY);
  await Promise.all(SLOTS.map((slot) => chrome.notifications.clear(NOTIFICATION_PREFIX + slot)));
```

Run: `node --test test/background/reminders.test.js`

Expected: `# pass 24`, `# fail 0`.

- [ ] **Step 4: Say what happens to missed reminders and on an upgrade from Weekly 2**

These two sentences describe the real tree's Phase 3 fix wave (an alarm delivered on a later day than it was set for is dropped; `migrateFridayFlag` turns the reminders on only for a Weekly 2 profile whose Friday reminder was on). See the pre-flight note.

In `README.md`, replace:

```markdown
- Both open in one small window that is reused, with a system notification that reaches you when Chrome isn't the app in front. One missed while Chrome was closed shows when Chrome starts. **Snooze 1 h** brings the evening check back.
```

with:

```markdown
- Both open in one small window that is reused, with a system notification that reaches you when Chrome isn't the app in front. Closing the window clears the notification too. **Snooze 1 h** brings the evening check back.
- **Missed reminders**: one missed while Chrome was closed shows when Chrome starts, if its time has passed today. One missed while the computer was asleep shows when it wakes on the same day; a check from an earlier day is dropped, not shown late.
- **Coming from Weekly 2**: the reminders start on only if Weekly 2's Friday reminder was on. Otherwise turn them on in **Settings → Reminders**. The Friday 4 pm reminder itself is gone; the evening check on your last working day links to the week report instead.
```

- [ ] **Step 5: Run the gates**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)" && npm run typecheck`

Expected: `# tests 320`, `# pass 320`, `# fail 0` in each timezone (319 + 1); typecheck clean.

Run: `TZ=America/New_York npm run e2e 2>&1 | grep -E "m2|passed$|^FAIL"`

Expected: `PASS [Reminders] the notification goes with the window: none is left in the notification centre (Phase 3 m2)`, `269/269 passed`, `No tabs: 9/9 passed`. Before Step 3 this check failed with `weekly:remind:evening, weekly:remind:morning` still listed (checked during the replay); there is no need to rerun the suite to see it fail.

---

### Task 3: Say when private notes really lock, and that exports must be kept private (Phase 4 parked)

Two sentences in the pages promise more than the code does. The unlock dialog says the PIN opens private notes "for 5 minutes after you last use one", but the key lives in the service worker and Chrome stops an idle worker after about 30 seconds, so the notes often lock much sooner. And since Phase 5 an export carries the PIN record (salt and check value): whoever has the file can try PINs offline, and 4 digits are 10,000 tries. Settings now say so where the PIN is set and where Export is.

**Files:**
- Modify: `src/ui/components/pin-dialog.js` (one hint line), `src/ui/report/report.html` (two hints), `README.md`
- Test: `test/wording.test.js` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: no code interface. The unlock dialog's hint reads "Private notes stay open until you lock them. They also lock after 5 minutes without use, or sooner if Chrome pauses Weekly in the background." Settings → Notes PIN ends "If you export your data, use 6 to 8 digits: …"; Settings → Your data gains "… Keep export files private."

- [ ] **Step 1: Write the failing tests**

Create `test/wording.test.js`:

```js
// Words the pages show about private notes and exports (Phase 4 final review, parked to the release).
// Chrome stops an idle background worker after about 30 seconds, and the key goes with it,
// so no page may promise five unlocked minutes. An export carries the PIN check value, so a
// short PIN can be guessed from a copy of the file: Settings must say so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the unlock dialog says private notes lock after 5 idle minutes or sooner, never that they stay open 5 minutes', () => {
  const dialog = read('src/ui/components/pin-dialog.js');
  assert.doesNotMatch(dialog, /for 5 minutes after/);
  assert.match(dialog, /after 5 minutes without use, or sooner/);
});

test('Settings say to keep export files private and that a longer PIN is safer', () => {
  const report = read('src/ui/report/report.html');
  assert.match(report, /Keep export files private/);
  assert.match(report, /use 6 to 8 digits/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/wording.test.js`

Expected: FAIL, `not ok 1 - the unlock dialog says private notes lock after 5 idle minutes or sooner, never that they stay open 5 minutes` and `not ok 2 - Settings say to keep export files private and that a longer PIN is safer`.

- [ ] **Step 3: Change the words**

In `src/ui/components/pin-dialog.js`, replace:

```js
  h('p', { class: 'hint' }, 'Your PIN opens private notes until you lock them, or for 5 minutes after you last use one.'),
```

with:

```js
  h('p', { class: 'hint' }, 'Private notes stay open until you lock them. They also lock after 5 minutes without use, or sooner if Chrome pauses Weekly in the background.'),
```

In `src/ui/report/report.html`, replace:

```html
        <p class="hint">Private notes are encrypted on this computer with your PIN. Weekly never stores the PIN, so a forgotten PIN cannot be recovered. Five wrong tries pause unlocking for 30 seconds, then longer. Removing the PIN turns private notes back into ordinary ones.</p>
```

with:

```html
        <p class="hint">Private notes are encrypted on this computer with your PIN. Weekly never stores the PIN, so a forgotten PIN cannot be recovered. Five wrong tries pause unlocking for 30 seconds, then longer. Removing the PIN turns private notes back into ordinary ones. If you export your data, use 6 to 8 digits: an export holds the PIN check value, and a 4-digit PIN can be guessed from a copy of the file.</p>
```

In `src/ui/report/report.html`, replace:

```html
        </div>
        <p class="hint">Import takes a Weekly export from this or another computer, a Daybook backup or a ForgetMeNot export.</p>
```

with:

```html
        </div>
        <p class="hint">An export holds your tasks, notes, settings and activity. Private notes stay encrypted, but the file is enough to try PINs against. Keep export files private.</p>
        <p class="hint">Import takes a Weekly export from this or another computer, a Daybook backup or a ForgetMeNot export.</p>
```

In `README.md`, replace:

```markdown
- **Private notes**: set a PIN (4 to 8 digits) in **Settings → Notes PIN**, then tick **Private** on a note. Its title and text are encrypted on this computer (PBKDF2-SHA256, 310,000 rounds, AES-GCM); while locked it shows only "Private note". The PIN is never stored, only a salt and a check value. The key lives in Weekly's background worker, never on disk, and is forgotten when you lock, after 5 minutes without using a private note, or when Chrome stops the worker. Five wrong PINs pause unlocking for 30 seconds, then 1, 5 and 15 minutes. Private notes never reach the update, the AI tidy-up, search while locked, or a web page. Forget the PIN and they cannot be recovered.
```

with:

```markdown
- **Private notes**: set a PIN (4 to 8 digits) in **Settings → Notes PIN**, then tick **Private** on a note. Its title and text are encrypted on this computer (PBKDF2-SHA256, 310,000 rounds, AES-GCM); while locked it shows only "Private note". The PIN is never stored, only a salt and a check value. The key lives in Weekly's background worker, never on disk, and is forgotten when you lock, after 5 minutes without using a private note, or sooner: Chrome stops an idle background worker after about 30 seconds, and the key goes with it. Five wrong PINs pause unlocking for 30 seconds, then 1, 5 and 15 minutes. Private notes never reach the update, the AI tidy-up, search while locked, or a web page. Forget the PIN and they cannot be recovered.
```

In `README.md`, replace:

```markdown
- **Backups and other computers**: **Export** saves tasks, notes (private ones stay encrypted), the PIN record (never the PIN), settings (never the Slack webhook) and activity. **Import a backup** takes that file, a Daybook backup or a ForgetMeNot export. It says what the file holds before anything changes, then **Add** (tasks you have are never overwritten; of two copies of a note the newer stays) or **Replace** (swaps only what the file carries: a Daybook backup replaces tasks, a ForgetMeNot export notes). Private notes need the PIN they were locked with; if you have a different PIN, you choose which one to keep. Activity from another computer is kept under that computer, so importing it again replaces it rather than adding it twice. Files over 20 MB are refused.
```

with:

```markdown
- **Backups and other computers**: **Export** saves tasks, notes (private ones stay encrypted), the PIN record (never the PIN), settings (never the Slack webhook) and activity. **Import a backup** takes that file, a Daybook backup or a ForgetMeNot export. It says what the file holds before anything changes, then **Add** (tasks you have are never overwritten; of two copies of a note the newer stays) or **Replace** (swaps only what the file carries: a Daybook backup replaces tasks, a ForgetMeNot export notes). Private notes need the PIN they were locked with; if you have a different PIN, you choose which one to keep. Activity from another computer is kept under that computer, so importing it again replaces it rather than adding it twice. Files over 20 MB are refused. Keep export files private: the PIN record in them is enough to try PINs offline, so with private notes use a PIN of 6 to 8 digits.
```

Run: `node --test test/wording.test.js`

Expected: `# pass 2`, `# fail 0`.

- [ ] **Step 4: Run the gates**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)" && npm run typecheck`

Expected: `# tests 322`, `# pass 322`, `# fail 0` in each timezone (320 + 2); typecheck clean.

Run: `TZ=America/New_York npm run e2e 2>&1 | grep -E "passed$|^FAIL"`

Expected: `269/269 passed`, `No tabs: 9/9 passed` (no check reads these hints; the run proves the pages still load and every control keeps its label).

---

### Task 4: The year of days never prints two month names on top of each other

Found while making the Stats screenshot: when the 365 days start a day or three before a month ends, the heatmap's first column is labelled with the old month and the second with the new one, 15 px apart, and the two names run into each other ("OctNov"). The first column then holds only a few days of the old month, so the label goes to the new month alone. Months are at least four columns wide, so only the first column can collide.

**Files:**
- Modify: `src/lib/stats.js` (`heatmap`)
- Test: `test/stats.test.js`

**Interfaces:**
- Consumes: `heatmap(rows) → { weeks, months }` and `yearRows(tasks, to)` (Phase 5).
- Produces: the same shape; `months[0]` is `''` whenever `months[1]` is labelled.

- [ ] **Step 1: Write the failing test**

In `test/stats.test.js`, replace:

```js
  assert.equal(pct({ iso: '', done: 0, total: 0 }), null);
});

```

with:

```js
  assert.equal(pct({ iso: '', done: 0, total: 0 }), null);
});

test('a first column holding only a month’s last days leaves its label to the next month, so the two never print on top of each other', () => {
  // The year ending Sun 29 Nov 2026 starts on Sun 30 Nov 2025: the first column is that one Sunday, the second starts December.
  const { weeks, months } = heatmap(yearRows([STANDUP], '2026-11-29'));
  assert.equal(weeks[0]?.filter(Boolean).length, 1);
  assert.equal(months[0], '');
  assert.equal(months[1], 'Dec');
  assert.equal(months.filter(Boolean).length, 12, 'December to November, once each');
});

```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/stats.test.js`

Expected: FAIL, `not ok 9 - a first column holding only a month’s last days leaves its label to the next month, so the two never print on top of each other`, `expected: ''`, `actual: 'Nov'`.

- [ ] **Step 3: Give the label to the next month**

In `src/lib/stats.js`, replace:

```js
  });
  return { weeks, months };
```

with:

```js
  });
  // A first column with only a month's last days would print its name on top of the next month's.
  if (months[0] && months[1]) months[0] = '';
  return { weeks, months };
```

Run: `node --test test/stats.test.js`

Expected: `# pass 9`, `# fail 0`.

- [ ] **Step 4: Run the gates**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)" && npm run typecheck`

Expected: `# tests 323`, `# pass 323`, `# fail 0` in each timezone (322 + 1); typecheck clean.

Run: `TZ=America/New_York npm run e2e 2>&1 | grep -E "Stats\] a year|passed$|^FAIL"`

Expected: `PASS [Stats] a year of days: 365 squares ending today, months labelled (L7)`, `269/269 passed`, `No tabs: 9/9 passed`.

---

### Task 5: The privacy policy for 3.0.0

The 2.0.0 policy describes a tab logger with a toolbar popup. It says Weekly "has no content scripts", that notes are purged after 90 days, and nothing about tasks, private notes, the on-page note, tracking being optional or what an export holds. The new one keeps the old structure and wording where still true. It adds those topics and the permission prompt's wording, and it states the two Phase 4 points (lock timing, keep exports private). Everything it says was checked against the code: `KEEP` in `src/ui/report/data-panel.js` (Delete everything keeps settings and the PIN record), `expiredKeys` (90 days for `day:`, `hist:`, `imp:`), `crypto-broker.js` (key in memory only), `onpage.js` (plain notes only) and `status.js` (tracking on/off grants or removes `tabs`).

**Files:**
- Modify: `store-assets/privacy-policy.html` (whole body rewritten, same stylesheet)
- Test: `test/store-assets.test.js` (new)

**Interfaces:**
- Consumes: `package.json` `version`.
- Produces: `test/store-assets.test.js` with `read(path)`, `pkg` and `policy`; Tasks 6 and 7 add to this file.

- [ ] **Step 1: Write the failing tests**

Create `test/store-assets.test.js`:

```js
// The store text and the privacy policy must describe the extension that ships: its version,
// its permissions and what it keeps. Each claim here is checked against the repo, not by eye.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const policy = read('store-assets/privacy-policy.html');

test('the privacy policy names this version and the contact address', () => {
  assert.match(policy, new RegExp(`version ${pkg.version.replaceAll('.', '\\.')}\\b`));
  assert.match(policy, /Last updated: \d{1,2} [A-Z][a-z]+ \d{4}/);
  assert.match(policy, /srewoo@gmail\.com/);
});

test('the privacy policy covers Weekly 3: tasks, notes, private notes, the on-page note, tracking off by default, what an export holds', () => {
  for (const words of [/Tasks you add/, /Notes you write/, /PBKDF2-SHA256/, /AES-GCM/, /The PIN itself is never stored/, /Alt\+N/,
    /Tracking is off until you turn it on/, /never the PIN/, /never the Slack webhook/, /Keep export files private/, /kept until you delete them/]) {
    assert.match(policy, words);
  }
});

test('the privacy policy has none of Weekly 2’s stale lines: no toolbar popup, no 90-day purge of notes', () => {
  assert.doesNotMatch(policy, /popup/i);
  assert.doesNotMatch(policy, /notes and imported records\) is deleted/);
  assert.doesNotMatch(policy, /has no content scripts/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/store-assets.test.js`

Expected: FAIL, all three: `not ok 1 - the privacy policy names this version and the contact address` (it says 2.0.0), `not ok 2 - the privacy policy covers Weekly 3…`, `not ok 3 - the privacy policy has none of Weekly 2’s stale lines…`.

- [ ] **Step 3: Write the policy**

Replace the whole of `store-assets/privacy-policy.html` with:

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Weekly privacy policy</title>
<style>
:root{--paper:#f6f4ee;--sheet:#fffdf8;--ink:#1c2333;--muted:#596071;--rule:#ddd8cb;--navy:#1f3a68;--marker:#f2cf45;
--serif:Charter,"Bitstream Charter","Iowan Old Style","Sitka Text",Cambria,Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 var(--sans)}
main{max-width:720px;margin:0 auto;padding:48px 20px 80px}
.kicker{font:600 13px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
h1{font:600 clamp(30px,5vw,42px)/1.1 var(--serif);margin:0 0 12px;letter-spacing:-.01em}
.mark{background:linear-gradient(transparent 60%,var(--marker) 60%,var(--marker) 92%,transparent 92%)}
h2{font:600 22px/1.2 var(--serif);margin:36px 0 10px;padding-top:14px;border-top:2px solid var(--ink)}
p,li{max-width:66ch}li{margin:4px 0}
.sum{background:var(--sheet);border:1px solid var(--rule);border-radius:4px;padding:14px 18px;margin:20px 0}
.sum p{margin:0}
table{border-collapse:collapse;width:100%;font-size:15px;background:var(--sheet)}
th,td{border:1px solid var(--rule);padding:8px 10px;text-align:left;vertical-align:top}
th{font-family:var(--serif)}
code{font:14px ui-monospace,Menlo,Consolas,monospace}
.meta{color:var(--muted);font-size:14px}
a{color:var(--navy)}
</style></head>
<body><main>
<p class="kicker">Weekly</p>
<h1>Privacy <span class="mark">policy</span></h1>
<p class="meta">Applies to the Weekly Chrome extension, version 3.0.0. Last updated: 1 November 2026.</p>

<div class="sum"><p><strong>In short:</strong> Weekly keeps your tasks, notes and reminders on your computer. Tracking is off until you turn it on; then Weekly also keeps a log of the address and title of the Chrome tab you are working in, and for how long, for 90 days. We run no servers and receive no data. Anything that leaves your computer does so only because you chose to copy, post, export or look something up.</p></div>

<h2>What Weekly stores</h2>
<ul>
<li><strong>Tasks you add:</strong> title, description, priority, due date, and for a daily task the days it repeats and the days you ticked it.</li>
<li><strong>Notes you write:</strong> title, text, category, and the day a note belongs to, if any.</li>
<li><strong>Private notes:</strong> if you set a PIN and mark a note private, its title and text are encrypted on your computer before they are stored (PBKDF2-SHA256 with 310,000 rounds, then AES-GCM). The PIN itself is never stored, only a random salt and a check value. The key exists only in the memory of Weekly's background process. It is dropped when you lock, after 5 minutes without use, or sooner when Chrome stops that process.</li>
<li><strong>Settings:</strong> your role, reminder times and working days, light or dark appearance, sites to ignore, your own rules, and an optional Slack webhook address. Also your saved draft edits, the items you untick, and the day each reminder last showed.</li>
<li><strong>If you turn tracking on:</strong> the address (URL), page title and time spent for the <strong>active tab of the focused Chrome window</strong>, only while Chrome is in front and you are active, and a per-day count of task switches. Time stops when you go idle (default 2 minutes) or lock your screen.</li>
<li><strong>If you choose "Fill in from history":</strong> estimated time per page for the last 15 days, built from Chrome's visit history on this computer. History synced from your other devices is skipped.</li>
</ul>

<h2>What Weekly never collects</h2>
<ul>
<li>Page content, text you type into web pages, keystrokes, mouse activity or screenshots.</li>
<li>Passwords, cookies or login tokens.</li>
<li>Your name, email address or any account details. There is no account.</li>
<li>Analytics, telemetry, crash reports or advertising identifiers. There are none.</li>
</ul>
<p><strong>The on-page note.</strong> When you press Alt+N, or "Note on this page" in the side panel, Weekly adds its small note panel to that one page, using Chrome's <code>activeTab</code> and <code>scripting</code> permissions. The panel shows and saves your own notes. It does not read the page, and it never shows private notes. Weekly runs nothing in web pages at any other time.</p>

<h2>Tracking is your choice</h2>
<p>Tracking is off until you turn it on, on the welcome page or in Settings. Turning it on asks Chrome for the <code>tabs</code> permission; Chrome's prompt calls this "Read your browsing history". Without it Weekly records no browsing at all and works as a task, notes and reminders app. Turning tracking off in Settings gives the permission back.</p>

<h2>Where it is stored</h2>
<p>Only in your browser's extension storage on your computer (<code>chrome.storage.local</code>), plus the tab being timed and the reminder window's id in session storage, which Chrome clears when the browser closes. Nothing is synced through your Google account, nothing is stored on a server, and the developer has no access to it.</p>

<h2>How long it is kept</h2>
<p>Tracked activity, history estimates and activity imported from another computer are deleted after <strong>90 days</strong>, each time the extension starts. Tasks, notes and settings are kept until you delete them, or until you uninstall the extension.</p>

<h2>When data leaves your computer</h2>
<p>Never automatically. The only network features are optional, off until you use them, and each asks Chrome for permission first:</p>
<table>
<tr><th>Feature</th><th>What happens</th></tr>
<tr><td>Live status for Jira, GitLab and GitHub</td><td>For ticket and merge request items, Weekly asks that site's own API for the ticket status or merge request state, using the login you already have in your browser (for example <code>https://your-company.atlassian.net/rest/api/2/issue/ABC-123</code>). Only the ticket or merge request identifier is sent, to the site you already use. The answer is shown on screen and not stored. Permission is requested one site at a time.</td></tr>
<tr><td>Post to Slack</td><td>If you paste a Slack incoming webhook address in Settings and press "Post to Slack", the text of your draft is sent to <code>hooks.slack.com</code> after you confirm. Nothing is posted otherwise.</td></tr>
<tr><td>Copy for ChatGPT or Claude</td><td>Only copies the draft and some instructions to your clipboard. Weekly does not contact those services. What you paste there is up to you and subject to their terms.</td></tr>
<tr><td>Tidy up with Chrome AI</td><td>Uses the model built into Chrome (Gemini Nano), which runs on your computer. Your draft is not sent to us or to a server. Chrome may download the model the first time you use it.</td></tr>
<tr><td>Fill in from Chrome history</td><td>Reads local history after you grant Chrome's history permission. No network use.</td></tr>
</table>
<p>We do not sell, rent or share your data, and we do not use it for advertising, credit decisions or anything outside Weekly's purpose: planning and recording your working week and drafting your update.</p>

<h2>Export and import</h2>
<p><strong>Export</strong> saves a file on your computer with your tasks, notes, settings and activity. Private notes stay encrypted in it. It holds the PIN record (the salt and check value), never the PIN, and never the Slack webhook. Keep export files private: with the check value, someone who has the file can try PINs on their own computer, so if you export private notes, use a PIN of 6 to 8 digits. <strong>Import</strong> reads a file you choose (a Weekly export, a Daybook backup or a ForgetMeNot export) on your computer; nothing is sent anywhere.</p>

<h2>Your controls</h2>
<ul>
<li><strong>Untick</strong> any item to leave it out of an update, and <strong>Hide people and customer names</strong> to replace candidates, customers and support cases with numbered stand-ins.</li>
<li>Turn <strong>tracking</strong> on or off in Settings. While it is on, <strong>Pause</strong> it from the side panel's footer, and list sites in <strong>Never track these sites</strong>.</li>
<li><strong>Lock</strong> private notes at any time. <strong>Remove PIN</strong> turns them back into ordinary notes and deletes the PIN record.</li>
<li><strong>Remove history estimates</strong> deletes estimates and turns history access off.</li>
<li><strong>Delete everything</strong> removes tracked activity, tasks, notes, drafts and imported activity. Your settings and PIN record stay until you change them. Uninstalling the extension removes all of its data.</li>
<li>You can revoke any optional permission at any time from <code>chrome://extensions</code>.</li>
</ul>

<h2>Children</h2>
<p>Weekly is a workplace tool and is not directed at children.</p>

<h2>Changes</h2>
<p>If this policy changes, the new version will be posted at this address with an updated date.</p>

<h2>Contact</h2>
<p>Questions or requests: <a href="mailto:srewoo@gmail.com">srewoo@gmail.com</a></p>
</main></body></html>
```

Run: `node --test test/store-assets.test.js`

Expected: `# pass 3`, `# fail 0`.

- [ ] **Step 4: Read it as a user would**

Run: `textutil -convert txt -stdout store-assets/privacy-policy.html | head -40`

Read the text top to bottom: no jargon a non-engineer would trip on, every heading has content, the contact line shows `srewoo@gmail.com`. Fix wording in place if something reads oddly; the tests pin facts, not sentences. (`textutil` ships with macOS; it only converts the file, nothing opens on the desktop.)

- [ ] **Step 5: Run the gates**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)" && npm run typecheck`

Expected: `# tests 326`, `# pass 326`, `# fail 0` in each timezone (323 + 3); typecheck clean. No end-to-end run: nothing in the package changed.

---

### Task 6: The store listing for the merged product, and one justification per permission

The listing is rewritten for what Weekly 3.0 is: tasks, calendar, reminders, notes with PIN privacy, the weekly update and stats, for anyone who works in Chrome. Tracking is described as off until the user says yes, with Chrome's own prompt text. The permission table has exactly one row per permission the manifest asks for. The eight install permissions come first; `tabs`, `history` and `https://*/*` are marked optional. `downloads` (in spec §3.6) is not requested because Export uses a download link (Phase 5 decision), so it has no row; the test would fail if it had one. A new section tells Daybook and ForgetMeNot users where their Export buttons are (Daybook: Settings → Your data → Export, `daybook-YYYY-MM-DD.json`; ForgetMeNot: Settings → Backup → Export, `forgetmenot-backup-YYYYMMDD.json`, both read from their source) and where Weekly's Import is.

The manifest's description is the store's short description, so it changes with it: "Tasks, reminders and notes for your working week, and a draft of your weekly update. Everything stays on your computer." (119 characters; the store allows 132.)

**Files:**
- Modify: `store-assets/store-listing.md` (whole file), `manifest.json` (`description`)
- Test: `test/store-assets.test.js`

**Interfaces:**
- Consumes: `read`, `pkg`, `policy` in `test/store-assets.test.js` (Task 5); `manifest.permissions`, `optional_permissions`, `optional_host_permissions`.
- Produces: `listing` and `manifest` in `test/store-assets.test.js` (Task 7 uses `listing`). The listing's "Assets in this folder" table names the five screenshot files Task 7 makes: `screenshot-1-report.png`, `screenshot-2-panel.png`, `screenshot-3-calendar.png`, `screenshot-4-notes-dark.png`, `screenshot-5-stats-dark.png`.

- [ ] **Step 1: Write the failing tests**

In `test/store-assets.test.js`, replace:

```js
const policy = read('store-assets/privacy-policy.html');

```

with:

```js
const policy = read('store-assets/privacy-policy.html');
const listing = read('store-assets/store-listing.md');
const manifest = JSON.parse(read('manifest.json'));

```

In `test/store-assets.test.js`, replace:

```js
  assert.doesNotMatch(policy, /has no content scripts/);
});

```

with:

```js
  assert.doesNotMatch(policy, /has no content scripts/);
});

test('the listing is for this version, and its short description is the manifest’s, within 132 characters', () => {
  assert.match(listing, new RegExp(`^Version ${pkg.version.replaceAll('.', '\\.')} `, 'm'));
  assert.ok(manifest.description.length <= 132, `${manifest.description.length} characters`);
  assert.ok(listing.includes(`| ${manifest.description} |`), 'the Basics table carries the manifest description');
});

test('every permission the manifest asks for has a justification, and nothing else has one', () => {
  const asked = [...manifest.permissions, ...manifest.optional_permissions, ...manifest.optional_host_permissions].sort();
  const section = listing.split('## Permission justifications')[1]?.split('\n## ')[0] ?? '';
  const justified = [...section.matchAll(/^\| `([^`]+)`/gm)].map((m) => m[1]).sort();
  assert.deepEqual(justified, asked);
});

test('the listing says tracking is off until the user agrees, quotes Chrome’s prompt, and gives the contact address', () => {
  assert.match(listing, /TRACKING IS OFF UNTIL YOU TURN IT ON/);
  assert.match(listing, /"Read your browsing history"/);
  assert.match(listing, /srewoo@gmail\.com/);
});

test('the listing tells Daybook and ForgetMeNot users how to bring their data across', () => {
  assert.match(listing, /MOVING FROM DAYBOOK OR FORGETMENOT/);
  assert.match(listing, /Import a backup/);
});

```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/store-assets.test.js`

Expected: FAIL, four of seven: `not ok 4 - the listing is for this version…` (it says 2.0.0), `not ok 5 - every permission the manifest asks for has a justification, and nothing else has one` (`sidePanel`, `scripting`, `activeTab` and `https://*/*` have no row of their own), `not ok 6 - the listing says tracking is off until the user agrees…`, `not ok 7 - the listing tells Daybook and ForgetMeNot users how to bring their data across`.

- [ ] **Step 3: Write the listing and the short description**

In `manifest.json`, replace:

```json
  "description": "Turns the work you do in Chrome into your weekly update or standup. Everything stays on your computer.",
```

with:

```json
  "description": "Tasks, reminders and notes for your working week, and a draft of your weekly update. Everything stays on your computer.",
```

Replace the whole of `store-assets/store-listing.md` with:

````markdown
# Weekly: Chrome Web Store listing

Version 3.0.0 (Manifest V3). Everything below is taken from the code in this repo; nothing here claims a feature the code lacks. Weekly 3.0 takes in Daybook (tasks and reminders) and ForgetMeNot (notes), which are being retired.

## Basics

| Field | Value |
|---|---|
| Name | Weekly |
| Category | Productivity (Workflow & Planning) |
| Language | English |
| Short description (119 chars, limit 132) | Tasks, reminders and notes for your working week, and a draft of your weekly update. Everything stays on your computer. |
| Privacy policy URL | `https://[host this file publicly]/privacy-policy.html` |
| Support / contact | srewoo@gmail.com |

The short description is the manifest description, unchanged.

**Hosting requirement:** the Web Store needs the privacy policy at a public URL. Host `privacy-policy.html` (GitHub Pages, your site, a public gist rendered as a page) and paste that URL in the Privacy tab.

## Single purpose

Weekly is a planner for the working week, kept on the user's computer: the tasks you plan and tick off, reminders in the morning and evening, the notes you take, and at the end of the week a draft of your weekly update built from all of it. If the user turns tracking on, a private log of the tabs they worked in feeds the same update.

## Detailed description (paste as plain text)

```
Weekly keeps your working week in one place: what you plan to do, what you note down, and the update you send on Friday.

It is for anyone who works in Chrome: engineers and QA, product managers, sales, HR and recruiting, SEO and marketing, and support.

TASKS
- Click the toolbar icon to open the side panel. Type a task and press Enter; it is due today.
- Overdue, Today and No date, with daily tasks first. Tick a task when it is done, or move it to tomorrow.
- Daily tasks repeat every weekday, or every day, and are ticked off day by day.
- Priority and due date from a task's menu. Search, filters, and views for Today, Week, Overdue, Upcoming, All open and Completed.
- Undo for every tick, move and delete (Ctrl+Z or Cmd+Z).

CALENDAR AND STATS
- A month calendar shaded by how much of each day got done. Click a day to tick its daily tasks, add tasks for that day, move or copy them to another day, and keep a note for the day.
- Stats: days in a row with everything done, a year of days, how each weekday goes, and how often each daily task gets done.

REMINDERS
- A morning brief at 9:00 with what is due and what is overdue.
- An evening check at 18:00 with what is still open, and "Move to tomorrow" on each task or all of them.
- Change the times and working days, or turn them off, in Settings.

NOTES
- Notes with a title, a category (General, Work, Personal, Idea, To-Read) and, if you like, a day. Search, pin, mark done.
- Private notes: set a PIN of 4 to 8 digits and mark a note private. Its title and text are encrypted on your computer. They never appear in your update.
- Alt+N opens a small note on the page you are on and saves it in Weekly.

YOUR WEEKLY UPDATE
- The tasks you finished come first. A daily task is listed once with its count, for example "Standup notes (5 of 5 days)". Your day notes follow as Other work.
- Weekly update (Monday to Friday) or daily standup (yesterday, today, blockers).
- Untick anything to leave it out. Edit the text freely; your edits are kept.
- Copy it, Copy for ChatGPT or Claude, or Post to Slack through your own webhook.
- Optional: "Tidy up with Chrome AI" rewrites the draft with the model built into Chrome (Gemini Nano), on your computer.

TRACKING IS OFF UNTIL YOU TURN IT ON
When you install Weekly, it asks "Track my week?". Say no and it is a task, notes and reminders app that records no browsing at all. Say yes and Chrome asks for permission to "Read your browsing history". From then on Weekly notes which tab you are working in and for how long, and groups it into tickets, merge requests, deals, candidates, support cases, SEO work, docs and meetings, so your update lists the work you did that never made it onto a task list.
- Only the active tab of the focused Chrome window, only while you are at the keyboard. Time stops when you go idle or lock your screen.
- It never reads page content, keystrokes or screenshots.
- "Hide people and customer names" turns candidates, customers and support cases into Candidate 1, Customer 2 before you paste the update anywhere.
- Turn tracking off again in Settings at any time.

MOVING FROM DAYBOOK OR FORGETMENOT
Daybook and ForgetMeNot are now part of Weekly. In Daybook, open Settings, then Export under Your data. In ForgetMeNot, open Settings, then Export under Backup. In Weekly, open Settings, then Import a backup under Your data, and choose the file. Weekly shows what the file holds before anything changes. Private ForgetMeNot notes ask for the PIN they were locked with.

YOUR DATA STAYS ON YOUR COMPUTER
- No account, no sign-up, no analytics, no ads, no servers of ours.
- Tasks and notes are kept until you delete them. Tracked activity is deleted after 90 days.
- Nothing leaves your computer unless you copy or post your update, export a backup, or turn on live Jira, GitLab or GitHub status.

LIMITS
A Chrome extension cannot see desktop apps (IDE, Slack desktop, the Zoom app); add a note for that work. The on-page note does not work on Chrome's own pages or the Chrome Web Store; there Alt+N opens the side panel's Notes tab instead.
```

## Permission justifications (for the reviewer)

Paste each into the matching field on the Privacy practices tab. The first eight are granted at install; none of them shows a warning about browsing history.

| Permission | Justification |
|---|---|
| `storage` | Saves tasks, notes, settings, saved draft edits and (if tracking is on) the activity log in `chrome.storage.local` on the user's computer, and the tab being timed and the reminder window's id in `chrome.storage.session`. Nothing is synced or sent anywhere. |
| `unlimitedStorage` | Tasks and notes are kept until the user deletes them, and the activity log keeps up to 90 days. This stops Chrome's default quota from silently stopping a save. Activity older than 90 days is purged automatically. |
| `idle` | When tracking is on, stops the timer when the user is away or the screen is locked (`chrome.idle.queryState`, `setDetectionInterval`), so time is not counted while nobody is working. Private notes also lock after 5 minutes without use. |
| `alarms` | One-shot alarms for the morning brief and evening check, recomputed from the local clock after each one so they stay right across daylight-saving changes, and a one-minute `tick` that keeps the tracking timer correct in a Manifest V3 service worker that Chrome stops when idle. |
| `notifications` | Shows the morning brief and evening check as a system notification, so a reminder is seen when Chrome is not the app in front. The user can turn the notification off in Settings and keep only the reminder window. Clicking it opens that window. |
| `sidePanel` | The toolbar icon opens Weekly in Chrome's side panel: today's tasks, notes and the week. Alt+T opens it from the keyboard. |
| `scripting` | Used only to add Weekly's own note panel to the page the user is on, when the user presses Alt+N or clicks "Note on this page" (`chrome.scripting.executeScript` with a file from the package). The panel shows and saves the user's own notes; it does not read the page. There are no content scripts that run by themselves. |
| `activeTab` | Gives `scripting` access to the current tab only, and only at the moment the user presses Alt+N or clicks "Note on this page". No host permission is needed for the on-page note. |
| `tabs` (optional) | Requested only when the user says yes to "Track my week?" on the welcome page or turns tracking on in Settings; Chrome shows its "Read your browsing history" prompt. Weekly then reads the URL and title of the active tab in the focused window (`chrome.tabs.query`, `onActivated`, `onUpdated`) to log which piece of work the user was on and for how long. Turning tracking off in Settings gives the permission back. Without it nothing is recorded. |
| `history` (optional) | Requested only when the user clicks "Fill in from history" (offered only with tracking on). Reads the last 15 days of local visit history (`chrome.history.search`, `getVisits`) to rebuild days the extension was not installed, with times estimated and marked ~. Visits synced from other devices are skipped. Nothing is sent anywhere. "Remove history estimates" deletes them and gives the permission back. |
| `https://*/*` (optional host permission) | Never granted at install. Used only to ask for access to one origin at a time, with Chrome's prompt, when the user opts in to: (1) live Jira status and GitLab or GitHub merge request state, fetched with the user's existing login from their own Jira or GitLab site (self-hosted domains cannot be listed in advance, which is why a wildcard pattern is needed), or (2) posting the draft to the user's own Slack incoming webhook on hooks.slack.com. Requests are made per origin (for example `https://acme.atlassian.net/*`); no other site is contacted. |

Notes for the reviewer: no `<all_urls>` at install, no content scripts declared in the manifest, no `webRequest`, no remote code, no `eval`. `downloads` is not requested: Export saves through a normal download link.

## Data usage disclosure (Privacy practices tab)

**Data types handled** (tick only these):
- **Web history**: only if the user turns tracking on: the URL, title and time spent for the active tab, plus (optional) Chrome history when the user fills in past days.
- **User activity**: only if the user turns tracking on: tab focus and idle state, used to time work. No keystrokes, clicks, mouse movement or scrolling.
- **Website content**: not collected. The on-page note is added to a page only when the user asks for it, and does not read the page.

**Not collected:** personally identifiable information, health, financial, authentication information (the extension never sees or stores passwords or tokens; Jira and GitLab lookups use the browser's own cookies and are not read by the extension), personal communications, location. Tasks and notes are text the user types into Weekly and are stored only on their computer.

**Certifications (tick all three):**
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Data handling statement:** all data stays in `chrome.storage.local` on the user's computer. Tracked activity is deleted after 90 days; tasks and notes are kept until the user deletes them. There are no servers operated by the developer. Data leaves the computer only on a user action: copying the draft, posting it to the user's Slack webhook, saving an export file, or (opt-in) asking the user's own Jira, GitLab or GitHub for status.

**Remote code:** No. All JavaScript ships inside the extension package. No eval, no remotely hosted scripts. The optional "Tidy up with Chrome AI" feature uses the on-device model built into Chrome; the first use may download that model through Chrome itself.

## Reviewer test instructions

```
No account or login is needed. Weekly works offline and has no backend.

1. Install the extension. A welcome page opens and asks "Track my week?". Either answer works; "No thanks" keeps tracking off. Then click "Open my report" (the other steps are optional).
2. Pin Weekly and click its toolbar icon: the side panel opens on Today. Type a task and press Enter. Tick it. Use the ... menu on a task to set a priority or a date.
3. Click "Open Weekly" in the panel: the calendar opens. Click today to see its sheet, with daily tasks, extra tasks and a note. "Stats" shows streaks and a year of days.
4. Notes: add a note in the panel's Notes tab. To try private notes, open Settings (on the report page), set a PIN under Notes PIN, then tick Private on a note. Lock hides its title and text.
5. On any normal web page (not a chrome:// page or the Web Store), press Alt+N: a small note panel opens on the page. A note written there appears in Weekly.
6. The week report (Week report in the app) shows the tasks done this week in a Done section and a draft update. Untick an item and the draft changes.
7. Tracking: if you said no on the welcome page, open Settings and turn tracking on; Chrome asks for "Read your browsing history". Browse a few sites for a minute or two with Chrome focused; the report then lists them. Pages visited for under 2 minutes are hidden by default; set "Hide visits shorter than (minutes)" to 0 to see them at once.
8. Reminders: in Settings, under Reminders, "Preview the check" opens the evening check window.
9. Settings, Your data: Export saves a file; Delete everything removes tasks, notes and activity.

Any Jira-style URL such as https://example.atlassian.net/browse/ABC-123 is grouped as ticket ABC-123 (the page need not load). All JS in the package is unminified.
```

## Assets in this folder

| Store field | File |
|---|---|
| Store icon (128x128) | `icon-128.png` (96x96 artwork with 16 px transparent padding, as required) |
| Screenshots (1280x800) | `screenshot-1-report.png`, `screenshot-2-panel.png`, `screenshot-3-calendar.png`, `screenshot-4-notes-dark.png`, `screenshot-5-stats-dark.png` |
| Small promo tile (440x280) | `promo-small-440x280.png` |
| Marquee promo tile (1400x560) | `promo-marquee-1400x560.png` |
| Privacy policy | `privacy-policy.html` (host publicly) |

Suggested screenshot captions: 1 Your week, written up. 2 Today's tasks in the side panel. 3 The month, shaded by what got done. 4 Notes, with a PIN for private ones (dark). 5 Which daily tasks stick (dark).

## Before you submit

- Package: `cd .. && npm run package && npm run e2e:zip` produces `dist/weekly-3.0.0.zip` with manifest.json at the zip root, and runs the end-to-end suite on that zip.
- Host the privacy policy (contact email and date are filled in; change the date if you submit on a later day).
- The `https://*/*` optional host permission may add review time; the justification above explains it. Be ready to show that no site is contacted until the user opts in.
- The screenshots show a fictional week (ENGX tickets, Acme Corp, Northwind, Contoso, Jane Doe, Marcus Lee); none is real data.
````

Run: `node --test test/store-assets.test.js`

Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 4: Check the copy by hand**

Run: `grep -c "—" store-assets/store-listing.md; grep -n -i -E "seamless|effortless|powerful|supercharge|unlock your|boost|revolution" store-assets/store-listing.md store-assets/privacy-policy.html`

Expected: `0`, then no matches (grep exits 1). Then read the detailed description once as a recruiter, once as an engineer: each should find their work named, and nothing should promise what the code does not do.

- [ ] **Step 5: Run the gates**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)" && npm run typecheck`

Expected: `# tests 330`, `# pass 330`, `# fail 0` in each timezone (326 + 4); typecheck clean.

Run: `TZ=America/New_York npm run e2e 2>&1 | grep -E "passed$|^FAIL"`

Expected: `269/269 passed`, `No tabs: 9/9 passed` (the manifest changed).

---

### Task 7: Store screenshots of the real 3.0 pages, light and dark

The old `generate.mjs` opens `popup.html`, which no longer exists, and its five pictures show Weekly 2: a tab log, a popup, the welcome page and history estimates. The new set shows what a 3.0 user sees, in five 1280×800 images (the store's maximum):

| File | Page | Theme |
|---|---|---|
| `screenshot-1-report.png` | the week report: Done first, then tracked work, and the draft | light |
| `screenshot-2-panel.png` | the side panel's Today tab, beside a caption | light |
| `screenshot-3-calendar.png` | the calendar with Friday's day sheet open | light |
| `screenshot-4-notes-dark.png` | the app's Notes, with a locked private note | dark |
| `screenshot-5-stats-dark.png` | Stats: streaks, a year of days, weekdays | dark |

The marquee tile showed the old report; it now shows the calendar shot and a subtitle for the merged product. The small tile has no screenshot and keeps its words ("Your week, written up.").

How the pictures stay honest and repeatable:
- The data is fictional and lives in `store-assets/demo-data.mjs`: a mixed working week (a renewal quote, a phone screen, a CSV export spec, Search Console errors, a QBR, a design take-home), four daily tasks ticked on most days for up to eleven months, notes in four categories, two day notes, and one private note. A unit test runs every task and note through Weekly's own `coerceTask`/`coerceNote` and requires them back unchanged, so the pictures show data the app could hold.
- Pages run on a fixed clock (`ctx.clock.setFixedTime`, the most recent Friday at 16:20), and everything is dated from that Friday. The service worker keeps real time, which only matters for writes the generator makes itself.
- The private note is sealed by the extension's own worker (`crypto:setPin`, `crypto:encrypt`, `crypto:lock` from an extension page, demo PIN `2580`), never by the generator.
- The generator's copy of the build has `tabs` granted (moved from optional to required in its manifest, as the end-to-end harness does), so the panel shows a tracked day. The build itself is not touched.
- Dark shots set `settings.theme = 'dark'`, the user's own setting, not an emulated media query.

**Files:**
- Create: `store-assets/demo-data.mjs`
- Modify: `store-assets/generate.mjs` (whole file), `store-assets/README.md`
- Delete: `store-assets/screenshot-2-anonymous.png`, `screenshot-3-welcome.png`, `screenshot-4-popup.png`, `screenshot-5-history.png`
- Regenerate: `store-assets/screenshot-1-report.png`, the four new screenshots, `promo-small-440x280.png`, `promo-marquee-1400x560.png`, `icon-128.png`
- Test: `test/store-assets.test.js`

**Interfaces:**
- Consumes: `addDays`, `fromISODate`, `toISODate` (`src/lib/dates.js`); `coerceTask` (`src/lib/schema.js`), `coerceNote` (`src/lib/note-views.js`); `listing` (Task 6); the worker's `crypto:setPin`, `crypto:encrypt` (`{ title, body }` → `{ ok, enc }`) and `crypto:lock` (Phase 4); the hash routes `#day=YYYY-MM-DD`, `#notes`, `#stats` (`src/ui/app/app.js`).
- Produces (`store-assets/demo-data.mjs`): `demoTasks(friday) → object[]` (stored task shape), `demoNotes(friday) → object[]` (plain notes), `PRIVATE_NOTE = { id, title, body, category }`, `DEMO_PIN = '2580'`.

- [ ] **Step 1: Write the demo data**

Create `store-assets/demo-data.mjs`:

```js
// The fictional week the store screenshots show. Everything is relative to `friday`
// (a local YYYY-MM-DD), so the pictures look the same whenever they are made.
// Names, companies and tickets are made up (Acme Corp, Northwind, Contoso, Jane Doe, ENGX).
import { addDays, fromISODate } from '../src/lib/dates.js';

const at = (iso, h, m = 0) => { const d = /** @type {Date} */ (fromISODate(iso)); d.setHours(h, m, 0, 0); return d.getTime(); };
const MON_FRI = [1, 2, 3, 4, 5];

// [title, priority, day offset from Monday (null = no date), done at [offset, hour] or null]
const ONE_OFFS = [
  ['Send the Acme Corp renewal quote', 'high', 0, [0, 15]],
  ['Phone screen: Jane Doe, Senior QA', 'medium', 1, [1, 11]],
  ['Write the ENGX-151 CSV export spec', 'high', 1, [2, 10]],
  ['Fix the coverage errors in Search Console', 'medium', 2, [2, 17]],
  ['Book the Northwind QBR', 'low', 2, [3, 9]],
  ['Review Marcus Lee’s design take-home', 'medium', 3, [3, 16]],
  ['Submit the September expense report', 'low', 1, null],
  ['Prepare the sprint demo', 'high', 4, [4, 12]],
  ['Reply to the Contoso pilot questions', 'medium', 4, null],
  ['Draft the Q4 hiring plan', 'medium', 4, null],
  ['Plan the Spring campaign landing page', 'low', 7, null],
  ['Read the March core update notes', 'low', null, null],
  ['Try the new Linear cycles view', 'low', null, null],
];

// Daily tasks, started up to eleven months back, ticked on most of their days.
const DAILY = [['Standup notes', 340], ['Check the support queue', 340], ['Review open merge requests', 250], ['Inbox to zero by 5', 90]];

/** Every Mon–Fri from `from` to `to`, skipping a few the way a real person does. */
const ticks = (from, to, seed) => {
  const out = [];
  for (let d = from, i = 0; d <= to; d = addDays(d, 1), i++) {
    const wd = fromISODate(d)?.getDay() ?? 0;
    if (wd === 0 || wd === 6) continue;
    if ((i * 7 + seed * 5) % 23 === 0 || (wd === 5 && (i + seed) % 5 === 0)) continue;
    out.push(d);
  }
  return out;
};

/** @param {string} friday @returns {object[]} tasks as Weekly stores them */
export function demoTasks(friday) {
  const mon = addDays(friday, -4);
  const daily = DAILY.map(([title, back], n) => {
    const from = addDays(mon, -back);
    // This week is a good one: every daily task done Monday to Thursday; today only standup so far.
    const past = ticks(from, addDays(mon, -1), n).concat([0, 1, 2, 3].map((o) => addDays(mon, o)));
    return { id: `demo-daily-${n}`, title, description: '', priority: 'medium', dueDate: null, status: 'open',
      createdAt: at(from, 9), updatedAt: at(friday, 9, 40), completedAt: null,
      repeat: { days: MON_FRI, from, until: null }, doneDates: n === 0 ? [...past, friday] : past };
  });
  const oneOffs = ONE_OFFS.map(([title, priority, off, done], n) => {
    const created = at(addDays(mon, -2), 18, n);
    const completedAt = done ? at(addDays(mon, done[0]), done[1], 10 + n) : null;
    return { id: `demo-task-${n}`, title, description: '', priority, dueDate: off === null ? null : addDays(mon, off),
      status: done ? 'done' : 'open', createdAt: created, updatedAt: completedAt ?? created, completedAt, repeat: null, doneDates: [] };
  });
  return [...daily, ...oneOffs];
}

/** @param {string} friday @returns {object[]} plain notes; the private one is sealed by the worker */
export function demoNotes(friday) {
  const mon = addDays(friday, -4);
  const note = (id, title, body, category, dayOff, extra = {}) => ({ id, title, body, category, pinned: false, done: false,
    createdAt: at(addDays(mon, dayOff), 14, 5), updatedAt: at(addDays(mon, dayOff), 14, 5), completedAt: null, day: null, enc: null, ...extra });
  return [
    note('demo-note-1', 'Northwind pricing call', 'They want annual billing and 20 seats from January. Send the revised quote by Tuesday.', 'Work', 1, { pinned: true }),
    note('demo-note-2', 'Senior QA loop', 'Jane: strong on API tests, light on mobile. Ask Marcus to cover the pairing round.', 'Work', 2),
    note('demo-note-3', 'Onboarding checklist for new SDRs', 'Shadow two discovery calls, CRM fields cheat sheet, first-week call targets.', 'Idea', 3),
    note('demo-note-4', 'Ahrefs study on AI overviews', 'Read before the content planning meeting.', 'To-Read', 0),
    note('demo-note-5', '', 'Onsite dry run for the Contoso pilot demo', 'Work', 2, { day: addDays(mon, 2) }),
    note('demo-note-6', '', 'Phone screens with two candidates', 'Work', 1, { day: addDays(mon, 1), done: true, completedAt: at(addDays(mon, 1), 17) }),
  ];
}

/** The private note: sealed by the worker under the demo PIN before it is stored. */
export const PRIVATE_NOTE = { id: 'demo-note-7', title: 'Salary review', body: 'Ask for the band review in the March cycle.', category: 'Personal' };
export const DEMO_PIN = '2580';
```

- [ ] **Step 2: Write the failing tests**

In `test/store-assets.test.js`, replace:

```js
import { readFileSync } from 'node:fs';
```

with:

```js
import { readFileSync, readdirSync } from 'node:fs';
import { coerceTask } from '../src/lib/schema.js';
import { coerceNote } from '../src/lib/note-views.js';
import { demoTasks, demoNotes } from '../store-assets/demo-data.mjs';
```

In `test/store-assets.test.js`, replace:

```js
  assert.match(listing, /Import a backup/);
});

```

with:

```js
  assert.match(listing, /Import a backup/);
});

/** Width, height and colour type from a PNG's IHDR chunk (colour type 2 is RGB, 6 is RGB with alpha). @param {string} file */
const png = (file) => {
  const b = readFileSync(new URL(`../store-assets/${file}`, import.meta.url));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: b[25] };
};

test('the screenshots are the five the listing names, each 1280x800 without alpha; the tiles are their sizes', () => {
  const named = [...listing.matchAll(/`(screenshot-[\w-]+\.png)`/g)].map((m) => m[1]);
  const files = readdirSync(new URL('../store-assets/', import.meta.url)).filter((f) => f.startsWith('screenshot-'));
  assert.deepEqual(files.sort(), [...new Set(named)].sort());
  assert.equal(files.length, 5);
  for (const f of files) assert.deepEqual(png(f), { w: 1280, h: 800, type: 2 }, f);
  assert.deepEqual(png('promo-small-440x280.png'), { w: 440, h: 280, type: 2 });
  assert.deepEqual(png('promo-marquee-1400x560.png'), { w: 1400, h: 560, type: 2 });
  assert.deepEqual([png('icon-128.png').w, png('icon-128.png').h], [128, 128]);
});

test('the screenshots’ demo week is what Weekly itself would store: every task and note comes back unchanged', () => {
  const friday = '2026-10-30';
  const tasks = demoTasks(friday);
  const notes = demoNotes(friday);
  for (const t of tasks) assert.deepEqual(coerceTask(t), t);
  for (const n of notes) assert.deepEqual(coerceNote(n), n);
  assert.ok(tasks.some((t) => t.repeat) && tasks.some((t) => t.status === 'done') && notes.some((n) => n.day));
});

```

- [ ] **Step 3: Run them to see the screenshot test fail**

Run: `node --test test/store-assets.test.js`

Expected: FAIL, `not ok 8 - the screenshots are the five the listing names, each 1280x800 without alpha; the tiles are their sizes` (the folder still holds Weekly 2's five). `ok 9 - the screenshots’ demo week is what Weekly itself would store…` passes already: the data was written first.

- [ ] **Step 4: Rewrite the generator, drop Weekly 2's pictures, update the folder's README**

Replace the whole of `store-assets/generate.mjs` with:

```js
// Regenerates the Chrome Web Store images by driving the real, built extension in Chromium.
// Usage: PLAYWRIGHT_PATH=<dir containing node_modules/playwright or the node_modules dir itself> \
//        CHROMIUM_PATH=<chromium binary> EXT_DIR=<built extension, e.g. ../dist/weekly> \
//        [OUT_DIR=<output dir>] [SCRATCH=<temp dir>] node generate.mjs
// Needs ffmpeg on PATH (downscales 2x captures and flattens to 24-bit PNG, no alpha).
// All data is fictional (demo-data.mjs) and seeded into a throwaway browser profile; nothing real is read.
// The pages' clock is set to the most recent Friday at 16:20, so every run shows the same kind of week.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { addDays, toISODate, fromISODate } from '../src/lib/dates.js';
import { demoTasks, demoNotes, PRIVATE_NOTE, DEMO_PIN } from './demo-data.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const need = k => process.env[k] || (console.error(`Set ${k}`), process.exit(1));
const pwPath = need('PLAYWRIGHT_PATH'), exe = need('CHROMIUM_PATH');
const EXT_SRC = path.resolve(need('EXT_DIR')), OUT = path.resolve(process.env.OUT_DIR || here);
const S = process.env.SCRATCH || fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-store-'));
const { chromium } = createRequire(pwPath.endsWith('node_modules') || pwPath.endsWith('node_modules/') ? pwPath + '/' : pwPath + '/node_modules/')('playwright');

const ext = path.join(S, 'ext'), raw = path.join(S, 'raw');
fs.rmSync(ext, { recursive: true, force: true }); fs.cpSync(EXT_SRC, ext, { recursive: true });
fs.mkdirSync(raw, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
// This copy has tracking on from the start (tabs granted), so the panel shows a tracked day.
const mf = path.join(ext, 'manifest.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8'));
m.permissions = [...new Set([...m.permissions, 'tabs'])];
m.optional_permissions = m.optional_permissions.filter(p => p !== 'tabs');
fs.writeFileSync(mf, JSON.stringify(m, null, 2));
const iconUri = 'data:image/png;base64,' + fs.readFileSync(path.join(ext, 'icons/128.png')).toString('base64');
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- the fictional week -------------------------------------------------------------------
const back = (new Date().getDay() + 2) % 7;   // days since the last Friday (0 on a Friday)
const FRIDAY = addDays(toISODate(), -back), MON = addDays(FRIDAY, -4);
const NOW = /** @type {Date} */ (fromISODate(FRIDAY)); NOW.setHours(16, 20, 0, 0);
// [category, key, task, url, minutes Mon..Fri, tickets]
const HUB = 'https://app.hubspot.com/contacts/42/record/0-3/';
const GH = 'https://app.greenhouse.io/people/';
const WEEK = [
  ['Tickets', 'jira:ENGX-142', 'ENGX-142: Fix session timeout on login', 'https://acme.atlassian.net/browse/ENGX-142', [95, 70, 40, 0, 25], ['ENGX-142']],
  ['Tickets', 'jira:ENGX-151', 'ENGX-151: Export report to CSV', 'https://acme.atlassian.net/browse/ENGX-151', [0, 45, 80, 95, 30], ['ENGX-151']],
  ['Merge requests', 'mr:acme/web!418', 'web !418: ENGX-142 fix session timeout', 'https://gitlab.com/acme/web/-/merge_requests/418', [20, 40, 0, 0, 10], ['ENGX-142']],
  ['Merge requests', 'mr:acme/web!421', 'web !421: ENGX-151 CSV export', 'https://gitlab.com/acme/web/-/merge_requests/421', [0, 0, 35, 50, 0], ['ENGX-151']],
  ['Sales & CRM', 'app:hubspot/777', 'Acme Corp renewal', HUB + '777', [40, 0, 70, 0, 45], []],
  ['Sales & CRM', 'app:hubspot/778', 'Northwind expansion', HUB + '778', [0, 55, 0, 40, 0], []],
  ['Recruiting & HR', 'app:greenhouse/9001', 'Jane Doe, Senior QA', GH + '9001', [0, 35, 0, 30, 0], []],
  ['SEO & marketing', 'app:gsc/perf', 'Performance on Search results', 'https://search.google.com/search-console/performance', [0, 25, 0, 45, 0], []],
  ['Docs & specs', 'doc:q4-launch', 'Q4 launch plan', 'https://docs.google.com/document/d/q4launch', [30, 0, 40, 0, 25], []],
  ['Meetings', 'meet:sprint', 'Sprint planning', 'https://meet.google.com/abc-defg-hij', [60, 0, 0, 0, 0], []],
  ['Meetings', 'meet:northwind', 'Northwind weekly sync', 'https://meet.google.com/klm-nopq-rst', [0, 50, 0, 0, 0], []],
];
const SETTINGS = { minMinutes: 5, paused: false, role: 'general', template: 'weekly', anonymize: false, theme: 'light' };

// Storage writes run inside the extension service worker, so this stays in step with the real format.
const seed = (sw) => sw.evaluate(async ({ WEEK, MON5, start, tasks, notes, settings }) => {
  await chrome.storage.local.clear();
  const out = { settings, tasks, notes, schemaVersion: 2 };
  MON5.forEach((iso, d) => {
    const day = {};
    for (const [category, key, task, url, mins, tickets] of WEEK) {
      if (!mins[d]) continue;
      const first = start[d] + 9 * 36e5 + (key.length % 7) * 18e5;
      day[key] = { category, task, url, ms: mins[d] * 60000, first, last: first + mins[d] * 60000, tickets };
    }
    out['day:' + iso] = day;
  });
  await chrome.storage.local.set(out);
}, { WEEK, MON5: [0, 1, 2, 3, 4].map(o => addDays(MON, o)), start: [0, 1, 2, 3, 4].map(o => fromISODate(addDays(MON, o))?.getTime()),
  tasks: demoTasks(FRIDAY), notes: demoNotes(FRIDAY), settings: SETTINGS });

// ---- image helpers --------------------------------------------------------------------------
// ffmpeg: optional downscale, always flatten to RGB so the PNG has no alpha channel.
const flatten = (src, dst, w, h) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src,
  '-vf', `scale=${w}:${h}:flags=lanczos,format=rgb24`, dst]);
const dataUri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const FONT = `--serif: Charter, "Iowan Old Style", Georgia, serif; --sans: system-ui, -apple-system, "Segoe UI", sans-serif;`;
const mark = t => `<span style="background:linear-gradient(transparent 58%,#f2cf45 58%,#f2cf45 90%,transparent 90%);padding:0 .08em">${t}</span>`;
const LIGHT = { bg: '#f6f4ee', ink: '#1c2333', muted: '#596071', rule: '#ddd8cb' };
const DARK = { bg: '#14171f', ink: '#e9e6dc', muted: '#a3a8b4', rule: '#2c3240' };

// Caption band above a real screenshot: 1280x800 canvas.
const bandPage = (head, sub, img, c = LIGHT) => `<style>:root{${FONT}} *{box-sizing:border-box;margin:0}
body{width:1280px;height:800px;background:${c.bg};color:${c.ink};overflow:hidden;position:relative}
.band{height:96px;padding:0 48px;display:flex;align-items:center;gap:20px;border-bottom:1px solid ${c.rule}}
.band img{width:44px;height:44px}
h1{font:600 34px/1.1 var(--serif);letter-spacing:-.01em}
p{font:15px/1.35 var(--sans);color:${c.muted};margin-left:auto;max-width:420px;text-align:right}
.shot{display:block;width:1280px;height:704px;object-fit:cover;object-position:top}</style>
<div class="band"><img src="${iconUri}" alt=""><h1>${head}</h1><p>${sub}</p></div><img class="shot" src="${img}" alt="">`;

// The side panel beside its caption: Chrome draws it at the right of the window, about 400 px wide.
const panelPage = img => `<style>:root{${FONT}} *{box-sizing:border-box;margin:0}
body{width:1280px;height:800px;background:${LIGHT.bg};color:${LIGHT.ink};display:flex;align-items:center;justify-content:center;gap:96px;overflow:hidden}
.pane{width:361px;height:740px;border:1px solid #8f8a7c;border-radius:10px;box-shadow:0 18px 50px rgba(28,35,51,.22);object-fit:cover;object-position:top}
.cap{width:470px}.cap img{width:56px;height:56px;margin-bottom:22px}
h1{font:600 46px/1.1 var(--serif);letter-spacing:-.01em;margin-bottom:18px}
p{font:18px/1.5 var(--sans);color:${LIGHT.muted}}p+p{margin-top:12px}</style>
<div class="cap"><img src="${iconUri}" alt=""><h1>Today, in the ${mark('side panel')}.</h1>
<p>Click the toolbar icon. Add a task in one line, tick it off, and move what is left to tomorrow.</p>
<p>Tracking is off until you turn it on. When it is on, it keeps tab addresses, titles and time, on this computer only.</p></div>
<img class="pane" src="${img}" alt="">`;

const TILE_CSS = `:root{${FONT}} *{box-sizing:border-box;margin:0}
body{background:#f6f4ee;color:#1c2333;overflow:hidden;position:relative;font-family:var(--serif)}
.t{font-weight:600;letter-spacing:-.01em}.sw{background:linear-gradient(transparent 56%,#f2cf45 56%,#f2cf45 92%,transparent 92%);padding:0 .06em}`;
const smallTile = `<style>${TILE_CSS}
body{width:440px;height:280px;padding:38px 36px}
img.i{width:76px;height:76px;display:block;margin-bottom:22px}
.n{font-size:44px;line-height:1}.tag{font-size:32px;line-height:1.15;margin-top:14px}</style>
<img class="i" src="${iconUri}" alt=""><div class="t n">Weekly</div><div class="t tag">Your week,<br><span class="sw">written up.</span></div>`;
const marqueeTile = img => `<style>${TILE_CSS}
body{width:1400px;height:560px;padding:76px 80px}
img.i{width:120px;height:120px;display:block;margin-bottom:30px}
.n{font-size:76px;line-height:1}.tag{font-size:58px;line-height:1.1;margin-top:18px}
.sub{font:22px/1.45 system-ui,-apple-system,sans-serif;color:#596071;margin-top:26px;max-width:560px}
.shot{position:absolute;left:760px;top:72px;width:760px;border:1px solid #8f8a7c;border-radius:8px;box-shadow:0 20px 50px rgba(28,35,51,.25);transform:rotate(1.2deg)}</style>
<img class="i" src="${iconUri}" alt=""><div class="t n">Weekly</div><div class="t tag">Your week, <span class="sw">written up.</span></div>
<div class="sub">Tasks, reminders and notes for the working week, and a draft of your weekly update. Stays on your computer.</div>
<img class="shot" src="${img}" alt="">`;

// ---- run ------------------------------------------------------------------------------------
const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: exe, deviceScaleFactor: 2,
  viewport: { width: 1280, height: 704 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const X = `chrome-extension://${sw.url().split('/')[2]}`;
for (const p of ctx.pages()) if (p.url().includes('welcome.html')) await p.close();
await ctx.clock.setFixedTime(NOW);
const P = { report: 'src/ui/report/report.html', panel: 'src/ui/panel/panel.html', app: 'src/ui/app/app.html' };
const open = async (file, w, h) => { const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: h }); await p.goto(`${X}/${file}`); await wait(900); return p; };
const out = (name, w, h, src) => { flatten(src, path.join(OUT, name), w, h); console.log('wrote', name); };
const compose = async (html, name, w, h) => {
  const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: h });
  await p.setContent(html); await wait(300);
  const f = path.join(raw, name); await p.screenshot({ path: f }); await p.close(); out(name, w, h, f);
};
const shot = async (p, name) => { const f = path.join(raw, name); await p.screenshot({ path: f }); await p.close(); return f; };
const theme = (t) => sw.evaluate(async (t) => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, theme: t } }); }, t);

await seed(sw);
// The private note goes through the worker's own PIN code, as one written in Weekly would; then it is locked.
{
  const p = await open(P.report, 1280, 704);
  const enc = await p.evaluate(async ({ pin, n }) => {
    await chrome.runtime.sendMessage({ type: 'crypto:setPin', pin });
    const r = await chrome.runtime.sendMessage({ type: 'crypto:encrypt', title: n.title, body: n.body });
    await chrome.runtime.sendMessage({ type: 'crypto:lock' });
    return r.enc;
  }, { pin: DEMO_PIN, n: PRIVATE_NOTE });
  const at = NOW.getTime() - 2 * 864e5;
  await sw.evaluate(async (n) => { const { notes } = await chrome.storage.local.get('notes'); await chrome.storage.local.set({ notes: [...notes, n] }); },
    { id: PRIVATE_NOTE.id, title: '', body: '', category: PRIVATE_NOTE.category, pinned: false, done: false, createdAt: at, updatedAt: at, completedAt: null, day: null, enc });
  await p.close();
}

// 1: the week report, Done first, light
{
  const f = await shot(await open(P.report, 1280, 704), '1-report.png');
  await compose(bandPage(`Your week, ${mark('written up')}.`, 'What you finished leads the update, then the work Weekly saw. Untick anything, then copy.', dataUri(f)), 'screenshot-1-report.png', 1280, 800);
}
// 2: the side panel's Today tab, with a tab being tracked
{
  const p = await open(P.panel, 400, 820);
  await sw.evaluate((start) => chrome.storage.session.set({ current: { tabId: 1, url: 'https://acme.atlassian.net/browse/ENGX-151', title: 'ENGX-151: Export report to CSV - Jira', start } }), NOW.getTime() - 12 * 60000);
  await wait(500);
  await compose(panelPage(dataUri(await shot(p, '2-panel.png'))), 'screenshot-2-panel.png', 1280, 800);
}
// 3: the calendar with today's sheet open, light
{
  const f = await shot(await open(`${P.app}#day=${FRIDAY}`, 1280, 704), '3-calendar.png');
  await compose(bandPage(`Plan the month, ${mark('one day')} at a time.`, 'Each day is shaded by how much got done. Click a day for its daily tasks, extra tasks and notes.', dataUri(f)), 'screenshot-3-calendar.png', 1280, 800);
}
// 4 + 5: notes and stats, dark
await theme('dark');
{
  const f = await shot(await open(`${P.app}#notes`, 1280, 704), '4-notes.png');
  await compose(bandPage('Notes, with a PIN for the private ones.', 'Private notes are encrypted on this computer. They never reach your update.', dataUri(f), DARK), 'screenshot-4-notes-dark.png', 1280, 800);
  const g = await shot(await open(`${P.app}#stats`, 1280, 704), '5-stats.png');
  await compose(bandPage('See which daily tasks stick.', 'Streaks, a year of days, each weekday, and how often each daily task gets done.', dataUri(g), DARK), 'screenshot-5-stats-dark.png', 1280, 800);
}

// promo tiles (the marquee uses the calendar as its backdrop)
await compose(smallTile, 'promo-small-440x280.png', 440, 280);
await compose(marqueeTile(dataUri(path.join(raw, '3-calendar.png'))), 'promo-marquee-1400x560.png', 1400, 560);
fs.copyFileSync(path.join(ext, 'icons/128.png'), path.join(OUT, 'icon-128.png'));
await ctx.close();
console.log('done');
```

In `store-assets/README.md`, replace:

```markdown
| `screenshot-1-report.png` | 1280x800 | Report with a full week and draft |
| `screenshot-2-anonymous.png` | 1280x800 | "Hide people and customer names" on |
| `screenshot-3-welcome.png` | 1280x800 | First-run welcome page |
| `screenshot-4-popup.png` | 1280x800 | Toolbar popup on a paper canvas |
| `screenshot-5-history.png` | 1280x800 | History-filled week, estimates marked ~ |
```

with:

```markdown
| `screenshot-1-report.png` | 1280x800 | Week report: Done section first, then tracked work, and the draft |
| `screenshot-2-panel.png` | 1280x800 | Side panel, Today tab, beside its caption |
| `screenshot-3-calendar.png` | 1280x800 | Calendar with Friday's day sheet open |
| `screenshot-4-notes-dark.png` | 1280x800 | Notes in the app, dark, with a locked private note |
| `screenshot-5-stats-dark.png` | 1280x800 | Stats, dark: streaks, a year of days, weekdays |
```

In `store-assets/README.md`, replace:

```markdown
| `privacy-policy.html` | | Standalone policy. Host at a public URL (contact: srewoo@gmail.com, dated 31 October 2026) |
| `generate.mjs` | | Regenerates all PNGs |
```

with:

```markdown
| `privacy-policy.html` | | Standalone policy. Host at a public URL (contact: srewoo@gmail.com, dated 1 November 2026) |
| `generate.mjs` | | Regenerates all PNGs |
| `demo-data.mjs` | | The fictional tasks and notes in the screenshots |
```

In `store-assets/README.md`, replace:

```markdown
Optional: `OUT_DIR` (default: this folder), `SCRATCH` (temp dir; default is a new one under the OS temp dir). The script copies the extension to the scratch dir and loads that copy; it never writes to the source tree.

Edit the `WEEK` table in `generate.mjs` to change the fictional data. Check dimensions with `sips -g pixelWidth -g pixelHeight -g hasAlpha *.png`.
```

with:

```markdown
The pages' clock is set to the most recent Friday at 16:20, and the tasks, notes and tracked week are dated from it, so the pictures show the same kind of week whenever they are made. The private note is sealed by the extension's own PIN code (demo PIN `2580`) and left locked. Screenshots 4 and 5 use the dark theme (`theme: 'dark'` in settings), not an emulated colour scheme.

Optional: `OUT_DIR` (default: this folder), `SCRATCH` (temp dir; default is a new one under the OS temp dir). The script copies the extension to the scratch dir and loads that copy; it never writes to the source tree.

Edit `demo-data.mjs` (tasks and notes) or the `WEEK` table in `generate.mjs` (tracked time) to change the fictional data. `npm test` checks that the demo data is what Weekly would store and that every image has the size the store wants.
```

Delete `store-assets/screenshot-2-anonymous.png`.

Delete `store-assets/screenshot-3-welcome.png`.

Delete `store-assets/screenshot-4-popup.png`.

Delete `store-assets/screenshot-5-history.png`.

- [ ] **Step 5: Make the images**

Run: `npm run build >/dev/null && cd store-assets && PLAYWRIGHT_PATH=/Users/sharajrewoo/.npm/_npx/9833c18b2d85bc59/node_modules CHROMIUM_PATH="$(ls -d ~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/*.app/Contents/MacOS/* | tail -1)" EXT_DIR=../dist/weekly node generate.mjs`

Expected: `wrote screenshot-1-report.png`, `wrote screenshot-2-panel.png`, `wrote screenshot-3-calendar.png`, `wrote screenshot-4-notes-dark.png`, `wrote screenshot-5-stats-dark.png`, `wrote promo-small-440x280.png`, `wrote promo-marquee-1400x560.png`, `done`. Headless Chromium, about 30 seconds; nothing opens on the desktop. `ffmpeg` must be on PATH. If the newest Playwright Chromium folder has no binary, set `CHROMIUM_PATH` to the one `test/e2e/run.mjs` finds.

Run: `node --test test/store-assets.test.js`

Expected: `# pass 9`, `# fail 0`.

- [ ] **Step 6: Look at every image**

Open each PNG in `store-assets/` with the Read tool (it shows images) and check:
- 1: the report says "This week", Mon to Fri with hours, a **Done** list (11 tasks, the four daily tasks with "(n of 5 days)") and the draft opening with `### Done`.
- 2: the panel shows Overdue (1), Today (7, the four daily tasks first, two ticked) and No date, and the footer shows time tracked today and "Now: ENGX-151…".
- 3: the calendar's month is shaded, with Friday's sheet open (daily tasks, extra tasks, Notes).
- 4 (dark): notes listed with "Private note · Personal · Locked" among them, no private title or text visible, and the 7-day insights.
- 5 (dark): six figures, the year of days with one month name per label (no "OctNov"), weekday bars.
- Tiles: the small tile's words, the marquee's calendar backdrop and subtitle.

No real names, accounts or URLs belong in any image. If a picture is cut off or empty, fix `generate.mjs` (viewport or wait) and run Step 5 again; do not edit the images.

- [ ] **Step 7: Run the gates**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)" && npm run typecheck`

Expected: `# tests 332`, `# pass 332`, `# fail 0` in each timezone (330 + 2); typecheck clean. No end-to-end run: nothing in the package changed.

---

### Task 8: The parity gate: every checklist row points at the check that proves it

The parity checklist's Definition of done is "every row is ✅, verified by a unit test or an end-to-end check named in the phase's plan". Until now that was true only by reading each plan's self-review. `test/parity-proofs.mjs` names, for each of the 35 rows (D1–D14, F1–F8, L1–L10, W1–W3), the unit tests and end-to-end checks that prove it, by their exact names. `scripts/parity.mjs` reads the checklist itself, so a row added to the spec later fails the gate until someone names its proof. It fails when:
- a row has no proof;
- a unit proof is not a `test('…')` in its file (`npm test`, run first in the gate, proves the ones that exist pass);
- an end-to-end proof did not pass in the last run (`.e2e/results.json` and `.e2e/no-tabs/results.json`, written by `npm run e2e` and `npm run e2e:zip`);
- the map names a row the checklist does not have.

**Files:**
- Create: `test/parity-proofs.mjs`, `scripts/parity.mjs`
- Modify: `package.json` (scripts `parity`, `release:check`), `README.md`

**Interfaces:**
- Consumes: the checklist rows of `docs/superpowers/specs/2026-10-31-weekly-feature-parity.md` (`| D1 | … |`, `| D14 + | … |`); the end-to-end results files, each `{ area, name, ok }[]`; the unit test names in `test/**/*.test.js`.
- Produces: `PROOFS: Record<string, ({ file, unit } | { e2e })[]>` (`test/parity-proofs.mjs`; `e2e` is `"[Area] name"` exactly as the run prints it); `node scripts/parity.mjs [checklist.md]` prints one `ok`/`FAIL` line per row, `not proved: …` under a failing one, and `Parity: N/M rows proved (K end-to-end checks read)`, exiting 1 on any failure. `npm run release:check` = `npm run package && npm run e2e:zip && npm run parity`.

- [ ] **Step 1: Name the proofs**

Create `test/parity-proofs.mjs`:

```js
// Every row of the feature-parity checklist (docs/superpowers/specs/2026-10-31-weekly-feature-parity.md)
// and the checks that prove it. scripts/parity.mjs reads this: a unit proof must exist in its file,
// an end-to-end proof must have passed in the last end-to-end run. Names are copied exactly.

/** @param {string} file @param {string} name */
const u = (file, name) => ({ file: `test/${file}`, unit: name });
/** @param {string} name "[Area] check name", as the end-to-end run prints it */
const e = (name) => ({ e2e: name });

export const PROOFS = {
  // ---- Daybook ----
  D1: [u('schema.test.js', 'coerceTask fills the derived fields for a minimal record'),
    e('[Panel tasks] priority from the ⋯ menu'), e('[Panel tasks] due date from the ⋯ menu; a past day lands in Overdue'),
    e('[Tasks] edit title, description and priority (D5)')],
  D2: [e('[Panel tasks] quick add with Enter: due today, default priority (D2)'), e('[Tasks] one-line add in the app (D2)')],
  D3: [e('[Tasks] Tasks view with Daybook’s views and counts (D3)'), e('[Tasks] Week: a rolling 7 days of day bands, later days collapsed (D3)'),
    e('[Tasks] opening a day band is remembered (uiState)'), u('tasks-week.test.js', 'the window is today plus the following six days')],
  D4: [e('[Tasks] search filters by title (D4)'), e('[Tasks] priority filter (D4)'), e('[Tasks] search covers descriptions (D4)')],
  D5: [e('[Tasks] edit title, description and priority (D5)'), e('[Tasks] delete (D5)'), e('[Panel tasks] delete from the ⋯ menu (D5)')],
  D6: [e('[Panel tasks] Undo in the toast reopens it (D6)'), e('[Panel tasks] ⌘Z / Ctrl+Z undoes the last tick (D6)'),
    e('[Panel tasks] Undo restores the deleted task, same id (D6)'), e('[Tasks] ⌘Z / Ctrl+Z undoes a delete (D6)')],
  D7: [e('[Panel tasks] Move to tomorrow, one task (D7)'), e('[Panel tasks] Move all to tomorrow (D7)'),
    e('[Reminder] Move to tomorrow on one task (D7)'), e('[Reminder] Move all to tomorrow (D7)')],
  D8: [e('[Reminders] one-shot alarms at 09:00 and 18:00, no repeat period (D8)'), e('[Settings] reminder times, working days and notification saved (D8)'),
    u('background/reminders.test.js', 'DST spring forward (8 Mar 2026 in New York): the next brief is still 09:00 local'),
    u('background/reminders.test.js', 'DST fall back (1 Nov 2026 in New York): the evening check is still 18:00 local')],
  D9: [e('[Reminders] the morning brief reuses the same window (D9)'), e('[Reminders] with a system notification (D9)'),
    e('[Reminders] the notification goes with the window: none is left in the notification centre (Phase 3 m2)'),
    u('background/service-worker.test.js', 'a browser start catches up a check whose time has passed (D9)')],
  D10: [e('[Keys] N focuses the add box (panel)'), e('[Keys] / focuses search (app)'), e('[Keys] O in the side panel opens the full app'),
    e('[Keys] Esc closes the day sheet (L9)'), e('[Commands] Alt+T opens the side panel and Alt+Shift+T the app: both registered (D10)'),
    u('manifest.test.js', 'commands: Alt+T opens the side panel, Alt+Shift+T the app (spec D10)')],
  D11: [e('[Data] export carries tasks and settings, but never the Slack webhook (F7)'), e('[Import] Add brings its tasks in, done and due dates kept (D11)'),
    e('[Import] Replace with a Daybook backup swaps the tasks for the file’s and leaves notes alone (D11)'), e('[Data] broken file rejected with a clear message'),
    u('backup.test.js', 'a Daybook backup, made by Daybook’s own export, is read as tasks; a bare array works too')],
  D12: [u('schema-v2.test.js', 'migrate v1 → v2 backfills repeat and doneDates and reports the change'),
    u('schema.test.js', 'migrate lifts unversioned v0 data and reports the change')],
  D13: [u('manifest.test.js', 'extension pages run only our own scripts: explicit CSP (spec D13)')],
  D14: [u('uistate.test.js', 'a day the user closed is still closed on the next read'),
    u('storage.test.js', 'concurrent creates all survive — no lost update'), u('tasks.test.js', 'overdue is open + dated + before today')],
  // ---- ForgetMeNot ----
  F1: [e('[Notes] quick add: title, body and category (F1)'), e('[Notes] category filter (F1)'),
    u('notes.test.js', 'createNote stores ForgetMeNot’s fields plus day, trimmed; blank notes are not stored')],
  F2: [e('[Notes] search covers the body (F2)'), e('[Notes] pin puts a note first (F2)'), e('[Notes] mark done (F2)'),
    e('[Notes] edit title and category (F2)'), e('[Notes] delete, then Undo brings it back with its id (F2)'), e('[Private] a locked note is not found by search (F2)')],
  F3: [e('[PIN] set a PIN: a salt and verifier are stored, never the PIN (F3)'), e('[PIN] change PIN re-encrypts private notes (F3)'),
    e('[PIN] the old PIN fails; 5 wrong PINs pause unlocking for 30 s (F3)'), e('[PIN] remove PIN: private notes become ordinary ones and the record is gone (F3)'),
    e('[Private] a private note is ciphertext at rest: no title or body anywhere in storage (F3)'),
    u('background/crypto-broker.test.js', 'the key is dropped on lock, after 5 idle minutes, and when the worker restarts'),
    u('crypto.test.js', 'lockout: 5 failures → 30 s, then 1 m, 5 m, 15 m; success resets (F3)')],
  F4: [e('[On-page] Alt+N is registered for the on-page note (F4)'), e('[On-page] "Note on this page" opens a floating note in a closed Shadow DOM (F4)'),
    e('[On-page] where Weekly may not run, the panel opens its Notes tab instead (F4 fallback)'),
    u('background/service-worker.test.js', 'Alt+N on a web page injects the on-page note at once, inside the command’s gesture (F4)')],
  F5: [e('[Notes] 7-day insights: today’s notes created and done (F5)'), u('note-views.test.js', 'insights: seven local days of notes created and done, oldest first (F5)')],
  F6: [e('[Theme] Settings offers the computer’s choice, Light or Dark; the computer’s by default (F6)'),
    e('[Theme] Dark applies to the report at once, whatever the computer uses (F6)'), e('[Theme] the side panel follows without a reload, and the app opens dark (F6)'),
    u('settings.test.js', 'theme: light, dark or system (F6); system by default, anything else falls back to it')],
  F7: [e('[Data] export carries the PIN record (a salt and check value, never the PIN) and private notes as ciphertext (F7)'),
    e('[Import] a ForgetMeNot export asks for the PIN its private note was locked with (F7)'),
    e('[Import] the right PIN brings its notes in; the private one is sealed again, title inside, under its PIN (F7, F8)'),
    e('[Import] Replace with a ForgetMeNot export: the notes become the file’s and its PIN wins (F7)')],
  F8: [e('[Private] Lock hides the title as well as the body (F8)'), u('notes.test.js', 'a private note never stores its title or body in plain text')],
  // ---- dailies.html ----
  L1: [e('[Day sheet] add a daily recurring task, counted from today (L1)'), e('[Panel tasks] Today band lists daily tasks first (L1)'),
    u('recurrence.test.js', 'occursOn honours weekdays, from and until, inclusive')],
  L2: [e('[Day sheet] add an extra task for this day (L2)'), e('[Day sheet] move an extra task to another day (L2)'), e('[Day sheet] copy an extra task to another day, unticked (L2)')],
  L3: [e('[Day sheet] note slot: a note for this day (L3)'), u('note-views.test.js', 'day notes: untitled, plain notes of that day, oldest first')],
  L4: [e('[Calendar] month grid starts on Monday, today ringed'), e('[Calendar] next month: every day is muted as future (L4)'),
    e('[Calendar] today is shaded once something is ticked (L4)'), e('[Keys] ← → change month, T jumps to today (L9)'),
    u('planner.test.js', 'monthGrid starts on Monday and shades past days, today only once ticked, never the future')],
  L5: [e('[Day sheet] clicking a day opens its sheet (L5)'), e('[Day sheet] tick a daily task for this day (L5)')],
  L6: [e('[Daily tasks] Stop repeating keeps its history and moves it to Stopped (L6)'), e('[Daily tasks] Repeat again brings it back (L6)'),
    e('[Daily tasks] Delete for good removes it and its ticks; Undo puts it back whole (L6)'),
    u('tasks-recurring.test.js', 'archive stops a recurring task yesterday and keeps its history; restore reopens it')],
  L7: [e('[Stats] #stats opens the Stats view with six figures (L7)'), e('[Stats] a year of days: 365 squares ending today, months labelled (L7)'),
    e('[Stats] weekday bars run Monday to Sunday (L7)'), e('[Stats] per-task rate counts the days it was due: 10 of 21, 48% (L7)'),
    u('stats.test.js', 'streaks run across New Year and skip weekends, which have nothing on them')],
  L8: [e('[Theme] the computer’s choice follows it, dark then light (L8)'), e('[Layout] dark mode applies')],
  L9: [e('[Keys] Esc closes the day sheet (L9)'), e('[Keys] ← → change month, T jumps to today (L9)')],
  L10: [e('[Rollover] an open panel moves to the new day on focus (L10)')],
  // ---- Weekly ----
  W1: [e('[Tracking] records the active tab (Jira ≈ 6 s)'), e('[Report] summary counts tickets, MRs and CRM records'), e('[Draft] edit survives a page reload'),
    e('[AI] system prompt uses the chosen role'), e('[Report] live Jira status fetched'), e('[History] fill reports one day filled'),
    e('[Trends] 8 weeks shown, this week has time and switches'), e('[Data] import from another device'), e('[Panel] note added with Enter')],
  W2: [e('[Done] draft opens with a Done section: one-offs, then recurring with its count (W2)'), e('[Notes] day notes are the update’s Other work (W2)'),
    e('[Private] a private day note never reaches Other work or the draft (W2)')],
  W3: [e('[No tabs] the install asks for no tabs permission, and Chrome has not granted it (W3, spec §3.6)'),
    e('[Welcome] "Track my week?" comes first; yes turns tracking on and offers the history fill (W3)'), e('[No tabs] "No thanks" leaves tracking off and says so'),
    u('manifest.test.js', 'tabs is optional: the install asks for no browsing-history warning; Weekly asks when you turn tracking on (W3, spec §3.6)')],
};
```

- [ ] **Step 2: Write the gate**

Create `scripts/parity.mjs`:

```js
// The parity gate. The feature-parity checklist is done when every row is proved by a unit test
// or an end-to-end check (its "Definition of done"). For each row this prints the proofs from
// test/parity-proofs.mjs and fails when a row has none, a unit test named there is not in its
// file, or an end-to-end check named there did not pass in the last `npm run e2e` / `npm run e2e:zip`.
// Run it after both: `npm test` proves the unit tests pass, the end-to-end results are read here.
// Usage: node scripts/parity.mjs [checklist.md]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROOFS } from '../test/parity-proofs.mjs';

const root = new URL('..', import.meta.url).pathname;
const spec = process.argv[2] ?? join(root, 'docs/superpowers/specs/2026-10-31-weekly-feature-parity.md');
const rows = [...readFileSync(spec, 'utf8').matchAll(/^\|\s*([A-Z]\d+)\b[^|]*\|\s*([^|]+?)\s*\|/gm)].map(([, id, feature]) => ({ id, feature }));

const results = ['.e2e/results.json', '.e2e/no-tabs/results.json'].map((f) => join(root, f));
if (!results.every((f) => existsSync(f))) {
  console.error('No end-to-end results. Run npm run e2e (or npm run e2e:zip) first.');
  process.exit(1);
}
/** @type {{ area: string, name: string, ok: boolean }[]} */
const checks = results.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const passed = new Set(checks.filter((c) => c.ok).map((c) => `[${c.area}] ${c.name}`));
/** @param {string} file @param {string} name */
const unitExists = (file, name) => existsSync(join(root, file))
  && ["'", '"', '`'].some((q) => readFileSync(join(root, file), 'utf8').includes(`test(${q}${name}${q}`));
/** @param {{ e2e?: string, file?: string, unit?: string }} p */
const proved = (p) => (p.e2e ? passed.has(p.e2e) : unitExists(p.file ?? '', p.unit ?? ''));
/** @param {{ e2e?: string, file?: string, unit?: string }} p */
const label = (p) => (p.e2e ? `e2e ${p.e2e}` : `unit ${p.file}: ${p.unit}`);

let bad = 0;
for (const { id, feature } of rows) {
  const proofs = /** @type {Record<string, object[]>} */ (PROOFS)[id] ?? [];
  const missing = proofs.filter((p) => !proved(p));
  if (!proofs.length || missing.length) bad++;
  console.log(`${!proofs.length || missing.length ? 'FAIL' : 'ok  '} ${id.padEnd(4)} ${feature.slice(0, 70)}`);
  if (!proofs.length) console.log('       no proof named for this row');
  for (const p of missing) console.log(`       not proved: ${label(p)}`);
}
const stale = Object.keys(PROOFS).filter((id) => !rows.some((r) => r.id === id));
for (const id of stale) console.log(`FAIL ${id.padEnd(4)} has proofs but is not a row of the checklist`);
console.log(`\nParity: ${rows.length - bad}/${rows.length} rows proved (${checks.length} end-to-end checks read)`);
process.exit(bad || stale.length ? 1 : 0);
```

- [ ] **Step 3: See the gate fail on a row nobody proved**

Run: `(cat docs/superpowers/specs/2026-10-31-weekly-feature-parity.md; echo '| X1 | A row nobody proved | 6 |') > .e2e/parity-gap.md && node scripts/parity.mjs .e2e/parity-gap.md; echo "exit $?"`

Expected: the 35 real rows `ok`, then `FAIL X1   A row nobody proved`, `no proof named for this row`, `Parity: 35/36 rows proved (278 end-to-end checks read)`, `exit 1`. (It reads the results of the end-to-end run Task 6 left in `.e2e/`: 269 + 9 checks.)

- [ ] **Step 4: See it pass on the real checklist**

Run: `rm .e2e/parity-gap.md && node scripts/parity.mjs > .e2e/parity.log; echo "exit $?"; tail -2 .e2e/parity.log`

Expected: `exit 0`, a blank line, `Parity: 35/35 rows proved (278 end-to-end checks read)`; `.e2e/parity.log` has 35 `ok` lines. If a line says `not proved: e2e […]`, the check either failed in the last run or has another name in this tree: find it in `.e2e/results.json` and copy the exact name into `test/parity-proofs.mjs`. Never delete a proof to make a row pass; a row needs at least one.

- [ ] **Step 5: Wire it into the release scripts and the README**

In `package.json`, replace:

```json
    "package": "npm test && npm run typecheck && npm run zip"
```

with:

```json
    "package": "npm test && npm run typecheck && npm run zip",
    "parity": "node scripts/parity.mjs",
    "release:check": "npm run package && npm run e2e:zip && npm run parity"
```

In `README.md`, replace:

```markdown
| `npm run package` | Tests, typecheck, build and zip in one go. Use this for releases |

```

with:

```markdown
| `npm run package` | Tests, typecheck, build and zip in one go. Use this for releases |
| `npm run parity` | Walks the feature-parity checklist: every row must name a unit test that exists or an end-to-end check that passed in the last run (`test/parity-proofs.mjs`) |
| `npm run release:check` | `package`, then `e2e:zip`, then `parity`: the release gate |

```

In `README.md`, replace:

```markdown
test/              node:test, no browser required; test/e2e drives real Chromium
```

with:

```markdown
test/              node:test, no browser required; test/e2e drives real Chromium; parity-proofs.mjs names the proof of each parity row
scripts/           build.mjs, zip.mjs, parity.mjs (the parity gate)
store-assets/      Chrome Web Store text, privacy policy, screenshots and promo tiles (generate.mjs remakes the images)
```

In `README.md`, replace:

```markdown
To release: bump `version` in `package.json` and `manifest.json` (e.g. `npm version patch --no-git-tag-version`, then the same number in `manifest.json`; a unit test fails while they differ), then `npm run package && npm run e2e:zip`. The store text, privacy policy and screenshots are in `store-assets/`; its README says how to remake the screenshots.
```

with:

```markdown
To release: bump `version` in `package.json` and `manifest.json` (e.g. `npm version patch --no-git-tag-version`, then the same number in `manifest.json`; a unit test fails while they differ), then `npm run release:check`. The store text, privacy policy and screenshots are in `store-assets/`; its README says how to remake the screenshots.
```

- [ ] **Step 6: Run the gates**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)" && npm run typecheck && npm run parity > .e2e/parity.log && tail -1 .e2e/parity.log`

Expected: `# tests 332`, `# pass 332`, `# fail 0` in each timezone (no change: `parity-proofs.mjs` is not a test file); typecheck clean; `Parity: 35/35 rows proved (278 end-to-end checks read)`.

---

### Task 9: The release gate, on the zip that goes to the store

**Files:** none changed. This task proves the release.

- [ ] **Step 1: Check sizes, layering and what the zip carries**

Run: `wc -l src/background/reminders.js src/lib/stats.js src/ui/components/pin-dialog.js scripts/parity.mjs store-assets/generate.mjs && (grep -rnE 'storage\.sync' src || echo 'no storage.sync') && npm run zip >/dev/null && unzip -l dist/weekly-3.0.0.zip | tail -1 && (unzip -l dist/weekly-3.0.0.zip | grep -E " (test|docs|store-assets|scripts|snapshots)/" || echo 'only the extension is packed')`

Expected: `reminders.js` 144, `stats.js` 131, `pin-dialog.js` 50, `parity.mjs` 43, `generate.mjs` 189; `no storage.sync`; `90 files`; `only the extension is packed`. The largest file in `src/` is still `crypto-broker.js` (252); `test/e2e/full.mjs` is still the one file over 300 lines.

- [ ] **Step 2: Run the release gate**

First check the clock: `TZ=America/New_York date` must be outside 23:30–01:30 (else use `TZ=Europe/London`).

Run: `TZ=America/New_York npm run release:check 2>&1 | grep -E "^# (tests|pass|fail)|Packed|End-to-end|passed$|^FAIL|Parity|error TS"`

Expected, in order:
- `# tests 332`, `# pass 332`, `# fail 0` (New York), the same (Kolkata): 318 from Phase 5, plus 14.
- typecheck clean (no `error TS`).
- `Packed 90 files → dist/weekly-3.0.0.zip`.
- `End-to-end on dist/weekly-3.0.0.zip (manifest 3.0.0)`, `269/269 passed`, `No tabs: 9/9 passed`: the main suite with `tabs` and `history` pre-granted, and the no-tabs suite on the zip exactly as shipped.
- `Parity: 35/35 rows proved (278 end-to-end checks read)`.
- No `FAIL`. The whole run takes about six minutes.

- [ ] **Step 3: Report**

Report to the controller: unit counts per timezone, both end-to-end totals and the source line (`End-to-end on dist/weekly-3.0.0.zip`), the parity line, the zip's size, and any check that needed a retry. Leave `dist/weekly-3.0.0.zip` and `store-assets/` as they are: the owner takes them from here. Do not upload, publish or submit anything.

---

## Owner checklist: submission, and retiring Daybook and ForgetMeNot

Nothing below is done by an agent. Everything an agent produced is in `dist/weekly-3.0.0.zip` and `store-assets/`.

**Submit Weekly 3.0.0**
1. Run `TZ=America/New_York npm run release:check` yourself (or read the Task 9 report). It must end with `Parity: 35/35 rows proved`.
2. Host `store-assets/privacy-policy.html` at a public URL (GitHub Pages, your site). If you submit after 1 November 2026, change "Last updated" in it first.
3. Chrome Web Store Developer Dashboard → Weekly → **Package** → upload `dist/weekly-3.0.0.zip`.
4. **Store listing**: paste the detailed description from `store-listing.md`; set the category; upload the five screenshots in order (`screenshot-1-report.png` … `screenshot-5-stats-dark.png`), both promo tiles and `icon-128.png`. Remove the old popup and history screenshots if the dashboard kept them.
5. **Privacy practices**: paste the single-purpose text; paste each permission justification into its field (`sidePanel`, `scripting` and `activeTab` are new; `tabs` is now optional); tick the data types and the three certifications as listed; paste the privacy policy URL.
6. Paste the reviewer test instructions into the test-instructions field.
7. Submit for review. Choose to publish manually after approval, so Weekly 3.0 and the two farewell updates can go out on the same day.
8. When it is live, install it from the store in a fresh Chrome profile: the install prompt must not mention browsing history; "Track my week?" → yes must show Chrome's "Read your browsing history" prompt; Alt+N works on a normal page.

**Retire Daybook and ForgetMeNot (spec §8)**
1. Only after Weekly 3.0 is live: publish one farewell update of each, built from their own repos (`/Users/sharajrewoo/DemoReposQA/Daybook`, `/Users/sharajrewoo/DemoReposQA/ForgetMeNot`), with a banner: "Daybook is now part of Weekly. Export your data, then import it in Weekly." (ForgetMeNot the same), linking to Weekly's store page.
2. The farewell builds must not change the export files: Daybook `{format: 'daybook.tasks', schemaVersion: 1, tasks}`, ForgetMeNot `{app: 'ForgetMeNot', schemaVersion: 2, notes, security}`. Weekly's import reads exactly these.
3. Add a first line to both store descriptions: "Now part of Weekly:" and Weekly's store URL.
4. About 30 days after the farewell updates are live, unpublish both from the dashboard. Do not delete the items. Unpublishing does not remove installed copies, so nobody loses notes or tasks; they can still export later.
5. Answer any user email at srewoo@gmail.com with the three-step move: Export in the old app, Import a backup in Weekly's Settings, enter the PIN for private notes.

## Self-review (done at authoring time)

**1. Spec coverage: every Phase 6 requirement, its task, and the check that proves it**

| Requirement | Task | Proved by |
|---|---|---|
| Version 3.0.0 in `manifest.json` and `package.json` (spec §8 row 6) | 1 | unit `manifest.json and package.json carry the same version, so the zip is named after what Chrome shows`; `Packed 90 files → dist/weekly-3.0.0.zip` |
| Zip named `weekly-3.0.0.zip` (spec §7) | 1, 9 | `npm run package` line; `End-to-end on dist/weekly-3.0.0.zip (manifest 3.0.0)` |
| End-to-end on the built zip, with and without `tabs` (spec §7, §8) | 1, 9 | `npm run e2e:zip`: `269/269 passed`, `No tabs: 9/9 passed` |
| Phase 3 m2: reminder notification never cleared on dismiss | 2 | unit `closing the reminder window clears its notifications…`; e2e `[Reminders] the notification goes with the window…` (failed before the fix in the replay) |
| Phase 3: README on the Weekly 2 upgrade and checks missed during sleep | 2 | README "Missed reminders", "Coming from Weekly 2" |
| Phase 4: no "5 unlocked minutes"; exports kept private, longer PIN | 3, 5, 6 | unit `the unlock dialog says private notes lock after 5 idle minutes or sooner…`, `Settings say to keep export files private…`; policy test (`Keep export files private`); README |
| Phase 2b: privacy policy "toolbar popup" (line 69); `generate.mjs` opens `popup.html` | 5, 7 | unit `the privacy policy has none of Weekly 2’s stale lines…`; `generate.mjs` rewritten, screenshots test |
| Privacy policy: 90-day line (52), tasks, notes, private notes, on-page note, optional tracking, export contents, dated, contact | 5 | unit `the privacy policy names this version and the contact address`, `the privacy policy covers Weekly 3…` |
| Listing for the merged product, audience, contact, tracking off until yes, Chrome's prompt text | 6 | unit `the listing says tracking is off until the user agrees, quotes Chrome’s prompt…`, `the listing is for this version…` |
| Permission justifications, one per permission (spec §3.6 as built) | 6 | unit `every permission the manifest asks for has a justification, and nothing else has one` |
| Migrating from Daybook / ForgetMeNot | 6 | unit `the listing tells Daybook and ForgetMeNot users how to bring their data across` |
| Screenshots 1280×800 of the real 3.0 pages, realistic seeded data, light and dark; promo tiles | 7 | unit `the screenshots are the five the listing names…`, `the screenshots’ demo week is what Weekly itself would store…`; Step 6 visual check |
| Parity audit: every checklist row points at its proof; a row without proof fails | 8 | `npm run parity`: `35/35`; the X1 row fails it (`exit 1`) |
| Final gate: unit both TZ, typecheck, e2e with and without tabs on the zip, package | 9 | `npm run release:check` |
| No outward actions; owner checklist | all | Global Constraints; this section |

**Unit tests added (14):** `manifest.test.js` +1 (Task 1); `background/reminders.test.js` +1 (Task 2); `wording.test.js` 2 (Task 3); `stats.test.js` +1 (Task 4); `store-assets.test.js` 3 (Task 5), +4 (Task 6), +2 (Task 7). 318 → 332 per timezone.

**End-to-end checks added (1):** `[Reminders] the notification goes with the window: none is left in the notification centre (Phase 3 m2)` (Task 2). 268 → 269, plus `No tabs: 9/9`. Packed files unchanged at 90 (nothing new ships; `scripts/`, `test/` and `store-assets/` stay out of the zip).

**2. Placeholder scan:** none. Every new file is written in full; every change to an existing file is an exact replace, a whole-file replacement or a `Delete` against the file as the previous task left it; the images are made by a command. The plan was generated from, and replayed step by step on, a copy of the Phase 5 end state with the real `store-assets/`, including each "see it fail" run (and the Task 2 end-to-end check without its fix), with every task ending green and `npm run release:check` passing.

**3. Type consistency:**
- `ctx.log.notificationsCleared` (stub) is what the reminders test reads; `forgetWindowIfClosed` clears `NOTIFICATION_PREFIX + slot` for each of `SLOTS`.
- `read`, `pkg`, `policy` (Task 5), `listing`, `manifest` (Task 6) and `png()` (Task 7) are defined once in `test/store-assets.test.js`.
- `demoTasks(friday)`, `demoNotes(friday)`, `PRIVATE_NOTE`, `DEMO_PIN` (`demo-data.mjs`) are what `generate.mjs` and the test import.
- `PROOFS` entries are `{ file, unit }` or `{ e2e }` in `parity-proofs.mjs`, and `parity.mjs` reads exactly those keys.

**Decisions the specs did not settle:**
- **Which parked items are Phase 6:** the ones the ledgers park to Phase 6 or to the release (Phase 3 m2, the README notes, the store-assets popup references) and the two the Phase 4 final review parked here. Phase 2b's "final polish" minors (Move-all undo also restoring skipped tasks, recurring undo flipping through `toggleOn`, overlapping report loads, the past-day daily-add hint) are not in 3.0.0: each is a rare race or a hint, none is visible in the store, and each touches task UI that the real tree's fix waves rewrote. They are left for 3.0.1; say so if you want them first.
- **The heatmap label fix** is in (Task 4) although nobody parked it: the overprint shows in a store screenshot.
- **Five screenshots** (the store's maximum): report, side panel, calendar (light), notes and stats (dark). The welcome page and the "hide names" shot are dropped; the panel shot's caption and the listing carry "tracking is off until you turn it on".
- **Fixed clock:** the most recent Friday at 16:20, so the report has a full week and the panel a mostly done Friday whenever the images are made.
- **Short description changed** with the manifest description (the store uses it): "Tasks, reminders and notes for your working week, and a draft of your weekly update. Everything stays on your computer."
- **Single purpose** is phrased as "a planner for the working week", with tracking feeding the same update, because the merged product must read as one purpose to a reviewer.
- **Data disclosure:** Web history and User activity stay ticked (only when tracking is on); tasks and notes are text the user types and keeps on the computer, so no category is ticked for them.
- **`downloads`** (spec §3.6) is not requested, so it has no justification row (Phase 5 decision; the test enforces one row per requested permission).
- **Privacy policy date** is 1 November 2026; the owner changes it if the submission is later.
- **Parity proofs:** a unit proof is checked by name in its file (the gate's `npm test` proves it passes); an end-to-end proof must have passed in the last run's results. The gate reads the checklist itself, so a new row fails until someone names its proof.
- **`e2e:zip` uses macOS `unzip`**; the harness is macOS-only already (Playwright's cache path).
- **Farewell updates** for Daybook and ForgetMeNot live in their own repos and are the owner's (checklist above); this plan writes nothing there.
