# SDD ledger — plan: docs/superpowers/plans/2026-10-31-weekly-3-phase-1-foundation.md

Spec: docs/superpowers/specs/2026-10-31-weekly-merge-design.md (read; binding).
Ruling: No git (user decision). Per task: `snap.sh tN` before dispatch, `pkg.sh tN review-tN.diff` after, as the review package — replaces BASE/HEAD SHAs and commits — costs if wrong: review packages carry no commit messages; nothing functional.
Ruling: Implementers do NOT edit the plan file to tick checklists ("Update the checklist" steps); this ledger is the progress record — avoids plan churn in diffs — cost if wrong: plan checkboxes stay unticked (cosmetic).

## Pre-flight scan

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 ↔ T3,T4,T5 | week.js (dayKey, shiftDate, fmtDuration, WORK_DAYS) consumed by classify/draft/range/history | consistent names/signatures |
| T1 ↔ T6 | chrome-stub setIdle/setFocusedTab/setWindowFocused, idle/tabs.query/windows.getLastFocused consumed by tracker test | consistent |
| T2 ↔ T6 | e2e harness calls `sw.evaluate(() => dayKey(...)/isWorkday/addDays/weekStart(...))` relying on classic-SW globals from importScripts; T6 makes the SW an ES module → those globals vanish | CONFLICT → Ruling R1 |
| T2 ↔ T8,T10,T11 | PAGES map consumed by later tasks | consistent |
| T3 ↔ T5,T6 | classify(rawUrl,rawTitle,opts) | consistent |
| T4 ↔ T11 | draft exports WEEKDAYS, KNOWN, buildWeekly, buildStandup | consistent (T11 also imports WEEKDAYS — exported in T4) |
| T5 ↔ T6,T8,T10,T11 | settings.js getSettings/updateSettings/DEFAULTS; range.js loadRange/isIgnored/hasEntries; history.js | consistent |
| T5 settings DEFAULTS vs common.js DEFAULTS | plan says identical; plan's literal includes anonymize:false — current common.js has it | consistent |
| T7 ↔ T8,T11 | h/clear/$/$$ | consistent |
| T9 ↔ T11 | ai/integrations/trends/portability exports | consistent |
| Global constraint "ui never calls chrome.storage directly" ↔ T8, T11 | popup reads storage.session (current,error) + notes; report reads/writes excluded:*, draft:*, shareOk, notes, clear-all, onChanged — no lib owner exists in Phase 1 (storage.js arrives Phase 2) | CONFLICT → Ruling R2 |
| T6 build.mjs | ES-import walk + HTML refs relative to the HTML's dir | self-consistent; root HTML still classic until T8-T11 — refs still resolve (dirname of root file = root) |
| T11 gate vs legacy tests | T11 deletes classify/draft/history/common used by tests/ (legacy) | plan already gates T11 on test:ny/test:in, T12 removes tests/ — consistent |
| T1 self | jsconfig include src/background before it exists | fine (tsc needs ≥1 input: dates.js/week.js) |
| T6 self | tracker test imports `tracker.js?<random>` for fresh state | valid in Node ESM |
| T9 self | parseImport error messages must match tests | verified against data.js strings: "Not a valid export file.", "This file has no device ID…", "That export came from this browser." |
| T11 self | panel modules import from main.js and main imports panels (cycle) | OK only if panels touch main's exports inside functions, never at module top level → carried as instruction |

Ruling R1: Task 2 must also make the e2e harness independent of service-worker globals: compute dayKey/weekStart/isWorkday/Friday-of-week in the Node harness and pass values into `sw.evaluate(fn, arg)`; only chrome.* may be used inside sw.evaluate — why: T6 removes those globals and the harness is the phase's contract — cost if wrong: a slightly longer T2.
Ruling R2: In Phase 1 the UI may call chrome.storage directly ONLY for keys with no lib owner yet: storage.session `current`/`error` (popup), local `notes`, `excluded:*`, `draft:*`, `shareOk`, `deviceId`/`imports` reads, clear-all, and storage.onChanged listeners. Each such call carries `// ponytail: direct storage until lib/storage.js (Phase 2)` (notes: Phase 4). Settings always via lib/settings.js — why: the spec gives these owners only in Phases 2/4; inventing owners now is scope creep — cost if wrong: Phase 2 must move them (already planned).
Ruling R3: Model choice — T3/T4/T7 (transcription) haiku; T1/T2/T5/T6/T8/T9/T10/T12 sonnet; T11 (multi-file DOM rewrite) opus; reviewers sonnet; final review opus.

