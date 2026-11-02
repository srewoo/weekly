# Phase 5 final review: stats, archive, theme, three-format import, optional tabs

Reviewer: final whole-phase reviewer (opus), read-only. Inputs: review-final.diff (snap-t1 → tree, 5219 lines), the plan's header, Global Constraints, Phase-6 footer and Self-review, the spec rows and sections, constraints.md, the ledger (progress.md) with task-7/8 rulings, and the Phase-4 final review §6–§8.

Re-measured here: `npm test` 356/356 pass, 0 fail, in both timezones; `npm run typecheck` exit 0. E2E not re-run (the desktop rule; the Task 9 numbers stand: 273/273, No tabs 9/9, Packed 93).

## 1. Verdict: **Ready**

There are no Critical or Important findings. There is **1 must-fix minor**: T5-a, the uncaught `trackingAllowed()` promises (§5). It is three one-line `.catch`/`try` edits and does not block the phase's design.

### Critical
None.

### Important
None.

I checked these candidates and none is a finding:
- **Upgrade path for Weekly 2 users** (`tabs` moves from required to optional). Chrome bounds the active permissions by required ∪ optional on update, so `tabs` should stay granted and tracking should continue. This cannot be proven in this repo. Phase 6 must check it on a real update (§7).
- **Lockout clearing through Replace** (T7-P1). Replace with a different PIN record adopts that record with its counters reset. In the same single write it discards every local note (portability.js:107 `base = replace ? []`). Nothing the lockout protected survives, so the import is not an oracle. The ruling stands, and Phase 6 must state it in the privacy policy.
- **Extra writes during an import.** On the own-backup path and the "mine" path, `checkPin` writes the counter reset when the counters are non-zero (crypto-broker.js:79), and a wrong PIN writes `afterFailure`. Neither write is part of the import: both happen before it, and both are the lockout doing its job (T7-C5). The import itself is one `set` (portability.js:118).

## 2. Security pass (untrusted import, crypto)

