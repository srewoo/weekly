import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekly, nextWeekTasks, withoutExcludedNotes, noteKey } from '../../src/lib/report/draft.js';
import { convert } from '../../src/lib/report/formats.js';

// Next week = Mon 2026-11-09 .. Sun 2026-11-15
const task = (title, dueDate, priority = 'medium', extra = {}) => ({ id: title, title, dueDate, priority, status: 'open', repeat: null, ...extra });
const MON = '2026-11-09';

test('nextWeekTasks: due next week + overdue carried over, high first, capped, no recurring/done/later', () => {
  const tasks = [
    task('Low next', '2026-11-10', 'low'), task('High next', '2026-11-13', 'high'),
    task('Old', '2026-10-28'), task('Later', '2026-11-16'), task('Undated', null),
    task('Done', '2026-11-10', 'high', { status: 'done' }), task('Daily', null, 'high', { repeat: { days: [1], from: '2026-01-01', until: null } }),
  ];
  assert.deepEqual(nextWeekTasks(tasks, MON), [
    { title: 'High next', carried: false }, { title: 'Old', carried: true }, { title: 'Low next', carried: false }]);
  const many = Array.from({ length: 12 }, (_, i) => task(`t${i}`, '2026-11-10'));
  assert.equal(nextWeekTasks(many, MON).length, 8);
});

test('buildWeekly adds Next week only when non-empty, after Other work', () => {
  const next = [{ title: 'Ship v2', carried: false }, { title: 'Fix typo', carried: true }];
  const md = buildWeekly({ rangeLabel: 'x', items: [], notes: [{ text: 'Call' }], next });
  assert.match(md, /### Other work\n- Call\n\n### Next week\n- Ship v2\n- Fix typo \(carried over\)\n$/);
  assert.doesNotMatch(buildWeekly({ rangeLabel: 'x', items: [], notes: [{ text: 'Call' }], next: [] }), /Next week/);
});

test('Next week survives every copy format', () => {
  const md = buildWeekly({ rangeLabel: 'x', items: [], next: [{ title: 'Ship v2', carried: true }] });
  for (const f of ['slack', 'email', 'rich']) {
    const out = convert(f, md);
    assert.match(out.text + (out.html ?? ''), /Next week/);
    assert.match(out.text + (out.html ?? ''), /Ship v2/);
  }
});

test('unticked notes are filtered by their note:<id> key', () => {
  const notes = [{ id: 'a', text: 'Salary talk' }, { id: 'b', text: 'Demo' }];
  assert.deepEqual(withoutExcludedNotes(notes, new Set([noteKey(notes[0])])).map(n => n.id), ['b']);
  assert.equal(noteKey({ id: 'a' }), 'note:a');
});
