// The Tasks view (spec D3, D4, D5): Daybook's views with counts, search, a
// priority filter, one-line add, and rows whose ⋯ menu edits, moves and deletes.
import { $, h, clear } from '../components/dom.js';
import { renderBands } from '../components/bands.js';
import { taskRow } from '../components/task-row.js';
import { quickAdd } from '../components/quick-add.js';
import { report } from '../components/undo.js';
import { sectionsFor, viewCounts, search, filterPriority } from '../../lib/tasks.js';
import { getUiState, updateUiState } from '../../lib/storage.js';
import { today } from '../../lib/dates.js';
import { openEditor } from './task-editor.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {import('../../lib/tasks.js').ViewId} ViewId */
/** @typedef {import('../../lib/tasks.js').Priority} Priority */

/** @type {{ id: ViewId, label: string, alert?: boolean }[]} */
const VIEWS = [
  { id: 'today', label: 'Today' }, { id: 'week', label: 'Week' }, { id: 'overdue', label: 'Overdue', alert: true },
  { id: 'upcoming', label: 'Upcoming' }, { id: 'open', label: 'All open' }, { id: 'completed', label: 'Completed' },
];
/** @type {Record<ViewId, string>} */
const EMPTY = { today: 'Nothing due today.', week: 'Nothing due this week.', overdue: 'Nothing overdue. Nice.',
  upcoming: 'Nothing scheduled ahead.', open: 'Nothing open.', completed: 'Nothing completed yet. Tick a task and it lands here.' };
const TEACH = 'Add one above, for example “Call Sam tomorrow !high”.';

/** @type {{ view: ViewId, query: string, priority: Priority | 'all', dayState: Record<string, 'open' | 'closed'> }} */
const ui = { view: 'today', query: '', priority: 'all', dayState: {} };
/** @type {Task[]} */
let last = [];

/** @param {Task[]} tasks */
function renderNav(tasks) {
  const counts = viewCounts(tasks, today());
  const nav = $('#taskViews');
  clear(nav);
  nav.append(...VIEWS.map((v) => h('button', { class: v.alert ? 'alert' : '', dataset: { view: v.id },
    attrs: { 'aria-pressed': String(v.id === ui.view) }, on: { click: () => { ui.view = v.id; render(last); } } },
  v.label, h('span', { class: 'n' }, String(counts[v.id])))));
}

/** @param {Task[]} tasks */
export function render(tasks) {
  last = tasks;
  renderNav(tasks);
  const day = today();
  const visible = filterPriority(search(tasks.filter((t) => t.repeat === null), ui.query), ui.priority);
  const bands = sectionsFor(visible, ui.view, day);
  const blank = ui.view === 'week' ? bands.every((b) => !b.tasks.length) : !bands.length;
  if (blank) {
    clear($('#taskList'));
    $('#taskList').append(h('p', { class: 'none' }, ui.query ? `Nothing matches “${ui.query}”.` : ['overdue', 'completed'].includes(ui.view) ? EMPTY[ui.view] : `${EMPTY[ui.view]} ${TEACH}`));
    return;
  }
  renderBands($('#taskList'), bands, (t) => taskRow(t, { day, copy: true, onEdit: openEditor }), {
    isOpen: (b) => (b.key && ui.dayState[b.key] ? ui.dayState[b.key] === 'open' : b.defaultOpen ?? true),
    onToggle: (key, open) => {
      const v = open ? 'open' : 'closed';
      ui.dayState = { ...ui.dayState, [key]: v };
      updateUiState((cur) => ({ dayState: { ...cur.dayState, [key]: v } })).catch(report);
    },
    empty: 'Nothing on this day.',
  });
}

export const focusAdd = () => $('#taskTitle').focus();
export const focusSearch = () => $('#q').focus();

export function init() {
  const q = /** @type {HTMLInputElement} */ ($('#q'));
  q.addEventListener('input', () => { ui.query = q.value; render(last); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape' && q.value) { e.preventDefault(); q.value = ''; ui.query = ''; render(last); } });
  const pf = /** @type {HTMLSelectElement} */ ($('#pfilter'));
  pf.addEventListener('change', () => { ui.priority = /** @type {Priority | 'all'} */ (pf.value); render(last); });
  const quick = quickAdd(/** @type {HTMLInputElement} */ ($('#taskTitle')), /** @type {HTMLElement} */ ($('#taskHint')));
  $('#taskAdd').addEventListener('submit', (e) => { e.preventDefault(); void quick.submit(); });
  getUiState().then((s) => { ui.dayState = s.dayState; }).catch(report);
}
