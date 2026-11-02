# Phase 4 (Notes): final whole-phase review

Reviewer: opus, read-only. Package: `review-final.diff` (snap-t1 → working tree), read in four passes: (1) manifest, build, background; (2) lib; (3) UI components, panel, app, report; (4) tests and e2e. Plan header, Global Constraints, Phase 5 handover and Self-review read; specs: parity F1–F5, F8, L3, W1, W2; design §3.1, §3.2, §3.4, §3.6, §4–§8.

Focused checks I ran myself (no suite, no e2e):
- Line counts across `src`: no file over 300 lines.
- A TypeScript-AST pass over every `src/**/*.js` and `test/e2e/notes.mjs`: no function over 50 lines.
- Greps: `storage.sync` (0 hits in src, test or scripts); HTML sinks (only the BLOCKED list in `dom.js`); `chrome.storage` in `src/ui` (only the documented report-page ponytail exceptions, none of them new); every `runtime.onMessage` listener (4).

Reported results accepted as given: 298/298 unit per TZ, typecheck 0, e2e 243/243, Packed 85.

## Verdict: Ready

There are no Critical or Important findings and nothing must be fixed before the phase closes. Every ruling holds. The new findings below are minor or are Phase 5 handover notes.

## 1. Parity rows: closed, with the proof for each

| Row | Closed by | Proving unit test(s) | Proving e2e check(s) |
|---|---|---|---|
| F1 | note-views.js `coerceNote`, notes.js `createNote` | `createNote stores ForgetMeNot's fields plus day…`, `untrusted fields are coerced…` | `[Notes] quick add: title, body and category (F1)`, `category filter (F1)` |
| F2 | notes-view.js, note-actions.js, `filterNotes` | `search covers title and body; a private note matches only by its unlocked title`, `order: pinned first…`, `updateNote patches inside the lock…`, `deleteNote returns the note; restoreNote…` | `search covers the body / the title (F2)`, `pin puts a note first`, `mark done`, `edit title and category`, `delete, then Undo…`, `[Private] a locked note is not found by search (F2)` |
| F3 | crypto.js, crypto-broker.js, private.js, pin-dialog.js, pin-settings.js | crypto: `security record is PIN-free`, `lockout: 5 failures → 30 s, then 1 m, 5 m, 15 m`, `verify returns null…`, `decrypt throws on the wrong key and on tampered ciphertext`; broker: `wrong PIN: refused, counted, still locked`, `lockout escalates…`, `changing or removing the PIN goes through the same lockout`, `the key is dropped on lock, after 5 idle minutes, and when the worker restarts`, `change PIN re-encrypts…`, `remove PIN…`, `a private note is ciphertext at rest…` | `[PIN] set a PIN: a salt and verifier are stored, never the PIN`, `[Private] a wrong PIN is refused and counted`, `Lock drops the key in the worker`, `[PIN] change PIN re-encrypts…`, `5 wrong PINs pause unlocking for 30 s`, `during the pause even the right PIN is refused, and not counted`, `remove PIN…` |
| F4 | onpage.js, onpage-note.js, manifest `open-note` | sw: `Alt+N on a web page injects…at once`, `Alt+N where Chrome keeps scripts out opens the side panel on Notes`; onpage: `which pages can take the note`, `notes:list gives the page plain notes only`, `notes:save…cannot touch a private one`, `panel:openOnPage…`; manifest test | `[On-page] Alt+N is registered`, `"Note on this page" opens a floating note in a closed Shadow DOM`, `a note written on the page is saved…through the worker`, `asking again hides it`, `where Weekly may not run, the panel opens its Notes tab instead` |
| F5 | `insights`, note-insights.js | `insights: seven local days…(F5)` (both TZ) | `[Notes] 7-day insights: today's notes created and done (F5)` |
| F8 | `sealNote` (title+body together), note-card.js `locked` | `sealNote/openNote keep title and body together…` | `[Private] Lock hides the title as well as the body (F8)` |
| L3 | `dayNotes`, day-sheet.js | `day notes: untitled, plain notes of that day, oldest first` | `[Day sheet] note slot…(L3)`, `[Panel] note added with Enter` |
| W2 | `otherWork`, report main.js and draft-panel.js | `Other work: plain notes dated inside the range…; private notes never` | `[Notes] day notes are the update's Other work (W2)`, `[Private] a private day note never reaches Other work or the draft (W2)` |
| §4 migration / retention | `isWeekNote`/`fromWeekNote`, purge leaves notes | `Weekly 2 notes become day notes by shape…once`, `notes are kept until deleted: the 90-day purge leaves them alone` | `[Notes] a Weekly 2 note becomes a day note, category Work` |

