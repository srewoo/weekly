# SDD ledger — plan: docs/superpowers/plans/2026-10-31-weekly-3-phase-3-reminders.md

Specs: docs/superpowers/specs/2026-10-31-weekly-merge-design.md, docs/superpowers/specs/2026-10-31-weekly-feature-parity.md (binding). Rows to close: D7 (evening move-all), D8, D9, D10. W1 regression gate.
Constraints file for every dispatch: .superpowers/sdd/phase-3/constraints.md (plan Global Constraints verbatim + no-git adaptations).
Ruling: No git (owner decision, carried from Phases 1/2a/2b). Per task: `snap.sh phase-3 tN` before dispatch (t1 taken from verified post-2b tree), `pkg.sh phase-3 tN review-tN.diff` after = review package; fix rounds snapshot `tNfR` — cost if wrong: packages carry no commit messages; nothing functional.
Ruling: Implementers skip Commit steps and never edit the plan; this ledger is the progress record — cost if wrong: plan checkboxes stay unticked (cosmetic).

## Pre-flight scan
Full per-block table (77 plan edit blocks, replayed in order on a scratch copy of the real tree: 248/248 unit per TZ, tsc clean after R-A): .superpowers/sdd/phase-3/preflight.md (opus scan). Summary:

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 self | storage-locks tests vs updateUiState(fn)/updateReminderState under locks | blocks #5/#6 drift: today-tab.js:24, tasks-view.js:56 now `updateUiState(...).catch(report)` (2b fix) not `void updateUiState(...)` → R-A |
| T1 ↔ T3/T4 | updateReminderState (T1) ↔ fire()/snooze() (T4); updateUiState(fn) ↔ remind.js bands | consistent |
| T2 ↔ T3/T4/T5 | buildPayload/ReminderPayload/SLOTS/headline/subline/notificationText ↔ remind.js, engine, settings | consistent |
| T2 self | settings.js replaced whole: no 2b behaviour dropped (verified) | clean |
| T3 self | remind.js uses taskRow/renderBands/moveToTomorrow (task-actions resolve true/false) | no tasks:stale listener; `void init()` uncaught → R-B |
| T3 ↔ T4 | remind.js message types reminder:preview/snooze ↔ worker onMessage | consistent |
| T4 self | service-worker.test.js replaced whole: matches plan's expected base | clean |
| T4 ↔ T5 | reminder-settings Preview ↔ reminder:preview; onSettingsChanged reschedule | consistent |
| T4 ↔ T6 | onCommand listener in worker, sidePanel.open outside serial | consistent |
| T5/T6 ↔ T7 | README anchors, size table | tasks.js 229 not 227 (count drift only) |
| full.mjs harness / PAGES / chrome-stub / build | used by T3–T6 | compatible |
| setDone / restoreRecurring | not called directly by plan | no drift |
| Plan-mandated rubric defects | asserting-nothing tests / duplication | none found |
| 2b-parked read-path catches | not in plan | → R-C |
| 2b-parked invalid #day e2e | not in plan | → R-D |

