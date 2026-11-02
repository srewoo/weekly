# SDD ledger — plan: docs/superpowers/plans/2026-10-31-weekly-3-phase-2b-task-ui.md

Specs: docs/superpowers/specs/2026-10-31-weekly-merge-design.md, docs/superpowers/specs/2026-10-31-weekly-feature-parity.md (binding).
Constraints file for every dispatch: .superpowers/sdd/phase-2b/constraints.md (plan Global Constraints verbatim + no-git adaptations).
Ruling: No git (owner decision, carried from Phases 1/2a). Per task: `snap.sh phase-2b tN` before dispatch (t1 taken from post-2a tree), `pkg.sh phase-2b tN review-tN.diff` after = review package; fix rounds snapshot `tNfR` — cost if wrong: packages carry no commit messages; nothing functional.
Ruling: Implementers skip Commit/Update-the-checklist steps and never edit the plan; this ledger is the progress record — cost if wrong: plan checkboxes stay unticked (cosmetic).

## Pre-flight scan

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 ↔ T3 | doneThisWeek, getTasks (tasks.js), updateSettings(fn) used by footer Pause / Week tab | consistent names and signatures |
| T1 ↔ T4 | todayBands Band.key 'overdue'/'today'/UNDATED_KEY ↔ renderBands data-band; restoreTask ↔ task-actions.remove | consistent |
| T1 ↔ T5 | monthGrid DayCell, WORKWEEK re-export ↔ calendar-view.js | consistent |
| T1 ↔ T7 | doneRange, doneKey 'task:<id>', withoutExcluded ↔ categories-view data-key / excluded:<monday> | consistent |
| T2 ↔ T3 | addWeekNote, trackerStatus, onTrackingChanged ↔ footer.js | consistent |
| T2 ↔ T5 | getWeekNotes/addWeekNote/deleteWeekNote/notesOn ↔ day-sheet note slot | consistent |
| T3 ↔ T4 | T3 creates panel.js (TABS, openApp); T4 replaces it whole keeping TABS {id,label,mount,refresh} and openApp; undo.js toast/report/undoLast consumed | consistent (both versions export TABS) |
| T3 ↔ T4–T7 | full.mjs harness object t = {ctx,X,sw,check,watch,store,wait,shots,PAGES,iso,workday,weekend,focusTab}; each later task appends one module call | consistent; rollover check kept last (fake clock context-wide) |
| T3 ↔ T5 | build.mjs edited at :24 (side panel page) and :43 (#fragment in links) — distinct anchors | consistent |
| T4 ↔ T5/T6 | taskRow(task,{day,onEdit?,copy?}), add, bindKeys, onNewDay, report, renderBands | consistent |
| T5 ↔ T6 | T5 creates app.js/app.html/day-sheet.js; T6 replaces app.js whole (keeps #calendar, #day= routes, adds #tasks) and edits day-sheet.js rows for Edit… | consistent |
| T5 ↔ T7 | main.js: T5 adds openSettings import + `#settings` line; T7's last main.js anchor is that exact line; report.html: T5 edits :15 openSettings, T7 edits anonymize label | sequential anchors consistent (T7 must run after T5 — plan order) |
| T3 ↔ T7 | data-panel.js delete-all (T3) vs categories-view/draft-panel (T7) | distinct files |
| Global "ui never calls chrome.storage in new code" ↔ T3/T5/T7 | new UI uses week-notes.js/status.js; report edits are legacy R2 page | consistent |
| Global "mutate sync, no getTasks inside" ↔ T1 restoreTask, T2 week-notes (own NOTES_LOCK via withLock) | consistent |
| Global typecheck scope ↔ T3 jsconfig include | components/panel/app join from T3 | consistent |
| T1 self | planner tests vs planner.js in full; tasks-restore test vs restoreTask; settings append vs updateSettings(fn) | self-consistent |
| T2 self | week-notes/status tests vs full code | self-consistent |
| T3 self | popup deleted, its 7 e2e checks move to panel.mjs (15); idleSeconds 14400; delete-all renamed check | self-consistent |
| T4 self | band-state test + panel-tasks.mjs (19) vs components; panel.js replace | self-consistent |
| T5 self | app.mjs (20) vs calendar/day-sheet; #day= regex checks format only (an impossible date like 2026-13-45 is not "invalid date" per Interfaces table) | noted for review; not a conflict |
| T6 self | app-tasks.mjs (17) vs tasks-view/editor | self-consistent |
| T7 self | draft-done test (3) + done.mjs (8) vs draft.js/main.js edits | self-consistent |
| T8 self | README replaces; gate expects 200/200 per TZ, 63 files packed, e2e 176/176 | self-consistent |
| Plan-mandated rubric defects | tests asserting nothing / verbatim duplication | none found at scan |

Pre-flight: no conflicts requiring a ruling.
Ruling R1: Models — T1/T2 (complete code, pure lib + unit tests) haiku; T3–T8 (multi-file UI + e2e runs that may need env debugging) sonnet; reviewers sonnet; fix rounds 4–5 and final review opus — cost if wrong: a haiku task takes extra turns or one extra fix round.

## Progress
Note: snap-t1 re-taken by controller at setup before any task ran (tree unchanged since post-2a) — cost if wrong: none expected.
Task 1: dispatched (implementer haiku, base snap-t1)
Task 1: implementer DONE (187/187 per TZ, tsc ok); reviewer dispatched (sonnet, review-t1.diff)
Task 1: ⚠️ resolved by controller — npm test re-run 187/187 both TZ, tsc ok
Task 1: minor (deferred, plan-mandated): defaultPriority validated on write only; getSettings returns a stored invalid value unvalidated (createTask validates its own fallback per 2a); restoreTask coerces a no-id snapshot to a fresh id
Task 1: complete (snap-t1 → working tree, review clean)
Task 2: dispatched (implementer haiku, base snap-t2)
Task 2: implementer DONE_WITH_CONCERNS (193/193 per TZ, tsc ok; concern: non-today note ts = midnight+12h, off by 1h on DST days, day correct — observation); reviewer dispatched (sonnet)
Task 2: review — spec ✅, approved; controller promotes reviewer Minor 1 to Important: week-notes.js:32 noon = midnight+12h is a test date bomb (week-notes.test.js:21 asserts getHours()===12 for today−3; fails in New York when today−3 is a DST-change day, e.g. 2026-11-04 / 2027-03-17)
Ruling: Fix week-notes.js noon via the parsed local date with setHours(12) — deviates from the plan's verbatim code — why: spec §7 tests run in New York, and the plan's code fails there on DST days; cost if wrong: one line diverges from plan text.
Task 2: minor (deferred): addWeekNote with invalid iso silently stamps now; corrupt notes array element (null) throws in id calc; Math.max spread unbounded; NOTE_MAX truncation / notesOn empty / non-string error untested
Task 2: fix round 1 dispatched (resume implementer, base snap-t2f1)
Task 2: fix round 1 implementer DONE (194/194 per TZ — one new DST test, so phase total runs +1 over plan's 200; tsc ok); re-review dispatched (sonnet)
Task 2: fix round 1/5 (1 addressed, 0 open — DST noon date bomb)
Task 2: complete (snap-t2 → working tree, review clean after 1 fix round)
Task 3: dispatched (implementer sonnet, base snap-t3)
Task 3: implementer DONE (195/195 per TZ, tsc ok, e2e 112/112, weekend path); reviewer dispatched (sonnet)
Task 3: ⚠️ resolved by controller — app.html is created in Task 5 (plan order; dead link only between tasks); weekend/workday/WEEKDAYS/WORK_DAYS exist (e2e 112/112 + tsc green); ⌘Z and O handlers arrive in Task 4 (keys.js, panel.js replace)
Task 3: minor (deferred): void refresh()/renderTracking()/renderDone() lack .catch(report) (unhandled rejection, stale panel, not user-visible); undo.js toast/undoLast/report untested at unit level; #noteMsg never cleared; tabs lack arrow-key roving (fix with Phase 4 Notes tab)
Task 3: complete (snap-t3 → working tree, review clean)
Task 4: dispatched (implementer sonnet, base snap-t4)
Task 4: implementer DONE (198/198 per TZ, tsc ok, e2e 131/131 first run); reviewer dispatched (sonnet)
Task 4: review — spec ❌ Needs fixes (all plan-mandated: brief code verbatim). I1 untick offers no Undo; I2 guarded() treats a null write result (task gone) as success → false "Moved…" toast with Undo; I3 today-tab.js:21/41 void promises without catch (uiState write / initial load errors unreported); I4 test gaps (⌘Z-in-field rule, failure paths, unit tests for keys/task-actions)
Ruling: I1 fix — the brief's interface says every write except add and setPriority offers Undo, and toggle is one write — cost if wrong: one extra toast on untick.
Ruling: I2 fix — a null result from updateTask/setDone/toggleOn/copyToDay is reported in plain words ("That task no longer exists…") and returns false; spec §6 says a failed write is never silent — cost if wrong: deviation from plan code of a few lines.
Ruling: I3 fix — .catch(report) on both, spec §6 — cost if wrong: none.
Ruling: I4 partially — add one e2e check "[Keys] ⌘Z / Ctrl+Z in a text field is left to the field" in panel-tasks.mjs (headline key rule); unit tests of DOM-bound task-actions/keys deferred (no DOM in node tests; e2e covers flows) — cost if wrong: failure-path UI untested until final review; phase e2e total becomes 177 (plan 176).
Task 4: minor (deferred): copyToDay null toast text misleading; moveToTomorrow with 0 eligible toasts "Moved 0"; Move-all undo is N non-atomic writes; initial getTasks may overwrite a newer onTasksChanged snapshot; double-Enter double add; focus left in ⋯ select suppresses keys; bands.js:31 indentation
Task 4: fix round 1 dispatched (resume implementer, base snap-t4f1)
Task 4: fix round 1 implementer DONE (198/198 per TZ, tsc ok, e2e 132/132); re-review dispatched (sonnet)
Task 4: fix round 1/5 (4 addressed, 0 open — untick undo, null-result-as-gone, catch(report), ⌘Z-in-field e2e)
Task 4: minor (deferred): applied() maps every null (toggleOn not-occurring, wrong repeat type) to "task no longer exists"; undo callbacks don't check null (shows "Undone."); tasks:stale re-renders from cache and is only heard by today-tab — Tasks 5/6 told to listen for it; Gone path / Reopened toast have no dedicated test
Task 4: complete (snap-t4 → working tree, review clean after 1 fix round)
Task 5: dispatched (implementer sonnet, base snap-t5)
Task 5: implementer DONE (198/198 per TZ, tsc ok, e2e 152/152; RED failed at build ref check — real failure, different cause); reviewer dispatched (sonnet)
Task 5: ⚠️ resolved by controller — rolloverCheck still last (full.mjs:381, after all module calls); monthGrid/h(style) covered by e2e 152/152
Task 5: minor (deferred): app.js tasks:stale re-read lacks .catch(report) and may race onTasksChanged (Task 6 replaces app.js — told to keep the listener with .catch(report)); hashchange to invalid #day leaves the sheet open; day-sheet notes read only on open; no e2e for invalid #day fallback, report#settings, #openApp link (plan-mandated gaps)
Task 5: complete (snap-t5 → working tree, review clean)
Task 6: dispatched (implementer sonnet, base snap-t6)
Task 6: implementer DONE (198/198 per TZ, tsc ok, e2e 169/169); reviewer dispatched (sonnet)
Task 6: review — spec ❌ Needs fixes: I1 app.html editor: Cancel is the form's first submit button, so Enter in #eTitle cancels the edit (plan-mandated markup, real bug); I2 task-editor.js:37 void save() swallows updateTask failure; I3 tasks-view.js:55 void updateUiState swallows failure
Ruling: Fix I1–I3 against plan text (Cancel → type="button" closing with 'cancel', or Save first; .catch(report) on both writes) and add one e2e check "[Tasks] Enter in the title saves the edit"; also roll in Minor 1 (.catch(report) on getUiState load) — why: spec §6 failed writes are never silent; D5 edit must work from the keyboard — cost if wrong: phase e2e total +1 over plan (178).
Task 6: minor (deferred): editor Undo restores the snapshot taken at open (stale if changed meanwhile); no e2e for editor Undo / Cancel-unchanged; getUiState load doesn't re-render
Task 6: fix round 1 dispatched (resume implementer, base snap-t6f1)
Task 6: fix round 1 implementer DONE (198/198, tsc ok, e2e 170/170); re-review dispatched (sonnet)
Task 6: fix round 1/5 (3 addressed, 0 open — editor Enter cancels, save swallow, uiState swallow)
Task 6: minor (deferred): .catch(report) paths covered only by inspection (no forced-rejection test)
Task 6: complete (snap-t6 → working tree, review clean after 1 fix round)
Task 7: dispatched (implementer sonnet, base snap-t7)
Task 7: implementer DONE_WITH_CONCERNS (201/201 per TZ, tsc ok, e2e 178/178) — concern: changed 2 done.mjs expectations (3 done tasks, "- Read the Q4 plan") because the fixture had 3 done tasks. Controller root cause: Task 4 fix-round's added ⌘Z-in-field check (panel-tasks.mjs:60-65) ticks "Read the Q4 plan" and never unticks it — our deviation leaked state, the plan's done.mjs was right.
Ruling: Restore the fixture at its source — the ⌘Z-in-field check unticks "Read the Q4 plan" after asserting — and revert done.mjs to the plan's expectations — why: the extra check must be side-effect-free so later plan checks run on the plan's fixture — cost if wrong: one fix round on test files only.
Task 7: reviewer dispatched (sonnet)
Task 7: review — spec ✅ approved; only the known done.mjs fixture coupling (controller ruling above)
Task 7: minor (deferred): getTasks() in report Promise.all — a task-storage failure blanks the whole report (W1 isolation); dead `to < from` guard; Done-only UI case untested; draft.js:51 precedence parens; no recurring-only / all-excluded unit cases
Task 7: fix round 1 dispatched (resume implementer: untick in ⌘Z-in-field check, revert done.mjs to plan expectations; base snap-t7f1)
Task 7: fix round 1 implementer DONE (201/201, e2e 179/179 — restore confirmed by a new check '[Keys] tick is undone'); re-review dispatched (sonnet)
Task 7: fix round 1/5 (1 addressed, 0 open — fixture leak fixed at source, done.mjs back to plan text)
Task 7: complete (snap-t7 → working tree, review clean after 1 fix round)
Task 8: dispatched (implementer sonnet, base snap-t8)
Task 8: implementer DONE (201/201 per TZ, tsc ok, Packed 63 files, e2e 179/179, Step 2 checks clean); reviewer dispatched (sonnet)
Task 8: complete (snap-t8 → working tree, review clean)
Final review: dispatched (opus, package review-final.diff = snap-t1 → working tree)
Final review: Ready with fixes — Important: F1 Stop-repeating undo wipes earlier until; F2 editor "Saved." on null (task gone) and undo callbacks say "Undone." on null; F3 untick undo re-stamps completedAt (W2: last week's task joins this week's Done). Minor: uiState dayState whole-object writes from panel+app; notes RMW outside NOTES_LOCK in report/worker (pre-existing); read-path unhandled rejections (app init, day-sheet, week-tab, footer, panel); recurring undo flips via toggleOn; Move-all undo restores skipped tasks; daily add from past day's sheet starts today; overlapping report load() ordering; store-assets privacy-policy.html:69 "toolbar popup" + generate.mjs:167 opens popup.html. All 33 deferred minors triaged can-wait.
Ruling: One fix wave covers F1–F3 (plus null-check on undo callbacks, folded into F2) — why: undo must restore the prior state (D6) and failures are never silent (§6) — cost if wrong: small signature additions restoreRecurring(id, until?) and setDone(id, done, at?) diverge from Daybook.
Ruling: store-assets popup references parked for the next store submission (Phase 5 release) — why: outside src/ and the review package, no runtime effect — cost if wrong: stale privacy-policy wording/screenshot script until then.
Ruling: Remaining final-review minors parked to their owning phases (uiState lock + read-path catches → Phase 3; notes RMW → Phase 4; past-day daily add hint, Move-all skipped restore, toggleOn flip, report load ordering → final polish) — cost if wrong: rare races/cosmetic confusion until then.
Final fix wave: dispatched (one implementer, sonnet, base snap-final, findings in final-findings.md)
Final fix wave: implementer DONE (203/203 per TZ, tsc ok, e2e 179/179); scoped re-review dispatched (sonnet, review-fix.diff)
Final fix wave: re-review — F1–F3 all ADDRESSED, no new breakage
Final: parked — delete-undo when the id already exists says "That task no longer exists, so nothing was changed." — Ruling: acceptable; second half true, path needs an id restored elsewhere — cost if wrong: one misleading toast in a rare race.
Final: minor (deferred): Move-all undo with one task gone says "nothing was changed" though others restored; editor GONE path doesn't dispatch tasks:stale; F2 paths untested
Final fix wave: complete
Phase gate: npm run package — exit 0; tests 203/203 (New York) and 203/203 (Kolkata); typecheck clean; "Packed 63 files → dist/weekly-2.0.0.zip (94.7 KB)"
Phase gate: npm run e2e — "179/179 passed" (headless), 0 failed
Phase gate: no storage.sync in src; largest src files schema.js 250, tasks.js 229; no src/test file over 300 lines except test/e2e/full.mjs (396, carried exception)
Count deltas vs plan (200 unit / 176 e2e): +1 DST unit test (T2), +2 final-wave unit tests (F1, F3); +3 e2e checks ([Keys] ⌘Z in a text field is left to the field; [Tasks] Enter in the title saves the edit; [Keys] the tick is undone, fixture restored)
Ruling: Workspace cleanup per owner — ledger copied to docs/superpowers/plans/2026-10-31-weekly-3-phase-2b-ledger.md; snap-t1 kept until owner confirms; all other workspace files (snaps, briefs, reports, diffs, logs) and c2b-* scratch dirs deleted — cost if wrong: per-task diffs and reports are gone.
