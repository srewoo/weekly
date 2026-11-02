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

test('mergeNoteLists adds new ids, keeps the newer of two, and is idempotent', async () => {
  const mine = await notes.createNote({ body: 'mine' });
  assert.ok(mine);
  const clean = (/** @type {unknown[]} */ list) => list.map((n) => notes.coerceNote(n)).filter((n) => n !== null);
  const incoming = clean([{ ...mine, body: 'older', updatedAt: mine.updatedAt - 1 }, { id: 'w2-1', title: '', body: 'from the laptop', updatedAt: 5 }]);
  const once = notes.mergeNoteLists([mine], incoming);
  assert.equal(once.added, 1);
  const twice = notes.mergeNoteLists(once.notes, incoming);
  assert.equal(twice.added, 0);
  assert.equal(twice.notes.find((x) => x.id === mine.id)?.body, 'mine');
  assert.equal(twice.notes.length, 2);
  const newer = notes.mergeNoteLists(twice.notes, clean([{ ...mine, body: 'newer', updatedAt: mine.updatedAt + 1 }]));
  assert.equal(newer.added, 0);
  assert.equal(newer.notes.find((x) => x.id === mine.id)?.body, 'newer');
});

test('mergeNoteLists never lets a plain note replace a private one with the same id (R1)', () => {
  const priv = { id: 'n_same', title: '', body: '', category: 'General', pinned: false, done: false, createdAt: 1, updatedAt: 1, completedAt: null, day: null, enc: CIPHER };
  const plain = { ...priv, title: 'Leaked?', body: 'plain', enc: null, updatedAt: 99 };
  const { notes: out, added } = notes.mergeNoteLists([priv], [plain]);
  assert.deepEqual([out, added], [[priv], 0]);
  const newer = { ...priv, enc: { ...CIPHER, iv: 'BBBBBBBBBBBBBBBB' }, updatedAt: 2 };
  assert.deepEqual(notes.mergeNoteLists([priv], [newer]).notes, [newer], 'a newer private one still wins');
});

test('transformNotes: `also` is written with the notes but can never overwrite them (R4)', async () => {
  await notes.createNote({ body: 'kept' });
  await notes.transformNotes(async (cur) => ({ notes: cur, also: { notes: [], extra: 1 } }));
  assert.deepEqual([(await notes.getNotes()).map((n) => n.body), stub.stores.local.extra], [['kept'], 1]);
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