| Check | Holds? | Where |
|---|---|---|
| 20 MB limit before the file is read | yes | portability.js:54-55 (`file.size` checked before `file.text()`); unit `a file over 20 MB is refused before it is read` |
| Parse errors in words | yes | backup.js:144 "Not a valid export file."; "has no device ID", "not a valid ForgetMeNot backup", "newer version of ForgetMeNot", "That file has no tasks in it.", "isn’t a Weekly, Daybook or ForgetMeNot backup"; unit `refused in words: …` |
| `__proto__`/`constructor`/`prototype` dropped | yes | backup.js:37,54 (`cleanDay`). Activity keys must match `^day:` (backup) and `IMP` with the file's own device (portability.js:64ff `recheck`). `importableSettings` iterates only DEFAULTS keys with `Object.hasOwn` (settings.js:85-100). Spreads of parsed objects define own data properties and never set a prototype. No `Object.assign` on imported data. Unit `__proto__, constructor and prototype keys never reach Object.prototype, anywhere in a file` |
| Every field coerced | yes | tasks `coerceTaskList`, notes `coerceNote`, record `coerceSecurity`, settings `importableSettings`, activity `cleanEntry`/`cleanDay`, in backup.js. Everything is coerced again in the worker/writer, because a message is untrusted too: `recheck` (portability.js:64), `plainFrom`/`sealedFrom` (crypto-import.js), `coerceSecurity(m.security)` (crypto-broker.js:214) |
| No HTML from files reaches the DOM | yes | import-panel.js writes only `describeBackup`/`replaces` (fixed words plus counts) and error strings, through `textContent` (`msg` at main.js:27). No innerHTML/outerHTML/insertAdjacentHTML in src; dom.js:14 is the blocking guard |
| PIN record via coerceSecurity | yes | backup.js (`coerceSecurity(data['security'])`), crypto-broker.js:214. A damaged file record is refused in words |
| Slack webhook never exported or imported | yes | export strips it (portability.js:42). Import skips it (settings.js:91), and Replace keeps the local one (`readSettings({...cur, ...b.settings})`). Units `export: … never the Slack webhook (F7)`, `Merge keeps … never a webhook`; e2e `[Data] export carries tasks and settings, but never the Slack webhook (F7)` |
| Private notes never plaintext at rest | yes | `coerceNote` blanks title/body whenever `enc` is set (note-views.js:79-80). `crypto:save` seals and writes in one queued job (crypto-broker.js:116). Imported FMN private notes are re-sealed with the title inside (crypto-import.js `sealedFrom`). 'theirs' re-seals local notes inside the write lock. Units `crypto:save turns a plain note private…` (asserts the plaintext is gone from storage), `a private note is ciphertext at rest…` |
| crypto:import / crypto:save are page-only via the worker gate | yes | service-worker.js:100-103: a non-string type or foreign sender gets no reply; anything but `notes:*` needs `isOwnPage`; `crypto:*` goes to the broker first. sender.js `isOurs`/`isOwnPage`. The broker repeats the check in `handle()` (defence in depth). No `fromExtensionPage` anywhere. Units `only Weekly’s own pages may import…`, `only Weekly's own pages may ask for reminders or the PIN; a content script may not` |
| Import is ONE storage write | yes | `writeBackup` makes one `set` under TASKS→SETTINGS→NOTES (portability.js:91-118). The broker path passes `{incoming, reseal, security}` into the same write. Nothing else in src nests these locks (only portability.js:94 nests). Units `an import with tasks, notes, settings and activity is one storage write`, `a failed write (a full quota) leaves everything as it was`, `private notes: the worker writes tasks, notes and the PIN record in the same write` |
| Lockout not bypassable through import | yes | Your own backup (same salt and verifier) goes through `checkPin`: counted, lockout honoured, no record written (crypto-broker.js:199-201, 220, 234). Merge with a different record checks the local PIN through `checkPin`. Replace is T7-P1 (above). File-PIN guesses on a foreign record are not counted, which is acceptable because the file is offline anyway. Units `my own backup (merge/replace): … counted by the lockout…`, `… while locked out even the right PIN is refused`, `a PIN here: mine is checked through the lockout…` |
| T4-W1 closed by crypto:save | yes | seal and write in one broker-queue job (crypto-broker.js:116-126); `crypto:encrypt` removed (no callers in src or test). notes-view routes private add and edit through `priv.store`. Unit `a PIN change sent right after a save cannot leave that note under the old key (R3)` |
| Damaged local record (H3) | yes | crypto-broker.js:47 `damagedRecord`; setPin and merge imports refuse; Replace proceeds (T7-C1) |
| Plain never replaces private (H2) | yes | note-views.js:125; unit `mergeNoteLists never lets a plain note replace a private one with the same id (R1)` |

## 3. Parity table

