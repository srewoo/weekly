// Private notes from a backup (D11, F7; spec §4: "if a security record already
// exists, the user confirms which PIN wins"). The worker opens them with the file's
// PIN, seals them again (title and body together) under the PIN that wins, and
// writes them with the record in one go, or writes nothing.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installChromeStub } from '../helpers/chrome-stub.js';

const stub = installChromeStub();
const broker = await import('../../src/background/crypto-broker.js');
const { createNote, getNotes } = await import('../../src/lib/notes.js');
const { readBackup } = await import('../../src/lib/backup.js');

const PAGE = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/report/report.html' };
/** @param {Record<string, unknown>} msg */
const ask = (msg, sender = PAGE) => broker.handle(msg, sender);
const FMN = readBackup(readFileSync(new URL('../fixtures/forgetmenot-backup.json', import.meta.url), 'utf8'), 'me');
/** @param {Record<string, unknown>} extra @param {{ id: string, url: string }} [sender] */
const importFmn = (extra, sender = PAGE) => ask({ type: 'crypto:import', mode: 'merge', security: FMN.security, notes: FMN.notes, sealed: FMN.sealed, pin: '1234', ...extra }, sender);
/** Every private note, opened by the worker's current key. */
async function opened() {
  const items = (await getNotes()).filter((n) => n.enc).map((n) => ({ id: n.id, enc: n.enc }));
  return Object.values((await ask({ type: 'crypto:decrypt', items })).plain ?? {});
}
async function myPrivateNote() {
  await ask({ type: 'crypto:setPin', pin: '7391' });
  const r = await ask({ type: 'crypto:save', id: null, title: 'Mine', body: 'My secret', category: 'Personal', day: null });
  assert.equal(r.ok, true, JSON.stringify(r));
}

beforeEach(() => {
  for (const k of Object.keys(stub.stores.local)) delete stub.stores.local[k];
  broker.lock();
});

test('no PIN here: the file’s PIN record is adopted; ForgetMeNot’s private note is sealed again, title and body together', async () => {
  assert.deepEqual(await importFmn({}), { ok: true, added: 3, tasks: 0, days: 0 });
  assert.equal(stub.stores.local.security.salt, FMN.security?.salt);
  const priv = (await getNotes()).find((n) => n.enc);
  assert.ok(priv && priv.enc?.ct !== FMN.sealed[0]?.note.enc?.ct, 'sealed again, not copied');
  assert.equal(JSON.stringify(stub.stores.local).includes('Salary'), false, 'the plain title is not stored');
  assert.deepEqual(await opened(), [{ title: 'Salary talk', body: 'Ask for the 10% raise in March' }]);
  assert.deepEqual(await importFmn({}), { ok: true, added: 0, tasks: 0, days: 0 }, 'importing twice adds nothing; the same PIN record needs no second PIN');
});

test('a wrong PIN for the file writes nothing', async () => {
  const r = await importFmn({ pin: '9999' });
  assert.deepEqual(r, { ok: false, error: 'That isn’t the PIN the file’s private notes were locked with.' });
  assert.deepEqual(Object.keys(stub.stores.local), []);
});

test('a PIN here, keep mine: the file’s private notes move to my PIN; my record stays', async () => {
  await myPrivateNote();
  const mySalt = stub.stores.local.security.salt;
  assert.deepEqual(await importFmn({ localPin: '7391', keep: 'mine' }), { ok: true, added: 3, tasks: 0, days: 0 });
  assert.equal(stub.stores.local.security.salt, mySalt);
  broker.lock();
  assert.equal((await ask({ type: 'crypto:unlock', pin: '7391' })).ok, true);
  assert.deepEqual((await opened()).map((p) => p?.title).sort(), ['Mine', 'Salary talk']);
});

test('a PIN here, keep the file’s: my private notes move to the file’s PIN as well', async () => {
  await myPrivateNote();
  assert.deepEqual(await importFmn({ localPin: '7391', keep: 'theirs' }), { ok: true, added: 3, tasks: 0, days: 0 });
  assert.equal(stub.stores.local.security.salt, FMN.security?.salt);
  broker.lock();
  assert.equal((await ask({ type: 'crypto:unlock', pin: '7391' })).ok, false);
  assert.equal((await ask({ type: 'crypto:unlock', pin: '1234' })).ok, true);
  assert.deepEqual((await opened()).map((p) => p?.title).sort(), ['Mine', 'Salary talk']);
});

test('a PIN here: mine is checked through the lockout, and a wrong one writes nothing', async () => {
  await myPrivateNote();
  const before = JSON.stringify(stub.stores.local.notes);
  const r = await importFmn({ localPin: '0000', keep: 'mine' });
  assert.equal(r.error, 'Wrong PIN.');
  assert.equal(stub.stores.local.security.failedAttempts, 1);
  assert.equal(JSON.stringify(stub.stores.local.notes), before);
});

test('replace: the file’s notes replace mine and its PIN record wins, without asking for mine', async () => {
  await myPrivateNote();
  await createNote({ title: 'Plain of mine' });
  assert.deepEqual(await importFmn({ mode: 'replace' }), { ok: true, added: 3, tasks: 0, days: 0 });
  assert.deepEqual((await getNotes()).map((n) => n.title).sort(), ['', 'Raft paper', 'Vendor call']);
  assert.equal(stub.stores.local.security.salt, FMN.security?.salt);
});

test('only Weekly’s own pages may import; a damaged or weak PIN record is refused', async () => {
  assert.equal((await importFmn({}, { id: 'weekly', url: 'https://example.com/' })).error, 'Not allowed.');
  assert.deepEqual(Object.keys(stub.stores.local), [], 'a refused sender writes nothing');
  const weak = { ...FMN.security, iterations: 1000 };
  assert.equal((await importFmn({ security: weak })).error, 'The file’s PIN record is damaged, so its private notes can’t be opened.');
  assert.deepEqual(Object.keys(stub.stores.local), []);
});

