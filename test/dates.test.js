import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toISODate, fromISODate, isValidISODate, addDays, daysBetween, relativeLabel,
  nextOccurrence, todayAt, parseTime, isValidTime, weekday,
} from '../src/lib/dates.js';

test('toISODate uses local calendar fields, not UTC', () => {
  // 23:30 local on the 20th is the 21st in UTC anywhere east of UTC+1.
  const d = new Date(2026, 7, 20, 23, 30);
  assert.equal(toISODate(d), '2026-08-20');
});

test('fromISODate parses to local midnight and round-trips', () => {
  const d = fromISODate('2026-08-20');
  assert.ok(d);
  assert.equal(d.getHours(), 0);
  assert.equal(d.getDate(), 20);
  assert.equal(toISODate(d), '2026-08-20');
});

test('fromISODate rejects impossible and malformed dates', () => {
  for (const bad of ['2026-02-31', '2026-13-01', '2026-8-1', 'tomorrow', '', '2026-08-20T00:00:00Z']) {
    assert.equal(fromISODate(bad), null, bad);
    assert.equal(isValidISODate(bad), false, bad);
  }
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('daysBetween is whole days and survives a DST boundary', () => {
  assert.equal(daysBetween('2026-08-20', '2026-08-22'), 2);
  assert.equal(daysBetween('2026-08-22', '2026-08-20'), -2);
  assert.equal(daysBetween('2026-08-20', '2026-08-20'), 0);
  // US spring-forward weekend: the interval is 23h of elapsed time but 1 day.
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
});

test('relativeLabel names the states the UI depends on', () => {
  const ref = '2026-08-20';
  assert.equal(relativeLabel('2026-08-20', ref), 'Due today');
  assert.equal(relativeLabel('2026-08-21', ref), 'Tomorrow');
  assert.equal(relativeLabel('2026-08-19', ref), '1 day late');
  assert.equal(relativeLabel('2026-08-18', ref), '2 days late');
});

test('parseTime and isValidTime guard the settings input', () => {
  assert.deepEqual(parseTime('09:00'), [9, 0]);
  assert.deepEqual(parseTime('23:59'), [23, 59]);
  assert.deepEqual(parseTime('nonsense'), [9, 0]);
  assert.ok(isValidTime('00:00'));
  assert.ok(!isValidTime('24:00'));
  assert.ok(!isValidTime('9:00'));
});

test('nextOccurrence is strictly in the future and on the local clock', () => {
  const from = new Date(2026, 7, 20, 10, 0, 0);
  const morning = new Date(nextOccurrence('09:00', from));
  assert.equal(morning.getDate(), 21, 'a passed time rolls to tomorrow');
  assert.equal(morning.getHours(), 9);

  const evening = new Date(nextOccurrence('18:00', from));
  assert.equal(evening.getDate(), 20, 'a future time stays today');
  assert.equal(evening.getHours(), 18);

  // Exactly-now must roll forward, or an alarm can re-fire in a loop.
  const exact = new Date(nextOccurrence('10:00', from));
  assert.equal(exact.getDate(), 21);
});

test('nextOccurrence tracks wall-clock across a DST transition', () => {
  // 2026-03-08 is US spring-forward. Scheduling from the day before must land
  // on 09:00 local, not 08:00 or 10:00 as a fixed +24h period would.
  const from = new Date(2026, 2, 7, 12, 0, 0);
  const next = new Date(nextOccurrence('09:00', from));
  assert.equal(next.getHours(), 9);
  assert.equal(next.getDate(), 8);
});

test('todayAt anchors to the same calendar day', () => {
  const from = new Date(2026, 7, 20, 23, 0, 0);
  const at = new Date(todayAt('09:00', from));
  assert.equal(at.getDate(), 20);
  assert.equal(at.getHours(), 9);
  assert.ok(at.getTime() < from.getTime(), 'already passed today');
});

test('weekday matches the settings.days convention (0=Sun)', () => {
  assert.equal(weekday('2026-08-20'), 4); // a Thursday
  assert.equal(weekday('2026-08-23'), 0); // a Sunday
});
