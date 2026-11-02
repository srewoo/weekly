import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

let stub, T, now;
const realNow = Date.now;
const JIRA = { id: 1, url: 'https://acme.atlassian.net/browse/ENGX-1', title: '[ENGX-1] Fix login - Jira', active: true };
const DEAL = { id: 2, url: 'https://app.hubspot.com/contacts/1/record/0-3/7', title: 'Acme deal | HubSpot', active: true };
const min = (k, day = '2026-10-30') => (stub.stores.local['day:' + day]?.[k]?.ms ?? 0) / 60000;
const tick = async (m = 1) => { now += m * 60000; await T.refresh(); };

beforeEach(async () => {
  stub = installChromeStub();
  now = new Date(2026, 9, 30, 10, 0).getTime();
  Date.now = () => now;
  T = await import(`../../src/background/tracker.js?${Math.random()}`);   // fresh module state per test
  stub.setFocusedTab(JIRA);
  await T.refresh();
});
test.after(() => { Date.now = realNow; });

test('counts active minutes on the focused tab', async () => {
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(min('jira:ENGX-1'), 5);
});

test('takes back time credited after the last input when idle is detected', async () => {
  for (let i = 0; i < 5; i++) await tick();
  await tick(); await tick();
  assert.equal(min('jira:ENGX-1'), 7);
  stub.setIdle('idle'); await T.refresh();
  assert.equal(min('jira:ENGX-1'), 5);
  await tick(); await tick();
  assert.equal(min('jira:ENGX-1'), 5);
});

test('counts a switch when the task changes', async () => {
  await tick();
  stub.setFocusedTab(DEAL); await tick(); await tick();
  assert.equal(min('app:app.hubspot.com/contacts/1/record/0-3/7'), 1);
  assert.equal(stub.stores.local['meta:2026-10-30'].switches, 1);
});

test('ignored domains never become the current session', async () => {
  stub.stores.local.settings = { ignoreDomains: ['youtube.com'] };
  stub.setFocusedTab({ id: 3, url: 'https://www.youtube.com/watch?v=1', title: 'x', active: true });
  await tick();
  assert.equal(stub.stores.session.current, null);
});

test('no phantom entry when the day is deleted before idle is detected', async () => {
  for (let i = 0; i < 3; i++) await tick();
  delete stub.stores.local['day:2026-10-30'];
  stub.setIdle('idle'); await T.refresh();
  const day = stub.stores.local['day:2026-10-30'];
  assert.ok(!day || Object.keys(day).length === 0);
});

test('without the tabs permission nothing is recorded; granting it starts tracking at the next look (W3)', async () => {
  await tick();
  stub.setGranted([]);
  await T.refresh();   // what the worker does on permissions.onRemoved
  for (let i = 0; i < 3; i++) await tick();
  assert.equal(min('jira:ENGX-1'), 1, 'only the minute before the permission went');
  assert.equal(stub.stores.session.current, null);
  stub.setGranted(['tabs']);
  await tick(); await tick();
  assert.equal(min('jira:ENGX-1'), 2);
});

test('time active in another app counts as Outside Chrome, never as the last tab', async () => {
  await tick(); await tick();
  stub.setWindowFocused(false);
  for (let i = 0; i < 3; i++) await tick();
  stub.setWindowFocused(true); await tick();
  assert.equal(min('jira:ENGX-1'), 3);
  assert.equal(min('away'), 3);
  assert.equal(stub.stores.local['day:2026-10-30'].away.category, 'Outside Chrome');
});

test('Outside Chrome can be switched off', async () => {
  stub.stores.local.settings = { trackAway: false };
  stub.setWindowFocused(false);
  for (let i = 0; i < 3; i++) await tick();
  assert.equal(min('away'), 0);
});

test('sleep is never counted: time stops at the last look before the gap', async () => {
  await tick(); await tick();
  now += 30000; await T.refresh();          // last look 30s into the third minute
  now += 45 * 60000; await T.refresh();     // the computer slept 45 min, then the alarm fires late
  assert.equal(min('jira:ENGX-1'), 2.5);
  await tick();
  assert.equal(min('jira:ENGX-1'), 3.5);    // tracking resumes normally after waking
});

test('a stored page title lets a later rule relabel the entry', async () => {
  await tick();
  assert.equal(stub.stores.local['day:2026-10-30']['jira:ENGX-1'].title, '[ENGX-1] Fix login - Jira');
});
