import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

const stub = installChromeStub();
await import('../../src/background/service-worker.js');
const { createNote } = await import('../../src/lib/notes.js');
// Someone who keeps tasks here: with none at all the evening check only comes on the last working day (reminders.test.js).
const { coerceTask } = await import('../../src/lib/schema.js');
await stub.chrome.storage.local.set({ tasks: [coerceTask({ title: 'kept task', status: 'done', completedAt: 1 })], schemaVersion: 2 });

/** Deliver a storage change to every onChanged listener the worker registered. */
const fire = (/** @type {object} */ changes, /** @type {string} */ area) => {
  for (const fn of stub.log.listeners['storage.onChanged'] ?? []) fn(changes, area);
};
const PAGE = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/report/report.html' };
const CONTENT = { id: 'weekly', url: 'https://example.com/', tab: { id: 5, windowId: 1 } };
const settle = () => new Promise((r) => setTimeout(r, 30));

/** Call every listener the worker registered for a chrome event. */
const emit = (/** @type {string} */ name, /** @type {unknown[]} */ ...args) => {
  for (const fn of stub.log.listeners[name] ?? []) fn(...args);
};
/** What a settings change reschedules from: storage, read under the lock. */
const setSettings = (/** @type {object} */ settings) => stub.chrome.storage.local.set({ settings });

test('a local settings change reschedules the morning and evening alarms', async () => {
  await setSettings({ morning: { enabled: false, time: '09:00' } });
  fire({ settings: { newValue: {} } }, 'local');
  await settle();
  assert.equal(stub.log.alarms.has('weekly:morning'), false, 'turning the brief off clears its alarm');
  assert.ok(stub.log.alarms.has('weekly:evening'));
  await setSettings({});
  fire({ settings: { newValue: {} } }, 'local');
  await settle();
  assert.ok(stub.log.alarms.has('weekly:morning'), 'turning it back on schedules it');
});

test('other areas and other keys never touch the reminders', async () => {
  stub.log.alarms.clear();
  fire({ settings: { newValue: {} } }, 'sync');
  fire({ tasks: { newValue: [] } }, 'local');
  await settle();
  assert.equal(stub.log.alarms.size, 0);
});

test('Weekly 2’s Friday alarm is cleared on update; the new slots are scheduled', async () => {
  await setSettings({ reminder: true });
  stub.chrome.alarms.create('reminder', { when: Date.now() + 60_000 });
  emit('runtime.onInstalled', { reason: 'update' });
  await settle();
  assert.equal(stub.log.alarms.has('reminder'), false);
  assert.ok(stub.log.alarms.has('weekly:morning') && stub.log.alarms.has('weekly:evening') && stub.log.alarms.has('tick'));
});

test('an evening alarm shows the check and chains the next one', async () => {
  await setSettings({ days: [0, 1, 2, 3, 4, 5, 6] });
  stub.log.alarms.delete('weekly:evening');
  emit('alarms.onAlarm', { name: 'weekly:evening' });
  await settle();
  assert.match(stub.log.windowsCreated.at(-1)?.url ?? '', /slot=evening/);
  assert.ok(stub.log.alarms.get('weekly:evening').when > Date.now());
});

test('a browser start catches up a check whose time has passed (D9)', async () => {
  await setSettings({ morning: { enabled: false, time: '09:00' }, evening: { enabled: true, time: '00:00' }, days: [0, 1, 2, 3, 4, 5, 6] });
  await stub.chrome.storage.local.remove('reminderState');
  const before = stub.log.windowsCreated.length + stub.log.tabsUpdated.length;
  emit('runtime.onStartup');
  await settle();
  assert.equal(stub.log.windowsCreated.length + stub.log.tabsUpdated.length, before + 1);
  assert.match(stub.log.tabsUpdated.at(-1)?.url ?? stub.log.windowsCreated.at(-1)?.url ?? '', /slot=evening/);
});

