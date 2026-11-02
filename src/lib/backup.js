/**
 * The three files Weekly imports (D11, F7; spec §4 Import): Weekly's own export,
 * a Daybook backup and a ForgetMeNot export. Pure: recognise, parse and validate;
 * nothing is written here (portability.js writes, after this has accepted the file).
 *
 * A file is untrusted: every task goes through coerceTask, every note through
 * coerceNote, the PIN record through coerceSecurity, settings through
 * importableSettings, activity through cleanEntry. Keys that would reach
 * Object.prototype are skipped, and nothing imported is merged into an existing object.
 */
import { coerceTaskList } from './schema.js';
import { coerceNote, coerceCipher, NOTE_TITLE_MAX } from './note-views.js';
import { coerceSecurity } from './crypto.js';
import { importableSettings } from './settings.js';

/** @typedef {import('./schema.js').Task} Task */
/** @typedef {import('./note-views.js').Note} Note */
/** @typedef {import('./crypto.js').Security} Security */
/** @typedef {'weekly' | 'daybook' | 'forgetmenot'} Format */
/** A private note: its ciphertext, plus ForgetMeNot's plain title ('' from Weekly, which seals the title too). @typedef {{ note: Note, title: string }} Sealed */
/**
 * @typedef {object} Backup
 * @property {Format} format
 * @property {{ tasks: boolean, notes: boolean, settings: boolean }} carries  what Replace swaps
 * @property {Task[]} tasks
 * @property {Note[]} notes            plain notes
 * @property {Sealed[]} sealed         private notes
 * @property {Security | null} security
 * @property {Record<string, unknown> | null} settings
 * @property {Record<string, object>} activity  imp:<device>:<date> → entries
 * @property {string | null} deviceId  the other browser's id, null when there is no activity to add
 * @property {number} days
 * @property {boolean} own             this browser's own export
 * @property {number} dropped          records that could not be used
 */

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const FMN_VERSION = 2;

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One activity entry from an untrusted file. @param {any} e */
export function cleanEntry(e) {
  if (!e || typeof e !== 'object' || !Number.isFinite(e.ms) || e.ms < 0) return null;
  /** @param {unknown} v */
  const str = v => (typeof v === 'string' ? v.slice(0, 500) : '');
  const url = /^https?:\/\//.test(e.url) ? str(e.url) : '';
  return { category: str(e.category) || 'Browsing', task: str(e.task), url, ms: Math.min(e.ms, 864e5),
    first: Number(e.first) || 0, last: Number(e.last) || 0, tickets: Array.isArray(e.tickets) ? e.tickets.filter((/** @type {unknown} */ t) => typeof t === 'string').slice(0, 20) : [] };
}

/** One day of activity from an untrusted file: unsafe keys skipped, every entry cleaned. @param {Record<string, unknown>} v */
export const cleanDay = (v) => Object.fromEntries(Object.entries(v).filter(([ek]) => !UNSAFE.has(ek))
  .map(([ek, ev]) => [String(ek).slice(0, 300), cleanEntry(ev)]).filter(([, ev]) => ev));

/** @returns {Backup} */
const empty = () => ({ format: 'weekly', carries: { tasks: false, notes: false, settings: false }, tasks: [], notes: [], sealed: [],
  security: null, settings: null, activity: {}, deviceId: null, days: 0, own: false, dropped: 0 });

/** Plain notes and private ones, apart. @param {unknown[]} list @param {(n: Record<string, unknown>) => Sealed | Note | null} one */
function splitNotes(list, one) {
  /** @type {Note[]} */ const notes = [];
  /** @type {Sealed[]} */ const sealed = [];
  let dropped = 0;
  for (const raw of list) {
    const n = isObj(raw) ? one(raw) : null;
    if (!n) dropped++;
    else if ('note' in n) sealed.push(n);
    else notes.push(n);
  }
  return { notes, sealed, dropped };
}

/** Weekly's day:<date> keys, as imp:<device>:<date> writes. @param {Record<string, unknown>} data @param {string} dev */
function activityOf(data, dev) {
  /** @type {Record<string, object>} */
  const writes = {};
  for (const [k, v] of Object.entries(data)) {
    const m = k.match(/^day:(\d{4}-\d{2}-\d{2})$/);
    if (!m || !isObj(v)) continue;
    writes[`imp:${dev}:${m[1]}`] = cleanDay(v);
  }
  return writes;
}

/** Weekly 2 or Weekly 3. This browser's own export keeps everything but its activity, which is already here. @param {Record<string, unknown>} data @param {string | undefined} ownDeviceId @returns {Backup} */
function weekly(data, ownDeviceId) {
  const dev = data['deviceId'];
  if (typeof dev !== 'string' || !/^[\w-]{1,64}$/.test(dev)) throw new Error('This file has no device ID. Export it again with this version.');
  // The export format version (portability.js), not the package version: a future format may hold what this one can't read.
  if (typeof data['version'] === 'number' && data['version'] > 3) throw new Error('This file was made by a newer version of Weekly. Update Weekly first.');
  const own = dev === ownDeviceId;
  const activity = own ? {} : activityOf(data, dev);
  const { tasks, dropped: bad, duplicates } = coerceTaskList(data['tasks']);
  const split = splitNotes(Array.isArray(data['notes']) ? data['notes'] : [], (raw) => {
    const n = coerceNote(raw);
    return n?.enc ? { note: n, title: '' } : n;
  });
  const settings = importableSettings(data['settings']);
  return { ...empty(), format: 'weekly', carries: { tasks: Array.isArray(data['tasks']), notes: Array.isArray(data['notes']), settings: settings !== null },
    tasks, ...split, dropped: bad + duplicates + split.dropped, security: coerceSecurity(data['security']), settings,
    activity, deviceId: own ? null : dev, days: Object.keys(activity).length, own };
}

