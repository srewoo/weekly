# SDD ledger — plan: docs/superpowers/plans/2026-10-31-weekly-3-phase-5-stats-data.md

Started 2026-11-01 (controller: opus). Workspace .superpowers/sdd/phase-5/. Constraints: constraints.md.
Real baseline (caller-verified): 298/298 unit per TZ, typecheck 0, e2e 243/243 (TZ=America/New_York), Packed 85 files. snap-t1 == working tree (verified, pkg diff empty).
Ruling: No git — per task `snap.sh phase-5 tN` before dispatch, `pkg.sh phase-5 tN review-tN.diff` after; fix rounds snapshot tNfR — cost if wrong: none functional.
Ruling: Models — implementers sonnet (opus for Tasks 6, 7, 8 and fix rounds 4–5); reviewers sonnet for T1–T4, T9, opus for T5–T8 and final — why: caller mandate + untrusted parsing/crypto — cost if wrong: extra turns.

## Pre-flight
Drift scan (opus, read-only): preflight-drift.md — 133 replace blocks: 130 OK-once, 3 MISS, 0 MULTI; 15 Creates all new; whole-file replacements checked (status.js loses nothing; portability.js drops parseImport/applyImport/own-export refusal, cleanEntry+UNSAFE move to backup.js). Simulated plan-on-real-tree: unit 330/330 both TZ, tsc 3 errors (all MISS), no broken imports/#ids, Packed 91, largest src file crypto-broker.js 252.

### Per-task self-consistency
| Task | Own text consistent? | Finding |
|---|---|---|
| 1 | yes | — |
| 2 | no | MISS 1: task-actions anchor (real setPriority wraps applied()); restart/purge skip applied() |
| 3 | yes | — (handover items folded below) |
| 4 | no | MISS 2 reminders.js opts.force branch; MISS 3 settings-panel try/catch |
| 5 | yes | prose: fromExtensionPage n/a here |
| 6 | yes | — |
| 7 | prose only | "fromExtensionPage" (plan lines 35, 3059) → isOwnPage at the worker gate |
| 8 | yes, but violates spec §6 | applyBackup = up to 4 writes |
| 9 | counts stale | 286/238/84 base → 298/243/85 |

### Cross-task interfaces
| Producer → consumer | Interface | Agree? |
|---|---|---|
| T1 stats.js → T2 stats-view/daily-tasks | yearRows, summary, heatmap, weekdayRates, pct, WEEKDAYS, taskRates | yes |
| T2 task-actions → T2 daily-tasks | act.restart/act.purge | no (MISS 1) → ruled |
| T2 app.js → T3 app.js | T2 comment anchor | yes |
| T3 settings THEMES/theme → theme.js, settings-panel, onpage notes:list → onpage-note | s.theme / r.theme | yes |
| T3→T4→T5 settings-panel | sequential anchors | T4 no (MISS 3) → ruled |
| T4 schema (no snoozeUntil) → T4 reminders | ReminderState | no (MISS 2) → ruled |
| T5 status.js → tracker, footer, welcome, settings-panel | trackingAllowed/allowTracking/stopTracking/tracking | yes |
| T6 backup.js → T7 test, T8 portability/import-panel | readBackup, describeBackup, replaces, Backup/Sealed | yes |
| T7 crypto:import → T8 writeNotes | {mode,security,notes,sealed,pin,localPin,keep} | yes — but reshaped by Ruling P5-W1 |
| T7 mergeNoteLists → notes.js, broker | re-export | yes, rule changed by P5-H2 |
| T2/T3/T5/T6/T8 full.mjs | 7 sequential anchors | yes |

