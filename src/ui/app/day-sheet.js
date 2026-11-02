// The day sheet (spec L5, L2, L3): daily tasks to tick for that day, extra
// tasks for that day (add, tick, delete, move or copy to another day), and the
// day's notes (L3: untitled notes dated to that day). A native <dialog>: Esc closes it (L9).
import { $, h, clear } from '../components/dom.js';
import { taskRow } from '../components/task-row.js';
import { add } from '../components/task-actions.js';
import { report, toast } from '../components/undo.js';
import { recurringOn, extrasOn, dayCompletion, WORKWEEK } from '../../lib/tasks.js';
import { getNotes, createNote, deleteNote, dayNotes, onNotesChanged } from '../../lib/notes.js';
import { longDate, today } from '../../lib/dates.js';
import { openEditor } from './task-editor.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

/** @type {string | null} */
let day = null;
/** @type {Task[]} */
let last = [];

const dialog = () => /** @type {HTMLDialogElement} */ ($('#daySheet'));
/** @param {string} sel */
const field = (sel) => /** @type {HTMLInputElement} */ ($(sel));

/** @param {HTMLElement} host @param {Task[]} list @param {string} iso @param {string} none */
function rows(host, list, iso, none) {
  clear(host);
  if (!list.length) host.append(h('li', { class: 'none' }, none));
  else host.append(...list.map((t) => taskRow(t, { day: iso, copy: true, onEdit: openEditor })));
}

async function renderNotes() {
  if (!day) return;
  const iso = day;
  const list = $('#sheetNotes');
  clear(list);
  list.append(...dayNotes(await getNotes(), iso).map((n) => h('li', {}, h('span', {}, n.body),
    h('button', { class: 'quiet', attrs: { 'aria-label': `Delete note: ${n.body}` },
      on: { click: () => deleteNote(n.id).catch(report) } }, '✕'))));
}

/** @param {Task[]} tasks */
export function render(tasks) {
  last = tasks;
  if (!day || !dialog().open) return;
  const iso = day;
  const { done, total } = dayCompletion(tasks, iso);
  $('#sheetTitle').textContent = longDate(iso);
  $('#sheetSub').textContent = total ? `${done} of ${total} done` : 'Nothing planned yet.';
  $('#sheetBar').style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
  rows($('#sheetDaily'), recurringOn(tasks, iso), iso, iso < today() ? 'No daily tasks ran on this day.' : 'No daily tasks yet. Add one below.');
  rows($('#sheetExtras'), extrasOn(tasks, iso), iso, 'No extra tasks for this day.');
}

/** @param {string} iso */
export function open(iso) {
  day = iso;
  if (!dialog().open) dialog().showModal();
  render(last);
  renderNotes().catch(report);
}

/** @param {string} sel @param {(title: string, iso: string) => Promise<boolean>} fn resolves false when nothing was saved */
function onAdd(sel, fn) {
  const form = /** @type {HTMLFormElement} */ ($(sel));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = /** @type {HTMLInputElement} */ (form.querySelector('input'));
    if (!day || !input.value.trim() || !(await fn(input.value, day))) return;
    input.value = '';
    input.focus();
  });
}

/** @returns {number[]} the days the daily form is set to repeat on */
function repeatDays() {
  const v = field('#dailyDays').value;
  if (v === 'every') return [0, 1, 2, 3, 4, 5, 6];
  if (v !== 'custom') return [...WORKWEEK];
  return [...document.querySelectorAll('#dailyCustom input:checked')].map((c) => Number(/** @type {HTMLInputElement} */ (c).value));
}

export function init() {
  field('#dailyDays').addEventListener('change', () => { $('#dailyCustom').hidden = field('#dailyDays').value !== 'custom'; });
  $('#sheetClose').onclick = () => dialog().close();
  dialog().addEventListener('close', () => { day = null; if (location.hash.startsWith('#day=')) history.replaceState(null, '', '#calendar'); });
  onAdd('#dailyForm', async (title, iso) => {
    const days = repeatDays();
    if (!days.length) { toast('Pick at least one day.'); return false; }
    const ok = await add({ title, repeat: { days } });
    // A daily task always starts today, so a past sheet would otherwise look as if nothing was added.
    if (ok && iso < today()) toast('Added. Daily tasks start today, so it shows from today on.');
    return ok;
  });
  onAdd('#extraForm', (title, iso) => add({ title, dueDate: iso }));
  onAdd('#noteForm', (body, iso) => createNote({ body, category: 'Work', day: iso }).then(() => true, (e) => { report(e); return false; }));
  // A note added or deleted anywhere (the panel, the report, another tab) shows here at once.
  onNotesChanged(() => { renderNotes().catch(report); });
}
