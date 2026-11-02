// The fictional week the store screenshots show. Everything is relative to `friday`
// (a local YYYY-MM-DD), so the pictures look the same whenever they are made.
// An engineer/PM week. Tickets and merge requests are made up (ENGX-151, !418); no real or customer names.
import { addDays, fromISODate } from '../src/lib/dates.js';

const at = (iso, h, m = 0) => { const d = /** @type {Date} */ (fromISODate(iso)); d.setHours(h, m, 0, 0); return d.getTime(); };
const MON_FRI = [1, 2, 3, 4, 5];

// [title, priority, day offset from Monday (null = no date), done at [offset, hour] or null]
const ONE_OFFS = [
  ['Write the ENGX-151 CSV export spec', 'high', 0, [0, 15]],
  ['Review 3 MRs', 'medium', 1, [1, 11]],
  ['Write the ENGX-162 postmortem', 'high', 3, [3, 16]],
  ['Ship the CSV export to beta', 'high', 4, [4, 12]],
  ['Update the 4.2 release notes', 'medium', 2, null],
  ['Reply to the pilot customer’s API questions', 'medium', 4, null],
  ['Draft the Q1 roadmap outline', 'medium', 4, null],
  ['Book the design review for the export dialog', 'low', 1, null],
  ['Plan the 4.3 sprint backlog', 'low', 7, null],
  ['Read the RFC on retry budgets', 'low', null, null],
  ['Try the new CI cache settings', 'low', null, null],
  ['Submit the October expense report', 'low', null, null],
];

// Daily tasks, started up to eleven months back, ticked on most of their days.
const DAILY = [['Standup notes', 340], ['Review open merge requests', 250]];  // two, so the report shot reaches Tickets and MRs

/** Every Mon–Fri from `from` to `to`, skipping a few the way a real person does. */
const ticks = (from, to, seed) => {
  const out = [];
  for (let d = from, i = 0; d <= to; d = addDays(d, 1), i++) {
    const wd = fromISODate(d)?.getDay() ?? 0;
    if (wd === 0 || wd === 6) continue;
    if ((i * 7 + seed * 5) % 23 === 0 || (wd === 5 && (i + seed) % 5 === 0)) continue;
    out.push(d);
  }
  return out;
};

/** @param {string} friday @returns {object[]} tasks as Weekly stores them */
export function demoTasks(friday) {
  const mon = addDays(friday, -4);
  const daily = DAILY.map(([title, back], n) => {
    const from = addDays(mon, -back);
    // This week is a good one: every daily task done Monday to Thursday; today only standup so far.
    const past = ticks(from, addDays(mon, -1), n).concat([0, 1, 2, 3].map((o) => addDays(mon, o)));
    return { id: `demo-daily-${n}`, title, description: '', priority: 'medium', dueDate: null, status: 'open',
      createdAt: at(from, 9), updatedAt: at(friday, 9, 40), completedAt: null,
      repeat: { days: MON_FRI, from, until: null }, doneDates: n === 0 ? [...past, friday] : past };
  });
  const oneOffs = ONE_OFFS.map(([title, priority, off, done], n) => {
    const created = at(addDays(mon, -2), 18, n);
    const completedAt = done ? at(addDays(mon, done[0]), done[1], 10 + n) : null;
    return { id: `demo-task-${n}`, title, description: '', priority, dueDate: off === null ? null : addDays(mon, off),
      status: done ? 'done' : 'open', createdAt: created, updatedAt: completedAt ?? created, completedAt, repeat: null, doneDates: [] };
  });
  return [...daily, ...oneOffs];
}

/** @param {string} friday @returns {object[]} plain notes; the private one is sealed by the worker */
export function demoNotes(friday) {
  const mon = addDays(friday, -4);
  const note = (id, title, body, category, dayOff, extra = {}) => ({ id, title, body, category, pinned: false, done: false,
    createdAt: at(addDays(mon, dayOff), 14, 5), updatedAt: at(addDays(mon, dayOff), 14, 5), completedAt: null, day: null, enc: null, ...extra });
  return [
    note('demo-note-1', 'Sprint planning: agreed scope for 4.2', 'CSV export and the login timeout fix are in. Search ranking moves to 4.3.', 'Work', 0, { pinned: true }),
    note('demo-note-2', 'Incident follow-up: ENGX-162', 'Root cause was the idle timeout racing the token refresh. Add an alert and a retry test.', 'Work', 2),
    note('demo-note-3', '1:1 with manager', 'On track for the promo packet. Write up the export work and the incident follow-up.', 'Work', 3),
    note('demo-note-4', 'RFC: retry budgets', 'Read before the architecture review.', 'To-Read', 0),
    note('demo-note-5', '', 'Design review in Figma with the design team', 'Work', 2, { day: addDays(mon, 2) }),
    note('demo-note-6', '', 'Sprint planning', 'Work', 0, { day: mon, done: true, completedAt: at(mon, 11) }),
  ];
}

/** The private note: sealed by the worker under the demo PIN before it is stored. */
export const PRIVATE_NOTE = { id: 'demo-note-7', title: 'Salary review', body: 'Ask for the band review in the March cycle.', category: 'Personal' };
export const DEMO_PIN = '2580';
