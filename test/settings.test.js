import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

let stub;
beforeEach(() => { stub = installChromeStub(); });

test('defaults fill in missing fields; storage is local, never sync', async () => {
  const { getSettings, DEFAULTS } = await import('../src/lib/settings.js');
  stub.stores.local.settings = { minMinutes: 5 };
  const s = await getSettings();
  assert.equal(s.minMinutes, 5);
  assert.equal(s.idleSeconds, DEFAULTS.idleSeconds);
  assert.deepEqual(stub.stores.sync, {});
});

test('concurrent updates are serialised and none is lost', async () => {
  const { updateSettings, getSettings } = await import('../src/lib/settings.js');
  await Promise.all([updateSettings({ role: 'sales' }), updateSettings({ minMinutes: 7 }), updateSettings({ paused: true })]);
  const s = await getSettings();
  assert.equal(s.role, 'sales');
  assert.equal(s.minMinutes, 7);
  assert.equal(s.paused, true);
});

test('a failed write rejects that caller only; the next update still lands', async () => {
  const { updateSettings, getSettings } = await import('../src/lib/settings.js');
  const realSet = stub.chrome.storage.local.set;
  stub.chrome.storage.local.set = async () => { throw new Error('QUOTA_BYTES quota exceeded'); };
  await assert.rejects(updateSettings({ role: 'sales' }), /QUOTA_BYTES/);
  stub.chrome.storage.local.set = realSet;
  await updateSettings({ minMinutes: 9 });
  const s = await getSettings();
  assert.equal(s.minMinutes, 9);
  assert.equal(s.role, 'general', 'the failed patch was not half-applied');
});

test('onSettingsChanged fires for local settings only, merged over defaults, and unsubscribes', async () => {
  const { onSettingsChanged, DEFAULTS } = await import('../src/lib/settings.js');
  /** @type {Record<string, unknown>[]} */
  const seen = [];
  const off = onSettingsChanged((s) => seen.push(s));
  const [listener] = stub.log.listeners['storage.onChanged'] ?? [];
  listener?.({ settings: { newValue: { role: 'hr' } } }, 'sync');
  listener?.({ notes: { newValue: [] } }, 'local');
  listener?.({ settings: { newValue: { role: 'hr' } } }, 'local');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.role, 'hr');
  assert.equal(seen[0]?.idleSeconds, DEFAULTS.idleSeconds);
  off();
  assert.equal(stub.log.listeners['storage.onChanged']?.length, 0);
});

test('tasks get a default priority from settings', async () => {
  const { DEFAULTS } = await import('../src/lib/settings.js');
  assert.equal(DEFAULTS.defaultPriority, 'medium');
});

test('updateSettings takes a function, run inside the lock: concurrent toggles never lose a flip', async () => {
  const { updateSettings, getSettings } = await import('../src/lib/settings.js');
  await updateSettings((s) => ({ paused: !s.paused }));
  assert.equal((await getSettings()).paused, true, 'one toggle flips it');
  await Promise.all([updateSettings((s) => ({ paused: !s.paused })), updateSettings((s) => ({ paused: !s.paused }))]);
  assert.equal((await getSettings()).paused, true, 'two quick toggles end where they started');
});

test('an invalid defaultPriority is never stored', async () => {
  const { updateSettings, getSettings } = await import('../src/lib/settings.js');
  await updateSettings({ defaultPriority: 'high' });
  assert.equal((await getSettings()).defaultPriority, 'high');
  await updateSettings({ defaultPriority: 'urgent' });
  assert.equal((await getSettings()).defaultPriority, 'medium');
});

test('reminder defaults: 09:00 brief, 18:00 check, Monday to Friday, notification and catch-up on (spec §3.3)', async () => {
  const { getSettings } = await import('../src/lib/settings.js');
  const s = await getSettings();
  assert.deepEqual(s.morning, { enabled: true, time: '09:00' });
  assert.deepEqual(s.evening, { enabled: true, time: '18:00' });
  assert.deepEqual(s.days, [1, 2, 3, 4, 5]);
  assert.equal(s.systemNotification, true);
  assert.equal(s.catchUpOnStartup, true);
});

test('bad reminder values fall back to the defaults; days are deduplicated and sorted', async () => {
  const { getSettings, updateSettings } = await import('../src/lib/settings.js');
  stub.stores.local.settings = { morning: { enabled: 'yes', time: '25:00' }, evening: { enabled: false, time: '17:30' }, days: [5, 9, 'x', 1, 1, 0], catchUpOnStartup: 1 };
  const s = await getSettings();
  assert.deepEqual(s.morning, { enabled: true, time: '09:00' });
  assert.deepEqual(s.evening, { enabled: false, time: '17:30' });
  assert.deepEqual(s.days, [0, 1, 5]);
  assert.equal(s.catchUpOnStartup, true);
  await updateSettings({ morning: { enabled: true, time: '' } });
  assert.equal(stub.stores.local.settings.morning.time, '09:00', 'an emptied time field is never stored');
});

test('onSettingsChanged hands listeners validated reminder settings', async () => {
  const { onSettingsChanged } = await import('../src/lib/settings.js');
  /** @type {any[]} */
  const seen = [];
  onSettingsChanged((s) => seen.push(s));
  const [listener] = stub.log.listeners['storage.onChanged'] ?? [];
  listener?.({ settings: { newValue: { days: 'weekdays', evening: { enabled: true, time: '7pm' } } } }, 'local');
  assert.deepEqual(seen[0]?.days, [1, 2, 3, 4, 5]);
  assert.equal(seen[0]?.evening.time, '18:00');
});

test('a Weekly 2 profile: its Friday reminder flag turns both slots on or off, then is dropped', async () => {
  const { getSettings, updateSettings } = await import('../src/lib/settings.js');
  stub.stores.local.settings = { role: 'hr', reminder: false };
  const off = await getSettings();
  assert.deepEqual([off.morning.enabled, off.evening.enabled, 'reminder' in off], [false, false, false]);
  stub.stores.local.settings = { role: 'hr', reminder: true };
  const on = await getSettings();
  assert.deepEqual([on.morning.enabled, on.evening.enabled], [true, true]);
  await updateSettings({ role: 'sales' });
  assert.equal('reminder' in stub.stores.local.settings, false, 'the old flag is not written back');
  assert.deepEqual(stub.stores.local.settings.morning, { enabled: true, time: '09:00' });
  stub.stores.local.settings = { ...stub.stores.local.settings, reminder: false };
  assert.equal((await getSettings()).morning.enabled, true, 'once the slots exist, a stray old flag decides nothing');
});

test('theme: light, dark or system (F6); system by default, anything else falls back to it', async () => {
  const { getSettings, updateSettings, readSettings, THEMES } = await import('../src/lib/settings.js');
  assert.deepEqual(THEMES, ['system', 'light', 'dark']);
  assert.equal((await getSettings()).theme, 'system');
  assert.equal((await updateSettings({ theme: 'dark' })).theme, 'dark');
  assert.equal(readSettings({ theme: 'neon' }).theme, 'system');
  assert.equal(readSettings({ theme: { toString: () => 'dark' } }).theme, 'system');
});

test('showStats is off by default, survives a profile without it, and a non-boolean falls back', async () => {
  const { getSettings, updateSettings } = await import('../src/lib/settings.js');
  assert.equal((await getSettings()).showStats, false);
  stub.stores.local.settings = { minMinutes: 5, showStats: 'yes' };
  assert.equal((await getSettings()).showStats, false);
  assert.equal((await updateSettings({ showStats: true })).showStats, true);
  assert.equal((await getSettings()).minMinutes, 5);
});
