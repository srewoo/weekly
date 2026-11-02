import { fmtDuration as fmtMs } from '../week.js';
import { addDays } from '../dates.js';
import { PRIORITY_RANK } from '../schema.js';
// Builds the Markdown update from tracked items. Pure: no DOM, no chrome.* — see test/.
/** @typedef {{ key: string, category: string, task: string, url?: string, ms: number, days: Set<number>, tickets: Set<string>, est?: boolean }} Item */
/** @typedef {{ task: string, ms: number, days: Set<number>, related: Item[], est?: boolean }} Group */
/** @typedef {{ text: string, id?: string }} Note */
/** @typedef {{ title: string, carried?: boolean }} NextTask */
/** @typedef {{ oneOffs: { title: string }[], recurring: { task: { title: string }, done: number, of: number }[] }} DoneTasks */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const KNOWN = ['Tickets', 'Sales & CRM', 'Customer support', 'Recruiting & HR', 'SEO & marketing', 'Merge requests', 'CI/CD', 'Code',
  'Docs & specs', 'Design', 'Local dev & testing', 'Test environments', 'Analysis & monitoring', 'Planning', 'Meetings',
  'AI assistants', 'Communication', 'Cloud & infra', 'Research', 'Browsing', 'Outside Chrome'];
const FOLDABLE = ['Merge requests', 'Docs & specs', 'CI/CD', 'Planning'];

/** @param {Item} e @param {Record<string, string>} status @returns {string} */
const withStatus = (e, status) => status[e.key] ? `${e.task} [${status[e.key]}]` : e.task;

// Tickets first, with the MRs/docs that mention them folded underneath.
/** @param {Item[]} items @param {Record<string, string>} status @returns {{ used: Set<string>, list: Group[] }} */
export function groupTickets(items, status) {
  const used = new Set(), tickets = /** @type {Record<string, Group>} */ ({});
  for (const e of items) if (e.category === 'Tickets') {
    tickets[e.key.slice(5)] = { task: withStatus(e, status), ms: e.ms, days: new Set(e.days), related: [], est: e.est };
    used.add(e.key);
  }
  for (const e of items) {
    if (used.has(e.key) || !FOLDABLE.includes(e.category)) continue;
    const t = [...e.tickets].find(id => tickets[id]);
    if (t) {
      const g = /** @type {Group} */ (tickets[t]);
      g.related.push(e); g.ms += e.ms; g.est ||= e.est; e.days.forEach(d => g.days.add(d)); used.add(e.key);
    }
  }
  return { used, list: Object.values(tickets).sort((a, b) => b.ms - a.ms) };
}

/**
 * @param {Item[]} items
 * @param {{ showTime?: boolean, status?: Record<string, string>, limit?: number }} [opts]
 * @returns {string[]}
 */
function workLines(items, { showTime = false, status = {}, limit = 15 } = {}) {
  const out = [];
  /** @param {string} text @param {number} ms @param {Set<number>} [days] @param {boolean} [est] @returns {string} */
  const line = (text, ms, days, est) => `- ${text}${showTime ? ` (${est ? '~' : ''}${fmtMs(ms)}${days?.size ? ', ' + [...days].sort().map(i => WEEKDAYS[i]).join(', ') : ''})` : ''}`;
  const { used, list } = groupTickets(items, status);
  if (list.length) {
    out.push('### Tickets');
    for (const t of list) {
      out.push(line(t.task, t.ms, t.days, t.est));
      t.related.forEach(r => out.push(`  - ${r.category === 'Merge requests' ? 'MR' : r.category === 'Docs & specs' ? 'Doc' : r.category}: ${withStatus(r, status)}`));
    }
    out.push('');
  }
  /** @param {string} title @param {string[]} cats */
  const section = (title, cats) => {
    const list = items.filter(e => !used.has(e.key) && cats.includes(e.category)).sort((a, b) => b.ms - a.ms).slice(0, limit);
    if (!list.length) return;
    out.push('### ' + title);
    list.forEach(e => { out.push(line(withStatus(e, status), e.ms, e.days, e.est)); used.add(e.key); });
    out.push('');
  };
  section('Sales and customers', ['Sales & CRM', 'Customer support']);
  section('Recruiting and people', ['Recruiting & HR']);
  section('SEO and marketing', ['SEO & marketing']);
  section('Merge requests and code', ['Merge requests', 'Code', 'CI/CD', 'Cloud & infra']);
  section('Testing', ['Local dev & testing', 'Test environments']);
  section('Docs, specs and design', ['Docs & specs', 'Design']);
  section('Data and monitoring', ['Analysis & monitoring']);
  section('Research and learning', ['Research']);
  section('Projects and planning', ['Planning']);
  section('Other', [...new Set(items.map(e => e.category))].filter(c => !KNOWN.includes(c)));

  const meetings = items.filter(e => e.category === 'Meetings' && e.key !== 'calendar');
  if (meetings.length) {
    const ms = meetings.reduce((s, e) => s + e.ms, 0);
    out.push('### Meetings');
    out.push(`- ${meetings.length} call${meetings.length > 1 ? 's' : ''}${showTime ? `, about ${fmtMs(ms)} in total` : ''}: ${meetings.sort((a, b) => b.ms - a.ms).slice(0, 8).map(e => e.task).join('; ')}`);
    out.push('');
  }
  return out;
}

