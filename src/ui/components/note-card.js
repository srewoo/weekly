// One note: done box, title, body, meta line, pin, edit and delete (F1, F2).
// A private note shows neither its title nor its body until the page holds it
// unlocked (F8): while locked it is only "Private note". Text only, via h().
import { h } from './dom.js';
import { shortDate } from '../../lib/dates.js';
import * as act from './note-actions.js';

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/notes.js').Plain} Plain */

/** @param {Note} n @param {{ plain?: Plain | null, onEdit: (n: Note) => void }} o @returns {HTMLLIElement} */
export function noteCard(n, o) {
  const locked = n.enc !== null && !o.plain;
  const title = locked ? 'Private note' : o.plain?.title ?? n.title;
  const body = locked ? '' : o.plain?.body ?? n.body;
  // The accessible name never carries a locked note's words.
  const name = (title || body).split('\n')[0]?.slice(0, 60) || 'note';
  const meta = [n.category, n.day && shortDate(n.day), n.enc && (locked ? 'Locked' : 'Private'), n.pinned && 'Pinned'].filter(Boolean).join(' · ');
  return h('li', { class: ['note', n.pinned && 'pinned', n.done && 'is-done', n.enc && 'private'].filter(Boolean).join(' '), dataset: { id: n.id } },
    h('input', { type: 'checkbox', checked: n.done, attrs: { 'aria-label': `Done: ${name}` }, on: { change: () => void act.done(n) } }),
    h('div', { class: 'n-main' },
      h('span', { class: 'n-title' }, n.enc ? '🔒 ' : '', title || body),
      title && body ? h('span', { class: 'n-body' }, body) : null,
      h('span', { class: 'n-meta' }, meta)),
    h('div', { class: 'n-acts' },
      h('button', { class: 'quiet pin', attrs: { 'aria-pressed': String(n.pinned), 'aria-label': `${n.pinned ? 'Unpin' : 'Pin'}: ${name}` },
        on: { click: () => void act.pin(n) }, title: n.pinned ? 'Unpin' : 'Pin to the top' }, n.pinned ? '★ Pinned' : '★ Pin'),
      h('button', { class: 'quiet edit', attrs: { 'aria-label': `Edit: ${name}` }, on: { click: () => o.onEdit(n) } }, 'Edit'),
      h('button', { class: 'quiet danger delete', attrs: { 'aria-label': `Delete: ${name}` }, on: { click: () => void act.remove(n) } }, 'Delete')));
}
