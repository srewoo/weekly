import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const { mergeTaskLists, deleteEverything } = await import('../src/lib/task-portability.js');
const { writeBackup } = await import('../src/lib/portability.js');
const { readBackup } = await import('../src/lib/backup.js');
/** A Daybook file, read the way the import reads it. @param {string} text */
const parseImport = (text) => readBackup(text, 'this-browser');
const { coerceTask, SCHEMA_VERSION } = await import('../src/lib/schema.js');

/** @param {object[]} tasks */
async function seed(tasks) {
  for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k];
  await ctx.chrome.storage.local.set({
    tasks: tasks.map((t) => coerceTask({ title: 'seeded', ...t })),
    schemaVersion: SCHEMA_VERSION,
  });
}

const envelope = (tasks) => JSON.stringify({
  format: 'daybook.tasks', schemaVersion: 1, exportedAt: new Date().toISOString(), tasks,
});

test('a Daybook envelope is recognised as a Daybook backup', () => {
  const p = parseImport(envelope([{ id: 'a', title: 'one' }, { id: 'b', title: 'two' }]));
  assert.equal(p.format, 'daybook');
  assert.equal(p.tasks.length, 2);
});

test('a bare array is accepted as tasks', () => {
  const p = parseImport(JSON.stringify([{ title: 'hand rolled' }]));
  assert.equal(p.format, 'daybook');
  assert.equal(p.tasks.length, 1);
});

test('non-JSON is reported plainly rather than swallowed', () => {
  assert.throws(() => parseImport('<html>nope</html>'), /Not a valid export file/);
  assert.throws(() => parseImport(''), /Not a valid export file/);
});

test('a file with no tasks in it is refused', () => {
  assert.throws(() => parseImport(JSON.stringify({ format: 'daybook.tasks', tasks: [] })), /no tasks/);
  assert.throws(() => parseImport(JSON.stringify({ unrelated: true })), /isn’t a Weekly, Daybook or ForgetMeNot backup/);
});

test('malformed records are counted, not silently imported', () => {
  const p = parseImport(envelope([{ title: 'good' }, { title: '' }, null, { nope: 1 }]));
  assert.equal(p.tasks.length, 1);
  assert.equal(p.dropped, 3);
});

test('markup in an imported title survives as text, never as markup', () => {
  const p = parseImport(envelope([{ title: '<img src=x onerror=alert(1)>' }]));
  assert.equal(p.tasks[0].title, '<img src=x onerror=alert(1)>',
    'stored verbatim — the UI sets textContent, so escaping here would corrupt the title');
});

test('merge adds new ids and keeps existing ones untouched', async () => {
  const mine = parseImport(envelope([{ id: 'a', title: 'mine, edited since the export' }])).tasks;
  const incoming = parseImport(envelope([
    { id: 'a', title: 'the stale exported copy' },
    { id: 'b', title: 'genuinely new' },
  ])).tasks;

  const { tasks, added } = mergeTaskLists(mine, incoming);
  assert.equal(added, 1);
  assert.equal(tasks.length, 2);
  assert.equal(tasks.find((t) => t.id === 'a').title, 'mine, edited since the export',
    'a re-imported backup must never overwrite work done since the export');
});

test('replace swaps the whole list and reports what came in', async () => {
  await seed([{ id: 'x' }, { id: 'y' }]);
  const { tasks: added } = await writeBackup(parseImport(envelope([{ id: 'z', title: 'replacement' }])), 'replace');
  assert.equal(added, 1);

  const { tasks } = await ctx.chrome.storage.local.get('tasks');
  assert.deepEqual(tasks.map((t) => t.id), ['z']);
});

test('delete all empties the list and reports what it removed', async () => {
  await seed([{ id: 'x' }, { id: 'y' }, { id: 'z' }]);
  assert.equal(await deleteEverything(), 3);
  const { tasks } = await ctx.chrome.storage.local.get('tasks');
  assert.deepEqual(tasks, []);
});

test('a round trip through export shape and import is lossless', () => {
  const original = coerceTask({
    id: 'rt', title: 'Ship the dataset sync fix',
    description: 'Multi\nline\tdetail with "quotes" and <angle> brackets.',
    priority: 'high', dueDate: '2026-08-18', status: 'done', completedAt: 1755676800000,
    createdAt: 1755000000000, updatedAt: 1755676800000,
  });
  const back = parseImport(envelope([original])).tasks[0];
  assert.deepEqual(back, original);
});
