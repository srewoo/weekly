// Weekly's settings. Local storage only: syncing them through the Google
// account would break the "stays on this computer" promise.
// Writes run under the shared Web Lock (see storage.js), so the side panel, the
// app and report tabs and the service worker never drop each other's change.
import { withLock } from './storage.js';
import { PRIORITIES } from './schema.js';
import { isValidTime } from './dates.js';

export const DEFAULTS = Object.freeze({
  idleSeconds: 120, minMinutes: 2, ignoreDomains: [], paused: false,
  rules: [], ticketPrefixes: [], slackWebhook: '', template: 'weekly', role: 'general', anonymize: false,
  defaultPriority: 'medium',
  // Reminders (spec §3.3), Daybook's defaults: local times, and the days they fire on (0=Sun … 6=Sat).
  // readSettings always returns fresh copies of these, so no caller can change the defaults.
  morning: { enabled: true, time: '09:00' },
  evening: { enabled: true, time: '18:00' },
  days: [1, 2, 3, 4, 5],
  systemNotification: true,
  // Off: the notification alone, and clicking it opens the window. Quieter for people mid-meeting.
  reminderWindow: true,
  catchUpOnStartup: true,
  // Light, dark, or whatever the computer uses (F6, L8).
  theme: 'system',
  // Streaks, the Stats view and Trends are off until asked for: Weekly is an update tool first.
  showStats: false,
  // Time the person is active in another app (IDE, terminal, desktop Slack/Zoom): duration only, never which app.
  trackAway: true,
});
export const THEMES = Object.freeze(['system', 'light', 'dark']);
const KEY = 'settings';
export const SETTINGS_LOCK = 'weekly:settings';

/** @typedef {{ enabled: boolean, time: string }} Slot */
/**
 * @typedef {{ idleSeconds: number, minMinutes: number, ignoreDomains: string[], paused: boolean, rules: string[],
 *   ticketPrefixes: string[], slackWebhook: string, template: string, role: string, anonymize: boolean,
 *   defaultPriority: string, morning: Slot, evening: Slot, days: number[], systemNotification: boolean, reminderWindow: boolean,
 *   catchUpOnStartup: boolean, theme: string, showStats: boolean, trackAway: boolean } & Record<string, unknown>} Settings
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** @param {unknown} v @param {boolean} d */
const flag = (v, d) => (typeof v === 'boolean' ? v : d);

/**
 * The stored blob over the defaults, validated where a bad value would break a
 * caller: a reminder time, day or flag, and the default priority. A Weekly 2
 * profile has no reminder slots yet, only its Friday `reminder` flag; that flag
 * turns both slots on or off, so an upgrade never opens windows nobody asked for.
 * @param {unknown} raw
 * @returns {Settings}
 */
export function readSettings(raw) {
  const stored = isObj(raw) ? raw : {};
  const { reminder, ...s } = /** @type {Settings} */ ({ ...DEFAULTS, ...stored });
  const legacy = typeof reminder === 'boolean' && !isObj(stored['morning']) ? reminder : null;
  /** @param {unknown} v @param {Slot} d @returns {Slot} */
  const slot = (v, d) => {
    const o = isObj(v) ? v : {};
    const time = o['time'];
    return { enabled: legacy ?? flag(o['enabled'], d.enabled), time: typeof time === 'string' && isValidTime(time) ? time : d.time };
  };
  const days = Array.isArray(s.days)
    ? [...new Set(s.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b)
    : [...DEFAULTS.days];
  return {
    ...s, days,
    morning: slot(s.morning, DEFAULTS.morning),
    evening: slot(s.evening, DEFAULTS.evening),
    systemNotification: flag(s.systemNotification, DEFAULTS.systemNotification),
    reminderWindow: flag(s.reminderWindow, DEFAULTS.reminderWindow),
    catchUpOnStartup: flag(s.catchUpOnStartup, DEFAULTS.catchUpOnStartup),
    defaultPriority: /** @type {readonly unknown[]} */ (PRIORITIES).includes(s.defaultPriority) ? s.defaultPriority : DEFAULTS.defaultPriority,
    showStats: flag(s.showStats, DEFAULTS.showStats),
    trackAway: flag(s.trackAway, DEFAULTS.trackAway),
    theme: /** @type {readonly unknown[]} */ (THEMES).includes(s.theme) ? s.theme : DEFAULTS.theme,
  };
}

/** One imported value of its default's type, strings capped; undefined otherwise. @param {unknown} v @param {unknown} d @returns {unknown} */
function sameType(v, d) {
  if (typeof v !== typeof d || Array.isArray(v)) return undefined;
  return typeof v === 'string' ? v.slice(0, 300) : v;
}

/**
 * Settings from an imported file (a Weekly export): only keys Weekly knows, each of
 * its default's type; strings and lists capped; readSettings validates the rest.
 * A reminder slot keeps only its own keys. Never the Slack webhook: it is a secret,
 * so it stays on the computer it was typed on.
 * @param {unknown} raw @returns {Record<string, unknown> | null}
 */
export function importableSettings(raw) {
  if (!isObj(raw)) return null;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, d] of Object.entries(DEFAULTS)) {
    const v = Object.hasOwn(raw, k) ? raw[k] : undefined;
    if (k === 'slackWebhook' || v === undefined) continue;
    if (Array.isArray(d)) {
      // Working days are numbers; every other list (sites, rules, prefixes) is strings.
      const nums = typeof d[0] === 'number';
      if (Array.isArray(v)) out[k] = v.filter((x) => (nums ? Number.isInteger(x) : typeof x === 'string')).slice(0, 100).map((x) => (nums ? x : x.slice(0, 300)));
    } else if (isObj(d)) {
      if (isObj(v)) out[k] = Object.fromEntries(Object.entries(d).map(([sk, sd]) => [sk, sameType(Object.hasOwn(v, sk) ? v[sk] : undefined, sd)]).filter(([, sv]) => sv !== undefined));
    } else if (sameType(v, d) !== undefined) out[k] = sameType(v, d);
  }
  return out;
}

/** @returns {Promise<Settings>} */
export async function getSettings() {
  const blob = await chrome.storage.local.get(KEY);
  return readSettings(blob[KEY]);
}

/**
 * Read-modify-write under one lock, so two callers never drop each other's change.
 * Pass a function to compute the patch from the current settings inside the lock
 * (a toggle such as Pause must not read outside it). What is stored is validated
 * by readSettings, so an invalid time or priority never reaches a caller.
 * @param {Record<string, unknown> | ((current: Settings) => Record<string, unknown>)} patch
 * @returns {Promise<Settings>}
 */
export function updateSettings(patch) {
  return withLock(SETTINGS_LOCK, async () => {
    const current = await getSettings();
    const next = readSettings({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  });
}

/** @param {(s: Settings) => void} cb */
export function onSettingsChanged(cb) {
  /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
  const listener = (changes, area) => {
    if (area === 'local' && KEY in changes) cb(readSettings(changes[KEY]?.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
