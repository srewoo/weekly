/**
 * Local-calendar date helpers.
 *
 * Every date in Daybook is a *local* calendar day written `YYYY-MM-DD`. We never
 * touch UTC: `new Date("2026-08-20")` parses as UTC midnight and shifts a day
 * backwards for anyone west of Greenwich, which is exactly the bug that makes a
 * task look overdue the moment you create it.
 */

const PAD = /** @param {number} n */ (n) => String(n).padStart(2, '0');

/**
 * @param {Date} [d]
 * @returns {string} local calendar day as YYYY-MM-DD
 */
export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

/** @returns {string} today, local */
export const today = () => toISODate();

/**
 * Parse `YYYY-MM-DD` into a Date at *local* midnight.
 * @param {string} iso
 * @returns {Date | null}
 */
export function fromISODate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(y, mo - 1, da);
  // Rejects 2026-02-31 and friends, which Date silently rolls over.
  return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === da ? d : null;
}

/** @param {string} iso @returns {boolean} */
export const isValidISODate = (iso) => fromISODate(iso) !== null;

/**
 * @param {string} iso
 * @param {number} days
 * @returns {string}
 */
export function addDays(iso, days) {
  const d = fromISODate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** @returns {string} */
export const tomorrow = () => addDays(today(), 1);

/**
 * Whole local days from `a` to `b`. Negative means `b` is in the past.
 * Computed on midnight-anchored Dates so DST transitions can't produce 0.96 days.
 * @param {string} a @param {string} b @returns {number}
 */
export function daysBetween(a, b) {
  const da = fromISODate(a), db = fromISODate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** @param {string} iso @param {string} [ref] @returns {boolean} */
export const isPast = (iso, ref = today()) => daysBetween(ref, iso) < 0;

/** @param {string} iso @param {string} [ref] @returns {boolean} */
export const isToday = (iso, ref = today()) => iso === ref;

/**
 * "2 days late" / "Due today" / "Tomorrow" / "18 Aug".
 * @param {string} iso @param {string} [ref] @returns {string}
 */
export function relativeLabel(iso, ref = today()) {
  const n = daysBetween(ref, iso);
  if (n === 0) return 'Due today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return '1 day late';
  if (n < -1) return `${-n} days late`;
  if (n <= 6) return dayName(iso);
  return shortDate(iso);
}

/** @param {string} iso @returns {string} e.g. "18 Aug" */
export function shortDate(iso) {
  const d = fromISODate(iso);
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : iso;
}

/** @param {string} iso @returns {string} e.g. "Thursday 20 August" */
export function longDate(iso) {
  const d = fromISODate(iso);
  return d ? d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : iso;
}

/** @param {string} iso @returns {string} e.g. "Thu 20 Aug" */
export function stampDate(iso) {
  const d = fromISODate(iso);
  return d ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : iso;
}

/** @param {string} iso @returns {string} e.g. "Monday" */
export function dayName(iso) {
  const d = fromISODate(iso);
  return d ? d.toLocaleDateString(undefined, { weekday: 'long' }) : iso;
}

/** @param {number} ts @returns {string} e.g. "09:14" */
export function clockTime(ts) {
  const d = new Date(ts);
  return `${PAD(d.getHours())}:${PAD(d.getMinutes())}`;
}

/**
 * Next occurrence of local wall-clock `HH:MM`, strictly after `from`.
 * Recomputed from a fresh Date on every call rather than by adding 24h, so a DST
 * shift moves the reminder with the clock instead of drifting an hour off it.
 * @param {string} hhmm @param {Date} [from] @returns {number} epoch ms
 */
export function nextOccurrence(hhmm, from = new Date()) {
  const [h, m] = parseTime(hhmm);
  const at = new Date(from.getFullYear(), from.getMonth(), from.getDate(), h, m, 0, 0);
  if (at.getTime() <= from.getTime()) at.setDate(at.getDate() + 1);
  return at.getTime();
}

/**
 * Local wall-clock `HH:MM` on the same calendar day as `from`.
 * @param {string} hhmm @param {Date} [from] @returns {number} epoch ms
 */
export function todayAt(hhmm, from = new Date()) {
  const [h, m] = parseTime(hhmm);
  return new Date(from.getFullYear(), from.getMonth(), from.getDate(), h, m, 0, 0).getTime();
}

/** @param {string} hhmm @returns {[number, number]} */
export function parseTime(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return [9, 0];
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const mi = Math.min(59, Math.max(0, Number(m[2])));
  return [h, mi];
}

/** @param {string} hhmm @returns {boolean} */
export const isValidTime = (hhmm) => /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm ?? '');

/** @param {string} [iso] @returns {number} 0=Sun … 6=Sat */
export function weekday(iso = today()) {
  return fromISODate(iso)?.getDay() ?? new Date().getDay();
}
