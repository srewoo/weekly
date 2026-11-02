// Settings → Your data → Chrome history: fill untracked days, or take the estimates out again.
import { $ } from '../components/dom.js';
import { msg } from '../components/msg.js';
import { fillFromHistory } from '../components/history-fill.js';
import { removeHistoryEstimates } from '../../lib/activity/history.js';

export function init() {
  $('#histFill').onclick = () => fillFromHistory('#settingsMsg');
  $('#histRemove').onclick = async () => {
    await removeHistoryEstimates();
    msg('#settingsMsg', 'History estimates removed and history access turned off.');
  };
}
