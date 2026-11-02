# Weekly 3.0, Phase 4: Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Pre-flight (controller):** this plan was written and replayed against the Phase 3 plan's end state (`docs/superpowers/plans/2026-10-31-weekly-3-phase-3-reminders.md`, all seven tasks applied on top of the Phase 2b plan's end state: 245 unit tests per timezone, 198/198 end-to-end). **The real post-Phase-3 tree may differ from that replay base**: the review fix waves of Phases 2b and 3 change lines this plan replaces. Known 2b differences reported by the controller: `setDone(id, done, at = Date.now())`, `restoreRecurring(id, until = null)`, `task-actions` resolving true/false and dispatching a document `tasks:stale` event on failure, `undo.js` exporting `GONE`, and `week-notes.js` dating notes with `setHours(12)`. None of them is replaced here (`week-notes.js` and its test are deleted whole in Task 2), but before dispatching Task 1 check every ``In `<file>`, replace:`` block below against the real files (each old block must match exactly once) and reconcile any drift in the ledger. Files this plan edits that earlier phases also wrote: `manifest.json`, `jsconfig.json`, `scripts/build.mjs`, `README.md`, `src/lib/{portability,schema}.js`, `src/background/service-worker.js`, `src/ui/panel/{panel.js,panel.html,footer.js}`, `src/ui/app/{app.js,app.html,app.css,day-sheet.js}`, `src/ui/report/{main.js,draft-panel.js,data-panel.js,notes-panel.js,report.html,report.css}`, `test/helpers/chrome-stub.js`, `test/background/service-worker.test.js`, `test/manifest.test.js`, `test/portability.test.js`, `test/e2e/{full,panel,app}.mjs`. The 2b review's parked finding (the report's notes panel and the worker's purge write `notes` without a lock) is closed by Task 2: `src/lib/notes.js` becomes the only writer of `notes`, under `NOTES_LOCK`, and the purge no longer touches notes.

**Goal:** Give Weekly ForgetMeNot's notes: notes with a title, body, category, pin, done and an optional day (F1, F2), PIN-locked private notes whose key lives only in the service worker (F3, F8), the on-page floating note on Alt+N with the side panel as fallback (F4), 7-day insights (F5), day notes in the day sheet (L3) and as the update's Other work (W2), and Weekly 2's notes migrated into the new store.

**Architecture:**
- `src/lib/note-views.js` is pure: the `Note` shape and `coerceNote` (every stored, imported or page-sent note goes through it), Weekly 2's `{id, ts, text}` conversion, search, order, day notes, the Other work feed and the insights. `src/lib/notes.js` owns the `notes` key: every write is one read-modify-write under `NOTES_LOCK` (Web Locks, like tasks), and Weekly 2 notes are converted **by shape** on read and written back under the lock.
- `src/lib/crypto.js` is ForgetMeNot's crypto as an ES module (PBKDF2-SHA256 310,000 rounds → AES-GCM, a verifier instead of the PIN, the lockout steps as pure functions). `src/background/crypto-broker.js` holds the key in worker memory only and answers `crypto:*` messages from Weekly's own pages, one at a time; it is the only writer of the `security` record. A private note's title **and** body are sealed together, so storage never holds either in plain text.
- The UI never sees the key. `src/ui/components/notes-view.js` (mounted by the side panel's Notes tab and the app's Notes view) asks the worker to seal and open private notes through `src/ui/components/private.js`, keeps opened words in page memory only, and forgets them on Lock, on the worker's `crypto:changed`, or after 5 idle minutes.
- The on-page note is `src/content/onpage-note.js`, a classic script injected on demand (`activeTab` + `scripting`) into a closed Shadow DOM, built with `createElement`/`textContent` only. It talks to `src/background/onpage.js` over `notes:*` messages and only ever sees plain notes. Alt+N injects inside the command's gesture; where Chrome refuses, the side panel opens on Notes.
- The report's Notes section, the panel footer's quick note and the day sheet's note slot now write day notes through `notes.js`; the update's Other work is `otherWork(notes, Monday, Sunday)`, which never returns a private note, so neither the draft nor the AI prompt can.

**Tech Stack:**
- Chrome MV3: `chrome.scripting.executeScript` with `activeTab` (both new install permissions, justified in Task 7), `chrome.commands` (Alt+N, the third of four suggested keys), `chrome.sidePanel.open`, `chrome.runtime` messages, WebCrypto (`crypto.subtle`) in the worker.
- Plain ES2022 modules, no bundler; `node:test` in two timezones; `tsc --strict` over JSDoc; Playwright + Chromium end-to-end.

**Spec:**
- `docs/superpowers/specs/2026-10-31-weekly-feature-parity.md`: rows F1, F2, F3, F4, F5, F8, L3 (store), W2 (Other work from day notes). This file wins on scope.
- `docs/superpowers/specs/2026-10-31-weekly-merge-design.md`: §3.1 (Notes tab, Note on this page), §3.2 (app Notes view; Settings: Notes PIN), §3.4 (on-page note), §3.6 (permissions), §4 (Note, private notes, writes under locks, retention, migration), §5 (code rules; `notes:*`, `crypto:*`, `panel:openOnPage`), §6 (errors), §7 (testing). This file wins on how.
- Phase 2a ledger (`…-phase-2a-ledger.md`): "schemaVersion 2 now versions the tasks blob only; Phase 4 must bump to v3 for the notes migration or detect Weekly 2 notes by shape".
- Phase 2b plan, "Interfaces exported for Phase 3 and Phase 4": `TABS` in `src/ui/panel/panel.js` (Notes at index 1), `#nav-notes[data-view=notes]` + `#view-notes`, `'notes'` in the `View` union and `show()` in `app.js`, route `#notes`; the day sheet's `renderNotes()` and `#noteForm` handler; the footer's `#noteForm` / `#note`.
- Phase 3 plan, "Interfaces exported for Phase 4": `notes:*`, `crypto:*` and `panel:openOnPage` in the one `runtime.onMessage` listener, returning `true` when answering after an await; Alt+N as the third command in the same `commands.onCommand` listener, calling `chrome.scripting.executeScript` at once; a PIN group in the report's Settings following `reminder-settings.js` (`init()`, registered at the end of `main.js`). No alarm is added, so `KEEP` in `src/background/reminders.js` is unchanged (see Decisions).

## Global Constraints

- **No version control.**
  - Never run `git`. No step commits; the controller keeps the ledger.
  - Never edit this plan file.
  - Rollback point: `snapshots/weekly-2.0.0-source-2026-10-31.zip`.
- **Layering:**
  - `src/lib/` never touches the DOM. `src/lib/note-views.js` and `src/lib/crypto.js` touch no `chrome.*` at all.
  - `src/ui/` never calls `chrome.storage` in new code. Notes come only from `src/lib/notes.js`; the PIN, the key and every encryption only from the worker, over `crypto:*` messages.
  - The `security` record is written only by `src/background/crypto-broker.js`. The key (`CryptoKey`) exists only in that module's memory: never in storage (local or session), never in a page, never in a message.
  - The on-page content script gets data only through `notes:*` messages, and only plain notes.
- **Privacy:** a private note's title and body are stored only as ciphertext (in storage and in Weekly's export). Private notes never appear in the draft, the AI prompt, the Other work feed, search while locked, the day sheet, the report's Notes list or any web page. The PIN is never stored, logged or broadcast.
- **Locks:** Web Locks are not re-entrant. A `mutateNotes()` callback is synchronous and never calls `getNotes()`; `transformNotes()` may await crypto but calls nothing else in `notes.js`. Every read-modify-write of `notes` runs under `NOTES_LOCK`.
- **Untrusted input:** everything stored, imported, or sent by a page or a content script goes through `coerceNote` / `coerceCipher` / `coerceSecurity` before use. Message handlers check the sender (`crypto:*` and `panel:*`: Weekly's own pages only; `notes:*`: Weekly's own content script or pages).
- **No HTML sinks:** no `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src/`, the Shadow DOM included. Pages build DOM with `h()` from `src/ui/components/dom.js`; the content script with `createElement` and `textContent`. `test/no-innerhtml.test.js` stays green.
- **Size:** no file in `src/` over 300 lines and no function over 50 lines (the content script has no wrapper function: its code sits in one block). `test/e2e/full.mjs` stays the one exception carried from Phase 1; new end-to-end checks go in `test/e2e/notes.mjs`, each function ≤ 50 lines.
- **Dates:** local-calendar ISO strings (`YYYY-MM-DD`); never `new Date('YYYY-MM-DD')`; use `src/lib/dates.js`.
- **Storage:** local only; nothing reads or writes `chrome.storage.sync`. Activity is still purged after 90 days; tasks and notes are kept until the user deletes them.
- **Errors:** a failed write in a page is said in plain words (`report()` in `components/undo.js`); a wrong PIN and the lockout are said in words (`explain()` in `components/private.js`); a failed worker handler shows the "!" badge through the worker's serial queue (spec §6). A message handler that fails answers `{ ok: false, error }`, never an uncaught promise.
- **Look:** Weekly's visual language only (tokens in `src/ui/styles.css`; the content script repeats the token values, since a web page cannot load them). No remote fonts.
- **Node and tests:**
  - Node ≥ 22. `node --test` takes globs, never a directory.
  - Every test file lives under `test/`. Unit tests run in `TZ=America/New_York` and `TZ=Asia/Kolkata` (`npm test`).
  - Crypto tests use the real 310,000 rounds (Node derives a key in about 30 ms).
  - End-to-end: dates are computed in Node and passed in; `sw.evaluate` callbacks use only `chrome.*`, built-ins and their argument (Phase 1 Ruling R1). Pages are opened directly as extension URLs. Keys are pressed only inside Playwright's Chromium, never on the desktop.
- **Dependencies:** no runtime dependencies. Dev dependencies stay `typescript@^5.5.4` and `@types/chrome@^0.0.268`.
- **Typecheck:** `npm run typecheck` covers `src/lib/**`, `src/background/**`, `src/ui/components/**`, `src/ui/panel/**`, `src/ui/app/**`, `src/ui/remind/**` and, from Task 7, `src/content/**`. The report and welcome pages stay out, as before.
- **Gates:** every task ends with `npm test` green in both timezones and `npm run typecheck` clean. Tasks 2 and 4–8 also end with `npm run e2e` green (Tasks 1 and 3 add only modules no page loads yet).

## File map (end state of Phase 4)

```
manifest.json                         + permissions scripting, activeTab; + command open-note (Alt+N)
jsconfig.json                         include + src/content
scripts/build.mjs                     checks the injected content script is in the build
README.md                             Notes section, retention line, Alt+N, Layout, rules, locks
src/lib/note-views.js        new      CATEGORIES, Note, coerceNote, coerceNoteList, coerceCipher, fromWeekNote, isWeekNote,
                                      newNoteId, sortNotes, filterNotes, dayNotes, otherWork, insights, NOTE_TITLE_MAX, NOTE_BODY_MAX
src/lib/notes.js             new      NOTES_LOCK, getNotes, mutateNotes, transformNotes, createNote, updateNote, togglePinned,
                                      toggleDone, deleteNote, restoreNote, deleteAllNotes, mergeNotes, onNotesChanged (+ re-exports views)
src/lib/crypto.js            new      PBKDF2_ITERATIONS, isValidPin, deriveKey, encrypt, decrypt, createSecurity, verify,
                                      coerceSecurity, lockoutFor, afterFailure, afterSuccess, lockedFor, sealNote, openNote
src/lib/week-notes.js        deleted  (and test/week-notes.test.js)
src/lib/portability.js       modified Weekly import reads Weekly 2 and Weekly 3 notes through coerceNote; merged with mergeNotes
src/lib/schema.js            modified comment only
src/background/crypto-broker.js new   IDLE_MS, handle (crypto:*), lock
src/background/onpage.js     new      CONTENT_SCRIPT, canInject, inject, onNoteCommand, handle (notes:*, panel:*)
src/background/service-worker.js modified purge leaves notes alone; crypto:*, notes:*, panel:* routed; Alt+N
src/content/onpage-note.js   new      the on-page note (classic script, closed Shadow DOM)
src/ui/components/notes-view.js note-card.js note-editor.js note-actions.js note-insights.js private.js pin-dialog.js notes.css   new
src/ui/panel/notes-tab.js    new      the Notes tab; panel.js inserts it at index 1
src/ui/panel/panel.js panel.html footer.js   modified  Notes tab, "Note on this page", panel:show / panel:hello
src/ui/app/app.html app.js app.css   modified  Notes view with insights (#notes)
src/ui/app/day-sheet.js      modified the day's notes from notes.js (L3)
src/ui/report/notes-panel.js main.js draft-panel.js data-panel.js report.html report.css   modified  notes via notes.js; Notes PIN group
src/ui/report/pin-settings.js new     the Notes PIN group (set, change, remove)
test/notes.test.js  test/note-views.test.js  test/crypto.test.js  test/background/crypto-broker.test.js  test/background/onpage.test.js   new
test/portability.test.js  test/background/service-worker.test.js  test/manifest.test.js  test/helpers/chrome-stub.js   extended
test/e2e/notes.mjs                    new   notes, private notes, PIN, on-page checks
test/e2e/full.mjs panel.mjs app.mjs   notes read as Note; delete-all keeps an emptied notes key; notes.mjs wired in
```

---

### Task 1: The notes store, and Weekly 2's notes migrated by shape

The data layer for F1, F2, F5, L3 and W2. No page uses it yet, so nothing visible changes.

**Why by shape, not schema v3:** `schemaVersion` is stamped by `mutate()` in `storage.js` on every task write, so it versions the tasks blob, not the profile (Phase 2a ledger). A v3 bump would have to gate a notes migration on a number written by unrelated task code, and would still miss Weekly 2 notes that arrive later: an old Weekly export imported after the upgrade carries `{id, ts, text}` notes too. Detecting the shape (`isWeekNote`: numeric `id` and `ts`, a `text` string, no `title`) converts them wherever and whenever they appear, the converted id (`w2-<id>`) makes it idempotent, and `schemaVersion` keeps its one meaning.

**Files:**
- Create: `src/lib/note-views.js`, `src/lib/notes.js`
- Create: `test/notes.test.js`, `test/note-views.test.js`

**Interfaces:**
- Consumes: `withLock(name, fn)` (`src/lib/storage.js`); `newId()` (`src/lib/schema.js`); `isValidISODate`, `toISODate`, `addDays`, `daysBetween` (`src/lib/dates.js`).
- Produces (`src/lib/note-views.js`, all re-exported by `src/lib/notes.js`):
  - `CATEGORIES = ['General', 'Work', 'Personal', 'Idea', 'To-Read']`, `NOTE_TITLE_MAX = 200`, `NOTE_BODY_MAX = 20000`
  - types `Note = {id, title, body, category, pinned, done, createdAt, updatedAt, completedAt, day: string|null, enc: Cipher|null}`, `Cipher = {iv, ct}` (base64), `Plain = {title, body}`, `Category`
  - `coerceNote(raw, now?) → Note | null` (null when no title, body or ciphertext; a private note's `title` and `body` are always `''`), `coerceNoteList(raw) → { notes, changed }`, `coerceCipher(v) → Cipher | null`, `isWeekNote(raw)`, `fromWeekNote(w) → Note` (`id: 'w2-<id>'`, category `Work`, `day` = the note's local date, no title), `newNoteId() → 'n_…'`
  - `sortNotes(notes)` (pinned, open, newest), `filterNotes(notes, { q?, category?, plain?: Map<id, Plain> })`, `dayNotes(notes, iso)` (untitled plain notes of that day, oldest first), `otherWork(notes, from, to) → {id, day, text}[]` (plain notes dated in range, one line each), `insights(notes, ref) → { days: {iso, created, done}[7], created, done, total, pinned, open }`
- Produces (`src/lib/notes.js`): `NOTES_LOCK = 'weekly:notes'`, `getNotes()`, `mutateNotes(fn)`, `createNote(draft) → Note | null`, `updateNote(id, patch | (current) => patch) → Note | null`, `togglePinned(id)`, `toggleDone(id)`, `deleteNote(id) → Note | null`, `restoreNote(note)`, `deleteAllNotes() → number`, `mergeNotes(unknown[]) → number added`, `onNotesChanged(cb) → unsubscribe`; type `NoteDraft = {title?, body?, category?, day?, pinned?, enc?}`.

- [ ] **Step 1: Write the failing tests**

Create `test/notes.test.js`:

```js
// The notes store (spec §4 Note; F1, F2, L3): shape, writes under the notes lock,
// and the Weekly 2 migration, detected by shape because schemaVersion 2 only
// versions the tasks blob (Phase 2a ledger).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const stub = installChromeStub();
const notes = await import('../src/lib/notes.js');
const { today, addDays, fromISODate } = await import('../src/lib/dates.js');

const CIPHER = { iv: 'AAAAAAAAAAAAAAAA', ct: 'c2VjcmV0LWNpcGhlcnRleHQ=' };
/** Local noon on `iso`, so a note made "that day" lands on it in every timezone. */
const noon = (/** @type {string} */ iso) => (fromISODate(iso)?.getTime() ?? 0) + 12 * 36e5;

beforeEach(() => { for (const k of Object.keys(stub.stores.local)) delete stub.stores.local[k]; });

test('createNote stores ForgetMeNot’s fields plus day, trimmed; blank notes are not stored', async () => {
  const n = await notes.createNote({ title: '  Call Acme  ', body: 'About the renewal', category: 'Work', day: today() });
  assert.ok(n);
  assert.deepEqual(Object.keys(n).sort(), ['body', 'category', 'completedAt', 'createdAt', 'day', 'done', 'enc', 'id', 'pinned', 'title', 'updatedAt']);
  assert.equal(n.title, 'Call Acme');
  assert.equal(n.day, today());
  assert.match(n.id, /^n_[0-9a-z]{12}$/);
  assert.equal(await notes.createNote({ title: ' ', body: '\n' }), null);
  assert.deepEqual((await notes.getNotes()).map((x) => x.id), [n.id]);
});

test('untrusted fields are coerced: unknown category → General, long title cut, bad day dropped', async () => {
  const n = await notes.createNote({ title: 'x'.repeat(500), body: 'b', category: 'Nonsense', day: '2026-02-30' });
  assert.equal(n?.category, 'General');
  assert.equal(n?.title.length, notes.NOTE_TITLE_MAX);
  assert.equal(n?.day, null);
});

test('a private note never stores its title or body in plain text', async () => {
  const n = await notes.createNote({ title: 'Salary talk', body: 'Ask for 10%', enc: CIPHER });
  assert.equal(n?.title, '');
  assert.equal(n?.body, '');
  assert.deepEqual(n?.enc, CIPHER);
  assert.equal(JSON.stringify(stub.stores.local).includes('Salary'), false);
  stub.stores.local.notes = [{ ...n, enc: { iv: 1, ct: null }, body: 'plain' }];
  assert.equal((await notes.getNotes())[0]?.enc, null, 'malformed ciphertext degrades to a plain note, never a masked one');
});

test('Weekly 2 notes become day notes by shape, whatever schemaVersion says, once', async () => {
  const day = addDays(today(), -2);
  Object.assign(stub.stores.local, { schemaVersion: 2, notes: [{ id: 7, ts: noon(day), text: 'Phone screen' }, 'junk'] });
  const [n] = await notes.getNotes();
  assert.deepEqual(n && { id: n.id, title: n.title, body: n.body, category: n.category, day: n.day, enc: n.enc },
    { id: 'w2-7', title: '', body: 'Phone screen', category: 'Work', day, enc: null });
  assert.equal(stub.stores.local.notes.length, 1, 'the converted list is written back');
  assert.equal(stub.stores.local.notes[0].id, 'w2-7');
  const before = JSON.stringify(stub.stores.local.notes);
  await notes.getNotes();
  assert.equal(JSON.stringify(stub.stores.local.notes), before, 'idempotent');
  stub.stores.local.notes = 'corrupt';
  assert.deepEqual(await notes.getNotes(), []);
});

test('updateNote patches inside the lock; done stamps completedAt; a function patch reads the current note', async () => {
  const n = await notes.createNote({ body: 'Draft the plan' });
  assert.ok(n);
  const done = await notes.toggleDone(n.id);
  assert.equal(done?.done, true);
  assert.ok(typeof done?.completedAt === 'number');
  assert.equal((await notes.toggleDone(n.id))?.completedAt, null);
  await Promise.all([notes.togglePinned(n.id), notes.updateNote(n.id, { category: 'Idea' })]);
  const [cur] = await notes.getNotes();
  assert.equal(cur?.pinned, true);
  assert.equal(cur?.category, 'Idea');
  assert.equal(await notes.updateNote('missing', { title: 'z' }), null);
});

test('two notes created at the same instant both land', async () => {
  await Promise.all([notes.createNote({ body: 'one' }), notes.createNote({ body: 'two' })]);
  assert.equal((await notes.getNotes()).length, 2);
});

test('deleteNote returns the note; restoreNote puts it back once', async () => {
  const n = await notes.createNote({ body: 'keep me' });
  assert.ok(n);
  const gone = await notes.deleteNote(n.id);
  assert.equal(gone?.id, n.id);
  assert.equal((await notes.getNotes()).length, 0);
  if (gone) { await notes.restoreNote(gone); await notes.restoreNote(gone); }
  assert.deepEqual((await notes.getNotes()).map((x) => x.id), [n.id]);
  assert.equal(await notes.deleteAllNotes(), 1);
  assert.deepEqual(stub.stores.local.notes, []);
});

test('mergeNotes adds new ids, keeps the newer of two, and is idempotent', async () => {
  const mine = await notes.createNote({ body: 'mine' });
  assert.ok(mine);
  const incoming = [{ ...mine, body: 'older', updatedAt: mine.updatedAt - 1 }, { id: 'w2-1', title: '', body: 'from the laptop', updatedAt: 5 }];
  assert.equal(await notes.mergeNotes(incoming), 1);
  assert.equal(await notes.mergeNotes(incoming), 0);
  const all = await notes.getNotes();
  assert.equal(all.find((x) => x.id === mine.id)?.body, 'mine');
  assert.equal(all.length, 2);
  assert.equal(await notes.mergeNotes([{ ...mine, body: 'newer', updatedAt: mine.updatedAt + 1 }]), 0);
  assert.equal((await notes.getNotes()).find((x) => x.id === mine.id)?.body, 'newer');
});

test('onNotesChanged hands listeners the coerced list, local area only', () => {
  /** @type {unknown[]} */
  const seen = [];
  const off = notes.onNotesChanged((list) => seen.push(list.map((n) => n.id)));
  for (const fn of stub.log.listeners['storage.onChanged'] ?? []) {
    fn({ notes: { newValue: [{ id: 3, ts: 1, text: 'legacy' }] } }, 'local');
    fn({ notes: { newValue: [] } }, 'sync');
    fn({ tasks: { newValue: [] } }, 'local');
  }
  off();
  assert.deepEqual(seen, [['w2-3']]);
});
```

Create `test/note-views.test.js`:

```js
// Pure note views (F2 search, F5 insights, L3 day notes, W2 Other work). Private
// notes never reach search snippets, day notes or the Other work feed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coerceNote, filterNotes, dayNotes, otherWork, insights, sortNotes } from '../src/lib/note-views.js';
import { today, addDays, fromISODate } from '../src/lib/dates.js';

const CIPHER = { iv: 'AAAAAAAAAAAAAAAA', ct: 'c2VjcmV0' };
const noon = (/** @type {string} */ iso) => (fromISODate(iso)?.getTime() ?? 0) + 12 * 36e5;
/** @param {Record<string, unknown>} o */
const note = (o) => {
  const n = coerceNote({ title: '', body: '', category: 'Work', createdAt: 1, updatedAt: 1, ...o });
  if (!n) throw new Error('bad fixture');
  return n;
};
const T = today();

test('search covers title and body; a private note matches only by its unlocked title', () => {
  const list = [note({ id: 'a', title: 'Renewal', body: 'Acme pricing' }), note({ id: 'b', body: 'acme call notes' }),
    note({ id: 'p', enc: CIPHER })];
  assert.deepEqual(filterNotes(list, { q: 'ACME' }).map((n) => n.id).sort(), ['a', 'b']);
  assert.deepEqual(filterNotes(list, { q: 'salary' }).map((n) => n.id), []);
  const plain = new Map([['p', { title: 'Salary talk', body: 'acme' }]]);
  assert.deepEqual(filterNotes(list, { q: 'salary', plain }).map((n) => n.id), ['p']);
  assert.deepEqual(filterNotes(list, { q: 'acme', plain }).map((n) => n.id).sort(), ['a', 'b'], 'private bodies are never searched');
  assert.deepEqual(filterNotes(list, { category: 'Idea' }), []);
});

test('order: pinned first, open before done, then most recently updated', () => {
  const list = [note({ id: 'old', body: 'x', updatedAt: 1 }), note({ id: 'new', body: 'x', updatedAt: 9 }),
    note({ id: 'done', body: 'x', updatedAt: 20, done: true }), note({ id: 'pin', body: 'x', pinned: true })];
  assert.deepEqual(sortNotes(list).map((n) => n.id), ['pin', 'new', 'old', 'done']);
});

test('day notes: untitled, plain notes of that day, oldest first', () => {
  const list = [note({ id: '2', body: 'second', day: T, createdAt: 2 }), note({ id: '1', body: 'first', day: T, createdAt: 1 }),
    note({ id: 't', title: 'Titled', day: T }), note({ id: 'p', enc: CIPHER, day: T }), note({ id: 'y', body: 'y', day: addDays(T, -1) })];
  assert.deepEqual(dayNotes(list, T).map((n) => n.id), ['1', '2']);
});

test('Other work: plain notes dated inside the range, as one line each; private notes never', () => {
  const mon = addDays(T, -3);
  const list = [note({ id: 'a', title: 'Offsite', body: 'Planning\n  day', day: mon }), note({ id: 'b', body: 'Phone screen', day: T }),
    note({ id: 'p', enc: CIPHER, day: T }), note({ id: 'out', body: 'too early', day: addDays(mon, -1) }), note({ id: 'nd', body: 'no day' })];
  assert.deepEqual(otherWork(list, mon, T), [{ id: 'a', day: mon, text: 'Offsite: Planning day' }, { id: 'b', day: T, text: 'Phone screen' }]);
});

test('insights: seven local days of notes created and done, oldest first (F5)', () => {
  const list = [note({ body: 'a', createdAt: noon(T) }), note({ body: 'b', createdAt: noon(addDays(T, -6)), done: true, completedAt: noon(T) }),
    note({ body: 'old', createdAt: noon(addDays(T, -7)) }), note({ enc: CIPHER, createdAt: noon(T), pinned: true })];
  const r = insights(list, T);
  assert.deepEqual(r.days.map((d) => d.iso), [6, 5, 4, 3, 2, 1, 0].map((k) => addDays(T, -k)));
  assert.deepEqual(r.days.map((d) => d.created), [1, 0, 0, 0, 0, 0, 2]);
  assert.deepEqual(r.days.map((d) => d.done), [0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual({ created: r.created, done: r.done, total: r.total, pinned: r.pinned, open: r.open }, { created: 3, done: 1, total: 4, pinned: 1, open: 3 });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/notes.test.js test/note-views.test.js`

Expected: both files fail to load: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/src/lib/note-views.js'` and `… '…/src/lib/notes.js'`; `# tests 2`, `# fail 2`.

- [ ] **Step 3: Write the pure note logic**

Create `src/lib/note-views.js`:

