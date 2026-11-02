import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../../src/lib/activity/classify.js';
import { estimateFromVisits, GAP_CAP, TAIL } from '../../src/lib/activity/history.js';

const t0 = new Date(2026, 9, 27, 9, 0).getTime();
const min = m => t0 + m * 60000;
const v = (m, url, title = '') => ({ time: min(m), url, title });
const settings = { ignoreDomains: ['youtube.com'] };

test('time comes from the gap to the next visit, capped, with breaks', () => {
  const days = estimateFromVisits([
    v(0, 'https://acme.atlassian.net/browse/ENGX-1', '[ENGX-1] Fix login - Jira'),
    v(4, 'https://app.hubspot.com/contacts/1/record/0-3/7', 'Acme | HubSpot'),
    v(40, 'https://acme.atlassian.net/browse/ENGX-1', '[ENGX-1] Fix login - Jira'),   // 36 min gap: a break
    v(45, 'https://www.youtube.com/watch?v=1', 'x'),                                 // ignored domain
    v(46, 'https://app.ahrefs.com/a', 'x'),
    v(46.02, 'https://app.ahrefs.com/b', 'x'),                                       // 1 s hop: redirect, skipped
  ], settings, classify);
  const d = days['2026-10-27'];
  assert.equal(d['jira:ENGX-1'].ms, 4 * 60000 + 6 * 60000);   // 4 min, then 6 min to the next kept visit
  assert.equal(d['app:app.hubspot.com/contacts/1/record/0-3/7'].ms, TAIL);
  assert.equal(d['app:app.ahrefs.com/b'].ms, TAIL);            // last visit of the run
  assert.equal(d['app:app.ahrefs.com/a'], undefined);
  assert.ok(!Object.keys(d).some(k => k.includes('youtube')));
});

test('a long single view is capped and visits split by day', () => {
  const days = estimateFromVisits([v(0, 'https://app.asana.com/0/1/2', 'Plan'), v(25, 'https://app.asana.com/0/1/3', 'Plan'),
    v(24 * 60, 'https://app.asana.com/0/1/2', 'Plan')], settings, classify);
  assert.equal(days['2026-10-27']['app:app.asana.com/0/1/2'].ms, GAP_CAP);
  assert.ok(days['2026-10-28']);
});

test('install day: history fills the hours before live tracking began, never after', async () => {
  const { installChromeStub } = await import('../helpers/chrome-stub.js');
  const stub = installChromeStub();
  const at = (h, m = 0) => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(h, m, 0, 0); return d.getTime(); };   // yesterday: never in the future
  const visits = [['https://acme.atlassian.net/browse/ENGX-1', '[ENGX-1] Login - Jira', at(9)], ['https://acme.atlassian.net/browse/ENGX-1', '[ENGX-1] Login - Jira', at(9, 8)],
    ['https://example.org/a', 'A', at(15, 30)], ['https://example.org/b', 'B', at(15, 35)]];
  stub.chrome.history = {
    search: async () => [...new Set(visits.map(v => v[0]))].map(url => ({ url, title: visits.find(v => v[0] === url)[1] })),
    getVisits: async ({ url }) => visits.filter(v => v[0] === url).map(v => ({ visitTime: v[2], transition: 'link' })),
  };
  const { dayKey } = await import('../../src/lib/week.js');
  const today = dayKey(new Date(at(12)));
  stub.stores.local['day:' + today] = { 'site:example.org': { category: 'Browsing', task: 'example.org', ms: 600000, first: at(15), last: at(15, 40), tickets: [] } };
  const { backfillFromHistory } = await import(`../../src/lib/activity/history.js?${Math.random()}`);
  await backfillFromHistory();
  const hist = stub.stores.local['hist:' + today];
  assert.ok(hist['jira:ENGX-1'], 'the morning is filled in');
  assert.equal(hist['jira:ENGX-1'].title, '[ENGX-1] Login - Jira');
  assert.equal(hist['site:example.org'], undefined, 'nothing after tracking began');
});
