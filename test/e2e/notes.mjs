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

const byTitle = async (store, title) => ((await store()).notes ?? []).find(n => n.title === title);
const card = (page, text) => page.locator('#noteList li.note', { hasText: text });

// The side panel's Notes tab (spec §3.1; F1, F2).
export async function notesTabChecks(t, pan) {
  const { check, store, wait, iso } = t;
  await pan.bringToFront(); await pan.reload(); await wait(600);
  check('Notes', 'Notes tab sits between Today and Update', (await pan.locator('#tabs button').allTextContents()).join(',') === 'Today,Notes,Update');
  await pan.click('#tab-notes'); await wait(200);
  await pan.fill('#noteTitle', 'Vendor call'); await pan.fill('#noteBody', 'Ask about SSO pricing'); await pan.selectOption('#noteNewCat', 'Work');
  await pan.click('#panel-notes .note-add button.primary'); await wait(400);
  const v = await byTitle(store, 'Vendor call');
  check('Notes', 'quick add: title, body and category (F1)', v?.body === 'Ask about SSO pricing' && v.category === 'Work' && v.day === iso.today && v.enc === null && await card(pan, 'Vendor call').count() === 1, JSON.stringify(v));
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

const security = async (store) => (await store()).security;
/** The PIN lives on the Settings page now: a fresh load of it, in its own tab. */
const openPin = (t) => t.toSettings();
/** Type a PIN into the unlock dialog and press Unlock. */
const tryPin = async (page, pin, wait) => { await page.fill('#unlockPin', pin); await page.click('#unlockGo'); await wait(700); };

// The PIN in the report's Settings, then a private note in the panel (spec §3.2, §4; F3, F8).
export async function pinSetChecks(t, rep, pan) {
  const { check, store, wait, iso } = t;
  const sp = await openPin(t);
  check('PIN', 'Settings: no PIN yet, so only Set is offered', /No PIN yet/.test(await sp.textContent('#pinState')) && await sp.isVisible('#pinSet') && !(await sp.isVisible('#pinChange')));
  await sp.fill('#pinNew', '7391'); await sp.click('#pinSet'); await wait(1500);
  const { createdAt, ...rest } = (await security(store)) ?? {};
  check('PIN', 'set a PIN: a salt and verifier are stored, never the PIN (F3)', /PIN set/.test(await sp.textContent('#pinMsg')) && rest.iterations === 310000 && typeof rest.salt === 'string' && !JSON.stringify(rest).includes('7391'), JSON.stringify(rest).slice(0, 200));
  await pan.bringToFront(); await pan.click('#tab-notes'); await wait(600);
  check('Private', 'with a PIN set, the panel offers Private and Lock', await pan.isVisible('#notePrivate') && /Lock private notes/.test(await pan.textContent('#noteLock')));
  await pan.fill('#noteTitle', 'Salary talk'); await pan.fill('#noteBody', 'Ask for 10%'); await pan.fill('#noteDay', iso.today); await pan.check('#notePrivate');
  await pan.click('#panel-notes .note-add button.primary'); await wait(800);
  const st = await store(); const p = st.notes.find(n => n.enc);
  check('Private', 'a private note is ciphertext at rest: no title or body anywhere in storage (F3)', p?.title === '' && p.body === '' && p.day === iso.today && !JSON.stringify(st).includes('Salary') && !JSON.stringify(st).includes('Ask for 10'), JSON.stringify(p));
  check('Private', 'unlocked, the panel shows its title and body', /Ask for 10%/.test(await card(pan, 'Salary talk').textContent()));
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
  const sp = await openPin(t); await sp.fill('#pinCurrent', '7391'); await sp.fill('#pinNew', '24680'); await sp.click('#pinChange'); await wait(2000);
  check('PIN', 'change PIN re-encrypts private notes (F3)', /PIN changed/.test(await sp.textContent('#pinMsg')) && (await store()).notes.find(n => n.enc).enc.ct !== ct0, await sp.textContent('#pinMsg'));
  await pan.bringToFront(); await pan.click('#noteLock'); await wait(500); await pan.click('#noteLock'); await wait(300);
  for (const pin of ['7391', '1111', '2222', '3333', '4444']) await tryPin(pan, pin, wait);
  const s = await security(store);
  check('PIN', 'the old PIN fails; 5 wrong PINs pause unlocking for 30 s (F3)', s.failedAttempts === 5 && s.lockedUntil - Date.now() > 20000 && /Too many wrong PINs\. Try again in \d+ s/.test(await pan.textContent('#unlockErr')), JSON.stringify({ f: s.failedAttempts, l: s.lockedUntil - Date.now() }));
  await tryPin(pan, '24680', wait);
  check('PIN', 'during the pause even the right PIN is refused, and not counted', /Too many wrong PINs/.test(await pan.textContent('#unlockErr')) && (await security(store)).failedAttempts === 5);
  await pan.keyboard.press('Escape');
  // Lift the pause rather than wait 30 s: the worker reads the record afresh on every try.
  await sw.evaluate(() => chrome.storage.local.get('security').then(({ security: sec }) => chrome.storage.local.set({ security: { ...sec, failedAttempts: 0, lockedUntil: 0 } })));
  const sp2 = await openPin(t); await sp2.fill('#pinCurrent', '24680'); await sp2.click('#pinRemove'); await wait(1500);
  const st = await store(); const back = st.notes.find(n => n.title === 'Salary talk');
  check('PIN', 'remove PIN: private notes become ordinary ones and the record is gone (F3)', back?.enc === null && back.body === 'Ask for 12%' && !('security' in st) && /PIN removed/.test(await sp2.textContent('#pinMsg')), JSON.stringify(back));
  await wait(300);
  check('Private', 'with no PIN, the panel offers neither Private nor Lock', !(await pan.isVisible('#notePrivate')) && !(await pan.isVisible('#noteLock')));
  await pan.fill('#noteBody', 'Plain after PIN'); await pan.click('#panel-notes .note-add button.primary'); await wait(600);
  check('Private', 'after the PIN is removed, a plain note adds without touching the hidden Private box', (await store()).notes.some(n => n.body === 'Plain after PIN' && n.enc === null));
  await card(pan, 'Plain after PIN').locator('button.delete').click(); await wait(400);
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
  check('On-page', 'where Weekly may not run, the panel opens its Notes tab instead (F4 fallback)', await pan.getAttribute('#tab-notes', 'aria-selected') === 'true' && /press Alt\+N/i.test(await pan.textContent('#noteMsg'))
    && !(await dev.evaluate(() => !!document.getElementById('weekly-note-host'))), await pan.textContent('#noteMsg'));
}