```js
/**
 * Notes without storage (spec §4 Note; F1, F2, F5, L3, W2): the shape and its
 * validation, Weekly 2's conversion, search, order, day notes, the Other work
 * feed and the 7-day insights. Pure: no chrome.*, no DOM; tested in two timezones.
 *
 * A note is private when `enc` is set. Its title and body then live only inside
 * the ciphertext, so a private note's stored `title` and `body` are always ''.
 */
import { isValidISODate, toISODate, addDays, daysBetween } from './dates.js';
import { newId } from './schema.js';

export const CATEGORIES = /** @type {const} */ (['General', 'Work', 'Personal', 'Idea', 'To-Read']);
export const NOTE_TITLE_MAX = 200;
export const NOTE_BODY_MAX = 20000;
const CIPHER_MAX = 60000;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** @typedef {typeof CATEGORIES[number]} Category */
/** @typedef {{ iv: string, ct: string }} Cipher */
/** @typedef {{ title: string, body: string }} Plain */
/**
 * @typedef {object} Note
 * @property {string} id
 * @property {string} title              '' when private
 * @property {string} body               '' when private
 * @property {Category} category
 * @property {boolean} pinned
 * @property {boolean} done
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number | null} completedAt
 * @property {string | null} day         ISO local date the note belongs to, or null
 * @property {Cipher | null} enc         set means private
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** @param {unknown} v @param {number} max */
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/** @param {unknown} v @returns {v is number} */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** @returns {string} */
export const newNoteId = () => `n_${newId().slice(2)}`;

/** Weekly 2's `{id, ts, text}`: no title field, numeric id and stamp. @param {unknown} raw */
export const isWeekNote = (raw) => isObj(raw) && !('title' in raw) && isNum(raw['id']) && isNum(raw['ts']) && typeof raw['text'] === 'string';

/** A ciphertext blob is only valid if it carries both base64 parts. @param {unknown} v @returns {Cipher | null} */
export function coerceCipher(v) {
  if (!isObj(v)) return null;
  const { iv, ct } = v;
  const ok = (/** @type {unknown} */ s, /** @type {number} */ max) => typeof s === 'string' && s.length <= max && B64.test(s);
  return ok(iv, 64) && ok(ct, CIPHER_MAX) ? { iv: /** @type {string} */ (iv), ct: /** @type {string} */ (ct) } : null;
}

/**
 * Weekly 2's note becomes a day note (spec §4): its date, category Work, no title.
 * The id is derived, so converting twice (or re-importing) never duplicates it.
 * @param {{ id: number, ts: number, text: string }} w @returns {Note}
 */
export const fromWeekNote = (w) => ({
  id: `w2-${w.id}`, title: '', body: str(w.text, NOTE_BODY_MAX), category: 'Work', pinned: false, done: false,
  createdAt: w.ts, updatedAt: w.ts, completedAt: null, day: toISODate(new Date(w.ts)), enc: null,
});

/**
 * Any stored or imported note, made safe. Null when nothing is left (no title,
 * no body, no ciphertext). A malformed `enc` degrades to a plain note.
 * @param {unknown} raw @param {number} [now] @returns {Note | null}
 */
export function coerceNote(raw, now = Date.now()) {
  if (isWeekNote(raw)) return fromWeekNote(/** @type {{ id: number, ts: number, text: string }} */ (raw));
  if (!isObj(raw)) return null;
  const enc = coerceCipher(raw['enc']);
  const title = enc ? '' : str(raw['title'], NOTE_TITLE_MAX);
  const body = enc ? '' : str(raw['body'], NOTE_BODY_MAX);
  if (!enc && !title && !body) return null;
  const id = typeof raw['id'] === 'string' && /^[\w-]{1,64}$/.test(raw['id']) ? raw['id'] : newNoteId();
  const createdAt = isNum(raw['createdAt']) ? raw['createdAt'] : now;
  const done = raw['done'] === true;
  const day = raw['day'];
  return {
    id, title, body, enc,
    category: CATEGORIES.find((c) => c === raw['category']) ?? 'General',
    pinned: raw['pinned'] === true, done, createdAt,
    updatedAt: isNum(raw['updatedAt']) ? raw['updatedAt'] : createdAt,
    completedAt: done ? (isNum(raw['completedAt']) ? raw['completedAt'] : now) : null,
    day: typeof day === 'string' && isValidISODate(day) ? day : null,
  };
}

/**
 * The stored list, coerced. `changed` says whether it should be written back:
 * a Weekly 2 note, an invalid entry or a duplicate id was found.
 * @param {unknown} raw @returns {{ notes: Note[], changed: boolean }}
 */
export function coerceNoteList(raw) {
  if (!Array.isArray(raw)) return { notes: [], changed: raw !== undefined };
  const seen = new Set();
  /** @type {Note[]} */
  const notes = [];
  for (const r of raw) {
    const n = coerceNote(r);
    if (n && !seen.has(n.id)) { seen.add(n.id); notes.push(n); }
  }
  return { notes, changed: notes.length !== raw.length || raw.some(isWeekNote) };
}

/** @param {Note} a @param {Note} b */
const byPinnedOpenRecent = (a, b) => Number(b.pinned) - Number(a.pinned) || Number(a.done) - Number(b.done) || b.updatedAt - a.updatedAt;
/** Pinned first, open before done, then most recently updated. @param {Note[]} notes */
export const sortNotes = (notes) => [...notes].sort(byPinnedOpenRecent);

/**
 * Search title and body (F2). A private note matches only by its title, and
 * only when the page holds it unlocked (`plain`); private bodies are never searched.
 * @param {Note[]} notes @param {{ q?: string, category?: string, plain?: Map<string, Plain> }} opts
 */
export function filterNotes(notes, { q = '', category = 'all', plain = new Map() } = {}) {
  const needle = q.trim().toLowerCase();
  return sortNotes(notes.filter((n) => {
    if (category !== 'all' && n.category !== category) return false;
    const hay = n.enc ? plain.get(n.id)?.title ?? '' : `${n.title} ${n.body}`;
    return !needle || hay.toLowerCase().includes(needle);
  }));
}

/** The day sheet's notes (L3): untitled, plain, dated `iso`, oldest first. @param {Note[]} notes @param {string} iso */
export const dayNotes = (notes, iso) => notes.filter((n) => n.day === iso && !n.title && !n.enc).sort((a, b) => a.createdAt - b.createdAt);

/**
 * The update's Other work (W2): plain notes dated from `from` to `to`, one line each.
 * Private notes never appear here, so never in the draft or the AI prompt.
 * @param {Note[]} notes @param {string} from @param {string} to
 * @returns {{ id: string, day: string, text: string }[]}
 */
export function otherWork(notes, from, to) {
  /** @type {{ id: string, day: string, text: string, at: number }[]} */
  const out = [];
  for (const n of notes) {
    if (n.enc || !n.day || n.day < from || n.day > to) continue;
    const text = (n.title && n.body ? `${n.title}: ${n.body}` : n.title || n.body).replace(/\s+/g, ' ').trim();
    if (text) out.push({ id: n.id, day: n.day, text, at: n.createdAt });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.at - b.at).map(({ id, day, text }) => ({ id, day, text }));
}

/**
 * Seven local days ending `ref`, oldest first: notes created and notes done (F5).
 * Counts only, so private notes are counted without being read.
 * @param {Note[]} notes @param {string} ref
 */
export function insights(notes, ref) {
  const days = [6, 5, 4, 3, 2, 1, 0].map((k) => ({ iso: addDays(ref, -k), created: 0, done: 0 }));
  /** @param {number | null} ts */
  const slot = (ts) => (ts === null ? undefined : days[6 - daysBetween(toISODate(new Date(ts)), ref)]);
  for (const n of notes) {
    const c = slot(n.createdAt);
    if (c) c.created += 1;
    const d = n.done ? slot(n.completedAt) : undefined;
    if (d) d.done += 1;
  }
  const sum = (/** @type {'created' | 'done'} */ k) => days.reduce((s, d) => s + d[k], 0);
  return { days, created: sum('created'), done: sum('done'), total: notes.length,
    pinned: notes.filter((n) => n.pinned).length, open: notes.filter((n) => !n.done).length };
}
```

- [ ] **Step 4: Write the store**

Create `src/lib/notes.js`:

```js
/**
 * The notes store (spec §4): the only module that reads or writes the `notes` key.
 * Every write is a read-modify-write of one array under NOTES_LOCK (Web Locks,
 * shared by the worker and every extension page), like tasks in storage.js.
 *
 * Migration is by shape, not by schemaVersion: version 2 already versions the
 * tasks blob on every profile that ran Phase 2, and a Weekly 2 note can also
 * arrive later in an old export. Any `{id, ts, text}` entry becomes a day note
 * on read, and the converted list is written back under the lock.
 */
import { withLock } from './storage.js';
import { coerceNote, coerceNoteList } from './note-views.js';

export * from './note-views.js';

/** @typedef {import('./note-views.js').Note} Note */
/** @typedef {import('./note-views.js').Cipher} Cipher */
/**
 * @typedef {object} NoteDraft
 * @property {string} [title]
 * @property {string} [body]
 * @property {string} [category]
 * @property {string | null} [day]
 * @property {boolean} [pinned]
 * @property {Cipher | null} [enc]   ciphertext from the worker; title and body are then dropped
 */

const KEY = 'notes';
export const NOTES_LOCK = 'weekly:notes';

/** Unlocked read; never writes. */
async function read() {
  return coerceNoteList((await chrome.storage.local.get(KEY))[KEY]);
}

/** @returns {Promise<Note[]>} */
export async function getNotes() {
  const { notes, changed } = await read();
  if (!changed) return notes;
  return mutateNotes((cur) => ({ notes: cur, result: cur }));
}

/**
 * Serialised read-modify-write. `fn` is synchronous and pure: Web Locks are not
 * re-entrant, so it must not call any other function in this module.
 * @template T @param {(notes: Note[]) => { notes: Note[], result: T }} fn @returns {Promise<T>}
 */
export function mutateNotes(fn) {
  return withLock(NOTES_LOCK, async () => {
    const { notes, result } = fn((await read()).notes);
    await chrome.storage.local.set({ [KEY]: notes });
    return result;
  });
}

/** @param {NoteDraft} draft @returns {Promise<Note | null>} null when there is nothing to keep */
export function createNote(draft) {
  const now = Date.now();
  const note = coerceNote({ ...draft, id: undefined, done: false, createdAt: now, updatedAt: now }, now);
  if (!note) return Promise.resolve(null);
  return mutateNotes((cur) => ({ notes: [note, ...cur], result: note }));
}

/**
 * Patch one note. A function patch is computed inside the lock from the current
 * note (a toggle never reads outside it). Ticking done stamps `completedAt`.
 * @param {string} id
 * @param {Partial<Note> | ((current: Note) => Partial<Note>)} patch
 * @returns {Promise<Note | null>} null when the note is gone
 */
export function updateNote(id, patch) {
  return mutateNotes((cur) => {
    const old = cur.find((n) => n.id === id);
    if (!old) return { notes: cur, result: null };
    const p = typeof patch === 'function' ? patch(old) : patch;
    const now = Date.now();
    const done = p.done ?? old.done;
    const next = coerceNote({ ...old, ...p, id, updatedAt: now, completedAt: done ? (old.done ? old.completedAt : now) : null }, now);
    return next ? { notes: cur.map((n) => (n.id === id ? next : n)), result: next } : { notes: cur, result: null };
  });
}

/** @param {string} id */
export const togglePinned = (id) => updateNote(id, (n) => ({ pinned: !n.pinned }));
/** @param {string} id */
export const toggleDone = (id) => updateNote(id, (n) => ({ done: !n.done }));

/** @param {string} id @returns {Promise<Note | null>} the removed note, for Undo */
export function deleteNote(id) {
  return mutateNotes((cur) => ({ notes: cur.filter((n) => n.id !== id), result: cur.find((n) => n.id === id) ?? null }));
}

/** Undo a delete: put the note back unless its id is already there. @param {Note} note */
export function restoreNote(note) {
  return mutateNotes((cur) => ({ notes: cur.some((n) => n.id === note.id) ? cur : [note, ...cur], result: undefined }));
}

/** "Delete everything" in the report. @returns {Promise<number>} how many were removed */
export function deleteAllNotes() {
  return mutateNotes((cur) => ({ notes: [], result: cur.length }));
}

/**
 * Merge untrusted notes in (an import): new ids are added; on the same id the
 * newer `updatedAt` wins (ForgetMeNot's rule), so importing twice changes nothing.
 * @param {unknown[]} incoming @returns {Promise<number>} how many were added
 */
export function mergeNotes(incoming) {
  const clean = incoming.map((n) => coerceNote(n)).filter((n) => n !== null);
  return mutateNotes((cur) => {
    const byId = new Map(cur.map((n) => [n.id, n]));
    let added = 0;
    for (const n of clean) {
      const old = byId.get(n.id);
      if (!old) added += 1;
      if (!old || n.updatedAt > old.updatedAt) byId.set(n.id, n);
    }
    return { notes: [...byId.values()], result: added };
  });
}

/**
 * Re-render on a change from any context (another tab, the worker, the on-page note).
 * @param {(notes: Note[]) => void} cb @returns {() => void} unsubscribe
 */
export function onNotesChanged(cb) {
  /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
  const listener = (changes, area) => {
    if (area === 'local' && KEY in changes) cb(coerceNoteList(changes[KEY]?.newValue).notes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
```

- [ ] **Step 5: Run the gate**

Run: `npm test && npm run typecheck`

Expected: `# tests 259`, `# pass 259`, `# fail 0` in each timezone (245 + 9 store + 5 views); typecheck prints nothing after its header. The e2e suite is unchanged (no page imports these modules yet).

---

### Task 2: Every notes reader and writer moves to the store (L3, W2)

After this task `src/lib/notes.js` is the only code that reads or writes `notes`. The panel footer's quick note, the day sheet's note slot and the report's Notes section write **day notes** (untitled, category Work, dated); the update's Other work is the week's day notes through `otherWork()`, which never returns a private note; the Weekly import validates notes with `coerceNote` and merges them under the lock; Delete everything empties notes through the lock; and the worker's 90-day purge no longer deletes notes (spec §4 retention). `week-notes.js` is deleted.

**Files:**
- Modify: `src/background/service-worker.js` (purge), `src/lib/portability.js` (import), `src/lib/schema.js` (comment)
- Modify: `src/ui/panel/footer.js`, `src/ui/app/day-sheet.js` (L3), `src/ui/report/notes-panel.js` (rewritten), `src/ui/report/report.html`, `src/ui/report/main.js`, `src/ui/report/draft-panel.js`, `src/ui/report/data-panel.js`
- Delete: `src/lib/week-notes.js`, `test/week-notes.test.js`
- Modify: `test/portability.test.js`, `test/background/service-worker.test.js`
- Create: `test/e2e/notes.mjs`; modify `test/e2e/panel.mjs`, `test/e2e/app.mjs`, `test/e2e/full.mjs`

**Interfaces:**
- Consumes (Task 1): `getNotes`, `createNote`, `deleteNote`, `deleteAllNotes`, `mergeNotes`, `coerceNote`, `dayNotes`, `otherWork`, `onNotesChanged`.
- Produces:
  - `parseImport(text, ownDeviceId) → { writes, deviceId, days, notes: Note[] }` (the third parameter is gone; private notes are left out because this format carries no PIN record); `applyImport(file) → { days, notes: <added> }`.
  - The report's `W.notes` is `{ id, day, text }[]` (from `otherWork`), still what `buildWeekly({ notes })` and `buildStandup({ notes })` read (`{ text }`).
  - The day sheet's `#sheetNotes` / `#noteForm` / `#dayNote` and the footer's `#noteForm` / `#note` keep their ids; the report gains `#notesMsg`.
  - `test/e2e/notes.mjs` exports `legacyNoteChecks(t, rep)`; later tasks append to this module.

- [ ] **Step 1: Write the failing tests**

In `test/portability.test.js`, replace:

```js
test('import dedupes notes by id and caps text at 1000 chars', () => {
  const r = parseImport(file({ deviceId: 'd2', notes: [
    { id: 1, ts: 1, text: 'dup' }, { id: 2, ts: 2, text: 'y'.repeat(2000) }, { id: 'x', ts: 3, text: 'bad' }] }), 'me', [{ id: 1, ts: 1, text: 'mine' }]);
  assert.deepEqual(r.newNotes.map((n) => n.id), [2]);
  assert.equal(r.newNotes[0]?.text.length, 1000);
```

with:

```js
test('import reads Weekly 2 and Weekly 3 notes, validated; private and empty ones are left out', () => {
  const r = parseImport(file({ deviceId: 'd2', notes: [
    { id: 2, ts: 2, text: 'y'.repeat(30000) }, { id: 'x', ts: 3, text: 'no title field, wrong id' },
    { id: 'n_abc', title: 'Plan', body: 'b', category: '<b>', day: 'nope' },
    { id: 'n_priv', title: '', body: '', enc: { iv: 'AAAA', ct: 'BBBB' } }] }), 'me');
  assert.deepEqual(r.notes.map((n) => n.id), ['w2-2', 'n_abc']);
  assert.equal(r.notes[0]?.body.length, 20000);
  assert.equal(r.notes[1]?.category, 'General');
  assert.equal(r.notes[1]?.day, null);
```

In `test/portability.test.js`, replace:

```js
  assert.deepEqual(l.notes.map((n) => n.id), [1]);
```

with:

```js
  assert.deepEqual(l.notes.map((n) => n.id), ['w2-1'], 'merged through the notes store, once');
  assert.equal(l.notes[0].body, 'n1');
```

In `test/background/service-worker.test.js`, replace:

```js
  assert.equal(stub.log.tabsCreated.at(-1)?.url, 'chrome-extension://weekly/src/ui/app/app.html#tasks');
});

```

with:

```js
  assert.equal(stub.log.tabsCreated.at(-1)?.url, 'chrome-extension://weekly/src/ui/app/app.html#tasks');
});

test('notes are kept until deleted: the 90-day purge leaves them alone (spec §4 retention)', async () => {
  const old = Date.now() - 200 * 864e5;
  // A Weekly 2 note from 200 days ago: Weekly 2 purged these with the activity.
  await stub.chrome.storage.local.set({ notes: [{ id: 1, ts: old, text: 'Old call' }] });
  emit('runtime.onInstalled', { reason: 'update' });
  await settle();
  assert.equal(stub.stores.local.notes?.length, 1);
});

```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/portability.test.js test/background/service-worker.test.js`

Expected: `# fail 3`: `import reads Weekly 2 and Weekly 3 notes, validated; private and empty ones are left out` and `applyImport writes imp:<device>:<date>, merges imports without duplicates and dedupes notes` (`parseImport` still returns `newNotes` with numeric ids), and `notes are kept until deleted: the 90-day purge leaves them alone (spec §4 retention)` (the purge deletes the 200-day-old Weekly 2 note).

- [ ] **Step 3: The worker keeps notes; the import goes through the store**

In `src/background/service-worker.js`, replace:

```js
import { expiredKeys, RETENTION_DAYS } from '../lib/week.js';
```

with:

```js
import { expiredKeys } from '../lib/week.js';
```

In `src/background/service-worker.js`, replace:

```js
async function purgeOld() {
  const all = await chrome.storage.local.get(null);
  const old = expiredKeys(Object.keys(all));
  if (old.length) await chrome.storage.local.remove(old);
  const cutoff = Date.now() - RETENTION_DAYS * 864e5;
  const notes = all.notes || [];
  if (notes.some((/** @type {{ ts: number }} */ n) => n.ts < cutoff)) await chrome.storage.local.set({ notes: notes.filter((/** @type {{ ts: number }} */ n) => n.ts >= cutoff) });
```

with:

```js
// Activity is purged after 90 days; notes are kept until the user deletes them (spec §4).
async function purgeOld() {
  const old = expiredKeys(Object.keys(await chrome.storage.local.get(null)));
  if (old.length) await chrome.storage.local.remove(old);
```

In `src/lib/portability.js`, replace:

```js
// Export/import between devices.
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
```

with:

```js
// Export/import between devices.
import { coerceNote, mergeNotes } from './notes.js';

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
```

In `src/lib/portability.js`, replace:

```js
 * @param {string} text
 * @param {string | undefined} ownDeviceId
 * @param {any[]} existingNotes
 * @returns {{ writes: Record<string, object>, deviceId: string, days: number, newNotes: {id: number, ts: number, text: string}[] }}
 */
export function parseImport(text, ownDeviceId, existingNotes) {
```

with:

```js
 * Notes, Weekly 2's or Weekly 3's, are validated by coerceNote. Private notes are left
 * out: their ciphertext needs the PIN record, which this format does not carry.
 * @param {string} text
 * @param {string | undefined} ownDeviceId
 * @returns {{ writes: Record<string, object>, deviceId: string, days: number, notes: import('./notes.js').Note[] }}
 */
export function parseImport(text, ownDeviceId) {
```

In `src/lib/portability.js`, replace:

```js
  const ids = new Set(existingNotes.map(n => n.id));
  const newNotes = (Array.isArray(data.notes) ? data.notes : [])
    .filter((/** @type {any} */ n) => n && Number.isFinite(n.id) && Number.isFinite(n.ts) && typeof n.text === 'string' && !ids.has(n.id))
    .map((/** @type {any} */ n) => ({ id: n.id, ts: n.ts, text: n.text.slice(0, 1000) }));
  return { writes, deviceId: dev, days, newNotes };
```

with:

```js
  const notes = (Array.isArray(data.notes) ? data.notes : []).map((/** @type {unknown} */ n) => coerceNote(n))
    .filter((/** @type {import('./notes.js').Note | null} */ n) => n !== null && n.enc === null);
  return { writes, deviceId: dev, days, notes };
```

In `src/lib/portability.js`, replace:

```js
  const { deviceId, imports = [], notes = [] } = await chrome.storage.local.get(['deviceId', 'imports', 'notes']);
  const { writes, deviceId: dev, days, newNotes } = parseImport(text, deviceId, notes);
  await chrome.storage.local.set({ ...writes, imports: [...new Set([...imports, dev])], notes: [...notes, ...newNotes] });
  return { days, notes: newNotes.length };
```

with:

```js
  const { deviceId, imports = [] } = await chrome.storage.local.get(['deviceId', 'imports']);
  const { writes, deviceId: dev, days, notes } = parseImport(text, deviceId);
  await chrome.storage.local.set({ ...writes, imports: [...new Set([...imports, dev])] });
  // Notes go through the notes lock: same id twice keeps the newer one.
  return { days, notes: await mergeNotes(notes) };
```

In `src/lib/schema.js`, replace:

```js
 * notes, settings) are not read or touched here. Notes move in Phase 4.
```

with:

```js
 * notes, settings) are not read or touched here: notes.js converts notes by shape.
```

- [ ] **Step 4: The panel footer and the day sheet write day notes**

The day sheet's `renderNotes()` and `#noteForm` handler are the hooks Phase 2b left for this (its "Phase 4" interfaces); the slot also re-renders when a note changes anywhere.

In `src/ui/panel/footer.js`, replace:

```js
// tracked, pause, a quick note, the storage-full banner, the privacy line).
```

with:

```js
// tracked, pause, a quick day note, the storage-full banner, the privacy line).
```

In `src/ui/panel/footer.js`, replace:

```js
import { addWeekNote } from '../../lib/week-notes.js';
```

with:

```js
import { createNote } from '../../lib/notes.js';
import { today } from '../../lib/dates.js';
```

In `src/ui/panel/footer.js`, replace:

```js
  if (!(await addWeekNote(note.value))) return;
  note.value = '';
  $('#noteMsg').textContent = 'Added to this week’s notes.';
```

with:

```js
  // A day note for today: it lands in the day sheet and in the update's Other work.
  if (!(await createNote({ body: note.value, category: 'Work', day: today() }))) return;
  note.value = '';
  $('#noteMsg').textContent = 'Added to today’s notes.';
```

In `src/ui/app/day-sheet.js`, replace:

```js
// day's notes. A native <dialog>: Esc closes it (L9).
```

with:

```js
// day's notes (L3: untitled notes dated to that day). A native <dialog>: Esc closes it (L9).
```

In `src/ui/app/day-sheet.js`, replace:

```js
import { getWeekNotes, addWeekNote, deleteWeekNote, notesOn } from '../../lib/week-notes.js';
```

with:

```js
import { getNotes, createNote, deleteNote, dayNotes, onNotesChanged } from '../../lib/notes.js';
```

In `src/ui/app/day-sheet.js`, replace:

```js
  list.append(...notesOn(await getWeekNotes(), iso).map((n) => h('li', {}, h('span', {}, n.text),
    h('button', { class: 'quiet', attrs: { 'aria-label': `Delete note: ${n.text}` },
      on: { click: () => deleteWeekNote(n.id).then(renderNotes, report) } }, '✕'))));
```

with:

```js
  list.append(...dayNotes(await getNotes(), iso).map((n) => h('li', {}, h('span', {}, n.body),
    h('button', { class: 'quiet', attrs: { 'aria-label': `Delete note: ${n.body}` },
      on: { click: () => deleteNote(n.id).catch(report) } }, '✕'))));
```

In `src/ui/app/day-sheet.js`, replace:

```js
  onAdd('#noteForm', (text, iso) => addWeekNote(text, iso).then(() => renderNotes()).then(() => true, (e) => { report(e); return false; }));
```

with:

```js
  onAdd('#noteForm', (body, iso) => createNote({ body, category: 'Work', day: iso }).then(() => true, (e) => { report(e); return false; }));
  // A note added or deleted anywhere (the panel, the report, another tab) shows here at once.
  onNotesChanged(() => void renderNotes());
```

- [ ] **Step 5: The report reads and writes notes through the store**

`notes-panel.js` is rewritten whole: every line of it changes (its direct-storage exceptions go).

Replace the whole of `src/ui/report/notes-panel.js` with:

```js
// Notes: work that didn't happen in Chrome. The week's day notes (spec §4, W2),
// read and written through lib/notes.js; private notes never reach this list.
import { h, clear, $ } from '../components/dom.js';
import { WEEKDAYS } from '../../lib/report/draft.js';
import { createNote, deleteNote } from '../../lib/notes.js';
import { weekday, today, addDays } from '../../lib/dates.js';
import { dayKey } from '../../lib/week.js';
import { getW, getWeekOffset, load, msg } from './main.js';

export function renderNotes(W) {
  clear($('#notes'));
  $('#notes').append(...W.notes.map(n => h('li', {},
    h('span', {}, h('small', {}, WEEKDAYS[(weekday(n.day) + 6) % 7]), n.text),
    h('button', { class: 'quiet', dataset: { del: n.id }, attrs: { 'aria-label': 'Delete note' } }, '✕'))));
}

async function addNote() {
  const body = $('#noteText').value.trim(); if (!body) return;
  // Notes added while viewing a past week are dated to that week's Friday.
  const day = getWeekOffset() === 0 ? today() : addDays(dayKey(getW().start), 4);
  await createNote({ body, category: 'Work', day });
  $('#noteText').value = '';
  load(false);
}

const fail = e => msg('#notesMsg', `That note was not saved: ${e.message}`);

export function init() {
  $('#addNote').onclick = () => addNote().catch(fail);
  $('#noteText').addEventListener('keydown', e => { if (e.key === 'Enter') addNote().catch(fail); });
  $('#notes').addEventListener('click', async e => {
    const id = e.target.dataset.del; if (!id) return;
    await deleteNote(id).catch(fail);
    load(false);
  });
}
```

In `src/ui/report/report.html`, replace:

```html
      <ul id="notes" class="notes"></ul>
    </section>
```

with:

```html
      <ul id="notes" class="notes"></ul>
      <p id="notesMsg" class="msg" role="status"></p>
    </section>
```

In `src/ui/report/main.js`, replace:

```js
import { onTasksChanged } from '../../lib/storage.js';

```

with:

```js
import { onTasksChanged } from '../../lib/storage.js';
import { getNotes, otherWork, onNotesChanged } from '../../lib/notes.js';

```

In `src/ui/report/main.js`, replace:

```js
  // ponytail: direct storage until lib/storage.js (Phase 4)  (notes)
  const [range, settings, st, tasks] = await Promise.all([loadRange(start, WORK_DAYS), getSettings(), chrome.storage.local.get(['notes', wk, 'shareOk']), getTasks()]);
  const end = shiftDate(start, WORK_DAYS);
  const { from, to } = doneRange(dayKey(start));
  // Notes keep the whole Mon–Sun span, so a note jotted on Saturday still lands in that week's update.
  const notes = (st.notes || []).filter(n => n.ts >= start.getTime() && n.ts < shiftDate(start, 7).getTime());
```

with:

```js
  const [range, settings, st, tasks, allNotes] = await Promise.all([loadRange(start, WORK_DAYS), getSettings(), chrome.storage.local.get([wk, 'shareOk']), getTasks(), getNotes()]);
  const end = shiftDate(start, WORK_DAYS);
  const { from, to } = doneRange(dayKey(start));
  // Other work: the week's day notes over the whole Mon–Sun span, so a Saturday note still lands in that week's update.
  // Private notes never come back from otherWork, so they never reach the draft or the AI prompt.
  const notes = otherWork(allNotes, dayKey(start), dayKey(shiftDate(start, 6)));
```

In `src/ui/report/main.js`, replace:

```js
  onTasksChanged(() => { clearTimeout(reloadT); reloadT = setTimeout(() => load(false), 300); });
  if (location.hash === '#settings') openSettings();
```

with:

```js
  onTasksChanged(() => { clearTimeout(reloadT); reloadT = setTimeout(() => load(false), 300); });
  onNotesChanged(() => { clearTimeout(reloadT); reloadT = setTimeout(() => load(false), 300); });
  if (location.hash === '#settings') openSettings();
```

In `src/ui/report/draft-panel.js`, replace:

```js
import { withoutExcluded } from '../../lib/tasks.js';
import { getW, getStatuses, msg, fmtDate, aboveMin, included } from './main.js';
```

with:

```js
import { withoutExcluded } from '../../lib/tasks.js';
import { getNotes, otherWork } from '../../lib/notes.js';
import { getW, getStatuses, msg, fmtDate, aboveMin, included } from './main.js';
```

