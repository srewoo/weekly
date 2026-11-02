// The store text and the privacy policy must describe the extension that ships: its version,
// its permissions and what it keeps. Each claim here is checked against the repo, not by eye.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { coerceTask } from '../src/lib/schema.js';
import { coerceNote } from '../src/lib/note-views.js';
import { demoTasks, demoNotes } from '../store-assets/demo-data.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const policy = read('store-assets/privacy-policy.html');
const listing = read('store-assets/store-listing.md');
const manifest = JSON.parse(read('manifest.json'));

test('the privacy policy names this version and the contact address', () => {
  assert.match(policy, new RegExp(`version ${pkg.version.replaceAll('.', '\\.')}\\b`));
  assert.match(policy, /Last updated: \d{1,2} [A-Z][a-z]+ \d{4}/);
  assert.match(policy, /srewoo@gmail\.com/);
});

test('the privacy policy covers Weekly 3: tasks, notes, private notes, the on-page note, tracking off by default, what an export holds', () => {
  for (const words of [/Tasks you add/, /Notes you write/, /PBKDF2-SHA256/, /AES-GCM/, /The PIN itself is never stored/, /Alt\+N/,
    /Tracking is off until you turn it on/, /never the PIN/, /never the Slack webhook/, /Keep export files private/, /kept until you delete them/]) {
    assert.match(policy, words);
  }
});

test('the privacy policy states what Replace, PIN guesses, local storage and the 90-day expiry really do', () => {
  for (const words of [/Replace<\/strong> asks you to confirm[\s\S]{0,200}Replace adopts the file.s PIN record[^.]*private notes on this computer/, /not rate-limited/,
    /your own PIN[^.]*same wait/, /localStorage[^.]*theme/, /saved draft edits and unticked items[^.]*90 days/]) {
    assert.match(policy, words);
  }
  assert.doesNotMatch(policy, /Tracked activity, history estimates and activity imported from another computer are deleted/);
});

test('the privacy policy is dated 2 November 2026, names one contact address and has no em dash', () => {
  assert.match(policy, /Last updated: 2 November 2026/);
  const mails = policy.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
  assert.ok(mails.length > 0 && mails.every((m) => m === 'srewoo@gmail.com'), mails.join());
  assert.doesNotMatch(policy, /—/);
});

test('the privacy policy has none of Weekly 2’s stale lines: no toolbar popup, no 90-day purge of notes', () => {
  assert.doesNotMatch(policy, /popup/i);
  assert.doesNotMatch(policy, /notes and imported records\) is deleted/);
  assert.doesNotMatch(policy, /has no content scripts/);
});

test('the listing is for this version, and its short description is the manifest’s, within 132 characters', () => {
  assert.match(listing, new RegExp(`^Version ${pkg.version.replaceAll('.', '\\.')} `, 'm'));
  assert.ok(manifest.description.length <= 132, `${manifest.description.length} characters`);
  assert.ok(listing.includes(`| ${manifest.description} |`), 'the Basics table carries the manifest description');
});

test('every permission the manifest asks for has a justification, and nothing else has one', () => {
  const asked = [...manifest.permissions, ...manifest.optional_permissions, ...manifest.optional_host_permissions].sort();
  const section = listing.split('## Permission justifications')[1]?.split('\n## ')[0] ?? '';
  const justified = [...section.matchAll(/^\| `([^`]+)`/gm)].map((m) => m[1]).sort();
  assert.deepEqual(justified, asked);
});

test('the listing says tracking is off until the user agrees, quotes Chrome’s prompt, and gives the contact address', () => {
  assert.match(listing, /TRACKING IS OFF UNTIL YOU TURN IT ON/);
  assert.match(listing, /"Read your browsing history"/);
  assert.match(listing, /srewoo@gmail\.com/);
});

test('the listing leads with the outcome, and tells Daybook and ForgetMeNot users how to bring their data across, last', () => {
  const desc = listing.split('## Detailed description')[1].split('## Permission justifications')[0];
  assert.match(desc, /^[^\n]*\n+```\nEvery Friday you open a blank doc/);
  assert.doesNotMatch(manifest.description, /^Tasks, reminders/);
  assert.ok(desc.indexOf('Imports from Daybook (tasks, reminders) and ForgetMeNot (notes)') > desc.indexOf('YOUR DATA STAYS ON YOUR COMPUTER'));
  assert.match(desc, /Import a backup/);
  assert.equal(desc.match(/can't add its note|cannot add its on-page note/g)?.length, 1, 'the LIMITS sentence appears once');
});

/** Width, height and colour type from a PNG's IHDR chunk (colour type 2 is RGB, 6 is RGB with alpha). @param {string} file */
const png = (file) => {
  const b = readFileSync(new URL(`../store-assets/${file}`, import.meta.url));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: b[25] };
};

test('the screenshots are the ones the listing names (the report first), each 1280x800 without alpha; the tiles are their sizes', () => {
  const named = [...listing.matchAll(/`(screenshot-[\w-]+\.png)`/g)].map((m) => m[1]);
  const files = readdirSync(new URL('../store-assets/', import.meta.url)).filter((f) => f.startsWith('screenshot-'));
  assert.deepEqual(files.sort(), [...new Set(named)].sort());
  assert.ok(files.length >= 1 && files.length <= 5);
  assert.match(named[0], /report/, 'the drafted update is the first screenshot');
  for (const f of files) assert.deepEqual(png(f), { w: 1280, h: 800, type: 2 }, f);
  assert.deepEqual(png('promo-small-440x280.png'), { w: 440, h: 280, type: 2 });
  assert.deepEqual(png('promo-marquee-1400x560.png'), { w: 1400, h: 560, type: 2 });
  assert.deepEqual([png('icon-128.png').w, png('icon-128.png').h], [128, 128]);
});

test('the screenshots’ demo week is what Weekly itself would store: every task and note comes back unchanged', () => {
  const friday = '2026-10-30';
  const tasks = demoTasks(friday);
  const notes = demoNotes(friday);
  for (const t of tasks) assert.deepEqual(coerceTask(t), t);
  for (const n of notes) assert.deepEqual(coerceNote(n), n);
  assert.ok(tasks.some((t) => t.repeat) && tasks.some((t) => t.status === 'done') && notes.some((n) => n.day));
});


test('the permission rows make no claim the code cannot back', () => {
  const row = (p) => listing.split('\n').find((x) => x.startsWith(`| \`${p}\``)) ?? '';
  assert.doesNotMatch(row('activeTab'), /or clicks "Note on this page"/);
  assert.doesNotMatch(row('activeTab'), /No host permission is needed/);
  assert.doesNotMatch(row('https://*/*'), /one origin at a time|per origin/);
  assert.doesNotMatch(row('history'), /only with tracking on|not installed/);
});
