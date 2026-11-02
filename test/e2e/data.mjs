// Import of the three formats (D11, F7; spec §4 Import, §6), from real backup files made by
// Daybook and ForgetMeNot (test/fixtures). sw.evaluate callbacks use only chrome.*, built-ins and their argument (R1).
import fs from 'fs';
const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url).pathname;
const FMN = JSON.parse(fs.readFileSync(fixture('forgetmenot-backup.json'), 'utf8'));
const DAYBOOK = ['Renew the SSL certificate', 'Book the team offsite', 'Read the Raft paper'];

const choose = async (rep, wait, path) => { await rep.setInputFiles('#import', path); await wait(700); };
const go = async (rep, wait) => { await rep.click('#importGo'); await wait(1500); };
/** Private notes opened by the worker's current key, from the report page (an extension page may ask). */
const opened = (rep) => rep.evaluate(async () => {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const items = notes.filter((n) => n.enc).map((n) => ({ id: n.id, enc: n.enc }));
  return Object.values((await chrome.runtime.sendMessage({ type: 'crypto:decrypt', items })).plain ?? {});
});

export async function daybookImportChecks(t, rep) {
  const { check, store, wait } = t;
  await choose(rep, wait, fixture('daybook-backup.json'));
  const what = await rep.textContent('#importWhat');
  check('Import', 'a Daybook backup: the panel says what it holds before anything is written (D11)', what === 'A Daybook backup: 3 tasks.'
    && !(await store()).tasks.some((x) => x.title === DAYBOOK[0]) && (await rep.textContent('#replaceLabel')) === 'Replace my tasks with the file’s', what);
  await go(rep, wait);
  const titles = (await store()).tasks.map((x) => x.title);
  check('Import', 'Add brings its tasks in, done and due dates kept (D11)', DAYBOOK.every((x) => titles.includes(x)) && /Imported 0 days of activity, 3 tasks and 0 notes/.test(await rep.textContent('#settingsMsg'))
    && (await store()).tasks.find((x) => x.title === DAYBOOK[1])?.status === 'done', await rep.textContent('#settingsMsg'));
  await choose(rep, wait, fixture('daybook-backup.json')); await go(rep, wait);
  check('Import', 'the same backup again adds nothing: tasks match by id', (await store()).tasks.filter((x) => x.title === DAYBOOK[0]).length === 1 && /0 tasks/.test(await rep.textContent('#settingsMsg')));
}

export async function forgetMeNotImportChecks(t, rep) {
  const { check, store, wait } = t;
  await choose(rep, wait, fixture('forgetmenot-backup.json'));
  const { unlabeled } = await import('./panel.mjs');
  check('Import', 'a ForgetMeNot export asks for the PIN its private note was locked with (F7)', (await rep.textContent('#importWhat')) === 'A ForgetMeNot backup: 3 notes (1 private).'
    && await rep.isVisible('#importPin') && !(await rep.isVisible('#importLocalPin')) && (await unlabeled(rep)).length === 0, (await unlabeled(rep)).join(', '));
  await rep.fill('#importPin', '9999'); await go(rep, wait);
  check('Import', 'a wrong PIN is refused in words; nothing is written', /isn’t the PIN/.test(await rep.textContent('#settingsMsg')) && await rep.isVisible('#importPanel')
    && !(await store()).notes.some((n) => n.title === 'Vendor call') && !(await store()).security, await rep.textContent('#settingsMsg'));
  await rep.fill('#importPin', '1234'); await go(rep, wait);
  const st = await store();
  const plain = await opened(rep);
  check('Import', 'the right PIN brings its notes in; the private one is sealed again, title inside, under its PIN (F7, F8)', st.notes.some((n) => n.title === 'Vendor call' && n.pinned)
    && st.security?.salt === FMN.security.salt && !JSON.stringify(st.notes).includes('10% raise') && st.notes.filter((n) => n.enc).every((n) => !n.title && !n.body) && plain.some((p) => p?.title === 'Salary talk' && /10% raise/.test(p.body)), JSON.stringify(plain));
}

