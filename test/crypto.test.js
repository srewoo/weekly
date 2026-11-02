// PIN crypto primitives (F3), ported from ForgetMeNot's crypto.test.mjs and
// extended: PINs of 4 to 8 digits, ForgetMeNot's verifier still accepted, the
// note sealed as one {title, body} blob, the security record validated, and the
// lockout steps as pure transitions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

globalThis.crypto ??= /** @type {Crypto} */ (/** @type {unknown} */ (webcrypto));
const C = await import('../src/lib/crypto.js');

test('isValidPin accepts 4 to 8 digits only', () => {
  for (const ok of ['1234', '0000', '12345678']) assert.equal(C.isValidPin(ok), true, ok);
  for (const bad of ['123', '123456789', '12a4', ' 1234', 1234, null]) assert.equal(C.isValidPin(bad), false, String(bad));
});

test('encrypt/decrypt round-trips arbitrary text; each encryption has a fresh IV', async () => {
  const key = await C.verify('4242', await C.createSecurity('4242'));
  assert.ok(key, 'verify returns a key for the right PIN');
  const secret = 'my private note\nwith unicode ✓ 日本語 and emoji 🔒';
  const a = await C.encrypt(key, secret);
  const b = await C.encrypt(key, secret);
  assert.notEqual(a.ct, secret);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ct, b.ct);
  assert.equal(await C.decrypt(key, a), secret);
});

test('createSecurity refuses an invalid PIN', async () => {
  await assert.rejects(() => C.createSecurity(''));
  await assert.rejects(() => C.createSecurity('12'));
});

test('verify returns null for a wrong PIN or a malformed record', async () => {
  const sec = await C.createSecurity('1234');
  assert.equal(await C.verify('9999', sec), null);
  assert.equal(await C.verify('0000', sec), null);
  assert.ok(await C.verify('1234', sec));
  assert.equal(await C.verify('1234', null), null);
  assert.equal(await C.verify('1234', /** @type {any} */ ({ salt: 'x' })), null);
});

test('decrypt throws on the wrong key and on tampered ciphertext', async () => {
  const keyA = await C.verify('1234', await C.createSecurity('1234'));
  const keyB = await C.verify('5678', await C.createSecurity('5678'));
  assert.ok(keyA && keyB);
  const blob = await C.encrypt(keyA, 'top secret');
  await assert.rejects(() => C.decrypt(keyB, blob));
  await assert.rejects(() => C.decrypt(keyA, { iv: blob.iv, ct: (blob.ct[0] === 'A' ? 'B' : 'A') + blob.ct.slice(1) }));
});

test('the security record is PIN-free: salt, iterations and a verifier only', async () => {
  const sec = await C.createSecurity('7391');
  assert.deepEqual(Object.keys(sec).sort(), ['createdAt', 'failedAttempts', 'iterations', 'lockedUntil', 'salt', 'verifier', 'version']);
  assert.equal(sec.iterations, 310000);
  assert.equal(C.PBKDF2_ITERATIONS, 310000);
  const { createdAt, ...rest } = sec;
  assert.equal(JSON.stringify(rest).includes('7391'), false, 'the PIN appears nowhere in what is stored');
  const again = await C.createSecurity('7391');
  assert.notEqual(again.salt, sec.salt, 'a fresh salt each time');
  assert.notEqual(again.verifier.ct, sec.verifier.ct);
});

test('a ForgetMeNot record (its own verifier text) unlocks with its PIN', async () => {
  const sec = await C.createSecurity('2468');
  const key = await C.verify('2468', sec);
  assert.ok(key);
  const fmn = { ...sec, verifier: await C.encrypt(key, 'forgetmenot.verifier.v1') };
  assert.ok(await C.verify('2468', fmn));
  const other = { ...sec, verifier: await C.encrypt(key, 'something else') };
  assert.equal(await C.verify('2468', other), null);
});

test('coerceSecurity rejects junk and a weakened work factor', async () => {
  const sec = await C.createSecurity('1234');
  assert.deepEqual(C.coerceSecurity(structuredClone(sec)), sec);
  assert.equal(C.coerceSecurity(null), null);
  assert.equal(C.coerceSecurity({ ...sec, iterations: 1 }), null, 'an imported record cannot lower PBKDF2 to nothing');
  assert.equal(C.coerceSecurity({ ...sec, salt: '<script>' }), null);
  assert.equal(C.coerceSecurity({ ...sec, salt: 'AAAA' }), null, 'a 3-byte salt is too short');
  assert.equal(C.coerceSecurity({ ...sec, failedAttempts: 5.5 })?.failedAttempts, 0, 'a fractional count becomes 0');
  assert.equal(C.coerceSecurity({ ...sec, verifier: { iv: 'x' } }), null);
  assert.deepEqual(C.coerceSecurity({ ...sec, failedAttempts: -3, lockedUntil: 'soon' }), { ...sec, failedAttempts: 0, lockedUntil: 0 });
});

test('lockout: 5 failures → 30 s, then 1 m, 5 m, 15 m; success resets (F3)', async () => {
  assert.deepEqual([0, 4, 5, 6, 7, 8, 50].map(C.lockoutFor), [0, 0, 30e3, 60e3, 300e3, 900e3, 900e3]);
  let sec = await C.createSecurity('1234');
  const t0 = 1_000_000;
  const waits = [];
  for (let i = 1; i <= 8; i++) {
    sec = C.afterFailure(sec, t0);
    waits.push(C.lockedFor(sec, t0));
  }
  assert.deepEqual(waits, [0, 0, 0, 0, 30e3, 60e3, 300e3, 900e3]);
  assert.equal(C.lockedFor(sec, t0 + 900e3), 0, 'the lock ends on time');
  const bad = { ...sec, lockedUntil: 1e300 };
  assert.equal(C.lockedFor(bad, t0), 0, 'a corrupt lockedUntil is treated as expired');
  assert.equal(C.lockedFor(bad, t0 + 900e3 + 1), 0);
  sec = C.afterSuccess(sec);
  assert.deepEqual([sec.failedAttempts, sec.lockedUntil], [0, 0]);
});

test('sealNote/openNote keep title and body together; a ForgetMeNot body-only blob still opens', async () => {
  const key = await C.verify('1234', await C.createSecurity('1234'));
  assert.ok(key);
  const enc = await C.sealNote(key, { title: 'Salary talk', body: 'Ask for 10%' });
  assert.equal(enc.ct.includes('Salary'), false);
  assert.deepEqual(await C.openNote(key, enc), { title: 'Salary talk', body: 'Ask for 10%' });
  const big = await C.encrypt(key, JSON.stringify({ title: 't'.repeat(500), body: 'b'.repeat(30000) }));
  const clamped = await C.openNote(key, big);
  assert.deepEqual([clamped.title.length, clamped.body.length], [200, 20000], 'a crafted cipher cannot exceed the note limits');
  assert.deepEqual(await C.openNote(key, await C.encrypt(key, 'just a body'), 'Old title'), { title: 'Old title', body: 'just a body' });
});

test('base64 helpers round-trip bytes', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
  assert.deepEqual(Array.from(C.b64ToBytes(C.bytesToB64(bytes))), Array.from(bytes));
});
