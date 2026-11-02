// Notes: work that didn't happen in Chrome. The week's day notes (spec §4, W2),
// read and written through lib/notes.js; private notes never reach this list.
import { h, clear, $ } from '../components/dom.js';
import { WEEKDAYS, noteKey } from '../../lib/report/draft.js';
import { createNote, deleteNote } from '../../lib/notes.js';
import { weekday, today, addDays } from '../../lib/dates.js';
import { dayKey } from '../../lib/week.js';
import { getW, getWeekOffset, load, msg } from './main.js';

export function renderNotes(W) {
  clear($('#notes'));
  $('#notes').append(...W.notes.map(n => h('li', { class: W.excluded.has(noteKey(n)) ? 'off' : '' },
    h('input', { type: 'checkbox', dataset: { key: noteKey(n) }, checked: !W.excluded.has(noteKey(n)), disabled: W.sample, attrs: { 'aria-label': `Include in update: ${n.text}` } }),
    h('span', {}, h('small', {}, WEEKDAYS[(weekday(n.day) + 6) % 7]), n.text),
    W.sample ? null : h('button', { class: 'quiet delete', dataset: { del: n.id }, attrs: { 'aria-label': `Delete note: ${n.text}` } }, 'Delete'))));
  $('#noteText').disabled = $('#addNote').disabled = !!W.sample;
}

async function addNote() {
  const body = $('#noteText').value.trim(); if (!body || getW().sample) return;
  // Notes added while viewing a past week are dated to that week's Friday.
  const day = getWeekOffset() === 0 ? today() : addDays(dayKey(getW().start), 4);
  await createNote({ body, category: 'Work', day });
  $('#noteText').value = '';
  load(false);
}

const fail = e => msg('#notesMsg', `That note was not saved: ${e.message}`);

export function init() {
  $('#addNote').onclick = () => addNote().catch(fail);
  $('#noteText').addEventListener('keydown', e => { if (e.key === 'Enter') addNote().catch(fail); });
  $('#notes').addEventListener('click', async e => {
    const id = e.target.dataset.del; if (!id) return;
    await deleteNote(id).catch(fail);
    load(false);
  });
}
