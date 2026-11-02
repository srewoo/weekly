// The three backup formats (D11, F7; spec §4 Import), read from real files made by
// Daybook's and ForgetMeNot's own export code (test/fixtures), and Weekly's own.
// Everything in a file is untrusted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installChromeStub } from './helpers/chrome-stub.js';

installChromeStub();
const { readBackup, describeBackup, replaces, cleanEntry } = await import('../src/lib/backup.js');
const { exportPayload } = await import('../src/lib/portability.js');
const { importableSettings } = await import('../src/lib/settings.js');
const { verify, openNote, createSecurity, sealNote } = await import('../src/lib/crypto.js');
const { coerceTask } = await import('../src/lib/schema.js');
const { coerceNote } = await import('../src/lib/note-views.js');

const fixture = (/** @type {string} */ name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('a Daybook backup, made by Daybook’s own export, is read as tasks; a bare array works too', () => {
  const b = readBackup(fixture('daybook-backup.json'), 'me');
  assert.equal(b.format, 'daybook');
  assert.deepEqual(b.carries, { tasks: true, notes: false, settings: false });
  assert.deepEqual(b.tasks.map((t) => t.title), ['Renew the SSL certificate', 'Book the team offsite', 'Read the Raft paper']);
  assert.equal(b.tasks[1]?.status, 'done');
  assert.equal(b.tasks[0]?.dueDate, '2026-11-03');
  assert.ok(b.tasks.every((t) => t.repeat === null && t.doneDates.length === 0));
  assert.equal(readBackup(JSON.stringify([{ title: 'hand rolled' }]), 'me').tasks.length, 1);
  assert.deepEqual(describeBackup(b), ['A Daybook backup: 3 tasks.']);
  assert.equal(replaces(b), 'tasks');
  const ids = JSON.parse(fixture('daybook-backup.json')).tasks.map((/** @type {{ id: string }} */ t) => t.id);
  assert.deepEqual(b.tasks.map((t) => t.id), ids, 'every task id survives, so re-importing the real file is idempotent');
});

test('a ForgetMeNot export, made by ForgetMeNot: plain notes, the private one kept sealed with its title aside, the PIN record', () => {
  const b = readBackup(fixture('forgetmenot-backup.json'), 'me');
  assert.equal(b.format, 'forgetmenot');
  assert.deepEqual(b.notes.map((n) => [n.title, n.category, n.pinned, n.done]), [['Raft paper', 'To-Read', false, true], ['Vendor call', 'Work', true, false]]);
  assert.equal(b.sealed.length, 1);
  assert.equal(b.sealed[0]?.title, 'Salary talk');
  assert.deepEqual([b.sealed[0]?.note.title, b.sealed[0]?.note.body, b.sealed[0]?.note.category], ['', '', 'Personal'], 'no plain text in the note itself');
  assert.equal(b.security?.iterations, 310000);
  assert.ok(!('private' in (b.sealed[0]?.note ?? {})), 'ForgetMeNot’s private flag is mapped to enc');
  assert.deepEqual(describeBackup(b), ['A ForgetMeNot backup: 3 notes (1 private).']);
  assert.equal(replaces(b), 'notes');
  // P5-H8: every note id in the real file survives coerceNote unchanged, so re-importing it is idempotent.
  const raw = JSON.parse(fixture('forgetmenot-backup.json')).notes;
  const ids = raw.map((/** @type {{ id: string }} */ n) => n.id);
  assert.deepEqual(raw.map((/** @type {unknown} */ n) => coerceNote(n)?.id), ids);
  assert.deepEqual([...b.sealed.map((s) => s.note), ...b.notes].map((n) => n.id), ids);
});

test('the private ForgetMeNot note opens with its PIN through Weekly’s crypto, title and body', async () => {
  const b = readBackup(fixture('forgetmenot-backup.json'), 'me');
  const key = await verify('1234', b.security);
  assert.ok(key, 'ForgetMeNot’s verifier is accepted');
  const s = b.sealed[0];
  assert.ok(s?.note.enc);
  assert.deepEqual(await openNote(key, s.note.enc, s.title), { title: 'Salary talk', body: 'Ask for the 10% raise in March' });
  assert.equal(await verify('4321', b.security), null);
});

test('export: activity, tasks, notes as stored, the PIN record and settings, but never the Slack webhook (F7)', () => {
  const out = exportPayload({ 'day:2026-10-30': {}, 'meta:2026-10-30': {}, notes: [], tasks: [], security: { salt: 's' }, deviceId: 'd1',
    settings: { role: 'hr', slackWebhook: 'https://hooks.slack.com/services/secret' }, uiState: {}, 'draft:x:y': 'z', 'hist:2026-10-30': {} });
  assert.deepEqual(Object.keys(out).sort(), ['app', 'day:2026-10-30', 'deviceId', 'meta:2026-10-30', 'notes', 'security', 'settings', 'tasks', 'version']);
  assert.deepEqual(out.settings, { role: 'hr' });
  assert.equal(out.app, 'Weekly');
});

test('a Weekly 3 export comes back whole: tasks, notes, private notes with the PIN record, settings, activity', async () => {
  const sec = await createSecurity('2468');
  const key = await verify('2468', sec);
  assert.ok(key);
  const priv = { id: 'n_priv', title: '', body: '', category: 'Work', enc: await sealNote(key, { title: 'Offer', body: 'Numbers' }), createdAt: 1, updatedAt: 1 };
  const file = JSON.stringify(exportPayload({ deviceId: 'laptop-2', security: sec, settings: { theme: 'dark', slackWebhook: 'x' },
    tasks: [coerceTask({ id: 't_a', title: 'Ship it' })], notes: [{ id: 'n_a', title: 'Plain', body: 'b' }, priv],
    'day:2026-10-30': { 'jira:X-1': { category: 'Tickets', task: 'X-1', url: 'https://x.test', ms: 60000 } } }));
  const b = readBackup(file, 'this-browser');
  assert.deepEqual([b.format, b.own, b.deviceId, b.days], ['weekly', false, 'laptop-2', 1]);
  assert.deepEqual(b.tasks.map((t) => t.id), ['t_a']);
  assert.deepEqual(b.notes.map((n) => n.id), ['n_a']);
  assert.equal(b.sealed[0]?.note.id, 'n_priv');
  assert.equal(b.sealed[0]?.title, '', 'Weekly seals the title inside the ciphertext');
  assert.equal(b.security?.salt, sec.salt);
  assert.deepEqual(b.settings, { theme: 'dark' });
  assert.equal(b.activity['imp:laptop-2:2026-10-30']?.['jira:X-1']?.ms, 60000);
  assert.deepEqual(describeBackup(b), ['A Weekly export: 1 task, 2 notes (1 private), 1 day of activity and settings.']);
  assert.equal(replaces(b), 'tasks, notes and settings');
});

test('this browser’s own export: tasks, notes and settings come in, its activity is already here', () => {
  const b = readBackup(JSON.stringify({ deviceId: 'me', 'day:2026-10-30': { a: { ms: 5 } }, notes: [{ id: 'n_1', body: 'x', enc: { iv: 'AAAA', ct: 'BBBB' } }] }), 'me');
  assert.deepEqual([b.own, b.deviceId, b.days, Object.keys(b.activity).length], [true, null, 0, 0]);
  assert.deepEqual(describeBackup(b), ['A Weekly export from this browser: 1 note (1 private).',
    'Its activity is already here, so only tasks, notes and settings come in.',
    '1 private note can’t be opened without the file’s PIN record, so they are left out.']);
});

test('__proto__, constructor and prototype keys never reach Object.prototype, anywhere in a file', () => {
  const p = '"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}';
  const text = `{"deviceId":"d3",${p},"settings":{${p},"role":"hr"},"tasks":[{${p},"title":"T"}],`
    + `"notes":[{${p},"title":"N"}],"day:2026-10-30":{${p},"ok":{"category":"X","task":"t","url":"","ms":5}}}`;
  const b = readBackup(text, 'me');
  assert.equal(/** @type {any} */ ({}).polluted, undefined);
  assert.deepEqual(Object.keys(b.activity['imp:d3:2026-10-30'] ?? {}), ['ok']);
  assert.deepEqual(b.settings, { role: 'hr' });
  assert.equal(Object.getPrototypeOf(b.settings), Object.prototype);
  assert.deepEqual([b.tasks[0]?.title, b.notes[0]?.title], ['T', 'N']);
  const fmn = readBackup(`{"app":"ForgetMeNot","notes":[{${p},"title":"F","body":"b"}]}`, 'me');
  assert.equal(fmn.notes[0]?.title, 'F');
  assert.equal(/** @type {any} */ ({}).polluted, undefined);
});

test('refused in words: broken JSON, a file that is no backup, a newer ForgetMeNot, an empty Daybook backup, no device ID', () => {
  assert.throws(() => readBackup('{nope', 'me'), /Not a valid export file/);
  assert.throws(() => readBackup('"text"', 'me'), /Not a valid export file/);
  assert.throws(() => readBackup('{"hello":"world"}', 'me'), /isn’t a Weekly, Daybook or ForgetMeNot backup/);
  assert.throws(() => readBackup('{"app":"ForgetMeNot","schemaVersion":3,"notes":[]}', 'me'), /newer version of ForgetMeNot/);
  assert.throws(() => readBackup('{"app":"Weekly","version":4,"deviceId":"d1"}', 'me'), /^Error: This file was made by a newer version of Weekly\. Update Weekly first\.$/);
  assert.throws(() => readBackup('{"app":"ForgetMeNot","notes":"x"}', 'me'), /not a valid ForgetMeNot backup/);
  assert.throws(() => readBackup('{"format":"daybook.tasks","tasks":[]}', 'me'), /no tasks/);
  assert.throws(() => readBackup('{"format":"daybook.tasks","tasks":[7,8]}', 'me'), /That file has no tasks in it\./, 'damaged entries only: Replace would swap every task for nothing');
  assert.throws(() => readBackup('{"app":"ForgetMeNot","schemaVersion":"9","notes":[]}', 'me'), /not a valid ForgetMeNot backup/);
  assert.throws(() => readBackup('{"app":"ForgetMeNot","schemaVersion":1.5,"notes":[]}', 'me'), /not a valid ForgetMeNot backup/);
  assert.throws(() => readBackup('{"notes":[]}', 'me'), /no device ID/);
});

test('damaged records are counted and left out, never half-imported', () => {
  const b = readBackup(JSON.stringify({ deviceId: 'd4', tasks: [{ title: 'ok' }, { title: '' }, 7], notes: [{ title: 'ok' }, {}, 'x'],
    security: { salt: 'AAAA', iterations: 1000, verifier: { iv: 'AAAA', ct: 'BBBB' } } }), 'me');
  assert.deepEqual([b.tasks.length, b.notes.length, b.dropped], [1, 1, 4]);
  const dup = readBackup(JSON.stringify({ deviceId: 'd5', tasks: [{ id: 't1', title: 'a' }, { id: 't1', title: 'b' }] }), 'me');
  assert.deepEqual([dup.tasks.length, dup.dropped], [1, 1], 'a duplicate task id is counted, not dropped silently');
  assert.ok(describeBackup(dup).includes('1 damaged entry left out.'));
  // An old or partial Weekly export without a notes list must not let Replace wipe the notes.
  const noNotes = readBackup('{"deviceId":"x","day:2026-10-30":{"a":{"ms":5}}}', 'me');
  assert.deepEqual(noNotes.carries, { tasks: false, notes: false, settings: false });
  assert.equal(replaces(noNotes), '');
  assert.deepEqual(describeBackup(noNotes), ['A Weekly export: 1 day of activity.']);
  assert.equal(b.security, null, 'a PIN record with a weak work factor is refused');
  assert.equal(cleanEntry({ ms: -1 }), null);
});

test('importable settings: only keys Weekly knows, of the right type, lists and strings capped, never the webhook', () => {
  const s = importableSettings({ role: 'sales', paused: 'yes', idleSeconds: 60, slackWebhook: 'https://hooks.slack.com/services/x', unknown: 1,
    rules: ['a => B', 5, { x: 1 }, 'c'.repeat(900)], days: [1, 2, 'x'], morning: { enabled: false, time: '07:00' } });
  assert.deepEqual(s, { idleSeconds: 60, rules: ['a => B', 'c'.repeat(300)], role: 'sales', morning: { enabled: false, time: '07:00' }, days: [1, 2] });
  assert.equal(importableSettings('x'), null);
  const slot = importableSettings(JSON.parse('{"morning":{"__proto__":{"polluted":true},"enabled":"no","time":"08:00","extra":1},"evening":{"constructor":{"prototype":{"polluted":true}}}}'));
  assert.deepEqual(slot, { morning: { time: '08:00' }, evening: {} }, 'a slot keeps only its own keys, of its default’s type');
  assert.equal(Object.getPrototypeOf(slot?.['morning']), Object.prototype);
  assert.equal(/** @type {any} */ ({}).polluted, undefined);
});
