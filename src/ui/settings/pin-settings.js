// Settings → Notes PIN (spec §3.2; F3): set, change, remove. Not saved with the
// form: each button asks the worker at once, which alone holds the key and writes
// the PIN record. The PIN fields are cleared after every try.
import { $ } from '../components/dom.js';
import { ask, explain } from '../components/private.js';

async function show() {
  const s = await ask('crypto:status');
  $('#pinState').textContent = s.hasPin ? 'A PIN is set. Private notes are encrypted with it.' : 'No PIN yet. Set one to keep private notes.';
  $('#pinCurrent').closest('label').hidden = !s.hasPin;
  $('#pinSet').hidden = !!s.hasPin;
  $('#pinChange').hidden = $('#pinRemove').hidden = !s.hasPin;
}

async function run(type, payload, ok) {
  const btns = ['#pinSet', '#pinChange', '#pinRemove'].map((s) => $(s));
  btns.forEach((b) => { b.disabled = true; });   // one check at a time: no double count of a wrong PIN
  const r = await ask(type, payload);
  btns.forEach((b) => { b.disabled = false; });
  $('#pinCurrent').value = ''; $('#pinNew').value = '';
  $('#pinMsg').textContent = r.ok ? ok : explain(r);
  await show();
}

export function init() {
  $('#pinSet').onclick = () => run('crypto:setPin', { pin: $('#pinNew').value }, 'PIN set. Tick “Private” on a note to lock it.');
  $('#pinChange').onclick = () => run('crypto:changePin', { pin: $('#pinCurrent').value, next: $('#pinNew').value }, 'PIN changed. Private notes now open with the new one.');
  // Typing the current PIN is the confirmation: nobody removes it by a stray click.
  $('#pinRemove').onclick = () => run('crypto:removePin', { pin: $('#pinCurrent').value }, 'PIN removed. Your private notes are ordinary notes now.');
  // Only the worker announces a change; a message from a tab (a content script) is ignored.
  chrome.runtime.onMessage.addListener((msg, sender) => { if (!sender.tab && msg?.type === 'crypto:changed') void show(); return false; });
  void show();
}
