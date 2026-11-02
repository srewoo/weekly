# Weekly: Chrome Web Store listing

> **BLOCKER before submission: the privacy policy has no public URL yet.**
> The Basics table below holds the placeholder `https://[host this file publicly]/privacy-policy.html`. The Web Store rejects a submission without a working public URL. Do this first:
> 1. Publish `store-assets/privacy-policy.html` on any static host. GitHub Pages: put the file in a public repo as `privacy-policy.html` (or under `docs/`), then Settings, Pages, deploy from the branch; the URL is `https://<user>.github.io/<repo>/privacy-policy.html`.
> 2. Open that URL in a private window and check it loads, says version 3.0.0 and the right "Last updated" date.
> 3. Replace the placeholder in the table below and paste the URL in the Privacy tab (Developer Dashboard, Privacy practices, Privacy policy).

Version 3.0.0 (Manifest V3). Everything below is taken from the code in this repo; nothing here claims a feature the code lacks. Weekly 3.0 takes in Daybook (tasks and reminders) and ForgetMeNot (notes), which are being retired (update notes for their users: `README.md` in this folder).

## Basics

| Field | Value |
|---|---|
| Name | Weekly |
| Category | Productivity (Workflow & Planning) |
| Language | English |
| Short description (131 chars, limit 132) | Your Friday update, drafted for you: a weekly report or standup from your tasks, notes and (optional) tabs. Stays on your computer. |
| Privacy policy URL | `https://[host this file publicly]/privacy-policy.html` |
| Support / contact | srewoo@gmail.com |

The short description is the manifest description, unchanged. It leads with the outcome (the drafted update), not the feature list.

## Single purpose

Drafts your weekly update or daily standup from the work you did in Chrome, your tasks and notes.

Tasks, notes and reminders exist only as inputs to that purpose: the tasks you tick off and the notes you write become the update, and the morning and evening reminders prompt you to record them. Tracking the tabs you worked in is optional.

## Detailed description (paste as plain text)

```
Every Friday you open a blank doc and try to remember what you did. Weekly keeps the receipts.

Weekly drafts your weekly update or daily standup from the tasks you ticked off, the notes you took and, if you turn it on, the tabs you worked in. You untick what you do not want, edit the rest, and copy it. It stays on your computer.

WHAT YOU GET (an example)
Done
- Ship the CSV export to beta
- Write the ENGX-162 postmortem
- Standup notes (5 of 5 days)
Tickets
- ENGX-151: Export report to CSV
  - MR: web !418: Add CSV export endpoint
Other work
- Sprint planning: agreed scope for 4.2
Next week
- Roll the CSV export out to everyone

Built for engineers and product managers: Jira tickets, GitLab and GitHub merge requests and pipelines are grouped under the ticket they belong to (for example ENGX-151), with live status if you allow it. It also groups other kinds of work (QA, support and more).

HOW IT FILLS ITSELF IN
- Tasks you finish lead the update. Add one in a line from the side panel; a quick-add line understands due dates like "tomorrow" and "every weekday", and priority.
- Notes you take come last, as Other work. Alt+N writes a note on the page you are on.
- Tracking is optional. Turn it on and Weekly also lists the tickets, merge requests, docs, deals, candidates and support cases you spent time on, so the update includes work that never made it onto a task list.
- Copy it as plain text, or for Slack, email, or Docs and Notion. Post to Slack through your own webhook. Or "Copy for ChatGPT or Claude" if you want an assistant to polish it.
- Weekly update (Monday to Friday) or standup (yesterday, today, blockers).

SHORTCUTS
Alt+T opens the side panel. Alt+Shift+T opens Weekly in a tab. Alt+N writes a note on the page you are on. Change them at chrome://extensions/shortcuts.

TRACKING IS OFF UNTIL YOU TURN IT ON
Weekly asks "Track my week?" once. Say no and it records no browsing at all; it is a task and notes app with reminders. Say yes and Chrome asks for "Read your browsing history".
- Weekly records the address and title of the active tab in the focused window, and for how long, only while you are at the keyboard. It stops when you go idle or lock your screen.
- While you work in another app (your IDE, a terminal, the Zoom app), it counts only the minutes, as "Outside Chrome", never which app. You can turn this off.
- It never reads page content, keystrokes or screenshots.
- "Hide people and customer names" turns candidates and customers into Candidate 1, Customer 2 before you paste an update anywhere.
- Turn tracking off in Settings whenever you like. Activity is deleted after 90 days.

YOUR DATA STAYS ON YOUR COMPUTER
No account, no analytics, no ads, no servers of ours. Nothing leaves your computer unless you copy or post your update, export a backup, or turn on live Jira, GitLab or GitHub status.

ALSO INCLUDED
Tasks with priorities, daily repeats, a month calendar, a morning brief at 9:00 and an evening check at 18:00 (both optional), notes with PIN-protected private notes (encrypted on your computer, never in your update), and Chrome's on-device AI (Gemini Nano) if you want it to tidy the draft.

LIMITS
A Chrome extension cannot see which desktop app you are in (IDE, Slack desktop, the Zoom app): that time shows as "Outside Chrome", and a note says what it was. Weekly cannot add its on-page note to Chrome's own pages or the Chrome Web Store; use the Notes tab in the side panel there.

Imports from Daybook (tasks, reminders) and ForgetMeNot (notes): export from the old app, then Import a backup under Settings, Your data.
```