| Row | Closed? | Proving checks |
|---|---|---|
| L6 UI (archive keeping history, restore, purge) | closed | e2e `[Daily tasks] Stop repeating keeps its history and moves it to Stopped (L6)`, `Repeat again brings it back (L6)`, `Delete asks first; Cancel keeps the task (L6)`, `Delete for good removes it and its ticks; Undo puts it back whole (L6)` |
| L7 (streaks, 365 heatmap, weekday bars, per-task rate, summary) | closed | unit (stats.test.js) `a year is 365 consecutive local days ending today, across both DST changes and New Year`, `streaks run across New Year and skip weekends, which have nothing on them`, `an unfinished today does not break the current streak; a missed day does`, `a streak across the US spring-forward Sunday counts every day once`, `weekday rates average each weekday’s share done…`, `per-task rates count only the days a task occurred, never the future, best first`, `summary cards: …`, `the heatmap is Monday-first weeks…`; e2e `[Stats] #stats opens the Stats view with six figures (L7)`, `a year of days: 365 squares ending today, months labelled (L7)`, `weekday bars run Monday to Sunday (L7)`, `per-task rate counts the days it was due: 10 of 21, 48% (L7)` |
| F6 (light/dark/system on every page and the on-page note) | closed | unit `theme: light, dark or system (F6)…`, `notes:list carries the theme as data…`; e2e `[Theme] Settings offers the computer’s choice, Light or Dark…`, `Dark applies to the report at once…`, `the side panel follows without a reload, and the app opens dark (F6)`, `the welcome page and the reminder window use it too (F6)`, `the on-page note is told the theme as data, not a stylesheet (F6)`, `Light stays light when the computer is dark (F6)` |
| L8 (follows the OS when unset) | closed | e2e `[Theme] the computer’s choice follows it, dark then light (L8)` |
| D11 (export/import, merge or replace, validated) | closed | unit `a Daybook backup, made by Daybook’s own export…`, `Replace swaps only what the file carries…`, `Merge keeps every task already here; Replace of a Weekly export…`, `damaged records are counted and left out…`, `refused in words: …`; e2e `[Import] a Daybook backup: the panel says what it holds before anything is written (D11)`, `Add brings its tasks in, done and due dates kept (D11)`, `the same backup again adds nothing: tasks match by id`, `Replace with a Daybook backup swaps the tasks for the file’s and leaves notes alone (D11)` |
| F7 (versioned notes + security record, merge or replace) | closed (see minor m-V in §5) | unit `a ForgetMeNot export, made by ForgetMeNot…`, `the private ForgetMeNot note opens with its PIN…`, `a Weekly 3 export comes back whole…`, crypto-import.test.js (15 tests incl. own backup ×2 modes); e2e `[Import] a ForgetMeNot export asks for the PIN…`, `a wrong PIN is refused in words; nothing is written`, `the right PIN brings its notes in…`, `[Data] export carries the PIN record…`, `with a different PIN here, it asks for mine too and which PIN to keep (spec §4)`, `keep mine…`, `Replace with a ForgetMeNot export: the notes become the file’s and its PIN wins (F7)` |
| W3 (`tabs` optional; "Track my week?") | closed | unit `tabs is optional…`, `without the tabs permission nothing is recorded; granting it starts tracking at the next look (W3)`, `granting or revoking tabs makes the tracker look again…`, `turning tracking on asks Chrome for tabs; off gives it back (W3)`, `Alt+N without the tabs permission: a tab with no url still gets the injection…`; e2e `[Welcome] "Track my week?" comes first…`; No tabs 9/9 (`the install asks for no tabs permission…`, `the welcome page opens on "Track my week?"…`, `"No thanks" leaves tracking off and says so`, `browsing records nothing…`, `the side panel says tracking is off and offers no Pause`, `tasks work…`, `notes work…`, `the report and the app open; Settings show tracking off`, `[Errors] no page errors or console errors (no tabs)`) |

**W1 regression gate.** Nothing regressed. All Phase 1–4 e2e checks still pass (273 total). The intended changes are each ruled:
- This browser's own export now imports (P5-D6).
- The import message wording changed.
- The button is renamed "Import a backup".
- Recurring tasks are never overdue (Phase 3 m5).
- `history` fill is available with tracking off (T5-⚠).

One residual risk is outside the repo's reach: a Weekly 2 user updating to 3.0 must keep `tabs` (§7, item 1).

## 4. Controller rulings: do they hold in the code?

