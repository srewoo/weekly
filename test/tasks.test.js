import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import {
  isOverdue, isDueToday, isUpcoming, isUndated,
  byDueThenPriority, sectionsFor, viewCounts, search, filterPriority,
} from '../src/lib/tasks.js';
import { coerceTask } from '../src/lib/schema.js';

const REF = '2026-08-20';

/** @param {object} patch */
const task = (patch) => coerceTask({ title: 'untitled', ...patch });

const LATE      = task({ id: 'late',   title: 'Ship the dataset sync fix', dueDate: '2026-08-18', priority: 'high' });
const LATE2     = task({ id: 'late2',  title: 'Reply to Ishaan on the RCA thread', dueDate: '2026-08-19' });
const DUE       = task({ id: 'due',    title: 'Fix flaky login spec', dueDate: REF, priority: 'high' });
const DUE2      = task({ id: 'due2',   title: 'Review the evaluator prompt diff', dueDate: REF });
const AHEAD     = task({ id: 'ahead',  title: 'Draft the Q3 plan', dueDate: '2026-08-25' });
const UNDATED   = task({ id: 'un',     title: 'Read the Raft paper', priority: 'low' });
const DONE_LATE = task({ id: 'dlate',  title: 'An old finished thing', dueDate: '2026-08-01', status: 'done', completedAt: Date.parse('2026-08-01T10:00') });

const ALL = [LATE, LATE2, DUE, DUE2, AHEAD, UNDATED, DONE_LATE];

test('overdue is open + dated + before today', () => {
  assert.ok(isOverdue(LATE, REF));
  assert.ok(!isOverdue(DUE, REF), 'due today is not late');
  assert.ok(!isOverdue(AHEAD, REF));
  assert.ok(!isOverdue(UNDATED, REF), 'an undated task can never be late');
  assert.ok(!isOverdue(DONE_LATE, REF), 'a completed task is never late');
});

test('a recurring task is never overdue, even one carrying a stray due date (a hand-edited import)', () => {
  const daily = { ...task({ id: 'd', repeat: { days: [1, 2, 3, 4, 5], from: '2026-08-01', until: null } }), dueDate: '2026-08-01' };
  assert.ok(!isOverdue(daily, REF));
  assert.deepEqual(sectionsFor([daily, LATE], 'overdue', REF).flatMap((s) => s.tasks.map((t) => t.id)), ['late']);
});

test('the day-boundary case: yesterday is late, today is not', () => {
  const t = task({ dueDate: '2026-08-19' });
  assert.ok(isOverdue(t, '2026-08-20'));
  assert.ok(!isOverdue(t, '2026-08-19'));
});

test('the four due-state predicates are mutually exclusive for an open task', () => {
  for (const t of [LATE, DUE, AHEAD, UNDATED]) {
    const hits = [isOverdue(t, REF), isDueToday(t, REF), isUpcoming(t, REF), isUndated(t)].filter(Boolean);
    assert.equal(hits.length, 1, t.title);
  }
});

test('sort is due date, then priority, then created', () => {
  const a = task({ dueDate: REF, priority: 'low', createdAt: 1 });
  const b = task({ dueDate: REF, priority: 'high', createdAt: 2 });
  const c = task({ dueDate: '2026-08-19', priority: 'low', createdAt: 3 });
  const d = task({ dueDate: null, priority: 'high', createdAt: 4 });

  const sorted = [a, b, c, d].sort(byDueThenPriority);
  assert.deepEqual(sorted.map((t) => t.createdAt), [3, 2, 1, 4],
    'earlier date wins, then priority, and undated sorts last despite being high');
});

test('sort is stable for identical date and priority', () => {
  const x = task({ dueDate: REF, priority: 'medium', createdAt: 10 });
  const y = task({ dueDate: REF, priority: 'medium', createdAt: 20 });
  assert.ok(byDueThenPriority(x, y) < 0);
  assert.ok(byDueThenPriority(y, x) > 0);
});

test('the Today view leads with overdue, then today', () => {
  const s = sectionsFor(ALL, 'today', REF);
  assert.deepEqual(s.map((x) => x.label), ['Overdue', 'Today']);
  assert.equal(s[0].flagged, true, 'overdue is the only band that carries colour');
  assert.deepEqual(s[0].tasks.map((t) => t.id), ['late', 'late2']);
  assert.deepEqual(s[1].tasks.map((t) => t.id), ['due', 'due2']);
});

test('empty bands are dropped, never rendered as a heading over nothing', () => {
  const s = sectionsFor([DUE], 'today', REF);
  assert.deepEqual(s.map((x) => x.label), ['Today']);
  assert.deepEqual(sectionsFor([], 'today', REF), []);
});

test('a task completed today stays visible so the tick is reversible', () => {
  const justDone = task({ id: 'jd', dueDate: REF, status: 'done', completedAt: Date.parse(`${REF}T09:14`) });
  const s = sectionsFor([justDone, DONE_LATE], 'today', REF);
  assert.deepEqual(s.map((x) => x.label), ['Closed today']);
  assert.deepEqual(s[0].tasks.map((t) => t.id), ['jd'], 'a task closed on an earlier day does not come back');
});

test('All open surfaces undated tasks under their own band', () => {
  const s = sectionsFor(ALL, 'open', REF);
  assert.deepEqual(s.map((x) => x.label), ['Overdue', 'Today', 'Upcoming', 'No date']);
  assert.deepEqual(s.at(-1).tasks.map((t) => t.id), ['un']);
});

test('Completed is newest-first and excludes open tasks', () => {
  const older = task({ id: 'o', status: 'done', completedAt: 1000 });
  const newer = task({ id: 'n', status: 'done', completedAt: 2000 });
  const s = sectionsFor([older, newer, DUE], 'completed', REF);
  assert.deepEqual(s[0].tasks.map((t) => t.id), ['n', 'o']);
});

test('view counts match what the rail claims', () => {
  const c = viewCounts(ALL, REF);
  assert.equal(c.overdue, 2);
  assert.equal(c.today, 4, 'Today counts overdue plus due-today');
  assert.equal(c.upcoming, 1);
  assert.equal(c.open, 6);
  assert.equal(c.completed, 1);
});

test('search spans title and description, case-insensitively', () => {
  const withDesc = task({ id: 'wd', title: 'Nothing special', description: 'Suspect the AUTH redirect races.' });
  const pool = [...ALL, withDesc];
  assert.deepEqual(search(pool, 'ishaan').map((t) => t.id), ['late2']);
  assert.deepEqual(search(pool, 'auth redirect').map((t) => t.id), ['wd']);
  assert.equal(search(pool, '   ').length, pool.length, 'a blank query filters nothing');
  assert.equal(search(pool, 'zzz').length, 0);
});

test('priority filter is exact and "all" is a pass-through', () => {
  assert.deepEqual(filterPriority(ALL, 'high').map((t) => t.id), ['late', 'due']);
  assert.equal(filterPriority(ALL, 'all').length, ALL.length);
});
