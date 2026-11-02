// Quick-add syntax: "Call Sam tomorrow !high" → title + date + priority, and
// "Standup every mon,wed" → a recurring task. Pure; tokens are removed from the title.
// Deliberately conservative: a bare weekday or date word only counts at the very
// end (or start, for today/tomorrow), or after on/due/by, so "Prepare Monday deck"
// keeps its title. If stripping would leave no title, nothing is parsed.
import { addDays, weekday, relativeLabel, stampDate } from './dates.js';
import { PRIORITY_LABEL } from './schema.js';

/**
 * @typedef {object} QuickAdd
 * @property {string} title
 * @property {string} [dueDate]
 * @property {'high' | 'medium' | 'low'} [priority]
 * @property {number[]} [repeatDays]   0=Sun … 6=Sat; a due date is dropped when this is set
 */

const DAY = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat';
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const SEP = '(?:\\s*,\\s*|\\s+and\\s+|\\s*&\\s*|\\s+)';
const dayIndex = (/** @type {string} */ w) => SHORT.findIndex((s) => s.toLowerCase() === w.slice(0, 3).toLowerCase());
const PRI = /** @type {Record<string, 'high' | 'medium' | 'low'>} */ ({ high: 'high', h: 'high', 1: 'high', medium: 'medium', med: 'medium', m: 'medium', 2: 'medium', low: 'low', l: 'low', 3: 'low' });

const PRIORITY_RE = /(?:^|\s)!(high|h|1|medium|med|m|2|low|l|3)(?=\s|$)/i;
const EVERY_RE = new RegExp(`(?:^|\\s)every\\s+(day|weekday|(?:${DAY})(?:${SEP}(?:${DAY}))*)(?=[\\s,.;]|$)`, 'i');
const ON_DAY_RE = new RegExp(`(?:^|\\s)(?:on|due|by)\\s+(${DAY})(?=[\\s,.;]|$)`, 'i');
const DATE_WORD = '(?:(?:on|due|by)\\s+)?(today|tomorrow|tmrw|next\\s+week|in\\s+\\d{1,3}\\s+days?)';
const END_RES = {
  repeat: /(?:^|\s)(daily|weekdays|weekly)[\s.,;]*$/i,
  dateWord: new RegExp(`(?:^|\\s)${DATE_WORD}[\\s.,;]*$`, 'i'),
  weekday: new RegExp(`(?:^|\\s)(?:(?:on|due|by)\\s+)?(${DAY})[\\s.,;]*$`, 'i'),
};
const START_RE = new RegExp(`^\\s*${DATE_WORD}(?=\\s)`, 'i');

/** @param {string} word @param {string} todayISO */
function dateFor(word, todayISO) {
  const w = word.toLowerCase().replace(/\s+/g, ' ');
  if (w === 'today') return todayISO;
  if (w === 'tomorrow' || w === 'tmrw') return addDays(todayISO, 1);
  if (w === 'next week') return addDays(todayISO, (8 - weekday(todayISO)) % 7 || 7);  // next Monday
  return addDays(todayISO, Number(w.match(/\d+/)?.[0]));
}

/** A bare weekday means its next occurrence, never today ("friday" typed on a Friday is next week). */
const nextWeekday = (/** @type {string} */ w, /** @type {string} */ todayISO) =>
  addDays(todayISO, (dayIndex(w) - weekday(todayISO) + 7) % 7 || 7);

/** @param {string} list @returns {number[]} */
const daysOf = (list) => [...new Set([...list.toLowerCase().matchAll(new RegExp(DAY, 'g'))].map((m) => dayIndex(m[0])))].sort((a, b) => a - b);

/**
 * @param {string} text @param {string} todayISO local YYYY-MM-DD
 * @returns {QuickAdd}
 */
export function parseQuickAdd(text, todayISO) {
  let s = ` ${text.trim()}`;
  /** @type {Omit<QuickAdd, 'title'>} */
  const out = {};
  let weekly = false;
  /** @param {RegExp} re @param {(m: RegExpMatchArray) => void} apply */
  const take = (re, apply) => { const m = s.match(re); if (!m) return false; apply(m); s = s.replace(re, ' '); return true; };

  take(PRIORITY_RE, (m) => { out.priority = PRI[(m[1] ?? '').toLowerCase()]; });
  take(EVERY_RE, (m) => {
    const w = (m[1] ?? '').toLowerCase();
    out.repeatDays = w === 'day' ? [...ALL] : w === 'weekday' ? [...WEEKDAYS] : daysOf(w);
  });
  take(ON_DAY_RE, (m) => { out.dueDate = nextWeekday(m[1] ?? '', todayISO); });
  for (let again = true; again;) {   // peel date / repeat words off the end, in any order
    again = false;
    if (!out.repeatDays) again = take(END_RES.repeat, (m) => {
      const w = (m[1] ?? '').toLowerCase();
      if (w === 'weekly') weekly = true;
      out.repeatDays = w === 'daily' ? [...ALL] : w === 'weekdays' ? [...WEEKDAYS] : [];
    });
    if (!again && !out.dueDate) again = take(END_RES.dateWord, (m) => { out.dueDate = dateFor(m[1] ?? '', todayISO); })
      || take(END_RES.weekday, (m) => { out.dueDate = nextWeekday(m[1] ?? '', todayISO); });
  }
  if (!out.dueDate) take(START_RE, (m) => { out.dueDate = dateFor(m[1] ?? '', todayISO); });

  const title = s.replace(/\s+/g, ' ').replace(/^[\s,;]+|[\s,;]+$/g, '');
  if (!title) return { title: text.trim() };
  if (weekly) out.repeatDays = [weekday(out.dueDate ?? todayISO)];
  if (out.repeatDays) delete out.dueDate;
  return { title, ...out };
}

/** @param {readonly number[]} days @returns {string} "every day", "weekdays" or "Mon, Wed" */
export function repeatLabel(days) {
  if (days.length === 7) return 'every day';
  if (days.length === 5 && WEEKDAYS.every((d) => days.includes(d))) return 'weekdays';
  return days.map((d) => SHORT[d]).join(', ');
}

/**
 * One-line summary of what was recognised, e.g. "Tomorrow · High · Repeats Mon, Wed";
 * '' when the text had no tokens.
 * @param {QuickAdd} q @param {string} todayISO @param {string} defaultPriority the setting, shown when no !priority was given
 */
export function describeQuickAdd(q, todayISO, defaultPriority = 'medium') {
  if (!q.dueDate && !q.priority && !q.repeatDays) return '';
  const when = q.repeatDays ? `Repeats ${repeatLabel(q.repeatDays)}`
    : !q.dueDate || q.dueDate === todayISO ? 'Today' : relativeLabel(q.dueDate, todayISO) === 'Tomorrow' ? 'Tomorrow' : stampDate(q.dueDate);
  const p = /** @type {keyof typeof PRIORITY_LABEL} */ (q.priority ?? defaultPriority);
  return [when, PRIORITY_LABEL[p] ?? PRIORITY_LABEL.medium].join(' · ');
}