In `src/ui/report/draft-panel.js`, replace:

```js
  // ponytail: direct storage until lib/storage.js (Phase 4)
  const [prev, now, { notes = [] }] = await Promise.all([loadRange(prevDay, 1), loadRange(today, 1), chrome.storage.local.get('notes')]);
  const prevLabel = dayKey(prevDay) === dayKey(shiftDate(today, -1)) ? 'Yesterday' : prevDay.toLocaleDateString(undefined, { weekday: 'long' });
  return { prevLabel, prevItems: aboveMin(prev.merged).filter(included), todayItems: aboveMin(now.merged).filter(included),
    notes: notes.filter(n => n.ts >= prevDay.getTime()) };
```

with:

```js
  const [prev, now, notes] = await Promise.all([loadRange(prevDay, 1), loadRange(today, 1), getNotes()]);
  const prevLabel = dayKey(prevDay) === dayKey(shiftDate(today, -1)) ? 'Yesterday' : prevDay.toLocaleDateString(undefined, { weekday: 'long' });
  return { prevLabel, prevItems: aboveMin(prev.merged).filter(included), todayItems: aboveMin(now.merged).filter(included),
    notes: otherWork(notes, dayKey(prevDay), dayKey(today)) };
```

In `src/ui/report/data-panel.js`, replace:

```js
import { deleteEverything } from '../../lib/task-portability.js';
import { msg, load } from './main.js';
```

with:

```js
import { deleteEverything } from '../../lib/task-portability.js';
import { deleteAllNotes } from '../../lib/notes.js';
import { msg, load } from './main.js';
```

In `src/ui/report/data-panel.js`, replace:

```js
// Settings and the device ID stay. Tasks are emptied through the task lock, never removed behind its back.
const KEEP = new Set(['settings', 'deviceId', 'tasks', 'schemaVersion']);
```

with:

```js
// Settings, the device ID and the notes PIN stay. Tasks and notes are emptied through their locks, never removed behind their backs.
const KEEP = new Set(['settings', 'deviceId', 'tasks', 'schemaVersion', 'notes', 'security']);
```

In `src/ui/report/data-panel.js`, replace:

```js
  await deleteEverything();
  msg('#settingsMsg', 'All activity, notes and tasks deleted.');
```

with:

```js
  await deleteEverything();
  await deleteAllNotes();
  msg('#settingsMsg', 'All activity, notes and tasks deleted.');
```

- [ ] **Step 6: Delete Weekly 2's notes module**

Delete `src/lib/week-notes.js`.

Delete `test/week-notes.test.js`.

Run: `grep -rnE "week-notes|getWeekNotes|addWeekNote|deleteWeekNote|notesOn" src test || echo 'week-notes is gone'`

Expected: `week-notes is gone`.

- [ ] **Step 7: Run the unit gate**

Run: `npm test && npm run typecheck`

Expected: `# tests 256`, `# pass 256`, `# fail 0` in each timezone (259, minus the 4 `week-notes` tests, plus the retention test); typecheck clean.

- [ ] **Step 8: End-to-end: notes read as `Note`, delete-all keeps an emptied `notes` key, and a Weekly 2 note migrates**

In `test/e2e/panel.mjs`, replace:

```js
  check('Panel', 'note added with Enter', (await store()).notes?.some(n => n.text === 'Phone screen with 2 candidates'));
```

with:

```js
  check('Panel', 'note added with Enter', (await store()).notes?.some(n => n.body === 'Phone screen with 2 candidates' && n.day === t.iso.today));
```

In `test/e2e/app.mjs`, replace:

```js
  check('Day sheet', 'note slot: a note for this day (L3)', await app.locator('#sheetNotes li', { hasText: 'Offsite planning' }).count() === 1 && (await store()).notes.some(n => n.text === 'Offsite planning'));
```

with:

```js
  check('Day sheet', 'note slot: a note for this day (L3)', await app.locator('#sheetNotes li', { hasText: 'Offsite planning' }).count() === 1 && (await store()).notes.some(n => n.body === 'Offsite planning' && n.day === iso.today));
```

Create `test/e2e/notes.mjs`:

```js
// Notes (spec §3.1 Notes, §3.4, §4; F1–F5, F8, L3, W2). Dates are computed in Node and
// passed in; sw.evaluate callbacks use only chrome.*, built-ins and their argument (R1).

// A Weekly 2 profile's note, written straight into storage, reaches the update as Other work.
export async function legacyNoteChecks(t, rep) {
  const { sw, check, store, wait } = t;
  await sw.evaluate((ts) => chrome.storage.local.get('notes').then(({ notes = [] }) =>
    chrome.storage.local.set({ notes: [...notes, { id: 4242, ts, text: 'Legacy call with Acme' }] })), Date.now());
  await rep.reload(); await wait(1200);
  const md = await rep.inputValue('#md');
  const migrated = (await store()).notes.find(n => n.id === 'w2-4242');
  check('Notes', 'a Weekly 2 note becomes a day note, category Work (migration by shape)', migrated?.body === 'Legacy call with Acme' && migrated.category === 'Work' && migrated.day === t.iso.today && !('text' in migrated), JSON.stringify(migrated));
  check('Notes', 'day notes are the update’s Other work (W2)', /### Other work\n(- .*\n)*- Legacy call with Acme/.test(md), md.slice(-300));
  await rep.locator('#notes li', { hasText: 'Legacy call with Acme' }).locator('button').click(); await wait(500);
}
```

In `test/e2e/full.mjs`, replace:

```js
check('Notes', 'delete note', !(await rep.locator('#notes li').allTextContents()).some(t => t.includes('Q4 hiring sync')));
await rep.screenshot({ path: shots + '/3-report.png', fullPage: true });
```

with:

```js
check('Notes', 'delete note', !(await rep.locator('#notes li').allTextContents()).some(t => t.includes('Q4 hiring sync')));
const { legacyNoteChecks } = await import('./notes.mjs');
await legacyNoteChecks(harness, rep);
await rep.screenshot({ path: shots + '/3-report.png', fullPage: true });
```

In `test/e2e/full.mjs`, replace:

```js
// The first task read writes `tasks` and `schemaVersion`; delete-all empties tasks through the task lock.
check('Data', 'delete all keeps only settings and device ID (tasks emptied)', Object.keys(st).sort().join(',') === 'deviceId,schemaVersion,settings,tasks' && st.tasks.length === 0, Object.keys(st).join(','));
```

with:

```js
// The first task read writes `tasks` and `schemaVersion`; delete-all empties tasks and notes through their locks.
check('Data', 'delete all keeps only settings and device ID (tasks and notes emptied)', Object.keys(st).sort().join(',') === 'deviceId,notes,schemaVersion,settings,tasks' && st.tasks.length === 0 && st.notes.length === 0, Object.keys(st).join(','));
```

Run: `npm run e2e`

Expected: `200/200 passed`. New: `[Notes] a Weekly 2 note becomes a day note, category Work (migration by shape)`, `[Notes] day notes are the update’s Other work (W2)`. Renamed: `[Data] delete all keeps only settings and device ID (tasks and notes emptied)`. The panel's `note added with Enter` and the day sheet's `note slot: a note for this day (L3)` now check `body` and `day`.

---

### Task 3: PIN crypto primitives (F3)

ForgetMeNot's `src/panel/crypto.js` (a `globalThis.FMNCrypto` IIFE) becomes an ES module with the same algorithm and work factor, and its 12 tests come along (`ForgetMeNot/extension/test/crypto.test.mjs`, loaded there with `vm`, imported here), folded with the new cases into 10. Four changes, each tested:
- **PIN length:** 4 to 8 digits (ForgetMeNot: exactly 4). Every ForgetMeNot PIN still fits; a longer PIN multiplies the offline guessing cost the verifier allows.
- **Verifier text:** new records use `weekly.verifier.v1`; `verify` also accepts ForgetMeNot's `forgetmenot.verifier.v1`, so Phase 5 can adopt a ForgetMeNot security record as is.
- **`sealNote` / `openNote`:** title and body are encrypted together as JSON, so a locked note shows neither (F8). ForgetMeNot sealed only the body; such a blob still opens, with the stored title.
- **`coerceSecurity`, `afterFailure`, `afterSuccess`, `lockedFor`:** the record is validated as untrusted input (an imported record cannot lower PBKDF2 below 100,000 rounds) and the lockout bookkeeping that ForgetMeNot's worker did inline is pure and unit-tested.

**Files:**
- Create: `src/lib/crypto.js`
- Create: `test/crypto.test.js`

**Interfaces:**
- Consumes: the `Cipher` and `Plain` types (`src/lib/note-views.js`, Task 1); WebCrypto (`crypto.subtle`, `crypto.getRandomValues`), `btoa`/`atob`, `TextEncoder`/`TextDecoder`: all globals in the worker, every extension page and Node 22.
- Produces (`src/lib/crypto.js`):
  - `PBKDF2_ITERATIONS = 310000`; type `Security = { version, salt, iterations, verifier: Cipher, failedAttempts, lockedUntil, createdAt }`
  - `isValidPin(pin) → boolean` (`/^\d{4,8}$/`), `deriveKey(pin, salt, iterations) → CryptoKey` (non-extractable AES-GCM 256), `encrypt(key, text) → Cipher`, `decrypt(key, cipher) → string` (throws on a wrong key or tampering)
  - `createSecurity(pin) → Security`, `verify(pin, sec) → CryptoKey | null`, `coerceSecurity(raw) → Security | null`
  - `lockoutFor(failures)`: 0 for 0–4, then 30 s, 1 min, 5 min, 15 min; `afterFailure(sec, now) → Security`, `afterSuccess(sec) → Security`, `lockedFor(sec, now) → ms`
  - `sealNote(key, Plain) → Cipher`, `openNote(key, Cipher, title?) → Plain`; `bytesToB64`, `b64ToBytes`

- [ ] **Step 1: Write the failing test**

Create `test/crypto.test.js`:

```js
// PIN crypto primitives (F3), ported from ForgetMeNot's crypto.test.mjs and
// extended: PINs of 4 to 8 digits, ForgetMeNot's verifier still accepted, the
// note sealed as one {title, body} blob, the security record validated, and the
// lockout steps as pure transitions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

globalThis.crypto ??= /** @type {Crypto} */ (/** @type {unknown} */ (webcrypto));
const C = await import('../src/lib/crypto.js');

test('isValidPin accepts 4 to 8 digits only', () => {
  for (const ok of ['1234', '0000', '12345678']) assert.equal(C.isValidPin(ok), true, ok);
  for (const bad of ['123', '123456789', '12a4', ' 1234', 1234, null]) assert.equal(C.isValidPin(bad), false, String(bad));
});

test('encrypt/decrypt round-trips arbitrary text; each encryption has a fresh IV', async () => {
  const key = await C.verify('4242', await C.createSecurity('4242'));
  assert.ok(key, 'verify returns a key for the right PIN');
  const secret = 'my private note\nwith unicode ✓ 日本語 and emoji 🔒';
  const a = await C.encrypt(key, secret);
  const b = await C.encrypt(key, secret);
  assert.notEqual(a.ct, secret);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ct, b.ct);
  assert.equal(await C.decrypt(key, a), secret);
});

test('verify returns null for a wrong PIN or a malformed record', async () => {
  const sec = await C.createSecurity('1234');
  assert.equal(await C.verify('9999', sec), null);
  assert.equal(await C.verify('0000', sec), null);
  assert.ok(await C.verify('1234', sec));
  assert.equal(await C.verify('1234', null), null);
  assert.equal(await C.verify('1234', /** @type {any} */ ({ salt: 'x' })), null);
});

test('decrypt throws on the wrong key and on tampered ciphertext', async () => {
  const keyA = await C.verify('1234', await C.createSecurity('1234'));
  const keyB = await C.verify('5678', await C.createSecurity('5678'));
  assert.ok(keyA && keyB);
  const blob = await C.encrypt(keyA, 'top secret');
  await assert.rejects(() => C.decrypt(keyB, blob));
  await assert.rejects(() => C.decrypt(keyA, { iv: blob.iv, ct: (blob.ct[0] === 'A' ? 'B' : 'A') + blob.ct.slice(1) }));
});

test('the security record is PIN-free: salt, iterations and a verifier only', async () => {
  const sec = await C.createSecurity('7391');
  assert.deepEqual(Object.keys(sec).sort(), ['createdAt', 'failedAttempts', 'iterations', 'lockedUntil', 'salt', 'verifier', 'version']);
  assert.equal(sec.iterations, 310000);
  assert.equal(C.PBKDF2_ITERATIONS, 310000);
  const { createdAt, ...rest } = sec;
  assert.equal(JSON.stringify(rest).includes('7391'), false, 'the PIN appears nowhere in what is stored');
  const again = await C.createSecurity('7391');
  assert.notEqual(again.salt, sec.salt, 'a fresh salt each time');
  assert.notEqual(again.verifier.ct, sec.verifier.ct);
});

test('a ForgetMeNot record (its own verifier text) unlocks with its PIN', async () => {
  const sec = await C.createSecurity('2468');
  const key = await C.verify('2468', sec);
  assert.ok(key);
  const fmn = { ...sec, verifier: await C.encrypt(key, 'forgetmenot.verifier.v1') };
  assert.ok(await C.verify('2468', fmn));
  const other = { ...sec, verifier: await C.encrypt(key, 'something else') };
  assert.equal(await C.verify('2468', other), null);
});

test('coerceSecurity rejects junk and a weakened work factor', async () => {
  const sec = await C.createSecurity('1234');
  assert.deepEqual(C.coerceSecurity(structuredClone(sec)), sec);
  assert.equal(C.coerceSecurity(null), null);
  assert.equal(C.coerceSecurity({ ...sec, iterations: 1 }), null, 'an imported record cannot lower PBKDF2 to nothing');
  assert.equal(C.coerceSecurity({ ...sec, salt: '<script>' }), null);
  assert.equal(C.coerceSecurity({ ...sec, verifier: { iv: 'x' } }), null);
  assert.deepEqual(C.coerceSecurity({ ...sec, failedAttempts: -3, lockedUntil: 'soon' }), { ...sec, failedAttempts: 0, lockedUntil: 0 });
});

test('lockout: 5 failures → 30 s, then 1 m, 5 m, 15 m; success resets (F3)', async () => {
  assert.deepEqual([0, 4, 5, 6, 7, 8, 50].map(C.lockoutFor), [0, 0, 30e3, 60e3, 300e3, 900e3, 900e3]);
  let sec = await C.createSecurity('1234');
  const t0 = 1_000_000;
  const waits = [];
  for (let i = 1; i <= 8; i++) {
    sec = C.afterFailure(sec, t0);
    waits.push(C.lockedFor(sec, t0));
  }
  assert.deepEqual(waits, [0, 0, 0, 0, 30e3, 60e3, 300e3, 900e3]);
  assert.equal(C.lockedFor(sec, t0 + 900e3), 0, 'the lock ends on time');
  sec = C.afterSuccess(sec);
  assert.deepEqual([sec.failedAttempts, sec.lockedUntil], [0, 0]);
});

test('sealNote/openNote keep title and body together; a ForgetMeNot body-only blob still opens', async () => {
  const key = await C.verify('1234', await C.createSecurity('1234'));
  assert.ok(key);
  const enc = await C.sealNote(key, { title: 'Salary talk', body: 'Ask for 10%' });
  assert.equal(enc.ct.includes('Salary'), false);
  assert.deepEqual(await C.openNote(key, enc), { title: 'Salary talk', body: 'Ask for 10%' });
  assert.deepEqual(await C.openNote(key, await C.encrypt(key, 'just a body'), 'Old title'), { title: 'Old title', body: 'just a body' });
});

test('base64 helpers round-trip bytes', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
  assert.deepEqual(Array.from(C.b64ToBytes(C.bytesToB64(bytes))), Array.from(bytes));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/crypto.test.js`

Expected: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/src/lib/crypto.js'`; `# fail 1`.

- [ ] **Step 3: Write the module**

Create `src/lib/crypto.js`:

```js
/**
 * PIN crypto for private notes (F3), ported from ForgetMeNot's crypto.js as an ES module.
 * Pure WebCrypto (PBKDF2 + AES-GCM): no network, no dependencies, no chrome.*.
 *
 * - A PIN is stretched with PBKDF2-SHA256 (310,000 rounds) into a non-extractable
 *   256-bit AES-GCM key. The PIN itself is never stored.
 * - What is stored is a random salt, the round count and a verifier: a fixed
 *   sentinel encrypted with the derived key. A wrong PIN gives a different key,
 *   AES-GCM authentication fails on the verifier, and the PIN is rejected.
 * - Every encryption uses a fresh random 96-bit IV.
 * - Key lifetime, lockout bookkeeping and message routing live in the worker
 *   (src/background/crypto-broker.js); this module only computes.
 */

export const PBKDF2_ITERATIONS = 310000;
// A record may not lower the work factor below this (an imported file is untrusted).
const MIN_ITERATIONS = 100000;
const MAX_ITERATIONS = 5000000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VERIFIER_TEXT = 'weekly.verifier.v1';
// ForgetMeNot's sentinel: its security record keeps working when its backup is imported (Phase 5).
const VERIFIERS = new Set([VERIFIER_TEXT, 'forgetmenot.verifier.v1']);

/** @typedef {import('./note-views.js').Cipher} Cipher */
/** @typedef {import('./note-views.js').Plain} Plain */
/**
 * The persisted PIN record: never the PIN, nothing a wrong PIN can open.
 * @typedef {{ version: number, salt: string, iterations: number, verifier: Cipher,
 *   failedAttempts: number, lockedUntil: number, createdAt: number }} Security
 */

/** @param {Uint8Array | ArrayBuffer} input */
export function bytesToB64(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** @param {string} b64 */
export function b64ToBytes(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

/** A PIN is 4 to 8 digits (ForgetMeNot's were 4, so theirs still fit). @param {unknown} pin @returns {pin is string} */
export const isValidPin = (pin) => typeof pin === 'string' && /^\d{4,8}$/.test(pin);

/** @param {string} pin @param {string} salt @param {number} iterations @returns {Promise<CryptoKey>} */
export async function deriveKey(pin, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64ToBytes(salt), iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** @param {CryptoKey} key @param {string} text @returns {Promise<Cipher>} */
export async function encrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { iv: bytesToB64(iv), ct: bytesToB64(ct) };
}

/** Throws when the key is wrong or the data was changed. @param {CryptoKey} key @param {Cipher} blob */
export async function decrypt(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(blob.iv) }, key, b64ToBytes(blob.ct));
  return new TextDecoder().decode(pt);
}

/** A fresh record for a new PIN. @param {string} pin @returns {Promise<Security>} */
export async function createSecurity(pin) {
  const salt = bytesToB64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
  const key = await deriveKey(pin, salt, PBKDF2_ITERATIONS);
  return { version: 1, salt, iterations: PBKDF2_ITERATIONS, verifier: await encrypt(key, VERIFIER_TEXT),
    failedAttempts: 0, lockedUntil: 0, createdAt: Date.now() };
}

/** The derived key for the right PIN, null for a wrong one. @param {string} pin @param {Security | null} sec */
export async function verify(pin, sec) {
  if (!sec?.salt || !sec.verifier) return null;
  try {
    const key = await deriveKey(pin, sec.salt, sec.iterations);
    return VERIFIERS.has(await decrypt(key, sec.verifier)) ? key : null;
  } catch {
    return null;   // AES-GCM authentication failure: a wrong PIN
  }
}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
/** @param {unknown} v @returns {v is string} */
const isB64 = (v) => typeof v === 'string' && v.length <= 512 && B64.test(v);
/** @param {unknown} v */
const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** A stored or imported record, validated; null when it cannot be trusted. @param {unknown} raw @returns {Security | null} */
export function coerceSecurity(raw) {
  if (!isObj(raw) || !isB64(raw['salt']) || !isObj(raw['verifier'])) return null;
  const { iv, ct } = raw['verifier'];
  const it = raw['iterations'];
  if (!isB64(iv) || !isB64(ct) || !Number.isInteger(it) || /** @type {number} */ (it) < MIN_ITERATIONS || /** @type {number} */ (it) > MAX_ITERATIONS) return null;
  return { version: 1, salt: raw['salt'], iterations: /** @type {number} */ (it), verifier: { iv, ct },
    failedAttempts: count(raw['failedAttempts']), lockedUntil: count(raw['lockedUntil']), createdAt: count(raw['createdAt']) };
}

/** Lock time after `attempts` failures in a row: the first four are free. @param {number} attempts */
export function lockoutFor(attempts) {
  if (attempts < 5) return 0;
  return [30e3, 60e3, 300e3][attempts - 5] ?? 900e3;
}

/** One more wrong PIN. @param {Security} sec @param {number} now @returns {Security} */
export function afterFailure(sec, now) {
  const failedAttempts = sec.failedAttempts + 1;
  const wait = lockoutFor(failedAttempts);
  return { ...sec, failedAttempts, lockedUntil: wait ? now + wait : 0 };
}

/** @param {Security} sec @returns {Security} */
export const afterSuccess = (sec) => ({ ...sec, failedAttempts: 0, lockedUntil: 0 });

/** How long the PIN stays refused, in ms. @param {Security} sec @param {number} now */
export const lockedFor = (sec, now) => Math.max(0, sec.lockedUntil - now);

/** Encrypt a note's title and body as one blob, so a locked note shows neither (F8). @param {CryptoKey} key @param {Plain} plain */
export const sealNote = (key, plain) => encrypt(key, JSON.stringify({ title: plain.title, body: plain.body }));

/**
 * The reverse of sealNote. ForgetMeNot sealed the body alone and kept the title
 * in plain text; such a blob opens with `title` as the title.
 * @param {CryptoKey} key @param {Cipher} enc @param {string} [title] @returns {Promise<Plain>}
 */
export async function openNote(key, enc, title = '') {
  const text = await decrypt(key, enc);
  try {
    const o = JSON.parse(text);
    if (isObj(o) && typeof o['title'] === 'string' && typeof o['body'] === 'string') return { title: o['title'], body: o['body'] };
  } catch { /* not JSON: a ForgetMeNot body */ }
  return { title, body: text };
}
```

- [ ] **Step 4: Run the gate**

Run: `npm test && npm run typecheck`

Expected: `# tests 266`, `# pass 266`, `# fail 0` in each timezone (+10); typecheck clean. The crypto file runs in under a second.

---

### Task 4: The PIN broker in the worker (F3)

The key derived from the PIN lives only in this worker's memory (spec §4): never in storage, never in a page, never in a message. Pages send `crypto:*` messages; the broker answers them one at a time (so two unlock attempts cannot race the failure count, and a PIN change is never interleaved with an encryption) and is the only writer of the `security` record.

Behaviour, each pinned by a test:
- **Lockout everywhere:** unlock, change and remove all check the PIN through one `checkPin()`, so the lockout cannot be sidestepped by guessing through Change PIN (ForgetMeNot's worker did not count failures there). While locked out the PIN is not even tried, and the refused try is not counted.
- **Key lifetime:** dropped on `crypto:lock`; after 5 minutes without a private-note action (`IDLE_MS`, checked on every use, sliding); and on every worker restart, because the module starts with no key.
- **Change PIN** re-encrypts every private note under `NOTES_LOCK` and writes the notes and the new record in **one** `storage.local.set`, so they can never disagree; if one note cannot be opened, nothing is written.
- **Remove PIN** turns private notes back into plain ones first, then removes the record: a stop in between leaves a PIN with nothing to protect, never an unreadable note.
- **Senders:** only Weekly's own pages (`sender.id` is this extension and `sender.url` is under `chrome-extension://<id>/`). A content script in a web page, or another extension, gets `Not allowed.`

**Files:**
- Create: `src/background/crypto-broker.js`
- Modify: `src/lib/notes.js` (`transformNotes`), `src/background/service-worker.js` (routes `crypto:*`)
- Create: `test/background/crypto-broker.test.js`
- Modify: `test/helpers/chrome-stub.js` (`runtime.id`), `test/background/service-worker.test.js`

**Interfaces:**
- Consumes (Task 3): `isValidPin`, `createSecurity`, `verify`, `coerceSecurity`, `afterFailure`, `afterSuccess`, `lockedFor`, `sealNote`, `openNote`. (Task 1): `coerceCipher`, `NOTE_TITLE_MAX`, `NOTE_BODY_MAX`.
- Produces:
  - `transformNotes(fn: (notes) => Promise<{ notes, also? }>) → Promise<void>` (`src/lib/notes.js`): an async rewrite under `NOTES_LOCK`; `also` is written in the same `set()`; nothing is written when `fn` throws.
  - `src/background/crypto-broker.js`: `IDLE_MS = 300000`, `lock()`, `handle(msg, sender) → Promise<Reply>`.
  - Messages (all answer `{ ok: false, error }` on a refusal):

    | Message | Payload | Answer |
    |---|---|---|
    | `crypto:status` | | `{ ok, hasPin, unlocked, lockedUntil, failedAttempts }` |
    | `crypto:setPin` | `pin` | `{ ok }`; unlocked afterwards |
    | `crypto:unlock` | `pin` | `{ ok }`, or `{ ok: false, error: 'Wrong PIN.', failedAttempts, lockedUntil }`, or `{ ok: false, error: 'Too many wrong PINs.', lockedUntil }` |
    | `crypto:lock` | | `{ ok }` |
    | `crypto:encrypt` | `title`, `body` | `{ ok, enc }` or `{ ok: false, locked: true }` |
    | `crypto:decrypt` | `items: {id, enc}[]` (≤ 2000) | `{ ok, plain: { [id]: Plain \| null } }` or `{ ok: false, locked: true }` |
    | `crypto:changePin` | `pin`, `next` | `{ ok }` |
    | `crypto:removePin` | `pin` | `{ ok }` |

  - The worker's `runtime.onMessage` listener returns `true` for `crypto:*` (it answers after an await).
  - `test/helpers/chrome-stub.js`: `chrome.runtime.id === 'weekly'`.

- [ ] **Step 1: Write the failing tests**

In `test/helpers/chrome-stub.js`, replace:

```js
    runtime: {
      getURL: (p) => `chrome-extension://weekly/${p}`,
```

with:

```js
    runtime: {
      id: 'weekly',
      getURL: (p) => `chrome-extension://weekly/${p}`,
```

Create `test/background/crypto-broker.test.js`:

```js
// The worker's PIN broker (F3, spec §4 Private notes): the key lives only in this
// module's memory; storage holds a salt and a verifier, never the PIN, and a
// private note's title and body only as ciphertext.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

const stub = installChromeStub();
const broker = await import('../../src/background/crypto-broker.js');
const { createNote, getNotes } = await import('../../src/lib/notes.js');

const PAGE = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/panel/panel.html' };
/** @param {Record<string, unknown>} msg */
const ask = (msg, sender = PAGE) => broker.handle(msg, sender);
const realNow = Date.now;
let clock = 0;
/** Move the clock the broker sees. @param {number} ms */
const later = (ms) => { clock += ms; };

beforeEach(() => {
  for (const k of Object.keys(stub.stores.local)) delete stub.stores.local[k];
  broker.lock();
  clock = 0;
  Date.now = () => realNow() + clock;
});
afterEach(() => { Date.now = realNow; });

/** Save a private note the way the pages do: seal in the worker, store the ciphertext. */
async function privateNote(title = 'Salary talk', body = 'Ask for 10%') {
  const r = await ask({ type: 'crypto:encrypt', title, body });
  assert.equal(r.ok, true, JSON.stringify(r));
  return createNote({ enc: r.enc, category: 'Personal' });
}

test('set a PIN: only 4–8 digits; storage keeps a salt and verifier, never the PIN; unlocked afterwards', async () => {
  assert.equal((await ask({ type: 'crypto:setPin', pin: '12' })).ok, false);
  assert.deepEqual(await ask({ type: 'crypto:setPin', pin: '7391' }), { ok: true });
  const { createdAt, ...sec } = stub.stores.local.security;
  assert.equal(JSON.stringify(sec).includes('7391'), false);
  assert.deepEqual(Object.keys(sec).sort(), ['failedAttempts', 'iterations', 'lockedUntil', 'salt', 'verifier', 'version']);
  assert.equal((await ask({ type: 'crypto:status' })).unlocked, true);
  assert.equal((await ask({ type: 'crypto:setPin', pin: '1111' })).error, 'A PIN is already set.');
});

test('a private note is ciphertext at rest: no title, no body, nowhere in storage', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  const n = await privateNote();
  assert.ok(n?.enc);
  const dump = JSON.stringify(stub.stores.local);
  assert.equal(dump.includes('Salary') || dump.includes('10%'), false);
  const r = await ask({ type: 'crypto:decrypt', items: [{ id: n.id, enc: n.enc }, { id: 'bad', enc: { iv: 'AAAA', ct: 'AAAA' } }] });
  assert.deepEqual(r.plain, { [n.id]: { title: 'Salary talk', body: 'Ask for 10%' }, bad: null });
});

test('wrong PIN: refused, counted, still locked', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  await ask({ type: 'crypto:lock' });
  assert.deepEqual(await ask({ type: 'crypto:unlock', pin: '0000' }), { ok: false, error: 'Wrong PIN.', failedAttempts: 1, lockedUntil: 0 });
  assert.equal((await ask({ type: 'crypto:status' })).unlocked, false);
  assert.deepEqual(await ask({ type: 'crypto:encrypt', title: 't', body: 'b' }), { ok: false, locked: true });
  assert.deepEqual(await ask({ type: 'crypto:unlock', pin: '7391' }), { ok: true });
  assert.equal(stub.stores.local.security.failedAttempts, 0, 'a right PIN resets the count');
});

