# SDD ledger — plan: docs/superpowers/plans/2026-10-31-weekly-3-phase-2a-data.md

Specs: docs/superpowers/specs/2026-10-31-weekly-merge-design.md, docs/superpowers/specs/2026-10-31-weekly-feature-parity.md (binding).
Constraints file for every dispatch: .superpowers/sdd/phase-2a/constraints.md (plan Global Constraints verbatim + no-git adaptations).
Ruling: No git (owner decision, carried from Phase 1). Per task: `snap.sh phase-2a tN` before dispatch, `pkg.sh phase-2a tN review-tN.diff` after = review package; fix rounds snapshot `tNfR` — cost if wrong: packages carry no commit messages; nothing functional.
Ruling: Implementers skip Commit/Update-the-checklist steps and never edit the plan; this ledger is the progress record — cost if wrong: plan checkboxes stay unticked (cosmetic).

## Pre-flight scan

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 ↔ T2 | schema.js migrate/coerceUiState/coerceReminderState/defaultReminderState/SCHEMA_VERSION consumed by storage.js | consistent names |
| T1 ↔ T3 | PRIORITY_RANK, PRIORITIES, UNDATED_KEY, TITLE_MAX, DESC_MAX, newId, coerceDays, Task.repeat/doneDates | consistent |
| T1 ↔ T4 | coerceTaskList | consistent |
| T1 ↔ T5 | T1 drops Daybook's 5 coerceSettings/defaultPopupView tests; T5 adds only defaultPriority to Weekly DEFAULTS | consistent (reminder settings → Phase 3) |
| T2 ↔ T3 | mutate/getTasks consumed by tasks.js; Daybook storage.test.js ported in T3 seeds schemaVersion 1 | consistent; storage.js has no settings fns — Daybook storage.test.js must not need them (author ran it green) |
| T2 ↔ T4 | getTasks/replaceTasks/mutate | consistent |
| T2 ↔ T5 | withLock(name, fn) consumed by settings.js with SETTINGS_LOCK='weekly:settings' (T5) vs TASKS_LOCK='weekly:tasks' (T2) | consistent; settings.js → storage.js → schema.js import chain now loaded by UI pages and SW (build copies src/ wholesale) |
| T3 internal | tasks.js re-exports task-views.js + recurrence.js; recurrence imports schema PRIORITY_RANK; tasks imports occursOn | no cycle (views/recurrence don't import tasks.js) |
| T3 ↔ T6 | tasks-week.test.js (Daybook week.test.js renamed) vs Weekly test/week.test.js extended in T6 | distinct files, no clash |
| T5 ↔ T8 | e2e 104/104 gate in both; no UI change | consistent |
| Global "no getTasks() at worker startup" ↔ T5 | T5 wires only onSettingsChanged into SW | consistent |
| Global "src/ui unchanged" ↔ all | no task lists a src/ui file | consistent |
| Global "no storage.sync" ↔ T2/T8 | Daybook's sync settings section removed in T2; T8 greps | consistent |
| T1 self | 11 ported + v2 tests vs schema.js written in full | self-consistent (grep count 11 check) |
| T2 self | uistate test relative to today (date bomb fixed); storage-v2 asserts lock names via fake navigator.locks | self-consistent |
| T3 self | sed ranges of Daybook tasks.js + new code; size targets ~210/100/210 | self-consistent; sed line ranges verified by author on scratch copy |
| T4 self | sed '14,17p;54,128p' of Daybook portability.js; one-line test import edit | self-consistent |
| T5 self | characterisation test first (behaviour-neutral rewire), then settings tests, rewrite, e2e | self-consistent |
| T6 self | failing tests then week.js fix | self-consistent |
| T7 self | golden test captured against current code before split | self-consistent; golden must pass pre-change |
| T8 self | manifest test RED then CSP; README; full gate | self-consistent |
| Plan-mandated rubric defects | tests asserting nothing / verbatim duplication | none found |

Pre-flight: no conflicts requiring a ruling.
Ruling R1: Models — T1/T2/T4/T6 (complete code / cp+sed transcription) haiku; T3 (three new modules + five test files), T5 (worker + e2e), T7 (behaviour-preserving split), T8 (gate + e2e) sonnet; reviewers sonnet; fix rounds 4–5 and final review opus — cost if wrong: a haiku task takes extra turns or one extra fix round.

## Progress
Task 1: dispatched (implementer haiku, base snap-t1)
Task 1: implementer DONE (88/88 per TZ, tsc ok); reviewer dispatched (sonnet, review-t1.diff)
Task 1: ⚠️ resolved by controller — npm test re-run green both TZ, tsc ok
Task 1: minor (deferred): coerceUiState/UNDATED_KEY untested (cover when first used); migrate reports changed:false when coerceTaskList drops junk at current version, and rewrites future-version data as v2 (Daybook parity); task without createdAt gets Date.now() per coerce (non-idempotent, inherited)
Task 1: complete (snap-t1 → working tree, review clean)
Task 2: dispatched (implementer haiku, base snap-t2)
Task 2: implementer DONE (99/99 per TZ, tsc ok); reviewer dispatched (sonnet)
Task 2: ⚠️ resolved by controller — npm test re-run green both TZ, tsc ok
Task 2: minor (deferred, plan-mandated): getTasks() migration write-back runs outside withLock — first read after upgrade racing a mutate could overwrite it (flag for final review)
Task 2: minor (deferred): no test of two concurrent mutate() calls under the fallback chain; storage-v2 test resets navigator to {} instead of restoring
Task 2: complete (snap-t2 → working tree, review clean)
Task 3: dispatched (implementer sonnet, base snap-t3)
Task 3: implementer DONE_WITH_CONCERNS (146/146 per TZ, tsc ok; sizes 195/88/210) — concern 'cp overwrote an existing test/storage.test.js' checked by controller: snap-t3 has no storage.test.js (only storage-v2.test.js), so nothing was lost; reviewer dispatched (sonnet)
Task 3: ⚠️ resolved by controller — storage.test.js absent from snap-t1/snap-t3 (already confirmed); npm test re-run green both TZ, tsc ok
Task 3: minor (deferred, plan-mandated/Daybook parity): toggleDone reads via getTasks() then setDone in a separate mutate — concurrent write can flip on stale state (fold into one patchOne)
Task 3: minor (deferred): occurrences() recomputes daysBetween per loop iteration (polish)
Task 3: complete (snap-t3 → working tree, review clean)
Task 4: dispatched (implementer haiku, base snap-t4)
Task 4: implementer DONE (156/156 per TZ, tsc ok); reviewer dispatched (sonnet)
Task 4: ⚠️ resolved by controller — npm test re-run green both TZ, tsc ok
Task 4: minor (deferred, Daybook parity): replaceAll/deleteEverything count via getTasks() then write in a separate lock — `removed` may be stale under a concurrent write (single mutate fixes); keep 'daybook.tasks' format string in Phase 5
Task 4: complete (snap-t4 → working tree, review clean)
Task 5: dispatched (implementer sonnet, base snap-t5)
Task 5: implementer DONE (162/162 per TZ, tsc ok, e2e 104/104); reviewer dispatched (sonnet)
Task 5: ⚠️ resolved by controller — npm test re-run green both TZ, tsc ok; e2e 104/104 in report (re-run at phase gate); chrome-stub supports listeners/set replacement (tests green)
Task 5: minor (deferred): SW test "other areas/keys" only asserts alarm absent after test 1 cleared it (weak), 30 ms timing wait (plan-mandated); defaultPriority not validated on write (Phase 2b must validate; createTask already validates fallback)
Task 5: complete (snap-t5 → working tree, review clean)
Task 6: dispatched (implementer haiku, base snap-t6)
Task 6: implementer DONE (165/165 per TZ, tsc ok); reviewer dispatched (sonnet)
Task 6: ⚠️ resolved by controller — npm test re-run green both TZ, tsc ok
Task 6: minor (deferred): week.js:25 JSDoc prose and @param on one line (plan formatting)
Task 6: complete (snap-t6 → working tree, review clean)
Task 7: dispatched (implementer sonnet, base snap-t7)
Task 7: implementer DONE (golden 42 rows green on old code; 166/166 per TZ, tsc ok; classify.js 203 lines, max fn 18); reviewer dispatched (sonnet)
Task 7: ⚠️ resolved by controller — npm test re-run green both TZ, tsc ok, classify.js 203 lines
Task 7: minor (deferred): golden rows run in one test() (first mismatch hides the rest; plan-mandated); no rows for Teams, outlook.office365/live, confluence host non-/wiki path, non-atlassian.net Jira board-vs-issue
Phase 1 parked finding (classify > 50 lines): resolved by Task 7
Task 7: complete (snap-t7 → working tree, review clean)
Task 8: dispatched (implementer sonnet, base snap-t8)
Task 8: implementer DONE (167/167 per TZ, tsc ok, e2e 104/104); reviewer dispatched (sonnet)
Task 8: ⚠️ resolved by controller — no storage.sync in src (grep), largest src file 250 lines; e2e 104/104 in report (re-run at phase gate)
Task 8: minor (deferred): README task-portability.js description misaligned (plan text); manifest test doesn't pin absence of a weaker sandbox CSP
Task 8: complete (snap-t8 → working tree, review clean)
Final review: dispatched (opus, package review-final.diff = snap-t1 → working tree)
Final review: With fixes — Important: toggleDone read-then-write (reproduced: double toggle ends done); getTasks migration write-back outside withLock; plan-level: schemaVersion 2 stamped before notes migrate (Phase 4). Minor: replaceAll/deleteEverything stale counts; reschedule no date validation; uiState/reminderState RMW unlocked; sameDay duplicates toISODate; popup pause toggle RMW; catch(e) unused.
Ruling: Fix wave covers F1 toggleDone single patchOne, F2 getTasks migration persisted via mutate under the lock, F3 replaceAll/deleteEverything single mutate, F4 reschedule validates date, F5 catch{} — deviates from the plan's Daybook-parity code because Phase 2b's UI calls these directly and spec §4 requires one serialised mutate() — cost if wrong: ~30 lines diverge from Daybook; ports no longer byte-comparable.
Ruling: schemaVersion 2 now versions the tasks blob only; Phase 4 must bump to v3 for the notes migration or detect Weekly 2 notes by shape, not gate on schemaVersion < 2 — parked to the Phase 4 plan — why: spec §4 bundles notes into v2 but the plan deliberately defers notes — cost if wrong: notes never migrate on profiles that ran 2a/2b code.
Ruling: updateUiState/updateReminderState lock deferred to Phase 3 (reminderState gains a second writer then); popup pause read-then-write deferred to 2b (src/ui frozen in 2a; let updateSettings accept a function); sameDay→toISODate cosmetic, deferred — cost if wrong: rare lost uiState toggle until Phase 3.
Final fix wave: dispatched (one implementer, sonnet, base snap-final, findings in final-findings.md)
Final fix wave: implementer DONE (172/172 per TZ, tsc ok, e2e 104/104); scoped re-review dispatched (sonnet, review-fix.diff)
Final fix wave: re-review — F1–F5 all ADDRESSED, no new breakage; residual note: a future async mutate callback calling getTasks() on a migrating profile would deadlock (Web Locks non-re-entrant) — document in Phase 2b
Final: minor (deferred): F2 "no clobber" test is a pin, not a race repro (stub is single-threaded); replaceTasks now unused outside storage.js
Final fix wave: complete
Phase gate: npm run package — exit 0; tests 172/172 (New York) and 172/172 (Kolkata); typecheck clean; "Packed 44 files → dist/weekly-2.0.0.zip (68.8 KB)"
Phase gate: npm run e2e — "104/104 passed"
Ruling: No git → keep this ledger as docs/superpowers/plans/2026-10-31-weekly-3-phase-2a-ledger.md and delete only snapshots/review diffs in the workspace (briefs, reports, constraints, progress.md kept) — cost if wrong: per-task diffs are gone
