import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekly, buildStandup } from '../../src/lib/report/draft.js';

const item = (key, category, task, ms, extra = {}) => ({ key, category, task, ms, days: new Set([0]), tickets: new Set(), ...extra });

test('MRs fold under their ticket and statuses show', () => {
  const items = [
    item('jira:ENGX-1', 'Tickets', 'ENGX-1: Fix login', 3600e3),
    item('mr:a/b!4', 'Merge requests', 'b !4: fix', 600e3, { tickets: new Set(['ENGX-1']) }),
  ];
  const md = buildWeekly({ rangeLabel: 'Oct 27 to Nov 2', items, status: { 'jira:ENGX-1': 'Done', 'mr:a/b!4': 'merged' } });
  assert.match(md, /- ENGX-1: Fix login \[Done\]\n  - MR: b !4: fix \[merged\]/);
  assert.doesNotMatch(md, /Merge requests and code/);
});

test('non-engineering sections and custom categories', () => {
  const md = buildWeekly({ rangeLabel: 'x', items: [
    item('app:a', 'Sales & CRM', 'Acme renewal', 1e6),
    item('app:b', 'Recruiting & HR', 'Jane Doe', 1e6),
    item('rule:c', 'Partner work', 'Partner portal', 1e6),
  ] });
  assert.match(md, /### Sales and customers\n- Acme renewal/);
  assert.match(md, /### Recruiting and people\n- Jane Doe/);
  assert.match(md, /### Other\n- Partner portal/);
});

test('empty week says so', () => {
  assert.match(buildWeekly({ rangeLabel: 'x', items: [] }), /No work-related activity/);
});

test('standup has yesterday, today and blockers', () => {
  const md = buildStandup({ prevLabel: 'Yesterday', prevItems: [item('app:a', 'Sales & CRM', 'Acme call prep', 1e6)], todayItems: [] });
  assert.match(md, /### Yesterday\n#### Sales and customers\n- Acme call prep/);
  assert.match(md, /### Today\n- Nothing tracked yet\./);
  assert.match(md, /### Blockers\n- \n$/);
  assert.doesNotMatch(md, /None/);
});

test('hiding names replaces candidates and customers with numbered stand-ins', () => {
  const items = [
    item('app:a', 'Recruiting & HR', 'Jane Doe - Senior QA', 2e6),
    item('app:b', 'Recruiting & HR', 'John Roe - SDET', 1e6),
    item('app:c', 'Sales & CRM', 'Acme Corp renewal', 1e6),
    item('jira:ENGX-1', 'Tickets', 'ENGX-1: Fix login', 1e6),
  ];
  const md = buildWeekly({ rangeLabel: 'x', items, hideNames: true });
  assert.doesNotMatch(md, /Jane|John|Acme/);
  assert.match(md, /- Candidate 1\n- Candidate 2/);
  assert.match(md, /- Customer 1/);
  assert.match(md, /ENGX-1: Fix login/);     // work items keep their names
  const s = buildStandup({ prevLabel: 'Yesterday', prevItems: items, todayItems: [], hideNames: true });
  assert.doesNotMatch(s, /Jane|Acme/);
});