/** Daybook's {format: 'daybook.tasks', tasks}, or a bare array of tasks. @param {unknown} raw @returns {Backup} */
function daybook(raw) {
  const list = Array.isArray(raw) ? raw : isObj(raw) ? raw['tasks'] : null;
  const { tasks, dropped: bad, duplicates } = coerceTaskList(list);
  const dropped = bad + duplicates;
  // A file of damaged entries only is refused too: Replace would otherwise swap every task for nothing.
  if (!tasks.length) throw new Error('That file has no tasks in it.');
  return { ...empty(), format: 'daybook', carries: { tasks: true, notes: false, settings: false }, tasks, dropped };
}

/**
 * ForgetMeNot's exportAll (v1 or v2). A private note there kept its title in plain
 * text and sealed the body alone; Weekly seals both, so the worker re-seals it.
 * @param {Record<string, unknown>} data @returns {Backup}
 */
function forgetMeNot(data) {
  const v = data['schemaVersion'];
  // Missing is v1; anything but a whole number is not ForgetMeNot's own file.
  if (v !== undefined && !Number.isInteger(v)) throw new Error('This file is not a valid ForgetMeNot backup.');
  if (typeof v === 'number' && v > FMN_VERSION) throw new Error('This backup was made by a newer version of ForgetMeNot.');
  if (!Array.isArray(data['notes'])) throw new Error('This file is not a valid ForgetMeNot backup.');
  const split = splitNotes(data['notes'], (raw) => {
    const enc = raw['private'] === true ? coerceCipher(raw['enc']) : null;
    // ForgetMeNot's rule: private only with valid ciphertext; otherwise an ordinary note.
    const n = coerceNote({ ...raw, enc });
    if (!n || !enc) return n;
    const title = typeof raw['title'] === 'string' ? raw['title'].trim().slice(0, NOTE_TITLE_MAX) : '';
    return { note: n, title };
  });
  return { ...empty(), format: 'forgetmenot', carries: { tasks: false, notes: true, settings: false }, ...split,
    security: coerceSecurity(data['security']) };
}

/**
 * Recognise and validate a backup. Throws, in words, on a file Weekly cannot use.
 * @param {string} text @param {string | undefined} ownDeviceId @returns {Backup}
 */
export function readBackup(text, ownDeviceId) {
  /** @type {unknown} */
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('Not a valid export file.'); }
  if (Array.isArray(raw) || (isObj(raw) && raw['format'] === 'daybook.tasks')) return daybook(raw);
  if (!isObj(raw)) throw new Error('Not a valid export file.');
  if (raw['app'] === 'ForgetMeNot') return forgetMeNot(raw);
  if (Object.hasOwn(raw, 'deviceId') || Array.isArray(raw['notes']) || Object.keys(raw).some((k) => k.startsWith('day:'))) return weekly(raw, ownDeviceId);
  throw new Error('This isn’t a Weekly, Daybook or ForgetMeNot backup.');
}

const NAMES = { weekly: 'A Weekly export', daybook: 'A Daybook backup', forgetmenot: 'A ForgetMeNot backup' };
/** @param {number} n @param {string} one */
const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
/** @param {string[]} parts */
const list = (parts) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);

/**
 * What the file holds and what will be left out, in words, for the import panel.
 * @param {Backup} b @returns {string[]}
 */
export function describeBackup(b) {
  /** @type {string[]} */
  const parts = [];
  if (b.carries.tasks) parts.push(count(b.tasks.length, 'task'));
  if (b.carries.notes) parts.push(count(b.notes.length + b.sealed.length, 'note') + (b.sealed.length ? ` (${b.sealed.length} private)` : ''));
  if (b.days) parts.push(`${count(b.days, 'day')} of activity`);
  if (b.settings) parts.push('settings');
  const lines = [`${NAMES[b.format]}${b.own ? ' from this browser' : ''}: ${list(parts) || 'nothing to import'}.`];
  if (b.own) lines.push('Its activity is already here, so only tasks, notes and settings come in.');
  if (b.sealed.length && !b.security) lines.push(`${count(b.sealed.length, 'private note')} can’t be opened without the file’s PIN record, so they are left out.`);
  if (b.dropped) lines.push(b.dropped === 1 ? '1 damaged entry left out.' : `${b.dropped} damaged entries left out.`);
  return lines;
}

/** What Replace swaps for the file's, in words. @param {Backup} b */
export function replaces(b) {
  return list([b.carries.tasks && 'tasks', b.carries.notes && 'notes', b.carries.settings && 'settings'].filter((x) => typeof x === 'string'));
}
