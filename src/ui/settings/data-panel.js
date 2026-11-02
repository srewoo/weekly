// Settings → Your data: export (and when it was last done) and delete-everything behind an in-page confirm step.
import { $ } from '../components/dom.js';
import { msg } from '../components/msg.js';
import { dayKey } from '../../lib/week.js';
import { exportAll, deleteActivity } from '../../lib/portability.js';
import { deleteEverything } from '../../lib/task-portability.js';
import { deleteAllNotes } from '../../lib/notes.js';
import { getLastExport, markExported, backupLabel } from '../../lib/last-backup.js';
import { ask } from '../components/private.js';

// H7: an export holds the PIN record, so say so, once, in plain words, while a PIN is set.
async function showPinHint() {
  $('#exportPinHint').hidden = !(await ask('crypto:status'))?.hasPin;
}

const showLastBackup = () => getLastExport().then((ts) => { $('#lastBackup').textContent = `Last backup: ${backupLabel(ts)}`; }, () => {});

async function downloadExport() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' }));
  // Not h(): its href guard rightly refuses blob: URLs, and this anchor never reaches the page.
  const a = Object.assign(document.createElement('a'), { href: url, download: `weekly-export-${dayKey(new Date())}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await markExported();
  await showLastBackup();
}

async function clearAll() {
  $('#clearConfirm').hidden = true;
  await deleteActivity();
  await deleteEverything();
  await deleteAllNotes();
  msg('#settingsMsg', 'All activity, notes and tasks deleted.');
  await showLastBackup();
}

export function init() {
  $('#export').onclick = () => downloadExport().catch(e => msg('#settingsMsg', `Couldn’t export (${e.message}).`));
  // Two steps, in the page: the first click only asks; Cancel has the focus so Enter never deletes.
  $('#clear').onclick = () => { $('#clearConfirm').hidden = false; $('#clearNo').focus(); };
  $('#clearNo').onclick = () => { $('#clearConfirm').hidden = true; $('#clear').focus(); };
  $('#clearYes').onclick = () => clearAll().catch(e => msg('#settingsMsg', `Couldn’t delete everything (${e.message}).`));
  chrome.runtime.onMessage.addListener((m, sender) => { if (!sender.tab && m?.type === 'crypto:changed') void showPinHint(); return false; });
  void showPinHint();
  void showLastBackup();
}