test('lockout escalates 30 s → 1 m → 5 m → 15 m; while locked even the right PIN is refused and not tried', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  await ask({ type: 'crypto:lock' });
  const waits = [];
  for (let i = 0; i < 9; i++) {
    const r = await ask({ type: 'crypto:unlock', pin: '0000' });
    waits.push(r.lockedUntil ? r.lockedUntil - Date.now() : 0);
    later(Math.max(0, r.lockedUntil - Date.now()) + 1);
  }
  assert.deepEqual(waits.map((w) => Math.round(w / 1000)), [0, 0, 0, 0, 30, 60, 300, 900, 900]);
  await ask({ type: 'crypto:unlock', pin: '0000' });
  const refused = await ask({ type: 'crypto:unlock', pin: '7391' });
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'Too many wrong PINs.');
  assert.equal(stub.stores.local.security.failedAttempts, 10, 'a refused try is not counted');
  later(900e3 + 1);
  assert.deepEqual(await ask({ type: 'crypto:unlock', pin: '7391' }), { ok: true });
});

test('changing or removing the PIN goes through the same lockout (no side door for guessing)', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  for (let i = 0; i < 5; i++) await ask({ type: 'crypto:changePin', pin: '0000', next: '1234' });
  assert.equal((await ask({ type: 'crypto:removePin', pin: '7391' })).error, 'Too many wrong PINs.');
  assert.equal(stub.stores.local.security.failedAttempts, 5);
  assert.ok(stub.stores.local.security, 'the PIN is still there');
});

test('the key is dropped on lock, after 5 idle minutes, and when the worker restarts', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  later(4 * 60e3);
  assert.equal((await ask({ type: 'crypto:encrypt', title: '', body: 'x' })).ok, true, 'use within 5 minutes keeps it');
  later(4 * 60e3);
  assert.equal((await ask({ type: 'crypto:status' })).unlocked, true, 'idle counts from the last use');
  later(60e3 + 1);
  assert.deepEqual(await ask({ type: 'crypto:encrypt', title: '', body: 'x' }), { ok: false, locked: true });
  await ask({ type: 'crypto:unlock', pin: '7391' });
  assert.deepEqual(await ask({ type: 'crypto:lock' }), { ok: true });
  assert.equal((await ask({ type: 'crypto:status' })).unlocked, false);
  await ask({ type: 'crypto:unlock', pin: '7391' });
  const fresh = await import('../../src/background/crypto-broker.js?restart');
  assert.deepEqual(await fresh.handle({ type: 'crypto:status' }, PAGE), { ok: true, hasPin: true, unlocked: false, lockedUntil: 0, failedAttempts: 0 });
});

test('change PIN re-encrypts every private note; the old PIN stops working', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  const n = await privateNote();
  assert.ok(n);
  const before = stub.stores.local.notes[0].enc.ct;
  assert.equal((await ask({ type: 'crypto:changePin', pin: '7391', next: '12' })).ok, false, 'a bad new PIN changes nothing');
  assert.deepEqual(await ask({ type: 'crypto:changePin', pin: '7391', next: '24680' }), { ok: true });
  const [after] = await getNotes();
  assert.ok(after?.enc && after.enc.ct !== before);
  await ask({ type: 'crypto:lock' });
  assert.equal((await ask({ type: 'crypto:unlock', pin: '7391' })).ok, false);
  assert.equal((await ask({ type: 'crypto:unlock', pin: '24680' })).ok, true);
  const r = await ask({ type: 'crypto:decrypt', items: [{ id: n.id, enc: after.enc }] });
  assert.deepEqual(r.plain[n.id], { title: 'Salary talk', body: 'Ask for 10%' });
});

test('remove PIN: the right PIN turns private notes back into plain ones and deletes the record', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  await privateNote();
  assert.equal((await ask({ type: 'crypto:removePin', pin: '1111' })).error, 'Wrong PIN.');
  assert.deepEqual(await ask({ type: 'crypto:removePin', pin: '7391' }), { ok: true });
  const [n] = await getNotes();
  assert.deepEqual(n && { title: n.title, body: n.body, enc: n.enc }, { title: 'Salary talk', body: 'Ask for 10%', enc: null });
  assert.equal('security' in stub.stores.local, false);
  assert.equal((await ask({ type: 'crypto:status' })).hasPin, false);
});

test('only extension pages may ask: a content script or a stranger is refused', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  const page = { id: 'weekly', url: 'https://example.com/', tab: { id: 4 } };
  assert.deepEqual(await ask({ type: 'crypto:encrypt', title: 't', body: 'b' }, page), { ok: false, error: 'Not allowed.' });
  assert.deepEqual(await ask({ type: 'crypto:status' }, { id: 'other-extension', url: 'chrome-extension://other/x.html' }), { ok: false, error: 'Not allowed.' });
  assert.deepEqual(await ask({ type: 'crypto:nope' }), { ok: false, error: 'Unknown request.' });
});
```

In `test/background/service-worker.test.js`, replace:

```js
  assert.equal(stub.stores.local.notes?.length, 1);
});

```

with:

```js
  assert.equal(stub.stores.local.notes?.length, 1);
});

test('crypto:* messages are answered asynchronously by the PIN broker (the listener keeps the channel open)', async () => {
  /** @type {unknown[]} */
  const answers = [];
  /** @type {unknown[]} */
  const kept = [];
  const page = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/app/app.html' };
  for (const fn of stub.log.listeners['runtime.onMessage'] ?? []) kept.push(fn({ type: 'crypto:status' }, page, (/** @type {unknown} */ r) => answers.push(r)));
  await settle();
  assert.deepEqual(kept, [true]);
  assert.deepEqual(answers, [{ ok: true, hasPin: false, unlocked: false, lockedUntil: 0, failedAttempts: 0 }]);
});

```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/background/crypto-broker.test.js test/background/service-worker.test.js`

Expected: `crypto-broker.test.js` fails to load (`Cannot find module '…/src/background/crypto-broker.js'`), and `crypto:* messages are answered asynchronously by the PIN broker (the listener keeps the channel open)` fails (`kept` is `[false]`, no answer); `# fail 2`.

- [ ] **Step 3: `transformNotes` in the store**

In `src/lib/notes.js`, replace:

```js
    return result;
  });
```

with:

```js
    return result;
  });
}

/**
 * Rewrite every note under the lock with async work in between: the worker's PIN
 * change re-encrypts each private note. `fn` may await crypto, but must not call
 * another function in this module (Web Locks are not re-entrant). `also` is
 * written in the same set() call, so the notes and the PIN record never disagree.
 * When `fn` throws, nothing is written.
 * @param {(notes: Note[]) => Promise<{ notes: Note[], also?: Record<string, unknown> }>} fn
 * @returns {Promise<void>}
 */
export function transformNotes(fn) {
  return withLock(NOTES_LOCK, async () => {
    const { notes, also = {} } = await fn((await read()).notes);
    await chrome.storage.local.set({ [KEY]: notes, ...also });
  });
```

- [ ] **Step 4: Write the broker**

Create `src/background/crypto-broker.js`:

```js
/**
 * The PIN broker for private notes (F3; spec §4, §5 crypto:* messages).
 *
 * The derived key lives only in this module's memory: never on disk, never in a
 * page. It is dropped on Lock, after 5 minutes without a private-note action,
 * and whenever Chrome stops the worker (a restart loads this module afresh).
 * Pages ask for encrypt/decrypt over runtime messages; encryption is brokered here
 * because crypto.subtle is missing on plain http:// pages (ForgetMeNot's reason).
 *
 * Every request runs in one queue, so two unlock attempts cannot race the
 * failure count and a PIN change is never interleaved with an encryption.
 * Only this worker writes the `security` record.
 */
import { isValidPin, createSecurity, verify, coerceSecurity, afterFailure, afterSuccess, lockedFor, sealNote, openNote } from '../lib/crypto.js';
import { transformNotes, coerceCipher, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../lib/notes.js';

/** @typedef {import('../lib/crypto.js').Security} Security */
/** @typedef {import('../lib/notes.js').Note} Note */
/** @typedef {Record<string, unknown>} Msg */
/** @typedef {{ ok: boolean } & Record<string, unknown>} Reply */

export const IDLE_MS = 5 * 60_000;
const KEY = 'security';
const DECRYPT_MAX = 2000;

/** @type {CryptoKey | null} */
let key = null;
let lastUse = 0;
/** @type {Promise<unknown>} */
let queue = Promise.resolve();

/** @returns {Promise<Security | null>} */
const readSecurity = async () => coerceSecurity((await chrome.storage.local.get(KEY))[KEY]);
/** @param {Security} sec */
const writeSecurity = (sec) => chrome.storage.local.set({ [KEY]: sec });
/** @param {unknown} v @param {number} max */
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** The key if the session is still live. `use` restarts the 5-minute idle clock. */
function liveKey(use = true) {
  if (key && Date.now() - lastUse > IDLE_MS) key = null;
  if (key && use) lastUse = Date.now();
  return key;
}
/** @param {CryptoKey} k */
const keep = (k) => { key = k; lastUse = Date.now(); };
export const lock = () => { key = null; };

/**
 * Every PIN check (unlock, change, remove) goes through here, so the lockout
 * cannot be sidestepped. While locked out the PIN is not even tried.
 * @param {unknown} pin @returns {Promise<{ ok: true, key: CryptoKey } | Reply>}
 */
async function checkPin(pin) {
  if (!isValidPin(pin)) return { ok: false, error: 'Enter your PIN: 4 to 8 digits.' };
  const sec = await readSecurity();
  if (!sec) return { ok: false, error: 'No PIN is set.' };
  const now = Date.now();
  if (lockedFor(sec, now) > 0) return { ok: false, error: 'Too many wrong PINs.', lockedUntil: sec.lockedUntil };
  const k = await verify(pin, sec);
  if (!k) {
    const next = afterFailure(sec, now);
    await writeSecurity(next);
    return { ok: false, error: 'Wrong PIN.', failedAttempts: next.failedAttempts, lockedUntil: next.lockedUntil };
  }
  if (sec.failedAttempts || sec.lockedUntil) await writeSecurity(afterSuccess(sec));
  return { ok: true, key: k };
}

/** @returns {Promise<Reply>} */
async function status() {
  const sec = await readSecurity();
  return { ok: true, hasPin: !!sec, unlocked: !!liveKey(false), lockedUntil: sec?.lockedUntil ?? 0, failedAttempts: sec?.failedAttempts ?? 0 };
}

/** @param {Msg} m @returns {Promise<Reply>} */
async function setPin(m) {
  if (!isValidPin(m['pin'])) return { ok: false, error: 'A PIN is 4 to 8 digits.' };
  if (await readSecurity()) return { ok: false, error: 'A PIN is already set.' };
  const sec = await createSecurity(m['pin']);
  const k = await verify(m['pin'], sec);
  if (!k) return { ok: false, error: 'The PIN could not be set up.' };
  await writeSecurity(sec);
  keep(k);
  return { ok: true };
}

/** @param {Msg} m @returns {Promise<Reply>} */
async function unlock(m) {
  const r = await checkPin(m['pin']);
  if (!('key' in r)) return r;
  keep(/** @type {CryptoKey} */ (r.key));
  return { ok: true };
}

/** @param {Msg} m @returns {Promise<Reply>} */
async function encryptNote(m) {
  const k = liveKey();
  if (!k) return { ok: false, locked: true };
  return { ok: true, enc: await sealNote(k, { title: text(m['title'], NOTE_TITLE_MAX), body: text(m['body'], NOTE_BODY_MAX) }) };
}

/** @param {Msg} m @returns {Promise<Reply>} */
async function decryptNotes(m) {
  const k = liveKey();
  if (!k) return { ok: false, locked: true };
  /** @type {Record<string, import('../lib/crypto.js').Plain | null>} */
  const plain = {};
  for (const item of (Array.isArray(m['items']) ? m['items'] : []).slice(0, DECRYPT_MAX)) {
    const id = typeof item?.id === 'string' ? item.id : '';
    const enc = coerceCipher(item?.enc);
    if (!id) continue;
    plain[id] = enc ? await openNote(k, enc).catch(() => null) : null;
  }
  return { ok: true, plain };
}

/**
 * Re-encrypt (or, with `to` null, decrypt) every private note in one locked write.
 * One note that cannot be opened aborts the whole change: nothing is written.
 * @param {CryptoKey} from @param {CryptoKey | null} to @param {Record<string, unknown>} also
 */
const rekey = (from, to, also) => transformNotes(async (notes) => {
  /** @type {Note[]} */
  const out = [];
  for (const n of notes) {
    if (!n.enc) { out.push(n); continue; }
    const plain = await openNote(from, n.enc).catch(() => { throw new Error('A private note could not be read, so nothing was changed.'); });
    out.push(to ? { ...n, enc: await sealNote(to, plain) } : { ...n, ...plain, enc: null });
  }
  return { notes: out, also };
});

/** @param {Msg} m @returns {Promise<Reply>} */
async function changePin(m) {
  if (!isValidPin(m['next'])) return { ok: false, error: 'The new PIN must be 4 to 8 digits.' };
  const r = await checkPin(m['pin']);
  if (!('key' in r)) return r;
  const sec = await createSecurity(m['next']);
  const next = await verify(m['next'], sec);
  if (!next) return { ok: false, error: 'The new PIN could not be set up.' };
  await rekey(/** @type {CryptoKey} */ (r.key), next, { [KEY]: sec });
  keep(next);
  return { ok: true };
}

/** Private notes become plain first, then the record goes: a stop in between loses nothing. @param {Msg} m @returns {Promise<Reply>} */
async function removePin(m) {
  const r = await checkPin(m['pin']);
  if (!('key' in r)) return r;
  await rekey(/** @type {CryptoKey} */ (r.key), null, {});
  await chrome.storage.local.remove(KEY);
  lock();
  return { ok: true };
}

/** @type {Record<string, (m: Msg) => Promise<Reply>>} */
const OPS = {
  'crypto:status': status, 'crypto:setPin': setPin, 'crypto:changePin': changePin, 'crypto:removePin': removePin,
  'crypto:unlock': unlock, 'crypto:lock': async () => { lock(); return { ok: true }; },
  'crypto:encrypt': encryptNote, 'crypto:decrypt': decryptNotes,
};

/** Only Weekly's own pages: never a content script in a web page, never another extension. @param {chrome.runtime.MessageSender} sender */
const fromExtensionPage = (sender) => sender?.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));

/**
 * Answer one crypto:* message, after every earlier one.
 * @param {unknown} msg @param {chrome.runtime.MessageSender} sender @returns {Promise<Reply>}
 */
export function handle(msg, sender) {
  const m = /** @type {Msg} */ (typeof msg === 'object' && msg !== null ? msg : {});
  const type = String(m['type']);
  const op = Object.hasOwn(OPS, type) ? OPS[type] : undefined;
  const run = async () => (!fromExtensionPage(sender) ? { ok: false, error: 'Not allowed.' }
    : op ? op(m) : { ok: false, error: 'Unknown request.' });
  const p = queue.then(run);
  queue = p.catch(() => undefined);
  return p;
}
```

- [ ] **Step 5: Route `crypto:*` in the worker's one message listener**

In `src/background/service-worker.js`, replace:

```js
import * as reminders from './reminders.js';
import { getSettings, onSettingsChanged } from '../lib/settings.js';
```

with:

```js
import * as reminders from './reminders.js';
import * as broker from './crypto-broker.js';
import { getSettings, onSettingsChanged } from '../lib/settings.js';
```

In `src/background/service-worker.js`, replace:

```js
// The reminder window and Settings ask the worker for what only it does: the window and the alarms.
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  const type = /** @type {{ type?: unknown }} */ (msg)?.type;
```

with:

```js
// Pages ask the worker for what only it does: the reminder window, the alarms, and the PIN key (crypto:*).
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const type = /** @type {{ type?: unknown }} */ (msg)?.type;
  // The broker answers after an await, so the channel stays open (return true). Its errors go back to the page in words.
  if (typeof type === 'string' && type.startsWith('crypto:')) {
    broker.handle(msg, sender).then(respond, (e) => respond({ ok: false, error: String(e?.message ?? e) }));
    return true;
  }
```

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run e2e`

Expected: `# tests 276`, `# pass 276`, `# fail 0` in each timezone (+9 broker, +1 worker); typecheck clean; `200/200 passed` (the worker now loads the broker; nothing visible changes).

---

### Task 5: Notes in the side panel and the app, with 7-day insights (F1, F2, F5)

One notes view, mounted twice: the side panel's **Notes** tab (spec §3.1, between Today and Week) and the app's **Notes** view at full width (§3.2) with the 7-day insights beside it (F5). Quick add (title, body, category, optional day), search over title and body, category filter, pin, done, edit in a dialog, delete with Undo. The view re-renders from `onNotesChanged`, so the panel, the app and the report agree without reloads. Private notes arrive in Task 6; the card already shows a private note as "🔒 Private note" with no words (F8) in case one exists.

**Files:**
- Create: `src/ui/components/note-actions.js`, `note-card.js`, `note-editor.js`, `note-insights.js`, `notes-view.js`, `notes.css`
- Create: `src/ui/panel/notes-tab.js`
- Modify: `src/ui/panel/panel.js`, `src/ui/panel/panel.html`
- Modify: `src/ui/app/app.html`, `src/ui/app/app.js`, `src/ui/app/app.css`
- Modify: `test/e2e/notes.mjs`, `test/e2e/full.mjs`

**Interfaces:**
- Consumes (Task 1): `getNotes`, `onNotesChanged`, `filterNotes`, `insights`, `createNote`, `updateNote`, `deleteNote`, `restoreNote`, `togglePinned`, `toggleDone`, `CATEGORIES`, `NOTE_TITLE_MAX`, `NOTE_BODY_MAX`. (Phase 2b): `h`, `clear` (`dom.js`), `toast`, `report` (`undo.js`), `TABS` (`panel.js`), the app's `View` / `show()` / `route()`.
- Produces:
  - `mountNotes(host, { onRender?(notes) }) → NotesView = { refresh, focusSearch, focusAdd }` (`components/notes-view.js`). Ids inside: `#noteTitle`, `#noteBody`, `#noteNewCat`, `#noteDay`, `#noteQ`, `#noteCat`, `#noteList` (cards are `li.note[data-id]` with `.pin`, `.edit`, `.delete` buttons and a done checkbox).
  - `noteCard(note, { plain?, onEdit })` (`note-card.js`); `openNoteEditor(note, plain, save)` (`note-editor.js`; dialog `#noteEditor` with `#neTitle`, `#neBody`, `#neCategory`, `#neDay`, `#neSave`); `add`, `pin`, `done`, `save`, `remove` (`note-actions.js`; each says a failure in the toast, `remove` offers Undo); `renderInsights(host, notes)` (`note-insights.js`; `.ins-day[data-iso]` with `.ins-n` = `created/done`).
  - `TABS` is Today, Notes, Week; the app routes `#notes` to `#view-notes` (`#notesHost` + `#insights`).
  - `test/e2e/notes.mjs` exports `notesTabChecks(t, pan)` and `notesViewChecks(t, pan)`.

- [ ] **Step 1: The note card, actions, editor and insights**

Create `src/ui/components/note-actions.js`:

```js
// Every note write the screens make. A failed write is said in the toast
// (spec §6); a delete offers Undo (like tasks, D6). Screens re-render from
// onNotesChanged, never by patching the DOM after a write.
import { createNote, updateNote, deleteNote, restoreNote, togglePinned, toggleDone } from '../../lib/notes.js';
import { toast, report } from './undo.js';

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/notes.js').NoteDraft} NoteDraft */

/**
 * @template {unknown[]} A
 * @param {(...args: A) => Promise<unknown>} fn
 * @returns {(...args: A) => Promise<boolean>} false (after telling the user) when the write failed
 */
const guarded = (fn) => async (...args) => {
  try { await fn(...args); return true; } catch (e) { report(e); return false; }
};

/** @param {NoteDraft} draft @returns {Promise<boolean>} false when nothing was saved (blank, or a failure) */
export async function add(draft) {
  try { return (await createNote(draft)) !== null; } catch (e) { report(e); return false; }
}

export const pin = guarded(/** @param {Note} n */ (n) => togglePinned(n.id));
export const done = guarded(/** @param {Note} n */ (n) => toggleDone(n.id));
// What the editor sends is a draft; updateNote validates it (coerceNote) before it is stored.
export const save = guarded(/** @param {string} id @param {NoteDraft} patch */ (id, patch) => updateNote(id, /** @type {Partial<Note>} */ (patch)));
export const remove = guarded(/** @param {Note} n */ async (n) => {
  const gone = await deleteNote(n.id);
  if (gone) toast('Note deleted.', () => restoreNote(gone));
});
```

Create `src/ui/components/note-card.js`:

```js
// One note: done box, title, body, meta line, pin, edit and delete (F1, F2).
// A private note shows neither its title nor its body until the page holds it
// unlocked (F8): while locked it is only "Private note". Text only, via h().
import { h } from './dom.js';
import { shortDate } from '../../lib/dates.js';
import * as act from './note-actions.js';

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/notes.js').Plain} Plain */

/** @param {Note} n @param {{ plain?: Plain | null, onEdit: (n: Note) => void }} o @returns {HTMLLIElement} */
export function noteCard(n, o) {
  const locked = n.enc !== null && !o.plain;
  const title = locked ? 'Private note' : o.plain?.title ?? n.title;
  const body = locked ? '' : o.plain?.body ?? n.body;
  // The accessible name never carries a locked note's words.
  const name = (title || body).split('\n')[0]?.slice(0, 60) || 'note';
  const meta = [n.category, n.day && shortDate(n.day), n.enc && (locked ? 'Locked' : 'Private'), n.pinned && 'Pinned'].filter(Boolean).join(' · ');
  return h('li', { class: ['note', n.pinned && 'pinned', n.done && 'is-done', n.enc && 'private'].filter(Boolean).join(' '), dataset: { id: n.id } },
    h('input', { type: 'checkbox', checked: n.done, attrs: { 'aria-label': `Done: ${name}` }, on: { change: () => void act.done(n) } }),
    h('div', { class: 'n-main' },
      h('span', { class: 'n-title' }, n.enc ? '🔒 ' : '', title || body),
      title && body ? h('span', { class: 'n-body' }, body) : null,
      h('span', { class: 'n-meta' }, meta)),
    h('div', { class: 'n-acts' },
      h('button', { class: 'quiet pin', attrs: { 'aria-pressed': String(n.pinned), 'aria-label': `${n.pinned ? 'Unpin' : 'Pin'}: ${name}` },
        on: { click: () => void act.pin(n) } }, n.pinned ? '★' : '☆'),
      h('button', { class: 'quiet edit', attrs: { 'aria-label': `Edit: ${name}` }, on: { click: () => o.onEdit(n) } }, 'Edit'),
      h('button', { class: 'quiet danger delete', attrs: { 'aria-label': `Delete: ${name}` }, on: { click: () => void act.remove(n) } }, '✕')));
}
```

Create `src/ui/components/note-editor.js`:

```js
// Edit a note's title, body, category and day (F2). One <dialog>, built once
// with h() the first time it is needed; the caller decides how to save (a
// private note is sealed by the worker before it is stored).
import { h } from './dom.js';
import { CATEGORIES, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../../lib/notes.js';

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/notes.js').Plain} Plain */
/** @typedef {{ title: string, body: string, category: string, day: string | null }} Edit */

/** @type {{ dlg: HTMLDialogElement, title: HTMLInputElement, body: HTMLTextAreaElement, category: HTMLSelectElement, day: HTMLInputElement } | null} */
let ui = null;
/** @type {((e: Edit) => void) | null} */
let onSave = null;

function build() {
  const title = h('input', { type: 'text', id: 'neTitle', maxLength: NOTE_TITLE_MAX });
  const body = h('textarea', { id: 'neBody', rows: 8, maxLength: NOTE_BODY_MAX });
  const category = h('select', { id: 'neCategory' }, CATEGORIES.map((c) => h('option', { value: c }, c)));
  const day = h('input', { type: 'date', id: 'neDay' });
  const dlg = h('dialog', { id: 'noteEditor', attrs: { 'aria-labelledby': 'neHead' } },
    h('form', { method: 'dialog' },
      h('h2', { id: 'neHead' }, 'Edit note'),
      h('label', { class: 'field' }, 'Title', title),
      h('label', { class: 'field' }, 'Note', body),
      h('label', { class: 'field' }, 'Category', category),
      h('label', { class: 'field' }, 'Day (optional)', day),
      h('div', { class: 'dlg-foot' },
        h('button', { value: 'cancel', formNoValidate: true }, 'Cancel'),
        h('button', { value: 'save', class: 'primary', id: 'neSave' }, 'Save'))));
  dlg.addEventListener('close', () => {
    const save = onSave;
    onSave = null;
    if (save && dlg.returnValue === 'save') save({ title: title.value, body: body.value, category: category.value, day: day.value || null });
  });
  document.body.append(dlg);
  return { dlg, title, body, category, day };
}

/**
 * @param {Note} n @param {Plain | null} plain the unlocked words of a private note
 * @param {(e: Edit) => void} save called only when the user saves
 */
export function openNoteEditor(n, plain, save) {
  ui ??= build();
  ui.title.value = plain?.title ?? n.title;
  ui.body.value = plain?.body ?? n.body;
  ui.category.value = n.category;
  ui.day.value = n.day ?? '';
  onSave = save;
  ui.dlg.returnValue = '';   // Esc keeps the last returnValue; never let it read as "save"
  if (!ui.dlg.open) ui.dlg.showModal();
  ui.title.focus();
}
```

Create `src/ui/components/note-insights.js`:

```js
// The 7-day insights (F5): notes created and done per local day, oldest first.
// Counts only, so private notes are counted without being read.
import { h, clear } from './dom.js';
import { insights } from '../../lib/notes.js';
import { today, fromISODate } from '../../lib/dates.js';

/** @typedef {import('../../lib/notes.js').Note} Note */

/** @param {string} iso */
const short = (iso) => fromISODate(iso)?.toLocaleDateString(undefined, { weekday: 'short' }) ?? iso;

/** @param {HTMLElement} host @param {Note[]} notes */
export function renderInsights(host, notes) {
  const r = insights(notes, today());
  const max = Math.max(1, ...r.days.map((d) => Math.max(d.created, d.done)));
  /** @param {number} n */
  const pct = (n) => `${Math.round((n / max) * 100)}%`;
  clear(host);
  host.append(h('h3', {}, 'Last 7 days'),
    h('p', { class: 'ins-sum' }, `${r.created} created · ${r.done} done · ${r.open} open · ${r.pinned} pinned`),
    h('div', { class: 'ins-days' }, r.days.map((d) => h('div', { class: 'ins-day', dataset: { iso: d.iso },
      attrs: { role: 'img', 'aria-label': `${short(d.iso)}: ${d.created} created, ${d.done} done` } },
    h('span', { class: 'ins-bars' }, h('i', { class: 'c', style: { height: pct(d.created) } }), h('i', { class: 'd', style: { height: pct(d.done) } })),
    h('span', { class: 'ins-n' }, `${d.created}/${d.done}`),
    h('span', { class: 'ins-name' }, short(d.iso))))),
    h('p', { class: 'hint' }, h('i', { class: 'key c' }), ' created ', h('i', { class: 'key d' }), ' done'));
}
```

- [ ] **Step 2: The notes view and its styles**

Create `src/ui/components/notes-view.js`:

