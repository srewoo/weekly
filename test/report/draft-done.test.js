import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekly } from '../../src/lib/report/draft.js';

const item = (key, category, task, ms) => ({ key, category, task, ms, days: new Set([0]), tickets: new Set() });
const done = {
  oneOffs: [{ title: 'Ship the login fix' }, { title: 'Call Acme Corp about renewal' }],
  recurring: [{ task: { title: 'Standup notes' }, done: 5, of: 5 }, { task: { title: 'Inbox zero' }, done: 1, of: 1 }],
};

test('the Done section leads the update: one-offs, then recurring with their counts', () => {
  const md = buildWeekly({ rangeLabel: 'Oct 26 to Oct 30', items: [item('jira:ENGX-1', 'Tickets', 'ENGX-1: Fix login', 36e5)], done });
  assert.match(md, /^## Weekly update: Oct 26 to Oct 30\n\n### Done\n- Ship the login fix\n- Call Acme Corp about renewal\n- Standup notes \(5 of 5 days\)\n- Inbox zero \(1 of 1 day\)\n\n### Tickets\n/);
});

test('hiding names never touches task titles: they are the user’s own words', () => {
  const md = buildWeekly({ rangeLabel: 'x', items: [item('app:c', 'Sales & CRM', 'Acme Corp renewal', 1e6)], done, hideNames: true });
  assert.match(md, /- Call Acme Corp about renewal/);
  assert.match(md, /### Sales and customers\n- Customer 1/);
});

test('no Done section when nothing was done, and a Done-only week is not "empty"', () => {
  assert.doesNotMatch(buildWeekly({ rangeLabel: 'x', items: [], done: { oneOffs: [], recurring: [] } }), /### Done/);
  const md = buildWeekly({ rangeLabel: 'x', items: [], done: { oneOffs: [{ title: 'Wrote the spec' }], recurring: [] } });
  assert.match(md, /### Done\n- Wrote the spec\n$/);
  assert.doesNotMatch(md, /No work-related activity/);
});
