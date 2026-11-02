// The reminder window (spec §3.3; D7, D8): the morning brief or the evening check,
// chosen by ?slot=morning|evening. The worker opens it, one window, reused.
// Rows are the shared task rows (tick, ⋯ menu, Undo). The evening adds Move to
// tomorrow on each one-off and Move all to tomorrow, and on the last working day
// it leads with the update (counts, Review and copy); other evenings show progress and Add a note. The nudge that replaced Weekly 2's Friday reminder.
import '../components/theme.js';
import { $, h } from '../components/dom.js';
import { renderBands } from '../components/bands.js';
import { taskRow } from '../components/task-row.js';
import { bindKeys, onNewDay } from '../components/keys.js';
import { report } from '../components/undo.js';
import * as act from '../components/task-actions.js';
import { getTasks } from '../../lib/tasks.js';
import { onTasksChanged } from '../../lib/storage.js';
import { getSettings, onSettingsChanged } from '../../lib/settings.js';
import { buildPayload, headline, subline } from '../../lib/reminders.js';
import { loadWeekCounts, readyLine, progressLine } from '../../lib/reminder-week.js';
import { today, stampDate } from '../../lib/dates.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

const slot = new URLSearchParams(location.search).get('slot') === 'evening' ? 'evening' : 'morning';
/** @type {{ tasks: Task[], days: number[] }} */
const state = { tasks: [], days: [] };

/** One task row; in the evening a one-off also gets its own Move to tomorrow. @param {Task} t @param {string} day */
function row(t, day) {
  const li = taskRow(t, { day });
  if (slot === 'evening' && t.repeat === null) {
    li.append(h('button', { class: 'quiet later', attrs: { 'aria-label': `Move to tomorrow: ${t.title}` },
      on: { click: () => void act.moveToTomorrow([t]) } }, 'Tomorrow'));
  }
  return li;
}

/** The week line is cheap but async; fill it after the first paint. */
function showWeek() {
  loadWeekCounts().then((c) => {
    $('#readyLine').textContent = readyLine(c);
    $('#progressLine').textContent = progressLine(c);
  }).catch(report);
}

function render() {
  const day = today();
  const p = buildPayload(slot, state.tasks, state.days, day);
  document.body.classList.toggle('evening', slot === 'evening');
  $('#eyebrow').textContent = `${slot === 'morning' ? 'Morning' : 'End of day'} · ${stampDate(day)}`;
  $('#headline').textContent = headline(p);
  $('#sub').textContent = subline(p);
  const bands = [
    { key: 'overdue', label: 'Carried over', tasks: p.overdue, flagged: true },
    { key: 'today', label: 'Today', tasks: p.today },
  ].filter((b) => b.tasks.length);
  renderBands($('#list'), bands, (t) => row(t, day));
  if (p.empty) $('#list').append(h('p', { class: 'allclear' }, `You closed ${p.closedToday} today and nothing rolled over.`));
  $('#moveAll').hidden = slot !== 'evening' || ![...p.overdue, ...p.today].some((t) => t.repeat === null);
  $('#weekNudge').hidden = !p.weekEnds;
  $('#progress').hidden = slot !== 'evening' || p.weekEnds;
  $('#snooze').hidden = slot !== 'evening' || p.empty;
}

/** Open a Weekly page as a normal tab, then close this window. @param {string} path */
async function openTab(path) {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL(path) });
    window.close();
  } catch (e) { report(e); }
}

/** The worker owns the alarms: it brings the evening check back in an hour. */
async function snooze() {
  try {
    await chrome.runtime.sendMessage({ type: 'reminder:snooze' });
    window.close();
  } catch (e) { report(e); }
}

async function init() {
  $('#moveAll').onclick = () => {
    const p = buildPayload(slot, state.tasks, state.days);
    void act.moveToTomorrow([...p.overdue, ...p.today]);
  };
  $('#openApp').onclick = () => void openTab(`src/ui/app/app.html#day=${today()}`);
  $('#addNote').onclick = () => void openTab('src/ui/report/report.html#notesSection');
  $('#openReport').onclick = () => void openTab('src/ui/report/report.html');
  $('#snooze').onclick = () => void snooze();
  $('#dismiss').onclick = () => window.close();
  bindKeys({});
  onNewDay(render);
  onTasksChanged((next) => { state.tasks = next; render(); });
  onSettingsChanged((s) => { state.days = s.days; render(); });
  document.addEventListener('tasks:stale', () => void getTasks().then((next) => { state.tasks = next; render(); }).catch(report));
  const [tasks, settings] = await Promise.all([getTasks(), getSettings()]);
  Object.assign(state, { tasks, days: settings.days });
  render();
  showWeek();
}

init().catch(report);