```js
// The notes list (spec §3.1 Notes, §3.2; F1, F2): quick add, search, category
// filter, pin, done, edit and delete. The side panel's Notes tab and the app's
// Notes view both mount it. It re-renders from onNotesChanged, so a note saved in
// one page, in the worker or on a web page shows everywhere at once.
import { h, clear } from './dom.js';
import { getNotes, onNotesChanged, filterNotes, CATEGORIES, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../../lib/notes.js';
import { noteCard } from './note-card.js';
import { openNoteEditor } from './note-editor.js';
import * as act from './note-actions.js';

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {{ refresh: () => void, focusSearch: () => void, focusAdd: () => void }} NotesView */

/** @param {string} id @param {string} label @param {boolean} all */
const categorySelect = (id, label, all) => h('select', { id, attrs: { 'aria-label': label } },
  all ? h('option', { value: 'all' }, 'All categories') : null, CATEGORIES.map((c) => h('option', { value: c }, c)));

function addForm() {
  const title = h('input', { type: 'text', id: 'noteTitle', maxLength: NOTE_TITLE_MAX, placeholder: 'Title (optional)', attrs: { 'aria-label': 'Note title' } });
  const body = h('textarea', { id: 'noteBody', rows: 3, maxLength: NOTE_BODY_MAX, placeholder: 'Write a note…', attrs: { 'aria-label': 'Note' } });
  const category = categorySelect('noteNewCat', 'Category', false);
  const day = h('input', { type: 'date', id: 'noteDay', attrs: { 'aria-label': 'Attach to a day (optional)' } });
  const form = h('form', { class: 'note-add', on: { submit: (/** @type {SubmitEvent} */ e) => {
    e.preventDefault();
    void act.add({ title: title.value, body: body.value, category: category.value, day: day.value || null })
      .then((ok) => { if (ok) { title.value = ''; body.value = ''; day.value = ''; body.focus(); } });
  } } }, title, body, h('div', { class: 'addrow' }, category, day, h('button', { class: 'primary' }, 'Add note')));
  // ⌘/Ctrl+Enter saves from the body, where Enter is a new line.
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
  return { form, body };
}

/** @param {Note} n */
const edit = (n) => openNoteEditor(n, null, (e) => void act.save(n.id, e));

/**
 * @param {HTMLElement} host
 * @param {{ onRender?: (notes: Note[]) => void }} [opts] e.g. the app's insights
 * @returns {NotesView}
 */
export function mountNotes(host, opts = {}) {
  /** @type {Note[]} */
  let notes = [];
  const q = h('input', { type: 'search', id: 'noteQ', placeholder: 'Search notes', autocomplete: 'off', attrs: { 'aria-label': 'Search notes' } });
  const cat = categorySelect('noteCat', 'Show category', true);
  const list = h('ul', { id: 'noteList', class: 'notelist' });
  const add = addForm();
  const render = () => {
    const shown = filterNotes(notes, { q: q.value, category: cat.value });
    clear(list);
    if (!shown.length) list.append(h('li', { class: 'none' }, notes.length ? 'Nothing matches.' : 'No notes yet.'));
    else list.append(...shown.map((n) => noteCard(n, { onEdit: edit })));
    opts.onRender?.(notes);
  };
  q.addEventListener('input', render);
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape' && q.value) { q.value = ''; render(); } });
  cat.addEventListener('change', render);
  host.append(add.form, h('div', { class: 'note-tools' }, q, cat), list);
  onNotesChanged((next) => { notes = next; render(); });
  void getNotes().then((next) => { notes = next; render(); });
  return { refresh: render, focusSearch: () => q.focus(), focusAdd: () => add.body.focus() };
}
```

Create `src/ui/components/notes.css`:

```css
/* Notes (spec §3.1, §3.2): the add form, the list, the cards, insights. Weekly's
   language: ledger rules, navy for actions, the yellow marker for pinned and done. */
.note-add { display: grid; gap: 6px; }
.note-add textarea { resize: vertical; }
.note-add .addrow { flex-wrap: wrap; align-items: center; }
.note-add .addrow button { margin-left: auto; }
.note-tools { display: flex; gap: 8px; }
.note-tools input { flex: 1; min-width: 0; }
.notelist { list-style: none; margin: 0; padding: 0; }
.note { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 8px; align-items: start;
  padding: 8px 0 8px 6px; border-bottom: 1px solid var(--rule); border-left: 3px solid transparent; }
.note.pinned { border-left-color: var(--marker); }
.note input[type=checkbox] { margin-top: 3px; }
.n-main { display: grid; min-width: 0; gap: 2px; }
.n-title { font-weight: 600; overflow-wrap: anywhere; white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.n-body { white-space: pre-line; overflow-wrap: anywhere; color: var(--ink); font-size: 13px; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.n-meta { color: var(--muted); font-size: 12px; }
.note.is-done .n-title { color: var(--muted); text-decoration: line-through; text-decoration-color: var(--marker); text-decoration-thickness: 2px; }
.note.private .n-title { font-style: italic; }
.n-acts { display: flex; gap: 2px; }
.n-acts .pin[aria-pressed="true"] { color: var(--marker-ink); background: var(--marker-wash); }
.insights h3 { font: 600 15px/1.3 var(--serif); margin: 0 0 4px; border-bottom: 2px solid var(--ink); }
.ins-sum { margin: 6px 0; font-size: 13px; }
.ins-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; align-items: end; }
.ins-day { display: grid; justify-items: center; gap: 2px; font-size: 11px; color: var(--muted); }
.ins-bars { display: flex; gap: 2px; align-items: end; height: 64px; }
.ins-bars i, .key { display: inline-block; width: 8px; min-height: 2px; border-radius: 2px 2px 0 0; }
.key { height: 8px; }
.ins-bars .c, .key.c { background: var(--navy); }
.ins-bars .d, .key.d { background: var(--marker); }
.ins-n { font-variant-numeric: tabular-nums; color: var(--ink); }
```

- [ ] **Step 3: The side panel's Notes tab, at index 1 of `TABS`**

Create `src/ui/panel/notes-tab.js`:

```js
// Notes tab (spec §3.1): the shared notes list, in the panel's narrow column.
import { mountNotes } from '../components/notes-view.js';

/** @type {import('../components/notes-view.js').NotesView | null} */
let view = null;

/** @param {HTMLElement} host */
export function mount(host) { view = mountNotes(host); }
export function refresh() { view?.refresh(); }
export const focusAdd = () => view?.focusAdd();
```

In `src/ui/panel/panel.js`, replace:

```js
// The side panel (spec §3.1). Tabs are a list: Phase 4 adds Notes by appending
// one entry to TABS. Each tab mounts once into its own tabpanel and keeps
```

with:

```js
// The side panel (spec §3.1). Tabs are a list, in the spec's order: Today, Notes, Week. Each tab mounts once into its own tabpanel and keeps
```

In `src/ui/panel/panel.js`, replace:

```js
import * as weekTab from './week-tab.js';
import * as footer from './footer.js';
```

with:

```js
import * as weekTab from './week-tab.js';
import * as notesTab from './notes-tab.js';
import * as footer from './footer.js';
```

In `src/ui/panel/panel.js`, replace:

```js
  { id: 'today', label: 'Today', mount: todayTab.mount, refresh: todayTab.refresh },
  { id: 'week', label: 'Week', mount: weekTab.mount, refresh: weekTab.refresh },
```

with:

```js
  { id: 'today', label: 'Today', mount: todayTab.mount, refresh: todayTab.refresh },
  { id: 'notes', label: 'Notes', mount: notesTab.mount, refresh: notesTab.refresh },
  { id: 'week', label: 'Week', mount: weekTab.mount, refresh: weekTab.refresh },
```

In `src/ui/panel/panel.html`, replace:

```html
<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../components/tasks.css"><link rel="stylesheet" href="panel.css"></head>
```

with:

```html
<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../components/tasks.css"><link rel="stylesheet" href="../components/notes.css"><link rel="stylesheet" href="panel.css"></head>
```

- [ ] **Step 4: The app's Notes view and its route**

In `src/ui/app/app.html`, replace:

```html
<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../components/tasks.css"><link rel="stylesheet" href="app.css"></head>
```

with:

```html
<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../components/tasks.css"><link rel="stylesheet" href="../components/notes.css"><link rel="stylesheet" href="app.css"></head>
```

In `src/ui/app/app.html`, replace:

```html
    <button id="nav-tasks" data-view="tasks">Tasks</button>
    <a id="nav-report" href="../report/report.html">Week report</a>
```

with:

```html
    <button id="nav-tasks" data-view="tasks">Tasks</button>
    <button id="nav-notes" data-view="notes">Notes</button>
    <a id="nav-report" href="../report/report.html">Week report</a>
```

In `src/ui/app/app.html`, replace:

```html
  </section>
</main>
```

with:

```html
  </section>

  <section id="view-notes" class="view notes-view" aria-label="Notes" hidden>
    <div id="notesHost" class="notes-main"></div>
    <aside id="insights" class="insights" aria-label="Notes in the last 7 days"></aside>
  </section>
</main>
```

In `src/ui/app/app.js`, replace:

```js
// Hash routes: #calendar (default), #tasks, #day=YYYY-MM-DD (opens that day's sheet).
```

with:

```js
// Hash routes: #calendar (default), #tasks, #notes, #day=YYYY-MM-DD (opens that day's sheet).
```

In `src/ui/app/app.js`, replace:

```js

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {'calendar' | 'tasks'} View */
```

with:

```js
import { mountNotes } from '../components/notes-view.js';
import { renderInsights } from '../components/note-insights.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {'calendar' | 'tasks' | 'notes'} View */
```

In `src/ui/app/app.js`, replace:

```js
  else tasksView.render(state.tasks);
```

with:

```js
  else if (state.view === 'tasks') tasksView.render(state.tasks);
```

In `src/ui/app/app.js`, replace:

```js
  for (const v of /** @type {View[]} */ (['calendar', 'tasks'])) {
```

with:

```js
  for (const v of /** @type {View[]} */ (['calendar', 'tasks', 'notes'])) {
```

In `src/ui/app/app.js`, replace:

```js
  show(location.hash === '#tasks' ? 'tasks' : 'calendar');
```

with:

```js
  show(location.hash === '#tasks' ? 'tasks' : location.hash === '#notes' ? 'notes' : 'calendar');
```

In `src/ui/app/app.js`, replace:

```js
  editor.init();
  bindKeys({
```

with:

```js
  editor.init();
  // Notes keep themselves current; the insights redraw with them (F5).
  mountNotes($('#notesHost'), { onRender: (notes) => renderInsights($('#insights'), notes) });
  bindKeys({
```

In `src/ui/app/app.css`, replace:

```css
.field { display: grid; gap: 4px; margin-top: 10px; font-size: 13px; color: var(--muted); }

```

with:

```css
.field { display: grid; gap: 4px; margin-top: 10px; font-size: 13px; color: var(--muted); }
.notes-view:not([hidden]) { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 28px; align-items: start; }
.notes-main { display: grid; gap: 12px; }
@media (max-width: 760px) { .notes-view:not([hidden]) { grid-template-columns: 1fr; } }

```

- [ ] **Step 5: Run the unit gate**

Run: `npm test && npm run typecheck`

Expected: `# tests 276` in each timezone, all passing (this task's checks are end to end); typecheck clean.

- [ ] **Step 6: End-to-end checks for the Notes tab and the Notes view**

The app page used by the task checks is closed by then, so `notesViewChecks` opens its own.

In `test/e2e/notes.mjs`, replace:

```js
}

```

with:

```js
}

const byTitle = async (store, title) => ((await store()).notes ?? []).find(n => n.title === title);
const card = (page, text) => page.locator('#noteList li.note', { hasText: text });

// The side panel's Notes tab (spec §3.1; F1, F2).
export async function notesTabChecks(t, pan) {
  const { check, store, wait, iso } = t;
  await pan.bringToFront(); await pan.reload(); await wait(600);
  check('Notes', 'Notes tab sits between Today and Week', (await pan.locator('#tabs button').allTextContents()).join(',') === 'Today,Notes,Week');
  await pan.click('#tab-notes'); await wait(200);
  await pan.fill('#noteTitle', 'Vendor call'); await pan.fill('#noteBody', 'Ask about SSO pricing'); await pan.selectOption('#noteNewCat', 'Work');
  await pan.click('#panel-notes .note-add button.primary'); await wait(400);
  const v = await byTitle(store, 'Vendor call');
  check('Notes', 'quick add: title, body and category (F1)', v?.body === 'Ask about SSO pricing' && v.category === 'Work' && v.day === null && v.enc === null && await card(pan, 'Vendor call').count() === 1, JSON.stringify(v));
  await pan.fill('#noteBody', 'Whiteboard session with design'); await pan.fill('#noteDay', iso.today); await pan.press('#noteBody', 'Control+Enter'); await wait(400);
  const w = ((await store()).notes ?? []).find(n => n.body === 'Whiteboard session with design');
  check('Notes', 'a note attached to a day; Ctrl+Enter adds it', w?.day === iso.today && w.title === '', JSON.stringify(w));
  await pan.fill('#noteQ', 'sso'); await wait(200);
  check('Notes', 'search covers the body (F2)', await pan.locator('#noteList li.note').count() === 1 && await card(pan, 'Vendor call').count() === 1);
  await pan.fill('#noteQ', 'VENDOR'); await wait(200);
  check('Notes', 'search covers the title, any case (F2)', await card(pan, 'Vendor call').count() === 1 && await card(pan, 'Whiteboard').count() === 0);
  await pan.press('#noteQ', 'Escape'); await pan.selectOption('#noteCat', 'Idea'); await wait(200);
  check('Notes', 'category filter (F1)', /Nothing matches/.test(await pan.textContent('#noteList')));
  await pan.selectOption('#noteCat', 'all'); await wait(200);
  await card(pan, 'Vendor call').locator('button.pin').click(); await wait(400);
  check('Notes', 'pin puts a note first (F2)', (await byTitle(store, 'Vendor call')).pinned === true && /Vendor call/.test(await pan.locator('#noteList li.note').first().textContent()));
  await card(pan, 'Vendor call').locator('input[type=checkbox]').check(); await wait(400);
  const d = await byTitle(store, 'Vendor call');
  check('Notes', 'mark done (F2)', d.done === true && typeof d.completedAt === 'number' && await card(pan, 'Vendor call').evaluate(el => el.classList.contains('is-done')));
  await card(pan, 'Vendor call').locator('button.edit').click(); await wait(200);
  await pan.fill('#neTitle', 'Vendor call (Okta)'); await pan.selectOption('#neCategory', 'Idea'); await pan.click('#neSave'); await wait(400);
  const e = await byTitle(store, 'Vendor call (Okta)');
  check('Notes', 'edit title and category (F2)', e?.category === 'Idea' && e.body === 'Ask about SSO pricing' && e.id === v?.id, JSON.stringify(e));
  await card(pan, 'Whiteboard').locator('button.delete').click(); await wait(400);
  const gone = !((await store()).notes ?? []).some(n => n.id === w?.id);
  await pan.click('.toast button'); await wait(400);
  check('Notes', 'delete, then Undo brings it back with its id (F2)', gone && ((await store()).notes ?? []).some(n => n.id === w?.id));
  const { unlabeled } = await import('./panel.mjs');
  check('Layout', 'every Notes-tab control has a label', (await unlabeled(pan)).length === 0, (await unlabeled(pan)).join(', '));
}

// The app's Notes view and the 7-day insights (spec §3.2; F5).
export async function notesViewChecks(t, pan) {
  const { ctx, X, check, watch, store, wait, PAGES, iso } = t;
  const app = watch(await ctx.newPage());
  await app.goto(`${X}/${PAGES.app}#notes`); await wait(800);
  check('App', '#notes opens the Notes view', await app.isVisible('#view-notes') && await app.getAttribute('#nav-notes', 'aria-current') === 'page' && await card(app, 'Vendor call (Okta)').count() === 1);
  const notes = (await store()).notes ?? [];
  const dk = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const want = `${notes.filter(n => dk(n.createdAt) === iso.today).length}/${notes.filter(n => n.done && dk(n.completedAt) === iso.today).length}`;
  const got = await app.textContent(`#insights .ins-day[data-iso="${iso.today}"] .ins-n`);
  check('Notes', '7-day insights: today’s notes created and done (F5)', got === want && await app.locator('#insights .ins-day').count() === 7, `${got} vs ${want}`);
  await app.fill('#noteBody', 'Added in the app'); await app.click('#notesHost .note-add button.primary'); await wait(600);
  check('Notes', 'the app and the side panel stay in step', await card(pan, 'Added in the app').count() === 1 && (await app.textContent(`#insights .ins-day[data-iso="${iso.today}"] .ins-n`)) !== got);
  const unl = await app.evaluate(() => [...document.querySelectorAll('#view-notes input,#view-notes select,#view-notes textarea,#view-notes button')]
    .filter(el => el.offsetParent && !(el.labels?.length) && !el.getAttribute('aria-label') && !el.textContent.trim() && !el.placeholder).map(el => el.id || el.outerHTML.slice(0, 60)));
  check('Layout', 'every app Notes control has a label', unl.length === 0, unl.join(', '));
  await app.close();
}

```

In `test/e2e/full.mjs`, replace:

```js
await taskEditChecks(harness, app);

```

with:

```js
await taskEditChecks(harness, app);
const { notesTabChecks, notesViewChecks } = await import('./notes.mjs');
await notesTabChecks(harness, pan);
await notesViewChecks(harness, pan);

```

Run: `npm run e2e`

Expected: `215/215 passed`. The 15 new checks: `[Notes] Notes tab sits between Today and Week`; `quick add: title, body and category (F1)`; `a note attached to a day; Ctrl+Enter adds it`; `search covers the body (F2)`; `search covers the title, any case (F2)`; `category filter (F1)`; `pin puts a note first (F2)`; `mark done (F2)`; `edit title and category (F2)`; `delete, then Undo brings it back with its id (F2)`; `[Layout] every Notes-tab control has a label`; `[App] #notes opens the Notes view`; `[Notes] 7-day insights: today’s notes created and done (F5)`; `[Notes] the app and the side panel stay in step`; `[Layout] every app Notes control has a label`.

---

### Task 6: Private notes in the UI, and the Notes PIN in Settings (F3, F8)

Pages never hold the key. `components/private.js` asks the worker to unlock, seal and open; it keeps opened words in page memory only (keyed by note id and IV, so a note edited elsewhere is opened afresh) and forgets them on **Lock**, when the worker announces a change it does not share, or after 5 minutes without a private-note action. The worker now broadcasts `{ type: 'crypto:changed' }` after set, unlock, lock, change and remove (never with a PIN, key or text), so every open page re-asks `crypto:status`: lock in the panel, and the app tab hides its private words too.

In the notes view: a **🔒 Private** box in the add form and a **Lock / Unlock private notes** button, both shown only once a PIN exists; the unlock dialog (`components/pin-dialog.js`) says a wrong PIN and the lockout in words; the editor gains a **Private** box (make a note private, or plain again). While locked a private note shows only "🔒 Private note" (F8) and matches no search; unlocked, its title (never its body) is searchable (F2).

In the report's Settings, a **Notes PIN** group (`pin-settings.js`, following `reminder-settings.js`): Set, Change, Remove, each asking the worker at once. Typing the current PIN is the confirmation for Remove.

**Files:**
- Create: `src/ui/components/private.js`, `src/ui/components/pin-dialog.js`, `src/ui/report/pin-settings.js`
- Modify: `src/background/crypto-broker.js` (the broadcast)
- Modify (rewritten whole; both are new in this phase): `src/ui/components/notes-view.js`, `src/ui/components/note-editor.js`
- Modify: `src/ui/components/notes.css`, `src/ui/panel/notes-tab.js`, `src/ui/report/report.html`, `src/ui/report/report.css`, `src/ui/report/main.js`
- Modify: `test/helpers/chrome-stub.js` (`log.messages`), `test/background/crypto-broker.test.js`
- Modify: `test/e2e/notes.mjs`, `test/e2e/full.mjs`

**Interfaces:**
- Consumes (Task 4): the `crypto:*` messages. (Task 5): `mountNotes`, `noteCard(n, { plain, onEdit })`, `note-actions`.
- Produces:
  - `src/ui/components/private.js`: `ask(type, payload?) → Reply`, `explain(reply) → string`, `sync()`, `unlock(pin)`, `lock()`, `openAll(notes)`, `seal(plain) → Reply` (`enc` on success), `plainOf(note) → Plain | null`, `pinState() → { hasPin, unlocked }`, `onPrivateChange(cb)`.
  - `askPin() → Promise<boolean>` (`pin-dialog.js`; `#unlockDialog`, `#unlockPin`, `#unlockGo`, `#unlockErr`).
  - `openNoteEditor(note, plain, canPrivate, save)`; `Edit` gains `private: boolean` (`#nePrivate`).
  - The notes view adds `#notePrivate` and `#noteLock`; `NotesView.refresh` now returns a promise.
  - Broadcast: `{ type: 'crypto:changed' }` from the worker after a successful set, unlock, lock, change or remove.
  - Report: `#pinState`, `#pinCurrent`, `#pinNew`, `#pinSet`, `#pinChange`, `#pinRemove`, `#pinMsg`.
  - `test/helpers/chrome-stub.js`: `runtime.sendMessage` records into `log.messages`.
  - `test/e2e/notes.mjs` exports `pinSetChecks`, `privateNoteChecks`, `pinChangeChecks`, each `(t, rep, pan)`.

- [ ] **Step 1: Write the failing test**

In `test/helpers/chrome-stub.js`, replace:

```js
    panelsOpened: /** @type {object[]} */ ([]),
    /** Event listeners registered, keyed by event path. */
```

with:

```js
    panelsOpened: /** @type {object[]} */ ([]),
    /** Messages the code sent with runtime.sendMessage (the worker's broadcasts). */
    messages: /** @type {unknown[]} */ ([]),
    /** Event listeners registered, keyed by event path. */
```

In `test/helpers/chrome-stub.js`, replace:

```js
      sendMessage: async () => ({ ok: true }),
```

with:

```js
      sendMessage: async (m) => { log.messages.push(m); return { ok: true }; },
```

In `test/background/crypto-broker.test.js`, replace:

```js
  assert.deepEqual(await ask({ type: 'crypto:nope' }), { ok: false, error: 'Unknown request.' });
});

```

with:

```js
  assert.deepEqual(await ask({ type: 'crypto:nope' }), { ok: false, error: 'Unknown request.' });
});

test('open pages hear when the PIN state changes (set, unlock, lock, change, remove), so they can hide or show private notes', async () => {
  stub.log.messages.length = 0;
  await ask({ type: 'crypto:setPin', pin: '7391' });
  await ask({ type: 'crypto:lock' });
  await ask({ type: 'crypto:unlock', pin: '0000' });
  await ask({ type: 'crypto:unlock', pin: '7391' });
  await ask({ type: 'crypto:changePin', pin: '7391', next: '2468' });
  await ask({ type: 'crypto:removePin', pin: '2468' });
  await ask({ type: 'crypto:status' });
  assert.equal(stub.log.messages.length, 5, 'a wrong PIN and a status read change nothing');
  assert.ok(stub.log.messages.every((m) => JSON.stringify(m) === '{"type":"crypto:changed"}'), 'no PIN, key or note text is ever broadcast');
});

```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/background/crypto-broker.test.js`

Expected: `not ok … open pages hear when the PIN state changes (set, unlock, lock, change, remove), so they can hide or show private notes` (`0 !== 5`); `# fail 1`.

- [ ] **Step 3: The broadcast**

In `src/background/crypto-broker.js`, replace:

```js

/** Only Weekly's own pages: never a content script in a web page, never another extension. @param {chrome.runtime.MessageSender} sender */
```

with:

```js

// After these succeed, open pages re-ask crypto:status and hide or show private notes.
// The broadcast carries no PIN, key or text; with no page open, sendMessage rejects, which is fine.
const CHANGES = new Set(['crypto:setPin', 'crypto:changePin', 'crypto:removePin', 'crypto:unlock', 'crypto:lock']);
/** @param {string} type @param {Reply} r */
function announce(type, r) {
  if (r.ok && CHANGES.has(type)) chrome.runtime.sendMessage({ type: 'crypto:changed' }).catch(() => undefined);
  return r;
}

/** Only Weekly's own pages: never a content script in a web page, never another extension. @param {chrome.runtime.MessageSender} sender */
```

In `src/background/crypto-broker.js`, replace:

```js
    : op ? op(m) : { ok: false, error: 'Unknown request.' });
```

with:

```js
    : op ? announce(type, await op(m)) : { ok: false, error: 'Unknown request.' });
```

- [ ] **Step 4: The page-side client and the unlock dialog**

Create `src/ui/components/private.js`:

```js
// Private notes in a page (F3, F8). The key never comes here: the page asks the
// worker (crypto:* messages) to unlock, seal and open. Unlocked words are kept
// only in this page's memory, keyed by ciphertext, and forgotten on Lock, when
// the worker reports it is locked, or after 5 minutes without a private-note action.

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/notes.js').Plain} Plain */
/** @typedef {{ ok: boolean, error?: string, locked?: boolean, lockedUntil?: number, failedAttempts?: number } & Record<string, any>} Reply */

const IDLE_MS = 5 * 60_000;
/** @type {Map<string, Plain>} keyed by note id and IV, so an edit elsewhere is opened afresh */
const cache = new Map();
const state = { hasPin: false, unlocked: false };
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;
/** @type {Set<() => void>} */
const listeners = new Set();

/** @param {string} type @param {Record<string, unknown>} [payload] @returns {Promise<Reply>} */
export async function ask(type, payload = {}) {
  try {
    return (await chrome.runtime.sendMessage({ type, ...payload })) ?? { ok: false, error: 'Weekly’s background worker did not answer.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** A reply in plain words. @param {Reply} r */
export function explain(r) {
  if (r.lockedUntil && r.lockedUntil > Date.now()) return `Too many wrong PINs. Try again in ${Math.ceil((r.lockedUntil - Date.now()) / 1000)} s.`;
  return r.error ?? 'Something went wrong.';
}

const changed = () => listeners.forEach((cb) => cb());
function forget() {
  cache.clear();
  state.unlocked = false;
  clearTimeout(timer);
}
/** Each private-note action restarts the page's 5-minute clock, like the worker's. */
function touch() {
  clearTimeout(timer);
  timer = setTimeout(() => void lock(), IDLE_MS);
}

/** @param {Note} n @returns {Plain | null} */
export const plainOf = (n) => (n.enc && state.unlocked ? cache.get(`${n.id}:${n.enc.iv}`) ?? null : null);
export const pinState = () => ({ ...state });
/** @param {() => void} cb */
export const onPrivateChange = (cb) => { listeners.add(cb); };

/** Ask the worker where things stand; forget everything if it is locked. */
export async function sync() {
  const r = await ask('crypto:status');
  state.hasPin = r.hasPin === true;
  if (r.unlocked !== true) forget();
  else state.unlocked = true;
  return state;
}

/** @param {string} pin @returns {Promise<Reply>} */
export async function unlock(pin) {
  const r = await ask('crypto:unlock', { pin });
  if (r.ok) { state.unlocked = true; touch(); }
  return r;
}

export async function lock() {
  forget();
  changed();
  await ask('crypto:lock');
}

/** Open every private note not opened yet. @param {Note[]} notes */
export async function openAll(notes) {
  const items = notes.filter((n) => n.enc && !plainOf(n)).map((n) => ({ id: n.id, enc: n.enc }));
  if (!state.unlocked || !items.length) return;
  const r = await ask('crypto:decrypt', { items });
  if (!r.ok) { forget(); return; }
  for (const n of notes) {
    const p = n.enc ? r['plain']?.[n.id] : null;
    if (n.enc && p) cache.set(`${n.id}:${n.enc.iv}`, p);
  }
  touch();
}

/** Encrypt in the worker. @param {Plain} p @returns {Promise<Reply>} `enc` on success */
export async function seal(p) {
  const r = await ask('crypto:encrypt', { title: p.title, body: p.body });
  if (r.ok) touch(); else if (r.locked) forget();
  return r;
}

// The worker announces set, unlock, lock, change and remove; every open page re-syncs.
chrome.runtime.onMessage.addListener((msg) => {
  if (/** @type {{ type?: unknown }} */ (msg)?.type === 'crypto:changed') void sync().then(changed);
  return false;
});
```

Create `src/ui/components/pin-dialog.js`:

