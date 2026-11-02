# Phase 6 final whole-phase review (release 3.0.0)

Reviewer: opus, read-only. Package: review-final.diff (snap-t1 → working tree). Ran: `npm test` (380/380 New York, 380/380 Kolkata), `npm run typecheck` (exit 0), `npm run parity` (35/35, 288 end-to-end checks read; results files from 04:34, after the last src change at 04:24). Not run: e2e and generate.mjs (they launch browsers).

## 1. Verdict: Ready with fixes

No code change is required for the zip. The fixes are in the release process: the Task 9 brief's expected numbers, the owner checklist, and dist/. One store-text line depends on an owner check (I4).

### Critical
None.

### Important
- **I1. The Task 9 brief would fail a correct gate (.superpowers/sdd/phase-6/task-9-brief.md:9,17-22).** It copies the plan's numbers. The real ones: `Packed 94 files`, not 90 and not the ledger's 93, because Task 4a added `src/lib/latest.js` (dist/weekly holds 94 files now). Also: unit `# tests 380` per timezone; `278/278 passed`, `No tabs: 10/10 passed`; `Parity: 35/35 rows proved (288 end-to-end checks read)`. Line counts: reminders.js 150, stats.js 131, pin-dialog.js 53, parity.mjs 45, generate.mjs 209; the largest src file is crypto-broker.js at 289. For the timezone fallback, use P6-D7 (Asia/Kolkata), not Europe/London. **Fix:** rewrite the Expected lines before dispatching Task 9. Add any e2e checks the fix wave adds.
- **I2. dist/ holds two zips that must not be uploaded (dist/weekly-2.0.0.zip, dist/weekly-3.0.0.zip).**
  - `weekly-3.0.0.zip` (03:56) is stale. Its manifest has the old description ("Turns the work you do…") and it has no `src/lib/latest.js`, so none of the Task 4a, 4b or 6 code is in it. Task 9's `release:check` rebuilds it through `package`. Until then it is not the release.
  - `weekly-2.0.0.zip` (03:36, 160,152 bytes, the same size as the stale 3.0.0) is the Phase-5 merged build labelled 2.0.0: `tabs` is optional and it has a side panel. It is not Weekly 2 as published, so it is neither a rollback nor a starting point for the upgrade test. The real Weekly 2 is `snapshots/weekly-2.0.0-source-2026-10-31.zip`, where `tabs` is required.
  - **Fix:** the owner deletes or moves `dist/weekly-2.0.0.zip` before uploading, uploads only a 3.0.0 zip newer than the last green `release:check`, and checks it first with `unzip -p dist/weekly-3.0.0.zip manifest.json | grep -E '"version"|"description"'`.
- **I3. Changing the policy date breaks the gate (test/store-assets.test.js:37-38).** The owner checklist (plan step 2, listing "Before you submit") says to change "Last updated" if the submission is later than 1 November. The test pins `Last updated: 1 November 2026`, so `npm test` and `release:check` then fail. **Fix:** the corrected checklist below says to change the date in the policy and in that test together, then rerun `release:check`. Alternatively, change it only in the hosted copy.
- **I4. Alt+N without `tabs` on Chrome's own pages may do nothing, and the listing promises it.** The path is `src/background/onpage.js:281-285`.
  - Without `tabs`, and with activeTab not applying to chrome:// pages, Chrome probably leaves `tab.url` out. The code then tries `inject`, which fails, and calls `openNotesPanel` only after an `await`. By then the user gesture `sidePanel.open` needs may be gone. The code's own ponytail comment admits this.
  - Nothing tests this path. The unit test passes a `chrome://settings/` url, and the e2e suite pre-grants `tabs`.
  - Tracking off is the default for a fresh install. In that setup, the listing's LIMITS line ("there Alt+N opens the side panel's Notes tab instead", store-listing.md:75) and the README may be false.
  - **Fix:** the owner checks this in real Chrome (handover 2b, added to the checklist below). If nothing opens, either change line 282 to `if (!tab.url || !canInject(tab.url)) { openNotesPanel(tab.windowId); return; }` (no url means activeTab gave nothing, so open the Notes tab at once, inside the gesture) and add a unit test for an absent url, or drop that clause from the listing before pasting it.