## Permission justifications (for the reviewer)

Paste each into the matching field on the Privacy practices tab. The first eight are granted at install; none of them shows a warning about browsing history.

| Permission | Justification |
|---|---|
| `storage` | Saves tasks, notes, settings, saved draft edits and (if tracking is on) the activity log in `chrome.storage.local` on the user's computer, and the tab being timed and the reminder window's id in `chrome.storage.session`. Nothing is synced or sent anywhere. |
| `unlimitedStorage` | Tasks and notes are kept until the user deletes them, and the activity log keeps up to 90 days. This stops Chrome's default quota from silently stopping a save. Activity older than 90 days is purged automatically. |
| `idle` | When tracking is on, stops the timer when the user is away or the screen is locked (`chrome.idle.queryState`, `setDetectionInterval`), so time is not counted while nobody is working. |
| `alarms` | One-shot alarms for the morning brief and evening check, recomputed from the local clock after each one so they stay right across daylight-saving changes, and a snooze alarm for the evening check, and a one-minute `tick` that keeps the tracking timer correct in a Manifest V3 service worker that Chrome stops when idle. |
| `notifications` | Shows the morning brief and evening check as a system notification, so a reminder is seen when Chrome is not the app in front. The user can turn the notification off in Settings and keep only the reminder window. Clicking it opens that window. |
| `sidePanel` | The toolbar icon opens Weekly in Chrome's side panel: today's tasks, notes and the week. Alt+T opens it from the keyboard. |
| `scripting` | Used only to add Weekly's own note panel to the page the user is on, when the user presses Alt+N, or clicks "Note on this page" in the side panel on a site they already allowed for live status (`chrome.scripting.executeScript` with a file from the package). The panel shows and saves the user's own notes; it does not read the page. There are no content scripts that run by themselves. |
| `activeTab` | Gives `scripting` access to the current tab only, and only at the moment the user presses Alt+N, the one trigger Chrome grants it for. It is used for nothing else: no other feature reads or touches a tab. The side panel's "Note on this page" button works only on sites the user already allowed for live status; elsewhere it points to Alt+N or the Notes tab. |
| `tabs` (optional) | Requested only when the user says yes to "Track my week?" on the welcome page or turns tracking on in Settings; Chrome shows its "Read your browsing history" prompt. Weekly then reads the URL and title of the active tab in the focused window (`chrome.tabs.query`, `onActivated`, `onUpdated`) to log which piece of work the user was on and for how long. Turning tracking off in Settings gives the permission back. Without it nothing is recorded. If someone who tracked in Weekly 2 updates and the grant is gone, the welcome page opens once to ask again. |
| `history` (optional) | Requested only when the user clicks "Fill in from history" or "Fill last 15 days from history" in Settings, offered for time in that window that was not tracked (days before install, and the hours before tracking began on the install day). Reads the last 15 days of local visit history (`chrome.history.search`, `getVisits`) to fill that untracked time, with times estimated and marked ~. Visits synced from other devices are skipped. Nothing is sent anywhere. "Remove history estimates" deletes them and gives the permission back. |
| `https://*/*` (optional host permission) | Never granted at install, and never requested in bulk. Chrome is asked for one specific site only when the user clicks "Allow status checks" for their own Jira, GitLab or GitHub host (for example `https://acme.atlassian.net/*`) to show live ticket and merge request status, or clicks "Post to Slack" for `https://hooks.slack.com/*`. Self-hosted Jira and GitLab domains cannot be listed in advance, which is why a wildcard pattern must be declared. Status is fetched with the user's existing login; no other site is contacted, and no data is sent to us. |

