// Update tab (the id stays "week"): the panel's hero. One click copies this week's
// update; below it the Mon–Fri strip of tracked hours, tasks done this week, today's
// top work, and the way into the full report (spec §3.1).
import { $, h, clear } from '../components/dom.js';
import { report } from '../components/undo.js';
import { getTasks, doneThisWeek } from '../../lib/tasks.js';
import { onTasksChanged } from '../../lib/storage.js';
import { onNotesChanged, getNotes, createNote, otherWork } from '../../lib/notes.js';
import { today } from '../../lib/dates.js';
import { loadRange } from '../../lib/activity/range.js';
import { onTrackingChanged, trackerStatus, allowTracking } from '../../lib/activity/status.js';
import { weekStart, dayKey, fmtDuration, WORK_DAYS } from '../../lib/week.js';
import { WEEKDAYS } from '../../lib/report/draft.js';
import { weekUpdate, summarize } from './update-draft.js';
import { openTab } from './open-tab.js';

const strip = h('div', { id: 'weekDays', class: 'wdays', attrs: { role: 'group', 'aria-label': 'Time tracked per day' } });
const done = h('p', { id: 'doneCount', class: 'stat' });
const top = h('ol', { id: 'top', class: 'top' });
const topHead = h('h3', { class: 'label' }, 'Top work today');
const copyMsg = h('div', { id: 'copyMsg', class: 'msg', attrs: { role: 'status' } });
const empty = h('div', { id: 'weekEmpty', class: 'empty', hidden: true });
const capInput = h('input', { id: 'quickDone', type: 'text', maxLength: 300, attrs: { 'aria-label': 'What did you get done today?', 'aria-describedby': 'quickHelp', placeholder: 'e.g. Reviewed the CSV export MR' } });
const capCount = h('p', { id: 'noteCount', class: 'msg', attrs: { role: 'status' } });
const capTrack = h('p', { id: 'trackNudge', class: 'msg', hidden: true }, 'Want this to fill itself? ',
  h('button', { class: 'quiet link', type: 'button', on: { click: () => void allowTracking().then(() => refresh()).catch(report) } }, 'Turn on tracking'));
/** Guided capture: a day note for today, which the update lists as Other work. */
const cap = h('form', { id: 'quickCapture', class: 'cap', on: { submit: (/** @type {Event} */ e) => { e.preventDefault(); void addDone().catch(report); } } },
  h('label', { class: 'label', attrs: { for: 'quickDone' } }, 'What did you get done today?'),
  h('div', { class: 'row' }, capInput, h('button', { class: 'primary', type: 'submit' }, 'Add')),
  h('p', { id: 'quickHelp', class: 'msg' }, 'Add two or three things — they become your update’s Other work.'),
  capCount, capTrack);
/** The parts that only make sense once the week has something in it. */
const filled = [strip, done, topHead, top];

/** @param {boolean} tracking */
async function renderTracking(tracking) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [week, day] = await Promise.all([loadRange(weekStart(0), WORK_DAYS), loadRange(start, 1)]);
  const todayKey = dayKey(new Date());
  clear(strip);
  strip.append(...week.days.map((d, i) => h('div', { class: dayKey(d) === todayKey ? 'wday today' : 'wday' },
    h('div', { class: 'name' }, `${WEEKDAYS[i]} ${d.getDate()}`), h('div', { class: 'hrs' }, week.perDay[i] ? fmtDuration(week.perDay[i] ?? 0) : '–'))));
  const items = Object.values(day.merged).sort((a, b) => b.ms - a.ms);
  clear(top);
  const rows = items.filter((e) => e.category !== 'Browsing').slice(0, 5);
  top.append(...(rows.length ? rows.map((e) => h('li', {}, e.task, h('span', {}, fmtDuration(e.ms))))
    : [h('li', { class: 'none' }, tracking ? 'Nothing tracked yet today. Work in your tabs and it shows up here.' : 'Tracking is off, so only tasks and notes appear here.')]));
}

async function addDone() {
  const body = capInput.value.trim();
  if (!body) return;
  await createNote({ body, category: 'Work', day: today() });
  capInput.value = '';
  capInput.focus();
}

/** @param {boolean} none @param {boolean} tracking */
async function renderCapture(none, tracking) {
  cap.hidden = !(none || !tracking);   // with tracking on and a filled week the update speaks for itself
  capTrack.hidden = tracking;
  const n = otherWork(await getNotes(), dayKey(weekStart(0)), today()).length;
  capCount.textContent = n ? `${n} thing${n === 1 ? '' : 's'} noted this week` : '';
}

async function renderDone() {
  const n = doneThisWeek(await getTasks());
  clear(done);
  done.append(h('span', { class: 'mark' }, String(n)), ` task${n === 1 ? '' : 's'} done this week`);
}

/** Copy straight from the click: the clipboard needs the gesture. Says what was copied and shows it. */
async function copyUpdate() {
  const md = await weekUpdate();
  const s = summarize(md);
  if (!s) { await renderEmpty(true); return; }
  await navigator.clipboard.writeText(md);
  copyMsg.replaceChildren(`Copied ${s.lines} line${s.lines === 1 ? '' : 's'}${s.parts ? ' — ' + s.parts : ''}. Open the full update to edit it first.`,
    h('details', { class: 'preview' }, h('summary', {}, 'Preview'), h('pre', {}, md)));
}

/** Nothing this week: swap the numbers for a short welcome with the two ways forward. @param {boolean} [fromCopy] */
async function renderEmpty(fromCopy = false) {
  const none = !summarize(await weekUpdate());
  await renderCapture(none, (await trackerStatus()).tracking);
  empty.hidden = !none;
  filled.forEach((el) => { el.hidden = none; });
  // Nothing to copy yet: the capture box and the two ways forward lead, not a Copy that can only say no.
  $('#copyUpdate').hidden = none;
  if (none) copyMsg.textContent = fromCopy ? 'Nothing to copy yet.' : '';
}

export function refresh() { renderAll().catch(report); }

async function renderAll() {
  const { tracking } = await trackerStatus();
  await Promise.all([renderTracking(tracking), renderDone(), renderEmpty()]);
}

/** @param {HTMLElement} host @param {{ showToday?: () => void }} [api] */
export function mount(host, api = {}) {
  const openReport = () => openTab('src/ui/report/report.html').catch(report);
  host.append(
    h('button', { id: 'copyUpdate', class: 'primary hero', on: { click: () => void copyUpdate().catch(report) } }, 'Copy this week’s update'),
    copyMsg,
    h('button', { id: 'openReport', on: { click: openReport } }, 'Open full update to edit or share →'),
    cap, empty, strip, done, topHead, top);
  empty.append(
    h('p', {}, 'Your week builds up here: tasks you finish, your notes, and time on the tickets and docs you work in.'),
    h('div', { class: 'row' },
      h('button', { class: 'primary', on: { click: () => api.showToday?.() } }, 'Add your first task'),
      h('button', { class: 'quiet', on: { click: () => void openTab('src/ui/report/report.html?sample=1').catch(report) } }, 'See a sample update')));
  onTasksChanged(() => refresh());
  onTrackingChanged(() => refresh());
  onNotesChanged(() => refresh());  // a first day note ends the empty state too
  refresh();
}