Corrected counts (real = plan +3 unit / +3 e2e, plus R-D's +1 e2e from T3 on): T1 206/179; T2 216/179; T3 216/189 (checks before 5c 137); T4 245/197; T5 245/201 (through engine 156… +1 after R-D = 157); T6 248/202; T7 248 per TZ ("203 + 45"), Packed 69, e2e 202/202; size check tasks.js 229, remind.js 88 (R-B).

Ruling R-A: T1 band toggles use the plan's function form keeping 2b's catch: `updateUiState((cur) => ({ dayState: { ...cur.dayState, [key]: v } })).catch(report)` — why: plan intent + 2b §6 fix; both callers are the only updateUiState writers in src — cost if wrong: none (mechanical).
Ruling R-B: T3 remind.js adds `window.addEventListener('tasks:stale', …)` re-render (with .catch(report)) and `init().catch(report)` — why: spec §6 failures never silent; 2b task-actions dispatch tasks:stale on failed/gone writes and every other task page listens — cost if wrong: +2 lines over plan code (remind.js 88).
Ruling R-C: the 2b-parked read-path catches fold into Task 1 (same concern: uiState/read paths in panel+app): `.catch(report)` on week-tab.js:33/39/40/41, footer.js:37/38, panel.js:42 (+ tab-open calls 36/40), day-sheet.js:38/59, week-tab.js:38, app.js:67 — why: 2b final review parked them to Phase 3; mechanical, no count change — cost if wrong: Task 1 diff touches 5 extra files.
Ruling R-D: the 2b-parked e2e check "invalid #day= falls back to #calendar" goes into Task 3 in test/e2e/reminders.mjs next to "[Reminder] \"Open Weekly\" opens that day in the app" (reminders link to that route) — why: owner asked for it in this phase; reminders.mjs is the plan's home for new e2e — cost if wrong: +1 e2e over every later plan count (final 202).
Ruling R1: Models — T1 sonnet (lock code complete but R-A/R-C touch 7 files); T2 haiku (complete pure code + unit tests); T3–T6 sonnet (multi-file UI + e2e); T7 sonnet; reviewers sonnet; fix rounds 4–5 and final review opus — cost if wrong: extra turns / fix round.

## Progress
Task 1: dispatched (implementer sonnet a696c3dd, base snap-t1; R-A, R-C carried)
Task 1: implementer DONE (206/206 per TZ, tsc ok, e2e 179/179); reviewer dispatched (sonnet, review-t1.diff)
Task 1: review — spec ✅, approved; ⚠️ counts resolved by controller (npm test 206/206 both TZ, tsc clean)
Task 1: minor (deferred): resetReminderState writes reminderState without REMINDER_LOCK (no caller in src yet); storage-locks race tests run on the fallback chain, third test checks lock names only (plan-mandated)
Task 1: complete (snap-t1 → working tree, review clean)
Task 2: dispatched (implementer haiku ad4225bc, base snap-t2)
Task 2: implementer DONE (216/216 per TZ, tsc ok, e2e 179/179); reviewer dispatched (sonnet, review-t2.diff)
Task 2: review — spec ✅, approved
Task 2: minor (deferred): settings.js:13 "fresh copies" comment true only for morning/evening/days (ignoreDomains/rules/ticketPrefixes share frozen DEFAULTS arrays, pre-existing); overdue in reminders.js does not filter repeat===null (plan-mandated); notificationText "no titles" by construction, no titled-task assertion; Weekly 2 `reminder` flag kept in Task 2 — final review to confirm drop-at-next-write lands (plan Decisions)
Task 2: complete (snap-t2 → working tree, review clean)
Task 3: dispatched (implementer sonnet af3ac87b, base snap-t3; R-B, R-D carried)
Task 3: implementer DONE_WITH_CONCERNS (216/216 per TZ, tsc ok, e2e 189/189; concern: RED e2e step skipped; remind.js 77 lines now — plan 86 is the end-of-phase size after Task 4); reviewer dispatched (sonnet, review-t3.diff)
Task 3: review — spec ✅, approved
Task 3: minor (deferred): tasks:stale listener uses .then/.catch chain (R-B); empty-morning subline "You closed N today and nothing rolled over." reads oddly (plan-mandated); reminders.mjs days reset not in finally, seeded tasks persist in storage (harmless now); RED e2e step skipped by implementer
Task 3: complete (snap-t3 → working tree, review clean)
Task 4: dispatched (implementer sonnet a899b04a, base snap-t4; expected 245 unit / 197 e2e)
Task 4: implementer DONE (245/245 per TZ, tsc ok, e2e 197/197; engine RED not observed); reviewer dispatched (opus — engine/alarms/concurrency risk, review-t4.diff)
Task 4: review (opus) — spec ✅, approved; 3 Important, all plan-mandated: I1 a late (missed, fired on wake) or past-midnight snooze alarm runs fire() with today() → evening shown at breakfast, marked shown, tonight's real check skipped; I2 fire() throwing skips rescheduleAll → alarm chain dead until restart; I3 Weekly 2 profile with no stored `reminder` boolean (no settings saved, or only {paused}) upgrades with both reminders ON
Ruling: I1 fix — an alarm whose scheduledTime falls on an earlier local day than today does not fire (just reschedules); catch-up covers startup — why: D8 "evening check" means today's evening; a stale fire also eats tonight's real check — cost if wrong: a check missed during sleep is not shown late (catch-up still shows on browser start).
Ruling: I2 fix — `try { await fire } finally { await rescheduleAll }` in the alarm route — why: one-shot chain must survive a failed fire; failure still reaches the badge via serial() — cost if wrong: none.
Ruling: I3 fix — on runtime.onInstalled reason 'update', if the stored settings blob has no `morning` object, persist both slots' enabled = (stored.reminder === true) under the settings lock before setup's rescheduleAll — why: plan Decision "an upgrade never starts opening windows nobody asked for"; Weekly 2's default was off — cost if wrong: a Weekly 2 user who never saved settings must turn reminders on in Settings.
Ruling: promote Minor 1 (forced fire — Preview/snooze — marks the slot shown, so a Preview+Snooze before 18:00 skips the real check) and Minor 2 (a pending snooze survives disabling the evening/all reminders) into this fix round — why: both silently break D8's evening check; each is a 1–2 line change — cost if wrong: small deviation from plan code.
Task 4: minor (deferred): snoozeUntil written never read; worker answers {ok:true} before queued snooze runs (page report() can't fire); notifications requireInteraction never cleared on dismiss; catchUp(from) vs fire() today(); KEEP list needs a "add new alarms here" comment; e2e days seed crosses midnight edge; engine RED not observed
Task 4: fix round 1 dispatched (resume implementer, base snap-t4f1)
Task 4: fix round 1 implementer DONE (250/250 per TZ = 245 + 5 new, tsc ok, e2e 197/197; existing test "Friday alarm is cleared on update" now seeds {reminder:true} because of I3); re-review dispatched (sonnet)
Task 4: fix round 1/5 (5 addressed, 0 open — stale alarm, fire/reschedule finally, Weekly 2 upgrade off, forced fire no mark, snooze cleared when evening off)
Task 4: minor (deferred): a stale snooze is dropped silently
Count deltas now: unit +5 over plan from T4 (fix round) → T5 expects 250, T6 253, gate 253 per TZ; e2e unchanged (T5 201, T6 202, gate 202).
Task 4: complete (snap-t4 → working tree, review clean after 1 fix round)
Task 5: dispatched (implementer sonnet aa1a92ce, base snap-t5; expect 250 unit / 201 e2e)
Task 5: implementer DONE (250/250 per TZ, tsc ok, e2e 201/201); reviewer dispatched (sonnet, review-t5.diff)
Task 5: review — spec ✅, approved
Task 5: minor (deferred, plan-mandated): settings-panel.js saveSettings has no try/catch (pre-existing; §6 wants a plain-words failure) — final review to triage; a cleared time input silently resets to default while saying "Settings saved."; Preview check doesn't assert the morning alarm unchanged; input[type=time] CSS alignment unverified in a browser
Task 5: complete (snap-t5 → working tree, review clean)
Task 6: dispatched (implementer sonnet a686ab8d, base snap-t6; expect 253 unit / 202 e2e)
Task 6: implementer DONE (253/253 per TZ, tsc ok, e2e 202/202); reviewer dispatched (sonnet, review-t6.diff)
Task 6: review — spec ✅, approved
Task 6: minor (deferred, plan-mandated): open-panel silent no-op when tab.windowId undefined; e2e registration check fails spuriously if another extension holds the key; no unit test for sidePanel.open rejecting / unknown command
Task 6: complete (snap-t6 → working tree, review clean)
Task 7: dispatched (implementer sonnet aed6924b, base snap-t7; expect 253 / Packed 69 / e2e 202)
Task 7: implementer DONE (253/253 per TZ, tsc ok, Packed 69, e2e 202/202; sizes reminders.js 142, remind.js 87, service-worker.js 109, tasks.js 229); reviewer dispatched (sonnet)
Task 7: review — spec ✅, approved (gate per gate.log: 253/253 both TZ, tsc clean, Packed 69, e2e 202/202)
Task 7: minor (deferred): README "it always shows" holds only for an enabled slot on a working day (plan-mandated); README silent on Weekly 2 upgrade keeping reminders off and on a check missed during sleep being dropped
Task 7: complete (snap-t7 → working tree, review clean)
Final review: dispatched (opus, package review-final.diff = snap-t1 → working tree)
Final review (opus): Ready with fixes — I1 fresh 3.0 install never writes settings, so migrateFridayFlag (my Task 4 I3 ruling) turns both reminders off at the next extension update (reproduced in scratch c3-final); I2 snooze set ≥23:00 fires 00:xx next day, not caught by the stale check → evening window after midnight; must-fix minor m1 settings-panel Save and welcome writes lack plain-words failure (§6). All other deferred minors can wait (triage in review-final.md); Weekly 2 `reminder` flag drop-at-next-write confirmed by settings.test.js:108.
Ruling: F-I1 fix — on onInstalled reason 'install', queue `updateSettings({})` (persists the full validated settings incl. morning/evening) before setup; add a test install→update keeps both on — why: my I3 ruling's "no morning object = Weekly 2" heuristic is only true if 3.0 always persists settings; manifest version is still 2.0.0 so previousVersion can't discriminate — cost if wrong: one extra storage write on install.
Ruling: F-I2 fix — judge the snooze alarm by the day it was set (scheduledTime − 60 min) for staleness; one worker test — why: D8 evening check belongs to its own day — cost if wrong: a snooze set just before midnight still shows at 00:xx the same night (intended).
Ruling: F-m1 fix — `.catch`/try around settings-panel Save and welcome-page writes with a plain-words message — why: spec §6 — cost if wrong: none.
Final fix wave: dispatched (one implementer, sonnet, base snap-final)
Final fix wave: implementer DONE (255/255 per TZ, tsc ok, Packed 69, e2e 202/202, no storage.sync; added SNOOZE_MINUTES=60 export and welcome #saveMsg status line; failure paths untested); scoped re-review dispatched (sonnet, review-fix.diff)
Final fix wave: re-review — F-I1, F-I2, F-m1 all ADDRESSED, no new breakage
Final: minor (deferred): snooze-midnight test asserts only "no window" (would pass if the snooze never fired); settings-panel/welcome failure paths untested (pages outside unit/typecheck scope)
Ruling: Remaining final-review minors parked to owning phases per review-final.md triage — m2 notification never cleared on dismiss → Phase 6; m3 cleared time input saves default → Phase 5; m4 runtime.onMessage sender check → Phase 4 (binding, with the content script); m5 overdue repeat filter → Phase 5 (Daybook import); resetReminderState lock → Phase 5; snoozeUntil unused → Phase 5; KEEP comment → Phase 4; README upgrade/sleep notes → Phase 6 — cost if wrong: cosmetic/rare-edge issues until then; m4 becomes a real hole only once Phase 4 adds a content script.
Final fix wave: complete
Phase gate (controller re-run): npm run package — tests 255/255 (New York) and 255/255 (Kolkata), typecheck exit 0, "Packed 69 files → dist/weekly-2.0.0.zip (105.9 KB)"; npm run e2e — "202/202 passed", 0 failed; no storage.sync in src; largest src files schema.js 250, tasks.js 229, classify.js 203; only test/e2e/full.mjs (401) over 300 lines.
Count deltas vs plan (245 unit / 198 e2e): +3 unit and +3 e2e from Phase 2b's real tree; +5 unit (Task 4 fix round: stale alarm, finally-reschedule, Weekly 2 upgrade off, forced fire no mark, snooze cleared); +2 unit (final wave: install→update keeps reminders, midnight snooze); +1 e2e (R-D invalid #day= falls back to the calendar).
Ruling: Workspace cleanup per owner — ledger copied to docs/superpowers/plans/2026-10-31-weekly-3-phase-3-ledger.md; snap-t1 kept; all other workspace files (snaps, briefs, reports, reviews, diffs, preflight) deleted — cost if wrong: per-task diffs/reports gone (review-final.md content summarised in this ledger and the final report).