test('clicking a reminder notification opens its window; Weekly 2’s old notification id is ignored', async () => {
  const before = stub.log.windowsCreated.length + stub.log.tabsUpdated.length;
  emit('notifications.onClicked', 'reminder');
  emit('notifications.onClicked', 'weekly:remind:morning');
  await settle();
  assert.equal(stub.log.windowsCreated.length + stub.log.tabsUpdated.length, before + 1);
  assert.match(stub.log.tabsUpdated.at(-1)?.url ?? '', /slot=morning/);
});

test('messages: Preview opens the window, Snooze sets the snooze alarm; others are not answered', async () => {
  /** @type {unknown[]} */
  const answers = [];
  emit('runtime.onMessage', { type: 'reminder:preview', slot: 'evening' }, PAGE, (/** @type {unknown} */ r) => answers.push(r));
  emit('runtime.onMessage', { type: 'reminder:snooze' }, PAGE, (/** @type {unknown} */ r) => answers.push(r));
  emit('runtime.onMessage', { type: 'something-else' }, PAGE, (/** @type {unknown} */ r) => answers.push(r));
  await settle();
  assert.deepEqual(answers, [{ ok: true }, { ok: true }]);
  assert.match(stub.log.tabsUpdated.at(-1)?.url ?? '', /slot=evening/);
  assert.ok(stub.log.alarms.has('weekly:snooze'));
});

test('crypto:* messages are answered asynchronously by the PIN broker (the listener keeps the channel open)', async () => {
  /** @type {unknown[]} */
  const answers = [];
  /** @type {unknown[]} */
  const kept = [];
  for (const fn of stub.log.listeners['runtime.onMessage'] ?? []) kept.push(fn({ type: 'crypto:status' }, PAGE, (/** @type {unknown} */ r) => answers.push(r)));
  await settle();
  assert.deepEqual(kept, [true]);
  assert.deepEqual(answers, [{ ok: true, hasPin: false, unlocked: false, lockedUntil: 0, failedAttempts: 0 }]);
});

test("only Weekly's own pages may ask for reminders or the PIN; a content script may not (Phase 3 m4)", async () => {
  /** @type {unknown[]} */
  const answers = [];
  const before = stub.log.windowsCreated.length + stub.log.tabsUpdated.length;
  for (const type of ['reminder:preview', 'reminder:snooze', 'crypto:status']) emit('runtime.onMessage', { type }, CONTENT, (/** @type {unknown} */ r) => answers.push(r));
  emit('runtime.onMessage', { type: 'crypto:status' }, { id: 'other', url: 'chrome-extension://other/x.html' }, (/** @type {unknown} */ r) => answers.push(r));
  await settle();
  assert.deepEqual(answers, Array(3).fill({ ok: false, error: 'Not allowed.' }));
  assert.equal(stub.log.windowsCreated.length + stub.log.tabsUpdated.length, before);
  // panel:* is for Weekly's pages too; a content script gets plain notes (notes:*) and nothing else.
  /** @type {unknown[]} */
  const panelAnswers = [];
  for (const type of ['panel:hello', 'panel:openOnPage']) emit('runtime.onMessage', { type, windowId: 1 }, CONTENT, (/** @type {unknown} */ r) => panelAnswers.push(r));
  await createNote({ title: 'Plain one' });
  await createNote({ enc: { iv: 'AAAAAAAAAAAAAAAA', ct: 'c2VjcmV0' } });
  emit('runtime.onMessage', { type: 'notes:list' }, CONTENT, (/** @type {unknown} */ r) => panelAnswers.push(r));
  await settle();
  assert.deepEqual(panelAnswers.slice(0, 2), Array(2).fill({ ok: false, error: 'Not allowed.' }));
  const listed = /** @type {{ ok: boolean, notes: { title: string }[] }} */ (panelAnswers[2]);
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.notes.map((n) => n.title), ['Plain one'], 'plain notes only');
});

test('the worker listens to storage once, through onSettingsChanged', () => {
  assert.equal(stub.log.listeners['storage.onChanged']?.length, 1);
});

