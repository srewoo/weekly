/**
 * The reminder engine (spec §3.3; D8, D9), ported from Daybook's reminders.js.
 *
 * One-shot alarms, never `periodInMinutes: 1440`: a 24-hour period is 24 hours of
 * elapsed time, not "09:00 tomorrow", so across a DST change the brief would
 * arrive an hour off and never correct itself. Each fire schedules exactly one
 * successor, recomputed from the local calendar (dates.nextOccurrence).
 *
 * One reminder window, reused. Its id lives in session storage; the worker runs
 * every reminder handler through its serial queue, so the alarm and the startup
 * catch-up can never both decide to open a window at the same moment.
 */

import { getSettings } from '../lib/settings.js';
import { getTasks, getReminderState, updateReminderState } from '../lib/storage.js';
import { buildPayload, isReminderDay, notificationText, SLOTS } from '../lib/reminders.js';
import { loadWeekCounts, readyLine } from '../lib/reminder-week.js';
import { today, nextOccurrence, todayAt } from '../lib/dates.js';

/** @typedef {import('../lib/reminders.js').Slot} Slot */

export const ALARM = Object.freeze({ morning: 'weekly:morning', evening: 'weekly:evening', snooze: 'weekly:snooze' });
/** Alarms the worker owns besides these; add any new alarm here or clearOrphanAlarms() deletes it on the next start. Anything else (Weekly 2's Friday 'reminder') is an orphan. */
const KEEP = ['tick'];
export const NOTIFICATION_PREFIX = 'weekly:remind:';
const WINDOW_KEY = 'reminderWindowId';
const WINDOW_SIZE = { width: 520, height: 600 };

/**
 * Rebuild both slot alarms from current settings. The one entry point for install,
 * startup, a settings change and each fire.
 * @param {Date} [from]
 */
export async function rescheduleAll(from = new Date()) {
  const s = await getSettings();
  await Promise.all([chrome.alarms.clear(ALARM.morning), chrome.alarms.clear(ALARM.evening)]);
  // A pending snooze belongs to the evening check; with that off it would still pop up.
  if (!s.evening.enabled) await chrome.alarms.clear(ALARM.snooze);
  for (const slot of SLOTS) {
    if (s[slot].enabled) await chrome.alarms.create(ALARM[slot], { when: nextOccurrence(s[slot].time, from) });
  }
}

/**
 * Drop every alarm that is no longer ours. Alarms outlive the code that made them,
 * so Weekly 2's Friday alarm would otherwise keep waking the worker on update.
 * @returns {Promise<string[]>} the names it cleared
 */
export async function clearOrphanAlarms() {
  const known = new Set([...Object.values(ALARM), ...KEEP]);
  const orphans = (await chrome.alarms.getAll()).map((a) => a.name).filter((n) => !known.has(n));
  await Promise.all(orphans.map((n) => chrome.alarms.clear(n)));
  return orphans;
}

/** @param {string} name @returns {Slot | null} */
export const slotForAlarm = (name) => (name === ALARM.morning ? 'morning' : name === ALARM.evening ? 'evening' : null);

/**
 * Decide whether `slot` should show now, and show it. `force` (Preview, a snooze)
 * skips every guard. The morning brief is skipped when there is nothing to report;
 * the evening check always shows, because the all-clear is what it is for.
 * @param {Slot} slot @param {{ force?: boolean }} [opts]
 * @returns {Promise<'shown' | 'skipped-disabled' | 'skipped-day' | 'skipped-shown' | 'skipped-empty' | 'skipped-no-tasks'>}
 */
