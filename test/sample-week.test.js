import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleWeek } from '../src/lib/sample-week.js';
import { buildWeekly } from '../src/lib/report/draft.js';
import { fmtDuration } from '../src/lib/week.js';

test('the sample week has the shape the report page builds, and totals agree', () => {
  const W = sampleWeek(new Date(2026, 10, 2));
  assert.equal(W.days.length, 5);
  assert.equal(W.start.getDay(), 1);
  const items = Object.values(W.merged);
  assert.ok(items.some((e) => e.category === 'Tickets') && items.some((e) => e.category === 'Merge requests'));
  assert.ok(items.every((e) => e.days instanceof Set && e.tickets instanceof Set && e.ms > 0));
  assert.equal(Math.round(W.perDay.reduce((a, b) => a + b, 0)), items.reduce((s, e) => s + e.ms, 0));
  assert.ok(W.notes.length && W.done.oneOffs.length && W.done.recurring.length);
  assert.ok(fmtDuration(W.perDay[0]));
});

test('the draft generator builds a real update from the sample week', () => {
  const W = sampleWeek();
  const md = buildWeekly({ rangeLabel: 'x', items: Object.values(W.merged), notes: W.notes, done: W.done });
  assert.match(md, /### Done/);
  assert.match(md, /ENGX-151/);
  assert.match(md, /MR: web !418/);
  assert.match(md, /### Other work/);
  assert.doesNotMatch(md, /No work-related activity/);
});
