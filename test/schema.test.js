import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import {
  coerceTask, coerceTaskList, coerceReminderState,
  migrate, newId, SCHEMA_VERSION, TITLE_MAX, DESC_MAX,
} from '../src/lib/schema.js';

test('newId is unique across a large batch', () => {
  const ids = new Set(Array.from({ length: 5000 }, newId));
  assert.equal(ids.size, 5000);
});

test('coerceTask fills the derived fields for a minimal record', () => {
  const t = coerceTask({ title: 'Fix flaky login spec' });
  assert.ok(t);
  assert.equal(t.priority, 'medium');
  assert.equal(t.status, 'open');
  assert.equal(t.dueDate, null);
  assert.equal(t.completedAt, null);
  assert.equal(t.description, '');
  assert.ok(t.id.startsWith('t_'));
});

test('coerceTask rejects records that are not tasks', () => {
  for (const bad of [null, undefined, 42, 'a string', [], {}, { title: '   ' }, { title: 123 }]) {
    assert.equal(coerceTask(bad), null, JSON.stringify(bad));
  }
});

test('coerceTask clamps oversized text rather than dropping the task', () => {
  const t = coerceTask({ title: 'x'.repeat(500), description: 'y'.repeat(5000) });
  assert.ok(t);
  assert.equal(t.title.length, TITLE_MAX);
  assert.equal(t.description.length, DESC_MAX);
});

test('coerceTask normalises priority and discards an invalid due date', () => {
  const t = coerceTask({ title: 'x', priority: 'HIGH', dueDate: '2026-02-31' });
  assert.ok(t);
  assert.equal(t.priority, 'high');
  assert.equal(t.dueDate, null, 'a date that does not exist must not become "overdue"');

  const bogus = coerceTask({ title: 'x', priority: 'urgent' });
  assert.equal(bogus?.priority, 'medium');
});

test('a done task always carries a completedAt', () => {
  const t = coerceTask({ title: 'x', status: 'done', createdAt: 1000 });
  assert.equal(t?.status, 'done');
  assert.equal(typeof t?.completedAt, 'number');

  const reopened = coerceTask({ title: 'x', status: 'open', completedAt: 5000 });
  assert.equal(reopened?.completedAt, null, 'an open task must not look completed');
});

test('coerceTaskList drops junk and collapses duplicate ids', () => {
  const { tasks, dropped, duplicates } = coerceTaskList([
    { id: 'a', title: 'one' },
    { id: 'a', title: 'one again' },
    { title: '' },
    null,
    { id: 'b', title: 'two' },
  ]);
  assert.equal(tasks.length, 2);
  assert.equal(dropped, 2);
  assert.equal(duplicates, 1);
  assert.deepEqual(tasks.map((t) => t.id), ['a', 'b']);
});

test('coerceReminderState discards non-dates so catch-up cannot be fooled', () => {
  const r = coerceReminderState({ morningLastShown: 'yesterday', eveningLastShown: '2026-08-19', snoozeUntil: 1 });
  assert.equal(r.morningLastShown, null);
  assert.equal(r.eveningLastShown, '2026-08-19');
  assert.deepEqual(Object.keys(r), ['morningLastShown', 'eveningLastShown'], 'a stored snoozeUntil (never read) is dropped');
});

test('migrate lifts unversioned v0 data and reports the change', () => {
  const v0 = { tasks: [{ title: 'legacy task' }] };
  const out = migrate(v0);
  assert.equal(out.schemaVersion, SCHEMA_VERSION);
  assert.equal(out.changed, true);
  assert.equal(out.tasks.length, 1);
  assert.ok(out.tasks[0].id);
  assert.equal(out.tasks[0].priority, 'medium');
});

test('migrate is a no-op on already-current data', () => {
  const current = { schemaVersion: SCHEMA_VERSION, tasks: [coerceTask({ title: 'x' })] };
  const out = migrate(current);
  assert.equal(out.changed, false);
  assert.equal(out.tasks.length, 1);
});

test('migrate survives a corrupted blob instead of throwing', () => {
  for (const bad of [null, 'corrupt', 42, { tasks: 'not-an-array' }]) {
    const out = migrate(bad);
    assert.deepEqual(out.tasks, []);
  }
});
