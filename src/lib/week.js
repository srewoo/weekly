// Weekly's working-week helpers. Built on Daybook's local-calendar dates.js:
// a day is a local YYYY-MM-DD, never UTC.
import { toISODate, fromISODate, addDays } from './dates.js';

export const RETENTION_DAYS = 90;
/** A week is Monday to Friday; weekend activity is recorded but not reported. */
export const WORK_DAYS = 5;

/** @param {Date | number} d */
export const dayKey = (d) => toISODate(new Date(d));

/** A string must be a real local YYYY-MM-DD; anything else is not a workday. @param {Date | number | string} d */
export function isWorkday(d) {
  const date = typeof d === 'string' ? fromISODate(d) : new Date(d);
  const g = date?.getDay() ?? -1;
  return g >= 1 && g <= 5;
}

/** @param {Date | number} d @param {number} n @returns {Date} */
export function shiftDate(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday 00:00 of the week `off` weeks from `from`. @returns {Date} */
export function weekStart(off = 0, from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
  return d;
}

/** Every stored key ending in a date more than RETENTION_DAYS calendar days before `now`. */
export function expiredKeys(/** @type {string[]} */ keys, now = Date.now()) {
  const cutoff = addDays(dayKey(now), -RETENTION_DAYS);
  return keys.filter((k) => {
    const m = k.match(/(\d{4}-\d{2}-\d{2})$/);
    return !!m && /** @type {string} */ (m[1]) < cutoff;
  });
}

/** @param {number} ms */
export function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
}