- **I5. The owner checklist leaves out the handover's manual checks and has a sequencing contradiction.** It has no Weekly 2 → 3.0.0 update check (handover 2a), and Alt+N is checked only "on a normal page". Plan step 7 says Weekly and the farewell updates "go out on the same day", but retirement step 1 says the farewells are published "only after Weekly 3.0 is live", and those updates need their own review. **Fix:** the corrected checklist in §7.

### Minor (new, all can wait)
- store-listing.md:148 "Before you submit" runs `npm run package && npm run e2e:zip`, which skips parity. Make it `npm run release:check`.
- privacy-policy.html, Private notes bullet: two parentheticals in a row ("…stay readable beside them) (PBKDF2…"). The policy is not in the zip, so this can be fixed before hosting.
- store-listing.md:93: "Fill in from history" is the banner on the report page, not a Settings control. "…in Settings" reads as if both were.

## 2. Security and privacy pass

| Change | Finding |
|---|---|
| Upgrade safeguard (service-worker.js:57-62, 66) | It runs through `serial`, only when `reason==='update'`, `previousVersion` major < 3, `tabs` is not held, and some `day:` key exists. It only opens `welcome.html`. welcome.js writes nothing on load, and every grant needs a click. A missing or NaN previousVersion falls through safely. `get(null)` reads all storage once per update, the same cost as `purgeOld`. Two unit tests cover it. OK. |
| Import version refusal (backup.js:399-400) | A numeric `version > 3` is refused in words before any coercion. Exports write `version: 3` as a number (portability.js:38). A string version is not refused (deferred, can wait). OK. |
| Replace confirm (import-panel.js:50) | `confirm()` runs before the button is disabled and before any write. It names exactly what is replaced (`replaces()`: tasks, notes, settings). Cancel writes nothing (e2e: Cancel leaves tasks unchanged, no message, panel still open). OK. |
| Settings resync (settings-panel.js:851-854) | Re-reads `permissions.contains` on permission and activity events. It can only show state, never grant it. It fires on every `day:` write while tracking is on, which is cheap. Raw `e.message` in `.catch` is the deferred minor. OK. |
| onpage url (onpage.js:282) | `''` is now treated as unknown, so injection is tried and falls back if it fails. canInject still refuses non-http(s)/file pages and the Web Store. See I4 for an absent url. |
| Report load guard (main.js:744-756, latest.js) | Last call wins, so a stale load cannot overwrite `W`. Every caller gets `.catch`. The existing fire-and-forget `refreshStatuses()` still has no catch, which is not new. OK. |
| Layering | latest.js is pure. No new `chrome.storage` in src/ui (settings-panel uses lib/activity/status.js). OK. |