**W1 (no regressions).**
- The Phase 3 e2e checks still pass inside the 243.
- One check was renamed: `[Data] delete all keeps only settings and device ID (tasks and notes emptied)`.
- Two checks were re-pointed from `text` to `body` + `day`.
- Behaviour I reviewed for regressions:
  - Panel quick note: becomes a day note for today.
  - Report Notes: a past week's note is still dated to its Friday.
  - Weekly and standup Other work: now by `day`.
  - Weekly 2 import: notes go through `coerceNote` as `w2-<id>`, so importing twice is still idempotent.
  - Delete everything: notes are emptied under the lock.
- One intended behaviour change: Weekly 2 notes are no longer purged at 90 days (spec §4 retention).
- AI prompt: the AI panel works from the draft, and the draft's notes come only from `otherWork`, so private notes are excluded.

## 2. Message routing (worker ↔ sender.js ↔ broker ↔ onpage ↔ pages)

- **The worker's one gate** (`service-worker.js:95–101`):
  - Not this extension: no answer.
  - Anything but `notes:*` from a sender that is not an extension page: `{ok:false, error:'Not allowed.'}`.
  - Then `crypto:*` goes to `broker.handle`, `notes:*` and `panel:*` go to `onpage.handle`, and reminders go to `serial()`.
  - `answer()` replies after the await and returns `true`, so errors come back in words.
- **Defence in depth.** `broker.handle` re-checks `isOwnPage`. `onpage.handle` re-checks `isOurs`, plus `PAGE_ONLY` for `panel:*`, plus the id regex.
- **Page-side listeners.** There are three: `private.js:99`, `panel.js:43` and `pin-settings.js:31`.
  - Each ignores any message that carries `sender.tab`.
  - Each acts only on its own type (`crypto:changed` or `panel:show`).
  - Each returns `false` and never calls `respond`, so none can steal the worker's reply to another page's request.
- **Broadcasts.** `crypto:changed` and `panel:show` go out with `runtime.sendMessage` from the worker:
  - extension pages receive them;
  - content scripts do not;
  - the worker does not hear its own;
  - the rejection when no page is open is caught.
- **Content script.** It sends only `notes:list`, `notes:save` and `notes:delete`, and gets plain notes only, as `{id,title,body,category}` with no `enc`.
- **Tests.** The gate is unit-tested at both layers:
  - sw: `only Weekly's own pages may ask for reminders or the PIN…`
  - broker: `only extension pages may ask…`
  - onpage: `only Weekly itself may ask…`, `panel:*` refused to a content script.

The routing is coherent.

## 3. Crypto checklist (mandatory)

1. **Wrong PIN: pass.**
   - `checkPin` (`crypto-broker.js:54–68`) writes `afterFailure` and returns `Wrong PIN.` with the count. The key is not set.
   - `explain()` (`private.js:29–33`) says it in words.
   - The typed PIN is cleared after every try (`pin-dialog.js:29`, `pin-settings.js:20`) and never echoed.
   - Unit: `wrong PIN: refused, counted, still locked`. e2e: `a wrong PIN is refused and counted`.
2. **Lockout 5 → 30 s / 1 m / 5 m / 15 m: pass.**
   - `lockoutFor` is at `crypto.js:118–121`.
   - While locked, `checkPin` returns before `verify` (`:59`), so the try is not counted.
   - Success resets the count (`:66`).
   - Change and Remove both go through `checkPin` (`:136`, `:149`). A bad new PIN is refused before the check, so it is not counted.
   - `lockedFor` treats a gap of more than 15 minutes as expired (T3-I1 revised).
   - Unit: `lockout escalates… 900, 900`, `changing or removing the PIN goes through the same lockout`. e2e: the 30 s pause and the refused right PIN.
   - The double-submit guard disables the button while a check runs (`pin-dialog.js:26`, `pin-settings.js:17`).
3. **The verifier never holds the PIN: pass.**
   - The record holds `{version, salt, iterations, verifier:{iv,ct}, failedAttempts, lockedUntil, createdAt}`. The verifier is AES-GCM of a fixed sentinel under the PBKDF2-SHA256 310k key.
   - The PIN is in no reply, no broadcast (the test asserts the broadcast is exactly `{"type":"crypto:changed"}`) and no log.
   - `coerceSecurity` refuses fewer than 100,000 rounds and a salt shorter than 16 bytes.
   - Informational: a 4-digit PIN is 10⁴ PBKDF2 runs to brute force offline. It protects against reading, not against an attacker who holds the disk. This is spec-accepted (ForgetMeNot parity). See §6 for Phase 5.
