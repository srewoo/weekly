// The weekly update as Markdown, for the panel's one-click copy. It reuses the report's
// lib code (buildWeekly, the same exclusions, notes and Done rules) so the text matches
// the report's draft. A draft the user edited in the report wins, as it does there.
// ponytail: no live Jira/MR status tags and no "show time" here; open the report for those.
import { getExcluded, getDraft } from '../../lib/report-store.js';
import { getSettings } from '../../lib/settings.js';
import { loadRange } from '../../lib/activity/range.js';
import { weekStart, shiftDate, dayKey, WORK_DAYS } from '../../lib/week.js';
import { buildWeekly, withoutExcludedNotes, nextWeekTasks } from '../../lib/report/draft.js';
import { getTasks, doneInRange, doneRange, withoutExcluded } from '../../lib/tasks.js';
import { addDays } from '../../lib/dates.js';
import { getNotes, otherWork } from '../../lib/notes.js';

/** @param {Date} d */
const fmtDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Pure part: the update from already-loaded data.
 * @param {{ start: Date, merged: Record<string, import('../../lib/report/draft.js').Item>, minMinutes: number, anonymize: boolean,
 *   excluded: string[], notes: import('../../lib/notes.js').Note[], tasks: import('../../lib/tasks.js').Task[], ref?: string }} d
 * @returns {string}
 */
export function composeUpdate({ start, merged, minMinutes, anonymize, excluded, notes, tasks, ref }) {
  const skip = new Set(excluded);
  const { from, to } = doneRange(dayKey(start), ref);
  const done = to < from ? { oneOffs: [], recurring: [] } : doneInRange(tasks, from, to);
  return buildWeekly({
    rangeLabel: `${fmtDate(start)} to ${fmtDate(shiftDate(shiftDate(start, WORK_DAYS), -1))}`,
    items: Object.values(merged).filter((e) => e.ms >= minMinutes * 60000 && !skip.has(e.key)),
    notes: withoutExcludedNotes(otherWork(notes, dayKey(start), dayKey(shiftDate(start, 6))), skip),
    next: nextWeekTasks(tasks, addDays(dayKey(start), 7)),
    done: withoutExcluded(done, skip), hideNames: anonymize,
  });
}

/** @returns {Promise<string>} */
export async function weekUpdate() {
  const start = weekStart(0);
  const k = dayKey(start);
  const [range, settings, excluded, saved, tasks, notes] = await Promise.all([loadRange(start, WORK_DAYS), getSettings(),
    getExcluded(k), getDraft(`draft:weekly:${k}`), getTasks(), getNotes()]);
  if (saved?.trim()) return saved;
  return composeUpdate({ start, merged: range.merged, minMinutes: settings.minMinutes, anonymize: settings.anonymize,
    excluded, notes, tasks });
}

/**
 * What a draft holds, for the copy confirmation: bullet count and per-section counts.
 * Null when it has no bullets (the "No work-related activity" placeholder counts as empty).
 * @param {string} md
 * @returns {{ lines: number, parts: string } | null}
 */
export function summarize(md) {
  /** @type {Map<string, number>} */
  const by = new Map();
  let head = '';
  let lines = 0;
  for (const l of md.split('\n')) {
    const m = /^#{3,4} (.+)/.exec(l);
    if (m) head = (m[1] ?? '').trim();
    else if (/^\s*[-*] \S/.test(l)) { lines++; if (head) by.set(head, (by.get(head) ?? 0) + 1); }
  }
  return lines ? { lines, parts: [...by].map(([k, n]) => `${k} ${n}`).join(' · ') } : null;
}
