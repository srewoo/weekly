import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const {
  createTask, getTasks, setDone, updateTask, reschedule, deleteTask,
  toggleDone, toggleOn, archiveRecurring, restoreRecurring, copyToDay, occursOn,
} = await import('../src/lib/tasks.js');
const { today, addDays, weekday } = await import('../src/lib/dates.js');

async function reset() {
  for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k];
}
const everyDay = { days: [0, 1, 2, 3, 4, 5, 6] };
const find = async (/** @type {string} */ id) => (await getTasks()).find((t) => t.id === id);

test('a recurring task starts today, defaults to Mon–Fri, and has no due date', async () => {
  await reset();
  const t = await createTask({ title: 'Standup notes', repeat: {}, dueDate: '2030-01-01' });
  assert.deepEqual(t.repeat, { days: [1, 2, 3, 4, 5], from: today(), until: null });
  assert.equal(t.dueDate, null);
  assert.deepEqual(t.doneDates, []);
  assert.deepEqual(await find(t.id), t, 'what was returned is what was stored');
});

test('createTask uses a valid fallback priority and ignores a bogus one', async () => {
  await reset();
  assert.equal((await createTask({ title: 'a' }, 'high')).priority, 'high');
  assert.equal((await createTask({ title: 'b' }, /** @type {any} */ ('urgent'))).priority, 'medium');
  assert.equal((await createTask({ title: 'c', priority: 'low' }, 'high')).priority, 'low');
});

test('toggleOn ticks and unticks one day; status never closes', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  const d = today();
  assert.deepEqual((await toggleOn(t.id, d))?.doneDates, [d]);
  assert.equal((await find(t.id))?.status, 'open');
  assert.deepEqual((await toggleOn(t.id, d))?.doneDates, []);
});

test('toggleOn refuses a day the task does not occur on, and one-off tasks', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  assert.equal(await toggleOn(t.id, addDays(today(), -1)), null, 'before it started');
  const one = await createTask({ title: 'once', dueDate: today() });
  assert.equal(await toggleOn(one.id, today()), null);
  const offDay = await createTask({ title: 'not today', repeat: { days: [(weekday() + 1) % 7] } });
  assert.equal(await toggleOn(offDay.id, today()), null);
});

test('setDone, updateTask and reschedule cannot give a recurring task a status or a date', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  assert.equal(await setDone(t.id, true), null);
  assert.equal((await updateTask(t.id, { dueDate: today(), title: 'Renamed' }))?.dueDate, null);
  assert.deepEqual(await reschedule([t.id], addDays(today(), 1)), []);
  const saved = await find(t.id);
  assert.equal(saved?.status, 'open');
  assert.equal(saved?.title, 'Renamed', 'the rest of the patch still applies');
});

test('archive stops a recurring task yesterday and keeps its history; restore reopens it', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  await toggleOn(t.id, today());
  const archived = await archiveRecurring(t.id, addDays(today(), 3));
  assert.equal(archived?.repeat?.until, addDays(today(), 2));
  assert.deepEqual(archived?.doneDates, [today()]);
  assert.equal(occursOn(/** @type {any} */ (archived), addDays(today(), 3)), false);
  assert.equal((await restoreRecurring(t.id))?.repeat?.until, null);
  const one = await createTask({ title: 'once' });
  assert.equal(await archiveRecurring(one.id), null, 'a one-off has nothing to archive');
});

test('deleteTask is the hard delete (purge) for any task', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  assert.equal(await deleteTask(t.id), true);
  assert.equal(await find(t.id), undefined);
});

test('copyToDay makes an open copy on the new day; the original stays', async () => {
  await reset();
  const t = await createTask({ title: 'Send invoice', priority: 'high', dueDate: today() });
  await setDone(t.id, true);
  const target = addDays(today(), 2);
  const copy = await copyToDay(t.id, target);
  assert.ok(copy && copy.id !== t.id);
  assert.equal(copy.dueDate, target);
  assert.equal(copy.status, 'open');
  assert.equal(copy.priority, 'high');
  assert.equal((await find(t.id))?.status, 'done');
  assert.equal((await getTasks()).length, 2);
  assert.equal(await copyToDay(t.id, '2026-02-31'), null);
});

