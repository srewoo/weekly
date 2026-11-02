/**
 * The PIN broker for private notes (F3; spec §4, §5 crypto:* messages).
 *
 * The derived key lives only in this module's memory: never on disk, never in a
 * page. It is dropped on Lock, after 5 minutes without a private-note action,
 * and whenever Chrome stops the worker (a restart loads this module afresh).
 * Pages ask for encrypt/decrypt over runtime messages; encryption is brokered here
 * because crypto.subtle is missing on plain http:// pages (ForgetMeNot's reason).
 *
 * Every request runs in one queue, so two unlock attempts cannot race the
 * failure count and a PIN change is never interleaved with an encryption.
 * Only this worker writes the `security` record, including one adopted from an
 * imported backup (crypto:import, whose file work lives in crypto-import.js).
 */
import { isValidPin, createSecurity, verify, coerceSecurity, afterFailure, afterSuccess, lockedFor, sealNote, openNote } from '../lib/crypto.js';
import { transformNotes, getNotes, createNote, updateNote, coerceCipher, CATEGORIES, NOTE_TITLE_MAX, NOTE_BODY_MAX } from '../lib/notes.js';
import { plainFrom, sealedFrom, tooMany } from './crypto-import.js';
import { isOwnPage } from './sender.js';
import { writeBackup } from '../lib/portability.js';

/** @typedef {import('../lib/crypto.js').Security} Security */
/** @typedef {import('../lib/notes.js').Note} Note */
/** @typedef {Record<string, unknown>} Msg */
/** @typedef {{ ok: boolean } & Record<string, unknown>} Reply */

export const IDLE_MS = 5 * 60_000;
const KEY = 'security';
const DECRYPT_MAX = 2000;

/** @type {CryptoKey | null} */
let key = null;
let lastUse = 0;
/** @type {Promise<unknown>} */
let queue = Promise.resolve();

/** @returns {Promise<Security | null>} */
const readSecurity = async () => coerceSecurity((await chrome.storage.local.get(KEY))[KEY]);
/** @param {Security} sec */
const writeSecurity = (sec) => chrome.storage.local.set({ [KEY]: sec });
/** @param {unknown} v @param {number} max */
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * A `security` value is stored but cannot be used, while private notes depend on it (R2).
 * Replacing it would lose them for good, so a new PIN or an imported record is refused.
 */
async function damagedRecord() {
  const raw = (await chrome.storage.local.get(KEY))[KEY];
  return raw !== undefined && !coerceSecurity(raw) && (await getNotes()).some((n) => n.enc);
}

/** The key if the session is still live. `use` restarts the 5-minute idle clock. */
function liveKey(use = true) {
  if (key && Date.now() - lastUse > IDLE_MS) key = null;
  if (key && use) lastUse = Date.now();
  return key;
}
/** @param {CryptoKey} k */
const keep = (k) => { key = k; lastUse = Date.now(); };
export const lock = () => { key = null; };

/**
 * Every PIN check (unlock, change, remove) goes through here, so the lockout
 * cannot be sidestepped. While locked out the PIN is not even tried.
 * @param {unknown} pin @returns {Promise<{ ok: true, key: CryptoKey } | Reply>}
 */
async function checkPin(pin) {
  if (!isValidPin(pin)) return { ok: false, error: 'Enter your PIN: 4 to 8 digits.' };
  const sec = await readSecurity();
  if (!sec) return { ok: false, error: 'No PIN is set.' };
  const now = Date.now();
  if (lockedFor(sec, now) > 0) return { ok: false, error: 'Too many wrong PINs.', lockedUntil: sec.lockedUntil };
  const k = await verify(pin, sec);
  if (!k) {
    const next = afterFailure(sec, now);
    await writeSecurity(next);
    return { ok: false, error: 'Wrong PIN.', failedAttempts: next.failedAttempts, lockedUntil: next.lockedUntil };
  }
  if (sec.failedAttempts || sec.lockedUntil) await writeSecurity(afterSuccess(sec));
  return { ok: true, key: k };
}

/** @returns {Promise<Reply>} */
async function status() {
  const sec = await readSecurity();
  return { ok: true, hasPin: !!sec, unlocked: !!liveKey(false), lockedUntil: sec?.lockedUntil ?? 0, failedAttempts: sec?.failedAttempts ?? 0 };
}

/** @param {Msg} m @returns {Promise<Reply>} */
async function setPin(m) {
  if (!isValidPin(m['pin'])) return { ok: false, error: 'A PIN is 4 to 8 digits.' };
  if (await readSecurity()) return { ok: false, error: 'A PIN is already set.' };
  if (await damagedRecord()) return { ok: false, error: 'Your PIN record is damaged, so a new PIN can’t be set without losing your private notes.' };
  const sec = await createSecurity(m['pin']);
  const k = await verify(m['pin'], sec);
  if (!k) return { ok: false, error: 'The PIN could not be set up.' };
  await writeSecurity(sec);
  keep(k);
  return { ok: true };
}

