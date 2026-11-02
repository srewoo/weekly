import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const { getTasks, mutate, withLock, TASKS_LOCK } = await import('../src/lib/storage.js');

const WEEKLY2 = {
  'day:2026-10-30': { 'jira:ENGX-1': { category: 'Tickets', task: 'ENGX-1', url: '', ms: 60000, first: 1, last: 2, tickets: [] } },
  'meta:2026-10-30': { switches: 3 },
  notes: [{ id: 1, ts: 1761800000000, text: 'Called the vendor' }],
  settings: { role: 'hr', anonymize: true },
  deviceId: 'dev-1',
};

function reset(/** @type {Record<string, unknown>} */ seed) {
  for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k];
  Object.assign(ctx.stores.local, structuredClone(seed));
}

test('first read on a Weekly 2 profile adds tasks + schemaVersion and touches nothing else', async () => {
  reset(WEEKLY2);
  assert.deepEqual(await getTasks(), []);
  const { tasks, schemaVersion, ...rest } = ctx.stores.local;
  assert.deepEqual(tasks, []);
  assert.equal(schemaVersion, 2);
  assert.deepEqual(rest, WEEKLY2, 'activity, notes ({id,ts,text}), settings and deviceId are untouched');
});

test('a stored v1 list is upgraded in place on read', async () => {
  reset({ schemaVersion: 1, tasks: [{ id: 'a', title: 'From Daybook', priority: 'low', status: 'open', createdAt: 1, updatedAt: 1, completedAt: null, dueDate: null, description: '' }] });
  const [t] = await getTasks();
  assert.equal(t?.repeat, null);
  assert.deepEqual(t?.doneDates, []);
  assert.equal(ctx.stores.local.schemaVersion, 2);
});

test('mutate takes the shared Web Lock when the platform has one', async () => {
  reset({});
  /** @type {string[]} */
  const names = [];
  let tail = Promise.resolve();
  const locks = { request: (/** @type {string} */ name, /** @type {() => Promise<unknown>} */ fn) => {
    names.push(name);
    const run = tail.then(fn);
    tail = run.then(() => undefined, () => undefined);
    return run;
  } };
  Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true });
  try {
    await mutate((tasks) => ({ tasks, result: undefined }));
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  }
  assert.deepEqual(names, [TASKS_LOCK]);
  assert.equal(TASKS_LOCK, 'weekly:tasks');
});

test('without Web Locks, withLock still runs callers in order and survives a throw', async () => {
  /** @type {number[]} */
  const order = [];
  const slow = withLock('t', async () => { await new Promise((r) => setTimeout(r, 20)); order.push(1); });
  const boom = withLock('t', async () => { throw new Error('boom'); });
  const fast = withLock('t', async () => { order.push(3); });
  await slow;
  await assert.rejects(boom, /boom/);
  await fast;
  assert.deepEqual(order, [1, 3]);
});

test('concurrent mutate() calls without Web Locks both land (no lost update)', async () => {
  reset(WEEKLY2);
  const add = (/** @type {string} */ id) => mutate((tasks) => ({
    tasks: [...tasks, /** @type {any} */ ({ id, title: id })],
    result: id,
  }));
  await Promise.all([add('a'), add('b'), add('c')]);
  assert.deepEqual((await getTasks()).map((t) => t.id).sort(), ['a', 'b', 'c']);
});

test('a migrating mutate() writes the task list once, and a migrating getTasks() never clobbers a newer list', async () => {
  reset({ schemaVersion: 1, tasks: [{ id: 'old', title: 'Old', priority: 'low', status: 'open', createdAt: 1, updatedAt: 1, completedAt: null, dueDate: null, description: '' }] });
  const realSet = ctx.chrome.storage.local.set;
  let writes = 0;
  ctx.chrome.storage.local.set = (/** @type {any} */ o) => { writes++; return realSet(o); };
  try {
    await mutate((tasks) => ({ tasks, result: undefined }));
    assert.equal(writes, 1, 'one write, so onTasksChanged fires once');
    reset({ schemaVersion: 1, tasks: [{ id: 'old', title: 'Old', priority: 'low', status: 'open', createdAt: 1, updatedAt: 1, completedAt: null, dueDate: null, description: '' }] });
    const read = getTasks();
    await mutate((tasks) => ({ tasks: [...tasks, /** @type {any} */ ({ id: 'new', title: 'New' })], result: undefined }));
    await read;
    assert.deepEqual((await getTasks()).map((t) => t.id).sort(), ['new', 'old']);
  } finally {
    ctx.chrome.storage.local.set = realSet;
  }
});