### Pre-flight rulings
Ruling P5-D1 (MISS 1): T2 anchors on the real `setPriority … applied(await updateTask(...))` line; restart = `applied(await restoreRecurring(t.id))`, purge mirrors real `remove` (task-actions.js:71-81: applied, Undo, GONE path) — why: 2b fix wave; no false success toast for a vanished task — cost if wrong: none.
Ruling P5-D2 (MISS 2): reminders.js:82 becomes `if (!opts.force) await updateReminderState({ [key]: ref });`, comment kept — why: real opts.force branch; snoozeUntil removed by T4 — cost if wrong: none.
Ruling P5-D3 (MISS 3): settings-panel inserts `const re = reminderError(); if (re) return msg('#settingsMsg', re);` after the webhook check, before `let settings; try {` — why: real try/catch — cost if wrong: none.
Ruling P5-D4: counts re-derived from the real baseline: unit 306/306/308/309/313/322/329/330/330 (+ tests added by rulings below, reported per task); e2e 243/253/260/261/262/262/262/273/273; no-tabs 9 (+1 by P5-H5); Packed 91 — cost if wrong: count mismatch only.
Ruling P5-D5: every "fromExtensionPage" in the plan means isOwnPage/isOurs (sender.js) enforced at the single gate in service-worker.js; crypto:import needs no per-handler check (the gate already refuses crypto:* from content scripts); T7 test asserts a content-script sender is refused — cost if wrong: none.
Ruling P5-D6: own-export refusal reversed as the plan decided (restore after Delete everything; only its activity skipped) — why: plan decision, spec §4 import restores; Weekly 2's refusal guarded double-counted activity, which stays skipped — cost if wrong: one restored backup could re-add tasks already deleted (Merge keeps local ones).
Ruling P5-W1 (spec §6 "written once", Phase-4 §6.1, caller binding): an import is ONE chrome.storage.local.set. Task 8 adds `writeBackup(b, mode, extra?)` to src/lib/portability.js: under withLock TASKS_LOCK → SETTINGS_LOCK → NOTES_LOCK (fixed order; nothing else nests these), read current tasks/settings/notes/imports, compute tasks (mergeTasks' pure rule or replace), settings (Replace only, importableSettings, local webhook kept), notes (mergeNoteLists or replace), activity keys + imports, re-coerce defensively, then one set. Without private notes the page calls it directly; with private notes + PIN record, crypto:import carries the whole accepted backup + choice, the broker verifies/opens/seals BEFORE taking locks, then calls writeBackup with {sealed notes, reseal-local fn for 'theirs', security record} so notes, record, tasks, settings and activity land in the same set — why: spec §6 + caller binding; the record is still written only from the broker's call — cost if wrong: Task 8 bigger (opus implementer); broker may need a helper file to stay ≤300.
Ruling P5-H1 (T4-W1, caller binding "do it"): Task 7 adds `crypto:save {id: string|null, title, body, category, day}` — in the broker queue, seal with the live key and write (createNote / updateNote enc+fields) in the same queued job, so a changePin/removePin rekey can never interleave; notes-view's private add/edit go through it (private.js `store()`), plain notes unchanged; locked → askPin and retry once (T6-I2 pattern); toasts/Undo as today. crypto:encrypt may stay for nothing else; remove it if unused — cost if wrong: one more broker message.
Ruling P5-H2 (Phase-4 §6.2): mergeNoteLists never lets a plain incoming note replace a stored private note with the same id (the private one stays; not counted as added); unit test — cost if wrong: none.
Ruling P5-H3 (Phase-4 §6.3): if storage holds a `security` value that fails coerceSecurity AND any enc note exists, crypto:setPin and crypto:import refuse in words ("Your PIN record is damaged, so a new PIN can’t be set without losing your private notes.") and write nothing; unit tests — cost if wrong: a damaged-record user must Delete everything to recover (no worse than today's silent orphaning).
Ruling P5-H4 (Phase-4 T7 items + caller "category test"): Task 3, which edits onpage-note.js/onpage.js, also: stops keyup/keypress as well as keydown; clears pendingTab on fallback; re-appends the host when !host.isConnected; one unit test that reads src/content/onpage-note.js's category list and compares it to note-views CATEGORIES; moves `.hint` to styles.css (T5 item) — cost if wrong: a few lines.
Ruling P5-H5 (Phase-4 §6.4, caller binding): Task 5 makes the Alt+N command path not depend on tab.url: when url is absent (no tabs permission) try injection (activeTab grants it for the command) and fall back to the panel only if injection fails; unit test with a url-less tab; plus a no-tabs e2e check that Alt+N opens the note if Playwright's Chromium can fire the command (page.keyboard inside Playwright only); if it cannot, the implementer says so and the unit test stands — cost if wrong: Alt+N falls back to the panel without tabs.
Ruling P5-H6: Task 7 also folds: delete orphan JSDoc (broker "Only Weekly's own pages…"); transformNotes spreads `also` first so it can never overwrite notes; notes-view edit() on a locked decrypt asks for the PIN and retries once — cost if wrong: none.
Ruling P5-H7 (Phase-4 §6.7): Task 8's export UI says one plain line when a PIN is set: the file holds what checks the PIN, so a short PIN could be guessed by someone who has the file; keep it safe. Phase 6 privacy policy repeats it — cost if wrong: wording only.
Ruling P5-H8 (Phase-4 T1 can-wait, mergeNotes fresh id for invalid ids): Task 6 asserts every fixture note id survives coerceNote unchanged (re-import idempotent for real files); invalid-id notes stay parked — cost if wrong: a hand-edited file with bad ids duplicates notes on re-import.
Task 1: dispatched implementer a80a4bc87c25693df (sonnet), base snap-t1
Task 1: implementer DONE 306/306 both TZ, tsc clean; review-t1.diff; reviewer ab622e2b5ea1df262 (sonnet) dispatched
Task 1: review ✅ Approved (sonnet); ⚠️ totals verified by controller: 306/306 both TZ, tsc 0.
Task 1: minor (deferred): fromISODate casts in heatmap/yearRows hide null on malformed rows (exported helper).
Task 1: minor (deferred): summary average counts today's partial progress (streak ignores it).
Task 1: minor (deferred): summary test's average expectation mirrors the formula.
Task 1: complete (snap-t1..snap-t2, review clean)
Task 2: dispatched implementer a8f71e171fc6217b1 (sonnet), base snap-t2, carries P5-D1
Task 2: implementer DONE 306/306, tsc 0, e2e 253/253; extra CSS rule .rate-acts button.danger; review-t2.diff
Task 2: review ✅ Approved (sonnet); controller re-ran unit 306/306 both TZ, tsc 0; e2e 253/253 per implementer.
Task 2: minor (deferred): Stop repeating / Repeat again buttons lack task-named aria-labels.
Task 2: minor (deferred): daily-tasks re-render loses keyboard focus after an action.
Task 2: minor (deferred): app.css .hm-cell.on/.blank duplicate rules; .figure border-right doubles at row end / no rule between wrapped rows.
Task 2: minor (deferred): stats.mjs calls unlabeled(app) twice; fixed wait(500) sleeps (existing pattern).
Task 2: extra accepted: .rate-acts button.danger { border-color: transparent } (keeps one filled button per surface).
Task 2: complete (snap-t2..snap-t3, review clean)
Task 3: dispatched implementer a3ce06a78c7e6c4d2 (sonnet), base snap-t3, carries P5-H4 a–e
Task 3: implementer DONE 309/309, tsc 0, e2e 260/260; concerns: (c) pendingTab not unit-pinned; (a)(b) e2e-only; review-t3.diff
Task 3: review ❌ Needs fixes (sonnet): I1 onpage.js:51 clears pendingTab when any extension page (private.js/pin-settings listeners) answers panel:show → panel opens on Today, not Notes; I2 theme applied after async storage read → flash of wrong theme (plan-mandated design).
Ruling: T3-I2 — fix the flash: theme.js mirrors the resolved choice into localStorage ('weekly:theme', a non-secret UI preference cache; chrome.storage.local stays the source of truth) and one tiny classic script src/ui/components/theme-boot.js, loaded synchronously first in every page's <head>, sets <html data-theme> from it before paint — why: a dark user sees a light flash on every open; MV3 forbids inline scripts — cost if wrong: +1 packed file (gate Packed 92), one localStorage key.
Ruling: T3-m1 folded into round 1 (real bug, one line): toggle on a disconnected host re-appends and opens (setOpen(true)), not toggles — cost if wrong: none.
Task 3: minor (deferred): (a) keyup/keypress and (b) re-append have no tests (closed Shadow DOM; e2e cannot reach).
Task 3: minor (deferred): an open on-page note does not follow a theme change until reopened.
Task 3: fix round 1 implementer DONE: 310/310 both TZ, tsc 0, e2e 260/260, Packed 90 (85+stats.js,stats-view,daily-tasks,theme.js,theme-boot.js)
Task 3: fix round 1/5 (3 addressed, 0 open — I1 pendingTab, I2 theme flash via theme-boot.js, m1 re-append opens; snap-t3f1..snap-t4)
Task 3: minor (deferred): no dedicated test for theme-boot pre-paint ordering or m1.
Task 3: complete (snap-t3..snap-t4, 1 fix round). Running counts: unit 310, e2e 260, Packed 90.
Task 4: dispatched implementer ab5058d0d7b132cec (sonnet), base snap-t4, carries P5-D2/D3
Task 4: implementer DONE_WITH_CONCERNS (e2e RED skipped): 311/311, tsc 0, e2e 261/261; review-t4.diff
Task 4: review ✅ Approved (sonnet); controller re-ran unit/tsc (see next line in shell log: 311 both TZ, tsc 0).
Task 4: minor (deferred): settings-panel.js:26 two statements on one line.
Task 4: minor (deferred): reminderError checks a disabled slot's time too (brief-mandated).
Task 4: complete (snap-t4..snap-t5, review clean). Running: unit 311, e2e 261, Packed 90.
Task 5: dispatched implementer a43508b599d044934 (sonnet), base snap-t5, carries P5-H5
Task 5: implementer DONE_WITH_CONCERNS: 316/316, tsc 0, e2e 262/262, No tabs 9/9; Playwright page.keyboard Alt+N never fires an extension command → no-tabs Alt+N check dropped (P5-H5 unit-tested only); brief RED not captured.
Ruling: P5-H5b — Alt+N without tabs is proved by unit test only (Playwright cannot fire chrome.commands) — cost if wrong: a Chrome that omits tab.url still works by the url-less injection path; only real-browser manual check can prove it (Phase 6 manual smoke).
Task 5: review ✅ Approved (opus); checked e2e results files 0 failures, welcome screenshot keeps Weekly's look.
Ruling: T5-⚠ — Settings → history fill stays available with tracking off: it is a separate user-started action behind its own `history` permission prompt, not tracking; "without tabs nothing is recorded" holds for the tracker — cost if wrong: a user with tracking off can still import history estimates on purpose.
Task 5: minor (deferred, constraint-adjacent → final wave): welcome.js:448 / settings-panel.js:319 trackingAllowed().then without .catch; setTracking's second trackingAllowed unguarded ("never an uncaught promise").
Task 5: minor (deferred): denial path untested (stub request always true).
Task 5: minor (deferred): Settings tracking checkbox stale if permission changes elsewhere (onTrackingChanged could resync).
Task 5: minor (deferred): onpage.js:62 treats url '' as present (`!tab.url ||` covers both).
Task 5: minor (deferred): brief RED steps not captured (process).
Task 5: complete (snap-t5..snap-t6, review clean). Running: unit 316, e2e 262, No tabs 9/9, Packed 90.
Task 6: dispatched implementer a9946454f38afceb6 (opus), base snap-t6, carries P5-H8
Task 6: implementer DONE_WITH_CONCERNS: 325/325 both TZ, tsc 0, e2e 262/262, No tabs 9/9; stricter-than-brief: damaged-only Daybook refused ("That file has no tasks in it."), importableSettings rebuilds morning/evening from defaults' keys, deviceId via Object.hasOwn.
Ruling: T6-S — accept all three stricter changes — why: each prevents a destructive or untrusted pass-through (a damaged Daybook file + Replace would wipe all tasks; nested untrusted objects) — cost if wrong: a damaged Daybook file is refused instead of importing 0 tasks.
Ruling: T6-C2 — a backup "carries" notes/tasks/settings only when the file has that key as a list/object; a Weekly file without `notes` must not make Replace clear notes — fixed in Task 6's fix round if any, else Task 8 — cost if wrong: Replace from an old/partial Weekly export wipes notes.
Ruling: T6-C3 — imported security record's attempts/lock are reset on adoption (plan's importNotes uses afterSuccess(sec)); Task 7 reviewer checks — cost if wrong: none.
Task 6: review ❌ Needs fixes (opus): I1 backup.js:96 carries.notes always true for Weekly files (T6-C2) → Replace wipes notes. Security checklist otherwise passes with file:line; 20 MB limit is Task 8's (openBackup before file.text()).
Ruling: T6-m1/m2/m3 folded into round 1 (untrusted-input hygiene, one-liners): duplicate task ids counted in `dropped`; unit assertions for damaged-only Daybook refusal and a `__proto__` key inside morning/evening; a non-integer/non-number ForgetMeNot schemaVersion refused in words — cost if wrong: none.
Task 6: minor (deferred): slackWebhook destructured-unused in exportPayload (add comment); P5-H8 order assertion depends on fixture order; record counts uncapped (bounded by 20 MB, as before).
Task 6: fix round 1/5 (4 addressed, 0 open — I1 carries.notes, m1 duplicates counted, m2 assertions, m3 schemaVersion; snap-t6f1..snap-t7)
Task 6: complete (snap-t6..snap-t7, 1 fix round). Running: unit 325, e2e 262, No tabs 9/9, Packed 91 (+backup.js).
Task 7: dispatched implementer a2cbfae4cafa1cd35 (opus), base snap-t7, carries task-7-rulings.md R0–R6 (P5-D5, H1, H2, H3, H6, T6-C3, W1 seam)
Task 7: implementer DONE_WITH_CONCERNS: 342/342 both TZ (325+7+10), tsc 0, e2e 262/262, No tabs 9/9; crypto-broker.js 268 lines; new src/background/crypto-import.js (Packed 92); crypto:encrypt deleted (no caller), NOTE_GONE exported from note-actions.js.
Ruling: T7-C1 — R2's damaged-record refusal applies to crypto:setPin and to MERGE imports only; Replace proceeds (the user chose to drop local notes; the file's record is adopted) — why: Replace discards the orphaned local notes by choice, refusing blocks the only recovery path — cost if wrong: a damaged-record user loses unreadable private notes they could never open anyway.
Ruling: T7-C2 — same-record import (own backup) must not bypass the lockout: refuse while lockedFor(local)>0 with the lockout message, a wrong file PIN counts as a failed attempt on the local record (it IS the local PIN), and the stored record's counters are not reset by the import — why: otherwise an import clears the lockout — cost if wrong: one extra branch.
Ruling: T7-C3/C4 — accept crypto-import.js split and crypto:encrypt removal — cost if wrong: Packed 92 instead of 91.
Task 7: review ❌ Needs fixes (opus): I1 (plan-mandated) same-record import checks PIN with bare verify (no lockout, uncounted guesses) and resets local counters via afterSuccess — an in-product PIN oracle that also clears a lockout; replace mode same. Checklist otherwise passes with file:line.
Ruling: T7-I1 — fix per T7-C2, extended to every mode: read the local record first; if it equals the file's (salt+verifier), check m.pin through checkPin (counts failures, honours lockout) and write no record — cost if wrong: none.
Ruling: T7-m1/m2/m3/m4/m5 folded into round 1: R0 test on empty storage asserts nothing written; drop the `any` cast at broker:119 (unknown → coerceNote); import-specific error when a local private note can't be opened on 'theirs'; more than IMPORT_MAX notes refused in words (not truncated); test default keep → 'mine' — why: constraints (never `any`, refused import says why) — cost if wrong: none.
Task 7: ⚠ edit() locked-retry has no unit test; accepted on e2e Private checks (262/262) — parked.
Task 7: fix round 1 implementer DONE_WITH_CONCERNS: 352/352 both TZ, tsc 0, e2e 262/262, No tabs 9/9, broker 287 lines; RED not captured for new tests.
Ruling: T7-C5 — a right PIN on your own backup resets the wrong-PIN count via checkPin, exactly like crypto:unlock — why: a correct PIN is proof of the owner; consistent lockout semantics — cost if wrong: none.
Task 7: fix round 1/5 (7 addressed, 0 open — I1 own-backup via checkPin + no record write, m1–m5, T7-C1; snap-t7f1..snap-t8)
Task 7: minor (deferred): IMPORT_MAX counted per list (plain/sealed separately) while the message says "the file holds more than 10,000 notes".
Ruling: T7-P1 — Replace with a different valid local PIN adopts the file's record and drops local private notes without asking for the local PIN — kept: equivalent to Delete everything (no PIN needed) then setting the file's PIN; the Replace confirm names what it swaps — cost if wrong: someone at an unlocked browser can discard (not read) private notes via Replace; Phase 6 may add the local PIN prompt.
Task 7: complete (snap-t7..snap-t8, 1 fix round). Running: unit 352, e2e 262, No tabs 9/9, Packed 92.
Task 8: dispatched implementer ac11e5ba259cc6228 (opus), base snap-t8, carries task-8-rulings.md (W1 one write, H7, S1, S2)
Task 8: implementer DONE_WITH_CONCERNS: 356/356 both TZ (352+1+3 W1), tsc 0, e2e 273/273, No tabs 9/9, Packed 93; crypto:import reply now {ok, added, tasks, days} (9 Task-7 deepEquals adjusted); mergeTasks/replaceAll/mergeNotes now test-only; crypto:import carries the whole backup (≤20 MB file, under Chrome's 64 MB message cap); H7 line has no e2e; e2e RED skipped.
Task 8: review ❌ Needs fixes (opus): I1 import-panel.js:51 shows raw storage errors (QUOTA_BYTES) — brief line 9 + Errors constraint. Security checklist and W1 single write (lock order TASKS→SETTINGS→NOTES, no reverse nesting in src) verified with file:line.
Ruling: T8-m1/m2/m3/m5 folded into round 1: delete now-dead mergeTasks/replaceAll (task-portability.js) and mergeNotes (notes.js), repoint their tests at mergeTaskLists/mergeNoteLists, fix the task-portability header (a second import write path would bypass W1); hide Replace when replaces() is empty; disable #importGo while a run is in flight (no double-counted wrong PIN); one e2e assertion that the H7 export hint shows while a PIN is set (inside an existing data.mjs check, count unchanged) — cost if wrong: none.
Task 8: parked — m4 #importMine hidden if crypto:status fails while a PIN exists — Ruling: needs the worker to fail then answer; the broker still refuses safely ("Wrong PIN.") and nothing is written — cost if wrong: a rare retry.
Task 8: fix round 1 implementer DONE: 356/356 both TZ, tsc 0, e2e 273/273, No tabs 9/9, Packed 93; non-quota storage errors shown as 'Nothing was imported: <chrome text>'
Task 8: fix round 1/5 (5 addressed, 0 open — I1 plain-words storage errors, m1 dead writers deleted, m2, m3, m5; snap-t8f1..snap-t9)
Task 8: minor (deferred → final wave): broker path passes a non-quota storage error as bare Chrome text (crypto-broker.js:255) without "Nothing was imported"; broker refusals ("Wrong PIN.") don't say nothing was imported.
Task 8: complete (snap-t8..snap-t9, 1 fix round). Running: unit 356, e2e 273, No tabs 9/9, Packed 93.
Task 9: dispatched implementer a885af75fb5a2b008 (sonnet), base snap-t9
Task 9: implementer DONE: gate 356/356 both TZ, tsc 0, Packed 93, e2e 273/273, No tabs 9/9; largest src crypto-broker.js 288; innerHTML grep hit only dom.js BLOCKED guard set
Task 9: review ✅ Approved (sonnet); every README claim checked against source.
Task 9: minor (deferred): README:60 Replace summary omits "a Weekly export swaps tasks, notes and settings" and that Add never imports settings / the local webhook is kept.
Task 9: complete (snap-t9..snap-final, review clean).

## Final review
Package review-final.diff (snap-t1 → tree, 5219 lines). Dispatching opus final reviewer.
Final review (opus): Ready — no Critical/Important; 1 must-fix minor (T5-a uncaught trackingAllowed promises: welcome.js:44, settings-panel.js:70 .then without .catch; settings-panel.js:54 await outside try); security pass, parity L6/L7/F6/L8/D11/F7/W3 closed, all rulings hold; triage 1 must-fix / 12 Phase 6 / 13 wontfix; new can-wait minors: readBackup ignores export `version`; imported numeric settings not range-checked; Replace has no confirm/Undo. Upgrade risk (tabs required→optional on a 2.0 → 3.0 update) must be checked in Phase 6 on a real update. Full text review-final.md.
Ruling: F-W1 — ONE fix wave: T5-a, plus two one-liners folded (T8 broker-path non-quota storage error prefixed "Nothing was imported: "; README:60 Replace sentence completed — Weekly export swaps tasks, notes and settings; Add never imports settings; local Slack webhook kept) — cost if wrong: none.
Final fix wave: dispatched a879fee52938493d8 (sonnet), base snap-final
Final fix wave: re-review (sonnet) — 3/3 addressed, no new Critical/Important. Residual minors parked → Phase 6: broker catch returns a non-Error throw unprefixed; no test for the broker non-quota write path; page-path recheck() throw (sync) escapes the "Nothing was imported" prefix; settings-panel.js:110 getSettings().then(fillSettings) without .catch (pre-existing).
Ruling: F-R1 — residual fix-wave minors parked for Phase 6 (no second wave per process) — cost if wrong: rare unprefixed error text; one pre-existing unhandled read.
Controller gate (post-fix): npm test 356/356 both TZ; typecheck 0; Packed 93; no storage.sync; tabs+history optional only; innerHTML only in dom.js BLOCKED guard; largest src file crypto-broker.js 289.
Controller gate e2e (TZ=America/New_York, 18:01 local): 273/273 passed, No tabs: 9/9 passed.
Ruling: Workspace cleanup per caller — ledger copied to docs/superpowers/plans/2026-10-31-weekly-3-phase-5-ledger.md, review-final.md copied to docs/superpowers/plans/2026-10-31-weekly-3-phase-5-final-review.md (Phase-4 precedent; it is Phase 6's work list); snap-t1 kept; all other workspace files and scratchpad c5-* deleted — cost if wrong: per-task diffs/reports gone.
PHASE 5 COMPLETE.