export async function fire(slot, opts = {}) {
  const s = await getSettings();
  const ref = today();
  const key = slot === 'morning' ? 'morningLastShown' : 'eveningLastShown';
  if (!opts.force) {
    if (!s[slot].enabled) return 'skipped-disabled';
    if (!isReminderDay(s.days, ref)) return 'skipped-day';
    if ((await getReminderState())[key] === ref) return 'skipped-shown';
  }
  const tasks = await getTasks();
  const payload = buildPayload(slot, tasks, s.days, ref);
  if (slot === 'morning' && payload.empty && !opts.force) {
    await updateReminderState({ [key]: ref });
    return 'skipped-empty';
  }
  // "Nothing left open" means something only to someone who keeps tasks here. Without any, the evening
  // check is a daily popup about nothing; it still comes on the last working day, for the update.
  if (slot === 'evening' && !opts.force && !tasks.length && !payload.weekEnds) {
    await updateReminderState({ [key]: ref });
    return 'skipped-no-tasks';
  }
  // Notification only when asked (clicking it opens the window); never neither, or the reminder would vanish.
  if (opts.force || s.reminderWindow || !s.systemNotification) await openReminderWindow(slot);
  if (s.systemNotification) await showNotification(payload, payload.weekEnds ? await loadWeekCounts().then(readyLine).catch(() => '') : '');
  // A forced show (Preview, snooze) is not the day's real check, so it must not stand in for it.
  if (!opts.force) await updateReminderState({ [key]: ref });
  return 'shown';
}

/**
 * Catch-up on browser start: alarms cannot wake a closed browser, so opening the
 * laptop at 10:40 must still bring the 09:00 brief. Morning first, so when both
 * are due the evening check is the one left on screen.
 * @param {Date} [from]
 */
export async function catchUp(from = new Date()) {
  const s = await getSettings();
  if (!s.catchUpOnStartup) return;
  for (const slot of SLOTS) {
    if (s[slot].enabled && from.getTime() > todayAt(s[slot].time, from)) await fire(slot);
  }
}

/** Open the reminder window, or reuse and focus the one already open. @param {Slot} slot */
export async function openReminderWindow(slot) {
  const url = chrome.runtime.getURL(`src/ui/remind/remind.html?slot=${slot}`);
  const existing = (await chrome.storage.session.get(WINDOW_KEY))[WINDOW_KEY];
  if (typeof existing === 'number') {
    try {
      await chrome.windows.update(existing, { focused: true, drawAttention: true });
      // No url filter, so this needs no "tabs" permission: only the id is read.
      const [tab] = await chrome.tabs.query({ windowId: existing });
      if (tab?.id !== undefined) { await chrome.tabs.update(tab.id, { url }); return; }
    } catch { /* closed since; open a new one below */ }
  }
  const win = await chrome.windows.create({ url, type: 'popup', focused: true, ...WINDOW_SIZE });
  await chrome.storage.session.set({ [WINDOW_KEY]: win.id });
}

/**
 * The reminder window was closed: forget it, and take its notifications with it. They are
 * created with requireInteraction, so otherwise they would wait in the notification centre
 * for a reminder already dealt with.
 * @param {number} closedId
 */
export async function forgetWindowIfClosed(closedId) {
  if ((await chrome.storage.session.get(WINDOW_KEY))[WINDOW_KEY] !== closedId) return;
  // Clear first: the window id is the "still pending" marker, so it goes last.
  await Promise.all(SLOTS.map((slot) => chrome.notifications.clear(NOTIFICATION_PREFIX + slot)));
  await chrome.storage.session.remove(WINDOW_KEY);
}

/**
 * The path that reaches you when Chrome is not the app in front: a Chrome
 * window cannot take focus from Slack or a terminal; a notification can.
 * @param {import('../lib/reminders.js').ReminderPayload} payload @param {string} [ready] readyLine, last working day
 */
export async function showNotification(payload, ready = '') {
  const { title, message } = notificationText(payload, ready);
  try {
    await chrome.notifications.create(NOTIFICATION_PREFIX + payload.slot, {
      type: 'basic', iconUrl: chrome.runtime.getURL('icons/128.png'), title, message, requireInteraction: true,
    });
  } catch (e) {
    console.warn('[weekly] notification failed; the reminder window still opened', e);
  }
}

export const SNOOZE_MINUTES = 60;

/** Bring the evening check back in `minutes`. @param {number} [minutes] */
export async function snooze(minutes = SNOOZE_MINUTES) {
  await chrome.alarms.create(ALARM.snooze, { when: Date.now() + minutes * 60_000 });
}