test('an adopted PIN record starts with no wrong PINs and no lockout (R5)', async () => {
  const tired = { ...FMN.security, failedAttempts: 6, lockedUntil: Date.now() + 60_000 };
  assert.deepEqual(await importFmn({ security: tired }), { ok: true, added: 3, tasks: 0, days: 0 });
  assert.equal(stub.stores.local.security.failedAttempts, 0);
  assert.equal(stub.stores.local.security.lockedUntil, 0);
});

test('my PIN record is damaged while private notes depend on it: the import is refused and writes nothing (R2)', async () => {
  await myPrivateNote();
  stub.stores.local.security = { ...stub.stores.local.security, iterations: 'lots' };
  const before = JSON.stringify(stub.stores.local);
  assert.deepEqual(await importFmn({}), { ok: false, error: 'Your PIN record is damaged, so this file’s private notes can’t be imported without losing your private notes.' });
  assert.equal(JSON.stringify(stub.stores.local), before);
});

test('a private note the file’s key cannot open stops the whole import (nothing written)', async () => {
  const bad = [{ note: { ...FMN.sealed[0]?.note, enc: { iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAAAA' } }, title: 'x' }];
  assert.deepEqual(await importFmn({ sealed: bad }), { ok: false, error: 'A private note in the file could not be opened, so nothing was imported.' });
  assert.deepEqual(Object.keys(stub.stores.local), []);
});

test('a finished import tells open pages to re-sync (crypto:changed)', async () => {
  stub.log.messages.length = 0;
  await importFmn({ pin: '0000' });
  assert.equal(stub.log.messages.length, 0, 'a refused import changes nothing');
  await importFmn({});
  assert.deepEqual(stub.log.messages, [{ type: 'crypto:changed' }]);
});

/** My record is the file's (an earlier import adopted it): the file is my own backup. */
async function ownBackup() {
  assert.deepEqual(await importFmn({}), { ok: true, added: 3, tasks: 0, days: 0 });
  broker.lock();
}

for (const mode of ['merge', 'replace']) {
  test(`my own backup (${mode}): its PIN is mine, so a wrong one is counted by the lockout and writes nothing (T7-I1)`, async () => {
    await ownBackup();
    const before = JSON.stringify(stub.stores.local.notes);
    assert.equal((await importFmn({ mode, pin: '9999' })).error, 'Wrong PIN.');
    assert.equal(stub.stores.local.security.failedAttempts, 1);
    assert.equal(JSON.stringify(stub.stores.local.notes), before);
  });

  test(`my own backup (${mode}): while locked out even the right PIN is refused (T7-I1)`, async () => {
    await ownBackup();
    for (let i = 0; i < 5; i++) await importFmn({ mode, pin: '9999' });
    const sec = JSON.stringify(stub.stores.local.security);
    const r = await importFmn({ mode });
    assert.equal(r.error, 'Too many wrong PINs.');
    assert.equal(JSON.stringify(stub.stores.local.security), sec, 'the lockout is not cleared');
  });

  test(`my own backup (${mode}): the right PIN imports, and the file's copy of my record is not written (T7-I1)`, async () => {
    await ownBackup();
    const sec = JSON.stringify(stub.stores.local.security);
    const r = await importFmn({ mode, security: { ...FMN.security, createdAt: 1, failedAttempts: 3 } });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(JSON.stringify(stub.stores.local.security), sec);
  });
}

test('replace goes ahead over a damaged PIN record: the file’s record is adopted (T7-C1)', async () => {
  await myPrivateNote();
  stub.stores.local.security = { ...stub.stores.local.security, iterations: 'lots' };
  assert.deepEqual(await importFmn({ mode: 'replace' }), { ok: true, added: 3, tasks: 0, days: 0 });
  assert.equal(stub.stores.local.security.salt, FMN.security?.salt);
});

test('keep the file’s, but one of my private notes cannot be opened: refused in import words, nothing written (m3)', async () => {
  await myPrivateNote();
  stub.stores.local.notes[0].enc = { iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAAAA' };
  const before = JSON.stringify(stub.stores.local);
  assert.deepEqual(await importFmn({ localPin: '7391', keep: 'theirs' }), { ok: false, error: 'One of your private notes could not be opened, so nothing was imported.' });
  assert.equal(JSON.stringify(stub.stores.local), before);
});

test('a file with more than 10,000 notes is refused in words, not cut short (m4)', async () => {
  const many = Array.from({ length: 10001 }, (_, i) => ({ ...FMN.notes[0], id: `n_${i}` }));
  assert.deepEqual(await importFmn({ notes: many }), { ok: false, error: 'The file holds more than 10,000 notes, so nothing was imported.' });
  assert.deepEqual(Object.keys(stub.stores.local), []);
});

test('a PIN here and no (or a bad) choice of which wins: mine wins (m5)', async () => {
  for (const keep of [undefined, 'nonsense']) {
    for (const k of Object.keys(stub.stores.local)) delete stub.stores.local[k];
    broker.lock();
    await myPrivateNote();
    const mySalt = stub.stores.local.security.salt;
    assert.deepEqual(await importFmn({ localPin: '7391', keep }), { ok: true, added: 3, tasks: 0, days: 0 });
    assert.equal(stub.stores.local.security.salt, mySalt);
    broker.lock();
    await ask({ type: 'crypto:unlock', pin: '7391' });
    assert.deepEqual((await opened()).map((p) => p?.title).sort(), ['Mine', 'Salary talk']);
  }
});