**Store-text claims checked against src (31):**
1. The policy and listing say 90-day retention. `expiredKeys` drops every key ending in a date older than 90 days: `day:`, `hist:`, `imp:*:`, `excluded:`, `draft:`.
2. "The check runs when Chrome starts and when installed or updated": `setup()→purgeOld` runs on onInstalled and onStartup.
3. "Idle default 2 minutes": `idleSeconds: 120`.
4. PBKDF2-SHA256 with 310,000 rounds (crypto.js:17).
5. Lockout of 30 s, 1 m, 5 m, then 15 m (crypto.js:118).
6. Key dropped after 5 minutes idle, on lock, or on worker stop (crypto-broker.js:26, 54).
7. localStorage holds only the theme name (theme.js:13, theme-boot.js:5, nothing else in src).
8. Session storage holds `current`, `recent`, `lastKey`, `error` and the reminder window id (tracker.js, reminders.js:113). "For example" covers the list.
9. Per-day task-switch count (tracker.js:58).
10. Only the focused window's active tab (tracker.js:111), and `idle.queryState` (tracker.js:108).
11. History synced from other devices is skipped (`isLocal !== false`, history.js:51).
12. Remove history estimates deletes `hist:` and removes the permission (history.js:81-85).
13. Turning tracking off gives back `tabs` (`stopTracking`, status.js).
14. Delete everything keeps settings and the PIN record (data-panel KEEP includes `settings` and `security`) and removes drafts, activity, tasks and notes.
15. The export leaves out the Slack webhook (portability.js:42) and includes the device ID.
16. Replace swaps only what the file carries (`replaces`, `carries`).
17. "Replace asks you to confirm" (import-panel.js:50).
18. The on-page note does not read the page: onpage-note.js has no `document.title`, `location` or `querySelector` on the page.
19. "Yes, track my week" and "No thanks" (welcome.html:33-34).
20. The "Track my week" Settings checkbox (report.html:110).
21. "Open my report" (welcome.html:66).
22. "Open Weekly" opens the calendar: app.html with no hash, and calendar is the default route.
23. "Week report" link in the app (app.html:13).
24. "Hide visits shorter than (minutes)", default 2, min 0.
25. "Preview the check" (report.html:146).
26. "Your data" legend, with Import a backup and Delete everything (report.html:173-181).
27. "Never track these sites" and "Hide people and customer names" (report.html:116, 47); stand-ins are Candidate, Customer and Support case (draft.js:98).
28. Pause in the side panel footer (footer.js:21).
29. Panel quick add is due today (today-tab.js:41).
30. Live status sends the item id to the site with `credentials:'include'` (integrations.js:56) after `requestOrigins` for the specific origins. Slack posts only after `confirm` (share-panel.js:11).
31. No eval or `new Function`, no content_scripts in the manifest, `downloads` not requested, Export uses a blob anchor (data-panel.js:20). The manifest description is 119 characters and the listing says so.

All true. The one exception is the conditional line in I4.

## 3. Parity
`npm run parity`: **35/35 rows proved (288 end-to-end checks read)**, exit 0.

I sampled rows that review-t8.md did not open:
- D1 (schema.test coerceTask minimal) is genuine but thin. Its three e2e checks carry the row.
- D11: the Daybook backup unit test, and e2e Replace-Daybook, which checks tasks equal the file's and the note count is unchanged.
- D12: schema-v2 migrate asserts repeat/doneDates backfill and that v1 fields survive.
- F4: service-worker Alt+N inject is asserted synchronous, before any await.
- L1: recurrence occursOn covers from, until, weekdays, an invalid day, and that a one-off never recurs.
- L2: e2e copy asserts both copies with the right due date and status.
- L4: planner monthGrid has a Monday start, past/today/future shading, and today only once ticked.
- D7: Move-all e2e in both the panel and the reminder window.
- D14: the parity.test guard plus the D14 comment, as ruled in T8-I1.

All genuine.

The gate does what it claims: unit names are anchored at `^\s*test(`, any `ok:false` fails a name, a missing results file exits 1, and a row whose proofs are not in the checklist fails. The known gaps are the ledger's deferred minors: standalone parity has no freshness check (release:check always reruns e2e:zip first), and L10 covers only the panel.