```js
// The unlock dialog (F3): one <dialog>, built once with h(). It resolves true once
// the worker has unlocked, false on Cancel or Esc. A wrong PIN and the lockout are
// said in words; the PIN field is cleared after every try.
import { h } from './dom.js';
import { unlock, explain } from './private.js';

/** @type {{ dlg: HTMLDialogElement, pin: HTMLInputElement, err: HTMLElement } | null} */
let ui = null;
/** @type {((ok: boolean) => void) | null} */
let settle = null;

/** @param {boolean} ok */
function finish(ok) {
  const s = settle;
  settle = null;
  if (ui?.dlg.open) ui.dlg.close();
  s?.(ok);
}

function build() {
  const pin = h('input', { type: 'password', id: 'unlockPin', inputMode: 'numeric', autocomplete: 'off', maxLength: 8, attrs: { 'aria-label': 'PIN' } });
  const err = h('p', { id: 'unlockErr', class: 'msg', attrs: { role: 'alert' } });
  const form = h('form', { on: { submit: async (/** @type {SubmitEvent} */ e) => {
    e.preventDefault();
    const r = await unlock(pin.value);
    pin.value = '';
    if (r.ok) finish(true);
    else { err.textContent = explain(r); pin.focus(); }
  } } },
  h('h2', { id: 'unlockHead' }, 'Unlock private notes'),
  h('p', { class: 'hint' }, 'Your PIN opens private notes until you lock them, or for 5 minutes after you last use one.'),
  pin, err,
  h('div', { class: 'dlg-foot' },
    h('button', { type: 'button', on: { click: () => finish(false) } }, 'Cancel'),
    h('button', { class: 'primary', id: 'unlockGo' }, 'Unlock')));
  const dlg = h('dialog', { id: 'unlockDialog', attrs: { 'aria-labelledby': 'unlockHead' } }, form);
  dlg.addEventListener('close', () => finish(false));
  document.body.append(dlg);
  return { dlg, pin, err };
}

/** @returns {Promise<boolean>} true once unlocked */
export function askPin() {
  ui ??= build();
  ui.err.textContent = '';
  ui.pin.value = '';
  if (!ui.dlg.open) ui.dlg.showModal();
  ui.pin.focus();
  return new Promise((resolve) => { settle = resolve; });
}
```

- [ ] **Step 5: Private notes in the notes view and the editor**

Replace the whole of `src/ui/components/notes-view.js` with:

```js
// The notes list (spec §3.1 Notes, §3.2; F1–F3, F8): quick add, search, category
// filter, pin, done, edit, delete, and private notes behind the PIN. The side
// panel's Notes tab and the app's Notes view both mount it. It re-renders from
// onNotesChanged and from the worker's crypto:changed, so every open page agrees.
import { h, clear } from './dom.js';
import { getNotes, onNotesChanged, filterNotes, CATEGORIES, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../../lib/notes.js';
import { noteCard } from './note-card.js';
import { openNoteEditor } from './note-editor.js';
import { askPin } from './pin-dialog.js';
import { report } from './undo.js';
import * as act from './note-actions.js';
import * as priv from './private.js';

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('./note-editor.js').Edit} Edit */
/** @typedef {{ refresh: () => Promise<void>, focusSearch: () => void, focusAdd: () => void }} NotesView */

/** @param {string} id @param {string} label @param {boolean} all */
const categorySelect = (id, label, all) => h('select', { id, attrs: { 'aria-label': label } },
  all ? h('option', { value: 'all' }, 'All categories') : null, CATEGORIES.map((c) => h('option', { value: c }, c)));

const ensureUnlocked = async () => priv.pinState().unlocked || askPin();

/**
 * A draft ready to store. A private one is sealed by the worker first, so its
 * title and body never reach storage. Null when blank or when it could not be sealed.
 * @param {Edit} e @returns {Promise<import('../../lib/notes.js').NoteDraft | null>}
 */
async function prepare(e) {
  if (!e.title.trim() && !e.body.trim()) return null;
  if (!e.private) return { title: e.title, body: e.body, category: e.category, day: e.day, enc: null };
  if (!(await ensureUnlocked())) return null;
  const r = await priv.seal({ title: e.title.trim(), body: e.body.trim() });
  if (!r.ok) { report(new Error(priv.explain(r))); return null; }
  return { category: e.category, day: e.day, enc: r['enc'] };
}

/** @param {Note} n */
async function edit(n) {
  if (n.enc && !(await ensureUnlocked())) return;
  if (n.enc) await priv.openAll([n]);
  const plain = priv.plainOf(n);
  if (n.enc && !plain) { report(new Error('This private note could not be opened.')); return; }
  openNoteEditor(n, plain, priv.pinState().hasPin, (e) => void prepare(e).then((d) => d && act.save(n.id, d)));
}

function addForm() {
  const title = h('input', { type: 'text', id: 'noteTitle', maxLength: NOTE_TITLE_MAX, placeholder: 'Title (optional)', attrs: { 'aria-label': 'Note title' } });
  const body = h('textarea', { id: 'noteBody', rows: 3, maxLength: NOTE_BODY_MAX, placeholder: 'Write a note…', attrs: { 'aria-label': 'Note' } });
  const category = categorySelect('noteNewCat', 'Category', false);
  const day = h('input', { type: 'date', id: 'noteDay', attrs: { 'aria-label': 'Attach to a day (optional)' } });
  const isPrivate = h('input', { type: 'checkbox', id: 'notePrivate' });
  const privRow = h('label', { class: 'check', hidden: true }, isPrivate, ' 🔒 Private');
  const submit = async () => {
    const d = await prepare({ title: title.value, body: body.value, category: category.value, day: day.value || null, private: isPrivate.checked });
    if (d && await act.add(d)) { title.value = ''; body.value = ''; day.value = ''; body.focus(); }
  };
  const form = h('form', { class: 'note-add', on: { submit: (/** @type {SubmitEvent} */ e) => { e.preventDefault(); void submit(); } } },
    title, body, h('div', { class: 'addrow' }, category, day, privRow, h('button', { class: 'primary' }, 'Add note')));
  // ⌘/Ctrl+Enter saves from the body, where Enter is a new line.
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
  return { form, body, privRow };
}

/**
 * @param {HTMLElement} host
 * @param {{ onRender?: (notes: Note[]) => void }} [opts] e.g. the app's insights
 * @returns {NotesView}
 */
export function mountNotes(host, opts = {}) {
  /** @type {Note[]} */
  let notes = [];
  const q = h('input', { type: 'search', id: 'noteQ', placeholder: 'Search notes', autocomplete: 'off', attrs: { 'aria-label': 'Search notes' } });
  const cat = categorySelect('noteCat', 'Show category', true);
  const list = h('ul', { id: 'noteList', class: 'notelist' });
  const add = addForm();
  const lockBtn = h('button', { type: 'button', id: 'noteLock', class: 'quiet', hidden: true });
  const draw = () => {
    const { hasPin, unlocked } = priv.pinState();
    lockBtn.hidden = add.privRow.hidden = !hasPin;
    lockBtn.textContent = unlocked ? 'Lock private notes' : 'Unlock private notes';
    const plain = new Map(notes.flatMap((n) => { const p = priv.plainOf(n); return p ? [[n.id, p]] : []; }));
    const shown = filterNotes(notes, { q: q.value, category: cat.value, plain });
    clear(list);
    if (!shown.length) list.append(h('li', { class: 'none' }, notes.length ? 'Nothing matches.' : 'No notes yet.'));
    else list.append(...shown.map((n) => noteCard(n, { plain: priv.plainOf(n), onEdit: (x) => void edit(x) })));
    opts.onRender?.(notes);
  };
  const reopen = () => priv.openAll(notes).then(draw);
  const refresh = () => priv.sync().then(reopen);
  lockBtn.addEventListener('click', () => void (priv.pinState().unlocked ? priv.lock() : askPin().then((ok) => { if (ok) return reopen(); })));
  q.addEventListener('input', draw);
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape' && q.value) { q.value = ''; draw(); } });
  cat.addEventListener('change', draw);
  host.append(add.form, h('div', { class: 'note-tools' }, q, cat, lockBtn), list);
  onNotesChanged((next) => { notes = next; void reopen(); });
  priv.onPrivateChange(() => void reopen());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh(); });
  void getNotes().then((next) => { notes = next; return refresh(); });
  return { refresh, focusSearch: () => q.focus(), focusAdd: () => add.body.focus() };
}
```

Replace the whole of `src/ui/components/note-editor.js` with:

```js
// Edit a note's title, body, category, day and privacy (F2, F3). One <dialog>, built once
// with h() the first time it is needed; the caller decides how to save (a
// private note is sealed by the worker before it is stored).
import { h } from './dom.js';
import { CATEGORIES, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../../lib/notes.js';

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/notes.js').Plain} Plain */
/** @typedef {{ title: string, body: string, category: string, day: string | null, private: boolean }} Edit */

/** @type {{ dlg: HTMLDialogElement, title: HTMLInputElement, body: HTMLTextAreaElement, category: HTMLSelectElement, day: HTMLInputElement, priv: HTMLInputElement } | null} */
let ui = null;
/** @type {((e: Edit) => void) | null} */
let onSave = null;

function build() {
  const title = h('input', { type: 'text', id: 'neTitle', maxLength: NOTE_TITLE_MAX });
  const body = h('textarea', { id: 'neBody', rows: 8, maxLength: NOTE_BODY_MAX });
  const category = h('select', { id: 'neCategory' }, CATEGORIES.map((c) => h('option', { value: c }, c)));
  const day = h('input', { type: 'date', id: 'neDay' });
  const priv = h('input', { type: 'checkbox', id: 'nePrivate' });
  const dlg = h('dialog', { id: 'noteEditor', attrs: { 'aria-labelledby': 'neHead' } },
    h('form', { method: 'dialog' },
      h('h2', { id: 'neHead' }, 'Edit note'),
      h('label', { class: 'field' }, 'Title', title),
      h('label', { class: 'field' }, 'Note', body),
      h('label', { class: 'field' }, 'Category', category),
      h('label', { class: 'field' }, 'Day (optional)', day),
      h('label', { class: 'check', id: 'nePrivateRow' }, priv, ' Private: locked with your PIN'),
      h('div', { class: 'dlg-foot' },
        h('button', { value: 'cancel', formNoValidate: true }, 'Cancel'),
        h('button', { value: 'save', class: 'primary', id: 'neSave' }, 'Save'))));
  dlg.addEventListener('close', () => {
    const save = onSave;
    onSave = null;
    if (save && dlg.returnValue === 'save') save({ title: title.value, body: body.value, category: category.value, day: day.value || null, private: priv.checked });
  });
  document.body.append(dlg);
  return { dlg, title, body, category, day, priv };
}

/**
 * @param {Note} n @param {Plain | null} plain the unlocked words of a private note
 * @param {boolean} canPrivate a PIN is set, so the note may be made private (or plain again)
 * @param {(e: Edit) => void} save called only when the user saves
 */
export function openNoteEditor(n, plain, canPrivate, save) {
  ui ??= build();
  ui.title.value = plain?.title ?? n.title;
  ui.body.value = plain?.body ?? n.body;
  ui.category.value = n.category;
  ui.day.value = n.day ?? '';
  ui.priv.checked = n.enc !== null;
  ui.priv.closest('label')?.toggleAttribute('hidden', !canPrivate);
  onSave = save;
  ui.dlg.returnValue = '';   // Esc keeps the last returnValue; never let it read as "save"
  if (!ui.dlg.open) ui.dlg.showModal();
  ui.title.focus();
}
```

In `src/ui/components/notes.css`, replace:

```css
.ins-n { font-variant-numeric: tabular-nums; color: var(--ink); }

```

with:

```css
.ins-n { font-variant-numeric: tabular-nums; color: var(--ink); }
.note-add .check, #nePrivateRow { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; color: var(--ink); }
#nePrivateRow { margin-top: 10px; }
dialog input[type=password] { font: inherit; width: 100%; padding: 6px 8px; border: 1px solid var(--rule-strong);
  border-radius: 4px; background: var(--sheet); color: var(--ink); letter-spacing: 0.3em; }

```

In `src/ui/panel/notes-tab.js`, replace:

```js
export function refresh() { view?.refresh(); }
```

with:

```js
export function refresh() { void view?.refresh(); }
```

- [ ] **Step 6: The Notes PIN group in Settings**

Create `src/ui/report/pin-settings.js`:

```js
// Settings → Notes PIN (spec §3.2; F3): set, change, remove. Not saved with the
// form: each button asks the worker at once, which alone holds the key and writes
// the PIN record. The PIN fields are cleared after every try.
import { $ } from '../components/dom.js';
import { ask, explain } from '../components/private.js';

async function show() {
  const s = await ask('crypto:status');
  $('#pinState').textContent = s.hasPin ? 'A PIN is set. Private notes are encrypted with it.' : 'No PIN yet. Set one to keep private notes.';
  $('#pinCurrent').closest('label').hidden = !s.hasPin;
  $('#pinSet').hidden = !!s.hasPin;
  $('#pinChange').hidden = $('#pinRemove').hidden = !s.hasPin;
}

async function run(type, payload, ok) {
  const r = await ask(type, payload);
  $('#pinCurrent').value = ''; $('#pinNew').value = '';
  $('#pinMsg').textContent = r.ok ? ok : explain(r);
  await show();
}

export function init() {
  $('#pinSet').onclick = () => run('crypto:setPin', { pin: $('#pinNew').value }, 'PIN set. Tick “Private” on a note to lock it.');
  $('#pinChange').onclick = () => run('crypto:changePin', { pin: $('#pinCurrent').value, next: $('#pinNew').value }, 'PIN changed. Private notes now open with the new one.');
  // Typing the current PIN is the confirmation: nobody removes it by a stray click.
  $('#pinRemove').onclick = () => run('crypto:removePin', { pin: $('#pinCurrent').value }, 'PIN removed. Your private notes are ordinary notes now.');
  chrome.runtime.onMessage.addListener(msg => { if (msg?.type === 'crypto:changed') void show(); return false; });
  void show();
}
```

In `src/ui/report/report.html`, replace:

```html
      <fieldset>
        <legend>Sharing</legend>
```

with:

```html
      <fieldset>
        <legend>Notes PIN</legend>
        <p id="pinState" class="hint"></p>
        <label>Current PIN <input id="pinCurrent" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
        <label>New PIN (4 to 8 digits) <input id="pinNew" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
        <div class="row">
          <button id="pinSet" type="button">Set PIN</button>
          <button id="pinChange" type="button">Change PIN</button>
          <button id="pinRemove" type="button" class="danger">Remove PIN</button>
        </div>
        <p id="pinMsg" class="msg" role="status"></p>
        <p class="hint">Private notes are encrypted on this computer with your PIN. Weekly never stores the PIN, so a forgotten PIN cannot be recovered. Five wrong tries pause unlocking for 30 seconds, then longer. Removing the PIN turns private notes back into ordinary ones.</p>
      </fieldset>
      <fieldset>
        <legend>Sharing</legend>
```

In `src/ui/report/report.css`, replace:

```css
input[type=time] { font: inherit; color: var(--ink); background: var(--sheet); border: 1px solid var(--rule-strong); border-radius: 4px; padding: 4px 6px; margin-top: 10px; }
```

with:

```css
input[type=time], input[type=password] { font: inherit; color: var(--ink); background: var(--sheet); border: 1px solid var(--rule-strong); border-radius: 4px; padding: 4px 6px; margin-top: 10px; }
```

In `src/ui/report/main.js`, replace:

```js
import * as reminderSettings from './reminder-settings.js';
import * as data from './data-panel.js';
```

with:

```js
import * as reminderSettings from './reminder-settings.js';
import * as pinSettings from './pin-settings.js';
import * as data from './data-panel.js';
```

In `src/ui/report/main.js`, replace:

```js
[categories, draft, aiPanel, share, notes, settings, reminderSettings, data, history].forEach((m) => m.init());
```

with:

```js
[categories, draft, aiPanel, share, notes, settings, reminderSettings, pinSettings, data, history].forEach((m) => m.init());
```

- [ ] **Step 7: Run the unit gate**

Run: `npm test && npm run typecheck`

Expected: `# tests 277`, `# pass 277`, `# fail 0` in each timezone; typecheck clean.

- [ ] **Step 8: End-to-end: the PIN round trip**

The checks run after the report's Notes checks, where the report page already accepts dialogs. They set the PIN `7391`, change it to `24680`, and remove it at the end, so the delete-all check still finds no `security` key. The lockout pause is lifted by resetting the record in storage instead of waiting 30 s (the worker reads it afresh on every try).

In `test/e2e/notes.mjs`, replace:

```js
  await app.close();
}

```

with:

```js
  await app.close();
}

const security = async (store) => (await store()).security;
/** The report's Settings (a <details>) are closed again after a reload. */
const openPin = async (rep) => { await rep.bringToFront(); if (!await rep.isVisible('#pinNew')) await rep.click('summary:has-text("Settings")'); };
/** Type a PIN into the unlock dialog and press Unlock. */
const tryPin = async (page, pin, wait) => { await page.fill('#unlockPin', pin); await page.click('#unlockGo'); await wait(700); };

// The PIN in the report's Settings, then a private note in the panel (spec §3.2, §4; F3, F8).
export async function pinSetChecks(t, rep, pan) {
  const { check, store, wait, iso } = t;
  await openPin(rep);
  check('PIN', 'Settings: no PIN yet, so only Set is offered', /No PIN yet/.test(await rep.textContent('#pinState')) && await rep.isVisible('#pinSet') && !(await rep.isVisible('#pinChange')));
  await rep.fill('#pinNew', '7391'); await rep.click('#pinSet'); await wait(1500);
  const { createdAt, ...rest } = (await security(store)) ?? {};
  check('PIN', 'set a PIN: a salt and verifier are stored, never the PIN (F3)', /PIN set/.test(await rep.textContent('#pinMsg')) && rest.iterations === 310000 && typeof rest.salt === 'string' && !JSON.stringify(rest).includes('7391'), JSON.stringify(rest).slice(0, 200));
  await pan.bringToFront(); await pan.click('#tab-notes'); await wait(600);
  check('Private', 'with a PIN set, the panel offers Private and Lock', await pan.isVisible('#notePrivate') && /Lock private notes/.test(await pan.textContent('#noteLock')));
  await pan.fill('#noteTitle', 'Salary talk'); await pan.fill('#noteBody', 'Ask for 10%'); await pan.fill('#noteDay', iso.today); await pan.check('#notePrivate');
  await pan.click('#panel-notes .note-add button.primary'); await wait(800);
  const st = await store(); const p = st.notes.find(n => n.enc);
  check('Private', 'a private note is ciphertext at rest: no title or body anywhere in storage (F3)', p?.title === '' && p.body === '' && p.day === iso.today && !JSON.stringify(st).includes('Salary') && !JSON.stringify(st).includes('Ask for 10'), JSON.stringify(p));
  check('Private', 'unlocked, the panel shows its title and body', /Ask for 10%/.test(await card(pan, 'Salary talk').textContent()));
  await pan.uncheck('#notePrivate');
}

// Lock, search, the draft, a wrong PIN, unlock and edit (F2, F3, F8, W2).
export async function privateNoteChecks(t, rep, pan) {
  const { check, store, wait } = t;
  await pan.click('#noteLock'); await wait(600);
  check('Private', 'Lock hides the title as well as the body (F8)', /Private note/.test(await pan.locator('#noteList li.note.private').textContent()) && await card(pan, 'Salary').count() === 0 && /Unlock/.test(await pan.textContent('#noteLock')));
  check('Private', 'Lock drops the key in the worker', (await pan.evaluate(() => chrome.runtime.sendMessage({ type: 'crypto:status' }))).unlocked === false);
  await pan.fill('#noteQ', 'salary'); await wait(200);
  check('Private', 'a locked note is not found by search (F2)', /Nothing matches/.test(await pan.textContent('#noteList')));
  await pan.fill('#noteQ', '');
  await rep.bringToFront(); await rep.reload(); await wait(1200);
  const md = await rep.inputValue('#md');
  check('Private', 'a private day note never reaches Other work or the draft (W2)', !md.includes('Salary') && !/^- $/m.test(md) && !(await rep.textContent('#notes')).includes('Salary'));
  await pan.bringToFront(); await pan.click('#noteLock'); await wait(300);
  await tryPin(pan, '0000', wait);
  check('Private', 'a wrong PIN is refused and counted', /Wrong PIN/.test(await pan.textContent('#unlockErr')) && (await security(store)).failedAttempts === 1 && await card(pan, 'Salary').count() === 0);
  await tryPin(pan, '7391', wait);
  check('Private', 'the right PIN unlocks; the count is reset', await card(pan, 'Salary talk').count() === 1 && (await security(store)).failedAttempts === 0 && !(await pan.evaluate(() => document.querySelector('#unlockDialog').open)));
  const ct0 = (await store()).notes.find(n => n.enc).enc.ct;
  await card(pan, 'Salary talk').locator('button.edit').click(); await wait(300);
  check('Private', 'the editor opens a private note unlocked, marked Private', (await pan.inputValue('#neTitle')) === 'Salary talk' && await pan.isChecked('#nePrivate'));
  await pan.fill('#neBody', 'Ask for 12%'); await pan.click('#neSave'); await wait(800);
  const st = await store();
  check('Private', 'an edited private note is sealed again, still no plain text', st.notes.find(n => n.enc).enc.ct !== ct0 && !JSON.stringify(st).includes('12%') && /Ask for 12%/.test(await card(pan, 'Salary talk').textContent()));
}

// Change PIN, the lockout, remove PIN (spec §3.2; F3).
export async function pinChangeChecks(t, rep, pan) {
  const { sw, check, store, wait } = t;
  const ct0 = (await store()).notes.find(n => n.enc).enc.ct;
  await openPin(rep); await rep.fill('#pinCurrent', '7391'); await rep.fill('#pinNew', '24680'); await rep.click('#pinChange'); await wait(2000);
  check('PIN', 'change PIN re-encrypts private notes (F3)', /PIN changed/.test(await rep.textContent('#pinMsg')) && (await store()).notes.find(n => n.enc).enc.ct !== ct0, await rep.textContent('#pinMsg'));
  await pan.bringToFront(); await pan.click('#noteLock'); await wait(500); await pan.click('#noteLock'); await wait(300);
  for (const pin of ['7391', '1111', '2222', '3333', '4444']) await tryPin(pan, pin, wait);
  const s = await security(store);
  check('PIN', 'the old PIN fails; 5 wrong PINs pause unlocking for 30 s (F3)', s.failedAttempts === 5 && s.lockedUntil - Date.now() > 20000 && /Too many wrong PINs\. Try again in \d+ s/.test(await pan.textContent('#unlockErr')), JSON.stringify({ f: s.failedAttempts, l: s.lockedUntil - Date.now() }));
  await tryPin(pan, '24680', wait);
  check('PIN', 'during the pause even the right PIN is refused, and not counted', /Too many wrong PINs/.test(await pan.textContent('#unlockErr')) && (await security(store)).failedAttempts === 5);
  await pan.keyboard.press('Escape');
  // Lift the pause rather than wait 30 s: the worker reads the record afresh on every try.
  await sw.evaluate(() => chrome.storage.local.get('security').then(({ security: sec }) => chrome.storage.local.set({ security: { ...sec, failedAttempts: 0, lockedUntil: 0 } })));
  await openPin(rep); await rep.fill('#pinCurrent', '24680'); await rep.click('#pinRemove'); await wait(1500);
  const st = await store(); const back = st.notes.find(n => n.title === 'Salary talk');
  check('PIN', 'remove PIN: private notes become ordinary ones and the record is gone (F3)', back?.enc === null && back.body === 'Ask for 12%' && !('security' in st) && /PIN removed/.test(await rep.textContent('#pinMsg')), JSON.stringify(back));
  await wait(300);
  check('Private', 'with no PIN, the panel offers neither Private nor Lock', !(await pan.isVisible('#notePrivate')) && !(await pan.isVisible('#noteLock')));
}

```

In `test/e2e/full.mjs`, replace:

```js
await legacyNoteChecks(harness, rep);
await rep.screenshot({ path: shots + '/3-report.png', fullPage: true });
```

with:

```js
await legacyNoteChecks(harness, rep);
const { pinSetChecks, privateNoteChecks, pinChangeChecks } = await import('./notes.mjs');
await pinSetChecks(harness, rep, pan);
await privateNoteChecks(harness, rep, pan);
await pinChangeChecks(harness, rep, pan);
await rep.screenshot({ path: shots + '/3-report.png', fullPage: true });
```

Run: `npm run e2e`

Expected: `233/233 passed`. The 18 new checks: `[PIN] Settings: no PIN yet, so only Set is offered`; `[PIN] set a PIN: a salt and verifier are stored, never the PIN (F3)`; `[Private] with a PIN set, the panel offers Private and Lock`; `a private note is ciphertext at rest: no title or body anywhere in storage (F3)`; `unlocked, the panel shows its title and body`; `Lock hides the title as well as the body (F8)`; `Lock drops the key in the worker`; `a locked note is not found by search (F2)`; `a private day note never reaches Other work or the draft (W2)`; `a wrong PIN is refused and counted`; `the right PIN unlocks; the count is reset`; `the editor opens a private note unlocked, marked Private`; `an edited private note is sealed again, still no plain text`; `[PIN] change PIN re-encrypts private notes (F3)`; `the old PIN fails; 5 wrong PINs pause unlocking for 30 s (F3)`; `during the pause even the right PIN is refused, and not counted`; `remove PIN: private notes become ordinary ones and the record is gone (F3)`; `[Private] with no PIN, the panel offers neither Private nor Lock`.

---

### Task 7: The on-page note, Alt+N, and the side-panel fallback (F4)

**Permissions (least privilege):** two install-time permissions are added, both listed in spec §3.6: `activeTab` (access to the one tab the user invokes Weekly on, only after the gesture, gone on navigation) and `scripting` (to inject the note into that tab). No `host_permissions`, no `content_scripts`, no `web_accessible_resources` (the styles are inline in the shadow root). Neither shows an install warning. ForgetMeNot used the same pair.

**What activeTab allows:** Chrome grants activeTab for a command (**Alt+N**) but not for a click inside the side panel; with `openPanelOnActionClick` (Phase 2b) not for the toolbar click either. So:
- **Alt+N** injects into the page at once, inside the command's gesture. On Chrome's own pages and the Web Store, where no extension may run, it opens the side panel on **Notes** instead (`sidePanel.open` first, before any await).
- **Note on this page** in the panel footer asks the worker to inject into the active tab of the panel's window. That works where Weekly may already run (a site the user allowed for live statuses through the optional `https://*/*`); elsewhere Chrome refuses, and the panel switches to its Notes tab and says to press Alt+N on the page. This is the spec's "side-panel fallback where injection is blocked".

**The note itself** (`src/content/onpage-note.js`): a classic script (executeScript cannot load modules) in a **closed** shadow root, so the page's scripts cannot reach in and its CSS cannot leak in; nodes are built with `createElement` and `textContent` only. Title, body, category, Save (also Ctrl/⌘+Enter), New, the 8 most recent plain notes (click to edit, ✕ to delete), Esc or ✕ to close; keystrokes in it never reach the page's own shortcuts. Injecting it again toggles it. Its code sits in one block with no top-level names, so a second injection in the same isolated world never redeclares anything. It reads and writes only through `notes:*`; the worker sends it plain notes only, refuses to touch a private one, and ignores any `enc` it sends: private notes never enter a web page's process, locked or not.

**Files:**
- Create: `src/background/onpage.js`, `src/content/onpage-note.js`
- Modify: `manifest.json`, `jsconfig.json`, `scripts/build.mjs`, `src/background/service-worker.js`
- Modify: `src/ui/panel/panel.html`, `src/ui/panel/footer.js`, `src/ui/panel/panel.js`
- Create: `test/background/onpage.test.js`
- Modify: `test/helpers/chrome-stub.js` (`scripting`), `test/background/service-worker.test.js`, `test/manifest.test.js`
- Modify: `test/e2e/notes.mjs`, `test/e2e/full.mjs` (the harness passes `tabs`)

**Interfaces:**
- Consumes (Task 1): `getNotes`, `createNote`, `updateNote`, `deleteNote`, `sortNotes`. (Phase 3): the worker's one `runtime.onMessage` listener and one `commands.onCommand` listener.
- Produces:
  - `src/background/onpage.js`: `CONTENT_SCRIPT = 'src/content/onpage-note.js'`, `canInject(url)`, `inject(tabId) → boolean`, `onNoteCommand(tab)`, `handle(msg, sender) → Reply`.
  - Messages: `notes:list → { ok, notes: {id, title, body, category}[] ≤ 8 }` (plain only, in the notes list’s order); `notes:save { id?, title, body, category } → { ok, id? }`; `notes:delete { id } → { ok }`; `panel:openOnPage { windowId } → { ok }`; `panel:hello → { ok, tab: 'notes' | null }` (once); broadcast `{ type: 'panel:show', tab: 'notes' }`. `panel:*` only from Weekly's pages; `notes:*` from Weekly's pages or its content script.
  - Command `open-note` (Alt+N). Panel: `#noteOnPage`; `footer.init({ showNotes })`.
  - `test/helpers/chrome-stub.js`: `chrome.scripting.executeScript` records into `log.scripts` synchronously; `setInjectFails(bool)`.
  - `test/e2e/notes.mjs` exports `onPageChecks(t, pan)`; the harness has `tabs` (the web pages section 3 opened, by URL).

- [ ] **Step 1: Write the failing tests**

