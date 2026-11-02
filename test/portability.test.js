// Writing an import (D11, F7; spec §6: validated first, then written) and Export.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installChromeStub } from './helpers/chrome-stub.js';

let stub = installChromeStub();
const { exportAll, openBackup, applyBackup, MAX_IMPORT_BYTES } = await import('../src/lib/portability.js');
const { readBackup, cleanEntry } = await import('../src/lib/backup.js');

const fixture = (/** @type {string} */ name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
/** A File-like object, as the page hands over. @param {string} text */
const file = (text) => ({ size: text.length, text: async () => text });
const local = () => stub.stores.local;
beforeEach(() => { stub = installChromeStub(); });

test('a file over 20 MB is refused before it is read', async () => {
  await assert.rejects(openBackup(/** @type {any} */ ({ size: MAX_IMPORT_BYTES + 1, text: async () => '{}' })), /File is too large \(max 20 MB\)/);
});

test('a Weekly export from another browser: activity under imp:<device>:<date>, notes merged once; importing again changes nothing', async () => {
  local().deviceId = 'mine';
  const json = JSON.stringify({ deviceId: 'other', 'day:2026-10-30': { a: { category: 'C', task: 't', url: 'javascript:alert(1)', ms: 10 } },
    notes: [{ id: 1, ts: 1, text: 'n1' }], tasks: [{ id: 't_x', title: 'From the laptop' }] });
  const b = await openBackup(/** @type {any} */ (file(json)));
  assert.deepEqual(await applyBackup(b, { mode: 'merge' }), { tasks: 1, notes: 1, days: 1 });
  assert.deepEqual(await applyBackup(b, { mode: 'merge' }), { tasks: 0, notes: 0, days: 1 });
  assert.equal(local()['imp:other:2026-10-30'].a.ms, 10);
  assert.equal(local()['imp:other:2026-10-30'].a.url, '', 'a javascript: URL is dropped');
  assert.deepEqual(local().imports, ['other']);
  assert.deepEqual(local().notes.map((/** @type {{ id: string }} */ n) => n.id), ['w2-1'], 'a Weekly 2 note, converted once');
  assert.deepEqual(local().tasks.map((/** @type {{ id: string }} */ t) => t.id), ['t_x']);
});

test('this browser’s own export restores tasks and notes, and writes no activity', async () => {
  local().deviceId = 'mine';
  const b = await openBackup(/** @type {any} */ (file(JSON.stringify({ deviceId: 'mine', 'day:2026-10-30': { a: { ms: 5 } }, notes: [{ id: 'n_a', title: 'Back' }], tasks: [] }))));
  assert.deepEqual(await applyBackup(b, { mode: 'merge' }), { tasks: 0, notes: 1, days: 0 });
  assert.equal(Object.keys(local()).some((k) => k.startsWith('imp:')), false);
});

test('Replace swaps only what the file carries: a Daybook backup replaces tasks and leaves notes alone', async () => {
  local().tasks = [{ id: 'old', title: 'Mine' }];
  local().notes = [{ id: 'n_keep', title: 'Kept', body: '' }];
  const b = readBackup(fixture('daybook-backup.json'), 'mine');
  assert.deepEqual(await applyBackup(b, { mode: 'replace' }), { tasks: 3, notes: 0, days: 0 });
  assert.deepEqual(local().tasks.map((/** @type {{ title: string }} */ t) => t.title), ['Renew the SSL certificate', 'Book the team offsite', 'Read the Raft paper']);
  assert.deepEqual(local().notes.map((/** @type {{ id: string }} */ n) => n.id), ['n_keep']);
});

test('Merge keeps every task already here; Replace of a Weekly export brings its notes and settings, never a webhook', async () => {
  local().tasks = [{ id: 't_1', title: 'Edited here since' }];
  local().notes = [{ id: 'n_old', title: 'Only here', body: '' }];
  local().settings = { slackWebhook: 'https://hooks.slack.com/services/mine', theme: 'light' };
  const text = JSON.stringify({ deviceId: 'other', tasks: [{ id: 't_1', title: 'Stale copy' }], notes: [{ id: 'n_new', title: 'From the file' }],
    settings: { theme: 'dark', role: 'sales', slackWebhook: 'https://hooks.slack.com/services/theirs' } });
  await applyBackup(readBackup(text, 'mine'), { mode: 'merge' });
  assert.equal(local().tasks[0].title, 'Edited here since');
  assert.equal(local().settings.theme, 'light', 'Merge leaves settings alone');
  await applyBackup(readBackup(text, 'mine'), { mode: 'replace' });
  assert.deepEqual(local().notes.map((/** @type {{ id: string }} */ n) => n.id), ['n_new']);
  assert.deepEqual([local().settings.theme, local().settings.role, local().settings.slackWebhook], ['dark', 'sales', 'https://hooks.slack.com/services/mine']);
});

test('private notes with their PIN record go to the worker; its refusal stops the import before anything is written', async () => {
  const b = readBackup(fixture('forgetmenot-backup.json'), 'mine');
  stub.chrome.runtime.sendMessage = async (/** @type {any} */ m) => (stub.log.messages.push(m), { ok: false, error: 'That isn’t the PIN the file’s private notes were locked with.' });
  await assert.rejects(applyBackup(b, { mode: 'merge', pin: '0000' }), /isn’t the PIN/);
  const sent = /** @type {any} */ (stub.log.messages.at(-1));
  assert.deepEqual([sent.type, sent.pin, sent.sealed.length, sent.notes.length], ['crypto:import', '0000', 1, 2]);
  assert.equal(local().notes, undefined, 'nothing written');
  stub.chrome.runtime.sendMessage = async () => ({ ok: true, added: 3 });
  assert.deepEqual(await applyBackup(b, { mode: 'merge', pin: '1234' }), { tasks: 0, notes: 3, days: 0 });
});

test('a Weekly file whose private notes lack their PIN record imports its plain notes and leaves those out', async () => {
  const b = readBackup(JSON.stringify({ deviceId: 'd2', notes: [{ id: 'n_p', title: 'Plain' }, { id: 'n_s', enc: { iv: 'AAAA', ct: 'BBBB' } }] }), 'mine');
  assert.deepEqual(await applyBackup(b, { mode: 'merge' }), { tasks: 0, notes: 1, days: 0 });
  assert.deepEqual(local().notes.map((/** @type {{ id: string }} */ n) => n.id), ['n_p']);
});

test('cleanEntry caps ms at a day and strings at 500 chars', () => {
  const e = cleanEntry({ category: 'x'.repeat(900), task: 't', url: 'https://a', ms: 9e9 });
  assert.equal(e?.ms, 864e5);
  assert.equal(e?.category.length, 500);
});

test('exportAll reads storage: settings travel without the Slack webhook', async () => {
  Object.assign(local(), { 'day:2026-10-30': { a: 1 }, 'meta:2026-10-30': {}, notes: [], deviceId: 'd1', settings: { slackWebhook: 'secret' } });
  const out = await exportAll();
  assert.deepEqual(Object.keys(out).sort(), ['app', 'day:2026-10-30', 'deviceId', 'meta:2026-10-30', 'notes', 'settings', 'version']);
  assert.deepEqual(out.settings, {});
});

// W1 (spec §6 "validated first, then written once"): an import is one storage write.
const PAGE = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/report/report.html' };
/** Count set() calls; `fail` makes every one throw, as a full quota does. */
function countSets(fail = false) {
  const area = stub.chrome.storage.local, set = area.set;
  const seen = { n: 0, last: /** @type {Record<string, unknown>} */ ({}) };
  area.set = async (/** @type {Record<string, unknown>} */ items) => {
    seen.n++; seen.last = items;
    if (fail) throw new Error('QUOTA_BYTES quota exceeded');
    return set(items);
  };
  return seen;
}
const everything = JSON.stringify({ deviceId: 'other', 'day:2026-10-30': { a: { ms: 5 } }, tasks: [{ id: 't_f', title: 'From the file' }],
  notes: [{ id: 'n_f', title: 'From the file' }], settings: { theme: 'dark' } });

test('an import with tasks, notes, settings and activity is one storage write', async () => {
  local().deviceId = 'mine';
  for (const mode of /** @type {const} */ (['merge', 'replace'])) {
    const seen = countSets();
    await applyBackup(readBackup(everything, 'mine'), { mode });
    assert.equal(seen.n, 1, mode);
  }
  assert.deepEqual([local().tasks[0].id, local().notes[0].id, local().settings.theme, local()['imp:other:2026-10-30'].a.ms], ['t_f', 'n_f', 'dark', 5]);
});

test('a failed write (a full quota) leaves everything as it was', async () => {
  local().tasks = [{ id: 'old', title: 'Mine' }];
  local().notes = [{ id: 'n_keep', title: 'Kept', body: '' }];
  const before = JSON.stringify(local());
  countSets(true);
  await assert.rejects(applyBackup(readBackup(everything, 'mine'), { mode: 'replace' }),
    { message: 'Storage is full, so nothing was imported. Export and delete old weeks, then try again.' });
  assert.equal(JSON.stringify(local()), before);
});

test('private notes: the worker writes tasks, notes and the PIN record in the same write', async () => {
  const broker = await import('../src/background/crypto-broker.js');
  broker.lock();
  stub.chrome.runtime.sendMessage = (/** @type {any} */ m) => broker.handle(m, PAGE);
  const fmn = readBackup(fixture('forgetmenot-backup.json'), 'mine');
  const b = { ...fmn, carries: { ...fmn.carries, tasks: true }, tasks: readBackup(fixture('daybook-backup.json'), 'mine').tasks };
  const seen = countSets();
  assert.deepEqual(await applyBackup(b, { mode: 'merge', pin: '1234' }), { tasks: 3, notes: 3, days: 0 });
  assert.equal(seen.n, 1);
  assert.deepEqual(Object.keys(seen.last).sort(), ['notes', 'schemaVersion', 'security', 'tasks']);
  assert.equal(local().security.salt, fmn.security?.salt);
});
