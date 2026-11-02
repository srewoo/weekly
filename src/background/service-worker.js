import { refresh } from './tracker.js';
import * as reminders from './reminders.js';
import * as broker from './crypto-broker.js';
import * as onpage from './onpage.js';
import { isOurs, isOwnPage } from './sender.js';
import { getSettings, updateSettings, onSettingsChanged } from '../lib/settings.js';
import { toISODate } from '../lib/dates.js';
import { expiredKeys } from '../lib/week.js';
import { trackingAllowed } from '../lib/activity/status.js';

// Run all handlers one at a time so storage writes never race. Failures show a "!" badge.
let queue = Promise.resolve(), errored = false;
/** @param {() => unknown} fn */
const serial = fn => (queue = queue.then(fn).then(async () => {
  if (errored) { errored = false; await chrome.action.setBadgeText({ text: '' }); await chrome.storage.session.remove('error'); }
}, async e => {
  console.error('[worklog]', e);
  errored = true;
  await chrome.action.setBadgeText({ text: '!' }).catch(() => {});
  await chrome.storage.session.set({ error: String(e?.message ?? e) }).catch(() => {});
}));

// Activity is purged after 90 days; notes are kept until the user deletes them (spec §4).
async function purgeOld() {
  const old = expiredKeys(Object.keys(await chrome.storage.local.get(null)));
  if (old.length) await chrome.storage.local.remove(old);
}

async function setup() {
  const s = await getSettings();
  const { deviceId } = await chrome.storage.local.get('deviceId');
  if (!deviceId) await chrome.storage.local.set({ deviceId: crypto.randomUUID() });
  chrome.idle.setDetectionInterval(Math.max(15, s.idleSeconds));
  await chrome.action.setBadgeText({ text: '' });
  await chrome.alarms.create('tick', { periodInMinutes: 1 });
  // The morning brief and evening check replace Weekly 2's Friday reminder; its alarm is an orphan now.
  await reminders.clearOrphanAlarms();
  await reminders.rescheduleAll();
  await purgeOld();
  await refresh();
}

// The toolbar icon opens the side panel (spec §3.1). Set on every worker start: it is cheap and idempotent.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => console.error('[weekly] side panel', e));

/**
 * A Weekly 2 profile has only its Friday `reminder` flag, and off was Weekly 2's default, so an
 * update without the flag must not switch the new reminders on. Runs before setup schedules them.
 */
async function migrateFridayFlag() {
  const raw = (await chrome.storage.local.get('settings')).settings;
  if (raw?.morning && typeof raw.morning === 'object') return;
  const on = raw?.reminder === true;
  await updateSettings((s) => ({ morning: { ...s.morning, enabled: on }, evening: { ...s.evening, enabled: on } }));
}

/** Weekly 2 tracked with `tabs` required; 3.0 asks. If an upgrade lost it for someone who tracked, ask again instead of going quiet. @param {string | undefined} prev */
async function askAgainAfterUpgrade(prev) {
  if (!prev || Number(prev.split('.')[0]) >= 3 || await trackingAllowed()) return;
  if (!Object.keys(await chrome.storage.local.get(null)).some((k) => k.startsWith('day:'))) return;
  await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/welcome/welcome.html') });
}

chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  if (reason === 'update') serial(migrateFridayFlag);
  if (reason === 'update') serial(() => askAgainAfterUpgrade(previousVersion));
  // A fresh install stores nothing; persist the validated defaults so a later update's migration sees a 3.0 profile.
  if (reason === 'install') serial(() => updateSettings({}));
  serial(setup);
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/welcome/welcome.html') });
});
chrome.runtime.onStartup.addListener(() => { serial(setup); serial(() => reminders.catchUp()); });
chrome.tabs.onActivated.addListener(() => serial(refresh));
chrome.tabs.onUpdated.addListener((id, info, tab) => {
  if (tab.active && (info.url || info.title || info.status === 'complete')) serial(refresh);
});
chrome.windows.onFocusChanged.addListener(() => serial(refresh));
chrome.idle.onStateChanged.addListener(() => serial(refresh));
// Tracking on or off in Settings or the welcome page grants or gives back "tabs" (W3): look again at once.
chrome.permissions.onAdded.addListener(() => serial(refresh));
chrome.permissions.onRemoved.addListener(() => serial(refresh));
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'tick') serial(refresh);
  // Chrome delivers an alarm missed while asleep late, maybe the next morning: yesterday's check must not show today.
  // A snooze set at 23:30 lands at 00:30; it belongs to the day it was set, so judge that day.
  const day = a.scheduledTime === undefined ? undefined : a.scheduledTime - (a.name === reminders.ALARM.snooze ? reminders.SNOOZE_MINUTES * 60_000 : 0);
  const stale = day !== undefined && toISODate(new Date(day)) < toISODate();
  // A snoozed evening check was already marked shown today, so it comes back forced.
  if (a.name === reminders.ALARM.snooze && !stale) serial(() => reminders.fire('evening', { force: true }));
  const slot = reminders.slotForAlarm(a.name);
  // Each fire chains its own successor (even when it fails or is stale), so the time follows the local clock across DST and sleep.
  if (slot) serial(async () => {
    try { if (!stale) await reminders.fire(slot); } finally { await reminders.rescheduleAll(); }
  });
});
chrome.notifications.onClicked.addListener(id => {
  if (!id.startsWith(reminders.NOTIFICATION_PREFIX)) return;
  serial(async () => {
    await chrome.notifications.clear(id);
    await reminders.openReminderWindow(id.endsWith('morning') ? 'morning' : 'evening');
  });
});
chrome.windows.onRemoved.addListener(id => serial(() => reminders.forgetWindowIfClosed(id)));
/** Answer after an await: errors go back to the page in words; the channel stays open (return true). @param {Promise<unknown>} p @param {(r: unknown) => void} respond */
const answer = (p, respond) => { p.then(respond, (e) => respond({ ok: false, error: String(e?.message ?? e) })); return true; };
// Pages ask the worker for what only it does: the reminder window, the alarms and the PIN key (crypto:*).
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const type = /** @type {{ type?: unknown }} */ (msg)?.type;
  if (typeof type !== 'string' || !isOurs(sender)) return false;
  // A content script in a web page is this extension too; everything but notes:* is for Weekly's own pages (Phase 3 m4).
  if (!type.startsWith('notes:') && !isOwnPage(sender)) { respond({ ok: false, error: 'Not allowed.' }); return false; }
  if (type.startsWith('crypto:')) return answer(broker.handle(msg, sender), respond);
  if (/^(notes|panel):/.test(type)) return answer(onpage.handle(msg, sender), respond);
  const slot = /** @type {{ slot?: unknown }} */ (msg)?.slot === 'evening' ? 'evening' : 'morning';
  if (type === 'reminder:preview') serial(() => reminders.openReminderWindow(slot));
  else if (type === 'reminder:snooze') serial(() => reminders.snooze(reminders.SNOOZE_MINUTES));
  else return false;
  respond({ ok: true });
  return false;
});
// Keyboard commands (D10, F4): Alt+T opens the side panel, Alt+Shift+T the app on its Tasks view, Alt+N
// the on-page note. sidePanel.open and executeScript must run inside the command's user gesture, so they are called at once, not queued.
chrome.commands.onCommand.addListener((command, tab) => {
  const fail = (/** @type {unknown} */ e) => console.error('[weekly] command', command, e);
  if (command === 'open-panel' && tab?.windowId !== undefined) chrome.sidePanel.open({ windowId: tab.windowId }).catch(fail);
  if (command === 'open-app') chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/app/app.html#tasks') }).catch(fail);
  if (command === 'open-note') onpage.onNoteCommand(tab);
});
onSettingsChanged((s) => {
  chrome.idle.setDetectionInterval(Math.max(15, s.idleSeconds));
  serial(() => reminders.rescheduleAll());
  serial(refresh);
});
