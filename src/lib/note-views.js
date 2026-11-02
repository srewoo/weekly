/**
 * Notes without storage (spec §4 Note; F1, F2, F5, L3, W2): the shape and its
 * validation, Weekly 2's conversion, search, order, day notes, the Other work
 * feed and the 7-day insights. Pure: no chrome.*, no DOM; tested in two timezones.
 *
 * A note is private when `enc` is set. Its title and body then live only inside
 * the ciphertext, so a private note's stored `title` and `body` are always ''.
 */
import { isValidISODate, toISODate, addDays, daysBetween } from './dates.js';
import { newId } from './schema.js';

export const CATEGORIES = /** @type {const} */ (['General', 'Work', 'Personal', 'Idea', 'To-Read']);
export const NOTE_TITLE_MAX = 200;
export const NOTE_BODY_MAX = 20000;
const CIPHER_MAX = 200000;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** @typedef {typeof CATEGORIES[number]} Category */
/** @typedef {{ iv: string, ct: string }} Cipher */
/** @typedef {{ title: string, body: string }} Plain */
/**
 * @typedef {object} Note
 * @property {string} id
 * @property {string} title              '' when private
 * @property {string} body               '' when private
 * @property {Category} category
 * @property {boolean} pinned
 * @property {boolean} done
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number | null} completedAt
 * @property {string | null} day         ISO local date the note belongs to, or null
 * @property {Cipher | null} enc         set means private
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** @param {unknown} v @param {number} max */
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/** @param {unknown} v @returns {v is number} */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** @returns {string} */
export const newNoteId = () => `n_${newId().slice(2)}`;

/** Weekly 2's `{id, ts, text}`: no title field, numeric id and stamp. @param {unknown} raw */
export const isWeekNote = (raw) => isObj(raw) && !('title' in raw) && Number.isInteger(raw['id']) && isNum(raw['ts']) && typeof raw['text'] === 'string';

/** A ciphertext blob is only valid if it carries both base64 parts. @param {unknown} v @returns {Cipher | null} */
export function coerceCipher(v) {
  if (!isObj(v)) return null;
  const { iv, ct } = v;
  const ok = (/** @type {unknown} */ s, /** @type {number} */ max) => typeof s === 'string' && s.length <= max && B64.test(s);
  return ok(iv, 64) && ok(ct, CIPHER_MAX) ? { iv: /** @type {string} */ (iv), ct: /** @type {string} */ (ct) } : null;
}

/**
 * Weekly 2's note becomes a day note (spec §4): its date, category Work, no title.
 * The id is derived, so converting twice (or re-importing) never duplicates it.
 * @param {{ id: number, ts: number, text: string }} w @returns {Note}
 */
export const fromWeekNote = (w) => ({
  id: `w2-${w.id}`, title: '', body: str(w.text, NOTE_BODY_MAX), category: 'Work', pinned: false, done: false,
  createdAt: w.ts, updatedAt: w.ts, completedAt: null, day: toISODate(new Date(w.ts)), enc: null,
});

/**
 * Any stored or imported note, made safe. Null when nothing is left (no title,
 * no body, no ciphertext). A malformed `enc` degrades to a plain note.
 * @param {unknown} raw @param {number} [now] @returns {Note | null}
 */
export function coerceNote(raw, now = Date.now()) {
  if (isWeekNote(raw)) {
    const w = fromWeekNote(/** @type {{ id: number, ts: number, text: string }} */ (raw));
    return w.body ? w : null;
  }
  if (!isObj(raw)) return null;
  const enc = coerceCipher(raw['enc']);
  const title = enc ? '' : str(raw['title'], NOTE_TITLE_MAX);
  const body = enc ? '' : str(raw['body'], NOTE_BODY_MAX);
  if (!enc && !title && !body) return null;
  const id = typeof raw['id'] === 'string' && /^[\w-]{1,64}$/.test(raw['id']) ? raw['id'] : newNoteId();
  const createdAt = isNum(raw['createdAt']) ? raw['createdAt'] : now;
  const done = raw['done'] === true;
  const day = raw['day'];
  return {
    id, title, body, enc,
    category: CATEGORIES.find((c) => c === raw['category']) ?? 'General',
    pinned: raw['pinned'] === true, done, createdAt,
    updatedAt: isNum(raw['updatedAt']) ? raw['updatedAt'] : createdAt,
    completedAt: done ? (isNum(raw['completedAt']) ? raw['completedAt'] : now) : null,
    day: typeof day === 'string' && isValidISODate(day) ? day : null,
  };
}

