// Edit a note's title, body, category, day and privacy (F2, F3). One <dialog>, built once
// with h() the first time it is needed; the caller decides how to save (a
// private note is sealed by the worker before it is stored).
import { h } from './dom.js';
import { CATEGORIES, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../../lib/notes.js';

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/notes.js').Plain} Plain */
/** @typedef {{ title: string, body: string, category: string, day: string | null, private: boolean }} Edit */

/** @type {{ dlg: HTMLDialogElement, title: HTMLInputElement, body: HTMLTextAreaElement, category: HTMLSelectElement, day: HTMLInputElement, priv: HTMLInputElement } | null} */
let ui = null;
/** @type {((e: Edit) => void) | null} */
let onSave = null;
/** The open editor shows a private note's words. */
let showsPrivate = false;

function build() {
  const title = h('input', { type: 'text', id: 'neTitle', maxLength: NOTE_TITLE_MAX });
  const body = h('textarea', { id: 'neBody', rows: 8, maxLength: NOTE_BODY_MAX });
  const category = h('select', { id: 'neCategory' }, CATEGORIES.map((c) => h('option', { value: c }, c)));
  const day = h('input', { type: 'date', id: 'neDay' });
  const priv = h('input', { type: 'checkbox', id: 'nePrivate' });
  const dlg = h('dialog', { id: 'noteEditor', attrs: { 'aria-labelledby': 'neHead' } },
    h('form', { method: 'dialog' },
      h('h2', { id: 'neHead' }, 'Edit note'),
      h('label', { class: 'field' }, 'Title', title),
      h('label', { class: 'field' }, 'Note', body),
      h('label', { class: 'field' }, 'Category', category),
      h('label', { class: 'field' }, 'Day (optional)', day),
      h('label', { class: 'check', id: 'nePrivateRow' }, priv, ' Private: locked with your PIN'),
      h('div', { class: 'dlg-foot' },
        h('button', { value: 'cancel', formNoValidate: true }, 'Cancel'),
        h('button', { value: 'save', class: 'primary', id: 'neSave' }, 'Save'))));
  dlg.addEventListener('close', () => {
    const save = onSave;
    onSave = null;
    if (save && dlg.returnValue === 'save') save({ title: title.value, body: body.value, category: category.value, day: day.value || null, private: priv.checked });
    title.value = body.value = '';   // no private words linger in the hidden dialog
  });
  document.body.append(dlg);
  return { dlg, title, body, category, day, priv };
}

/**
 * @param {Note} n @param {Plain | null} plain the unlocked words of a private note
 * @param {boolean} canPrivate a PIN is set, so the note may be made private (or plain again)
 * @param {(e: Edit) => void} save called only when the user saves
 * @param {boolean} [isPrivate] the Private box's starting state (default: the note is private now)
 */
export function openNoteEditor(n, plain, canPrivate, save, isPrivate = n.enc !== null) {
  ui ??= build();
  ui.title.value = plain?.title ?? n.title;
  ui.body.value = plain?.body ?? n.body;
  ui.category.value = n.category;
  ui.day.value = n.day ?? '';
  ui.priv.checked = isPrivate;
  showsPrivate = n.enc !== null || plain !== null;
  ui.priv.closest('label')?.toggleAttribute('hidden', !canPrivate);
  onSave = save;
  ui.dlg.returnValue = '';   // Esc keeps the last returnValue; never let it read as "save"
  if (!ui.dlg.open) ui.dlg.showModal();
  ui.title.focus();
}

/** Close the editor if it shows private words, once the page is no longer unlocked: no plaintext stays on screen. */
export function closeNoteEditorIfPrivate() {
  if (!showsPrivate || !ui?.dlg.open) return;
  onSave = null;
  ui.dlg.close();
}
