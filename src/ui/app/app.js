// The full app tab (spec §3.2). Calendar, Tasks, Notes and Stats are views here, chosen by the shared
// header nav (hash links); the week update and Settings are their own pages.
// Hash routes: #calendar (default), #tasks, #notes, #stats, #day=YYYY-MM-DD (opens that day's sheet).
import '../components/theme.js';
import { $ } from '../components/dom.js';
import { mountNav, setCurrent } from '../components/nav.js';
import { bindKeys, onNewDay } from '../components/keys.js';
import { report } from '../components/undo.js';
import { getTasks } from '../../lib/tasks.js';
import { onTasksChanged } from '../../lib/storage.js';
import { isValidISODate } from '../../lib/dates.js';
import * as calendar from './calendar-view.js';
import * as tasksView from './tasks-view.js';
import * as sheet from './day-sheet.js';
import * as editor from './task-editor.js';
import * as stats from './stats-view.js';
import { mountNotes } from '../components/notes-view.js';
import { renderInsights } from '../components/note-insights.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {'calendar' | 'tasks' | 'notes' | 'stats'} View */
const VIEWS = /** @type {View[]} */ (['calendar', 'tasks', 'notes', 'stats']);

/** @type {Record<View, [string, string]>} */
const TITLES = {
  calendar: ['Calendar', 'Click a day to see and tick what was on it.'],
  tasks: ['Tasks', 'Add with plain words: dates, !high and repeats are picked out for you.'],
  notes: ['Notes', 'Short notes that feed your weekly update.'],
  stats: ['Stats', 'Streaks and a year of days.'],
};

/** @type {{ tasks: Task[], notes: Note[], view: View, showStats: boolean }} */
const state = { tasks: [], notes: [], view: 'calendar', showStats: false };

function render() {
  if (state.view === 'calendar') calendar.render(state.tasks);
  else if (state.view === 'tasks') tasksView.render(state.tasks);
  else if (state.view === 'stats') stats.render(state.tasks, state.notes);
  sheet.render(state.tasks);
}

/** @param {View} view @param {boolean} [keepHash] */
function show(view, keepHash = false) {
  state.view = view;
  for (const v of VIEWS) {
    $(`#view-${v}`).hidden = v !== view;
  }
  setCurrent(view);
  $('#viewTitle').textContent = TITLES[view][0];
  $('#viewSub').textContent = TITLES[view][1];
  if (!keepHash) history.replaceState(null, '', `#${view}`);
  render();
}

function route() {
  const day = location.hash.match(/^#day=(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (day && isValidISODate(day)) { show('calendar', true); calendar.goTo(day); sheet.open(day); return; }
  const view = /** @type {View} */ (location.hash.slice(1));
  // Stats is off until switched on in Settings → Advanced: its link goes to the calendar.
  show(VIEWS.includes(view) && (view !== 'stats' || state.showStats) ? view : 'calendar');
}

async function init() {
  state.showStats = await mountNav('calendar');
  calendar.init();
  tasksView.init();
  sheet.init();
  editor.init();
  // Notes keep themselves current; the insights redraw with them (F5), and Stats counts days with a note.
  mountNotes($('#notesHost'), { onRender: (notes) => {
    state.notes = notes;
    renderInsights($('#insights'), notes);
    if (state.view === 'stats') render();
  } });
  bindKeys({
    n: () => { show('tasks'); tasksView.focusAdd(); },
    '/': () => { show('tasks'); tasksView.focusSearch(); },
    t: () => { if (state.view === 'calendar') calendar.goToday(); },
    ArrowLeft: () => { if (state.view === 'calendar') calendar.step(-1); },
    ArrowRight: () => { if (state.view === 'calendar') calendar.step(1); },
  });
  onNewDay(render);
  window.addEventListener('hashchange', route);
  onTasksChanged((next) => { state.tasks = next; render(); });
  // A failed write leaves the screen behind storage: re-read and redraw (task-actions' guarded()).
  document.addEventListener('tasks:stale', () => void getTasks().then((next) => { state.tasks = next; render(); }).catch(report));
  state.tasks = await getTasks();
  route();
}

init().catch(report);
