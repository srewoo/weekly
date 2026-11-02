// The toast: one message at a time. With an undo it carries an Undo button, and
// ⌘Z / Ctrl+Z does the same (spec D6); only the latest action is undoable, like
// Daybook. A failed write is reported here too, in plain words (spec §6).
import { h } from './dom.js';

/** @type {(() => Promise<unknown>) | null} */
let pending = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;

/** Show a message; with `undo`, offer to reverse the action. @param {string} message @param {(() => Promise<unknown>) | null} [undo] */
export function toast(message, undo = null) {
  document.querySelector('.toast')?.remove();
  clearTimeout(timer);
  pending = undo;
  const node = h('div', { class: 'toast', attrs: { role: 'status', 'aria-live': 'polite' } }, h('span', {}, message),
    undo ? h('button', { class: 'quiet', on: { click: () => void undoLast() } }, 'Undo') : null);
  // Inside an open modal dialog (the day sheet), or it would sit inert behind it.
  (document.querySelector('dialog[open]') ?? document.body).append(node);
  timer = setTimeout(() => { node.remove(); if (pending === undo) pending = null; }, 8000);
}

export const GONE = 'That task no longer exists, so nothing was changed.';
/** A write that found no such task resolves null (or false for a delete); Promise.all gives an array. @param {unknown} r */
const vanished = (r) => (Array.isArray(r) ? r.some(vanished) : r === null || r === false);

/** Reverse the latest offered action, if any. @returns {Promise<boolean>} whether something was undone */
export async function undoLast() {
  const fn = pending;
  pending = null;
  document.querySelector('.toast')?.remove();
  if (!fn) return false;
  try { toast(vanished(await fn()) ? GONE : 'Undone.'); } catch (e) { report(e); }
  return true;
}

/** Tell the user a change was not saved, in plain words. @param {unknown} e */
export function report(e) {
  const msg = e instanceof Error ? e.message : String(e);
  toast(/quota/i.test(msg) ? 'Storage is full, so that change was not saved. Export and delete old weeks in the report’s Settings.'
    : `That change was not saved: ${msg}`);
}
