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

test('notes:list carries the theme as data, since the page’s note cannot load Weekly’s styles (F6)', async () => {
  assert.equal((await ask({ type: 'notes:list' })).theme, 'system');
  await chrome.storage.local.set({ settings: { theme: 'dark' } });
  assert.equal((await ask({ type: 'notes:list' })).theme, 'dark');
  await chrome.storage.local.remove('settings');
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

test('the on-page note’s copied category list equals CATEGORIES (a classic script cannot import it)', async () => {
  const { readFileSync } = await import('node:fs');
  const { CATEGORIES } = await import('../../src/lib/note-views.js');
  const src = readFileSync(new URL('../../src/content/onpage-note.js', import.meta.url), 'utf8');
  const m = /const CATEGORIES = \[([^\]]*)\]/.exec(src);
  assert.ok(m, 'onpage-note.js declares its CATEGORIES');
  assert.deepEqual([...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]), [...CATEGORIES]);
});

test('a pending Notes tab survives another extension page answering panel:show; hello still gets it once', async () => {
  const { setTimeout: sleep } = await import('node:timers/promises');
  onpage.onNoteCommand({ id: 9, windowId: 1, url: 'chrome://settings/' });
  await sleep(5); // the stub's sendMessage resolves: some other Weekly page "listened"
  const panel = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/panel/panel.html' };
  assert.deepEqual(await ask({ type: 'panel:hello' }, panel), { ok: true, tab: 'notes' });
  assert.deepEqual(await ask({ type: 'panel:hello' }, panel), { ok: true, tab: null });
});

test('Alt+N: a tab whose url is an empty string is treated like one with no url (T5-d)', async () => {
  const { setTimeout: sleep } = await import('node:timers/promises');
  stub.log.panelsOpened.length = 0;
  const before = stub.log.scripts.length;
  onpage.onNoteCommand({ id: 9, windowId: 1, url: '' });
  await sleep(5);
  assert.equal(stub.log.scripts.length, before + 1, 'injection attempted');
  assert.equal(stub.log.panelsOpened.length, 0);
});

test('Alt+N without the tabs permission: a tab with no url still gets the injection; the panel only if it throws (P5-H5)', async () => {
  const { setTimeout: sleep } = await import('node:timers/promises');
  stub.log.panelsOpened.length = 0;
  onpage.onNoteCommand({ id: 9, windowId: 1 });   // Chrome omits tab.url without `tabs`; activeTab covers the command's tab
  await sleep(5);
  assert.equal(stub.log.scripts.length, 1, 'injection attempted');
  assert.equal(stub.log.panelsOpened.length, 0, 'and it worked, so no panel');
  stub.setInjectFails(true);
  onpage.onNoteCommand({ id: 9, windowId: 1 });
  await sleep(5);
  assert.equal(stub.log.scripts.length, 2);
  assert.equal(stub.log.panelsOpened.length, 1, 'injection threw: side panel on Notes');
});
