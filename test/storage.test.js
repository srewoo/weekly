/**
 * Concurrency on the task list.
 *
 * The failure this guards against is a lost update: two contexts read the same
 * array, each appends its own item, and the second write discards the first.
 * It is not exotic — the evening alarm firing while you tick a checkbox is the
 * ordinary case.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const { mutate, getTasks } = await import('../src/lib/storage.js');
const { createTask, setDone, deleteTask, reschedule } = await import('../src/lib/tasks.js');
const { today, tomorrow } = await import('../src/lib/dates.js');

async function reset() {
  for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k];
  await ctx.chrome.storage.local.set({ tasks: [], schemaVersion: 1 });
}

test('concurrent creates all survive — no lost update', async () => {
  await reset();
  await Promise.all(
    Array.from({ length: 40 }, (_, i) => createTask({ title: `task ${i}` })),
  );
  const tasks = await getTasks();
  assert.equal(tasks.length, 40);
  assert.equal(new Set(tasks.map((t) => t.id)).size, 40, 'no id collisions under load');
});

test('a read inside mutate always sees every write queued before it', async () => {
  await reset();
  const template = { description: '', priority: 'medium', dueDate: null, status: 'open',
                     createdAt: 1, updatedAt: 1, completedAt: null };
  /** @type {number[]} */
  const observed = [];
  await Promise.all(
    Array.from({ length: 25 }, (_, i) => mutate((tasks) => {
      observed.push(tasks.length);
      // A record with no title is dropped by migrate() on the next read, so the
      // fixture has to be a real task for the observation to mean anything.
      return { tasks: [...tasks, { ...template, id: `t${i}`, title: `task ${i}` }], result: undefined };
    })),
  );
  assert.deepEqual(observed, [...Array(25).keys()],
    'each mutation observed exactly the writes that preceded it');
});

test('interleaved writes of different kinds do not clobber each other', async () => {
  await reset();
  const [a, b, c] = await Promise.all([
    createTask({ title: 'a', dueDate: today() }),
    createTask({ title: 'b', dueDate: today() }),
    createTask({ title: 'c', dueDate: today() }),
  ]);

  // A completion, a delete and a carry-over all landing at once.
  await Promise.all([
    setDone(a.id, true),
    deleteTask(b.id),
    reschedule([c.id], tomorrow()),
  ]);

  const tasks = await getTasks();
  assert.equal(tasks.length, 2, 'exactly one deletion took effect');
  assert.equal(tasks.find((t) => t.id === a.id)?.status, 'done', 'the completion survived');
  assert.equal(tasks.find((t) => t.id === c.id)?.dueDate, tomorrow(), 'the carry-over survived');
  assert.equal(tasks.find((t) => t.id === b.id), undefined);
});

test('a throwing mutation does not poison the queue for later writes', async () => {
  await reset();
  const boom = mutate(() => { throw new Error('boom'); });
  await assert.rejects(boom, /boom/);

  await createTask({ title: 'after the failure' });
  const tasks = await getTasks();
  assert.equal(tasks.length, 1, 'the chain kept running');
});

test('a corrupted stored blob is repaired on read rather than thrown at the UI', async () => {
  for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k];
  await ctx.chrome.storage.local.set({ tasks: 'not an array', schemaVersion: 1 });

  const tasks = await getTasks();
  assert.deepEqual(tasks, []);

  await createTask({ title: 'still works' });
  assert.equal((await getTasks()).length, 1);
});
