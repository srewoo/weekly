// The worker's PIN broker (F3, spec §4 Private notes): the key lives only in this
// module's memory; storage holds a salt and a verifier, never the PIN, and a
// private note's title and body only as ciphertext.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

const stub = installChromeStub();
const broker = await import('../../src/background/crypto-broker.js');
const { createNote, getNotes, deleteNote } = await import('../../src/lib/notes.js');

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

/** Save a private note the way the pages do: the worker seals and stores it in one step. */
async function privateNote(title = 'Salary talk', body = 'Ask for 10%') {
  const r = await ask({ type: 'crypto:save', id: null, title, body, category: 'Personal', day: null });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.note;
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
  assert.deepEqual(await ask({ type: 'crypto:save', id: null, title: 't', body: 'b' }), { ok: false, locked: true });
  assert.equal('notes' in stub.stores.local, false, 'locked: nothing is stored');
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
  assert.equal((await ask({ type: 'crypto:save', id: null, title: '', body: 'x' })).ok, true, 'use within 5 minutes keeps it');
  later(4 * 60e3);
  assert.equal((await ask({ type: 'crypto:status' })).unlocked, true, 'idle counts from the last use');
  later(60e3 + 1);
  assert.deepEqual(await ask({ type: 'crypto:save', id: null, title: '', body: 'x' }), { ok: false, locked: true });
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
  assert.deepEqual(await ask({ type: 'crypto:save', id: null, title: 't', body: 'b' }, page), { ok: false, error: 'Not allowed.' });
  assert.equal('notes' in stub.stores.local, false);
  assert.deepEqual(await ask({ type: 'crypto:status' }, { id: 'other-extension', url: 'chrome-extension://other/x.html' }), { ok: false, error: 'Not allowed.' });
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

test('crypto:save seals and stores in one step: a new note, then an edit of it; ciphertext only (R3)', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  const n = await privateNote();
  assert.ok(n?.enc && n.title === '' && n.body === '' && n.category === 'Personal');
  const r = await ask({ type: 'crypto:save', id: n.id, title: 'Salary talk', body: 'Ask for 12%', category: 'Work', day: '2026-03-02' });
  assert.equal(r.ok, true);
  const [after] = await getNotes();
  assert.deepEqual(after && [after.id, after.category, after.day, after.enc?.ct !== n.enc.ct], [n.id, 'Work', '2026-03-02', true]);
  assert.equal(JSON.stringify(stub.stores.local).includes('12%'), false);
  const d = await ask({ type: 'crypto:decrypt', items: [{ id: n.id, enc: after?.enc }] });
  assert.deepEqual(d.plain[n.id], { title: 'Salary talk', body: 'Ask for 12%' });
});

test('crypto:save turns a plain note private, and says when the note is gone (R3)', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  const plain = await createNote({ title: 'Was plain', body: 'Now secret' });
  assert.ok(plain);
  assert.equal((await ask({ type: 'crypto:save', id: plain.id, title: 'Was plain', body: 'Now secret', category: 'General', day: null })).ok, true);
  assert.equal(JSON.stringify(stub.stores.local).includes('secret'), false);
  await deleteNote(plain.id);
  assert.deepEqual(await ask({ type: 'crypto:save', id: plain.id, title: 'x', body: 'y', category: 'General', day: null }), { ok: false, gone: true });
});

test('a PIN change sent right after a save cannot leave that note under the old key (R3)', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  const saving = ask({ type: 'crypto:save', id: null, title: 'Race', body: 'Sealed then rekeyed', category: 'General', day: null });
  const changing = ask({ type: 'crypto:changePin', pin: '7391', next: '2468' });
  assert.equal((await saving).ok, true);
  assert.deepEqual(await changing, { ok: true });
  await ask({ type: 'crypto:lock' });
  await ask({ type: 'crypto:unlock', pin: '2468' });
  const items = (await getNotes()).map((n) => ({ id: n.id, enc: n.enc }));
  assert.deepEqual(Object.values((await ask({ type: 'crypto:decrypt', items })).plain), [{ title: 'Race', body: 'Sealed then rekeyed' }]);
});

test('a damaged PIN record with private notes behind it: a new PIN is refused, nothing written (R2)', async () => {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  await privateNote();
  stub.stores.local.security = { ...stub.stores.local.security, salt: 'short' };
  const before = JSON.stringify(stub.stores.local);
  assert.deepEqual(await ask({ type: 'crypto:setPin', pin: '1111' }), { ok: false, error: 'Your PIN record is damaged, so a new PIN can’t be set without losing your private notes.' });
  assert.equal(JSON.stringify(stub.stores.local), before);
  await getNotes().then((ns) => Promise.all(ns.map((n) => deleteNote(n.id))));
  assert.deepEqual(await ask({ type: 'crypto:setPin', pin: '1111' }), { ok: true }, 'with no private note at stake, a new PIN replaces the damaged record');
});
