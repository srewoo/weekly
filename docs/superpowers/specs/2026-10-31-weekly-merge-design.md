# Weekly 3.0: merging Daybook and ForgetMeNot into Weekly

Status: design approved in conversation on 2026-10-31, awaiting spec review.
Rollback point: `snapshots/weekly-2.0.0-source-2026-10-31.zip` (no git, by decision).

## 1. Goal

Ship one Chrome extension, **Weekly**, that covers the whole working week:

- **plan** (Daybook's tasks, reminders and carry-over),
- **capture** (ForgetMeNot's notes, including the on-page note and PIN-locked private notes),
- **report** (Weekly's tracking and drafted update).

Daybook and ForgetMeNot are currently published. They will be retired after a farewell update. Weekly is the only listing going forward.

**Success criteria**

1. A user can add a task in one line, tick it, and see it in the weekly update's **Done** section.
2. A user who never turns on tracking gets a task-and-notes app whose install shows no browsing-history warning.
3. Existing Daybook and ForgetMeNot users can move all their data into Weekly with their existing export files.
4. Every test from the three source projects passes in the new structure, alongside new tests for the merged behaviour.

## 2. Decisions taken

| Question | Decision |
|---|---|
| Which listing survives | Weekly. Daybook and ForgetMeNot are unpublished after a farewell update (§8). |
| Task entry | dailies.html style: a one-line add box, recurring daily tasks, one-off tasks per day, and a day note. |
| Features kept | All four: morning brief + evening check, due dates + priorities, on-page sticky note, PIN-locked private notes. |
| Toolbar icon | Opens Chrome's **side panel**. |
| Visual language | Weekly's (paper, navy ink, yellow marker, Charter serif, W icon) with dailies' layout patterns. |
| Code base | Daybook's architecture (ES modules, `lib/` / `background/` / `ui/`), Weekly's repo and brand. |
| Version control | No git. A zip snapshot is the rollback point. |

## 3. What the user sees

### 3.1 Side panel (toolbar icon)

The panel has three tabs and an **Open Weekly** link to the full app.

- **Today** is the default.
  - A one-line "Add a task for today…" box and an **Add** button.
  - Bands, in this order: **Overdue**, **Today** (recurring tasks first, then today's other tasks), and **No date** (collapsed).
  - A footer with time tracked today, Pause, and **Note on this page**.
  - Priority and due date are set from a row's ⋯ menu, never in the add box.
- **Notes**: search, pin, the five categories (General · Work · Personal · Idea · To-Read), mark done, and a 🔒 Private toggle. A note may be attached to a day.
- **Week**: the Mon–Fri strip with tracked hours, the count of tasks done this week, and **Open full report →**.

### 3.2 Full app tab (`app.html`)

The app has four views.

- **Calendar** (dailies layout):
  - A month grid where each day is shaded by the share of its tasks done (Weekly palette: marker wash → marker).
  - Clicking a day opens its day sheet:
    - **Daily tasks** (recurring, tick for that day).
    - **Extra tasks for this day**: add, tick, delete, and move to another day.
    - **Day note**.
- **Week report**: today's Weekly report and draft. The draft gains a leading **Done** section built from tasks completed in the week. Existing sections are unchanged.
  - One-off tasks with `completedAt` inside Mon–Fri are listed once each, ordered by priority and then completion time.
  - A recurring task is listed once with its count, e.g. "Standup notes (5 of 5 days)". It is listed only if it was ticked at least once that week.
  - Each item can be unticked in the report like any other item. Exclusion is per week, as now.
  - **Hide people and customer names** applies only to tracked CRM, HR and support items, because it works by category. Task titles and notes are the user's own words and appear as written. The checkbox's helper text says so.
- **Notes**: the same notes at full width.
- **Settings** has four groups:
  - Weekly's current settings.
  - Reminders: morning time, evening time, working days, system notification, catch-up on startup.
  - Notes PIN: set, change, remove.
  - Tracking on/off: grants or revokes the `tabs` permission.

### 3.3 Reminders (from Daybook)

- **Morning brief**: today's and overdue tasks.
- **Evening check**: what is still open, with **Move to tomorrow** per task and **Move all to tomorrow**. On the last working day of the week, it also links to the week report.
- The reminders replace Weekly's Friday 4 pm reminder.
- Daybook's behaviour is kept:
  - one-shot alarms recomputed from the local calendar, so they stay correct across DST;
  - one reminder window, which is reused;
  - catch-up on startup.

### 3.4 On-page note (from ForgetMeNot)

- **Alt+N** (Chrome command) or **Note on this page** in the panel injects a floating note panel into the active tab, inside a Shadow DOM.
- It uses `activeTab` + `scripting`, so it works on normal web pages only, not on `chrome://` pages or the Web Store. On those pages the side panel's Notes tab is the fallback.

### 3.5 Welcome page

Order of steps:

1. **Track my week?** If yes, request `tabs`. If no, Weekly works as a task-and-notes app.
2. Role.
3. Fill in from history. Shown only if tracking is on.
4. Morning/evening reminders.
5. Hide names.

### 3.6 Permissions

| When | Permissions |
|---|---|
| Install | `storage`, `unlimitedStorage`, `alarms`, `notifications`, `idle`, `sidePanel`, `scripting`, `activeTab`, `downloads` |
| Optional, requested at the moment of use | `tabs` (tracking), `history` (fill from history), `https://*/*` (Jira/GitLab/GitHub status) |

## 4. Data and storage

All data lives in `chrome.storage.local`. Nothing goes to `storage.sync`, because sync would carry data off the computer through the user's Google account and break the privacy promise.

| Key | Contents | Origin |
|---|---|---|
| `tasks` | `Task[]` | Daybook, extended |
| `notes` | `Note[]` (replaces Weekly 2's `{id, ts, text}` notes) | ForgetMeNot, extended |
| `security` | PIN salt and verifier, never the PIN | ForgetMeNot |
| `settings` | single merged object | Weekly + Daybook |
| `day:*`, `hist:*`, `meta:*`, `imp:*:*`, `excluded:*`, `draft:*:*` | activity and report state, unchanged | Weekly |
| `uiState`, `reminderState`, `schemaVersion` | | Daybook |

**Task** has Daybook's fields `{id, title, description, priority, dueDate|null, status, createdAt, updatedAt, completedAt}`, plus:

- `repeat: null | { days: number[] (0=Sun…6=Sat, default [1..5]), from: 'YYYY-MM-DD', until: 'YYYY-MM-DD' | null }`
- `doneDates: string[]`: the days a recurring task was ticked. A recurring task's `status` stays `open`.
- "Deleting" a recurring task sets `until` to yesterday, so the calendar history stays true. Hard delete is a separate, confirmed action.
- An extra task for a day is a task with that `dueDate`. A task with no date shows in the **No date** band.

**Note** has ForgetMeNot's fields `{id, title, body, category, pinned, done, createdAt, updatedAt, completedAt, enc?}`, plus:

- `day: 'YYYY-MM-DD' | null`. The calendar's day note is the note with `day = D` and an empty title.

**Private notes** (`enc` set):

- The body is ciphertext at rest and in exports.
- They never appear in the draft, the AI prompt, search snippets, the Other work feed, or the on-page panel while locked.
- The key exists only in service-worker memory. It is dropped on idle, on lock, and when the worker restarts.

**Writes and consumers**

- Tasks, notes, settings and security all go through `storage.mutate()`, the serialised lock from Daybook.
- Activity keys keep Weekly's service-worker write queue. Only the service worker writes activity.
- Every surface re-renders from `storage.onChanged`.

**Migration** sets `schemaVersion: 2`. `migrate()` runs on every load:

- v0/v1 → v2 converts Weekly 2 notes into `Note` (`day` = the note's date, category `Work`).
- It folds Weekly's settings and Daybook's defaults into one object.
- It leaves activity keys untouched.

**Import** detects the format and validates every field (the existing `cleanEntry` approach, extended):

- **Weekly export**: activity is merged per device, as now.
- **Daybook backup** (`portability.js` format): tasks are added and deduplicated by id.
- **ForgetMeNot backup** (`exportAll` v1/v2): notes and the security record. If a security record already exists, the user confirms which PIN wins.

**Retention**

- Activity is purged after 90 days, as now.
- Tasks and notes are kept until the user deletes them.

## 5. Code structure

```
manifest.json                    "Weekly" 3.0.0, background service_worker type: module
src/lib/                         no DOM; chrome.* only via storage.js
  dates.js schema.js storage.js  Daybook (+ Mon–Fri helpers, migrate v2)
  tasks.js                       Daybook + recurrence (occursOn, isDoneOn, toggleOn)
  notes.js crypto.js             ForgetMeNot, as ES modules
  reminders.js portability.js    Daybook (+ three-format import)
  activity/ classify.js tracker.js history.js range.js     Weekly
  report/   draft.js ai.js integrations.js trends.js       Weekly (+ Done section)
src/background/service-worker.js tracking events, alarms, reminders, crypto broker, commands, side-panel behaviour
src/ui/components/               task row, add box, note card, day strip, h() builder (textContent only)
src/ui/panel/                    side panel: today, notes, week
src/ui/app/                      calendar, report, notes, settings (one module per view)
src/ui/welcome/ src/ui/remind/
src/content/onpage-note.js       self-contained classic script; data only via runtime messages
```

**Rules**

- `lib/` never touches the DOM.
- `ui/` never touches `chrome.storage` directly.
- No `innerHTML` anywhere. Weekly 2's string-built report is rewritten with the `h()` builder.
- No file over 300 lines and no function over 50 lines.
- Dates are never parsed as UTC (use Daybook's `dates.js`).
- `classify.js` and `draft.js` stay pure and are tested without Chrome.

**Messages to the service worker**

| Message | Purpose |
|---|---|
| `notes:list` / `notes:save` / `notes:delete` | note CRUD (used by the on-page note) |
| `crypto:unlock` / `crypto:lock` / `crypto:encrypt` / `crypto:decrypt` | private notes |
| `panel:openOnPage` | inject the on-page note into the active tab |
| `tracking:setEnabled` | after the `tabs` permission is granted or revoked |

## 6. Error handling

- Service-worker failures show the existing "!" badge and a plain-language message in the panel. A full disk or storage quota is explained, never silent.
- A wrong PIN uses ForgetMeNot's existing back-off. Encryption is not supported on plain `http://` pages in the content script, which is why it is brokered by the service worker.
- A rejected import says which field or format failed, and nothing is partially written: the import is validated first, then written in one `mutate()`.
- A denied permission (`tabs`, `history`, hosts) leaves the feature off with a one-line explanation, never an uncaught promise.

## 7. Testing

- **Unit tests** use `node:test` with Daybook's Chrome stub, run under `TZ=America/New_York` and `TZ=Asia/Kolkata`. They carry over Daybook's 102 tests, ForgetMeNot's store and crypto tests, and Weekly's 16. New tests cover:
  - recurrence: `occursOn`, ticking per day, `until` on delete, calendar shading ratio;
  - the Done section;
  - private-note exclusion from the draft, AI prompt and Other work;
  - migration v1 → v2;
  - the three import formats, using real backup files from each project;
  - the merged settings defaults.
- **Type checking**: `tsc --strict` over the JSDoc-typed sources, using Daybook's `jsconfig.json`. `typescript` and `@types/chrome` are dev-only dependencies.
- **End-to-end**: the Playwright suite, rebuilt. Side panel and app pages are opened directly as extension URLs.
  - Flows: add/tick/recurring/move to another day; evening check → Move to tomorrow; private note round-trip; Alt+N on a real page; tracking off → no `tabs`; import of each backup format; everything existing in Weekly 2 (89+ checks).
- **Build**: `npm run package` → `dist/weekly-3.0.0.zip`, plus an end-to-end run on the unzipped build.

## 8. Build order and release

| Phase | Scope | Exit gate |
|---|---|---|
| 1. Foundation | Move to `src/` + ES modules + module service worker; bring in Daybook `dates`/`storage`/`schema`; replace `innerHTML`. **No new features.** | Weekly 2 unit tests and the full end-to-end suite pass unchanged; typecheck clean |
| 2. Tasks | `tasks.js` + recurrence; panel Today; app Calendar and day sheet; Done section | Task, recurrence and Done tests; end-to-end task flows |
| 3. Reminders | Morning/evening, reminder window, carry-over; remove the Friday reminder | Daybook reminder tests, including DST |
| 4. Notes | `notes.js`, `crypto.js` brokered by the service worker; panel and app Notes; day notes; Other work feed; Alt+N on-page note | Store and crypto tests, exclusion tests, end-to-end on a real page |
| 5. Onboarding and data | Welcome "Track my week?"; optional `tabs`; three-format import; migration v2 | Migration and import tests with real backup files |
| 6. Release | Version 3.0.0; regenerate store screenshots; update `store-listing.md` permission justifications and the privacy policy | `npm run package`, then end-to-end on the built zip |

**Retiring Daybook and ForgetMeNot.** Publish one final update to each, with a banner: "*X* is now part of Weekly. Export your data, then import it in Weekly." Both already have export. Unpublish about 30 days later. Unpublishing does not remove installed copies, so no user loses data.

## 9. Out of scope

- Sync between computers (export/import covers it).
- Sharing and collaboration.
- Recurrence other than "on these weekdays".
- Natural-language dates in the add box.
- Changes to the launch video.
