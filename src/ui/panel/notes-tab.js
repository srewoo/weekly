// Notes tab (spec §3.1): the shared notes list, in the panel's narrow column.
import { mountNotes } from '../components/notes-view.js';

/** @type {import('../components/notes-view.js').NotesView | null} */
let view = null;

/** @param {HTMLElement} host */
export function mount(host) { view = mountNotes(host, { forToday: true }); }
export function refresh() { void view?.refresh(); }
export const focusAdd = () => view?.focusAdd();
