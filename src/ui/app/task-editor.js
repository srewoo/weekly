// Edit a task's title, description, priority and due date, or a recurring task's weekdays (spec D5).
import { $, $$ } from '../components/dom.js';
import { updateTask } from '../../lib/tasks.js';
import { toast, report, GONE } from '../components/undo.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */

/** @type {Task | null} */
let editing = null;
const dialog = () => /** @type {HTMLDialogElement} */ ($('#editor'));
/** @param {string} sel */
const field = (sel) => /** @type {HTMLInputElement} */ ($(sel));
const dayBoxes = () => /** @type {HTMLInputElement[]} */ ($$('#eDays input'));

/** @param {Task} t */
export function openEditor(t) {
  editing = t;
  field('#eTitle').value = t.title;
  field('#eDesc').value = t.description;
  field('#ePriority').value = t.priority;
  field('#eDue').value = t.dueDate ?? '';
  field('#eDue').closest('label')?.toggleAttribute('hidden', t.repeat !== null);
  $('#eDays').hidden = t.repeat === null;
  for (const b of dayBoxes()) b.checked = t.repeat?.days.includes(Number(b.value)) ?? false;
  dialog().returnValue = '';   // Esc keeps the last returnValue; never let it read as "save"
  if (!dialog().open) dialog().showModal();
  field('#eTitle').focus();
}

async function save() {
  const t = editing;
  editing = null;
  if (!t || dialog().returnValue !== 'save') return;
  const before = { title: t.title, description: t.description, priority: t.priority, dueDate: t.dueDate, repeatDays: t.repeat?.days };
  const repeatDays = dayBoxes().filter((b) => b.checked).map((b) => Number(b.value));
  if (t.repeat && !repeatDays.length) toast('Kept its days: a repeating task needs at least one.');
  const saved = await updateTask(t.id, { title: field('#eTitle').value, description: field('#eDesc').value,
    priority: /** @type {Task['priority']} */ (field('#ePriority').value), dueDate: field('#eDue').value || null, repeatDays });
  if (saved === null) { toast(GONE); return; }
  toast('Saved.', () => updateTask(t.id, before));
}

export function init() {
  $('#eCancel').addEventListener('click', () => dialog().close('cancel'));
  dialog().addEventListener('close', () => void save().catch(report));
}
