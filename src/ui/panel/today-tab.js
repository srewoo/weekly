// Today tab: one-line add for today, then Overdue / Today / No date (spec §3.1).
import { h } from '../components/dom.js';
import { renderBands } from '../components/bands.js';
import { taskRow } from '../components/task-row.js';
import * as act from '../components/task-actions.js';
import { getTasks, todayBands } from '../../lib/tasks.js';
import { onTasksChanged, getUiState, updateUiState } from '../../lib/storage.js';
import { today } from '../../lib/dates.js';
import { report } from '../components/undo.js';
import { quickAdd, QUICK_PLACEHOLDER } from '../components/quick-add.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

const input = h('input', { type: 'text', id: 'addTitle', maxLength: 200, placeholder: QUICK_PLACEHOLDER, attrs: { 'aria-label': 'New task' } });
const list = h('div', { id: 'todayList' });
/** @type {Task[]} */
let tasks = [];
/** @type {Record<string, 'open' | 'closed'>} */
let dayState = {};

export function refresh() {
  const day = today();
  renderBands(list, todayBands(tasks, day), (t) => taskRow(t, { day }), {
    isOpen: (b) => (b.key && dayState[b.key] ? dayState[b.key] === 'open' : b.defaultOpen ?? true),
    onToggle: (key, open) => {
      const v = open ? 'open' : 'closed';
      dayState = { ...dayState, [key]: v };
      updateUiState((cur) => ({ dayState: { ...cur.dayState, [key]: v } })).catch(report);
    },
    action: (b) => {
      const open = b.tasks.filter((t) => t.repeat === null && t.status === 'open');
      return b.key === 'overdue' && open.length ? h('button', { class: 'moveAll', on: { click: () => void act.moveToTomorrow(open) } }, 'Move all to tomorrow') : null;
    },
    empty: 'Nothing for today yet. Try “Send the Q4 plan tomorrow !high” in the box above: a date and !high or !low are picked out for you.',
  });
}

const quick = quickAdd(input);

export const focusAdd = () => input.focus();

/** @param {HTMLElement} host */
export function mount(host) {
  host.append(h('form', { class: 'addrow', on: { submit: (/** @type {SubmitEvent} */ e) => { e.preventDefault(); void quick.submit(); } } }, input, h('button', { class: 'primary' }, 'Add')), quick.hint, list);
  onTasksChanged((next) => { tasks = next; refresh(); });
  document.addEventListener('tasks:stale', refresh);
  Promise.all([getTasks(), getUiState()]).then(([t, ui]) => { tasks = t; dayState = ui.dayState; refresh(); }).catch(report);
}
