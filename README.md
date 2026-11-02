# Weekly (Chrome extension)

**Your Friday update, written for you.** Every Friday you open a blank doc and try to remember what you did. Weekly keeps the receipts: it drafts your weekly update or daily standup from the tasks you ticked off, the notes you took and, if you turn tracking on, the tabs you worked in. Untick what you don't want, edit the rest, copy it. It all stays on your computer.

It is built first for engineers and product managers: Jira tickets and GitLab/GitHub merge requests are grouped under the ticket they belong to (e.g. ENGX-151). It also groups work for QA, sales, HR and recruiting, SEO and marketing, and support. Optionally, the draft can be polished by **Chrome's built-in AI (Gemini Nano)**, which runs on your computer.

| Shortcut | What it does |
|---|---|
| **Alt+T** | Open the side panel (today's tasks, notes, the week) |
| **Alt+Shift+T** | Open Weekly in a tab (calendar, tasks, your update) |
| **Alt+N** | Write a note on the page you're on |

Change them at `chrome://extensions/shortcuts`.

Beyond the update, Weekly is also your tasks (priorities, daily repeats, a month calendar), notes (with PIN-protected private ones), and optional morning and evening reminders.

## Install
1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this folder.
3. A one-screen welcome page opens. It asks one thing, **Track my week?**: yes and Chrome asks whether Weekly may read your tabs; no and Weekly is your tasks and notes, with nothing recorded. With tracking on you can fill in the last 15 days from Chrome history. **See a sample update** shows a finished weekly update straight away; **Open the side panel** opens it.
4. Pin **Weekly**. Its icon opens the side panel: **Today** (tasks), **Notes** and **Update** (copy this week's update in one click), with time tracked today and **Pause** underneath. Under the tabs, **Open: Tasks · Calendar · Stats ↗** opens the app on that page (Stats once it's switched on; **O** opens the app), whose one menu (**Update · Tasks · Calendar · Notes · Settings**) is the same on every page.

## What it records
- Nothing, until you turn tracking on (the welcome page, or **Settings → Tracking**, which you can turn off again). Tracking needs Chrome's `tabs` permission, so the install itself asks for no access to your browsing.
- Then only the active tab of the focused Chrome window. Time stops when you go idle (default 2 min) or your screen locks; when you go idle, time already counted since your last activity is taken back. If the computer sleeps, time stops at the last minute Weekly saw you working, so sleep never counts (accurate to about a minute).
- **Outside Chrome**: while you're active but Chrome isn't in front (your IDE, a terminal, desktop Slack or Zoom), the minutes are counted as one "Outside Chrome" row. Only the minutes: Weekly can't see which app, so the row stays out of the update until you add a note saying what it was. Turn it off in **Settings → Tracking**.
- Page title, URL, and time per item, grouped into tasks:
  - **Sales & CRM**: Salesforce, HubSpot, Pipedrive, Gong, Outreach, Apollo, LinkedIn Sales Navigator…
  - **Recruiting & HR**: Greenhouse, Lever, Workday, Darwinbox, BambooHR, LinkedIn Recruiter…
  - **SEO & marketing**: Search Console, Google Analytics/Ads, Ahrefs, Semrush, Meta Ads, Mailchimp, WordPress admin…
  - **Customer support**: Zendesk, Freshdesk, Intercom…
  - **Planning**: Jira boards, Asana, Trello, Monday, Linear, ClickUp…
  - **Engineering**: Jira tickets, GitLab/GitHub/Bitbucket/Azure DevOps MRs, CI (pipelines, CircleCI, Jenkins, Vercel…), cloud consoles (AWS, GCP, Azure, Cloudflare…), localhost, staging/QA environments, monitoring tools
  - **Research**: Stack Overflow, MDN, package registries and `docs.`/`developer.` sites
  - **Docs, design, meetings, email/Slack, and AI assistants**
  - Everything else is grouped by domain under **Browsing**. Each Browsing row has **Move to…**: pick a category and the site is filed there for every week, past ones included (it becomes one of your rules).
- Each CRM record, candidate or ticket is its own item. MRs and docs that mention a ticket ID (e.g. ENGX-151) are listed under that ticket.
- It never reads page content, keystrokes or screenshots, and makes no network calls unless you turn on an option below. Data stays in `chrome.storage.local`. Activity is deleted after 90 days; tasks and notes stay until you delete them.

## The update
- A week is **Monday to Friday**. Weekend browsing is still recorded but left out of the report and update; notes you add at the weekend still count.
- **Formats**: a weekly update, or a daily standup (yesterday, today, blockers).
- **Tidy up with Chrome AI**: rewrites the draft with Chrome's built-in model (Gemini Nano) for your role. It needs desktop Chrome 138+ and a capable computer; the first use downloads the model (about 2 GB). Nothing leaves your computer. **Undo** restores your draft. Every sentence it writes is checked against the line of your draft it's about. A sentence is removed if it adds a ticket, commit, number or `[status]` that isn't in your log, or claims something your log doesn't show: that an item was updated, added, tested, merged or completed (items under **Done** were completed), or that something *didn't* happen ("no issues found"). It's also removed if its words mostly aren't from your log. Repeated items go too. A made-up "Done" heading becomes "Other", and a standup's Blockers line stays blank for you. The page says how many sentences were removed; if nothing survives, your draft is kept. An empty week is never sent to the model. The check was tuned on real Gemini Nano output (`test/fixtures/nano-outputs.json`). Where it can't run, the button is hidden and **Copy for ChatGPT or Claude** is suggested.
- **Hide people and customer names**: candidates, customers and support cases become "Candidate 1", "Customer 2"… so a draft is safe to paste into a shared channel. It's on by default for HR, sales and support roles. Task titles and notes are your own words and appear as you wrote them.
- Your edits are saved per week and never overwritten by new activity. **Rebuild from log** starts over.
- Untick an item to leave it out of that week's update.
- **Copy update**, with **Copy as**: Markdown, Slack, Email, Rich text (Google Docs, Notion, Confluence) or With AI prompt (ChatGPT, Claude…). **Post to Slack** appears once you add an incoming webhook in Settings. The AI prompt and Slack post ask once before anything leaves your computer.
- The standup's Blockers line is left blank for you to fill in.

## Tasks
- **Side panel** (the toolbar icon): add a task in one line and tick it off. Quick-add words set the rest: `Call Sam tomorrow !high`, `Report on fri`, `Standup every weekday`, `Gym every mon, wed`. A task's **⋯** menu sets its priority and due date, moves it to tomorrow or deletes it. Bands: **Overdue**, **Today** (daily tasks first) and **No date**. **Undo** in the message, or ⌘Z / Ctrl+Z, reverses the last tick, move or delete. Keys: N new task, O open the app.
- **Calendar**: each day is shaded by how much of its tasks got done. Click a day for its sheet: daily tasks to tick, extra tasks for that day (move or copy them to another day) and notes. ← → change month, T jumps to today, Esc closes the sheet.
- **Tasks**: Today, Week, Overdue, Upcoming, All open and Completed, with search ( / ) and a priority filter. **Edit…** in a task's ⋯ menu changes its title, description, priority and date, or a repeating task's days.
- **Stats** (off by default; turn on in **Settings → Advanced**): days in a row with everything done (days with nothing on them don't break a run; today counts once it's done), the longest run, a year of days shaded like the calendar, how each weekday goes, and how often each daily task was ticked on the days it was due.
- **Daily tasks** (on **Stats**): **Stop repeating** ends a daily task from today and keeps its past ticks; stopped ones are listed underneath with **Repeat again**. **Delete…** removes a daily task and all its ticks, after asking (**Undo** still brings it back).
- **Done**: tasks closed Monday to Friday lead the weekly update. A daily task appears once with its count, e.g. "Standup notes (4 of 5 days)". Untick any of them to leave it out of that week.

## Notes
- **Notes** (side panel tab, and **Notes** in the app): write a note with an optional title, a category (General, Work, Personal, Idea, To-Read) and, if you like, a day. Search covers titles and text; filter by category; pin a note to the top, tick it done, edit or delete it (**Undo** brings it back). The app also shows the last 7 days: notes created and done per day.
- **Day notes**: a note added in a day's sheet, in the panel's Notes tab (it defaults to today) or in the report is attached to that day. Day notes are the update's **Other work**. Weekly 2's notes become day notes (category Work) the first time they are read.
- **Private notes**: set a PIN (4 to 8 digits) in **Settings → Privacy**, then tick **Private** on a note. Its title and text are encrypted on this computer (PBKDF2-SHA256, 310,000 rounds, AES-GCM); while locked it shows only "Private note". The PIN is never stored, only a salt and a check value. The key lives in Weekly's background worker, never on disk. The worker drops it when you lock, after 5 minutes without using a private note, or sooner: Chrome stops an idle background worker after about 30 seconds, and the key goes with it; a page also forgets the words it opened after 5 idle minutes. Five wrong PINs pause unlocking for 30 seconds, then 1, 5 and 15 minutes. Private notes never reach the update, the AI tidy-up, search while locked, or a web page. Forget the PIN and they cannot be recovered.
- **On-page note**: **Alt+N** opens a small note on the page you're on; it saves into Weekly. **Note on this page** in the panel does the same on sites Weekly may already open (for example one you allowed for live status); elsewhere it opens the panel's Notes tab so you can write it there, or press Alt+N on the page. Chrome keeps extensions off its own pages and the Web Store; there Alt+N opens the side panel's Notes tab instead.

## Reminders
- **Morning brief** (09:00): what's due today, daily tasks first, and what's overdue. Skipped when there's nothing to report.
- **Evening check** (18:00): what's still open, with **Tomorrow** on each task and **Move all to tomorrow**. Once you keep tasks it always shows: "nothing left open" is the point. Until you add one, it comes only on your last working day, for the update. On your last working day it also links to the week report, where your update is drafted.
- Both open in one small window that is reused, with a system notification that reaches you when Chrome isn't the app in front. Closing the window clears the notification too. **Snooze 1 h** brings the evening check back.
- **Missed reminders**: one missed while Chrome was closed shows when Chrome starts, if its time has passed today. One missed while the computer was asleep shows when it wakes on the same day; a check from an earlier day is dropped, not shown late.
- **Coming from Weekly 2**: the reminders start on only if Weekly 2's Friday reminder was on. Otherwise turn them on in **Settings → Reminders**. The Friday 4 pm reminder itself is gone; the evening check on your last working day links to the week report instead. Weekly 3 asks before tracking (the `tabs` permission is optional now): an upgrade that lost that grant for someone who tracked under Weekly 2 reopens the welcome page to ask again.
- **Settings → Reminders** sets the times, the working days (Monday to Friday by default), the notification, whether the window opens too (off: just the notification, which opens the window when clicked) and catch-up. **Preview** opens the window now.
- Anywhere in Chrome: **Alt+T** opens the side panel, **Alt+Shift+T** opens Weekly in a tab and **Alt+N** opens a note on the page. Change them at `chrome://extensions/shortcuts`.

## Optional extras (each asks for permission first)
- **Fill in from history**: for the last 15 days, rebuild what wasn't tracked from your Chrome history, including the hours before tracking started on the day you installed. Times are estimated from the gaps between page visits, marked `~`, and replaced by live tracking whenever it exists. Only this computer's history is read; history synced from your phone is skipped. **Remove history estimates** deletes them and turns history access back off.
- **Live status**: shows Jira status and MR/PR state (Done, merged…) using your existing browser login. Click **Allow** on the banner.
- **Backups and other computers**: **Export** saves tasks, notes (private ones stay encrypted), the PIN record (never the PIN), settings (never the Slack webhook) and activity. Keep export files private: anyone holding one could try short PINs offline (the report says so), so with private notes use a PIN of 6 to 8 digits. **Import a backup** takes that file, a Daybook backup or a ForgetMeNot export. It says what the file holds before anything changes, then **Add** (tasks you have are never overwritten; of two copies of a note the newer stays) or **Replace** (swaps only what the file carries: a Daybook backup replaces tasks, a ForgetMeNot export notes). Replace with a Weekly export swaps tasks, notes and settings; Add never imports settings; your Slack webhook is always kept. The file is checked first and then written in one step, so a bad file changes nothing. Private notes need the PIN they were locked with; if you have a different PIN, you choose which one to keep. Activity from another computer is kept under that computer, so importing it again replaces it rather than adding it twice. Files over 20 MB are refused.
- **Trends**: focused work vs. meetings, time outside Chrome, and task switches per day, for the last 8 weeks; the current week is marked "so far".

## Customise
In **Settings**, add your own rules, one per line: `site or path => Category | Label`. For example:

```
acme.my.site.com/partners => Sales & CRM | Partner portal
```

You can also limit which ticket prefixes count (e.g. `ENGX, MKT`). Rules apply to every week, past ones included (**Move to…** on a Browsing row writes one for you); prefixes apply to activity recorded from then on.

**Settings → Appearance** picks light, dark, or the same as your computer (the default). It applies at once to every Weekly page, including the note you open on a web page.

## Limits
- A Chrome extension can't see which desktop app you're in (IDE, Slack desktop, Zoom app): it counts those minutes as **Outside Chrome**, and a note says what they were.
- Times are for "what did I work on", accurate to about a minute; it is not a billing timesheet.
- Incognito windows are only tracked if you allow it in the extension's details page.

## Development
Needs Node 22+. No runtime dependencies; `npm install` fetches dev-only `typescript` and `@types/chrome` for the typecheck.

| Command | What it does |
|---|---|
| `npm test` | Unit tests, run twice: New York (DST) and Kolkata time |
| `npm run typecheck` | `tsc --strict` over `src/lib`, `src/background`, `src/content` and the task and notes UI (`src/ui/components`, `src/ui/panel`, `src/ui/app`, `src/ui/remind`) (JSDoc types) |
| `npm run e2e` | Builds, loads the extension in Chromium, runs the end-to-end suite, then the no-tabs checks on the build as shipped |
| `npm run e2e:zip` | The same two runs on `dist/weekly-<version>.zip`, unzipped: the file you upload to the store |
| `npm run build` | Copies `manifest.json`, `icons/` and `src/` into `dist/weekly/` (load this folder unpacked), stamps the version from `package.json`, checks every file and module import resolves |
| `npm run zip` | Builds, then writes `dist/weekly-<version>.zip` for the Chrome Web Store (`manifest.json` at the zip root) |
| `npm run package` | Tests, typecheck, build and zip in one go. Use this for releases |
| `npm run parity` | Walks the feature-parity checklist: every row must name a unit test that exists or an end-to-end check that passed in the last run (`test/parity-proofs.mjs`) |
| `npm run release:check` | `package`, then `e2e:zip`, then `parity`: the release gate |

### Layout

```
manifest.json
src/lib/           domain: no DOM
  dates.js         local-calendar arithmetic (never UTC)
  week.js          week/day helpers and duration formatting
  settings.js      the only owner of the settings key
  schema.js        task shape, validation, migration (schemaVersion 2)
  storage.js       tasks, uiState, reminderState; mutate() and withLock(); replaceTasks, onTasksChanged, and the Web Lock the notes writes also use
  tasks.js         task writes; the one import site for task views and recurrence
  task-views.js    due-state predicates, sections, counts, search
  recurrence.js    recurring tasks, day completion, Done-section data
  task-portability.js  task writes for an import (merge / replace), delete all tasks
  planner.js       what the task screens draw: Today bands, month grid, Done range (via tasks.js)
  notes.js         the only owner of the notes key: writes under the notes lock, Weekly 2 notes converted by shape
  note-views.js    note shape and validation, search, day notes, Other work, 7-day insights (pure)
  crypto.js        PIN crypto: PBKDF2 + AES-GCM, the PIN record, lockout steps (pure WebCrypto)
  reminders.js     what the morning brief and evening check say (pure)
  backup.js        reads a Weekly export, a Daybook backup or a ForgetMeNot export, validated (pure)
  portability.js   export, and writing an accepted import in one storage write
  stats.js         streaks, the year of days, weekday and per-task rates (pure)
  activity/        classify, history, range loading, tracker status and the tabs permission
  report-store.js  the report's own keys: per-week exclusions, saved drafts, share consents, Copy as
  report/          draft, trends, ai prompt, grounding (checks AI lines against the draft), integrations
src/background/    the MV3 service worker, tracker, reminder engine, PIN broker (crypto-broker.js, with its import helpers in crypto-import.js), on-page note (onpage.js) and sender.js (isOurs, isOwnPage: who may send which message)
src/content/       onpage-note.js: the on-page note, injected on demand (classic script, closed Shadow DOM)
src/ui/            panel/ (side panel), app/ (calendar, tasks, notes, stats), remind/ (reminder window), welcome, report tab
  components/      dom.js (h() builds all DOM), theme.js (and theme-boot.js, a classic script first in every page head that mirrors the theme from localStorage before paint), task rows, bands, undo toast, keys, the notes view and private-note client
test/              node:test, no browser required; test/e2e drives real Chromium; parity-proofs.mjs names the proof of each parity row
scripts/           build.mjs, zip.mjs, parity.mjs (the parity gate)
store-assets/      Chrome Web Store text, privacy policy, screenshots and promo tiles (generate.mjs remakes the images)
```

Two rules keep this honest: `lib/` never touches the DOM, and `ui/` never touches `chrome.storage` directly, with no exceptions (`test/no-ui-storage.test.js` fails if one appears). The report's own keys (`excluded:*`, `draft:*`, `shareOk`, `copyAs`, the status nudge) belong to `lib/report-store.js`; deleting activity belongs to `lib/portability.js`. Settings always go through `lib/settings.js`. The side panel, the app tab and the reminder window have no exceptions: tasks come from `lib/tasks.js`, notes from `lib/notes.js`, tracker status from `lib/activity/status.js`. Private notes are opened and sealed only by the worker, over `crypto:*` messages; the on-page note reads and writes plain notes only, over `notes:*` messages. The worker has one gate on `runtime.onMessage`: a content script may send only `notes:*`; `crypto:*`, `panel:*` and reminder messages must come from Weekly's own pages (`isOwnPage` in `src/background/sender.js`), or the reply is "Not allowed."; senders that are not this extension get no reply.

Every read-modify-write of `tasks`, `notes`, `settings`, `uiState` and `reminderState` runs under a Web Lock (`withLock` in `lib/storage.js`). The side panel, the app and report tabs and the service worker share one lock manager, so none of them can drop another's change. Node tests fall back to a per-context promise chain. Locks are not re-entrant: a `mutate()` or `mutateNotes()` callback is synchronous and never calls `getTasks()` or `getNotes()`.

To release: bump `version` in `package.json` and `manifest.json` (e.g. `npm version patch --no-git-tag-version`, then the same number in `manifest.json`; a unit test fails while they differ), then `npm run release:check`. The store text, privacy policy and screenshots are in `store-assets/`; its README says how to remake the screenshots.
