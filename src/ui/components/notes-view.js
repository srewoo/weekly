// The notes list (spec §3.1 Notes, §3.2; F1–F3, F8): quick add, search, category
// filter, pin, done, edit, delete, and private notes behind the PIN. The side
// panel's Notes tab and the app's Notes view both mount it. It re-renders from
// onNotesChanged and from the worker's crypto:changed, so every open page agrees.
import { h, clear } from './dom.js';
import { today } from '../../lib/dates.js';
import { getNotes, onNotesChanged, filterNotes, CATEGORIES, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../../lib/notes.js';
import { noteCard } from './note-card.js';
import { openNoteEditor, closeNoteEditorIfPrivate } from './note-editor.js';
import { askPin } from './pin-dialog.js';
import { report, toast } from './undo.js';
import * as act from './note-actions.js';
import * as priv from './private.js';

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('./note-editor.js').Edit} Edit */
/** @typedef {{ refresh: () => Promise<void>, focusSearch: () => void, focusAdd: () => void }} NotesView */

/** @param {string} id @param {string} label @param {boolean} all */
const categorySelect = (id, label, all) => h('select', { id, attrs: { 'aria-label': label } },
  all ? h('option', { value: 'all' }, 'All categories') : null, CATEGORIES.map((c) => h('option', { value: c }, c)));

const ensureUnlocked = async () => priv.pinState().unlocked || askPin();

/** @param {Edit} e */
const isBlank = (e) => !e.title.trim() && !e.body.trim();
/** @param {Edit} e @returns {import('../../lib/notes.js').NoteDraft} */
const plainDraft = (e) => ({ title: e.title, body: e.body, category: e.category, day: e.day, enc: null });

/**
 * Store a private note: the worker seals and writes it in one step (crypto:save), so its
 * title and body never reach storage and a PIN change cannot come in between.
 * A failure is said here; the reply tells the caller whether anything was stored.
 * @param {string | null} id null adds a note @param {Edit} e @returns {Promise<import('./private.js').Reply>}
 */
async function storePrivate(id, e) {
  if (!(await ensureUnlocked())) return { ok: false };
  const plain = { title: e.title.trim(), body: e.body.trim() };
  const fields = { category: e.category, day: e.day };
  let r = await priv.store(id, plain, fields);
  // The worker dropped its key (restart or idle): ask for the PIN once and try again.
  if (r.locked && await askPin()) r = await priv.store(id, plain, fields);
  if (r.gone) toast(act.NOTE_GONE);
  else if (!r.ok) report(new Error(priv.explain(r)));
  return r;
}

/** @param {Note} n */
async function edit(n) {
  if (n.enc && !(await ensureUnlocked())) return;
  if (n.enc) await priv.openAll([n]);
  // The worker dropped its key (restart or idle): ask for the PIN once and open again.
  if (n.enc && !priv.pinState().unlocked && await askPin()) await priv.openAll([n]);
  const plain = priv.plainOf(n);
  if (n.enc && !plain) { report(new Error('This private note could not be opened.')); return; }
  const save = (/** @type {Edit} */ e) => {
    // Not stored: reopen the editor with what was typed, so nothing is lost (a deleted note is not reopened).
    const kept = () => openNoteEditor(n, { title: e.title, body: e.body }, priv.pinState().hasPin, save, e.private);
    if (isBlank(e)) kept();
    else if (!e.private) act.save(n.id, plainDraft(e)).catch(report);
    else storePrivate(n.id, e).then((r) => { if (!r.ok && !r.gone) kept(); }).catch(report);
  };
  openNoteEditor(n, plain, priv.pinState().hasPin, save);
}

