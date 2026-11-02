/**
 * PIN crypto for private notes (F3), ported from ForgetMeNot's crypto.js as an ES module.
 * Pure WebCrypto (PBKDF2 + AES-GCM): no network, no dependencies, no chrome.*.
 *
 * - A PIN is stretched with PBKDF2-SHA256 (310,000 rounds) into a non-extractable
 *   256-bit AES-GCM key. The PIN itself is never stored.
 * - What is stored is a random salt, the round count and a verifier: a fixed
 *   sentinel encrypted with the derived key. A wrong PIN gives a different key,
 *   AES-GCM authentication fails on the verifier, and the PIN is rejected.
 * - Every encryption uses a fresh random 96-bit IV.
 * - Key lifetime, lockout bookkeeping and message routing live in the worker
 *   (src/background/crypto-broker.js); this module only computes.
 */

import { NOTE_BODY_MAX, NOTE_TITLE_MAX } from './note-views.js';

export const PBKDF2_ITERATIONS = 310000;
// A record may not lower the work factor below this (an imported file is untrusted).
const MIN_ITERATIONS = 100000;
const MAX_ITERATIONS = 5000000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VERIFIER_TEXT = 'weekly.verifier.v1';
// ForgetMeNot's sentinel: its security record keeps working when its backup is imported (Phase 5).
const VERIFIERS = new Set([VERIFIER_TEXT, 'forgetmenot.verifier.v1']);

/** @typedef {import('./note-views.js').Cipher} Cipher */
/** @typedef {import('./note-views.js').Plain} Plain */
/**
 * The persisted PIN record: never the PIN, nothing a wrong PIN can open.
 * @typedef {{ version: number, salt: string, iterations: number, verifier: Cipher,
 *   failedAttempts: number, lockedUntil: number, createdAt: number }} Security
 */

/** @param {Uint8Array | ArrayBuffer} input */
export function bytesToB64(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** @param {string} b64 */
export function b64ToBytes(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

/** A PIN is 4 to 8 digits (ForgetMeNot's were 4, so theirs still fit). @param {unknown} pin @returns {pin is string} */
export const isValidPin = (pin) => typeof pin === 'string' && /^\d{4,8}$/.test(pin);

/** @param {string} pin @param {string} salt @param {number} iterations @returns {Promise<CryptoKey>} */
export async function deriveKey(pin, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64ToBytes(salt), iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** @param {CryptoKey} key @param {string} text @returns {Promise<Cipher>} */
export async function encrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { iv: bytesToB64(iv), ct: bytesToB64(ct) };
}

/** Throws when the key is wrong or the data was changed. @param {CryptoKey} key @param {Cipher} blob */
export async function decrypt(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(blob.iv) }, key, b64ToBytes(blob.ct));
  return new TextDecoder().decode(pt);
}

/** A fresh record for a new PIN. @param {string} pin @returns {Promise<Security>} */
export async function createSecurity(pin) {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 to 8 digits');
  const salt = bytesToB64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
  const key = await deriveKey(pin, salt, PBKDF2_ITERATIONS);
  return { version: 1, salt, iterations: PBKDF2_ITERATIONS, verifier: await encrypt(key, VERIFIER_TEXT),
    failedAttempts: 0, lockedUntil: 0, createdAt: Date.now() };
}

/** The derived key for the right PIN, null for a wrong one. @param {string} pin @param {Security | null} sec */
export async function verify(pin, sec) {
  if (!sec?.salt || !sec.verifier) return null;
  try {
    const key = await deriveKey(pin, sec.salt, sec.iterations);
    return VERIFIERS.has(await decrypt(key, sec.verifier)) ? key : null;
  } catch {
    return null;   // AES-GCM authentication failure: a wrong PIN
  }
}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
/** @param {unknown} v @returns {v is string} */
const isB64 = (v) => typeof v === 'string' && v.length <= 512 && B64.test(v);
/** @param {unknown} v */
const count = (v) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0);

/** A salt must decode to at least SALT_BYTES bytes. @param {string} salt */
const saltOk = (salt) => { try { return b64ToBytes(salt).length >= SALT_BYTES; } catch { return false; } };

/** A stored or imported record, validated; null when it cannot be trusted. @param {unknown} raw @returns {Security | null} */
export function coerceSecurity(raw) {
  if (!isObj(raw) || !isB64(raw['salt']) || !saltOk(raw['salt']) || !isObj(raw['verifier'])) return null;
  const { iv, ct } = raw['verifier'];
  const it = raw['iterations'];
  if (!isB64(iv) || !isB64(ct) || !Number.isInteger(it) || /** @type {number} */ (it) < MIN_ITERATIONS || /** @type {number} */ (it) > MAX_ITERATIONS) return null;
  return { version: 1, salt: raw['salt'], iterations: /** @type {number} */ (it), verifier: { iv, ct },
    failedAttempts: count(raw['failedAttempts']), lockedUntil: count(raw['lockedUntil']), createdAt: count(raw['createdAt']) };
}

/** Lock time after `attempts` failures in a row: the first four are free. @param {number} attempts */
export function lockoutFor(attempts) {
  if (attempts < 5) return 0;
  return [30e3, 60e3, 300e3][attempts - 5] ?? 900e3;
}

/** One more wrong PIN. @param {Security} sec @param {number} now @returns {Security} */
export function afterFailure(sec, now) {
  const failedAttempts = sec.failedAttempts + 1;
  const wait = lockoutFor(failedAttempts);
  return { ...sec, failedAttempts, lockedUntil: wait ? now + wait : 0 };
}

/** @param {Security} sec @returns {Security} */
export const afterSuccess = (sec) => ({ ...sec, failedAttempts: 0, lockedUntil: 0 });

/** How long the PIN stays refused, in ms (a gap beyond the longest step is treated as expired, so a bad record cannot lock it for good).  @param {Security} sec @param {number} now */
export function lockedFor(sec, now) {
  const left = sec.lockedUntil - now;
  return left > 900e3 ? 0 : Math.max(0, left);   // longer than any real lock: a corrupt record or a skewed clock
}

/** Encrypt a note's title and body as one blob, so a locked note shows neither (F8). @param {CryptoKey} key @param {Plain} plain */
export const sealNote = (key, plain) => encrypt(key, JSON.stringify({ title: plain.title, body: plain.body }));

/**
 * The reverse of sealNote. ForgetMeNot sealed the body alone and kept the title
 * in plain text; such a blob opens with `title` as the title.
 * @param {CryptoKey} key @param {Cipher} enc @param {string} [title] @returns {Promise<Plain>}
 */
export async function openNote(key, enc, title = '') {
  const text = await decrypt(key, enc);
  try {
    const o = JSON.parse(text);
    if (isObj(o) && typeof o['title'] === 'string' && typeof o['body'] === 'string') return { title: o['title'].slice(0, NOTE_TITLE_MAX), body: o['body'].slice(0, NOTE_BODY_MAX) };
  } catch { /* not JSON: a ForgetMeNot body */ }
  return { title: title.slice(0, NOTE_TITLE_MAX), body: text.slice(0, NOTE_BODY_MAX) };
}
