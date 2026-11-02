import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORK_DAYS, isWorkday, dayKey, shiftDate, weekStart, expiredKeys, fmtDuration } from '../src/lib/week.js';

test('a working week is Monday to Friday', () => {
  assert.equal(WORK_DAYS, 5);
  const days = [26, 27, 28, 29, 30, 31].map((d) => isWorkday(new Date(2026, 9, d)));
  assert.deepEqual(days, [true, true, true, true, true, false]);
  assert.equal(isWorkday(new Date(2026, 10, 1)), false);
  assert.equal(isWorkday('2026-10-30'), true);
});

test('dayKey accepts dates and timestamps and uses the local calendar', () => {
  assert.equal(dayKey(new Date(2026, 9, 30, 23, 30)), '2026-10-30');
  assert.equal(dayKey(new Date(2026, 9, 30, 0, 5).getTime()), '2026-10-30');
});

test('shiftDate crosses months without UTC drift', () => {
  assert.equal(dayKey(shiftDate(new Date(2026, 9, 31), 1)), '2026-11-01');
  assert.equal(dayKey(shiftDate(new Date(2026, 2, 1), -1)), '2026-02-28');
});

test('weeks start on Monday', () => {
  assert.equal(dayKey(weekStart(0, new Date(2026, 9, 31))), '2026-10-26');
  assert.equal(dayKey(weekStart(-1, new Date(2026, 9, 26))), '2026-10-19');
});

test('purge picks every dated key older than 90 days, nothing else', () => {
  const now = new Date(2026, 9, 31).getTime();
  const keys = ['day:2026-07-01', 'day:2026-10-30', 'meta:2026-07-01', 'excluded:2026-06-29', 'draft:weekly:2026-06-29',
    'imp:abc:2026-07-01', 'imp:abc:2026-10-01', 'settings', 'notes', 'deviceId'];
  assert.deepEqual(expiredKeys(keys, now), ['day:2026-07-01', 'meta:2026-07-01', 'excluded:2026-06-29', 'draft:weekly:2026-06-29', 'imp:abc:2026-07-01']);
});

test('fmtDuration rounds to minutes', () => {
  assert.equal(fmtDuration(0), '0m');
  assert.equal(fmtDuration(59 * 60000), '59m');
  assert.equal(fmtDuration(60 * 60000), '1h');
  assert.equal(fmtDuration(125 * 60000), '2h 5m');
});

test('isWorkday reads a date string on the local calendar and refuses days that do not exist', () => {
  assert.equal(isWorkday('2026-10-26'), true);
  assert.equal(isWorkday('2026-10-31'), false);
  assert.equal(isWorkday('2026-02-31'), false, 'no rollover to 3 March');
  assert.equal(isWorkday('next tuesday'), false);
});

test('weekStart stays on local midnight Monday across both DST changes', () => {
  // US fall-back is Sun 1 Nov 2026; spring-forward is Sun 8 Mar 2026.
  const fall = weekStart(1, new Date(2026, 9, 30, 12));
  assert.equal(dayKey(fall), '2026-11-02');
  assert.equal(fall.getHours(), 0);
  assert.equal(dayKey(weekStart(0, new Date(2026, 10, 1, 23, 30))), '2026-10-26', 'the fall-back Sunday belongs to the week before');
  const spring = weekStart(1, new Date(2026, 2, 6, 12));
  assert.equal(dayKey(spring), '2026-03-09');
  assert.equal(spring.getHours(), 0);
});

test('the 90-day purge cutoff counts calendar days, not 24-hour blocks', () => {
  // 90 × 24 h back from late evening on 30 Nov crosses the fall-back hour and
  // lands on 2 Sep in New York; on the calendar, 90 days back is 1 Sep.
  const now = new Date(2026, 10, 30, 23, 30).getTime();
  assert.deepEqual(expiredKeys(['day:2026-08-31', 'day:2026-09-01', 'day:2026-09-02'], now), ['day:2026-08-31']);
});
