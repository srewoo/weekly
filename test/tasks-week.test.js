/**
 * The week view.
 *
 * Unlike every other view, the seven day bands are *not* dropped when empty:
 * a week that hides its clear days stops reading as a week — you can no longer
 * see that Friday is free, only that Friday is missing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { sectionsFor, viewCounts, WEEK_SPAN } from '../src/lib/tasks.js';
import { coerceTask } from '../src/lib/schema.js';
import { addDays } from '../src/lib/dates.js';

const REF = '2026-08-20'; // Thursday

/** @param {object} patch */
const task = (patch) => coerceTask({ title: 'untitled', ...patch });

/** @param {ReturnType<typeof sectionsFor>} sections */
const days = (sections) => sections.filter((s) => s.collapsible && s.key !== 'undated');

test('the window is today plus the following six days', () => {
  const sections = days(sectionsFor([], 'week', REF));
  assert.equal(sections.length, WEEK_SPAN);
  assert.equal(WEEK_SPAN, 7);
  assert.equal(sections[0].key, REF, 'the window opens on the reference day');
  assert.equal(sections[6].key, addDays(REF, 6), 'and closes six days later');
});

test('a task on either boundary is in; ref+7 is out', () => {
  const first = task({ id: 'a', dueDate: REF });
  const last = task({ id: 'b', dueDate: addDays(REF, 6) });
  const past = task({ id: 'c', dueDate: addDays(REF, 7) });

  const byKey = new Map(days(sectionsFor([first, last, past], 'week', REF)).map((s) => [s.key, s]));
  assert.deepEqual(byKey.get(REF).tasks.map((t) => t.id), ['a']);
  assert.deepEqual(byKey.get(addDays(REF, 6)).tasks.map((t) => t.id), ['b']);
  assert.ok(![...byKey.values()].some((s) => s.tasks.some((t) => t.id === 'c')),
    'the eighth day is outside the window');
});

test('empty day bands are kept, but an empty Overdue band is still dropped', () => {
  const sections = sectionsFor([task({ dueDate: REF })], 'week', REF);
  assert.equal(days(sections).filter((s) => s.tasks.length === 0).length, 6,
    'the six clear days are still drawn');
  assert.ok(!sections.some((s) => s.label === 'Overdue'), 'nothing is overdue, so no heading');
});

test('overdue leads the view, is flagged, and is not collapsible', () => {
  const sections = sectionsFor([task({ id: 'late', dueDate: '2026-08-18' })], 'week', REF);
  assert.equal(sections[0].label, 'Overdue');
  assert.equal(sections[0].flagged, true);
  assert.ok(!sections[0].collapsible, 'you cannot hide what you are already late on');
});

test('an overdue task is never also counted into a day band', () => {
  const sections = sectionsFor([task({ id: 'late', dueDate: '2026-08-19' })], 'week', REF);
  const inDays = days(sections).flatMap((s) => s.tasks);
  assert.equal(inDays.length, 0, 'yesterday is not one of the seven days');
});

test('undated open tasks land in a trailing No date band, dropped when empty', () => {
  const withUndated = sectionsFor([task({ id: 'un' })], 'week', REF);
  const last = withUndated[withUndated.length - 1];
  assert.equal(last.label, 'No date');
  assert.equal(last.key, 'undated');
  assert.equal(last.collapsible, true);
  assert.equal(last.defaultOpen, false);

  assert.ok(!sectionsFor([], 'week', REF).some((s) => s.label === 'No date'));
});

test('completed tasks never appear in the week', () => {
  const done = task({ id: 'd', dueDate: REF, status: 'done', completedAt: Date.parse('2026-08-20T10:00') });
  const sections = sectionsFor([done], 'week', REF);
  assert.equal(sections.flatMap((s) => s.tasks).length, 0);
});

test('today opens by default and the rest are closed', () => {
  const sections = days(sectionsFor([], 'week', REF));
  assert.equal(sections[0].defaultOpen, true);
  assert.deepEqual(sections.slice(1).map((s) => s.defaultOpen), [false, false, false, false, false, false]);
});

test('the first two days are named in relative terms, the rest are dated', () => {
  const sections = days(sectionsFor([], 'week', REF));
  assert.equal(sections[0].label, 'Today');
  assert.equal(sections[1].label, 'Tomorrow');
  assert.match(sections[2].label, /Sat/, 'the third day is stamped, not relative');
});

test('the seven-day walk survives a DST transition', () => {
  // 1 Nov 2026 is the US fall-back Sunday. Adding days on midnight-anchored
  // local Dates must still produce seven distinct consecutive calendar days.
  const ref = '2026-10-29';
  const keys = days(sectionsFor([], 'week', ref)).map((s) => s.key);
  assert.deepEqual(keys, ['2026-10-29', '2026-10-30', '2026-10-31',
                          '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  assert.equal(new Set(keys).size, 7, 'no day is repeated or skipped across the shift');
});

test('the week count is overdue plus everything open inside the window', () => {
  const tasks = [
    task({ id: 'late', dueDate: '2026-08-18' }),
    task({ id: 'today', dueDate: REF }),
    task({ id: 'edge', dueDate: addDays(REF, 6) }),
    task({ id: 'out', dueDate: addDays(REF, 7) }),
    task({ id: 'un' }),
    task({ id: 'done', dueDate: REF, status: 'done', completedAt: 1 }),
  ];
  assert.equal(viewCounts(tasks, REF).week, 3, 'overdue + today + the last day of the window');
});