/** @param {Note[]} notes @param {string} [heading] @returns {string[]} */
function notesLines(notes, heading = 'Other work') {
  return notes.length ? [`### ${heading}`, ...notes.map(n => `- ${n.text}`), ''] : [];
}

/** The report's exclusion key for a note. @param {{ id?: string }} n */
export const noteKey = n => `note:${n.id}`;

/** Drop the notes the user unticked for this week. @template {{ id?: string }} T @param {T[]} notes @param {Set<string>} excluded @returns {T[]} */
export const withoutExcludedNotes = (notes, excluded) => notes.filter(n => !excluded.has(noteKey(n)));

export const NEXT_CAP = 8;
/**
 * What's next: open one-off tasks due in the week starting `nextMon`, plus open ones already overdue (carried over).
 * High priority first, then earliest due; capped.
 * @param {import('../schema.js').Task[]} tasks @param {string} nextMon ISO Monday of the following week @returns {NextTask[]}
 */
export function nextWeekTasks(tasks, nextMon) {
  const sun = addDays(nextMon, 6);
  return tasks
    .filter(t => t.repeat === null && t.status === 'open' && t.dueDate !== null && t.dueDate <= sun)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || /** @type {string} */ (a.dueDate).localeCompare(/** @type {string} */ (b.dueDate)))
    .slice(0, NEXT_CAP)
    .map(t => ({ title: t.title, carried: /** @type {string} */ (t.dueDate) < nextMon }));
}

/** @param {NextTask[] | undefined} next @returns {string[]} */
const nextLines = next => (next?.length ? ['### Next week', ...next.map(t => `- ${t.title}${t.carried ? ' (carried over)' : ''}`), ''] : []);

/** "Standup notes (4 of 5 days)". @param {DoneTasks['recurring'][number]} r */
export const recurringLabel = r => `${r.task.title} (${r.done} of ${r.of} day${r.of === 1 ? '' : 's'})`;

// Tasks completed in the week lead the update (spec §3.2). Titles are the user's own words: never anonymised.
/** @param {DoneTasks | undefined} done @returns {string[]} */
function doneLines(done) {
  if (!done || !done.oneOffs.length && !done.recurring.length) return [];
  return ['### Done', ...done.oneOffs.map(t => `- ${t.title}`), ...done.recurring.map(r => `- ${recurringLabel(r)}`), ''];
}

// People and customers become numbered stand-ins, so a draft is safe to paste into a shared channel.
/** @type {Record<string, string>} */
const ANON = { 'Recruiting & HR': 'Candidate', 'Sales & CRM': 'Customer', 'Customer support': 'Support case' };
/** @param {Item[]} items @returns {Item[]} */
export function anonymize(items) {
  const n = /** @type {Record<string, number>} */ ({});
  return [...items].sort((a, b) => b.ms - a.ms).map(e => ANON[e.category]
    ? { ...e, task: `${ANON[e.category]} ${(n[e.category] = (n[e.category] || 0) + 1)}`, url: '' }
    : e);
}

/**
 * @param {{ rangeLabel: string, items: Item[], notes?: Note[], done?: DoneTasks, next?: NextTask[], showTime?: boolean, status?: Record<string, string>, hideNames?: boolean }} opts
 * @returns {string}
 */
export function buildWeekly({ rangeLabel, items, notes = [], done, next, showTime, status, hideNames = false }) {
  const body = [...doneLines(done), ...workLines(hideNames ? anonymize(items) : items, { showTime, status }), ...notesLines(notes), ...nextLines(next)];
  if (!body.length) body.push('_No work-related activity recorded this week yet._');
  return [`## Weekly update: ${rangeLabel}`, '', ...body].join('\n').trim() + '\n';
}

/**
 * @param {{ prevLabel: string, prevItems: Item[], todayItems: Item[], notes?: Note[], status?: Record<string, string>, hideNames?: boolean }} opts
 * @returns {string}
 */
export function buildStandup({ prevLabel, prevItems, todayItems, notes = [], status, hideNames = false }) {
  /** @param {string[]} lines @returns {string[]} */
  const strip = lines => lines.map(l => l.replace(/^### /, '#### '));
  /** @param {Item[]} items @returns {Item[]} */
  const list = items => (hideNames ? anonymize(items) : items);
  const out = ['## Standup', '', `### ${prevLabel}`];
  const prev = strip(workLines(list(prevItems), { status, limit: 6 }));
  out.push(...(prev.length ? prev : ['- Nothing tracked.', '']));
  out.push('### Today');
  const today = strip(workLines(list(todayItems), { status, limit: 6 }));
  out.push(...(today.length ? today : ['- Nothing tracked yet.', '']));
  out.push(...notesLines(notes, 'Notes'));
  // Left for the person to fill in: a pre-filled "None" gets pasted unread.
  out.push('### Blockers', '- ');
  return out.join('\n').trimStart() + '\n';
}

