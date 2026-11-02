import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrends } from '../../src/lib/report/trends.js';

test('sums Mon–Fri only, splits focus from meetings, averages switches over active days', () => {
  const day = (ms, cats, sw) => ({ ms, cats, sw });
  const week = [day(3600e3, { Tickets: 3000e3, Meetings: 600e3 }, 4), day(0, {}, 0), day(1800e3, { Browsing: 1800e3 }, 2),
    day(0, {}, 0), day(0, {}, 0), day(7200e3, { Tickets: 7200e3 }, 9), day(0, {}, 0)];   // Sat has time: must be ignored
  const range = { start: new Date(2026, 9, 26), perDay: week.map((d) => d.ms), perDayCat: week.map((d) => d.cats), switches: week.map((d) => d.sw) };
  const [row] = computeTrends(range, 1);
  assert.equal(row.total, 5400e3);
  assert.equal(row.meet, 600e3);
  assert.equal(row.focus, 3000e3);
  assert.equal(row.switches, 3);
  assert.equal(row.label, '10-26');
});

test('Outside Chrome time is rolled up per week, Mon–Fri, apart from Chrome time', () => {
  const z = Array(7).fill(0);
  const range = { start: new Date(2026, 9, 26), perDay: [...z], perDayCat: z.map(() => ({})), switches: [...z], awayPerDay: [600e3, 0, 0, 0, 300e3, 999e3, 0] };
  const [row] = computeTrends(range, 1);
  assert.equal(row.away, 900e3);
  assert.equal(row.total, 0);
});
