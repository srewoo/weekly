# SDD ledger — plan: docs/superpowers/plans/2026-10-31-weekly-3-phase-6-release.md

Started 2026-11-01 (controller: opus). Workspace .superpowers/sdd/phase-6/. Constraints: constraints.md. Handover: handover.md.
Real baseline (handover, controller-verified Phase 5): 356/356 unit per TZ, typecheck 0, e2e 273/273 + No tabs 9/9 (TZ=America/New_York), Packed 93, version 2.0.0. snap-t1 == working tree (verified, pkg diff empty).
Ruling: No git — per task `snap.sh phase-6 tN` before dispatch, `pkg.sh phase-6 tN review-tN.diff` after; fix rounds snapshot tNfR — cost if wrong: none functional.
Ruling: snap.sh/pkg.sh no longer exclude store-assets/ (Tasks 5–7 edit it; PNGs diff as "Binary files differ"); snap-t1 got the current store-assets copied in — cost if wrong: larger packages only.

## Pre-flight
Drift scan (opus, read-only): preflight-drift.md — 33 replace blocks: 27 OK-once, 6 MISS (4 real-tree drift, 2 plan-internal), 0 MULTI; whole-file replacements drop only Weekly 2 content. Simulated T1–T8 on a copy: unit 370/TZ (1 red = screenshot test until images exist), tsc 0. Parity names: 0 stale; 35 rows (D14/F8/L7 "+" form OK).

### Per-task self-consistency
| Task | Own text consistent? | Finding |
|---|---|---|
| 1 | yes | counts stale (357, Packed 93, 273) |
| 2 | mostly | counts (26 in reminders.test); flake: session.remove before notifications.clear |
| 3 | no | 3 anchors MISS (report.html H7 line, README:47, README:60); duplicates Phase 5 H7 wording |
| 4 | yes | anchor trailing blank line |
| 5 | yes | created file lacks trailing blank line (breaks T6 anchor); policy omits 3 handover facts; drafts/unticks claimed kept-until-deleted but expire at 90 days |
| 6 | yes after #22 | idle justification claims private-note lock (it is a timer) |
| 7 | no | generate.mjs sends crypto:encrypt (gone) → private demo note stored empty; dark seeds only settings.theme |
| 8 | yes | 283 e2e checks read, not 278 |
| 9 | counts stale | reminders.js 149, pin-dialog 53, largest crypto-broker 289, Packed 93, 370 unit, 274 e2e |

### Cross-task interfaces
| Producer → consumer | Interface | Agree? |
|---|---|---|
| T1 run.mjs --zip → T8/T9 | .e2e/results.json {area,name,ok}[] | yes |
| T1 e2e:zip script → T8 release:check | name | yes |
| T1 README "To release" → T8 anchor | text | yes in order |
| T2 stub notificationsCleared → T2 test | log | yes |
| T2 e2e name → T8 PROOFS D9 | [Reminders] the notification goes with the window… | yes |
| T5 read/pkg/policy consts → T6 | test file | yes; file ending → T6 anchor: no → P6-D1 |
| T6 listing screenshot names → T7 test | Assets table | yes |
| T7 demo-data → store-assets test | coerceTask/coerceNote | yes |
| T7 generate.mjs → worker | crypto:setPin/encrypt/lock | no → P6-D4 |
| T8 parity.mjs → spec | row regex | yes, 35 |
| T6 test → manifest | 8 + 2 + host = 11 rows | yes |

