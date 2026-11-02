import { classify } from './classify.js';
import { isIgnored, hasEntries } from './range.js';
import { getSettings } from '../settings.js';
import { dayKey, shiftDate } from '../week.js';

// Fills days that have no live tracking with estimates from Chrome's own history (last 15 days).
// History knows when a page was opened, not how long you looked at it, so time is estimated from
// the gap to the next visit. Optional: asks for the "history" permission on first use.
export const HISTORY_DAYS = 15;
export const GAP_CAP = 10 * 60000;    // one page view counts for at most 10 min
export const BREAK = 30 * 60000;      // a longer silence means you stepped away
export const TAIL = 2 * 60000;        // credit for the last page before a break
export const MIN_VIEW = 5000;         // shorter hops are redirects or click-throughs
export const SKIP_TRANSITIONS = new Set(['auto_subframe', 'manual_subframe']);

// Pure: visits [{url, title, time}] → { 'YYYY-MM-DD': { key: entry } } in the same shape as live tracking.
/**
 * @typedef {{url: string, title: string, time: number}} Visit
 * @param {Visit[]} visits @param {{ignoreDomains?: string[]}} settings
 * @param {(url: string, title: string, settings: any) => {key: string, category: string, task: string, tickets: string[]}} classifyFn
 * @returns {Record<string, Record<string, any>>}
 */
export function estimateFromVisits(visits, settings, classifyFn) {
  const sorted = visits.filter(v => /^https?:/.test(v.url) && !isIgnored(v.url, settings.ignoreDomains)).sort((a, b) => a.time - b.time);
  /** @type {Record<string, Record<string, any>>} */
  const days = {};
  sorted.forEach((v, i) => {
    const gap = i + 1 < sorted.length ? /** @type {Visit} */ (sorted[i + 1]).time - v.time : Infinity;
    const ms = gap > BREAK ? TAIL : Math.min(gap, GAP_CAP);
    if (ms < MIN_VIEW) return;
    const info = classifyFn(v.url, v.title, settings);
    const day = days[dayKey(v.time)] ||= {};
    const e = day[info.key] ||= { category: info.category, task: info.task, url: v.url, ms: 0, first: v.time, last: v.time, tickets: [] };
    if (v.title) e.title = v.title;   // so a site rule written later relabels estimates too (range.js)
    e.ms += ms;
    e.last = Math.max(e.last, v.time + ms);
    if (info.task) e.task = info.task;
    e.url = v.url;
    e.tickets = [...new Set([...e.tickets, ...info.tickets])];
  });
  return days;
}

/** @param {number} start @param {number} end @returns {Promise<Visit[]>} */
export async function readVisits(start, end) {
  // ponytail: one search capped at 20k distinct URLs; page by endTime if heavy users hit it.
  const items = await chrome.history.search({ text: '', startTime: start, endTime: end, maxResults: 20000 });
  /** @type {Visit[]} */
  const out = [];
  for (let i = 0; i < items.length; i += 50) {
    const batch = await Promise.all(items.slice(i, i + 50).map(async it => (await /** @type {Promise<{visitTime: number, isLocal?: boolean, transition: string}[]>} */ (/** @type {unknown} */ (chrome.history.getVisits({ url: /** @type {string} */ (it.url) }))))
      .filter(v => v.visitTime >= start && v.visitTime < end && v.isLocal !== false && !SKIP_TRANSITIONS.has(v.transition))
      .map(v => ({ url: /** @type {string} */ (it.url), title: it.title || '', time: v.visitTime }))));
    out.push(...batch.flat());
  }
  return out;
}

/** When live tracking began that day, or undefined if it never did. @param {Record<string, any> | undefined} day */
export function liveFrom(day) {
  const firsts = Object.values(day || {}).map(e => e?.first).filter(t => typeof t === 'number');
  return firsts.length ? Math.min(...firsts) : undefined;
}

// Call straight from a click: the permission prompt needs a user gesture.
export function requestHistory() {
  return chrome.permissions.request({ permissions: ['history'] });
}

export async function backfillFromHistory() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = shiftDate(today, -(HISTORY_DAYS - 1)).getTime();
  const dates = [...Array(HISTORY_DAYS)].map((_, i) => dayKey(shiftDate(start, i)));
  const [visits, settings, st] = await Promise.all([readVisits(start, Date.now()), getSettings(), chrome.storage.local.get(dates.map(d => 'day:' + d))]);
  // Live tracking always wins: on a day it started part-way (the install day), only the hours before it are estimated.
  const est = estimateFromVisits(visits.filter(v => v.time < (liveFrom(st['day:' + dayKey(v.time)]) ?? Infinity)), settings, classify);
  /** @type {Record<string, unknown>} */
  const writes = {};
  let filled = 0;
  for (const d of dates) {
    writes['hist:' + d] = est[d] || {};              // {} records "checked, nothing there"
    if (hasEntries(est[d])) filled++;
  }
  await chrome.storage.local.set(writes);
  return filled;
}

export async function removeHistoryEstimates() {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter(k => k.startsWith('hist:')));
  // Revoking is best-effort: the estimates are already gone, which is what matters.
  await chrome.permissions.remove({ permissions: ['history'] }).catch(e => console.warn('[worklog]', e.message));
}