## 4. Rulings vs code
- No-git and snap/pkg rulings: procedural; the package diff is consistent.
- P6-D1: holds. The always-visible export line comes before the import hint (report.html:806-807), and #exportPinHint is trimmed to the PIN part.
- P6-D2: counts re-derived, **but "Packed 93" is now 94** (latest.js). See I1.
- P6-D3: holds. Notifications are cleared before `remove(WINDOW_KEY)` (reminders.js:316-319).
- P6-D4: holds. The demo note uses setPin, then save with `id:null`, then lock (generate.mjs). Dark shots seed both settings.theme and localStorage `weekly:theme`.
- P6-D5: holds. The policy states the Replace PIN adoption, file-PIN guesses not rate-limited, own-PIN guesses through the wait, localStorage holding only the theme, and the 90-day expiry of drafts and unticks.
- P6-D6: holds. The idle row no longer mentions the private-note lock.
- P6-D7: procedural. The Task 9 brief still says Europe/London (see I1).
- P6-X1: holds.
  - (1) reschedule returns the moved ids, and Undo filters to them (task-actions.js:56-59). It has one caller.
  - (2) toggleOn takes `want`, and task-actions passes it.
  - (3) latest() and `.catch` (main.js).
  - (4) The past-day daily toast, with an e2e check.
- P6-X2 TAKE: holds. This covers m-V, the settings .catch, T5-d, T5-c (with a stand-in e2e), m-R, T2-a, T2-c (no duplicate .hm-cell existed; the `.figure:last-child` border fixed), the upgrade safeguard, and the README storage.js line.
- P6-X2 LEAVE: the items are still open as parked (triaged in §5).
- P6-U1: holds. welcome.html is unchanged, and its copy is true for upgraders.
- T5 fix round (I1-I5, m6-m10): holds in the policy text (checks 8, 16 and 30 above).
- T6 fix round (I1-I3 plus folded minors): holds (store-listing.md:90-94). Line 33 is still unqualified (deferred).
- T7 rulings (Ahrefs made fictional, caption 5 trimmed, settings seed race): hold. demo-data.mjs:984 reads "Study on AI overviews in search", and generate.mjs waits for the install write, then reads it back.
- P6-M1: holds. The marquee says "Stays on your computer" (generate.mjs:1158).
- T8-I1: holds (parity-proofs.mjs D14 comment plus guard test; anchored unit match; any-failure e2e).
- P6-G1: procedural. Task 9 must run after this review's fix wave (I1-I5 need no code).

## 5. Triage of deferred, parked and LEAVE items
| Item | Verdict |
|---|---|
| T1 --zip cannot tell a stale same-version zip | can-wait (release:check runs package first; the checklist says to run release:check, never e2e:zip alone) |
| T2 README "shows when Chrome starts" conditional on catch-up | can-wait (the next bullet names the setting) |
| T3 wording.test checks 6-to-8 only via the Notes PIN hint | can-wait |
| T3 two export hints back to back; 6-to-8 said three times | can-wait (true, only repetitive) |
| T4 stats.js:109 doc comment | wontfix |
| T4 ⚠ heatmap first-column labels | resolved (screenshot-5 shows Nov and Dec apart) |
| T4a main.js stale rejected load's message never cleared | can-wait (error path only) |
| T4a last-wins drops fetchStatus when superseded by load(false) | can-wait (live status is opt-in; the next navigation refreshes) |
| T4a no test fails if the `mine()` guard line is deleted | can-wait |
| T4a no-op toggleOn bumps updatedAt (patchOne:76) | wontfix (harmless) |
| T4a "Moved 0 tasks to tomorrow." plus a no-op Undo | can-wait (true text, rare) |
| T4a items 1-2 unit-proved only | can-wait |
| T4b NaN previousVersion | wontfix |
| T4b string "version" bypasses the refusal | can-wait |
| T4b settings .catch shows raw e.message, untested | can-wait |
| T4b T5-c e2e is a stand-in | can-wait (owner smoke in the checklist) |
| T4b wrapped .figure rows double their border | can-wait (does not wrap at 1280; not in any screenshot) |
| T5 back-to-back parentheticals; test does not pin hype or 5-minute absence | can-wait (fix before hosting; the policy is not in the zip) |
| T6 listing line 33 "or move it to tomorrow" unqualified | can-wait (pasted text, not in the zip; optional word "one-off") |
| T6 alarms row clumsy; double blank line in the test | wontfix |
| T7 generate.mjs poll proves only "settings exists" | can-wait (the read-back catches a regression) |
| T8 no freshness check for standalone parity; L10 panel only; L8 generic | can-wait |
| T8f1 parity.test guard is source-text | can-wait |
| LEAVE T2-b daily-tasks re-render loses focus | can-wait |
| LEAVE T3-b on-page note does not follow a theme change | can-wait |
| LEAVE T5-b permission-denial path untested | can-wait |
| LEAVE T7-⚠ / no private.js unit tests | can-wait |
| LEAVE T8 non-Error broker error shown unprefixed | can-wait |
| LEAVE recheck() sync throw | can-wait |
| LEAVE m-N imported settings not range-checked | can-wait (the user chooses the file; the worker clamps idleSeconds) |
| LEAVE app-tab hiding on Lock / Change-Remove during lockout, no e2e | can-wait |
| Phase 5 T3-c theme-boot pre-paint smoke ("Phase 6 manual smoke") | can-wait; added to the owner checklist |

