// Stats (L7): the year of days, streaks, weekday rates, per-task rates, summary
// cards and the heatmap layout. Runs in New York (two DST changes a year) and
// Kolkata (none), across the year boundary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

import { yearRows, streaks, weekdayRates, taskRates, summary, heatmap, pct, YEAR_DAYS } from '../src/lib/stats.js';
import { coerceTask } from '../src/lib/schema.js';
import { addDays, fromISODate } from '../src/lib/dates.js';

/** @param {object} patch */
const task = (patch) => /** @type {import('../src/lib/schema.js').Task} */ (coerceTask({ title: 'untitled', createdAt: 1, ...patch }));
/** Every Mon–Fri from `from` to `to`, inclusive. @param {string} from @param {string} to */
const workdays = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if ((fromISODate(d)?.getDay() ?? 0) % 6 !== 0) out.push(d);
  return out;
};
// Mon–Fri from 1 Dec 2026, ticked every working day from Mon 21 Dec to Fri 8 Jan.
const STANDUP = task({ id: 'su', title: 'Standup', repeat: { days: [1, 2, 3, 4, 5], from: '2026-12-01', until: null },
  doneDates: workdays('2026-12-21', '2027-01-08') });

test('a year is 365 consecutive local days ending today, across both DST changes and New Year', () => {
  const rows = yearRows([], '2027-01-05');
  assert.equal(rows.length, YEAR_DAYS);
  assert.equal(rows[0]?.iso, '2026-01-06');
  assert.equal(rows.at(-1)?.iso, '2027-01-05');
  for (let i = 1; i < rows.length; i++) assert.equal(rows[i]?.iso, addDays(rows[i - 1]?.iso ?? '', 1));
  for (const d of ['2026-03-08', '2026-11-01', '2026-12-31', '2027-01-01']) assert.ok(rows.some((r) => r.iso === d), d);
});

test('streaks run across New Year and skip weekends, which have nothing on them', () => {
  const s = streaks(yearRows([STANDUP], '2027-01-08'));
  assert.deepEqual(s, { current: 15, longest: 15 });
});

test('an unfinished today does not break the current streak; a missed day does', () => {
  assert.equal(streaks(yearRows([STANDUP], '2027-01-11')).current, 15, 'Monday 11 Jan is still in progress');
  assert.deepEqual(streaks(yearRows([STANDUP], '2027-01-12')), { current: 0, longest: 15 }, 'Monday was missed');
  const ticked = { ...STANDUP, doneDates: [...STANDUP.doneDates, '2027-01-11'] };
  assert.equal(streaks(yearRows([ticked], '2027-01-11')).current, 16, 'today counts once it is perfect');
});

test('a streak across the US spring-forward Sunday counts every day once', () => {
  const daily = task({ repeat: { days: [0, 1, 2, 3, 4, 5, 6], from: '2026-03-01', until: null },
    doneDates: ['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12'] });
  assert.deepEqual(streaks(yearRows([daily], '2026-03-12')), { current: 8, longest: 8 });
});

test('weekday rates average each weekday’s share done; days with nothing on them are left out', () => {
  const rates = weekdayRates(yearRows([STANDUP], '2027-01-08'));
  assert.equal(rates[0], null, 'Sunday');
  assert.equal(rates[6], null, 'Saturday');
  // Mondays in December and January: 7, 14 not ticked; 21, 28 Dec and 4 Jan ticked → 3 of 5.
  assert.equal(rates[1], 3 / 5);
  // Fridays: 4, 11, 18 Dec not; 25 Dec, 1 Jan, 8 Jan ticked → 3 of 6.
  assert.equal(rates[5], 3 / 6);
});

test('per-task rates count only the days a task occurred, never the future, best first', () => {
  const gym = task({ id: 'gym', title: 'Gym', createdAt: 2, repeat: { days: [3], from: '2026-12-01', until: '2026-12-16' },
    doneDates: ['2026-12-02', '2026-12-09', '2026-12-16', '2026-12-23'] });
  const later = task({ id: 'later', title: 'Starts tomorrow', createdAt: 3, repeat: { days: [1, 2, 3, 4, 5], from: '2027-01-09', until: null } });
  const rates = taskRates([later, STANDUP, gym, task({ title: 'one-off', dueDate: '2027-01-08' })], '2027-01-08');
  assert.deepEqual(rates.map((r) => [r.task.id, r.hit, r.live]), [['gym', 3, 3], ['su', 15, 29], ['later', 0, 0]]);
  assert.equal(rates[0]?.rate, 1);
  assert.equal(rates[2]?.rate, null);
});

test('summary cards: streaks, perfect days, average, active daily tasks, days with a plain note', () => {
  const stopped = task({ id: 'old', repeat: { days: [1], from: '2026-01-01', until: '2026-06-01' } });
  const rows = yearRows([STANDUP, stopped], '2027-01-08');
  const notes = [{ day: '2027-01-04', enc: null }, { day: '2027-01-04', enc: null }, { day: '2027-01-05', enc: { iv: 'a', ct: 'b' } },
    { day: null, enc: null }, { day: '2025-01-01', enc: null }];
  const s = summary(rows, [STANDUP, stopped], notes);
  assert.equal(s.current, 15);
  assert.equal(s.perfect, 15);
  assert.equal(s.daily, 1, 'a stopped task is not an active daily task');
  assert.equal(s.noteDays, 1, 'one day with plain notes inside the year; private and undated notes do not count');
  const tracked = rows.filter((r) => r.total > 0).length;
  assert.equal(s.average, Math.round((15 / tracked) * 100));
});

test('the heatmap is Monday-first weeks, padded at the start, each month labelled once', () => {
  const rows = yearRows([STANDUP], '2027-01-08');
  const { weeks, months } = heatmap(rows);
  const lead = ((fromISODate(rows[0]?.iso ?? '')?.getDay() ?? 0) + 6) % 7;
  assert.equal(weeks[0]?.filter((c) => c === null).length, lead);
  assert.equal(weeks.flat().filter(Boolean).length, YEAR_DAYS);
  assert.ok(weeks.slice(0, -1).every((w) => w.length === 7));
  assert.equal(months.length, weeks.length);
  assert.equal(months.filter(Boolean).length, 13, 'twelve months, with January twice');
  // A column is labelled by its Monday: the week of Fri 1 Jan starts on 28 Dec, so January's label is on 4 Jan's column.
  assert.equal(weeks[months.lastIndexOf('Jan')]?.[0]?.iso, '2027-01-04');
  assert.equal(pct({ iso: '', done: 1, total: 3 }), 33);
  assert.equal(pct({ iso: '', done: 0, total: 0 }), null);
});

test('a first column holding only a month’s last days leaves its label to the next month, so the two never print on top of each other', () => {
  // The year ending Sun 29 Nov 2026 starts on Sun 30 Nov 2025: the first column is that one Sunday, the second starts December.
  const { weeks, months } = heatmap(yearRows([STANDUP], '2026-11-29'));
  assert.equal(weeks[0]?.filter(Boolean).length, 1);
  assert.equal(months[0], '');
  assert.equal(months[1], 'Dec');
  assert.equal(months.filter(Boolean).length, 12, 'December to November, once each');
});
