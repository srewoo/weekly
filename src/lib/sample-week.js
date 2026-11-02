// An in-memory sample week for report.html?sample=1. Same shape the report page builds
// from storage (loadRange + notes + done), made up, never stored.
import { weekStart, shiftDate, dayKey, WORK_DAYS } from './week.js';

const M = 60000;
/** @typedef {[string, string, string, number, number[], string[]]} Row  key, category, task, minutes, days it was active, tickets */
/** @type {Row[]} */
const ITEMS = [
  ['jira:ENGX-151', 'Tickets', 'ENGX-151: Export report as CSV', 190, [0, 1, 2], ['ENGX-151']],
  ['jira:ENGX-162', 'Tickets', 'ENGX-162: Fix login timeout after idle', 140, [2, 3], ['ENGX-162']],
  ['jira:ENGX-170', 'Tickets', 'ENGX-170: Follow up on the search incident', 55, [4], ['ENGX-170']],
  ['mr:acme/web!418', 'Merge requests', 'web !418: Add CSV export endpoint', 95, [1, 2], ['ENGX-151']],
  ['mr:acme/web!431', 'Merge requests', 'web !431: Extend session timeout and retry', 80, [3, 4], ['ENGX-162']],
  ['gdoc:prd-csv-export', 'Docs & specs', 'PRD: CSV export for 4.2', 70, [0, 4], []],
  ['meet:meet.google.com/standup', 'Meetings', 'Team standup', 75, [0, 1, 2, 3, 4], []],
  ['meet:meet.google.com/design', 'Meetings', 'Design review in Figma: export dialog', 45, [3], []],
  ['ci:acme/web', 'CI/CD', 'web pipelines & jobs', 35, [2, 3], []],
];
/** @type {{ oneOffs: string[], recurring: [string, number, number][] }} */
const DONE = { oneOffs: ['Ship the CSV export to beta', 'Write the ENGX-162 postmortem', 'Review 3 MRs'], recurring: [['Standup notes', 5, 5], ['Triage the bug queue', 4, 5]] };
/** @type {[number, string][]} */
const NOTES = [[1, 'Sprint planning: agreed scope for 4.2'], [3, '1:1 with manager: on track for promo packet']];

/** @param {Date} [now] The sample week sits a long way back so it never meets a saved draft. */
export function sampleWeek(now = new Date()) {
  const start = weekStart(-60, now);
  const days = [...Array(WORK_DAYS)].map((_, i) => shiftDate(start, i));
  /** @type {Record<string, any>} */
  const merged = Object.create(null);
  const perDay = Array(WORK_DAYS).fill(0);
  /** @type {Record<string, number>[]} */
  const perDayCat = days.map(() => ({}));
  for (const [key, category, task, min, on, tickets] of ITEMS) {
    merged[key] = { key, category, task, url: '', ms: min * M, last: 0, days: new Set(on), tickets: new Set(tickets), est: false };
    for (const d of on) {
      const share = (min * M) / on.length;
      perDay[d] += share;
      const cats = /** @type {Record<string, number>} */ (perDayCat[d]);
      cats[category] = (cats[category] || 0) + share;
    }
  }
  return {
    start, end: shiftDate(start, WORK_DAYS), days, merged, perDay, perDayCat,
    switches: [9, 12, 8, 14, 7], estimated: days.map(() => false), histTried: days.map(() => true),
    notes: NOTES.map(([d, text], i) => ({ id: `sample-note-${i}`, day: dayKey(shiftDate(start, d)), text })),
    done: {
      oneOffs: DONE.oneOffs.map((title, i) => ({ id: `sample-task-${i}`, title })),
      recurring: DONE.recurring.map(([title, done, of], i) => ({ task: { id: `sample-daily-${i}`, title }, done, of })),
    },
    excluded: new Set(), shareOk: {},
  };
}
