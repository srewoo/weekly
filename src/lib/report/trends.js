import { dayKey, shiftDate, WORK_DAYS } from '../week.js';
export const NON_FOCUS = ['Meetings', 'Communication', 'Browsing', 'AI assistants'];

/**
 * Pure weekly roll-up of a loadRange(start, weeks*7) result; Mon–Fri only.
 * @param {{start: Date, perDay: number[], perDayCat: Record<string, number>[], switches: number[], awayPerDay?: number[]}} range
 * @param {number} weeks
 * @returns {{label: string, start: Date, total: number, focus: number, meet: number, away: number, switches: number}[]}
 */
export function computeTrends(range, weeks) {
  return [...Array(weeks)].map((_, w) => {
    let total = 0, meet = 0, focus = 0, sw = 0, active = 0, away = 0;
    for (let i = w * 7; i < w * 7 + WORK_DAYS; i++) {
      const cats = range.perDayCat[i] ?? {};
      const ms = range.perDay[i] ?? 0;
      total += ms;
      away += range.awayPerDay?.[i] ?? 0;
      meet += cats.Meetings || 0;
      focus += ms - NON_FOCUS.reduce((s, c) => s + (cats[c] || 0), 0);
      if (ms) { active++; sw += range.switches[i] ?? 0; }
    }
    const start = shiftDate(range.start, w * 7);
    return { label: dayKey(start).slice(5), start, total, focus, meet, away, switches: active ? Math.round(sw / active) : 0 };
  });
}
