// The quiet notices on the report page: sample week, tracking off, and the backup nudge.
import { $ } from '../components/dom.js';
import { msg } from '../components/msg.js';
import { allowTracking } from '../../lib/activity/status.js';
import { needsBackupNudge, backupLabel } from '../../lib/last-backup.js';
import { load } from './main.js';

export function renderNotices(W) {
  $('#sampleBanner').hidden = !W.sample;
  const off = W.tracking === false;
  $('#trackingBanner').hidden = !off;
  $('#notesSection').classList.toggle('prominent', off);
  const nudge = !W.sample && needsBackupNudge(W.lastExportAt, W.hasData);
  $('#backupNudge').hidden = !nudge;
  if (nudge) msg('#backupText', `${W.lastExportAt ? `Your last backup was ${backupLabel(W.lastExportAt)}.` : 'You haven’t backed up yet.'} Weekly keeps your data only in this Chrome profile.`);
}

export function init() {
  // allowTracking() is the first call in the click: Chrome only asks during a user gesture.
  $('#trackOn').onclick = () => allowTracking()
    .then(ok => ok ? load(false) : msg('#trackMsg', 'Chrome didn’t allow that, so tracking is still off.'))
    .catch(e => msg('#trackMsg', `Couldn’t ask for access (${e.message}).`));
}