**Must-fix before the zip: none.** Must-fix before submission (store text, not the zip): the I4 listing line, if the owner's Alt+N check fails.

## 6. Constraints sweep
- Size: the largest src file is crypto-broker.js (289). Changed files: reminders 150, tasks 233, backup 181, main 111, and the rest smaller. A brace scan of all 14 changed src files plus parity.mjs found no function over 50 lines (the scanner was verified on a 57-line sample).
- Sinks: innerHTML/outerHTML/insertAdjacentHTML appear only in dom.js:14's BLOCKED list.
- No `storage.sync`. The only `fetch` calls are integrations.js:56 and 78 (the existing opt-ins). No remote fonts in src or the policy (system font stacks).
- Layering: holds (see §2).
- Copy: no hype words and no em dashes in the listing or policy. The only email in the store text, README and src is srewoo@gmail.com. The policy is dated 1 November 2026.
- Version 3.0.0 matches in manifest.json, package.json, package-lock.json (both places), the policy and the listing. The stale dist zip is covered in I2.

## 7. Release readiness: corrected owner checklist
**Where it should live:** replace the "Before you submit" section of `store-assets/store-listing.md` with the text below. That is the file the owner already works from, and store-assets is not packed. Record it in the ledger. Do not edit the plan.

**Before submitting**
1. Delete or move `dist/weekly-2.0.0.zip`. It is a Phase-5 build mislabelled 2.0.0, not Weekly 2.
2. Run the gate at a time when the timezone's local time is outside 23:30-01:30: `TZ=America/New_York npm run release:check`, or `TZ=Asia/Kolkata` otherwise. Expect `# tests 380` and `# fail 0` twice, no `error TS`, `Packed 94 files → dist/weekly-3.0.0.zip`, `End-to-end on dist/weekly-3.0.0.zip (manifest 3.0.0)`, `278/278 passed`, `No tabs: 10/10 passed`, `Parity: 35/35 rows proved (288 end-to-end checks read)`. Plus any checks the fix wave adds.
3. Check the zip you will upload: `unzip -p dist/weekly-3.0.0.zip manifest.json | grep -E '"version"|"description"'` must show 3.0.0 and "Tasks, reminders and notes…". Its time must be later than the last edit under src/.
4. If you submit after 1 November 2026, change "Last updated" in `store-assets/privacy-policy.html` **and** in `test/store-assets.test.js` (lines 37-38), then rerun step 2. Host the policy at a public URL.
5. Manual checks in real Chrome (Playwright cannot do these):
   - **Upgrade from Weekly 2.** Use a fresh profile. Load `snapshots/weekly-2.0.0-source-2026-10-31.zip` unpacked (tabs is required there) and browse for 2 to 3 minutes so a `day:` entry exists. Replace that folder's contents with the unzipped 3.0.0 zip and press Reload. Expect:
     - the details page still lists "Read your browsing history";
     - the side panel footer shows time tracked today and keeps counting;
     - no welcome page opens;
     - reminders stay off unless Weekly 2's Friday reminder was on.
     If the permission is gone, the welcome page must open once and "Yes, track my week" must restore tracking.
   - **Alt+N with tracking off.** Fresh profile, answer "No thanks". Alt+N on an https page opens the note panel. Alt+N on `chrome://extensions` and on the Web Store opens the side panel on Notes. If nothing opens there, fix onpage.js:282 (review I4) or remove "there Alt+N opens the side panel's Notes tab instead" from the LIMITS paragraph before pasting.
   - **Settings checkbox follows a grant made elsewhere.** With the report's Settings open, turn tracking on from a second tab's welcome page. The checkbox ticks without a reload.
   - **Dark theme paints dark from the first frame** on the panel, app and report (the Phase 5 T3-c smoke).

