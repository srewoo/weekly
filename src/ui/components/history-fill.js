// Fill untracked days from Chrome history: asks for the permission, reads, says what happened in `out`.
import { HISTORY_DAYS, requestHistory, backfillFromHistory } from '../../lib/activity/history.js';
import { msg } from './msg.js';

export { HISTORY_DAYS };

/** requestHistory() is the first call, so the permission prompt keeps the click's user gesture. @param {string} out @param {() => void} [after] */
export async function fillFromHistory(out, after) {
  let granted;
  try { granted = await requestHistory(); } catch (e) {
    return msg(out, `Couldn’t ask for history access (${e instanceof Error ? e.message : e}). If you just updated the extension, reload it at chrome://extensions.`);
  }
  if (!granted) return msg(out, 'History access wasn’t granted, so nothing was read.');
  msg(out, 'Reading your Chrome history on this computer…');
  try {
    const n = await backfillFromHistory();
    msg(out, n ? `Filled ${n} day${n > 1 ? 's' : ''} from history. Times are estimates (marked ~).` : 'No browsing found for the untracked days.');
    after?.();
  } catch (e) { msg(out, `Couldn’t read history: ${e instanceof Error ? e.message : e}`); }
}
