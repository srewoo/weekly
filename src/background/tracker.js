import { classify } from '../lib/activity/classify.js';
import { isIgnored } from '../lib/activity/range.js';
import { getSettings } from '../lib/settings.js';
import { dayKey } from '../lib/week.js';
import { trackingAllowed } from '../lib/activity/status.js';

// Backstop only: sleep is detected by the heartbeat below, this caps any one checkpoint regardless.
export const MAX_CHUNK = 2 * 60 * 1000;
const RECENT_WINDOW = 15 * 60 * 1000;
// The tick alarm looks every minute. A longer silence means the computer slept (or Chrome was frozen):
// time stops at the last look, so sleep never counts as work.
export const SLEEP_GAP = 150 * 1000;
/** Active in another app while Chrome isn't in front. Duration only: which app is never known. */
export const AWAY = Object.freeze({ key: 'away', category: 'Outside Chrome', task: 'Outside Chrome', tickets: [] });

/** @typedef {{ tabId?: number, url: string, title: string, start: number, away?: boolean }} Current */

// The open "session" (what you're looking at right now) survives worker restarts.
/** @type {Current | null | undefined} */
let current;
async function getCurrent() {
  if (current === undefined) current = (await chrome.storage.session.get('current')).current || null;
  return current;
}
/** @param {Current | null} c */
async function setCurrent(c) {
  current = c;
  await chrome.storage.session.set({ current: c });
}

/**
 * @param {string} day
 * @param {{ key: string, category?: string, task?: string, tickets?: string[], title?: string }} info
 * @param {string | null} url
 * @param {number} start
 * @param {number} end
 */
async function addMs(day, info, url, start, end) {
  const k = 'day:' + day;
  const obj = (await chrome.storage.local.get(k))[k] || {};
  if (!obj[info.key] && end < start) return;   // taking time back from an entry that was deleted: nothing to do
  const e = obj[info.key] || { category: info.category, task: info.task, url, ms: 0, first: start, last: end, tickets: [] };
  // The page title, so a site rule added later can relabel past activity (range.js reclassifies on load).
  if (info.title) e.title = info.title;
  e.ms = Math.max(0, e.ms + end - start);
  e.first = Math.min(e.first, start);
  e.last = Math.max(e.last, end);
  if (info.task) e.task = info.task;
  if (info.category) e.category = info.category;
  if (url) e.url = url;
  e.tickets = [...new Set([...(e.tickets || []), ...(info.tickets || [])])];
  obj[info.key] = e;
  await chrome.storage.local.set({ [k]: obj });
}

/** @param {string} key @param {string} day */
async function countSwitch(key, day) {
  const { lastKey } = await chrome.storage.session.get('lastKey');
  if (lastKey === key) return;
  await chrome.storage.session.set({ lastKey: key });
  if (!lastKey) return;
  const k = 'meta:' + day;
  const meta = (await chrome.storage.local.get(k))[k] || {};
  meta.switches = (meta.switches || 0) + 1;
  await chrome.storage.local.set({ [k]: meta });
}

/** @param {number} end */
export async function commit(end) {
  const c = await getCurrent();
  if (!c) return;
  await setCurrent(null);
  const s = await getSettings();
  if (!c.away && isIgnored(c.url, s.ignoreDomains)) return;
  let start = c.start;
  end = Math.min(end, start + MAX_CHUNK);
  if (end - start < 1000) return;
  const info = c.away ? AWAY : { ...classify(c.url, c.title, s), title: c.title };
  const { recent = [] } = await chrome.storage.session.get('recent');
  await countSwitch(info.key, dayKey(start));
  while (start < end) {                       // split across midnight
    const midnight = new Date(start); midnight.setHours(24, 0, 0, 0);
    const segEnd = Math.min(end, midnight.getTime());
    await addMs(dayKey(start), info, c.url, start, segEnd);
    recent.push({ day: dayKey(start), key: info.key, start, end: segEnd });
    start = segEnd;
  }
  await chrome.storage.session.set({ recent: recent.filter((/** @type {{ end: number }} */ r) => r.end > Date.now() - RECENT_WINDOW) });
}

// Idle is only detected idleSeconds after the last input; take back time credited since then.
/** @param {number} idleStart */
export async function retract(idleStart) {
  const { recent = [] } = await chrome.storage.session.get('recent');
  for (const r of recent) {
    const from = Math.max(r.start, idleStart);
    if (r.end <= from) continue;
    await addMs(r.day, { key: r.key }, null, r.end, from);   // negative duration
    r.end = from;
  }
  await chrome.storage.session.set({ recent });
}

// Look at what is focused right now and start/stop timing accordingly.
// Without the tabs permission (tracking off, W3) nothing is in front: the open session is closed and none starts.
// The check matters even then: Alt+N's activeTab would otherwise show one page's address.
export async function refresh() {
  const now = Date.now();
  const s = await getSettings();
  const { beat } = await chrome.storage.session.get('beat');
  await chrome.storage.session.set({ beat: now });
  const slept = typeof beat === 'number' && now - beat > SLEEP_GAP;
  /** @type {chrome.tabs.Tab | undefined} */
  let tab;
  let state = 'active', away = false;
  if (!s.paused && await trackingAllowed()) {
    state = await chrome.idle.queryState(Math.max(15, s.idleSeconds));
    if (state === 'active') {
      const win = await chrome.windows.getLastFocused().catch(() => null);
      if (win && win.focused) [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
      // chrome.idle sees input anywhere on the computer: active with Chrome in the background is work elsewhere.
      else away = s.trackAway;
    }
  }
  const c = await getCurrent();
  if (c && !slept && now - c.start < 60000 && (c.away ? away : tab && c.tabId === tab.id && c.url === tab.url)) {
    if (tab?.title && tab.title !== c.title) { c.title = tab.title; await setCurrent(c); }
    return;
  }
  if (slept) {
    await commit(/** @type {number} */ (beat));
  } else if (state === 'idle') {
    const idleStart = now - Math.max(15, s.idleSeconds) * 1000;
    await commit(idleStart);
    await retract(idleStart);
  } else {
    await commit(now);
  }
  if (tab && /^https?:/.test(tab.url || '') && !isIgnored(tab.url ?? '', s.ignoreDomains))
    await setCurrent({ tabId: tab.id, url: tab.url ?? '', title: tab.title || '', start: now });
  else if (away) await setCurrent({ away: true, url: '', title: AWAY.task, start: now });
}
