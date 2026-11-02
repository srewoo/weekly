// Every note write the screens make. A failed write is said in the toast
// (spec §6); a delete offers Undo (like tasks, D6). Screens re-render from
// onNotesChanged, never by patching the DOM after a write.
import { createNote, updateNote, deleteNote, restoreNote, togglePinned, toggleDone } from '../../lib/notes.js';
import { toast, report } from './undo.js';

export const NOTE_GONE = 'That note no longer exists, so nothing was changed.';
/** Thrown when a write found no such note (deleted in another tab): updateNote resolves null. */
class Gone extends Error {}
/** @template T @param {T | null} r @returns {T} */
const applied = (r) => { if (r === null) throw new Gone(); return r; };

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/notes.js').NoteDraft} NoteDraft */

/**
 * @template {unknown[]} A
 * @param {(...args: A) => Promise<unknown>} fn
 * @returns {(...args: A) => Promise<boolean>} false (after telling the user) when the write failed
 */
const guarded = (fn) => async (...args) => {
  try { await fn(...args); return true; } catch (e) { if (e instanceof Gone) toast(NOTE_GONE); else report(e); return false; }
};

/** @param {NoteDraft} draft @returns {Promise<boolean>} false when nothing was saved (blank, or a failure) */
export async function add(draft) {
  try { return (await createNote(draft)) !== null; } catch (e) { report(e); return false; }
}

export const pin = guarded(/** @param {Note} n */ async (n) => applied(await togglePinned(n.id)));
export const done = guarded(/** @param {Note} n */ async (n) => applied(await toggleDone(n.id)));
// What the editor sends is a draft; updateNote validates it (coerceNote) before it is stored.
export const save = guarded(/** @param {string} id @param {NoteDraft} patch */ async (id, patch) => applied(await updateNote(id, /** @type {Partial<Note>} */ (patch))));
export const remove = guarded(/** @param {Note} n */ async (n) => {
  const gone = await deleteNote(n.id);
  if (gone) toast('Note deleted.', () => restoreNote(gone));
});