// Export carries the PIN record; a browser whose PIN has changed since takes the file's private note under its own PIN.
export async function pinImportChecks(t, rep) {
  const { sw, check, store, wait, S } = t;
  const [dl] = await Promise.all([rep.waitForEvent('download'), rep.click('#export')]);
  const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check('Data', 'export carries the PIN record (a salt and check value, never the PIN) and private notes as ciphertext (F7)', exported.security?.salt === FMN.security.salt
    && await rep.isVisible('#exportPinHint')
    && !JSON.stringify(exported.security).includes('"1234"') && exported.notes.some((n) => n.enc) && !JSON.stringify(exported).includes('10% raise'));
  const file = S + '/with-pin.json'; fs.writeFileSync(file, JSON.stringify(exported));
  await rep.evaluate(() => chrome.runtime.sendMessage({ type: 'crypto:changePin', pin: '1234', next: '5678' }));
  await sw.evaluate(() => chrome.storage.local.get('notes').then(({ notes }) => chrome.storage.local.set({ notes: notes.filter((n) => !n.enc) })));
  const mySalt = (await store()).security.salt;
  await choose(rep, wait, file);
  check('Import', 'with a different PIN here, it asks for mine too and which PIN to keep (spec §4)', await rep.isVisible('#importLocalPin') && await rep.isChecked('input[name=importKeep][value=mine]'));
  await rep.fill('#importPin', '1234'); await rep.fill('#importLocalPin', '5678'); await go(rep, wait);
  const plain = await opened(rep);
  check('Import', 'keep mine: the file’s private note comes back under my PIN; my PIN record stays', (await store()).security.salt === mySalt
    && plain.length === 1 && plain[0]?.title === 'Salary talk', `${await rep.textContent('#settingsMsg')} ${JSON.stringify(plain)}`);
}

// Replace swaps only what a file carries. The run ends with no PIN, as before (delete-all keeps the record).
export async function replaceImportChecks(t, rep) {
  const { check, store, wait } = t;
  const notesBefore = (await store()).notes.length;
  // Replace asks first (m-R). Dismissing writes nothing and says nothing; accepting goes ahead (full.mjs's own handler accepts).
  await choose(rep, wait, fixture('daybook-backup.json'));
  await rep.check('input[name=importMode][value=replace]');
  rep.removeAllListeners('dialog');
  let asked = '';
  rep.once('dialog', (d) => { asked = d.message(); void d.dismiss(); });
  const tasksBefore = JSON.stringify((await store()).tasks);
  await go(rep, wait);
  check('Import', 'Replace asks first; Cancel writes nothing and says nothing (m-R)', asked === 'Replace your tasks with the file’s? This can’t be undone.'
    && JSON.stringify((await store()).tasks) === tasksBefore && (await rep.textContent('#settingsMsg')) === '' && await rep.isVisible('#importPanel'), asked);
  rep.on('dialog', (d) => { void d.accept(); });
  await go(rep, wait);
  const st = await store();
  check('Import', 'Replace with a Daybook backup swaps the tasks for the file’s and leaves notes alone (D11)', st.tasks.map((x) => x.title).join('|') === DAYBOOK.join('|')
    && st.notes.length === notesBefore, `${st.tasks.length} ${st.notes.length}/${notesBefore}`);
  await choose(rep, wait, fixture('forgetmenot-backup.json'));
  await rep.check('input[name=importMode][value=replace]'); await wait(200);
  const asksMine = await rep.isVisible('#importLocalPin');
  await rep.fill('#importPin', '1234'); await go(rep, wait);
  const s2 = await store();
  check('Import', 'Replace with a ForgetMeNot export: the notes become the file’s and its PIN wins (F7)', !asksMine && s2.notes.map((n) => n.id).sort().join() === FMN.notes.map((n) => n.id).sort().join()
    && s2.security.salt === FMN.security.salt, s2.notes.map((n) => n.id).join());
  await rep.evaluate(() => chrome.runtime.sendMessage({ type: 'crypto:removePin', pin: '1234' })); await wait(300);
}
