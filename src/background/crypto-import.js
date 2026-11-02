/**
 * A backup's notes as the PIN broker takes them in (crypto:import, D11, F7). The import
 * page has already read the file (backup.js); everything is validated again here, because
 * a message is untrusted too. Used only by crypto-broker.js, which alone writes them.
 */
import { sealNote, openNote } from '../lib/crypto.js';
import { coerceNote, NOTE_TITLE_MAX } from '../lib/notes.js';

/** @typedef {import('../lib/notes.js').Note} Note */

const IMPORT_MAX = 10000;
/** @param {unknown} list @returns {unknown[]} */
const listOf = (list) => (Array.isArray(list) ? list : []);

/** More notes than an import takes: refused in words, never cut short. @param {...unknown} lists */
export const tooMany = (...lists) => lists.some((l) => listOf(l).length > IMPORT_MAX);

/** A backup's plain notes. @param {unknown} list @returns {Note[]} */
export const plainFrom = (list) => listOf(list).flatMap((raw) => { const n = coerceNote(raw); return n && !n.enc ? [n] : []; });

/**
 * A backup's private notes, opened with the file's key and sealed with `to`. ForgetMeNot
 * kept a private note's title in plain text beside the body's ciphertext; it goes inside now (F8).
 * Null when one cannot be opened: then nothing is imported.
 * @param {unknown} list @param {CryptoKey} from @param {CryptoKey} to @returns {Promise<Note[] | null>}
 */
export async function sealedFrom(list, from, to) {
  /** @type {Note[]} */
  const out = [];
  for (const item of /** @type {any[]} */ (listOf(list))) {
    const n = coerceNote(item?.note);
    if (!n?.enc) continue;
    const title = typeof item?.title === 'string' ? item.title.trim().slice(0, NOTE_TITLE_MAX) : '';
    const plain = await openNote(from, n.enc, title).catch(() => null);
    if (!plain) return null;
    out.push({ ...n, enc: await sealNote(to, plain) });
  }
  return out;
}