test('the toolbar icon opens the side panel', () => {
  assert.deepEqual(stub.log.panelBehavior, { openPanelOnActionClick: true });
});

test('an update from a Weekly 2 profile with no reminder flag leaves both reminders off', async () => {
  await setSettings({ paused: false });
  emit('runtime.onInstalled', { reason: 'update' });
  await settle();
  const { settings } = await stub.chrome.storage.local.get('settings');
  assert.deepEqual([settings.morning.enabled, settings.evening.enabled], [false, false]);
  assert.equal(stub.log.alarms.has('weekly:morning') || stub.log.alarms.has('weekly:evening'), false);
});

test('a stale evening alarm (fired next morning) shows nothing, marks nothing, and chains the next', async () => {
  await setSettings({ days: [0, 1, 2, 3, 4, 5, 6] });
  await stub.chrome.storage.local.remove('reminderState');
  stub.log.alarms.delete('weekly:evening');
  const before = stub.log.windowsCreated.length + stub.log.tabsUpdated.length;
  emit('alarms.onAlarm', { name: 'weekly:evening', scheduledTime: Date.now() - 864e5 });
  await settle();
  assert.equal(stub.log.windowsCreated.length + stub.log.tabsUpdated.length, before);
  const { reminderState } = await stub.chrome.storage.local.get('reminderState');
  assert.ok(!reminderState?.eveningLastShown);
  assert.ok(stub.log.alarms.get('weekly:evening').when > Date.now());
});

test('a fire that throws still chains the next alarm', async () => {
  await setSettings({ days: [0, 1, 2, 3, 4, 5, 6] });
  await stub.chrome.storage.local.remove('reminderState');
  stub.log.alarms.delete('weekly:evening');
  const create = stub.chrome.windows.create;
  stub.chrome.windows.create = async () => { throw new Error('boom'); };
  emit('alarms.onAlarm', { name: 'weekly:evening' });
  await settle();
  stub.chrome.windows.create = create;
  assert.ok(stub.log.alarms.get('weekly:evening').when > Date.now());
});

test('Alt+T opens the side panel in the window the command came from (D10)', () => {
  emit('commands.onCommand', 'open-panel', { id: 7, windowId: 3 });
  assert.deepEqual(stub.log.panelsOpened, [{ windowId: 3 }]);
});

test('Alt+Shift+T opens the app on its Tasks view (D10)', async () => {
  emit('commands.onCommand', 'open-app', { id: 7, windowId: 3 });
  await settle();
  assert.equal(stub.log.tabsCreated.at(-1)?.url, 'chrome-extension://weekly/src/ui/app/app.html#tasks');
});

test('notes are kept until deleted: the 90-day purge leaves them alone (spec §4 retention)', async () => {
  const old = Date.now() - 200 * 864e5;
  // A Weekly 2 note from 200 days ago: Weekly 2 purged these with the activity.
  await stub.chrome.storage.local.set({ notes: [{ id: 1, ts: old, text: 'Old call' }] });
  emit('runtime.onInstalled', { reason: 'update' });
  await settle();
  assert.equal(stub.stores.local.notes?.length, 1);
});

test('a fresh install then an update keeps both reminders on and scheduled', async () => {
  await stub.chrome.storage.local.remove('settings');
  stub.log.alarms.clear();
  emit('runtime.onInstalled', { reason: 'install' });
  await settle();
  const stored = (await stub.chrome.storage.local.get('settings')).settings;
  assert.ok(stored.morning.enabled && stored.evening.enabled, 'install persists the validated defaults');
  emit('runtime.onInstalled', { reason: 'update' });
  await settle();
  const after = (await stub.chrome.storage.local.get('settings')).settings;
  assert.ok(after.morning.enabled && after.evening.enabled);
  assert.ok(stub.log.alarms.has('weekly:morning') && stub.log.alarms.has('weekly:evening'));
});