test('moving an extra task to another day is reschedule([id], day)', async () => {
  await reset();
  const t = await createTask({ title: 'Call vendor', dueDate: today() });
  assert.deepEqual(await reschedule([t.id], addDays(today(), 4)), [t.id]);
  assert.equal((await find(t.id))?.dueDate, addDays(today(), 4));
});

test('two concurrent toggleDone calls on an open task cancel out (end open)', async () => {
  await reset();
  const t = await createTask({ title: 'Flip me', dueDate: today() });
  await Promise.all([toggleDone(t.id), toggleDone(t.id)]);
  const after = await find(t.id);
  assert.equal(after?.status, 'open');
  assert.equal(after?.completedAt, null);
  assert.equal((await toggleDone(t.id))?.status, 'done');
});

test('toggleDone leaves a recurring task alone and resolves null', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  assert.equal(await toggleDone(t.id), null);
  assert.equal(await toggleDone('missing'), null);
});

test('reschedule rejects a non-ISO date and leaves dueDate unchanged', async () => {
  await reset();
  const t = await createTask({ title: 'Stay put', dueDate: today() });
  assert.deepEqual(await reschedule([t.id], 'garbage'), []);
  assert.equal((await find(t.id))?.dueDate, today());
});

test('restoreRecurring(id, until) puts back an earlier end date; the default clears it', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: { ...everyDay, until: null } });
  const first = await archiveRecurring(t.id, addDays(today(), 5));
  const firstUntil = first?.repeat?.until;
  await archiveRecurring(t.id, addDays(today(), 2));
  assert.equal((await restoreRecurring(t.id, firstUntil))?.repeat?.until, firstUntil, 'the first end date survives');
  assert.equal((await restoreRecurring(t.id))?.repeat?.until, null);
});

test('setDone(id, true, at) stamps completedAt with `at`, so an undo keeps the original day', async () => {
  await reset();
  const t = await createTask({ title: 'Last week' });
  const past = Date.now() - 7 * 86400000;
  assert.equal((await setDone(t.id, true, past))?.completedAt, past);
  assert.ok(Math.abs(/** @type {number} */ ((await setDone(t.id, false))?.completedAt ?? 0)) === 0, 'untick clears it');
  const now = (await setDone(t.id, true))?.completedAt ?? 0;
  assert.ok(Math.abs(now - Date.now()) < 5000, 'default stays now');
});

test('reschedule returns the ids it moved; a closed or recurring id is not among them', async () => {
  await reset();
  const open = await createTask({ title: 'open', dueDate: today() });
  const closed = await createTask({ title: 'closed', dueDate: today() });
  await setDone(closed.id, true);
  const daily = await createTask({ title: 'Daily', repeat: everyDay });
  const to = addDays(today(), 1);
  assert.deepEqual(await reschedule([open.id, closed.id, daily.id, 'missing'], to), [open.id]);
  assert.equal((await find(closed.id))?.dueDate, today(), 'a closed task keeps its date');
  assert.deepEqual(await reschedule([open.id], 'garbage'), []);
});

test('toggleOn with an explicit state sets it and never flips: done twice stays done; undone on an unticked day stays unticked', async () => {
  await reset();
  const t = await createTask({ title: 'Daily', repeat: everyDay });
  const d = today();
  assert.deepEqual((await toggleOn(t.id, d, false))?.doneDates, [], 'unticked day stays unticked');
  assert.deepEqual((await toggleOn(t.id, d, true))?.doneDates, [d]);
  assert.deepEqual((await toggleOn(t.id, d, true))?.doneDates, [d], 'done twice stays done');
  assert.deepEqual((await toggleOn(t.id, d, false))?.doneDates, []);
  assert.deepEqual((await toggleOn(t.id, d))?.doneDates, [d], 'no state still flips');
});

test('updateTask changes a recurring task\'s weekdays, and leaves one-offs and empty picks alone', async () => {
  const r = await createTask({ title: 'Gym', repeat: { days: [1, 3] } });
  assert.deepEqual((await updateTask(r.id, { repeatDays: [5, 2, 2] }))?.repeat?.days, [2, 5]);
  assert.deepEqual((await updateTask(r.id, { repeatDays: [] }))?.repeat?.days, [2, 5]);
  const o = await createTask({ title: 'One-off' });
  assert.equal((await updateTask(o.id, { repeatDays: [1] }))?.repeat, null);
});
