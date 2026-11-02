# Weekly 3.0: feature-parity checklist (addendum to the merge spec)

Status: binding, by the owner's instruction on 2026-10-31: "keep working until Weekly has all the features of Daybook, ForgetMeNot and dailies".

This addendum extends `2026-10-31-weekly-merge-design.md`. Where they differ, this checklist wins on **scope**, and the merge spec wins on **how**: its architecture, privacy rules and look.

**Definition of done:** every row is ✅, verified by a unit test or an end-to-end check named in the phase's plan.

Rows that came from comparing the four sources (`dailies.html`, Daybook, ForgetMeNot, Weekly 2) are marked "+" because the original spec did not list them.

## Phases

| Phase | Scope |
|---|---|
| **2a** | Data layer: `storage.js`/`schema.js` (local only, schema v2, migrate), `tasks.js` + recurrence, `classify` split, the Daybook test suite (with its date-bomb test fixed) |
| **2b** | Task UI: side panel (Today/Week), app tab (Calendar, day sheet, task views, search, filters), Done section, undo, keyboard shortcuts |
| **3** | Reminders: morning brief, evening check, reminder window, catch-up, carry-over, notifications, commands |
| **4** | Notes: notes store, PIN crypto brokered by the worker, Notes UI (panel + app), day notes, Other-work feed, on-page note (Alt+N) + side-panel fallback, insights |
| **5** | Stats + onboarding + data: dailies stats, optional `tabs` ("Track my week?"), three-format import, theme choice, archive/restore |
| **6** | Release: version 3.0.0, store assets, listing + privacy policy, final full e2e, packaging |

## Checklist

### From Daybook

| # | Feature | Phase |
|---|---|---|
| D1 | Tasks with title, description, priority (high/medium/low), due date or none, status, timestamps | 2a |
| D2 | One-line quick add (side panel + app) | 2b |
| D3 | Views: Today, Overdue, Upcoming, All open, Completed. Popup-style Today/Week/All switch with a rolling 7-day Week of collapsible day bands (`uiState`) | 2b |
| D4 | Search + priority filter | 2b |
| D5 | Edit task (title, description, priority, due date), delete | 2b |
| D6 | Undo for complete and delete (toast + ⌘/Ctrl+Z) | 2b |
| D7 | Move to tomorrow (one) and Move all to tomorrow | 2b (UI) / 3 (evening) |
| D8 | Morning brief and evening check: one-shot DST-safe alarms, configurable times and working days | 3 |
| D9 | Single reused reminder window + system notification + catch-up on startup | 3 |
| D10 | Keyboard: `N` new, `/` search, `O` open full app, ⌘Z undo, Esc close; commands Alt+T (open panel) and Alt+Shift+T (open app) | 2b (in-page keys) / 3 (commands) |
| D11 | Export (download) and import, merge or replace, validated | 5 |
| D12 | Schema version + migration | 2a |
| D13 | Explicit extension CSP (`script-src 'self'; object-src 'none'; base-uri 'none'`) | 2a |
| D14 + | Daybook's test suite carried over, Node-22-runnable, the date-dependent `uistate` test fixed | 2a |

### From ForgetMeNot

| # | Feature | Phase |
|---|---|---|
| F1 | Notes: title, body, category (General · Work · Personal · Idea · To-Read), pinned, done, timestamps | 4 |
| F2 | Quick add, search (title + body; private bodies hidden), pin, mark done, delete, edit | 4 |
| F3 | Private notes: PIN (set/change/remove), PBKDF2-SHA256 310k + AES-GCM, verifier not PIN, lockout 5 fails → 30 s / 1 m / 5 m / 15 m, key only in worker memory, auto-lock after 5 min idle or on explicit lock | 4 |
| F4 | On-page floating note panel (Shadow DOM, toggled from the toolbar command/button), side-panel fallback where injection is blocked | 4 |
| F5 | 7-day insights (notes created / done) | 4 |
| F6 | Theme: light / dark / system | 5 |
| F7 | Versioned export/import of notes + security record, merge or replace | 5 |
| F8 + | Private-note titles also hidden while locked (improvement the comparison found) | 4 |

### From dailies.html

| # | Feature | Phase |
|---|---|---|
| L1 | Daily recurring tasks, counted from their created date | 2a (model) / 2b (UI) |
| L2 | One-off "extra" tasks per day; copy or move an extra task to another day | 2b |
| L3 | Day note | 4 (note with `day`) / 2b (day-sheet slot) |
| L4 | Month calendar grid shaded by completion ratio; today ring; future days muted; prev/next month + Today | 2b |
| L5 | Day sheet (modal): recurring tasks to tick, extra tasks, note | 2b |
| L6 | Archive a recurring task (keeps history), restore, purge permanently | 2a (model) / 5 (UI) |
| L7 + | Stats: current and longest streak, 365-day heatmap, weekday bars, per-task completion rate, summary cards | 5 |
| L8 | Dark mode toggle that also follows the OS when unset (covered by F6) | 5 |
| L9 | Keyboard: Esc closes the day sheet, arrows move months, `T` jumps to today | 2b |
| L10 | Rollover: an open page refreshes "today" after midnight (focus/visibility) | 2b |

### Weekly-only (must survive)

| # | Feature | Phase |
|---|---|---|
| W1 | All Weekly 2 features (tracking, report, drafts, AI, integrations, history fill, trends, export/import, popup quick note) | regression gate every phase |
| W2 | Done section in the update (one-offs + recurring counts), Other-work from day notes | 2b / 4 |
| W3 | `tabs` optional; welcome asks "Track my week?" | 5 |

## Privacy and quality rules carried from the merge spec

- Local storage only (no `storage.sync`).
- No `innerHTML`: the build test enforces it.
- Every file ≤ 300 lines and every function ≤ 50 lines.
- Tests run in two timezones.
- Imported files are untrusted.
- No network calls except the existing opt-ins.
- No remote fonts.