test('a snooze set at 23:30 and delivered at 00:30 the next day shows no window', async () => {
  const d = new Date();
  const scheduledTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 30).getTime();
  const before = stub.log.windowsCreated.length + stub.log.tabsUpdated.length;
  emit('alarms.onAlarm', { name: 'weekly:snooze', scheduledTime });
  await settle();
  assert.equal(stub.log.windowsCreated.length + stub.log.tabsUpdated.length, before);
});

test('Alt+N on a web page injects the on-page note at once, inside the command’s gesture (F4)', () => {
  stub.log.scripts.length = 0;
  emit('commands.onCommand', 'open-note', { id: 7, windowId: 3, url: 'https://example.com/' });
  assert.deepEqual(stub.log.scripts, [{ target: { tabId: 7 }, files: ['src/content/onpage-note.js'] }], 'called before any await');
});

test('Alt+N where Chrome keeps scripts out opens the side panel on Notes instead (F4 fallback)', async () => {
  stub.log.scripts.length = 0;
  stub.log.panelsOpened.length = 0;
  emit('commands.onCommand', 'open-note', { id: 8, windowId: 4, url: 'chrome://settings/' });
  assert.deepEqual(stub.log.panelsOpened, [{ windowId: 4 }], 'opened at once, inside the gesture');
  assert.equal(stub.log.scripts.length, 0);
  /** @type {unknown[]} */
  const answers = [];
  const panel = { id: 'weekly', url: 'chrome-extension://weekly/src/ui/panel/panel.html' };
  for (const fn of stub.log.listeners['runtime.onMessage'] ?? []) fn({ type: 'panel:hello' }, panel, (/** @type {unknown} */ r) => answers.push(r));
  for (const fn of stub.log.listeners['runtime.onMessage'] ?? []) fn({ type: 'panel:hello' }, panel, (/** @type {unknown} */ r) => answers.push(r));
  await settle();
  assert.deepEqual(answers, [{ ok: true, tab: 'notes' }, { ok: true, tab: null }], 'the panel opens on Notes once');
});

test('granting or revoking tabs makes the tracker look again: revoked, nothing is being timed (W3)', async () => {
  stub.setFocusedTab({ id: 7, url: 'https://acme.atlassian.net/browse/ENGX-7', title: 'ENGX-7', active: true });
  emit('permissions.onAdded', { permissions: ['tabs'] });
  await settle();
  assert.equal(stub.stores.session.current?.tabId, 7);
  stub.setGranted([]);
  emit('permissions.onRemoved', { permissions: ['tabs'] });
  await settle();
  assert.equal(stub.stores.session.current, null);
  stub.setGranted(['tabs']);
  stub.setFocusedTab(null);
});


// Weekly 2 had `tabs` required; 3.0 asks. An upgrade that lost the grant for someone who tracked must ask again.
const WELCOME = /welcome\.html$/;
const welcomes = () => stub.log.tabsCreated.filter((o) => WELCOME.test(o.url ?? '')).length;
const updateFrom = async (/** @type {string} */ previousVersion) => {
  const before = welcomes();
  emit('runtime.onInstalled', { reason: 'update', previousVersion });
  await settle();
  return welcomes() - before;
};

test('update from 2.0.0 with tracked days and no tabs grant reopens the welcome page', async () => {
  stub.setGranted([]);
  await stub.chrome.storage.local.set({ 'day:2026-10-30': { sites: {} } });
  assert.equal(await updateFrom('2.0.0'), 1);
});

test('no welcome page when tabs is still granted, the update is from 3.x, or no day was ever tracked', async () => {
  stub.setGranted(['tabs']);
  assert.equal(await updateFrom('2.0.0'), 0, 'tabs granted');
  stub.setGranted([]);
  assert.equal(await updateFrom('3.0.0'), 0, 'already 3.x');
  await stub.chrome.storage.local.remove('day:2026-10-30');
  assert.equal(await updateFrom('2.0.0'), 0, 'nothing tracked');
});
