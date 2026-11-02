import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { todayBands, monthGrid, doneRange, mondayOf, doneThisWeek, doneKey, withoutExcluded } from '../src/lib/planner.js';
import { doneInRange } from '../src/lib/recurrence.js';
import { coerceTask } from '../src/lib/schema.js';

/** @param {object} patch */
const task = (patch) => /** @type {import('../src/lib/schema.js').Task} */ (coerceTask({ title: 'untitled', ...patch }));
/** Local noon on a day, so completedAt never sits near midnight in either test timezone. @param {string} iso */
const noon = (iso) => new Date(`${iso}T12:00:00`).getTime();

// Thu 29 Oct 2026 is "today" throughout; the week runs Mon 26 – Fri 30 Oct.
const REF = '2026-10-29';
const STANDUP = task({ id: 'su', title: 'Standup notes', createdAt: 1,
  repeat: { days: [1, 2, 3, 4, 5], from: '2026-10-26', until: null }, doneDates: ['2026-10-26', '2026-10-27'] });
const LATE = task({ id: 'late', title: 'Late', dueDate: '2026-10-27', createdAt: 2 });
const DUE = task({ id: 'due', title: 'Due', dueDate: REF, priority: 'high', createdAt: 3 });
const LOOSE = task({ id: 'loose', title: 'Loose', createdAt: 4 });
const CLOSED = task({ id: 'closed', title: 'Closed', status: 'done', completedAt: noon(REF), createdAt: 5 });
const OLD = task({ id: 'old', title: 'Old', status: 'done', completedAt: noon('2026-10-26'), dueDate: '2026-10-26', createdAt: 6 });

test('todayBands: Overdue, Today with recurring first then due then closed today, No date collapsed', () => {
  const bands = todayBands([LOOSE, CLOSED, DUE, LATE, STANDUP, OLD], REF);
  assert.deepEqual(bands.map((b) => [b.key, b.tasks.map((t) => t.id)]),
    [['overdue', ['late']], ['today', ['su', 'due', 'closed']], ['undated', ['loose']]]);
  assert.equal(bands[0]?.flagged, true);
  assert.deepEqual([bands[2]?.collapsible, bands[2]?.defaultOpen], [true, false]);
});

test('todayBands always shows Today and drops empty Overdue and No date', () => {
  assert.deepEqual(todayBands([], REF).map((b) => [b.key, b.tasks.length]), [['today', 0]]);
});

test('todayBands leaves out recurring tasks on days they do not occur', () => {
  assert.deepEqual(todayBands([STANDUP], '2026-10-31')[0]?.tasks, []);
});

test('monthGrid starts on Monday and shades past days, today only once ticked, never the future', () => {
  const { blanks, cells } = monthGrid(2026, 9, [STANDUP, DUE], REF);
  assert.equal(blanks, 3, '1 Oct 2026 is a Thursday');
  assert.equal(cells.length, 31);
  /** @param {string} iso */
  const cell = (iso) => cells.find((c) => c.iso === iso);
  assert.deepEqual(cell('2026-10-26'), { iso: '2026-10-26', day: 26, when: 'past', done: 1, total: 1, pct: 100 });
  assert.deepEqual([cell('2026-10-28')?.pct, cell('2026-10-28')?.total], [0, 1], 'a missed past day is shaded at 0%');
  assert.deepEqual([cell(REF)?.when, cell(REF)?.total, cell(REF)?.pct], ['today', 2, null], 'nothing ticked yet today');
  assert.deepEqual([cell('2026-10-30')?.when, cell('2026-10-30')?.pct], ['future', null]);
  assert.equal(cell('2026-10-25')?.total, 0, 'before the task started');
});

test('monthGrid shades today once something is ticked', () => {
  const ticked = { ...STANDUP, doneDates: [REF] };
  assert.equal(monthGrid(2026, 9, [ticked, DUE], REF).cells[28]?.pct, 50);
});

test('monthGrid handles a Monday first day and February', () => {
  const feb = monthGrid(2027, 1, [], REF);
  assert.deepEqual([feb.blanks, feb.cells.length], [0, 28]);
});

test('doneRange runs Monday to Friday, clamped to today', () => {
  assert.deepEqual(doneRange('2026-10-26', REF), { from: '2026-10-26', to: REF });
  assert.deepEqual(doneRange('2026-10-26', '2026-11-01'), { from: '2026-10-26', to: '2026-10-30' });
  assert.deepEqual(doneRange('2026-10-19', REF), { from: '2026-10-19', to: '2026-10-23' });
});

test('mondayOf: weekends belong to the week before', () => {
  assert.equal(mondayOf(REF), '2026-10-26');
  assert.equal(mondayOf('2026-10-26'), '2026-10-26');
  assert.equal(mondayOf('2026-11-01'), '2026-10-26');
});

test('doneThisWeek counts closed one-offs and each recurring tick', () => {
  assert.equal(doneThisWeek([STANDUP, CLOSED, OLD, DUE], REF), 4);
  assert.equal(doneThisWeek([STANDUP], '2026-11-02'), 0, 'a new week starts at zero');
});

test('withoutExcluded drops unticked Done items by their task key', () => {
  const done = doneInRange([STANDUP, CLOSED, OLD], '2026-10-26', REF);
  const kept = withoutExcluded(done, new Set([doneKey(OLD), doneKey(STANDUP)]));
  assert.deepEqual(kept.oneOffs.map((t) => t.id), ['closed']);
  assert.deepEqual(kept.recurring, []);
  assert.equal(doneKey(OLD), 'task:old');
});