## Progress
Task 1: dispatched (implementer sonnet, base snap-t1)
Task 1: minor (deferred): expiredKeys cutoff uses ms (90*864e5) not calendar days — ≤1-day drift across DST at the 90-day boundary (plan-mandated)
Task 1: minor (deferred): isWorkday silent false on malformed string; fmtDuration no @returns / negative input; weekStart lacks a DST-week test
Task 1: ⚠️ resolved by controller — dates.js and dates.test.js byte-identical to Daybook; chrome-stub diff = brief's edits (22 lines); suite re-run 16/17/17, tsc ok
Task 1: complete (snap-t1 → working tree, review clean)
Task 2: dispatched (implementer sonnet, base snap-t2, carries Ruling R1)
Task 2: ⚠️ resolved by controller — .gitignore has .e2e/, package.json has "e2e": "node test/e2e/run.mjs"
Task 2: minor (deferred): run.mjs Chromium detection deviates from brief (numeric sort, skips dirs without binary) — improvement, disclosed; PAGES exported from a self-running script; default PLAYWRIGHT_PATH is machine-specific (env override exists)
Task 2: complete (snap-t2 → working tree, review clean; e2e 103/103 baseline on legacy code)
Ruling: Tasks 3 and 4 dispatched as one batch (same shape: port one pure module + its test to ESM) — per skill's batching rule — cost if wrong: a single review covers two modules.
Tasks 3+4: dispatched (implementer haiku, base snap-t3)
Tasks 3+4: ⚠️ resolved by controller — npm test re-run green (16 / 28 / 28), tsc ok
Tasks 3+4: parked — classify() ~98 lines > 50-line constraint (inherited, plan forbade restructuring in a no-behaviour-change port) — Ruling: split classify into per-family matchers in Phase 2's plan (covered by classify tests) — cost if wrong: one function breaks the 50-line rule for one phase
Tasks 3+4: minor (deferred): classify L101 m[2]/m[3] unguarded (harmless; tsc passes)
Tasks 3+4: complete (snap-t3 → working tree, review clean, 1 parked)
Task 5: dispatched (implementer sonnet, base snap-t5)
Task 5: ⚠️ resolved by controller — npm test 16/34/34, tsc ok
Task 5: minor (deferred): settings tests don't pin failed-write queue recovery or onSettingsChanged area filter; history exports extra consts (BREAK, MIN_VIEW, SKIP_TRANSITIONS)
Task 5: minor (deferred, design): settings lock serialises within one JS context only — popup vs service worker can still race (same as Daybook mutate); revisit with storage.js in Phase 2
Task 5: complete (snap-t5 → working tree, review clean)
Task 6: dispatched (implementer sonnet, base snap-t6)
Task 6: ⚠️ resolved by controller — ran npm run e2e independently: 103/103 passed with module service worker
Task 6: minor (deferred): build filter endsWith('package.json'); import walk ignores dynamic import()/re-exports; src/ copied wholesale (no tests may live in src/)
Task 6: complete (snap-t6 → working tree, review clean)
Task 7: dispatched (implementer haiku, base snap-t7)
Task 7: Ruling: review Important (plan-mandated) — h() honours any prop key (innerHTML/outerHTML/srcdoc/on*/attrs on*) and javascript: href/src; rule test misses `{ innerHTML: }`, bracket access, setHTMLUnsafe, document.write, createContextualFragment, DOMParser, `+=` → harden h() with a denylist that throws + scheme allowlist for href/src/action, widen the test regex, add a dom test via a minimal fake document — why: spec §5 "No innerHTML anywhere; imported files are untrusted" — cost if wrong: ~20 lines + tests
Task 7: fix round 1/5 dispatched (resume implementer)
Task 7: fix round 1/5 (2 addressed, 1 new open — attrs name checks case-sensitive: HREF/formaction/SRCDOC bypass; snap-t7f1 → working tree)
Task 7: fix round 2/5 (1 addressed, 0 open — attrs names now case-insensitive; snap-t7f2 → working tree)
Task 7: minor (deferred): /^on/ over-blocks names like `once`; URL_ATTRS omits poster/ping/data/background; relative URLs containing ':' fail closed; srcset not checked
Task 7: complete (snap-t7 → working tree, review clean after 2 fix rounds)
Task 8: dispatched (implementer sonnet, base snap-t8)
Task 8: ⚠️ resolved by controller — no stale refs to root popup files (quoted-glob grep), manifest default_popup = src/ui/popup/popup.html; e2e 103/103 per report (re-run planned at phase gate)
Task 8: minor (deferred): notes ponytail comment uses R2 wording rather than brief wording
Task 8: complete (snap-t8 → working tree, review clean)
Task 9: dispatched (implementer sonnet, base snap-t9)
Task 9: ⚠️ resolved by controller — npm test 16/62/62, tsc ok
Task 9: minor (deferred): applyImport untested (needs stub + File); aiRewrite without LanguageModel throws TypeError vs ReferenceError (gated by aiAvailability); in-file note duplicates not deduped (legacy parity)
Task 9: complete (snap-t9 → working tree, review clean)
Task 10: dispatched (implementer sonnet, base snap-t10)
Task 10: plan defect found by implementer — brief's relative `location.href = 'report.html'` resolves from src/ui/welcome/; used '../../../report.html' temporarily; carried into Task 11 dispatch (→ '../report/report.html')
Task 10: minor (deferred): process — root welcome files deleted one run before final green (final state re-verified 103/103)
Task 10: complete (snap-t10 → working tree, review clean)
Task 11: dispatched (implementer opus per R3, base snap-t11)
Ruling: build.mjs reference check scans only root HTML, so src/ui/** pages and their module imports are no longer verified at build (gap surfaced in Task 11) — fold the fix into Task 12 (owns build/zip scripts): walk every .html under src/ and its module imports — cost if wrong: a missing module would only be caught by e2e until Task 12
Task 11: Ruling: reviewer Minor 1 (export's chrome.storage.local.get(null) belongs in lib/portability.js as exportAll()) folded into Task 12 with the build-check ruling — why: Task 12 already touches build/package plumbing; keeps R2 an exact allowlist — cost if wrong: one call outside R2 for one task
Task 11: minor (deferred): settings writes now patch-merge via updateSettings (benign fix vs legacy whole-snapshot write); main.js imports placed after code (hoisted, cosmetic; plan-mandated)
Task 11: complete (snap-t11 → working tree, review clean; e2e 103/103 per report, re-run at phase gate)
Task 12: dispatched (implementer sonnet, base snap-t12, carries build-check + exportAll rulings)
Task 12: minor (deferred): build module-script regex requires type="module" before src=; walk ignores export-from/dynamic import (unused today); dead `shipped` root copy in build.mjs; README lists deviceId/imports read exception that no longer exists in UI; README says "no dependencies" (devDeps exist)
Task 12: complete (snap-t12 → working tree, review clean)
Final review: Ready with fixes — Critical: worker notification iconUrl relative to src/background (real-Chrome break, unseen by e2e); Important: __proto__ key from imported file pollutes Object.prototype and crashes loadRange (pre-existing); Important: README R2 exception list stale (+ "no dependencies" line); fix-before-Phase-2: applyImport untested. All Phase-2 triage lines recorded in final review report.
Final fix wave: dispatched (one implementer, sonnet, base snap-final)
Final fix wave: complete — F1 (iconUrl, RED 103/104 → GREEN 104/104), F2 (__proto__ guard both ends), F3 (applyImport tests), F4 (README list) all ADDRESSED; re-review clean
Final: minor (deferred): new e2e reminder check assumes Node and Chromium share a timezone; relies on a 2 s wait for a 100 ms alarm
Ruling: No git → workspace deletion would destroy the only record; keep the ledger as docs/superpowers/plans/2026-10-31-weekly-3-phase-1-ledger.md and delete snapshots/diffs — cost if wrong: per-task diffs are gone (rollback zip remains in snapshots/)