**Submit**
6. Dashboard → Weekly → Package → upload the checked `dist/weekly-3.0.0.zip`.
7. Store listing: paste the detailed description. Upload the five screenshots in order, both promo tiles and icon-128.png, and remove the old popup, welcome, anonymous and history screenshots.
8. Privacy practices: single purpose; one justification per permission (`sidePanel`, `scripting` and `activeTab` are new; `tabs` is now optional); the data types and three certifications as listed; the policy URL.
9. Paste the reviewer test instructions. Submit, choosing to publish manually after approval.
10. At the same time, submit the Daybook and ForgetMeNot farewell updates for review, also set to publish manually, so all three are approved together.
11. Publish Weekly. Once it is live, install it from the store in a fresh profile:
    - the install prompt does not mention browsing history;
    - "Yes, track my week" shows "Read your browsing history";
    - Alt+N works on a normal page.
    Then publish the two farewell updates.

**Retire Daybook and ForgetMeNot**
12. Farewell builds, from their own repos:
    - The banner reads "Daybook is now part of Weekly. Export your data, then import it in Weekly." (ForgetMeNot the same) and links to Weekly's store URL, which already exists because the item is the same.
    - The export formats stay exactly the same: Daybook `{format:'daybook.tasks', schemaVersion:1, tasks}`, ForgetMeNot `{app:'ForgetMeNot', schemaVersion:2, notes, security}`.
    - Before submitting, export from each farewell build and import into Weekly 3.0.0. Check Add and Replace, and for ForgetMeNot a private note with its PIN.
13. Add "Now part of Weekly:" and Weekly's store URL as the first line of both store descriptions.
14. About 30 days after the farewells are live, unpublish both. Do not delete them; installed copies keep working and can still export.
15. Answer user mail at srewoo@gmail.com with the three steps: Export in the old app, Import a backup under Settings → Your data in Weekly, and enter the PIN for private notes.

**What the gate cannot catch:** real Chrome permission carry-over on update, Alt+N gesture behaviour without `tabs`, pre-paint theme, which file is actually uploaded, and the hosted policy's date and URL. The checklist covers each one.

## 8. Controller addendum: fix wave and gate

- Fix wave (rulings F6-1..F6-5 in the ledger): dist/weekly-2.0.0.zip moved to snapshots/weekly-3.0-phase5-build-mislabelled-2.0.0.zip; listing LIMITS Alt+N clause reworded; the corrected owner checklist (section 7 above, with the rulings applied) now lives in store-assets/store-listing.md "Before you submit". Re-review: all PASS.
- Gate (Task 9, TZ=America/New_York): npm run release:check green. Unit 380/380 in America/New_York and Asia/Kolkata; typecheck 0; Packed 94 files → dist/weekly-3.0.0.zip (161,724 bytes); End-to-end on dist/weekly-3.0.0.zip (manifest 3.0.0) 278/278; No tabs 10/10; Parity 35/35 rows proved (288 end-to-end checks read). Controller re-verified unit, typecheck, parity and the zip.
