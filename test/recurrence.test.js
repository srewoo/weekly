import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { occursOn, isDoneOn, isArchived, recurringOn, extrasOn, dayCompletion, occurrences, doneInRange } from '../src/lib/recurrence.js';
import { sectionsFor, viewCounts } from '../src/lib/task-views.js';
import { coerceTask } from '../src/lib/schema.js';

/** @param {object} patch */
const task = (patch) => /** @type {import('../src/lib/schema.js').Task} */ (coerceTask({ title: 'untitled', ...patch }));

// Week of Mon 26 Oct – Fri 30 Oct 2026; Sun 1 Nov is the US fall-back day.
const STANDUP = task({ id: 'su', title: 'Standup notes', createdAt: 1,
  repeat: { days: [1, 2, 3, 4, 5], from: '2026-10-26', until: null }, doneDates: ['2026-10-26', '2026-10-27', '2026-10-29'] });
const GYM = task({ id: 'gym', title: 'Gym', priority: 'low', createdAt: 2,
  repeat: { days: [0, 3], from: '2026-10-01', until: '2026-10-28' }, doneDates: ['2026-10-28'] });

test('occursOn honours weekdays, from and until, inclusive', () => {
  assert.equal(occursOn(STANDUP, '2026-10-26'), true, 'the first day counts');
  assert.equal(occursOn(STANDUP, '2026-10-25'), false, 'not before from');
  assert.equal(occursOn(STANDUP, '2026-10-31'), false, 'Saturday is not a working day');
  assert.equal(occursOn(GYM, '2026-10-28'), true, 'the until day still counts');
  assert.equal(occursOn(GYM, '2026-11-01'), false, 'archived after until');
  assert.equal(occursOn(STANDUP, '2026-02-31'), false, 'a day that does not exist never occurs');
  assert.equal(occursOn(task({ dueDate: '2026-10-26' }), '2026-10-26'), false, 'a one-off never recurs');
});

test('occursOn walks across the DST change on the local calendar', () => {
  const sunday = task({ repeat: { days: [0], from: '2026-10-01', until: null } });
  assert.equal(occursOn(sunday, '2026-11-01'), true);
  assert.equal(occursOn(sunday, '2026-11-02'), false);
  assert.equal(occurrences(sunday, '2026-10-25', '2026-11-08'), 3);
});

test('isDoneOn: recurring by doneDates, one-off by status', () => {
  assert.equal(isDoneOn(STANDUP, '2026-10-27'), true);
  assert.equal(isDoneOn(STANDUP, '2026-10-28'), false);
  assert.equal(isDoneOn(task({ status: 'done', completedAt: 1 }), '2026-10-28'), true);
});

test('isArchived means until is before the reference day', () => {
  assert.equal(isArchived(GYM, '2026-10-29'), true);
  assert.equal(isArchived(GYM, '2026-10-28'), false);
  assert.equal(isArchived(STANDUP, '2026-12-01'), false);
});

test('a day lists its recurring tasks and its extra tasks separately', () => {
  const extra = task({ id: 'x', dueDate: '2026-10-28', priority: 'high' });
  const all = [STANDUP, GYM, extra, task({ id: 'other', dueDate: '2026-10-29' })];
  assert.deepEqual(recurringOn(all, '2026-10-28').map((t) => t.id), ['su', 'gym'], 'priority, then created');
  assert.deepEqual(extrasOn(all, '2026-10-28').map((t) => t.id), ['x']);
});

test('dayCompletion is done over total for that day', () => {
  const extraDone = task({ dueDate: '2026-10-28', status: 'done', completedAt: 5 });
  const extraOpen = task({ dueDate: '2026-10-28' });
  assert.deepEqual(dayCompletion([STANDUP, GYM, extraDone, extraOpen], '2026-10-28'), { done: 2, total: 4 });
  assert.deepEqual(dayCompletion([STANDUP], '2026-10-31'), { done: 0, total: 0 }, 'an empty day has nothing to shade');
});

test('doneInRange lists one-offs by priority then completion, recurring with counts', () => {
  const at = (/** @type {number} */ d, /** @type {number} */ h) => new Date(2026, 9, d, h).getTime();
  const lowEarly = task({ id: 'le', priority: 'low', status: 'done', completedAt: at(26, 9) });
  const highLate = task({ id: 'hl', priority: 'high', status: 'done', completedAt: at(30, 17) });
  const highEarly = task({ id: 'he', priority: 'high', status: 'done', completedAt: at(27, 9) });
  const lastWeek = task({ id: 'lw', status: 'done', completedAt: at(23, 9) });
  const open = task({ id: 'op', dueDate: '2026-10-27' });
  const never = task({ id: 'nv', repeat: { days: [1], from: '2026-10-01', until: null } });
  const r = doneInRange([lowEarly, highLate, highEarly, lastWeek, open, STANDUP, GYM, never], '2026-10-26', '2026-10-30');
  assert.deepEqual(r.oneOffs.map((t) => t.id), ['he', 'hl', 'le']);
  assert.deepEqual(r.recurring.map(({ task: t, done, of }) => [t.id, done, of]), [['su', 3, 5], ['gym', 1, 1]],
    'listed only if ticked at least once; "of" counts the days it occurred');
});

test('doneInRange uses the local day of completedAt', () => {
  const lateNight = task({ status: 'done', completedAt: new Date(2026, 9, 30, 23, 50).getTime() });
  assert.equal(doneInRange([lateNight], '2026-10-26', '2026-10-30').oneOffs.length, 1);
  assert.equal(doneInRange([lateNight], '2026-10-31', '2026-11-06').oneOffs.length, 0);
});

test('recurring tasks never leak into the dated views or the No date band', () => {
  const s = sectionsFor([STANDUP], 'week', '2026-10-28');
  assert.equal(s.flatMap((x) => x.tasks).length, 0);
  assert.equal(sectionsFor([STANDUP], 'open', '2026-10-28').length, 0);
  assert.equal(viewCounts([STANDUP], '2026-10-28').open, 0);
});
