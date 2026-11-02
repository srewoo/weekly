import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

let stub;
beforeEach(() => { stub = installChromeStub(); });
const e = (category, task, min) => ({ category, task, url: 'https://x.test/', ms: min * 60000, first: 1, last: 2, tickets: [] });

test('merges this device, imported devices, and history (which only covers the hours before tracking began)', async () => {
  const { loadRange } = await import('../../src/lib/activity/range.js');
  Object.assign(stub.stores.local, {
    imports: ['laptop'],
    'day:2026-10-26': { 'jira:A-1': e('Tickets', 'A-1', 30) },
    'imp:laptop:2026-10-26': { 'jira:A-1': e('Tickets', 'A-1', 15) },
    'hist:2026-10-26': { 'site:x': e('Browsing', 'x', 99) },          // the morning before tracking began
    'hist:2026-10-27': { 'site:y': e('Browsing', 'y', 20) },          // used: no live data
    'meta:2026-10-26': { switches: 4 },
  });
  const r = await loadRange(new Date(2026, 9, 26), 2);
  assert.equal(r.merged['jira:A-1'].ms, 45 * 60000);
  assert.equal(r.merged['site:x'].est, true);
  assert.equal(r.merged['site:y'].est, true);
  assert.deepEqual(r.estimated, [true, true]);
  assert.deepEqual(r.histTried, [true, true]);
  assert.deepEqual(r.switches, [4, 0]);
});

test('isIgnored matches the domain and its subdomains, and rejects bad URLs', async () => {
  const { isIgnored } = await import('../../src/lib/activity/range.js');
  assert.equal(isIgnored('https://m.youtube.com/x', ['youtube.com']), true);
  assert.equal(isIgnored('https://notyoutube.com/', ['youtube.com']), false);
  assert.equal(isIgnored('not a url', []), true);
});

test('a stored __proto__ key cannot pollute Object.prototype or break the report', async () => {
  const { loadRange } = await import('../../src/lib/activity/range.js');
  stub.stores.local['day:2026-10-26'] = JSON.parse('{"__proto__": {"category":"X","task":"t","url":"","ms":5,"first":1,"last":2,"tickets":[]}}');
  const r = await loadRange(new Date(2026, 9, 26), 1);
  assert.equal(({}).ms, undefined);
  assert.equal(r.perDay[0], 5);
});

test('a rule written today relabels last week’s Browsing entries; Outside Chrome is listed, not summed', async () => {
  const { installChromeStub } = await import('../helpers/chrome-stub.js');
  const stub = installChromeStub();
  const { loadRange } = await import(`../../src/lib/activity/range.js?${Math.random()}`);
  stub.stores.local.settings = { rules: ['intranet.acme.com => Docs & specs | Intranet'] };
  stub.stores.local['day:2026-10-26'] = {
    'site:intranet.acme.com': { category: 'Browsing', task: 'intranet.acme.com', url: 'https://intranet.acme.com/x', title: 'Home', ms: 600000, last: 1 },
    away: { category: 'Outside Chrome', task: 'Outside Chrome', ms: 900000, last: 1 },
  };
  const r = await loadRange(new Date(2026, 9, 26), 1);
  assert.equal(r.merged['rule:Docs & specs:Intranet'].category, 'Docs & specs');
  assert.equal(r.merged.away.ms, 900000);
  assert.equal(r.perDay[0], 600000);
});
