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

test('a private note with the ciphertext of a maximal multibyte body survives coercion; blank Weekly 2 notes and fractional ids do not become notes', () => {
  const ct = 'QUJD'.repeat(25000);
  assert.equal(ct.length, 100000);
  assert.deepEqual(coerceNote({ id: 'big', enc: { iv: 'AAAAAAAAAAAAAAAA', ct } })?.enc, { iv: 'AAAAAAAAAAAAAAAA', ct });
  assert.equal(coerceNote({ id: 1, ts: 5, text: '  ' }), null);
  assert.equal(coerceNote({ id: 1.5, ts: 5, text: 'x' }), null);
});
