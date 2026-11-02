// What the morning brief and the evening check say: Daybook's payload tests, plus
// daily tasks, the working-days rule and the weekly-update nudge (spec §3.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { buildPayload, isReminderDay, isLastWorkday, headline, subline, notificationText } from '../src/lib/reminders.js';
import { coerceTask } from '../src/lib/schema.js';

/** @param {object} patch */
const task = (patch) => /** @type {import('../src/lib/schema.js').Task} */ (coerceTask({ title: 'a task', ...patch }));
/** Local noon, so completedAt never sits near midnight in either test timezone. @param {string} iso */
const noon = (iso) => new Date(`${iso}T12:00:00`).getTime();

// Thu 29 Oct 2026.
const REF = '2026-10-29';
const WEEKDAYS = [1, 2, 3, 4, 5];
const STANDUP = task({ id: 'su', title: 'Standup', repeat: { days: WEEKDAYS, from: '2026-10-26', until: null }, doneDates: [] });

test('morning: due today plus overdue; closed today counted, not listed', () => {
  const p = buildPayload('morning', [
    task({ id: 'late', dueDate: '2026-10-28' }),
    task({ id: 'due', dueDate: REF }),
    task({ id: 'ahead', dueDate: '2026-11-02' }),
    task({ id: 'none' }),
    task({ id: 'done', dueDate: REF, status: 'done', completedAt: noon(REF) }),
  ], WEEKDAYS, REF);
  assert.deepEqual(p.overdue.map((t) => t.id), ['late']);
  assert.deepEqual(p.today.map((t) => t.id), ['due']);
  assert.equal(p.closedToday, 1);
  assert.equal(p.empty, false);
});

test('undated tasks never enter a reminder', () => {
  const p = buildPayload('morning', [task({ id: 'none' }), task({ id: 'none2' })], WEEKDAYS, REF);
  assert.equal(p.empty, true, 'an undated task was never claimed for today');
});

test('a daily task is listed first until it is ticked for today; then it counts as closed', () => {
  const open = buildPayload('evening', [task({ id: 'due', dueDate: REF }), STANDUP], WEEKDAYS, REF);
  assert.deepEqual(open.today.map((t) => t.id), ['su', 'due']);
  const ticked = buildPayload('evening', [{ ...STANDUP, doneDates: [REF] }], WEEKDAYS, REF);
  assert.equal(ticked.empty, true);
  assert.equal(ticked.closedToday, 1);
});

test('a daily task on a day it does not occur is not listed', () => {
  assert.equal(buildPayload('morning', [STANDUP], [0, 1, 2, 3, 4, 5, 6], '2026-10-31').empty, true, 'Saturday');
});

test('isReminderDay reads the settings.days convention (0=Sun)', () => {
  assert.equal(isReminderDay(WEEKDAYS, REF), true, 'Thursday');
  assert.equal(isReminderDay(WEEKDAYS, '2026-10-31'), false, 'Saturday');
  assert.equal(isReminderDay(WEEKDAYS, '2026-11-01'), false, 'Sunday');
});

test('the last working day: Friday by default, Thursday for a Mon–Thu week, Sunday when Sunday is worked', () => {
  assert.equal(isLastWorkday(WEEKDAYS, '2026-10-30'), true, 'Friday');
  assert.equal(isLastWorkday(WEEKDAYS, REF), false, 'Thursday');
  assert.equal(isLastWorkday([1, 2, 3, 4], REF), true, 'Mon–Thu week');
  assert.equal(isLastWorkday([0, 1, 2, 3, 4, 5], '2026-10-30'), false, 'Sunday still to come');
  assert.equal(isLastWorkday([0, 1, 2, 3, 4, 5], '2026-11-01'), true, 'Sunday ends the Monday week');
  assert.equal(isLastWorkday(WEEKDAYS, '2026-10-31'), false, 'not a working day at all');
  assert.equal(buildPayload('evening', [], WEEKDAYS, '2026-10-30').weekEnds, true);
});

test('headline and notification: counts in words, the weekly-update nudge only on the last evening', () => {
  const late = task({ id: 'late', dueDate: '2026-10-28' });
  const morning = buildPayload('morning', [late, task({ dueDate: REF })], WEEKDAYS, REF);
  assert.equal(headline(morning), 'Two things due today.');
  assert.equal(subline(morning), 'One task carried over.');
  const thursday = buildPayload('evening', [late], WEEKDAYS, REF);
  assert.deepEqual(notificationText(thursday), { title: 'One task still open', message: 'You closed 0 today.' });
  const friday = buildPayload('evening', [], WEEKDAYS, '2026-10-30');
  assert.equal(headline(friday), 'Nothing left open.');
  assert.match(notificationText(friday).message, /weekly update is drafted/);
  assert.doesNotMatch(notificationText(buildPayload('morning', [late], WEEKDAYS, '2026-10-30')).message, /weekly update/);
});

import { weekCounts, readyLine, progressLine } from '../src/lib/reminder-week.js';

test('week line: counts tickets and merge requests above the minimum, leaves out zeros', () => {
  const items = [{ category: 'Tickets', ms: 600000 }, { category: 'Tickets', ms: 1000 }, { category: 'Merge requests', ms: 600000 },
    { category: 'Merge requests', ms: 600000 }, { category: 'Docs & specs', ms: 600000 }];
  const c = weekCounts(items, 5, 2);
  assert.deepEqual(c, { done: 5, tickets: 1, mrs: 2 });
  assert.equal(readyLine(c), 'Your weekly update is ready: 5 done, 1 ticket, 2 merge requests.');
  assert.equal(readyLine({ done: 0, tickets: 0, mrs: 0 }), 'Your weekly update is ready.');
  assert.equal(progressLine(c), 'This week so far: 5 done, 1 ticket, 2 merge requests tracked.');
  assert.equal(progressLine({ done: 2, tickets: 0, mrs: 0 }), 'This week so far: 2 done.');
});

test('the last evening notification leads with the ready update; other days keep the counts', () => {
  const ready = readyLine({ done: 5, tickets: 3, mrs: 2 });
  assert.deepEqual(notificationText(buildPayload('evening', [], WEEKDAYS, '2026-10-30'), ready),
    { title: 'Your weekly update is ready: 5 done, 3 tickets, 2 merge requests', message: 'Review and copy it.' });
  assert.equal(notificationText(buildPayload('evening', [], WEEKDAYS, REF), ready).title, 'Nothing left open');
});