4. **Private title and body never in plain text: pass.**
   - `sealNote` encrypts `{title, body}` as one blob.
   - `coerceNote` blanks `title` and `body` whenever `enc` is valid (`note-views.js:80–81`). Every write (create, update, merge, the content script's save) goes through it, so no caller can store plaintext beside the ciphertext.
   - `exportPayload` exports `notes` as stored (ciphertext) and never `security`.
   - Day sheet, report list, draft and standup use `dayNotes`/`otherWork`, which skip `enc`.
   - Unit: `a private note never stores its title or body in plain text`, broker `ciphertext at rest`. e2e: two at-rest checks.
5. **Key only in worker memory, dropped on lock, idle and restart: pass.**
   - The key is a module-local, non-extractable `CryptoKey` (`crypto-broker.js:28`).
   - The only storage writes are `writeSecurity` and the `transformNotes` notes plus record.
   - Replies carry `enc` or `plain`, never the key.
   - Drops: `liveKey` 5-minute sliding idle; `crypto:lock`; `removePin`; a worker restart reloads the module.
   - Unit: `the key is dropped on lock, after 5 idle minutes, and when the worker restarts`. e2e: `Lock drops the key in the worker`.
   - Nothing keeps the key alive in the background: `openAll` asks only for notes it has not opened yet.
6. **On-page note: pass.**
   - It uses `attachShadow({mode:'closed'})` (`onpage-note.js:65`); e2e asserts `shadowRoot === null`.
   - It builds everything with `createElement` plus `textContent`/`append`, and the `el` props come from fixed literals.
   - There are no sinks (`test/no-innerhtml.test.js` stays green).
   - It sees plain notes only: `forPage` strips everything else, and `plainNote` refuses `enc` for save and delete.
   - Known and inherent (wontfix): a page's capture-phase key listeners still see keystrokes typed into the note.
7. **Sender validation: pass.**
   - `isOwnPage` = `sender.id === chrome.runtime.id` and `sender.url` starts with `chrome.runtime.getURL('')` (`sender.js:9`).
   - A content script gets `notes:*` only. Strangers get no reply.
   - Rejections are unit-tested in the sw, broker and onpage tests.

**Also checked:**
- IV: 12 fresh random bytes per encryption (`crypto.js:63`; test `each encryption has a fresh IV`).
- Salt: random 16 bytes per PIN set.
- Decrypt fails on tamper or a wrong key (tested).
- Stored records go through `coerceSecurity` (`readSecurity`) and `coerceCipher` (`decryptNotes`, `coerceNote`).

## 4. Global gates

- **Size:** every file in `src` is ≤ 300 lines and every function ≤ 50 (AST check). `test/e2e/full.mjs` is the only exception.
- **`storage.sync`:** none.
- **Manifest:** the only changes are `scripting`, `activeTab` and the `open-note` command (Alt+N). The version is unchanged.
- **Notifications:** none added. `reminders.js:129` is unchanged, so no titles.
- **KEEP:** `['tick']` is unchanged. Only the P-D5 comment line was added (`reminders.js:22`).
- **e2e ends with no PIN set.** The final `[Data]` check asserts the key set is exactly `deviceId,notes,schemaVersion,settings,tasks` (`full.mjs`, section 11). `pinChangeChecks` removes the PIN before that.
- **Typecheck:** `src/content` is included (`jsconfig.json`). Build: `build.mjs` adds injected content scripts to the packed set.

## 5. Rulings: all hold

- **P-D1 to P-D7, P-E2E, P-M:** hold. Two of these have a caveat or note:
  - P-D2: the gate and the page listeners are exactly as ruled.
  - P-D6 caveat (by design, informational): a page that forgot its words after 5 idle minutes shows them again the next time it becomes visible if the worker's sliding key is still live because another page used it. "Session unlocked" is the worker's state. F3's idle lock is still met by the worker.
- **T1-I1** (CIPHER_MAX 200000): holds. In the worst case, 20,200 UTF-16 units escaped at 6 bytes each come to about 162k of base64, which is under the cap.
- **T1-m1/m2, T1-W:** hold. `week-notes` is gone.
- **T3-I1 revised, T3-m2/m3/m5/m6, T3-m4** (its obligations a, b, c are met by `checkPin` order, `isValidPin` first and `coerceSecurity` in `readSecurity`): hold.
- **T4-W1** (encrypt-then-store race with a rekey): parking it holds.
  - The window is tiny. `changePin` runs three PBKDF2 derivations before `rekey` takes `NOTES_LOCK`, so a page's `createNote` almost always lands first.
  - The failure is loud, not silent corruption.
  - There is an escape hatch: the stray note shows as "Private note · Locked" while the others open, and deleting it lets Change or Remove succeed.
  - Belongs to Phase 5 (see §6).
- **T4-W2:** holds as the Phase 5 handover.
- **T6-I1/I2, T6-m1..m4, T6-RC, T6-RC2:** hold. The merge artefacts are gone, and the editor inputs are cleared on every close (`note-editor.js:39`).
- **T6 ⚠️ (panel:show sender.tab gate):** verified at `panel.js:43–46`. Closed.

## 6. New findings (none must fix)

1. **Minor, Phase 5.** `portability.js:59–61`: `applyImport` now writes twice. Activity is written with `set`, then notes with `mergeNotes`. Validation happens before both writes, so only a storage error between them could leave a partial import. Spec §6 asks for "validated first, then written once". Fold this into Phase 5's three-format import.
2. **Phase 5 handover.** `notes.js:132`: `mergeNotes` lets an incoming *plain* note with a newer `updatedAt` replace a stored *private* note with the same id, and the ciphertext is lost. Phase 4 cannot reach this (ids are random; the import drops `enc`). The Phase 5 FMN/Weekly import must not let plain overwrite private, or must re-seal first.
3. **Phase 5 handover.** `crypto-broker.js:80`: if a stored `security` record fails `coerceSecurity`, `status` says `hasPin:false` and `setPin` will overwrite it. That orphans any existing `enc` notes. Today this needs tampering. In Phase 5, `crypto:adopt` and any import of a record must refuse, or re-seal, when `enc` notes exist under a different key.
4. **Phase 5 must verify.** `onpage.js:59`: `canInject(tab.url)` needs `tab.url` from `commands.onCommand`. The handover asserts Chrome supplies it under `activeTab` once `tabs` becomes optional (W3), but no test proves it: the stub always supplies `url`. If it is missing, every Alt+N silently falls back to the panel. Phase 5 should check this in e2e with `tabs` not granted.
5. **Handover text differs from the code.** The plan says new page-only messages "must check `sender.url` like `fromExtensionPage` in the broker". That function no longer exists. The rule is `isOwnPage`/`isOurs` in `src/background/sender.js`, enforced once at the worker gate: anything that is not `notes:*` already needs an extension page. Phase 5 adds message families through that gate, not with a per-handler check.
6. **Informational, Phase 6 wording.** MV3 stops an idle worker after about 30 s, so the key usually goes sooner than the "5 minutes" promised in the unlock hint (`pin-dialog.js:35`) and the README. The plan accepts this ("the safe direction"). Phase 6 should word the store listing and privacy policy as "up to 5 minutes", and justify `scripting` and `activeTab` there.
7. **Informational, Phase 5.** Once the export carries the `security` record (F7), an exported file with a 4-digit PIN can be brute-forced offline. Today the salt is never exported, so the ciphertext alone is safe. Say so in the export UI or the privacy text.

## 7. Triage of every deferred minor and parked item

Total: 36 distinct items. The T4 orphan JSDoc and the T6 dangling comment are the same line, so they count once.

- **Must fix before the phase closes:** 0.
- **Can wait:** 16.
  - Phase 5: 13.
  - Phase 6: 3.
- **Wontfix:** 19.
- **Closed (verified):** 1.

### Must fix before close

None.

### Can wait: Phase 5 (13)

| # | Item | Why it belongs in Phase 5 |
|---|---|---|
| T1 | `mergeNotes` gives an invalid-id incoming note a fresh id each import (not idempotent) | Phase 5 rewrites import |
| T2 | portability tests pass a stale 3rd arg `[]` to `parseImport` | Phase 5 touches those tests |
| T2 | import test title mentions "empty ones" without a fixture | same |
| T4/T6 | orphan JSDoc `crypto-broker.js:174` ("Only Weekly's own pages…") | Phase 5 edits the broker (`crypto:adopt`); delete it then |
| T4 | `transformNotes` `also` spread after `notes` could overwrite notes | Phase 5's adopt will pass `also`; spread `also` first or drop a `notes` key |
| T4-W1 | encrypt-then-store race with a rekey (parked) | Phase 5 needs a broker-side seal+write (`crypto:save` under `NOTES_LOCK` in the broker queue) for the import re-seal anyway; route the UI's private saves through it |
| T4-W2 | rekey/decrypt drop an FMN plain title | already in the handover: re-seal title+body on import |
| T5 | `.hint` styled only in `app.css` (the unlock dialog's hint is unstyled in the panel) | theme work (F6/L8) |
| T6 | `edit()` on a locked decrypt says "could not be opened" without asking for the PIN | small; mirror T6-I2: on `locked`, `askPin()` and retry once |
| T7 | on-page note stops `keydown` only; `keyup`/`keypress` reach the page's shortcuts | Phase 5 edits `onpage-note.js` for theme data; add both events in that edit |
| T7 | `pendingTab` can go stale after a fallback while the panel is open | same edit to `onpage.js` |
| T7 | detached host leaves Alt+N dead until reload | in `toggle`, re-append the host when `!host.isConnected` (one line) |
| T7 | content-script CATEGORIES copy is untested against note-views | one unit test that reads the file |

### Can wait: Phase 6 (3)

| # | Item |
|---|---|
| T6 | no e2e for app-tab hiding on Lock, or for Change/Remove during the lockout (Change/Remove is unit-tested in the broker) |
| T6 | no unit tests for `private.js` page logic (P-D6 idle forget, sender.tab filter, id:iv cache); e2e covers the visible behaviour |
| T8 | README `storage.js` layout comment doesn't mention notes |

### Wontfix (19)

| # | Item | Reason |
|---|---|---|
| T1 | `getNotes` overwrites a non-array `notes` with `[]` | test-mandated; corrupt data only |
| T1 | TDD RED not run | process only |
| T1 | `w2-` id from 1e300 contains `+` | unrealistic input |
| T1 | size-cap test uses synthetic ASCII ct | the later multibyte test covers it |
| T2 | notes-panel reloads twice per change | harmless, debounced |
| T2 | report Notes list shows titled dated notes | W2 by design |
| T3 | legacy FMN body that is itself `{"title","body"}` JSON | negligible |
| T4 | rejection test doesn't assert no `weekly:snooze` | the gate returns before `serial()`; window-count and reply assertions already prove it |
| T5 | save maps a coerce-rejected patch to "no longer exists" | unreachable from the UI: `prepare()` returns null for blank |
| T5 | checkbox and pin lag after a Gone toast | cosmetic; self-corrects on the next change |
| T5 | `panel.js:1` long joined comment | cosmetic |
| T6 | a second `askPin()` orphans the first promise | the dialog is modal; no flow overlaps |
| T6 | blank add or edit dropped silently | ordinary form UX |
| T6 | report page sends a redundant `crypto:status` | harmless |
| T6 | `Reply` typedef `Record<string, any>` | brief-mandated |
| T6 | broker test appended at EOF, no RED run | process only |
| T6 | Esc during an in-flight unlock resolves false | self-heals on `crypto:changed` |
| T7 | `notes:delete` checks plainness outside `NOTES_LOCK` | ms window, plus a user action in another page |
| T7 | file:/PDF fallback may lose the gesture | documented best effort (ponytail note) |

The keystroke visibility to capture-phase page listeners (T7) is also inherent to in-page UI and stays wontfix. Only the cheap `keyup`/`keypress` bubbling part goes to Phase 5.

### Closed (1)

- T6 ⚠️: the `panel:show` sender.tab gate is verified at `panel.js:43–46`.

## 8. What Phase 5 must know beyond the plan's handover

1. The page-only message rule lives in `src/background/sender.js` plus the single gate in `service-worker.js`, not in `fromExtensionPage` (§6.5).
2. There is no broker-side seal+write yet. Add one: it solves the import re-seal and T4-W1 together.
3. `mergeNotes` plain-over-private (§6.2), the coerce-rejected record overwritten by `setPin` (§6.3), and the two-write `applyImport` (§6.1).
4. Verify `tab.url` in `commands.onCommand` without `tabs` (§6.4).
5. API additions not in the handover:
   - `openNoteEditor(n, plain, canPrivate, save, isPrivate?)` has a 5th parameter;
   - `closeNoteEditorIfPrivate()`;
   - `private.js` exports `ask`, `explain`, `sync`, `seal`, `openAll`, `plainOf`, `pinState`, `onPrivateChange`, `unlock`, `lock`;
   - `explain()` maps `locked`;
   - `notes-tab.focusAdd` is exported but unused.
6. Delete everything keeps `security`, so a PIN survives with no notes. This is intended and matches the handover.