### Pre-flight rulings
Ruling: P6-D1 — use preflight §A corrected anchors (#16 report.html: insert the plan's always-visible export line before the Import hint line :185; #17/#18 README substrings and replacements as written in §A; #19 and #22 drop the trailing blank line). To avoid two hints repeating the offline-guessing point, H7 (#exportPinHint) is trimmed to the PIN-specific part and its data.mjs assertion follows — cost if wrong: wording only.
Ruling: P6-D2 — counts re-derived (preflight §D table): unit 357/358/360/361 after T1–T4, + polish tasks, then +3/+4/+2 for T5–T7; e2e 273→274 (+ polish e2e); No tabs 9; Packed 93; parity 283 checks + polish e2e. Task 9 line counts re-measured, not the plan's — cost if wrong: count mismatch only.
Ruling: P6-D3 — Task 2: forgetWindowIfClosed clears both notifications BEFORE removing reminderWindowId (same lines, reordered), so the new e2e check cannot race — cost if wrong: none.
Ruling: P6-D4 — Task 7: the demo private note is made with crypto:save {id:null,title,body,category,day} after crypto:setPin (worker seals and stores), then crypto:lock; no manual notes append; dark shots seed localStorage 'weekly:theme'='dark' as well as settings.theme — cost if wrong: none.
Ruling: P6-D5 — Task 5 policy also states (and its test checks): Replace adopts the file's PIN record and drops this computer's private notes; guesses at a file's PIN during import are not rate-limited, guesses at your own PIN go through the lockout; localStorage holds only the theme name (no "only in extension storage" absolute); saved drafts and unticks expire with activity after 90 days — why: handover item 5 binding facts + true-to-code — cost if wrong: wording only.
Ruling: P6-D6 — Task 6 idle justification drops "Private notes also lock after 5 minutes without use" (a Date.now timer, not chrome.idle) — cost if wrong: none.
Ruling: P6-D7 — e2e TZ: America/New_York while its local time is outside 23:30–01:30 (DST ends 1 Nov 02:00 NY); otherwise Asia/Kolkata (Europe/London is in the window at the same moments) — cost if wrong: a midnight flake/retry.
Ruling: P6-X1 (handover controller ruling) — extra Task 4a "Phase 2b polish" after Task 4: all four still present (preflight §F): (1) reschedule returns moved ids, Undo restores only those; (2) toggleOn(id, iso, want?) explicit state, task-actions passes done; (3) report load() last-request-wins via a tiny src/lib latest() with unit test, plus .catch; (4) past-day daily add: toast "Added. Daily tasks start today, so it shows from today on." with e2e — cost if wrong: small UI wording/behavior change.
Ruling: P6-X2 — extra Task 4b "Phase 5 parked + upgrade": TAKE m-V (readBackup refuses Weekly export version > 3), settings-panel getSettings().then(fillSettings).catch, T5-d onpage `if (tab.url && …)`, T5-c Settings tracking checkbox resyncs on onTrackingChanged, m-R Replace confirm() (data.mjs accepts dialogs), T2-a aria-labels, T2-c duplicate .hm-cell CSS (visible in Stats screenshot), handover 2a upgrade safeguard (onInstalled update from <3 with no tabs grant and day: keys → open welcome), README storage.js layout line (Phase-4 carry). LEAVE (parked): T2-b focus, T3-b on-page theme follow, T5-b denial test, T7-⚠/private.js tests, T8 non-Error unprefixed, recheck() sync throw, m-N range checks, app-tab hiding e2e — why: user-visible + ≤ a few lines each vs test-only/rare — cost if wrong: parked ones stay rare/cosmetic; taken ones add ~40 lines + tests.
Ruling: Models — implementers sonnet (opus for Task 7 and fix rounds 4–5); reviewers sonnet, opus for Task 7 and the final review — cost if wrong: extra turns.
Ruling: Order 1, 2, 3, 4, 4a, 4b, 5, 6, 7, 8, 9 — polish before store text/screenshots so the shots and policy show final code — cost if wrong: none.
Task 1: dispatched implementer a76d3640c54763f71 (sonnet), base snap-t1
Task 1: implementer DONE: 357/357 both TZ, tsc 0, Packed 93 → dist/weekly-3.0.0.zip, e2e:zip 273/273, No tabs 9/9; review-t1.diff; reviewer ace60db09780a8529 (sonnet) dispatched
Ruling: Task 1 review runs in parallel with Task 2's implementer (snap-t2 taken after Task 1) — why: tiny plan-text diff; reviews are not implementers — cost if wrong: a Task 1 fix lands inside Task 2's diff window.
Task 2: dispatched implementer a7ceede6b3d990eac (sonnet), base snap-t2, carries P6-D3
Task 1: review ✅ Approved (sonnet); ⚠️ counts from report — re-proved by the Task 9 gate.
Task 1: minor (deferred): --zip cannot tell a stale same-version zip from a fresh one (release:check runs package first).
Task 1: complete (snap-t1..snap-t2, review clean)
Task 2: implementer DONE: 358/358 both TZ, tsc 0, e2e 274/274, No tabs 9/9; review-t2.diff
Task 2: reviewer ae3ccb05baa8ca1e8 (sonnet) dispatched
Task 3: dispatched implementer abc288062ddac9b53 (sonnet), base snap-t3, carries P6-D1
Task 2: review ✅ Approved (sonnet); reran reminders.test 26/26.
Task 2: minor (deferred): README "Missed reminders" — "shows when Chrome starts" is conditional on catchUpOnStartup (next bullet names the setting).
Task 2: complete (snap-t2..snap-t3, review clean)
Task 3: implementer DONE: 360/360 both TZ, tsc 0, e2e 274/274, No tabs 9/9; review-t3.diff
Task 3: reviewer a04a5547813a1aa19 (sonnet) dispatched
Task 4: dispatched implementer ad9f25c3faf8c9416 (sonnet), base snap-t4, carries P6-D1 #19
Task 3: review ✅ Approved (sonnet); grep of src/ + README: no 5-unlocked-minutes promise left.
Task 3: minor (deferred): wording.test asserts "6 to 8 digits" only via the Notes PIN hint (not #exportPinHint, not README); no-5-minute rule tested only on pin-dialog.js.
Task 3: minor (deferred): with a PIN set Settings shows two export hints back to back; 6-to-8-digit advice appears three times.
Task 3: complete (snap-t3..snap-t4, review clean)
Task 4: implementer DONE: 361/361 both TZ, tsc 0, e2e 274/274, No tabs 9/9; review-t4.diff
Task 4: reviewer a4eaf3b8592a617e5 (sonnet) dispatched
Task 4a: dispatched implementer a44f8455ba874ae9b (sonnet), base snap-t4a, brief task-4a-brief.md (P6-X1)
Task 4: review ✅ Approved (sonnet); 800-end-date sweep: ≥12 labels, no adjacent labels.
Task 4: ⚠️ resolved → carried to Task 7: a 2-column gap (first two labels, ~30 px) may still crowd wide month names; Task 7's stats-dark screenshot visual check confirms.
Task 4: minor (deferred): stats.js:109 doc comment does not mention the first-column rule.
Task 4: complete (snap-t4..snap-t4a, review clean)
Task 4a: implementer DONE: 364/364 both TZ (+3), tsc 0, e2e 275/275, No tabs 9/9; review-t4a.diff
Task 4a: reviewer a67cc76b8354a675f (sonnet) dispatched
Task 4b: dispatched implementer a7a3a72c34e67d35c (sonnet), base snap-t4b, brief task-4b-brief.md (P6-X2)
Task 4a: review ✅ Approved (sonnet); reran unit 364/364.
Task 4a: minor (deferred): main.js:36 a stale load that rejects still shows "Couldn't load this week", never cleared by a later success.
Task 4a: minor (deferred): last-wins drops fetchStatus when load(true) is superseded by a storage-triggered load(false) → statuses not refreshed for the new week.
Task 4a: minor (deferred): no test fails if the `if (!mine()) return;` guard line in main.js is deleted (latest() unit-tested with a stand-in).
Task 4a: minor (deferred): a no-op toggleOn(want===has) still bumps updatedAt via patchOne.
Task 4a: minor (deferred): "Moved 0 tasks to tomorrow." toast + no-op Undo when everything was skipped (pre-existing; now a 1-line fix).
Task 4a: minor (deferred): items 1–2 unit-proved only (no panel e2e).
Task 4a: complete (snap-t4a..snap-t4b, review clean)
Task 4b: implementer DONE: 367/367 both TZ, tsc 0, e2e 278/278, No tabs 10/10 (+1 T5-c check); review-t4b.diff
Task 4b: reviewer a9825587d9c300edd (sonnet) dispatched
Task 5: dispatched implementer a995e1202e0754e5b (sonnet), base snap-t5, carries P6-D5, P6-D1 #22
Task 4b: review ✅ Approved (sonnet); reran unit 367/367.
Task 4b: ⚠️ resolved by controller: welcome.html read on update ("Welcome to Weekly… Track my week?… Chrome will ask… read your browsing history") is accurate for a returning 2.x user; no upgrade-specific line added.
Ruling: P6-U1 — no "#upgrade" line on welcome — why: the existing copy is true for upgraders and the Track-my-week ask is the point; adding a variant costs a page branch + test — cost if wrong: an upgrader sees a generic welcome once.
Task 4b: minor (deferred): non-numeric previousVersion → NaN falls through to the storage check (Chrome never sends one).
Task 4b: minor (deferred): a string "version" ("4") bypasses the newer-Weekly refusal in backup.js (exports write a number).
Task 4b: minor (deferred): settings-panel getSettings .catch shows raw e.message, untested (no harness reaches it).
Task 4b: minor (deferred): T5-c e2e is a stand-in (patched contains() + hist: write); permissions.onAdded leg unexercised.
Task 4b: minor (deferred): wrapped .figure rows still double their right border (T2-c partial).
Task 4b: complete (snap-t4b..snap-t5, review clean). Running: unit 367, e2e 278, No tabs 10.
Task 5: implementer DONE: 371/371 both TZ (4 policy tests: brief's 3 + P6-D5), tsc 0; review-t5.diff
Task 5: reviewer ac5ab7cabcda8dc79 (sonnet) dispatched
Task 6: dispatched implementer ad16fd12e38c8a347 (sonnet), base snap-t6, carries P6-D6
Task 5: review ❌ Needs fixes (sonnet): I1 Replace "swaps your tasks, notes and settings" overstated (only what the file carries; webhook kept); I2 "permission requested one site at a time" false (one request for all pending origins); I3 session-storage list reads exhaustive but omits lastKey/recent/error; I4 side-panel "Note on this page" implied activeTab (works only on sites already allowed for live status); I5 90-day purge "each time the extension starts" → at Chrome start/install/update.
Ruling: T5 minors 7 (category/day of a private note stay readable), 8 (export holds the device ID), 9 (real "Yes, track my week" / Settings checkbox labels), 10 (test pins 1 November 2026, sole srewoo@gmail.com, no em dash) folded into fix round 1; minor 6 (uiState/shareOk/imports not listed) folded as one clause — why: a privacy policy must be exact; all one-liners — cost if wrong: none.
Ruling: Task 5 fix round waits for Task 6's implementer (both edit test/store-assets.test.js) — cost if wrong: minutes.
Task 6: implementer DONE: 375/375 both TZ, tsc 0, e2e 278/278, No tabs 10/10; manifest description 119 chars; review-t6.diff
Task 5: fix round 1 dispatched (resume a995e1202e0754e5b), base snap-t5f1
Task 6: reviewer a44c9fbc69bb46694 (sonnet) dispatched
Task 5: fix round 1 implementer DONE: 376/376 both TZ (+1 m10 test), tsc 0; review-t5f1.diff
Task 6: review ❌ Needs fixes (sonnet): I1 scripting/activeTab rows claim the side-panel click gets activeTab and "no host permission needed" (only Alt+N; panel button needs a live-status site); I2 https://*/* "one origin at a time" false (one prompt for all pending sites, Slack separate); I3 history "offered only with tracking on" false + "days not installed" inaccurate.
Ruling: T6 minors folded into round 1 (Move to tomorrow only on one-off tasks; alarms row adds snooze; "Other work" ordering wording; regex guards for I1–I3 in store-assets.test.js) — cost if wrong: none.
Task 6: ⚠️ resolved: Daybook/ForgetMeNot export paths were verified in pre-flight §E against their repos (Daybook settings.html:105,112; ForgetMeNot app.js:260-265).
Task 6: fix round 1 dispatched (resume ad16fd12e38c8a347), base snap-t6f1
Task 5: re-review a8df164c3e256b6ee (sonnet) dispatched
Task 5: fix round 1/5 (10 addressed, 0 open — I1–I5 policy accuracy, m6–m10; snap-t5f1..snap-t6f1)
Task 5: minor (deferred): Private notes bullet has back-to-back parentheticals; policy test does not pin hype words / "5 unlocked minutes" absence.
Task 5: complete (snap-t5..snap-t6 + fix snap-t5f1..snap-t6f1, 1 fix round)
Task 6: fix round 1 implementer DONE: 377/377 both TZ (+1 guard test), tsc 0; review-t6f1.diff
Task 6: re-review a4f38a071c0661132 (sonnet) dispatched
Task 7: dispatched implementer ad214e86adfc68f02 (opus), base snap-t7, carries P6-D4 + Task 4 heatmap visual check
Task 6: fix round 1/5 (3 addressed + 4 folded minors, 0 open — I1 activeTab/scripting, I2 host prompt, I3 history row; snap-t6f1..snap-t7)
Task 6: minor (deferred): listing line 33 "or move it to tomorrow" not qualified to one-off tasks; alarms row sentence clumsy; stray double blank line in store-assets.test.js.
Task 6: complete (snap-t6..snap-t5f1 window + fix snap-t6f1..snap-t7, 1 fix round)
Task 7: implementer DONE: 379/379 both TZ, tsc 0, generate.mjs wrote 7 images; panel shot 400x900 (brief 400x820 clipped); private note via crypto:save, dates adjusted to Wednesday; heatmap labels no overlap (measured); review-t7.diff
Task 7: reviewer adebfd1d1591dd70f (opus) dispatched
Task 8: dispatched implementer a95ebea009d89fe4a (sonnet), base snap-t8
Task 7: review (opus): Spec ✅, Quality Needs fixes — I1 generate.mjs seeds before onInstalled's updateSettings({}) lands → seeded SETTINGS lost (shot 1 "Visits under 2 min" not 5; light only by headless default) — race, non-deterministic. Departures ruled sound by reviewer: crypto:save path, createdAt rewrite, panel 400x900, dark seeding.
Ruling: T7 minors folded into round 1: "Ahrefs study on AI overviews" (real company, visible in shot 4) → fictional "Study on AI overviews in search" in demo-data.mjs (deviates from the plan's verbatim demo data — why: constraint says fictional demo data) ; caption 5's "how often each daily task gets done" — scroll stats so the Daily tasks section shows, else drop the clause — cost if wrong: none.
Ruling: P6-M1 — marquee "Stays on your computer" stays — why: no developer server; listing short description says the same and its data-handling section names the opt-in sends — cost if wrong: a reviewer may ask for "unless you share it".
Task 8: implementer DONE: Parity 35/35 (288 e2e checks read), gap run 35/36 exit 1, 379/379 both TZ, tsc 0; review-t8.diff
Task 7: fix round 1 dispatched (resume ad214e86adfc68f02), base snap-t7f1
Task 8: reviewer a603faa1e7afd257b (sonnet) dispatched
Task 7: fix round 1 implementer DONE: settings wait + read-back (shot 1 now "Visits under 5 min"), Ahrefs → fictional, caption 5 clause dropped; 379/379, tsc 0; review-t7f1.diff
Task 8: review ✅ Approved (sonnet) with I1: D14's proofs (three ordinary Daybook tests) do not show "carried over, Node-22-runnable, date-dependent uistate test fixed"; row really rests on npm test in release:check. Gate probes (missing results, unproved row, stray key, exact names, prefix names) all fail correctly.
Ruling: T8-I1 fix round 1 = a comment on D14 saying it also rests on npm test (both TZ, Node ≥22) inside release:check, plus one unit guard test that test/uistate.test.js never reads the real clock unmocked; minors folded: unit match anchored to a real `test(` call at line start, an e2e name with any ok:false entry counts as failed — cost if wrong: none.
Task 8: minor (deferred): no freshness check on .e2e results for standalone `npm run parity`; L10 proof covers the panel only; L8 second proof generic.
Task 8: fix round 1 dispatched (resume a95ebea009d89fe4a), base snap-t8f1
Task 7: re-review a16b73de54af0b970 (sonnet) dispatched
Task 7: fix round 1/5 (3 addressed, 0 open — I1 seed race, Ahrefs, caption 5; snap-t7f1..snap-t8f1)
Task 7: minor (deferred): generate.mjs's poll proves "settings exists", not "install write done" (safe today; read-back catches a regression).
Task 7: complete (snap-t7..snap-t8 + fix snap-t7f1..snap-t8f1, 1 fix round)
Task 8: fix round 1 implementer DONE: D14 comment + test/parity.test.js guard ("derives every date from today() and has no hard-coded date" — uistate.test.js uses today(), no pinned date), anchored unit match, any-ok:false fails; parity 35/35 (288), gap 35/36 exit 1, 380/380 both TZ, tsc 0; review-t8f1.diff
Task 8: re-review a05ba622526b52d4e (sonnet) dispatched
Task 8: fix round 1/5 (3 addressed, 0 open — D14 comment + guard test, anchored unit match, any-failure e2e; snap-t8f1..snap-final)
Task 8: minor (deferred): parity.test.js guard is source-text (misses new Date(2026,…); false-fails on a dated comment).
Task 8: complete (snap-t8..snap-t8f1 + fix, 1 fix round). Running: unit 380/TZ, e2e 278 + No tabs 10 (last run after Task 6), Parity 35/35 (288).
Ruling: P6-G1 — Task 9 (the release gate) runs AFTER the final whole-phase review and its one fix wave, so the gate proves the zip that ships — cost if wrong: none.

## Final review
Final review: dispatched afe1aa23ac9cd99b2 (opus), package review-final.diff (snap-t1 → tree, 2424 lines)
Final review (opus): Ready with fixes — no Critical; zip needs no code change. I1 Task 9 numbers stale (Packed 94 — latest.js added by 4a; unit 380; e2e 278 + No tabs 10; parity 288; line counts reminders 150, stats 131, pin-dialog 53, parity.mjs 45, generate.mjs 209, crypto-broker 289; fallback TZ Asia/Kolkata); I2 dist/weekly-3.0.0.zip stale (pre-4a/4b/6) and dist/weekly-2.0.0.zip is the Phase-5 build mislabelled 2.0.0; I3 changing the policy date breaks the pinned test unless both change; I4 Alt+N without tabs on chrome:// / Web Store may do nothing (panel opened after an await loses the gesture) → listing LIMITS line may be false; I5 owner checklist lacks the upgrade + Alt+N manual checks and contradicts itself on farewell timing. Corrected checklist in review-final.md §7. All 31 store claims sampled true (except I4's conditional); parity samples genuine; rulings hold except P6-D2's Packed 93 (now 94). Must-fix before zip: none.
Ruling: F6-1 (I1) — Task 9 is dispatched with the reviewer's real numbers; P6-D2's Packed corrected to 94 — cost if wrong: count mismatch only.
Ruling: F6-2 (I2) — the fix wave MOVES dist/weekly-2.0.0.zip to snapshots/weekly-3.0-phase5-build-mislabelled-2.0.0.zip (reversible; removes the upload trap); the stale 3.0.0 zip is rebuilt by Task 9's release:check — cost if wrong: none.
Ruling: F6-3 (I4) — listing LIMITS line reworded to be true whatever Alt+N does without tabs on Chrome's own pages ("use the side panel's Notes tab there"); onpage.js unchanged (P5-H5 stands: url absent → try injection); the owner's real-Chrome Alt+N check stays in the checklist; if Alt+N does nothing there, it is a 3.0.1 fix — cost if wrong: Alt+N silently does nothing on chrome:// pages for users without tracking (rare; listing no longer promises otherwise).
Ruling: F6-4 (I3, I5) — the corrected owner checklist (review-final §7, with F6-2/F6-3 applied and the policy-date step naming both files) replaces the "Before you submit" section of store-assets/store-listing.md; the plan file is untouched; the final report points to store-listing.md — cost if wrong: none.
Final fix wave: dispatched a3fb2de713301ef76 (sonnet), base snap-fix
Final fix wave: DONE: 380/380 both TZ, tsc 0; 2.0.0 zip moved to snapshots/; LIMITS reworded; checklist replaced in store-listing.md; review-fix.diff
Final fix wave: re-review ac1350796f95b707d (sonnet) dispatched
Task 9: dispatched implementer ab2978d83718c5975 (sonnet), base snap-t9, carries F6-1 numbers
Final fix wave: re-review (sonnet) — F6-2, F6-3, F6-4 all PASS; store-assets.test 12/12; no new Critical/Important.
Ruling: F6-5 — residual: the listing's LIMITS paragraph repeats "Chrome's own pages" twice; parked (no second fix wave) — owner trims when pasting — cost if wrong: one repetitive sentence in the store description.
Task 9: implementer DONE: release:check (TZ=America/New_York) 380/380 both TZ, tsc 0, Packed 94 files → dist/weekly-3.0.0.zip (161,724 bytes), End-to-end on dist/weekly-3.0.0.zip (manifest 3.0.0) 278/278, No tabs 10/10, Parity 35/35 (288); no retries; line counts 150/131/53/45/209; largest src crypto-broker.js 289; full.mjs 425 the only file >300; permissions exact; no storage.sync; innerHTML only dom.js guard list.
Ruling: Task 9 review = controller re-verification (no code diff to review): re-ran test:ny 380/380, test:in 380/380, typecheck 0, parity 35/35 (288), zip 94 files version 3.0.0, results 278/278 + 10/10 written after the zip, no storage.sync — cost if wrong: none.
Task 9: complete (snap-t9..final tree; build outputs only)
Workspace: snap-t1 and all reports/reviews kept; per-task snapshot copies (snap-t2…snap-t9, snap-tNf1, snap-final, snap-fix) deleted after copying ledger + final review to docs/.
PHASE 6 COMPLETE.