In `test/helpers/chrome-stub.js`, replace:

```js
    messages: /** @type {unknown[]} */ ([]),
    /** Event listeners registered, keyed by event path. */
```

with:

```js
    messages: /** @type {unknown[]} */ ([]),
    /** chrome.scripting.executeScript calls (the on-page note). */
    scripts: /** @type {object[]} */ ([]),
    /** Event listeners registered, keyed by event path. */
```

In `test/helpers/chrome-stub.js`, replace:

```js
  const state = { idle: 'active', focused: true, tab: /** @type {any} */ (null) };
```

with:

```js
  const state = { idle: 'active', focused: true, tab: /** @type {any} */ (null), injectFails: false };
```

In `test/helpers/chrome-stub.js`, replace:

```js
    commands: { onCommand: event('commands.onCommand') },
    action: {
```

with:

```js
    commands: { onCommand: event('commands.onCommand') },
    scripting: {
      // Logged before it settles, so a test can tell it was called inside the command's gesture.
      executeScript(o) {
        log.scripts.push(o);
        return state.injectFails ? Promise.reject(new Error('Cannot access contents of the page.')) : Promise.resolve([]);
      },
    },
    action: {
```

In `test/helpers/chrome-stub.js`, replace:

```js
    setWindowFocused: (f) => { state.focused = f; },
  };
```

with:

```js
    setWindowFocused: (f) => { state.focused = f; },
    setInjectFails: (f) => { state.injectFails = f; },
  };
```

Create `test/background/onpage.test.js`:

```js
// The on-page note's worker side (spec §3.4, §5 notes:* / panel:openOnPage; F4).
// A web page's content script gets plain notes only: private notes never leave
// the extension's own pages, locked or not.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

const stub = installChromeStub();
const onpage = await import('../../src/background/onpage.js');
const { createNote, getNotes } = await import('../../src/lib/notes.js');

const CIPHER = { iv: 'AAAAAAAAAAAAAAAA', ct: 'c2VjcmV0' };
const CONTENT = { id: 'weekly', url: 'https://example.com/page', tab: { id: 5, windowId: 1 } };
/** @param {Record<string, unknown>} msg */
const ask = (msg, sender = CONTENT) => onpage.handle(msg, sender);

beforeEach(() => {
  for (const k of Object.keys(stub.stores.local)) delete stub.stores.local[k];
  stub.log.scripts.length = 0;
  stub.setInjectFails(false);
});

test('which pages can take the note: web and file pages, never Chrome’s own pages or the Web Store', () => {
  for (const ok of ['https://example.com/', 'http://intranet/x', 'file:///Users/me/a.html']) assert.equal(onpage.canInject(ok), true, ok);
  for (const no of ['chrome://settings', 'chrome-extension://abc/x.html', 'https://chromewebstore.google.com/detail/x', 'https://chrome.google.com/webstore/x', 'about:blank', undefined]) {
    assert.equal(onpage.canInject(no), false, String(no));
  }
});

test('notes:list gives the page plain notes only, newest first, at most 8', async () => {
  for (let i = 0; i < 10; i++) await createNote({ title: `Note ${i}` });
  await createNote({ enc: CIPHER });
  const r = await ask({ type: 'notes:list' });
  assert.equal(r.ok, true);
  assert.equal(r.notes.length, 8);
  assert.equal(r.notes[0].title, 'Note 9');
  assert.ok(r.notes.every((/** @type {Record<string, unknown>} */ n) => !('enc' in n)), 'not even the ciphertext');
  assert.deepEqual(Object.keys(r.notes[0]).sort(), ['body', 'category', 'id', 'title']);
});

test('notes:save creates or edits a plain note; it cannot touch a private one or make one', async () => {
  const made = await ask({ type: 'notes:save', title: ' Vendor call ', body: 'SSO', category: 'Work', enc: CIPHER });
  assert.equal(made.ok, true);
  const [n] = await getNotes();
  assert.deepEqual(n && { title: n.title, body: n.body, category: n.category, enc: n.enc }, { title: 'Vendor call', body: 'SSO', category: 'Work', enc: null });
  assert.equal((await ask({ type: 'notes:save', id: made.id, title: 'Vendor call (Okta)', body: 'SSO', category: 'Idea' })).ok, true);
  assert.equal((await getNotes())[0]?.title, 'Vendor call (Okta)');
  const secret = await createNote({ enc: CIPHER });
  assert.deepEqual(await ask({ type: 'notes:save', id: secret?.id, title: 'x', body: 'y' }), { ok: false, error: 'That note can’t be changed here.' });
  assert.equal((await ask({ type: 'notes:save', title: ' ', body: '' })).ok, false, 'a blank note is not stored');
});

test('notes:delete removes a plain note; a private one is refused', async () => {
  const plain = await createNote({ body: 'bye' });
  const secret = await createNote({ enc: CIPHER });
  assert.deepEqual(await ask({ type: 'notes:delete', id: plain?.id }), { ok: true });
  assert.equal((await ask({ type: 'notes:delete', id: secret?.id })).ok, false);
  assert.deepEqual((await getNotes()).map((x) => x.id), [secret?.id]);
});

test('panel:openOnPage injects into the active tab of the panel’s window; a refused page says so', async () => {
  stub.setFocusedTab({ id: 9, windowId: 1, active: true });
  const PANEL = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/panel/panel.html' };
  assert.deepEqual(await ask({ type: 'panel:openOnPage', windowId: 1 }, PANEL), { ok: true });
  assert.deepEqual(stub.log.scripts.at(-1), { target: { tabId: 9 }, files: ['src/content/onpage-note.js'] });
  stub.setInjectFails(true);
  assert.deepEqual(await ask({ type: 'panel:openOnPage', windowId: 1 }, PANEL), { ok: false });
});

test('only Weekly itself may ask: another extension is refused; unknown requests are refused', async () => {
  assert.deepEqual(await ask({ type: 'notes:list' }, { id: 'someone-else', url: 'https://example.com/' }), { ok: false, error: 'Not allowed.' });
  assert.deepEqual(await ask({ type: 'notes:nope' }), { ok: false, error: 'Unknown request.' });
  assert.deepEqual(await ask({ type: 'panel:openOnPage', windowId: 1 }), { ok: false, error: 'Not allowed.' }, 'a web page cannot inject itself elsewhere');
});
```

In `test/background/service-worker.test.js`, replace:

```js
  assert.deepEqual(answers, [{ ok: true, hasPin: false, unlocked: false, lockedUntil: 0, failedAttempts: 0 }]);
});

```

with:

```js
  assert.deepEqual(answers, [{ ok: true, hasPin: false, unlocked: false, lockedUntil: 0, failedAttempts: 0 }]);
});

test('Alt+N on a web page injects the on-page note at once, inside the command’s gesture (F4)', () => {
  stub.log.scripts.length = 0;
  emit('commands.onCommand', 'open-note', { id: 7, windowId: 3, url: 'https://example.com/' });
  assert.deepEqual(stub.log.scripts, [{ target: { tabId: 7 }, files: ['src/content/onpage-note.js'] }], 'called before any await');
});

test('Alt+N where Chrome keeps scripts out opens the side panel on Notes instead (F4 fallback)', async () => {
  stub.log.scripts.length = 0;
  stub.log.panelsOpened.length = 0;
  emit('commands.onCommand', 'open-note', { id: 8, windowId: 4, url: 'chrome://settings/' });
  assert.deepEqual(stub.log.panelsOpened, [{ windowId: 4 }], 'opened at once, inside the gesture');
  assert.equal(stub.log.scripts.length, 0);
  /** @type {unknown[]} */
  const answers = [];
  const panel = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/panel/panel.html' };
  for (const fn of stub.log.listeners['runtime.onMessage'] ?? []) fn({ type: 'panel:hello' }, panel, (/** @type {unknown} */ r) => answers.push(r));
  for (const fn of stub.log.listeners['runtime.onMessage'] ?? []) fn({ type: 'panel:hello' }, panel, (/** @type {unknown} */ r) => answers.push(r));
  await settle();
  assert.deepEqual(answers, [{ ok: true, tab: 'notes' }, { ok: true, tab: null }], 'the panel opens on Notes once');
});

```

In `test/manifest.test.js`, replace:

```js
  assert.equal(manifest.commands?.['open-app']?.suggested_key?.default, 'Alt+Shift+T');
});

```

with:

```js
  assert.equal(manifest.commands?.['open-app']?.suggested_key?.default, 'Alt+Shift+T');
});

test('on-page note: activeTab + scripting and Alt+N, no host permissions or content scripts (spec §3.4, §3.6)', () => {
  assert.ok(manifest.permissions.includes('activeTab') && manifest.permissions.includes('scripting'));
  assert.equal(manifest.commands?.['open-note']?.suggested_key?.default, 'Alt+N');
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined, 'injected on demand only');
});

```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run test:ny 2>&1 | grep -E '^not ok|^# (tests|fail)'`

Expected: `not ok … test/background/onpage.test.js` (`Cannot find module '…/src/background/onpage.js'`), `not ok … Alt+N on a web page injects the on-page note at once, inside the command’s gesture (F4)`, `not ok … Alt+N where Chrome keeps scripts out opens the side panel on Notes instead (F4 fallback)`, `not ok … on-page note: activeTab + scripting and Alt+N, no host permissions or content scripts (spec §3.4, §3.6)`; `# fail 4`.

- [ ] **Step 3: Permissions, the command, and typecheck/build coverage**

In `manifest.json`, replace:

```json
  "permissions": ["tabs", "storage", "unlimitedStorage", "idle", "alarms", "notifications", "sidePanel"],
```

with:

```json
  "permissions": ["tabs", "storage", "unlimitedStorage", "idle", "alarms", "notifications", "sidePanel", "scripting", "activeTab"],
```

In `manifest.json`, replace:

```json
    "open-app": { "suggested_key": { "default": "Alt+Shift+T" }, "description": "Open Weekly in a tab" }
```

with:

```json
    "open-app": { "suggested_key": { "default": "Alt+Shift+T" }, "description": "Open Weekly in a tab" },
    "open-note": { "suggested_key": { "default": "Alt+N" }, "description": "Write a note on this page" }
```

In `jsconfig.json`, replace:

```json
  "include": ["src/lib/**/*.js", "src/background/**/*.js", "src/ui/components/**/*.js", "src/ui/panel/**/*.js", "src/ui/app/**/*.js", "src/ui/remind/**/*.js"]
```

with:

```json
  "include": ["src/lib/**/*.js", "src/background/**/*.js", "src/ui/components/**/*.js", "src/ui/panel/**/*.js", "src/ui/app/**/*.js", "src/ui/remind/**/*.js", "src/content/**/*.js"]
```

In `scripts/build.mjs`, replace:

```js
  for (const [, spec] of src.matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) walk(join(dirname(file), spec));
};
```

with:

```js
  for (const [, spec] of src.matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) walk(join(dirname(file), spec));
  // Scripts the worker injects with chrome.scripting (the on-page note) are named by path, not imported.
  for (const [, injected] of src.matchAll(/['"](src\/content\/[\w./-]+\.js)['"]/g)) refs.push(injected);
};
```

- [ ] **Step 4: The worker side**

Create `src/background/onpage.js`:

```js
/**
 * The on-page note's worker side (spec §3.4, §5; F4).
 *
 * The note is injected on demand into the active tab with `activeTab` +
 * `scripting`: no host permissions and no content script on every page. Chrome
 * grants activeTab for Alt+N (a command), not for a click inside the side panel,
 * so the panel's "Note on this page" works where Weekly already may run (a site
 * the user allowed for live statuses) and otherwise points to Alt+N or the
 * Notes tab. Where Chrome keeps scripts out (its own pages, the Web Store), the
 * side panel opens on Notes instead.
 *
 * The page's script reads and writes notes only through notes:* messages, and
 * only plain ones: private notes never enter a web page's process, locked or not.
 */
import { getNotes, createNote, updateNote, deleteNote, sortNotes } from '../lib/notes.js';

/** @typedef {import('../lib/notes.js').Note} Note */
/** @typedef {Record<string, unknown>} Msg */
/** @typedef {{ ok: boolean } & Record<string, unknown>} Reply */

export const CONTENT_SCRIPT = 'src/content/onpage-note.js';
const LIST_MAX = 8;
const ID = /^[\w-]{1,64}$/;
/** The tab the side panel should show next time it asks (panel:hello). @type {string | null} */
let pendingTab = null;

/** @param {unknown} url */
export const canInject = (url) => typeof url === 'string' && /^(https?|file):/i.test(url)
  && !/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url);

/** @param {number} tabId @returns {Promise<boolean>} */
export async function inject(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] });
    return true;
  } catch (e) {
    console.warn('[weekly] no on-page note here; the side panel’s Notes tab is the fallback', e);
    return false;
  }
}

/** Open the side panel on Notes. sidePanel.open is the first call: it needs the user gesture. @param {number | undefined} windowId */
function openNotesPanel(windowId) {
  if (windowId === undefined) return;
  pendingTab = 'notes';
  chrome.sidePanel.open({ windowId }).catch((e) => console.error('[weekly] side panel', e));
  // A panel that is already open switches at once; one that is opening asks with panel:hello.
  chrome.runtime.sendMessage({ type: 'panel:show', tab: 'notes' }).catch(() => undefined);
}

/**
 * Alt+N. Called straight from commands.onCommand, so nothing is awaited before
 * executeScript or sidePanel.open (the gesture would be gone).
 * @param {chrome.tabs.Tab | undefined} tab
 */
export function onNoteCommand(tab) {
  if (tab?.id === undefined) return;
  if (!canInject(tab.url)) { openNotesPanel(tab.windowId); return; }
  const windowId = tab.windowId;
  // ponytail: a refusal found only after the await (a PDF, an error page) may have lost the gesture; the open is best effort.
  void inject(tab.id).then((ok) => { if (!ok) openNotesPanel(windowId); });
}

/** What a web page may see of a note. @param {Note} n */
const forPage = (n) => ({ id: n.id, title: n.title, body: n.body, category: n.category });
/** @param {unknown} id @returns {Promise<Note | null>} the plain note with this id */
const plainNote = async (id) => (typeof id === 'string' ? (await getNotes()).find((n) => n.id === id && !n.enc) ?? null : null);
const REFUSED = { ok: false, error: 'That note can’t be changed here.' };

/** @param {Msg} m @returns {Promise<Reply>} */
async function save(m) {
  // Only these three fields are read: a page can neither set `enc` nor reach a private note.
  const draft = { title: String(m['title'] ?? ''), body: String(m['body'] ?? ''), category: String(m['category'] ?? 'General') };
  if (m['id'] !== undefined) {
    if (!(await plainNote(m['id']))) return REFUSED;
    // updateNote validates the category (coerceNote), so the page's string is safe to pass.
    return { ok: !!(await updateNote(/** @type {string} */ (m['id']), /** @type {Partial<Note>} */ (/** @type {unknown} */ (draft)))) };
  }
  const n = await createNote(draft);
  return n ? { ok: true, id: n.id } : { ok: false, error: 'Write something first.' };
}

/** @type {Record<string, (m: Msg, sender: chrome.runtime.MessageSender) => Promise<Reply>>} */
const OPS = {
  'notes:list': async () => ({ ok: true, notes: sortNotes((await getNotes()).filter((n) => !n.enc)).slice(0, LIST_MAX).map(forPage) }),
  'notes:save': save,
  'notes:delete': async (m) => ((await plainNote(m['id'])) ? (await deleteNote(/** @type {string} */ (m['id'])), { ok: true }) : REFUSED),
  'panel:openOnPage': async (m) => {
    const [tab] = typeof m['windowId'] === 'number' ? await chrome.tabs.query({ active: true, windowId: m['windowId'] }) : [];
    return { ok: tab?.id !== undefined && await inject(tab.id) };
  },
  'panel:hello': async () => { const tab = pendingTab; pendingTab = null; return { ok: true, tab }; },
};
// Asked by Weekly's own pages only, never by a content script in a web page.
const PAGE_ONLY = new Set(['panel:openOnPage', 'panel:hello']);

/**
 * Answer a notes:* or panel:* message. Only this extension may ask (a content
 * script carries its id); panel:* only from its own pages.
 * @param {unknown} msg @param {chrome.runtime.MessageSender} sender @returns {Promise<Reply>}
 */
export async function handle(msg, sender) {
  const m = /** @type {Msg} */ (typeof msg === 'object' && msg !== null ? msg : {});
  const type = String(m['type']);
  const ours = sender?.id === chrome.runtime.id;
  const page = ours && typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
  if (!ours || (PAGE_ONLY.has(type) && !page)) return { ok: false, error: 'Not allowed.' };
  if (!Object.hasOwn(OPS, type)) return { ok: false, error: 'Unknown request.' };
  if (m['id'] !== undefined && !ID.test(String(m['id']))) return REFUSED;
  return /** @type {(m: Msg, s: chrome.runtime.MessageSender) => Promise<Reply>} */ (OPS[type])(m, sender);
}
```

In `src/background/service-worker.js`, replace:

```js
import * as broker from './crypto-broker.js';
import { getSettings, onSettingsChanged } from '../lib/settings.js';
```

with:

```js
import * as broker from './crypto-broker.js';
import * as onpage from './onpage.js';
import { getSettings, onSettingsChanged } from '../lib/settings.js';
```

In `src/background/service-worker.js`, replace:

```js
  }
  const slot = /** @type {{ slot?: unknown }} */ (msg)?.slot === 'evening' ? 'evening' : 'morning';
```

with:

```js
  }
  // The on-page note's notes:* and the panel's panel:* (spec §3.4, §5), also answered after an await.
  if (typeof type === 'string' && /^(notes|panel):/.test(type)) {
    onpage.handle(msg, sender).then(respond, (e) => respond({ ok: false, error: String(e?.message ?? e) }));
    return true;
  }
  const slot = /** @type {{ slot?: unknown }} */ (msg)?.slot === 'evening' ? 'evening' : 'morning';
```

In `src/background/service-worker.js`, replace:

```js
// Keyboard commands (D10): Alt+T opens the side panel, Alt+Shift+T the app on its Tasks view.
// sidePanel.open must run inside the command's user gesture, so it is called at once, not queued.
```

with:

```js
// Keyboard commands (D10, F4): Alt+T opens the side panel, Alt+Shift+T the app on its Tasks view, Alt+N
// the on-page note. sidePanel.open and executeScript must run inside the command's user gesture, so they are called at once, not queued.
```

In `src/background/service-worker.js`, replace:

```js
  if (command === 'open-app') chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/app/app.html#tasks') }).catch(fail);
});
```

with:

```js
  if (command === 'open-app') chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/app/app.html#tasks') }).catch(fail);
  if (command === 'open-note') onpage.onNoteCommand(tab);
});
```

- [ ] **Step 5: The on-page note**

Create `src/content/onpage-note.js`:

```js
// The on-page note (spec §3.4; F4): a floating note panel on the page you are on,
// injected only when you ask (Alt+N, or "Note on this page" where Weekly may run).
//
// A self-contained classic script (chrome.scripting.executeScript cannot load
// modules). It lives in a *closed* Shadow DOM, so the page's own scripts and
// styles cannot reach into it, and it builds every node with createElement and
// textContent: no HTML strings. It holds no data of its own: notes come and go
// through the worker (notes:list / notes:save / notes:delete), plain notes only.
// Injecting it again toggles it. Everything lives in one block (block-scoped
// consts, no top-level names, no wrapper function), so a second injection never
// redeclares anything in the extension's isolated world.
if (/** @type {Window & { __weeklyNote?: { toggle: () => void } }} */ (window).__weeklyNote) {
  /** @type {Window & { __weeklyNote?: { toggle: () => void } }} */ (window).__weeklyNote?.toggle();
} else {
  const w = /** @type {Window & { __weeklyNote?: { toggle: () => void } }} */ (window);

  // The same five as lib/note-views.js CATEGORIES (a classic script cannot import it).
  const CATEGORIES = ['General', 'Work', 'Personal', 'Idea', 'To-Read'];
  const CSS = `
