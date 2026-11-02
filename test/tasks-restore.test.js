import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

let stub;
beforeEach(() => { stub = installChromeStub(); });

test('restoreTask brings a deleted task back exactly: id, status and completedAt', async () => {
  const { createTask, setDone, deleteTask, restoreTask, getTasks } = await import('../src/lib/tasks.js');
  const t = await createTask({ title: 'Ship the login fix', dueDate: '2026-10-29' });
  const done = await setDone(t.id, true);
  assert.ok(done);
  await deleteTask(t.id);
  assert.equal(await restoreTask(done), true);
  assert.deepEqual(await getTasks(), [done]);
});

test('restoreTask never duplicates an id that is already there, and refuses junk', async () => {
  const { createTask, restoreTask, getTasks } = await import('../src/lib/tasks.js');
  const t = await createTask({ title: 'Once' });
  assert.equal(await restoreTask({ ...t, title: 'Twice' }), false);
  assert.equal(await restoreTask({ title: '' }), false);
  assert.deepEqual((await getTasks()).map((x) => x.title), ['Once']);
  assert.equal(stub.stores.local.tasks.length, 1);
});

test('the planner and the task constants come through the task domain’s one import site', async () => {
  const tasks = await import('../src/lib/tasks.js');
  for (const name of ['todayBands', 'monthGrid', 'doneRange', 'doneThisWeek', 'doneKey', 'withoutExcluded', 'mondayOf']) {
    assert.equal(typeof tasks[name], 'function', name);
  }
  assert.deepEqual([tasks.PRIORITIES, tasks.UNDATED_KEY, tasks.WORKWEEK], [['high', 'medium', 'low'], 'undated', [1, 2, 3, 4, 5]]);
});