/** @param {boolean} forToday the panel's form: a note lands on today unless the day is changed */
function addForm(forToday) {
  const title = h('input', { type: 'text', id: 'noteTitle', maxLength: NOTE_TITLE_MAX, placeholder: 'Title (optional)', attrs: { 'aria-label': 'Note title' } });
  const body = h('textarea', { id: 'noteBody', rows: 3, maxLength: NOTE_BODY_MAX, placeholder: forToday ? 'Add a note for today…' : 'Write a note…', attrs: { 'aria-label': forToday ? 'Note for today' : 'Note' } });
  const category = categorySelect('noteNewCat', 'Category', false);
  const day = h('input', { type: 'date', id: 'noteDay', value: forToday ? today() : '', attrs: { 'aria-label': 'Attach to a day (optional)' } });
  const isPrivate = h('input', { type: 'checkbox', id: 'notePrivate' });
  const privRow = h('label', { class: 'check', hidden: true }, isPrivate, ' 🔒 Private');
  const submit = async () => {
    const e = { title: title.value, body: body.value, category: category.value, day: day.value || null, private: isPrivate.checked };
    if (isBlank(e)) return;
    const ok = e.private ? (await storePrivate(null, e)).ok : await act.add(plainDraft(e));
    if (ok) { title.value = ''; body.value = ''; day.value = forToday ? today() : ''; isPrivate.checked = false; body.focus(); }
  };
  const form = h('form', { class: 'note-add', on: { submit: (/** @type {SubmitEvent} */ e) => { e.preventDefault(); submit().catch(report); } } },
    title, body, h('div', { class: 'addrow' }, category, day, privRow, h('button', { class: 'primary' }, forToday ? 'Add note for today' : 'Add note')));
  // ⌘/Ctrl+Enter saves from the body, where Enter is a new line.
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
  return { form, body, privRow, isPrivate };
}

/**
 * @param {HTMLElement} host
 * @param {{ onRender?: (notes: Note[]) => void, forToday?: boolean }} [opts] onRender: e.g. the app's insights; forToday: the panel's add-a-note-for-today form
 * @returns {NotesView}
 */
export function mountNotes(host, opts = {}) {
  /** @type {Note[]} */
  let notes = [];
  const q = h('input', { type: 'search', id: 'noteQ', placeholder: 'Search notes', autocomplete: 'off', attrs: { 'aria-label': 'Search notes' } });
  const cat = categorySelect('noteCat', 'Show category', true);
  const list = h('ul', { id: 'noteList', class: 'notelist' });
  const add = addForm(opts.forToday === true);
  const lockBtn = h('button', { type: 'button', id: 'noteLock', class: 'quiet', hidden: true });
  const draw = () => {
    const { hasPin, unlocked } = priv.pinState();
    lockBtn.hidden = add.privRow.hidden = !hasPin;
    if (!hasPin) add.isPrivate.checked = false;   // a hidden, ticked box would fail every later add
    lockBtn.textContent = unlocked ? 'Lock private notes' : 'Unlock private notes';
    const plain = new Map(notes.flatMap((n) => { const p = priv.plainOf(n); return p ? [[n.id, p]] : []; }));
    const shown = filterNotes(notes, { q: q.value, category: cat.value, plain });
    clear(list);
    if (!shown.length) list.append(h('li', { class: 'none' }, notes.length ? 'Nothing matches.' : 'No notes yet. Write one above: a decision, a call, anything that happened outside Chrome. Notes with a day feed your weekly update.'));
    else list.append(...shown.map((n) => noteCard(n, { plain: priv.plainOf(n), onEdit: (x) => { edit(x).catch(report); } })));
    opts.onRender?.(notes);
  };
  const reopen = () => priv.openAll(notes).then(draw).catch(report);
  const refresh = () => priv.sync().then(reopen).catch(report);
  lockBtn.addEventListener('click', () => void (priv.pinState().unlocked ? priv.lock() : askPin().then((ok) => (ok ? reopen() : undefined))).catch(report));
  q.addEventListener('input', draw);
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape' && q.value) { q.value = ''; draw(); } });
  cat.addEventListener('change', draw);
  host.append(add.form, h('div', { class: 'note-tools' }, q, cat, lockBtn), list);
  onNotesChanged((next) => { notes = next; void reopen(); });
  priv.onPrivateChange(() => { if (!priv.pinState().unlocked) closeNoteEditorIfPrivate(); void reopen(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh(); });
  getNotes().then((next) => { notes = next; return refresh(); }).catch(report);
  return { refresh, focusSearch: () => q.focus(), focusAdd: () => add.body.focus() };
}