| Ruling | Holds? |
|---|---|
| P5-D1 restart/purge anchored on real `applied()`/GONE paths | holds (task-actions.js `restart`, `purge`) |
| P5-D2 reminders `if (!opts.force) updateReminderState(...)` | holds (reminders.js:82) |
| P5-D3 `reminderError()` before the try | holds (settings-panel.js) |
| P5-D4 counts | holds (356 / 273 / 9 / Packed 93) |
| P5-D5 no fromExtensionPage; gate only | holds |
| P5-D6 own export restores, activity skipped | holds (backup.js `own` → activity {}, deviceId null) |
| P5-W1 one write, lock order TASKS→SETTINGS→NOTES | holds |
| P5-H1 crypto:save | holds |
| P5-H2 plain never replaces private | holds |
| P5-H3 damaged record refuses setPin and merge import | holds (with T7-C1) |
| P5-H4 keyup/keypress, pendingTab cleared, re-append, CATEGORIES test, .hint moved | holds (onpage-note.js, onpage.js:48-49, styles.css, unit `the on-page note’s copied category list equals CATEGORIES`) |
| P5-H5 / H5b url-less Alt+N, unit only | holds (onpage.js:62; unit `Alt+N without the tabs permission…`) |
| P5-H6 orphan JSDoc gone, `also` spread first, edit() locked retry | holds (notes.js transformNotes; notes-view.js edit) |
| P5-H7 export PIN hint | holds (report.html `#exportPinHint`, data-panel.js showPinHint) |
| P5-H8 fixture ids survive coerceNote | holds (backup.test) |
| T3-I2 theme-boot.js + localStorage mirror | holds (every page's head, all 5 pages) |
| T3-m1 re-append opens | holds |
| T5-⚠ history fill with tracking off | holds (by design) |
| T6-S stricter changes | holds |
| T6-C2 carries.* only when the key is present | holds (backup.js weekly `Array.isArray(data.tasks/notes)`) |
| T6-C3 / R5 adopted record counters reset | holds (`afterSuccess(sec)`, crypto-broker.js:234) |
| T6-m1/m2/m3 | holds |
| T7-C1 Replace proceeds over a damaged record | holds (`!replace && damagedRecord()`) |
| T7-C2 / T7-I1 own backup through checkPin, no record write | holds |
| T7-C3/C4 crypto-import.js split, crypto:encrypt removed | holds |
| T7-C5 right PIN on own backup resets counters | holds (checkPin:79) |
| T7-m1..m5 | holds |
| T7-P1 Replace adopts without the local PIN | holds as ruled (kept; Phase 6 to document) |
| T8-m1/m2/m3/m5 dead writers deleted, Replace hidden when empty, button disabled in flight, H7 e2e assertion | holds (no mergeTasks/replaceAll/mergeNotes in src) |
| T8-I1 storage errors in plain words (page path) | holds (portability.js:128 `notImported`) |
| R0–R6, W1, H7, S1, S2 (task rulings files) | hold |

## 5. Triage of every deferred minor and parked ledger line

**Must-fix now (1):**
- **T5-a** Uncaught `trackingAllowed()` promises:
  - welcome.js:44 `.then` has no `.catch`.
  - settings-panel.js:70 `.then` has no `.catch`.
  - settings-panel.js:54 `await trackingAllowed()` sits outside the try, so `void setTracking(e)` can leave an unhandled rejection.

  This breaks the explicit constraint that a permission path never leaves an uncaught promise. Fix: add `.catch(() => {})` (or `.catch(() => false)`) to both `.then` calls, and move line 54 inside the try with a fallback of `on = !want`.

**Can wait (Phase 6):**
- T2-a: Stop repeating / Repeat again need task-named aria-labels. Phase 6 a11y pass.
- T2-b: the daily-tasks re-render loses keyboard focus.
- T2-c: app.css has duplicate `.hm-cell` rules, `.figure` border doubles at the row end. Fix with the screenshot polish.
- T3-b: an open on-page note does not follow a theme change until reopened.
- T3-c: no test for theme-boot pre-paint ordering or for m1. Phase 6 manual smoke.
- T5-b: the permission-denial path is untested. Add one stub-denied unit test.
- T5-c: the Settings tracking checkbox goes stale when the permission changes elsewhere. Resync it on `onTrackingChanged`.
- T5-d: onpage.js:62 treats a `''` url as present. Use `if (tab.url && …)`. Phase 6's manual Alt+N-without-tabs check decides.
- T7-⚠ (parked): `edit()`'s locked retry has no unit test. Fold into Phase 6's `private.js`/notes-view tests (Phase-4 T6 can-wait).
- T7-P1 (parked/kept): Replace drops local private notes without asking for the local PIN. Document it in the privacy policy; optionally add a local-PIN prompt.
- T8-minor: on the broker path a non-quota storage error is shown as bare Chrome text (crypto-broker.js:255), and the broker's refusals do not say "Nothing was imported". Rare, and the quota case is already worded.
- T9: README:60's Replace summary omits that a Weekly export swaps tasks, notes and settings, and that Add never imports settings.

**Wontfix:**
- T1-a: the `fromISODate` casts in heatmap/yearRows. Rows always come from `addDays`, so the null case cannot occur.
- T1-b: the summary average includes today's partial progress. A design choice; the streak rule differs on purpose.
- T1-c: the summary test's average expectation mirrors the formula. Test style only.
- T2-d: stats.mjs calls `unlabeled(app)` twice and uses fixed waits. The existing e2e pattern.
- T3-a: keyup/keypress and re-append have no tests. A closed Shadow DOM is unreachable from e2e.
- T4-a: settings-panel has two statements on one line. Cosmetic.
- T4-b: `reminderError` also checks a disabled slot's time. Brief-mandated, and it prevents a silent default.
- T5-e: the brief's RED steps were not captured. Process only.
- T6-a: `slackWebhook` is destructured and unused in exportPayload. The JSDoc above says why.
- T6-b: the P5-H8 order assertion depends on fixture order. The fixture is frozen.
- T6-c: record counts are uncapped. Bounded by 20 MB, and notes are capped at 10,000 in the worker.
- T7-minor: IMPORT_MAX is counted per list while the message says "the file holds more than 10,000 notes". An edge wording case only.
- T8 parked m4: `#importMine` is hidden when `crypto:status` fails. `checkPin` refuses an empty PIN without counting it (crypto-broker.js:67), nothing is written, and a retry works.

**New minors found in this review (all can wait):**
- **m-V:** `readBackup` ignores the Weekly export's `version` field (portability.js writes `version: 3`). A future Weekly 4 file would be coerced silently instead of refused like a newer ForgetMeNot. Add `version > 3 → "made by a newer version of Weekly"` with the 3.0.0 release or the next format change.
- **m-N:** `importableSettings` type-checks numbers but does not range-check them (`idleSeconds`, `minMinutes`). The worker clamps idleSeconds to ≥ 15. The same exposure already exists in the Settings form.
- **m-R:** Replace has no confirm dialog. The label names what it swaps and it takes two deliberate actions (choose the radio, press Import), but there is no Undo. Phase 6 could add `confirm()` like Delete everything.

## 6. Constraints sweep

| Constraint | Result |
|---|---|
| No storage.sync | clean (grep src empty) |
| No network beyond opt-ins | clean: only integrations.js `fetch` (Jira/GitLab/GitHub status, Slack post), both pre-existing opt-ins |
| No remote fonts | clean |
| No innerHTML/outerHTML/insertAdjacentHTML | clean (dom.js:14 is the guard set) |
| src files ≤300 lines, functions ≤50 | clean: largest crypto-broker.js 288. A brace-matching scan found no function over 50 lines in src or in the new e2e files. full.mjs 425 is the allowed exception |
| mutate() callbacks synchronous | clean (`writeBackup` is its own locked read/compute/set and calls no mutate; `transformNotes` is the documented async variant) |
| sw.evaluate callbacks: only chrome.*, built-ins, argument | clean in stats/theme/data/no-tabs (stats.mjs:9 takes its data as the argument) |
| Notifications without titles | unchanged this phase (reminders.js:129 payload untouched) |
| Reminders off in e2e except reminders.mjs | clean (harness seeding; no-tabs.mjs:30 turns them off in its own copy; theme.mjs opens remind.html directly, with no alarm) |
| e2e ends with no PIN | clean (data.mjs:83 `crypto:removePin`) |
| UI keeps Weekly's look | yes: tokens only, dark tokens mirrored, ruled figure strip, marker bars, one filled button per surface. The import panel's marker-wash box is a highlight, not a card (acceptable) |
| No uncaught promises on permission paths | **one violation (T5-a, must-fix)**. Denial itself resolves `false` and is said in words (settings-panel.js setTracking, welcome.js trackYes) |
| Layering (lib no DOM; stats/backup no chrome.*; ui no chrome.storage) | clean |

## 7. What Phase 6 must know beyond the plan's footer

1. **Permissions on update.** `tabs` moved from `permissions` to `optional_permissions`. Verify on a real Weekly 2.0.0 → 3.0.0 update (load the old unpacked build, grant, then update in place) that `chrome.permissions.contains({permissions:['tabs']})` stays true and tracking keeps recording. If it does not, every upgrader loses tracking silently. The footer says "Tracking is off…", but the welcome page does not reopen on update.
2. **Alt+N without `tabs`** is proven by unit test only (P5-H5b). Do one manual real-Chrome check on the build as shipped. Fix T5-d if the URL arrives as `''`.
3. **Page routes for screenshots:**
   - app `src/ui/app/app.html#calendar|#tasks|#notes|#stats`, plus `#day=YYYY-MM-DD` to open a day sheet;
   - report `src/ui/report/report.html`, with `#settings` opening Settings;
   - side panel `src/ui/panel/panel.html`;
   - welcome `src/ui/welcome/welcome.html`;
   - reminder window `src/ui/remind/remind.html?slot=morning|evening`.

   `popup.html` is gone.
4. **Seeding a dark screenshot set.** Set `settings.theme = 'dark'` in `chrome.storage.local`. Pages also read a localStorage mirror, `weekly:theme`, before first paint (theme-boot.js). Seed both, or let each page settle (theme.js applies the setting a tick later and rewrites the mirror), otherwise the first frame can be light. Do not emulate `prefers-color-scheme` for "Dark": that only covers System.
5. **Seeding tracking.** The screenshot harness must grant `tabs` (a copy with it required, as run.mjs does). Otherwise the footer reads "Tracking is off" and nothing records.
6. **Privacy-policy facts:**
   - Tracking is off until "Yes" or Settings → Tracking; Chrome calls it "Read your browsing history".
   - Without `tabs`, nothing is recorded.
   - An export contains:
     - the PIN record (salt and PBKDF2 verifier, never the PIN), so someone with the file can guess short PINs offline (H7; the UI says so);
     - private notes as ciphertext only;
     - settings without the Slack webhook;
     - tasks.
   - Guesses at the file's PIN in the importer are not rate-limited (offline anyway). Guesses at your own PIN, including through your own backup, go through the lockout.
   - Replace with another file's PIN record discards local private notes and adopts that PIN without asking for yours (T7-P1).
   - localStorage holds only the theme name.
   - History fill works with tracking off, behind its own `history` prompt.
   - The key is dropped after "up to 5 minutes" idle (MV3 worker stops sooner; Phase-4 §6.6).
7. **Spec items closed differently** (in addition to the footer's list), for the release notes and the store listing:
   - `crypto:encrypt` no longer exists. Private notes are stored through `crypto:save` (seal and write in one worker step), and an import with private notes goes through `crypto:import`.
   - An import is one storage write.
   - A file over 20 MB is refused.
   - More than 10,000 notes in one list is refused.
   - Replace swaps only what the file carries. Activity from another browser is always added.
8. **Counts and packaging:** unit 356 per timezone, e2e 273 plus No tabs 9/9, **Packed 93 files**. The footer's "packs 90" is stale: theme-boot.js, crypto-import.js, backup.js and import-panel.js were added. Version is still 2.0.0.
9. **Phase-4 Phase-6 carry-overs still open:**
   - no e2e for app-tab hiding on Lock or for Change/Remove during the lockout;
   - no unit tests for `private.js` page logic;
   - the README's `storage.js` layout line.
10. **Before the 3.0.0 zip:** fix T5-a (must-fix). Consider m-V (refuse newer Weekly export versions) at the moment the version is bumped.
