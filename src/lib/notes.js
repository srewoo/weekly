/**
 * The notes store (spec §4): the only module that reads or writes the `notes` key.
 * Every write is a read-modify-write of one array under NOTES_LOCK (Web Locks,
 * shared by the worker and every extension page), like tasks in storage.js.
 *
 * Migration is by shape, not by schemaVersion: version 2 already versions the
 * tasks blob on every profile that ran Phase 2, and a Weekly 2 note can also
 * arrive later in an old export. Any `{id, ts, text}` entry becomes a day note
 * on read, and the converted list is written back under the lock.
 */
import { withLock } from './storage.js';
import { coerceNote, coerceNoteList, mergeNoteLists } from './note-views.js';

export * from './note-views.js';

/** @typedef {import('./note-views.js').Note} Note */
/** @typedef {import('./note-views.js').Cipher} Cipher */
/**
 * @typedef {object} NoteDraft
 * @property {string} [title]
 * @property {string} [body]
 * @property {string} [category]
 * @property {string | null} [day]
 * @property {boolean} [pinned]
 * @property {Cipher | null} [enc]   ciphertext from the worker; title and body are then dropped
 */

const KEY = 'notes';
export const NOTES_LOCK = 'weekly:notes';

/** Unlocked read; never writes. */
async function read() {
  return coerceNoteList((await chrome.storage.local.get(KEY))[KEY]);
}

/** @returns {Promise<Note[]>} */
export async function getNotes() {
  const { notes, changed } = await read();
  if (!changed) return notes;
  return mutateNotes((cur) => ({ notes: cur, result: cur }));
}

/**
 * Serialised read-modify-write. `fn` is synchronous and pure: Web Locks are not
 * re-entrant, so it must not call any other function in this module.
 * @template T @param {(notes: Note[]) => { notes: Note[], result: T }} fn @returns {Promise<T>}
 */
export function mutateNotes(fn) {
  return withLock(NOTES_LOCK, async () => {
    const { notes, result } = fn((await read()).notes);
    await chrome.storage.local.set({ [KEY]: notes });
    return result;
  });
}

/**
 * Rewrite every note under the lock with async work in between: the worker's PIN
 * change re-encrypts each private note. `fn` may await crypto, but must not call
 * another function in this module (Web Locks are not re-entrant). `also` is
 * written in the same set() call, so the notes and the PIN record never disagree.
 * When `fn` throws, nothing is written.
 * @param {(notes: Note[]) => Promise<{ notes: Note[], also?: Record<string, unknown> }>} fn
 * @returns {Promise<void>}
 */
export function transformNotes(fn) {
  return withLock(NOTES_LOCK, async () => {
    const { notes, also = {} } = await fn((await read()).notes);
    await chrome.storage.local.set({ ...also, [KEY]: notes });   // `also` can never overwrite the notes
  });
}

/** @param {NoteDraft} draft @returns {Promise<Note | null>} null when there is nothing to keep */
export function createNote(draft) {
  const now = Date.now();
  const note = coerceNote({ ...draft, id: undefined, done: false, createdAt: now, updatedAt: now }, now);
  if (!note) return Promise.resolve(null);
  return mutateNotes((cur) => ({ notes: [note, ...cur], result: note }));
}

/**
 * Patch one note. A function patch is computed inside the lock from the current
 * note (a toggle never reads outside it). Ticking done stamps `completedAt`.
 * @param {string} id
 * @param {Partial<Note> | ((current: Note) => Partial<Note>)} patch
 * @returns {Promise<Note | null>} null when the note is gone
 */
export function updateNote(id, patch) {
  return mutateNotes((cur) => {
    const old = cur.find((n) => n.id === id);
    if (!old) return { notes: cur, result: null };
    const p = typeof patch === 'function' ? patch(old) : patch;
    const now = Date.now();
    const done = p.done ?? old.done;
    const next = coerceNote({ ...old, ...p, id, updatedAt: now, completedAt: done ? (old.done ? old.completedAt : now) : null }, now);
    return next ? { notes: cur.map((n) => (n.id === id ? next : n)), result: next } : { notes: cur, result: null };
  });
}

/** @param {string} id */
export const togglePinned = (id) => updateNote(id, (n) => ({ pinned: !n.pinned }));
/** @param {string} id */
export const toggleDone = (id) => updateNote(id, (n) => ({ done: !n.done }));

/** @param {string} id @returns {Promise<Note | null>} the removed note, for Undo */
export function deleteNote(id) {
  return mutateNotes((cur) => ({ notes: cur.filter((n) => n.id !== id), result: cur.find((n) => n.id === id) ?? null }));
}

/** Undo a delete: put the note back unless its id is already there. @param {Note} note */
export function restoreNote(note) {
  return mutateNotes((cur) => ({ notes: cur.some((n) => n.id === note.id) ? cur : [note, ...cur], result: undefined }));
}

/** "Delete everything" in the report. @returns {Promise<number>} how many were removed */
export function deleteAllNotes() {
  return mutateNotes((cur) => ({ notes: [], result: cur.length }));
}

/**
 * Re-render on a change from any context (another tab, the worker, the on-page note).
 * @param {(notes: Note[]) => void} cb @returns {() => void} unsubscribe
 */
export function onNotesChanged(cb) {
  /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
  const listener = (changes, area) => {
    if (area === 'local' && KEY in changes) cb(coerceNoteList(changes[KEY]?.newValue).notes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
