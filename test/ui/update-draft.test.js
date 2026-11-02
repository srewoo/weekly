import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeUpdate, summarize } from '../../src/ui/panel/update-draft.js';

const start = new Date(2026, 10, 2); // Mon 2 Nov 2026
const item = (key, task, ms, category = 'Tickets') => ({ key, task, ms, category, days: new Set([0]), tickets: new Set() });
const base = { start, minMinutes: 2, anonymize: false, excluded: [], notes: [], tasks: [], ref: '2026-11-04' };

test('composeUpdate drops short and excluded items and names the week', () => {
  const merged = { a: item('a', 'ENG-1 Fix login', 600000), b: item('b', 'ENG-2 tiny', 1000), c: item('c', 'ENG-3 hidden', 600000) };
  const md = composeUpdate({ ...base, merged, excluded: ['c'] });
  assert.match(md, /^## Weekly update: Nov 2 to Nov 6/);
  assert.match(md, /ENG-1 Fix login/);
  assert.doesNotMatch(md, /ENG-2|ENG-3/);
});

test('composeUpdate with nothing says so', () => {
  assert.match(composeUpdate({ ...base, merged: {} }), /No work-related activity/);
});

test('summarize counts bullets per section, and is null for an empty draft', () => {
  assert.deepEqual(summarize('## W\n\n### Done\n- a\n- b\n### Tickets\n- c\n'), { lines: 3, parts: 'Done 2 · Tickets 1' });
  assert.equal(summarize('## W\n\n_No work-related activity recorded this week yet._\n'), null);
});

test('composeUpdate honours note exclusions and adds Next week', () => {
  const notes = [{ id: 'n1', day: '2026-11-03', title: '', body: 'Salary talk', createdAt: 1, enc: null }, { id: 'n2', day: '2026-11-03', title: '', body: 'Demo prep', createdAt: 2, enc: null }];
  const tasks = [{ id: 't1', title: 'Plan Q1', dueDate: '2026-11-10', priority: 'high', status: 'open', repeat: null, doneDates: [] }];
  const md = composeUpdate({ ...base, merged: {}, notes: /** @type {any} */ (notes), excluded: ['note:n1'], tasks: /** @type {any} */ (tasks) });
  assert.doesNotMatch(md, /Salary/);
  assert.match(md, /### Other work\n- Demo prep/);
  assert.match(md, /### Next week\n- Plan Q1\n/);
});
