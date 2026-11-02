// Private notes in a page (F3, F8). The key never comes here: the page asks the
// worker (crypto:* messages) to unlock, seal and store, and open. Unlocked words are kept
// only in this page's memory, keyed by ciphertext, and forgotten on Lock, when
// the worker reports it is locked, or after 5 minutes without a private-note action.

/** @typedef {import('../../lib/notes.js').Note} Note */
/** @typedef {import('../../lib/notes.js').Plain} Plain */
/** @typedef {{ ok: boolean, error?: string, locked?: boolean, lockedUntil?: number, failedAttempts?: number } & Record<string, any>} Reply */

const IDLE_MS = 5 * 60_000;
/** @type {Map<string, Plain>} keyed by note id and IV, so an edit elsewhere is opened afresh */
const cache = new Map();
const state = { hasPin: false, unlocked: false };
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;
/** @type {Set<() => void>} */
const listeners = new Set();

/** @param {string} type @param {Record<string, unknown>} [payload] @returns {Promise<Reply>} */
export async function ask(type, payload = {}) {
  try {
    return (await chrome.runtime.sendMessage({ type, ...payload })) ?? { ok: false, error: 'Weekly’s background worker did not answer.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** A reply in plain words. @param {Reply} r */
export function explain(r) {
  if (r.locked) return 'Private notes are locked. Unlock them and try again.';
  if (r.lockedUntil && r.lockedUntil > Date.now()) return `Too many wrong PINs. Try again in ${Math.ceil((r.lockedUntil - Date.now()) / 1000)} s.`;
  return r.error ?? 'Something went wrong.';
}

const changed = () => listeners.forEach((cb) => cb());
function forget() {
  cache.clear();
  state.unlocked = false;
  clearTimeout(timer);
}
/** Each private-note action restarts the page's 5-minute clock; the worker keeps its own. */
function touch() {
  clearTimeout(timer);
  timer = setTimeout(() => { forget(); changed(); }, IDLE_MS);
}

/** @param {Note} n @returns {Plain | null} */
export const plainOf = (n) => (n.enc && state.unlocked ? cache.get(`${n.id}:${n.enc.iv}`) ?? null : null);
export const pinState = () => ({ ...state });
/** @param {() => void} cb */
export const onPrivateChange = (cb) => { listeners.add(cb); };

/** Ask the worker where things stand; forget everything if it is locked. */
export async function sync() {
  const r = await ask('crypto:status');
  state.hasPin = r.hasPin === true;
  if (r.unlocked === true) state.unlocked = true;
  else if (state.unlocked) { forget(); changed(); }   // the worker dropped the key: redraw, close a private editor
  else forget();
  return state;
}

/** @param {string} pin @returns {Promise<Reply>} */
export async function unlock(pin) {
  const r = await ask('crypto:unlock', { pin });
  if (r.ok) { state.unlocked = true; touch(); }
  return r;
}

export async function lock() {
  forget();
  changed();
  await ask('crypto:lock');
}

/** Open every private note not opened yet. @param {Note[]} notes */
export async function openAll(notes) {
  const items = notes.filter((n) => n.enc && !plainOf(n)).map((n) => ({ id: n.id, enc: n.enc }));
  if (!state.unlocked || !items.length) return;
  const r = await ask('crypto:decrypt', { items });
  if (!state.unlocked) return;   // Lock came while the worker was decrypting: keep nothing
  if (!r.ok) { forget(); changed(); return; }
  for (const n of notes) {
    const p = n.enc ? r['plain']?.[n.id] : null;
    if (n.enc && p) cache.set(`${n.id}:${n.enc.iv}`, p);
  }
  touch();
}

/**
 * Seal and store a private note in one worker step (crypto:save), so a PIN change
 * cannot come in between. `note` on success; `locked` or `gone` when not stored.
 * @param {string | null} id null adds a note @param {Plain} p @param {{ category: string, day: string | null }} fields
 * @returns {Promise<Reply>}
 */
export async function store(id, p, fields) {
  const r = await ask('crypto:save', { id, title: p.title, body: p.body, category: fields.category, day: fields.day });
  if (r.ok) touch(); else if (r.locked) { forget(); changed(); }
  return r;
}

// The worker announces set, unlock, lock, change and remove; every open page re-syncs.
// A message from a tab (a content script on a web page) is never the worker: ignore it.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.tab) return false;
  if (/** @type {{ type?: unknown }} */ (msg)?.type === 'crypto:changed') void sync().then(changed);
  return false;
});
