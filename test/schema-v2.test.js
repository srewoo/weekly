import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { addDays } from '../src/lib/dates.js';
import { coerceTask, coerceDays, coercePriority, migrate, SCHEMA_VERSION, DONE_DATES_MAX } from '../src/lib/schema.js';

test('the schema is version 2', () => {
  assert.equal(SCHEMA_VERSION, 2);
});

test('a one-off task gets repeat null and no done dates', () => {
  const t = coerceTask({ title: 'Send the deck', doneDates: ['2026-10-30'] });
  assert.equal(t?.repeat, null);
  assert.deepEqual(t?.doneDates, [], 'a one-off is ticked by status, never by date');
});

test('a recurring task keeps its days, from and until', () => {
  const t = coerceTask({ title: 'Standup notes', repeat: { days: [5, 1, 3], from: '2026-10-01', until: '2026-10-30' } });
  assert.deepEqual(t?.repeat, { days: [1, 3, 5], from: '2026-10-01', until: '2026-10-30' });
});

test('a recurring task never carries a due date or a closed status', () => {
  const t = coerceTask({ title: 'x', repeat: {}, dueDate: '2026-10-30', status: 'done', completedAt: 5 });
  assert.equal(t?.dueDate, null);
  assert.equal(t?.status, 'open');
  assert.equal(t?.completedAt, null);
});

test('repeat with junk falls back to weekdays, counted from the created date', () => {
  const createdAt = new Date(2026, 9, 12, 15, 0).getTime();
  const t = coerceTask({ title: 'x', createdAt, repeat: { days: [9, 'x'], from: '2026-02-31', until: 'never' } });
  assert.deepEqual(t?.repeat, { days: [1, 2, 3, 4, 5], from: '2026-10-12', until: null });
});

test('done dates are validated, de-duplicated, sorted and capped', () => {
  const t = coerceTask({ title: 'x', repeat: {}, doneDates: ['2026-10-30', 'nope', '2026-10-28', '2026-10-30', '2026-02-31', 7] });
  assert.deepEqual(t?.doneDates, ['2026-10-28', '2026-10-30']);
  const many = Array.from({ length: DONE_DATES_MAX + 10 }, (_, i) => addDays('2000-01-01', i));
  const huge = coerceTask({ title: 'x', repeat: {}, doneDates: many });
  assert.equal(huge?.doneDates.length, DONE_DATES_MAX);
  assert.equal(huge?.doneDates.at(-1), many.at(-1), 'the cap keeps the most recent days');
});

test('coerceDays keeps 0–6 integers only and never returns an empty week', () => {
  assert.deepEqual(coerceDays([6, 0, 0, 3]), [0, 3, 6]);
  assert.deepEqual(coerceDays([]), [1, 2, 3, 4, 5]);
  assert.deepEqual(coerceDays('mon'), [1, 2, 3, 4, 5]);
});

test('coercePriority accepts any case and rejects the rest', () => {
  assert.equal(coercePriority('LOW'), 'low');
  assert.equal(coercePriority('urgent'), null);
  assert.equal(coercePriority(undefined), null);
});

test('migrate v1 → v2 backfills repeat and doneDates and reports the change', () => {
  const v1 = { schemaVersion: 1, tasks: [{ id: 'a', title: 'Daybook task', priority: 'high', dueDate: '2026-10-30' }] };
  const out = migrate(v1);
  assert.equal(out.changed, true);
  assert.equal(out.schemaVersion, 2);
  assert.equal(out.tasks[0]?.repeat, null);
  assert.deepEqual(out.tasks[0]?.doneDates, []);
  assert.equal(out.tasks[0]?.dueDate, '2026-10-30', 'v1 fields survive');
});

test('migrate v2 → v2 is a no-op that keeps recurrence', () => {
  const t = coerceTask({ title: 'x', repeat: { days: [1], from: '2026-10-05', until: null }, doneDates: ['2026-10-26'] });
  const out = migrate({ schemaVersion: 2, tasks: [t] });
  assert.equal(out.changed, false);
  assert.deepEqual(out.tasks, [t]);
});