/**
 * The stored list, coerced. `changed` says whether it should be written back:
 * a Weekly 2 note, an invalid entry or a duplicate id was found.
 * @param {unknown} raw @returns {{ notes: Note[], changed: boolean }}
 */
export function coerceNoteList(raw) {
  if (!Array.isArray(raw)) return { notes: [], changed: raw !== undefined };
  const seen = new Set();
  /** @type {Note[]} */
  const notes = [];
  for (const r of raw) {
    const n = coerceNote(r);
    if (n && !seen.has(n.id)) { seen.add(n.id); notes.push(n); }
  }
  return { notes, changed: notes.length !== raw.length || raw.some(isWeekNote) };
}

/**
 * Merge notes in (an import): new ids are added; on the same id the newer
 * `updatedAt` wins (ForgetMeNot's rule), so importing twice changes nothing.
 * A plain note never replaces a private one: the private one stays (R1).
 * @param {Note[]} current @param {Note[]} incoming @returns {{ notes: Note[], added: number }}
 */
export function mergeNoteLists(current, incoming) {
  const byId = new Map(current.map((n) => [n.id, n]));
  let added = 0;
  for (const n of incoming) {
    const old = byId.get(n.id);
    if (!old) added += 1;
    if (!old || (n.updatedAt > old.updatedAt && !(old.enc && !n.enc))) byId.set(n.id, n);
  }
  return { notes: [...byId.values()], added };
}

/** @param {Note} a @param {Note} b */
const byPinnedOpenRecent = (a, b) => Number(b.pinned) - Number(a.pinned) || Number(a.done) - Number(b.done) || b.updatedAt - a.updatedAt;
/** Pinned first, open before done, then most recently updated. @param {Note[]} notes */
export const sortNotes = (notes) => [...notes].sort(byPinnedOpenRecent);

/**
 * Search title and body (F2). A private note matches only by its title, and
 * only when the page holds it unlocked (`plain`); private bodies are never searched.
 * @param {Note[]} notes @param {{ q?: string, category?: string, plain?: Map<string, Plain> }} opts
 */
export function filterNotes(notes, { q = '', category = 'all', plain = new Map() } = {}) {
  const needle = q.trim().toLowerCase();
  return sortNotes(notes.filter((n) => {
    if (category !== 'all' && n.category !== category) return false;
    const hay = n.enc ? plain.get(n.id)?.title ?? '' : `${n.title} ${n.body}`;
    return !needle || hay.toLowerCase().includes(needle);
  }));
}

/** The day sheet's notes (L3): untitled, plain, dated `iso`, oldest first. @param {Note[]} notes @param {string} iso */
export const dayNotes = (notes, iso) => notes.filter((n) => n.day === iso && !n.title && !n.enc).sort((a, b) => a.createdAt - b.createdAt);

/**
 * The update's Other work (W2): plain notes dated from `from` to `to`, one line each.
 * Private notes never appear here, so never in the draft or the AI prompt.
 * @param {Note[]} notes @param {string} from @param {string} to
 * @returns {{ id: string, day: string, text: string }[]}
 */
export function otherWork(notes, from, to) {
  /** @type {{ id: string, day: string, text: string, at: number }[]} */
  const out = [];
  for (const n of notes) {
    if (n.enc || !n.day || n.day < from || n.day > to) continue;
    const text = (n.title && n.body ? `${n.title}: ${n.body}` : n.title || n.body).replace(/\s+/g, ' ').trim();
    if (text) out.push({ id: n.id, day: n.day, text, at: n.createdAt });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.at - b.at).map(({ id, day, text }) => ({ id, day, text }));
}

/**
 * Seven local days ending `ref`, oldest first: notes created and notes done (F5).
 * Counts only, so private notes are counted without being read.
 * @param {Note[]} notes @param {string} ref
 */
export function insights(notes, ref) {
  const days = [6, 5, 4, 3, 2, 1, 0].map((k) => ({ iso: addDays(ref, -k), created: 0, done: 0 }));
  /** @param {number | null} ts */
  const slot = (ts) => (ts === null ? undefined : days[6 - daysBetween(toISODate(new Date(ts)), ref)]);
  for (const n of notes) {
    const c = slot(n.createdAt);
    if (c) c.created += 1;
    const d = n.done ? slot(n.completedAt) : undefined;
    if (d) d.done += 1;
  }
  const sum = (/** @type {'created' | 'done'} */ k) => days.reduce((s, d) => s + d[k], 0);
  return { days, created: sum('created'), done: sum('done'), total: notes.length,
    pinned: notes.filter((n) => n.pinned).length, open: notes.filter((n) => !n.done).length };
}