/** @param {Msg} m @returns {Promise<Reply>} */
async function unlock(m) {
  const r = await checkPin(m['pin']);
  if (!('key' in r)) return r;
  keep(/** @type {CryptoKey} */ (r.key));
  return { ok: true };
}

/**
 * Seal a private note and store it in the same queued step (R3), so a PIN change can
 * never come between the two and leave the note under the old key.
 * `id` null adds a note; a string edits that one (a plain note may become private).
 * @param {Msg} m @returns {Promise<Reply>}
 */
async function saveNote(m) {
  const k = liveKey();
  if (!k) return { ok: false, locked: true };
  const enc = await sealNote(k, { title: text(m['title'], NOTE_TITLE_MAX), body: text(m['body'], NOTE_BODY_MAX) });
  const fields = { enc, category: CATEGORIES.find((c) => c === m['category']), day: typeof m['day'] === 'string' ? m['day'] : null };
  const id = m['id'];
  if (typeof id !== 'string') return { ok: true, note: await createNote(fields) };
  const note = await updateNote(id, fields);
  return note ? { ok: true, note } : { ok: false, gone: true };
}

/** @param {Msg} m @returns {Promise<Reply>} */
async function decryptNotes(m) {
  const k = liveKey();
  if (!k) return { ok: false, locked: true };
  /** @type {Record<string, import('../lib/crypto.js').Plain | null>} */
  const plain = {};
  for (const item of (Array.isArray(m['items']) ? m['items'] : []).slice(0, DECRYPT_MAX)) {
    const id = typeof item?.id === 'string' ? item.id : '';
    const enc = coerceCipher(item?.enc);
    if (!id) continue;
    plain[id] = enc ? await openNote(k, enc).catch(() => null) : null;
  }
  return { ok: true, plain };
}

/**
 * Every private note opened with `from` and sealed with `to` (with `to` null: made plain).
 * One that cannot be opened throws, so the write it is part of never happens.
 * @param {Note[]} notes @param {CryptoKey} from @param {CryptoKey | null} to @returns {Promise<Note[]>}
 */
async function resealAll(notes, from, to) {
  /** @type {Note[]} */
  const out = [];
  for (const n of notes) {
    if (!n.enc) { out.push(n); continue; }
    const plain = await openNote(from, n.enc).catch(() => { throw new Error('A private note could not be read, so nothing was changed.'); });
    out.push(to ? { ...n, enc: await sealNote(to, plain) } : { ...n, ...plain, enc: null });
  }
  return out;
}

/** Re-encrypt (or decrypt) every private note in one locked write. @param {CryptoKey} from @param {CryptoKey | null} to @param {Record<string, unknown>} also */
const rekey = (from, to, also) => transformNotes(async (notes) => ({ notes: await resealAll(notes, from, to), also }));

/** @param {Msg} m @returns {Promise<Reply>} */
async function changePin(m) {
  if (!isValidPin(m['next'])) return { ok: false, error: 'The new PIN must be 4 to 8 digits.' };
  const r = await checkPin(m['pin']);
  if (!('key' in r)) return r;
  const sec = await createSecurity(m['next']);
  const next = await verify(m['next'], sec);
  if (!next) return { ok: false, error: 'The new PIN could not be set up.' };
  await rekey(/** @type {CryptoKey} */ (r.key), next, { [KEY]: sec });
  keep(next);
  return { ok: true };
}

/** Private notes become plain first, then the record goes: a stop in between loses nothing. @param {Msg} m @returns {Promise<Reply>} */
async function removePin(m) {
  const r = await checkPin(m['pin']);
  if (!('key' in r)) return r;
  await rekey(/** @type {CryptoKey} */ (r.key), null, {});
  await chrome.storage.local.remove(KEY);
  lock();
  return { ok: true };
}

/**
 * @typedef {object} ImportPlan  what an import writes, worked out before the write (R6)
 * @property {boolean} replace         the file's notes replace mine
 * @property {Note[]} incoming         the file's notes, private ones sealed under `key`
 * @property {CryptoKey | null} reseal my private notes move from this key to `key` ('theirs')
 * @property {Security | null} security the file's record, adopted
 * @property {CryptoKey} key           the key of the PIN that wins
 */

/**
 * The file's key. My own backup (the same salt and verifier as my record) is my PIN, so it
 * goes through the lockout like any other try at my PIN (T7-I1); another file's PIN is not
 * counted: the file is offline anyway.
 * @param {Msg} m @param {Security} sec @param {boolean} same @returns {Promise<{ ok: true, key: CryptoKey } | Reply>}
 */
async function fileKey(m, sec, same) {
  if (same) return checkPin(m['pin']);
  const k = isValidPin(m['pin']) ? await verify(m['pin'], sec) : null;
  return k ? { ok: true, key: k } : { ok: false, error: 'That isn’t the PIN the file’s private notes were locked with.' };
}

