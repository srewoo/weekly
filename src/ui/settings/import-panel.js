// Settings → Your data → Import (D11, F7): choose a Weekly export, a Daybook backup
// or a ForgetMeNot export; see what it holds and what is left out; Add or Replace;
// give the PINs its private notes need. Nothing is written until Import is pressed.
import { $, $$ } from '../components/dom.js';
import { openBackup, applyBackup } from '../../lib/portability.js';
import { describeBackup, replaces } from '../../lib/backup.js';
import { ask } from '../components/private.js';
import { msg } from '../components/msg.js';

/** The file read and accepted, waiting for Import or Cancel. */
let pending = null;
let hasPin = false;

const mode = () => $('input[name=importMode]:checked').value;
const words = (e) => (e instanceof Error ? e.message : String(e));
const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

// The file's PIN when it has private notes; yours too when you have a PIN and are adding to what's here.
function showPins() {
  const priv = !!(pending?.sealed.length && pending.security);
  $('#importPins').hidden = !priv;
  $('#importMine').hidden = !(priv && hasPin && mode() === 'merge');
}

function close() {
  pending = null;
  $('#importPanel').hidden = true;
  $('#importPin').value = $('#importLocalPin').value = '';
}

async function choose(file) {
  close();
  try { pending = await openBackup(file); } catch (e) { msg('#settingsMsg', words(e)); return; }
  hasPin = !!(await ask('crypto:status')).hasPin;
  $('#importWhat').textContent = describeBackup(pending).join(' ');
  const what = replaces(pending);
  $('#replaceLabel').textContent = `Replace my ${what} with the file’s`;
  // A file of activity only has nothing to replace: Add is the one choice.
  $('input[name=importMode][value=replace]').closest('label').hidden = !what;
  $('input[name=importMode][value=merge]').checked = true;
  $('input[name=importKeep][value=mine]').checked = true;
  msg('#settingsMsg', '');
  $('#importPanel').hidden = false;
  showPins();
}

async function go() {
  const btn = $('#importGo');
  if (!pending || btn.disabled) return;
  if (mode() === 'replace' && !confirm(`Replace your ${replaces(pending)} with the file’s? This can’t be undone.`)) return;
  btn.disabled = true;   // one try at a time: two clicks never count two wrong PINs
  try {
    const r = await applyBackup(pending, { mode: mode(), pin: $('#importPin').value, localPin: $('#importLocalPin').value,
      keep: $('input[name=importKeep]:checked').value });
    close();
    msg('#settingsMsg', `Imported ${count(r.days, 'day')} of activity, ${count(r.tasks, 'task')} and ${count(r.notes, 'note')}.`);
  } catch (e) { msg('#settingsMsg', words(e)); }
  finally { btn.disabled = false; }
}

export function init() {
  $('#importBtn').onclick = () => $('#import').click();
  $('#import').onchange = e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) void choose(f);
  };
  $('#importGo').onclick = () => void go();
  $('#importCancel').onclick = () => { close(); msg('#settingsMsg', 'Nothing was imported.'); };
  $$('input[name=importMode]').forEach(i => i.addEventListener('change', showPins));
}