Every permission serves the single purpose above. Notes for the reviewer: no `<all_urls>` at install, no content scripts declared in the manifest, no `webRequest`, no remote code, no `eval`. `downloads` is not requested: Export saves through a normal download link.

## Data usage disclosure (Privacy practices tab)

**Data types handled** (tick only these):
- **Web history**: only if the user turns tracking on: the URL, title and time spent for the active tab, plus (optional) Chrome history when the user fills in past days.
- **User activity**: only if the user turns tracking on: tab focus and idle state, used to time work. No keystrokes, clicks, mouse movement or scrolling.
- **Website content**: not collected. The on-page note is added to a page only when the user asks for it, and does not read the page.

**Not collected:** personally identifiable information, health, financial, authentication information (the extension never sees or stores passwords or tokens; Jira and GitLab lookups use the browser's own cookies and are not read by the extension), personal communications, location. Tasks and notes are text the user types into Weekly and are stored only on their computer.

**Certifications (tick all three):**
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Data handling statement:** all data stays in `chrome.storage.local` on the user's computer. Tracked activity is deleted after 90 days; tasks and notes are kept until the user deletes them. There are no servers operated by the developer. Data leaves the computer only on a user action: copying the draft, posting it to the user's Slack webhook, saving an export file, or (opt-in) asking the user's own Jira, GitLab or GitHub for status.

**Remote code:** No. All JavaScript ships inside the extension package. No eval, no remotely hosted scripts. The optional "Polish with on-device AI" feature uses the on-device model built into Chrome; the first use may download that model through Chrome itself.

## Reviewer test instructions

```
No account or login is needed. Weekly works offline and has no backend.

1. Install the extension. A welcome page opens and asks "Track my week?". Either answer works; "No thanks" keeps tracking off. "See a sample update" shows a finished weekly update built from sample data; "Go to my update" opens your own.
2. Pin Weekly and click its toolbar icon: the side panel opens on Today. Type a task and press Enter. Tick it. Use the ... menu on a task to set a priority or a date.
3. Click "Calendar" in the panel's "Open: Tasks · Calendar" row. Click today to see its sheet, with daily tasks, extra tasks and a note.
4. Notes: add a note in the panel's Notes tab. To try private notes, open Settings (in the menu on any Weekly page), set a PIN under Privacy, then tick Private on a note. Lock hides its title and text.
5. On any normal web page (not a chrome:// page or the Web Store), press Alt+N: a small note panel opens on the page. A note written there appears in Weekly.
6. The panel's Update tab copies this week's update in one click. "Update" in the app's menu shows the tasks done this week in a Done section and a draft update. Untick an item and the draft changes.
7. Tracking: if you said no on the welcome page, open Settings and turn tracking on; Chrome asks for "Read your browsing history". Browse a few sites for a minute or two with Chrome focused; the report then lists them. Pages visited for under 2 minutes are hidden by default; in Settings → Tracking set "Hide visits shorter than (minutes)" to 0 to see them at once.
8. Reminders: in Settings, under Reminders, "Preview the check" opens the evening check window.
9. Settings, Your data: Export saves a file (keep it private: it holds your notes, and with a PIN set, a 6 to 8 digit PIN is advised); Import a backup reads it back, and Replace asks for confirmation first; Delete everything removes tasks, notes and activity.

Any Jira-style URL such as https://example.atlassian.net/browse/ABC-123 is grouped as ticket ABC-123 (the page need not load). All JS in the package is unminified.
```

## Assets in this folder

| Store field | File |
|---|---|
| Store icon (128x128) | `icon-128.png` (96x96 artwork with 16 px transparent padding, as required) |
| Screenshots (1280x800), upload in this order | `screenshot-1-report.png`, `screenshot-2-panel.png`, `screenshot-3-calendar.png`, `screenshot-4-notes-dark.png` |
| Small promo tile (440x280) | `promo-small-440x280.png` |
| Marquee promo tile (1400x560) | `promo-marquee-1400x560.png` |
| Privacy policy | `privacy-policy.html` (host publicly) |

Suggested screenshot captions: 1 Tickets and their merge requests, grouped into your weekly update (first on purpose). 2 Today's tasks in the side panel. 3 The month, shaded by what got done. 4 Notes beside your tasks (dark). Stats is deliberately not shown. Regenerate them with `store-assets/generate.mjs` after any UI change (`store-assets/README.md`).

## Before you submit

**Before submitting**
1. `dist/weekly-2.0.0.zip` was a Phase 5 build mislabelled 2.0.0; it is already moved to `snapshots/weekly-3.0-phase5-build-mislabelled-2.0.0.zip`. Upload only `dist/weekly-3.0.0.zip`.
2. Run the gate when the local time in the chosen timezone is outside 23:30 to 01:30: `TZ=America/New_York npm run release:check`, or `TZ=Asia/Kolkata` otherwise. Expect `# tests 423` and `# fail 0` twice, no `error TS`, `Packed 114 files → dist/weekly-3.0.0.zip`, `End-to-end on dist/weekly-3.0.0.zip (manifest 3.0.0)`, `283/283 passed`, `No tabs: 13/13 passed`, `Parity: 35/35 rows proved (296 end-to-end checks read)`.
3. Check the zip you will upload: `unzip -p dist/weekly-3.0.0.zip manifest.json | grep -E '"version"|"description"'` must show 3.0.0 and "Your Friday update, drafted for you...". Its time must be later than the last edit under `src/`.
4. Host the policy first (see the BLOCKER at the top). If you submit after 1 November 2026, change "Last updated" in `store-assets/privacy-policy.html` (line 27) and in `test/store-assets.test.js` (lines 37 and 38) together, then rerun step 2. Host the policy at a public URL.
5. Manual checks in real Chrome (Playwright cannot do these):
   - Upgrade from Weekly 2. Use a fresh profile. Load `snapshots/weekly-2.0.0-source-2026-10-31.zip` unpacked (tabs is required there) and browse for 2 to 3 minutes so a `day:` entry exists. Replace that folder's contents with the unzipped 3.0.0 zip and press Reload. Expect: the details page still lists "Read your browsing history"; the side panel footer shows time tracked today and keeps counting; no welcome page opens; reminders stay off unless Weekly 2's Friday reminder was on. If the permission is gone, the welcome page must open once and "Yes, track my week" must restore tracking.
   - Alt+N with tracking off. Fresh profile, answer "No thanks". Alt+N on an https page opens the note panel. The listing no longer promises that the panel opens on `chrome://extensions` or the Web Store. If Alt+N does nothing there, that is a known 3.0.1 item, not a blocker.
   - Settings checkbox follows a grant made elsewhere. With the report's Settings open, turn tracking on from a second tab's welcome page. The checkbox ticks without a reload.
   - Dark theme paints dark from the first frame on the panel, app and report.

**Submit**
6. Dashboard, Weekly, Package: upload the checked `dist/weekly-3.0.0.zip`.
7. Store listing: paste the detailed description. Upload the screenshots in the order listed above, both promo tiles and icon-128.png, and remove the old popup, welcome, anonymous and history screenshots.
8. Privacy practices: single purpose; one justification per permission (`sidePanel`, `scripting` and `activeTab` are new; `tabs` is now optional); the data types and three certifications as listed; the policy URL.
9. Paste the reviewer test instructions. Submit, choosing to publish manually after approval.
10. Submit the Daybook and ForgetMeNot farewell updates for review at the same time, also set to publish manually, so all three are approved together.
11. Publish Weekly. Once it is live, install it from the store in a fresh profile: the install prompt does not mention browsing history; "Yes, track my week" shows "Read your browsing history"; Alt+N works on a normal page. Then publish the two farewell updates.

**Retire Daybook and ForgetMeNot**
12. Farewell builds, from their own repos:
    - The banner reads "Daybook is now part of Weekly. Export your data, then import it in Weekly." (ForgetMeNot the same) and links to Weekly's store URL.
    - The export formats stay exactly the same: Daybook `{format:'daybook.tasks', schemaVersion:1, tasks}`, ForgetMeNot `{app:'ForgetMeNot', schemaVersion:2, notes, security}`.
    - Before submitting, export from each farewell build and import into Weekly 3.0.0. Check Add and Replace, and for ForgetMeNot a private note with its PIN.
13. Add "Now part of Weekly:" and Weekly's store URL as the first line of both store descriptions.
14. About 30 days after the farewells are live, unpublish both. Do not delete them; installed copies keep working and can still export.
15. Answer user mail at srewoo@gmail.com with three steps: Export in the old app, Import a backup under Settings, Your data in Weekly, and enter the PIN for private notes.

**What the gate cannot catch:** real Chrome permission carry-over on update, Alt+N behaviour without `tabs` on Chrome's own pages, pre-paint theme, which file is actually uploaded, and the hosted policy's date and URL. The checks above cover each one.

- The `https://*/*` optional host permission may add review time; the justification above explains it. Be ready to show that no site is contacted until the user opts in.
- The screenshots show a fictional engineer's week (ENGX tickets, merge requests !418 and #231); no real people or customers.