:host { all: initial; }
.box { position: fixed; right: 16px; bottom: 16px; width: min(340px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
  overflow: auto; box-sizing: border-box; padding: 12px; display: grid; gap: 8px;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1c2333;
  background: #fffdf8; border: 1px solid #8f8a7c; border-top: 3px solid #f2cf45; border-radius: 6px; box-shadow: 0 8px 28px rgb(0 0 0 / .18); }
.head { display: flex; justify-content: space-between; align-items: center; }
h2 { margin: 0; font: 600 16px/1.2 Charter, "Iowan Old Style", Georgia, serif; }
input, textarea, select { font: inherit; color: inherit; background: #fffdf8; border: 1px solid #8f8a7c; border-radius: 4px; padding: 5px 7px; box-sizing: border-box; width: 100%; }
textarea { resize: vertical; min-height: 90px; }
.row { display: flex; gap: 6px; align-items: center; }
.row select { flex: 1; }
button { font: inherit; font-weight: 600; cursor: pointer; border-radius: 4px; min-height: 30px; padding: 4px 10px; border: 1px solid #8f8a7c; background: transparent; color: #1f3a68; }
button.primary { background: #1f3a68; border-color: #1f3a68; color: #fffdf8; }
button.quiet { border-color: transparent; padding-inline: 6px; }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid #1f3a68; outline-offset: 2px; }
.msg { margin: 0; font-size: 12px; color: #596071; min-height: 1em; }
ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid #ddd8cb; }
li { display: flex; justify-content: space-between; gap: 6px; border-bottom: 1px solid #ddd8cb; }
li button.open { flex: 1; text-align: left; font-weight: 400; color: #1c2333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (prefers-color-scheme: dark) {
  .box, input, textarea, select { background: #1c202a; color: #e9e6dd; border-color: #6b7385; }
  button { color: #9dbcec; border-color: #6b7385; } button.primary { background: #9dbcec; border-color: #9dbcec; color: #0f1a30; }
  li button.open { color: #e9e6dd; } ul, li { border-color: #2d3340; } .msg { color: #a0a7b6; }
}`;

  /**
   * createElement + properties + text children; never markup.
   * @template {keyof HTMLElementTagNameMap} K
   * @param {K} tag @param {Record<string, unknown>} [props] @param {(Node | string)[]} kids
   * @returns {HTMLElementTagNameMap[K]}
   */
  const el = (tag, props = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'aria') for (const [a, val] of Object.entries(/** @type {Record<string, string>} */ (v))) e.setAttribute(`aria-${a}`, val);
      else /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (e))[k] = v;
    }
    e.append(...kids);
    return e;
  };

  /** @param {string} type @param {Record<string, unknown>} [payload] @returns {Promise<{ ok: boolean } & Record<string, any>>} */
  const ask = async (type, payload = {}) => {
    try {
      return (await chrome.runtime.sendMessage({ type, ...payload })) ?? { ok: false, error: 'Weekly did not answer.' };
    } catch {
      // The extension was reloaded or updated since this page loaded.
      return { ok: false, error: 'Weekly was updated. Reload this page to write a note here.' };
    }
  };

  const host = el('div', { id: 'weekly-note-host' });
  // The page's CSS must not move, hide or show the host: inline, important, reset.
  host.style.cssText = 'all: initial !important; position: fixed !important; z-index: 2147483647 !important;';
  let open = false;
  const root = host.attachShadow({ mode: 'closed' });
  const title = el('input', { type: 'text', maxLength: 200, placeholder: 'Title (optional)', aria: { label: 'Note title' } });
  const body = el('textarea', { maxLength: 20000, placeholder: 'Write a note… (Ctrl+Enter saves)', aria: { label: 'Note' } });
  const category = el('select', { aria: { label: 'Category' } }, ...CATEGORIES.map((c) => el('option', { value: c }, c)));
  const msg = el('p', { className: 'msg', aria: { live: 'polite' } });
  const list = el('ul', { aria: { label: 'Recent notes' } });
  /** The note being edited, or null for a new one. @type {string | null} */
  let editing = null;

  const reset = () => { editing = null; title.value = ''; body.value = ''; category.value = 'General'; };

  /** @param {{ id: string, title: string, body: string, category: string }} n */
  const row = (n) => el('li', {},
    el('button', { type: 'button', className: 'quiet open', onclick: () => {
      editing = n.id; title.value = n.title; body.value = n.body; category.value = n.category; body.focus();
    } }, n.title || n.body.split('\n')[0] || 'Untitled'),
    el('button', { type: 'button', className: 'quiet', aria: { label: `Delete: ${n.title || 'note'}` }, onclick: async () => {
      const r = await ask('notes:delete', { id: n.id });
      msg.textContent = r.ok ? 'Deleted.' : r.error;
      if (editing === n.id) reset();
      await load();
    } }, '✕'));

  const load = async () => {
    const r = await ask('notes:list');
    list.replaceChildren(...(r.ok ? r.notes.map(row) : []));
    if (!r.ok) msg.textContent = r.error;
  };

  const save = async () => {
    const r = await ask('notes:save', { id: editing ?? undefined, title: title.value, body: body.value, category: category.value });
    msg.textContent = r.ok ? 'Saved in Weekly.' : r.error;
    if (r.ok) { reset(); await load(); body.focus(); }
  };

  const box = el('div', { className: 'box', aria: { label: 'Weekly note' } },
    el('div', { className: 'head' }, el('h2', {}, 'Weekly note'),
      el('button', { type: 'button', className: 'quiet', aria: { label: 'Close' }, onclick: () => setOpen(false) }, '✕')),
    title, body,
    el('div', { className: 'row' }, category,
      el('button', { type: 'button', className: 'quiet', onclick: () => { reset(); body.focus(); } }, 'New'),
      el('button', { type: 'button', className: 'primary', onclick: () => void save() }, 'Save')),
    msg, list);
  box.setAttribute('role', 'dialog');
  root.append(el('style', {}, CSS), box);
  // Keys typed here are the note's: the page's own shortcuts never see them.
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
  });

  /** @param {boolean} next */
  const setOpen = (next) => {
    open = next;
    host.style.setProperty('display', open ? 'block' : 'none', 'important');
    if (open) { void load(); body.focus(); }
  };
  w.__weeklyNote = { toggle: () => setOpen(!open) };
  (document.body ?? document.documentElement).append(host);
  setOpen(true);
}
```

- [ ] **Step 6: "Note on this page" in the panel, and the panel opening on Notes**

In `src/ui/panel/panel.html`, replace:

```html
  </form>
  <p id="noteMsg" class="msg" role="status"></p>
```

with:

```html
  </form>
  <button id="noteOnPage" type="button" class="quiet" title="Alt+N on the page does the same">Note on this page</button>
  <p id="noteMsg" class="msg" role="status"></p>
```

In `src/ui/panel/footer.js`, replace:

```js
export function init() {
```

with:

```js
/**
 * Spec §3.4: ask the worker to open the note on the page in front. Chrome gives
 * Weekly the page for Alt+N, not for a click in the panel, so where it is refused
 * the panel says how, and opens its Notes tab: the fallback.
 * @param {() => void} showNotes
 */
async function noteOnPage(showNotes) {
  const { id: windowId } = await chrome.windows.getCurrent();
  const r = await chrome.runtime.sendMessage({ type: 'panel:openOnPage', windowId });
  if (r?.ok) { $('#noteMsg').textContent = 'The note is open on the page.'; return; }
  showNotes();
  $('#noteMsg').textContent = 'Weekly can’t open a note on this page from here. Press Alt+N on the page, or write it in Notes above.';
}

/** @param {{ showNotes: () => void }} opts */
export function init({ showNotes }) {
```

In `src/ui/panel/footer.js`, replace:

```js
  $('#noteForm').addEventListener('submit', (e) => void addNote(/** @type {SubmitEvent} */ (e)).catch(report));
  onTrackingChanged(() => void refresh());
```

with:

```js
  $('#noteForm').addEventListener('submit', (e) => void addNote(/** @type {SubmitEvent} */ (e)).catch(report));
  $('#noteOnPage').onclick = () => void noteOnPage(showNotes).catch(report);
  onTrackingChanged(() => void refresh());
```

In `src/ui/panel/panel.js`, replace:

```js
  footer.init();
```

with:

```js
  footer.init({ showNotes: () => select('notes') });
  // Alt+N where Chrome keeps scripts out opens the panel on Notes (spec §3.4): an open
  // panel is told at once; a panel that is just opening asks the worker which tab.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'panel:show' && TABS.some((t) => t.id === msg.tab)) select(msg.tab);
    return false;
  });
  void chrome.runtime.sendMessage({ type: 'panel:hello' }).then((r) => { if (TABS.some((t) => t.id === r?.tab)) select(r.tab); }, () => undefined);
```

- [ ] **Step 7: Run the unit gate and the build**

Run: `npm test && npm run typecheck && npm run build`

Expected: `# tests 286`, `# pass 286`, `# fail 0` in each timezone (+6 on-page, +2 worker, +1 manifest); typecheck clean (now over `src/content` too); the build line ends `references checked` with no `Missing from build` (it now checks the injected script).

- [ ] **Step 8: End-to-end on real pages**

The harness grants `https://acme.atlassian.net/*` (as a user who allowed live Jira status), so the panel can open the note there; `dev.to` has no grant, so it shows the fallback. Alt+N itself cannot be pressed under test: the worker tests above drive `onCommand`, and this checks it is registered.

In `test/e2e/notes.mjs`, replace:

```js
  check('Private', 'with no PIN, the panel offers neither Private nor Lock', !(await pan.isVisible('#notePrivate')) && !(await pan.isVisible('#noteLock')));
}

```

with:

```js
  check('Private', 'with no PIN, the panel offers neither Private nor Lock', !(await pan.isVisible('#notePrivate')) && !(await pan.isVisible('#noteLock')));
}

// The on-page note (spec §3.4; F4). The harness grants acme.atlassian.net (live statuses), as a user who
// connected Jira would; dev.to has no grant, so there the panel falls back to its Notes tab. Alt+N itself is
// a Chrome command that cannot be pressed under test: the worker unit tests drive onCommand.
export async function onPageChecks(t, pan) {
  const { sw, check, store, wait, tabs } = t;
  const cmds = Object.fromEntries((await sw.evaluate(() => chrome.commands.getAll())).map(c => [c.name, c.shortcut]));
  check('On-page', 'Alt+N is registered for the on-page note (F4)', /^(Alt|⌥)\+?N$/.test(cmds['open-note'] ?? ''), JSON.stringify(cmds));
  const jira = tabs['https://acme.atlassian.net/browse/ENGX-1'];
  await jira.bringToFront(); await pan.click('#noteOnPage'); await wait(1200);
  const host = () => jira.evaluate(() => { const h = document.getElementById('weekly-note-host'); return h && { closed: h.shadowRoot === null, shown: getComputedStyle(h).display !== 'none' }; });
  check('On-page', '"Note on this page" opens a floating note in a closed Shadow DOM (F4)', JSON.stringify(await host()) === '{"closed":true,"shown":true}' && /open on the page/.test(await pan.textContent('#noteMsg')), JSON.stringify(await host()));
  await jira.keyboard.type('Ask Dana about the SSO rollout'); await jira.keyboard.press('Control+Enter'); await wait(800);
  const saved = ((await store()).notes ?? []).find(n => n.body === 'Ask Dana about the SSO rollout');
  check('On-page', 'a note written on the page is saved in Weekly, through the worker', saved?.enc === null && await card(pan, 'Ask Dana').count() === 1, JSON.stringify(saved));
  await pan.click('#noteOnPage'); await wait(800);
  check('On-page', 'asking again hides it (a toggle)', (await host())?.shown === false);
  const dev = tabs['https://dev.to/some-article'];
  await pan.click('#tab-today'); await dev.bringToFront(); await pan.click('#noteOnPage'); await wait(1000);
  check('On-page', 'where Weekly may not run, the panel opens its Notes tab instead (F4 fallback)', await pan.getAttribute('#tab-notes', 'aria-selected') === 'true' && /Press Alt\+N/.test(await pan.textContent('#noteMsg'))
    && !(await dev.evaluate(() => !!document.getElementById('weekly-note-host'))), await pan.textContent('#noteMsg'));
}

```

In `test/e2e/full.mjs`, replace:

```js
const harness = { ctx, X, sw, check, watch, store, wait, shots, PAGES, iso, workday, weekend,
```

with:

```js
const harness = { ctx, X, sw, check, watch, store, wait, shots, PAGES, iso, workday, weekend, tabs,
```

In `test/e2e/full.mjs`, replace:

```js
const { notesTabChecks, notesViewChecks } = await import('./notes.mjs');
await notesTabChecks(harness, pan);
await notesViewChecks(harness, pan);
```

with:

```js
const { notesTabChecks, notesViewChecks, onPageChecks } = await import('./notes.mjs');
await notesTabChecks(harness, pan);
await notesViewChecks(harness, pan);
await onPageChecks(harness, pan);
```

Run: `npm run e2e`

Expected: `238/238 passed`. The 5 new checks: `[On-page] Alt+N is registered for the on-page note (F4)`; `"Note on this page" opens a floating note in a closed Shadow DOM (F4)`; `a note written on the page is saved in Weekly, through the worker`; `asking again hides it (a toggle)`; `where Weekly may not run, the panel opens its Notes tab instead (F4 fallback)`.

---

### Task 8: README, size and layering checks, the phase gate

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document notes, private notes and the on-page note**

In `README.md`, replace:

```markdown
- It never reads page content, keystrokes or screenshots, and makes no network calls unless you turn on an option below. Data stays in `chrome.storage.local` and is deleted after 90 days.
```

with:

```markdown
- It never reads page content, keystrokes or screenshots, and makes no network calls unless you turn on an option below. Data stays in `chrome.storage.local`. Activity is deleted after 90 days; tasks and notes stay until you delete them.
```

In `README.md`, replace:

```markdown

## Reminders
```

with:

```markdown

## Notes
- **Notes** (side panel tab, and **Notes** in **Open Weekly**): write a note with an optional title, a category (General, Work, Personal, Idea, To-Read) and, if you like, a day. Search covers titles and text; filter by category; pin a note to the top, tick it done, edit or delete it (**Undo** brings it back). The app also shows the last 7 days: notes created and done per day.
- **Day notes**: a note added in a day's sheet, in the panel footer or in the report is attached to that day. Day notes are the update's **Other work**. Weekly 2's notes become day notes (category Work) the first time they are read.
- **Private notes**: set a PIN (4 to 8 digits) in **Settings → Notes PIN**, then tick **Private** on a note. Its title and text are encrypted on this computer (PBKDF2-SHA256, 310,000 rounds, AES-GCM); while locked it shows only "Private note". The PIN is never stored, only a salt and a check value. The key lives in Weekly's background worker, never on disk, and is forgotten when you lock, after 5 minutes without using a private note, or when Chrome stops the worker. Five wrong PINs pause unlocking for 30 seconds, then 1, 5 and 15 minutes. Private notes never reach the update, the AI tidy-up, search while locked, or a web page. Forget the PIN and they cannot be recovered.
- **On-page note**: **Alt+N** opens a small note on the page you're on; it saves into Weekly. **Note on this page** in the panel does the same on sites Weekly may already open (for example one you allowed for live status); elsewhere press Alt+N on the page. Chrome keeps extensions off its own pages and the Web Store; there Alt+N opens the side panel's Notes tab instead.

## Reminders
```

In `README.md`, replace:

```markdown
- Anywhere in Chrome: **Alt+T** opens the side panel and **Alt+Shift+T** opens Weekly in a tab. Change them at `chrome://extensions/shortcuts`.
```

with:

```markdown
- Anywhere in Chrome: **Alt+T** opens the side panel, **Alt+Shift+T** opens Weekly in a tab and **Alt+N** opens a note on the page. Change them at `chrome://extensions/shortcuts`.
```

In `README.md`, replace:

```markdown
| `npm run typecheck` | `tsc --strict` over `src/lib`, `src/background` and the task UI (`src/ui/components`, `src/ui/panel`, `src/ui/app`, `src/ui/remind`) (JSDoc types) |
```

with:

```markdown
| `npm run typecheck` | `tsc --strict` over `src/lib`, `src/background`, `src/content` and the task and notes UI (`src/ui/components`, `src/ui/panel`, `src/ui/app`, `src/ui/remind`) (JSDoc types) |
```

In `README.md`, replace:

```markdown
  week-notes.js    Weekly 2's notes until Phase 4 (side panel, day sheet)
```

with:

```markdown
  notes.js         the only owner of the notes key: writes under the notes lock, Weekly 2 notes converted by shape
  note-views.js    note shape and validation, search, day notes, Other work, 7-day insights (pure)
  crypto.js        PIN crypto: PBKDF2 + AES-GCM, the PIN record, lockout steps (pure WebCrypto)
```

In `README.md`, replace:

```markdown
src/background/    the MV3 service worker, tracker and reminder engine (alarms, the reminder window)
src/ui/            panel/ (side panel), app/ (calendar, tasks), remind/ (reminder window), welcome, report tab
  components/      dom.js (h() builds all DOM), task rows, bands, undo toast, keys
```

with:

```markdown
src/background/    the MV3 service worker, tracker, reminder engine, PIN broker (crypto-broker.js) and on-page note (onpage.js)
src/content/       onpage-note.js: the on-page note, injected on demand (classic script, closed Shadow DOM)
src/ui/            panel/ (side panel), app/ (calendar, tasks, notes), remind/ (reminder window), welcome, report tab
  components/      dom.js (h() builds all DOM), task rows, bands, undo toast, keys, the notes view and private-note client
```

In `README.md`, replace:

```markdown
Two rules keep this honest: `lib/` never touches the DOM, and `ui/` never touches `chrome.storage` directly. Documented Phase 1 exceptions, each marked `// ponytail: direct storage until lib/storage.js`: keys with no lib owner yet, all on the report page (notes, `excluded:*`, `draft:*`, `shareOk`, clear-all's activity keys, `onChanged` listeners, and the one-time legacy `remove('excluded')` cleanup). Settings always go through `lib/settings.js`. The side panel, the app tab and the reminder window have no exceptions: tasks come from `lib/tasks.js`, notes from `lib/week-notes.js`, tracker status from `lib/activity/status.js`.

Every read-modify-write of `tasks`, `settings`, `uiState` and `reminderState` runs under a Web Lock (`withLock` in `lib/storage.js`). The side panel, the app and report tabs and the service worker share one lock manager, so none of them can drop another's change. Node tests fall back to a per-context promise chain. Locks are not re-entrant: a `mutate()` callback is synchronous and never calls `getTasks()`.
```

with:

```markdown
Two rules keep this honest: `lib/` never touches the DOM, and `ui/` never touches `chrome.storage` directly. Documented Phase 1 exceptions, each marked `// ponytail: direct storage until lib/storage.js`: keys with no lib owner yet, all on the report page (`excluded:*`, `draft:*`, `shareOk`, clear-all's activity keys, `onChanged` listeners, and the one-time legacy `remove('excluded')` cleanup). Settings always go through `lib/settings.js`. The side panel, the app tab and the reminder window have no exceptions: tasks come from `lib/tasks.js`, notes from `lib/notes.js`, tracker status from `lib/activity/status.js`. Private notes are opened and sealed only by the worker, over `crypto:*` messages; the on-page note reads and writes plain notes only, over `notes:*` messages.

Every read-modify-write of `tasks`, `notes`, `settings`, `uiState` and `reminderState` runs under a Web Lock (`withLock` in `lib/storage.js`). The side panel, the app and report tabs and the service worker share one lock manager, so none of them can drop another's change. Node tests fall back to a per-context promise chain. Locks are not re-entrant: a `mutate()` or `mutateNotes()` callback is synchronous and never calls `getTasks()` or `getNotes()`.
```

- [ ] **Step 2: Check sizes and layering**

Run: `find src -name '*.js' -exec wc -l {} + | sort -n | tail -5 && wc -l src/lib/notes.js src/lib/note-views.js src/lib/crypto.js src/background/crypto-broker.js src/background/onpage.js src/content/onpage-note.js src/ui/components/notes-view.js && (grep -rn 'chrome.storage' src/ui/panel src/ui/app src/ui/components src/ui/remind || echo 'no direct storage in new UI') && (grep -n 'chrome\.[a-z]' src/lib/note-views.js src/lib/crypto.js || echo 'note-views.js and crypto.js are pure') && (grep -rnE 'storage\.(sync|session)' src/background/crypto-broker.js || echo 'the key is never stored') && (grep -rnE 'storage\.sync' src || echo 'no storage.sync')`

Expected: the largest files are still `task-views.js` (195), `classify.js` (203), `tasks.js` (227) and `schema.js` (250), then the total; the new ones are `notes.js` 149, `note-views.js` 167, `crypto.js` 143, `crypto-broker.js` 189, `onpage.js` 111, `onpage-note.js` 136 and `notes-view.js` 101. Then `no direct storage in new UI`, `note-views.js and crypto.js are pure`, `the key is never stored` and `no storage.sync`. `test/e2e/full.mjs` stays the one file over 300 lines.

- [ ] **Step 3: Run the phase gate**

Run: `npm run package && npm run e2e`

Expected:
- `npm test`: `# tests 286`, `# pass 286`, `# fail 0` in each timezone (245 from Phase 3, plus 45 new, minus the 4 `week-notes` tests).
- typecheck clean.
- `Packed 84 files → dist/weekly-2.0.0.zip`.
- e2e: `238/238 passed`.

- [ ] **Step 4: Report**

Report to the controller: test counts per timezone, the e2e total, the largest files, and any check that needed a retry. The PIN checks each derive a key (about 30 ms in Node, a little more in Chromium); none is expected to be timing-sensitive beyond the existing `wait()` pauses.

---

## Interfaces exported for Phase 5

**Three-format import, notes and the security record (D11, F7)**
- Notes enter storage only through `src/lib/notes.js`. An import validates with `coerceNote` (any shape: Weekly 2 `{id, ts, text}`, Weekly 3 `Note`, or a ForgetMeNot note once mapped) and writes with `mergeNotes(list) → added` (same id: newer `updatedAt` wins; idempotent) or, for **replace**, one `mutateNotes(() => ({ notes: clean, result }))`. Validate first, then write once (spec §6).
- ForgetMeNot notes carry `private: true` and `enc: {iv, ct}` with the **title in plain text** and the body sealed alone. Map them to `{ ...note, enc }` (drop `private`); note that `coerceNote` blanks the plain title of any note with `enc`, so the title would be lost: the import must re-seal each one in the worker, `openNote(key, enc, fmnTitle)` then `sealNote(key, plain)`, with the key from the imported record's PIN (the user types it once). `openNote` already accepts ForgetMeNot's body-only blobs.
- The `security` record is written only by the worker. Adopting an imported record must be a new `crypto:*` message handled by `src/background/crypto-broker.js` (for example `crypto:adopt { security, mode }`), validated by `coerceSecurity` (it refuses fewer than 100,000 PBKDF2 rounds) and run in the broker's queue. `verify` already accepts ForgetMeNot's verifier text, so a ForgetMeNot record works as is. ForgetMeNot's rule: on merge adopt only when no PIN is set; on replace the incoming one wins; spec §4: if a record already exists, the user confirms which PIN wins.
- Weekly's own export (`exportPayload`) already includes `notes` as stored: private notes as ciphertext, never the PIN, and **no** `security` record. Phase 4's Weekly import therefore skips private notes (`parseImport` drops `enc` notes); Phase 5 adds the record to the export (F7) and lifts that skip when the record comes along.
- Delete everything (`data-panel.js`) empties notes with `deleteAllNotes()` and keeps `security`.

**Stats (L7) and archive UI (L6)**
- Notes add nothing to the task stats. `insights(notes, ref)` (`note-views.js`) is the notes' 7-day summary if Stats wants a notes card.
- The app's views are `calendar`, `tasks`, `notes` (`View` in `app.js`); a Stats or Daily-tasks view is one more nav button, section and `show()` entry the same way.

**Theme (F6, L8)**
- Pages use the tokens in `src/ui/styles.css` (`notes.css` adds no colours of its own). The on-page note cannot load them: `src/content/onpage-note.js` repeats the light and dark values in its `CSS` string and follows `prefers-color-scheme`. A theme setting must reach it as data (for example a `theme` field in the `notes:list` answer), never as a stylesheet URL.

**Optional `tabs` (W3, spec §3.6)**
- `manifest.json` still lists `tabs` at install (unchanged here). Nothing in Phase 4 needs it: the on-page note uses `activeTab`, the worker's `tabs.query({ active: true, windowId })` reads only the tab id, and `canInject` reads `tab.url`, which Chrome supplies for the commanded tab under `activeTab`. Moving `tabs` to optional leaves notes working.
- With `tabs` granted, the panel's **Note on this page** could also offer to allow the site (`permissions.request({ origins: [origin] })`) inside the click; not done here.

**Worker**
- `runtime.onMessage` routes `crypto:*` to `crypto-broker.js`, then `notes:*` and `panel:*` to `onpage.js` (both answer after an await and return `true`), then the reminder messages. New message families follow the same pattern; a page-only message must check `sender.url` like `fromExtensionPage` in the broker.
- `commands.onCommand` has three commands: `open-panel`, `open-app`, `open-note`. Chrome allows four suggested keys.
- No alarm was added, so `KEEP` in `src/background/reminders.js` is unchanged.

**Tests**
- `test/helpers/chrome-stub.js`: `runtime.id === 'weekly'`; `runtime.sendMessage` records into `log.messages`; `scripting.executeScript` records into `log.scripts` synchronously and can be made to fail with `setInjectFails(true)`.
- `test/e2e/notes.mjs` exports `legacyNoteChecks`, `notesTabChecks`, `notesViewChecks`, `onPageChecks`, `pinSetChecks`, `privateNoteChecks`, `pinChangeChecks`. The run ends with no PIN set and the notes emptied by Delete everything; the harness passes `tabs` (the web pages opened in section 3).

## Self-review (done at authoring time)

**1. Spec coverage: every Phase 4 row, its task, and the check that proves it**

| Row | Requirement | Task | Proved by |
|---|---|---|---|
| F1 | Notes: title, body, category (General · Work · Personal · Idea · To-Read), pinned, done, timestamps | 1, 5 | unit `createNote stores ForgetMeNot’s fields plus day…`, `untrusted fields are coerced…`; e2e `[Notes] quick add: title, body and category (F1)`, `category filter (F1)` |
| F2 | Quick add, search (title + body; private bodies hidden), pin, done, delete, edit | 1, 5, 6 | unit `search covers title and body; a private note matches only by its unlocked title`, `order: pinned first…`, `updateNote patches inside the lock…`, `deleteNote returns the note; restoreNote…`; e2e `search covers the body (F2)`, `search covers the title, any case (F2)`, `pin puts a note first (F2)`, `mark done (F2)`, `edit title and category (F2)`, `delete, then Undo brings it back with its id (F2)`, `[Private] a locked note is not found by search (F2)` |
| F3 | PIN set/change/remove | 4, 6 | unit `set a PIN: only 4–8 digits…`, `change PIN re-encrypts every private note…`, `remove PIN: the right PIN turns private notes back…`; e2e `[PIN] set a PIN…`, `change PIN re-encrypts private notes (F3)`, `remove PIN: private notes become ordinary ones and the record is gone (F3)` |
| F3 | PBKDF2-SHA256 310k + AES-GCM, verifier not PIN | 3, 4 | unit `the security record is PIN-free…` (310000, keys, no PIN), `encrypt/decrypt round-trips…`, `verify returns null for a wrong PIN…`, `decrypt throws on the wrong key and on tampered ciphertext`; broker `set a PIN … never the PIN`; e2e `[PIN] set a PIN: a salt and verifier are stored, never the PIN (F3)` |
| F3 | Wrong PIN; lockout 5 fails → 30 s / 1 m / 5 m / 15 m | 3, 4, 6 | unit `lockout: 5 failures → 30 s, then 1 m, 5 m, 15 m; success resets (F3)`; broker `wrong PIN: refused, counted, still locked`, `lockout escalates 30 s → 1 m → 5 m → 15 m; while locked even the right PIN is refused and not tried`, `changing or removing the PIN goes through the same lockout…`; e2e `[Private] a wrong PIN is refused and counted`, `[PIN] the old PIN fails; 5 wrong PINs pause unlocking for 30 s (F3)`, `during the pause even the right PIN is refused, and not counted` |
| F3 | Key only in worker memory; auto-lock after 5 min idle or explicit lock; dropped on worker restart | 4, 6 | broker `the key is dropped on lock, after 5 idle minutes, and when the worker restarts`, `only extension pages may ask…`; e2e `[Private] Lock drops the key in the worker`; Step 2 of Task 8 greps the broker for any storage of the key |
| F3 / §4 | Locked notes never readable from storage in plain text (at rest and in exports) | 1, 4, 6 | unit `a private note never stores its title or body in plain text`, broker `a private note is ciphertext at rest: no title, no body, nowhere in storage`, `change PIN re-encrypts…` (ciphertext changes); e2e `[Private] a private note is ciphertext at rest…`, `an edited private note is sealed again, still no plain text`; the export is `notes` as stored |
| F4 | On-page floating note, Shadow DOM, Alt+N | 7 | unit `Alt+N on a web page injects the on-page note at once, inside the command’s gesture (F4)`, onpage `notes:list gives the page plain notes only…`, `notes:save creates or edits a plain note; it cannot touch a private one or make one`, `notes:delete…`, manifest `on-page note: activeTab + scripting and Alt+N…`; e2e `[On-page] Alt+N is registered…`, `"Note on this page" opens a floating note in a closed Shadow DOM (F4)`, `a note written on the page is saved in Weekly, through the worker`, `asking again hides it (a toggle)` |
| F4 | Side-panel fallback where injection is blocked | 7 | unit `Alt+N where Chrome keeps scripts out opens the side panel on Notes instead (F4 fallback)`, onpage `which pages can take the note…`, `panel:openOnPage … a refused page says so`; e2e `[On-page] where Weekly may not run, the panel opens its Notes tab instead (F4 fallback)` |
| F5 | 7-day insights (created / done) | 1, 5 | unit `insights: seven local days of notes created and done, oldest first (F5)` (both timezones); e2e `[Notes] 7-day insights: today’s notes created and done (F5)` |
| F8 | Private titles hidden while locked too | 3, 5, 6 | unit `sealNote/openNote keep title and body together…`; e2e `[Private] Lock hides the title as well as the body (F8)` |
| L3 | Day note (note with `day`) | 1, 2 | unit `day notes: untitled, plain notes of that day, oldest first`; e2e `[Day sheet] note slot: a note for this day (L3)` (now `body` + `day`), `[Panel] note added with Enter` (a day note for today) |
| W2 | Other work from day notes; private notes never there | 1, 2, 6 | unit `Other work: plain notes dated inside the range, as one line each; private notes never`; e2e `[Notes] day notes are the update’s Other work (W2)`, `[Private] a private day note never reaches Other work or the draft (W2)` |
| §4 migration | Weekly 2 notes → Note (`day` = date, category Work) | 1, 2 | unit `Weekly 2 notes become day notes by shape, whatever schemaVersion says, once`, `onNotesChanged hands listeners the coerced list…`, portability `import reads Weekly 2 and Weekly 3 notes…`; e2e `[Notes] a Weekly 2 note becomes a day note, category Work (migration by shape)` |
| §4 locks | Notes writes through one serialised lock | 1, 2 | unit `two notes created at the same instant both land`; all notes writers go through `notes.js` (Task 2 Step 6 grep) |
| §4 retention | Notes kept until deleted | 2 | unit `notes are kept until deleted: the 90-day purge leaves them alone (spec §4 retention)` |
| §3.2 | App Notes view; Settings: Notes PIN | 5, 6 | e2e `[App] #notes opens the Notes view`, `[PIN] Settings: no PIN yet, so only Set is offered`, `[Layout] every control has a label` (report, unchanged check now covering the PIN group) |
| §3.6 | Permissions: `scripting`, `activeTab` | 7 | manifest test; `[Panel] toolbar icon opens the side panel, no popup` still passes |
| W1 | Weekly 2 features survive | every task | the 198 Phase 3 checks pass; one renamed (`[Data] delete all keeps only settings and device ID (tasks and notes emptied)`), two re-pointed from `text` to `body` + `day` |

**Unit tests added (45; 4 removed):** `notes.test.js` 9, `note-views.test.js` 5, `crypto.test.js` 10, `background/crypto-broker.test.js` 10, `background/onpage.test.js` 6, `background/service-worker.test.js` +4 (retention, `crypto:*` routing, Alt+N inject, Alt+N fallback), `manifest.test.js` +1; `portability.test.js` keeps its count (one test rewritten, one re-pointed); `week-notes.test.js` (4) deleted. 245 → 286.

**End-to-end checks added (40, all in `test/e2e/notes.mjs`; 198 → 238):** Task 2: 2 (`legacyNoteChecks`). Task 5: 15 (`notesTabChecks` 11, `notesViewChecks` 4). Task 6: 18 (`pinSetChecks` 5, `privateNoteChecks` 8, `pinChangeChecks` 5). Task 7: 5 (`onPageChecks`).

**2. Placeholder scan:** none. Every new file is written in full; every change to an existing file is an exact replace, append or whole-file replacement against the file as the previous task left it. The plan was generated from, and replayed step by step on, a copy of the Phase 3 end state, including each "see it fail" run, with every task ending green.

**3. Type consistency:**
- `Note`, `Cipher`, `Plain` are defined once in `note-views.js` and imported by `notes.js`, `crypto.js`, the broker, `onpage.js`, `private.js` and the components; `NoteDraft` (`notes.js`) is what `createNote`, `note-actions.save` and the editor's `prepare()` pass.
- A note is private exactly when `enc !== null`; there is no `private` field (ForgetMeNot's is mapped away on import, Phase 5).
- `Security` (`crypto.js`) is what `createSecurity` returns, `coerceSecurity` validates and the broker stores under `security`.
- Message names match between the broker (`OPS`), `private.js`, `pin-dialog.js`, `pin-settings.js`, `onpage.js`, the content script, `footer.js` and `panel.js`: `crypto:status|setPin|changePin|removePin|unlock|lock|encrypt|decrypt`, `crypto:changed` (broadcast), `notes:list|save|delete`, `panel:openOnPage|hello|show`.
- `mountNotes` returns `NotesView = { refresh, focusSearch, focusAdd }`; `notes-tab.js` and `app.js` use those names. `openNoteEditor(n, plain, canPrivate, save)` from Task 6 on; Task 5's three-argument form is replaced whole in Task 6.

**Decisions the specs did not settle:**
- **Migration by shape, not schema v3** (Task 1): `schemaVersion` versions the tasks blob; Weekly 2 notes are detected by shape wherever they come from (storage or an old export) and converted idempotently to `w2-<id>` day notes.
- **Day notes:** a day note is an untitled, plain note with `day` set (spec §4). The day sheet lists all of them for the day (Weekly 2 allowed several per day, so the slot stays a list); the panel footer's quick note and the report's Notes box make day notes for today (a past week's: its Friday, as before). Titled notes with a day also reach Other work as `Title: body`; notes without a day never do.
- **Other work** covers the week's Monday to Sunday (as Weekly 2 did with timestamps), plain notes only, one line each; the standup covers the previous working day to today.
- **Private notes** encrypt title and body together (F8 at rest, not only on screen). A day note can be private: it then drops out of the day sheet and Other work.
- **PIN:** 4 to 8 digits; ForgetMeNot's 4-digit PINs and its verifier still work. The lockout also counts wrong PINs given to Change and Remove (ForgetMeNot did not). Remove needs the current PIN, which is its confirmation (no `confirm()` dialog).
- **Auto-lock without an alarm:** the worker checks 5 idle minutes on every use and pages run their own 5-minute timer, so no alarm is added (and `KEEP` in `reminders.js` is unchanged). Chrome may stop an idle worker sooner (about 30 s), which locks sooner: the safe direction, and ForgetMeNot behaved the same.
- **Crypto replies, not the badge:** a wrong PIN or a refused request answers `{ ok: false, error }` to the page, which says it in words. Crypto requests do not go through the worker's `serial()` queue (the broker has its own); the "!" badge stays for recording failures.
- **Every page follows the lock:** the worker broadcasts `crypto:changed` (no data) and pages re-ask `crypto:status`, so Lock in one page hides private words in all of them.
- **On-page note scope:** quick capture: title, body, category, the 8 latest plain notes to edit or delete. It never shows a private note, even when unlocked: decrypted text stays out of web pages' processes (stricter than spec §4's "while locked").
- **Closed Shadow DOM** (ForgetMeNot used an open one): the page's scripts cannot read the note.
- **"Note on this page" in the panel** works only where Weekly already has the site (Chrome grants `activeTab` for Alt+N, not for a click in the side panel); elsewhere the panel switches to Notes and points to Alt+N. Changing the toolbar to `action.onClicked` would grant `activeTab` on the icon click but loses the panel's open/close toggle; not done.
- **Weekly import and private notes:** the Weekly format carries no PIN record yet, so its import skips private notes until Phase 5 (F7).
- **Insights** count by local calendar day (DST-safe), private notes included (counts only). They are in the app's Notes view, not the narrow panel.
- **Retention:** the worker's purge no longer touches notes, including Weekly 2 notes older than 90 days not yet converted.
- **e2e:** the lockout pause is lifted by resetting the record in storage instead of waiting 30 s; Alt+N cannot be pressed under test and is proved by the worker unit tests plus the registered-command check; the on-page check uses a site the harness grants, as live statuses do.