/**
 * Open a backup's private notes with the file's PIN and seal them under the PIN that
 * wins (D11, F7). No PIN here, or Replace: the file's record is adopted, counters reset
 * (ForgetMeNot's rule). Merge with a different PIN here: `keep` says which wins (spec §4,
 * mine unless 'theirs'), my PIN is checked through the lockout, and 'theirs' moves my private
 * notes to the file's PIN too. My own backup writes no record. Nothing is written here.
 * @param {Msg} m @returns {Promise<Reply | { ok: true, plan: ImportPlan }>}
 */
async function planImport(m) {
  const sec = coerceSecurity(m['security']);
  if (!sec) return { ok: false, error: 'The file’s PIN record is damaged, so its private notes can’t be opened.' };
  if (tooMany(m['notes'], m['sealed'])) return { ok: false, error: 'The file holds more than 10,000 notes, so nothing was imported.' };
  const replace = m['mode'] === 'replace';
  if (!replace && await damagedRecord()) return { ok: false, error: 'Your PIN record is damaged, so this file’s private notes can’t be imported without losing your private notes.' };
  const local = await readSecurity();
  const same = local !== null && local.salt === sec.salt && local.verifier.ct === sec.verifier.ct;
  const f = await fileKey(m, sec, same);
  if (!('key' in f)) return f;
  const theirs = /** @type {CryptoKey} */ (f.key);
  /** @type {CryptoKey | null} */
  let mine = null;
  if (local && !same && !replace) {
    const r = await checkPin(m['localPin']);
    if (!('key' in r)) return r;
    mine = /** @type {CryptoKey} */ (r.key);
  }
  const key = !mine || m['keep'] === 'theirs' ? theirs : mine;
  const sealed = await sealedFrom(m['sealed'], theirs, key);
  if (!sealed) return { ok: false, error: 'A private note in the file could not be opened, so nothing was imported.' };
  const security = !same && key === theirs ? afterSuccess(sec) : null;
  return { ok: true, plan: { replace, incoming: [...plainFrom(m['notes']), ...sealed], reseal: mine && key === theirs ? mine : null, security, key } };
}

/**
 * Bring a backup in with its private notes: tasks, settings, activity, notes and the
 * record in one write (W1, via writeBackup's locks), or nothing is written.
 * @param {Msg} m @returns {Promise<Reply>}
 */
async function importBackup(m) {
  const r = await planImport(m);
  if (!('plan' in r)) return r;
  const p = /** @type {ImportPlan} */ (r.plan);
  const ours = new Set();  // our own refusals are already in words; only a raw storage error gets the prefix
  const mineFailed = () => { const x = new Error('One of your private notes could not be opened, so nothing was imported.'); ours.add(x); throw x; };
  const from = p.reseal;
  try {
    const added = await writeBackup(m, p.replace ? 'replace' : 'merge', { incoming: p.incoming, security: p.security,
      reseal: from ? (mine) => resealAll(mine, from, p.key).catch(mineFailed) : null });
    keep(p.key);
    return { ok: true, added: added.notes, tasks: added.tasks, days: added.days };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? (ours.has(e) ? e.message : `Nothing was imported: ${e.message}`) : String(e) };
  }
}

/** @type {Record<string, (m: Msg) => Promise<Reply>>} */
const OPS = {
  'crypto:status': status, 'crypto:setPin': setPin, 'crypto:changePin': changePin, 'crypto:removePin': removePin,
  'crypto:unlock': unlock, 'crypto:lock': async () => { lock(); return { ok: true }; },
  'crypto:save': saveNote, 'crypto:decrypt': decryptNotes, 'crypto:import': importBackup,
};

// After these succeed, open pages re-ask crypto:status and hide or show private notes.
// The broadcast carries no PIN, key or text; with no page open, sendMessage rejects, which is fine.
const CHANGES = new Set(['crypto:setPin', 'crypto:changePin', 'crypto:removePin', 'crypto:unlock', 'crypto:lock', 'crypto:import']);
/** @param {string} type @param {Reply} r */
function announce(type, r) {
  if (r.ok && CHANGES.has(type)) chrome.runtime.sendMessage({ type: 'crypto:changed' }).catch(() => undefined);
  return r;
}

/**
 * Answer one crypto:* message, after every earlier one.
 * @param {unknown} msg @param {chrome.runtime.MessageSender} sender @returns {Promise<Reply>}
 */
export function handle(msg, sender) {
  const m = /** @type {Msg} */ (typeof msg === 'object' && msg !== null ? msg : {});
  const type = String(m['type']);
  const op = Object.hasOwn(OPS, type) ? OPS[type] : undefined;
  const run = async () => (!isOwnPage(sender) ? { ok: false, error: 'Not allowed.' }
    : op ? announce(type, await op(m)) : { ok: false, error: 'Unknown request.' });
  const p = queue.then(run);
  queue = p.catch(() => undefined);
  return p;
}
