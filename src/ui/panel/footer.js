// The panel footer: one tracking line ("Tracked today 2h 15m · Pause"), what is being
// tracked underneath, an actionable status (turn tracking on; open the data settings
// when storage is full), then a "Shortcuts & privacy" disclosure. Tracking off collapses to one line.
import { $ } from '../components/dom.js';
import { getSettings, updateSettings } from '../../lib/settings.js';
import { loadRange } from '../../lib/activity/range.js';
import { trackerStatus, onTrackingChanged, allowTracking } from '../../lib/activity/status.js';
import { report } from '../components/undo.js';
import { fmtDuration } from '../../lib/week.js';
import { openTab } from './open-tab.js';

const SETTINGS_DATA = 'src/ui/settings/settings.html#data';

/** "N new task · Alt+T side panel · Alt+Shift+T full app" (and the Note-on-page label), from the keys Chrome really has (the user may have remapped or cleared them). */
async function keyHint() {
  const cmds = await chrome.commands.getAll();
  const key = (/** @type {string} */ name) => cmds.find((c) => c.name === name)?.shortcut || '';
  const part = (/** @type {string} */ k, /** @type {string} */ what) => (k ? [`${k} ${what}`] : []);
  const note = key('open-note');
  $('#noteOnPage').textContent = note ? `Note on this page · ${note}` : 'Note on this page';
  return ['N new task', ...part(key('open-panel'), 'side panel'), ...part(key('open-app'), 'full app')].join(' · ');
}

export async function refresh() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [day, settings, { current, error, tracking }] = await Promise.all([loadRange(start, 1), getSettings(), trackerStatus()]);
  $('#todayTotal').textContent = fmtDuration(day.perDay[0] ?? 0);
  const now = !tracking ? 'Tracking is off.'
    : settings.paused ? 'Tracking is paused.'
    : current ? 'Now: ' + (current.title || current.url) : 'Paused: idle, Chrome in the background, or an ignored site.';
  $('#now').textContent = now;
  $('#now').title = now;
  // Without the tabs permission Weekly is tasks and notes (W3): say so, offer Turn on, and no Pause.
  $('#pfoot').classList.toggle('off', !tracking);
  $('#trackOn').hidden = tracking;
  $('#pause').hidden = !tracking;
  $('#pause').textContent = settings.paused ? 'Resume' : 'Pause';
  $('#err').hidden = !error;
  $('#errText').textContent = !error ? ''
    : /quota/i.test(error) ? 'Storage is full, so recording has stopped.'
    : `Recording stopped because of an error: ${error}`;
  $('#errAct').hidden = !error || !/quota/i.test(error);
}

/**
 * Spec §3.4: ask the worker to open the note on the page in front. Chrome lets Weekly onto a page for
 * Alt+N, or where the user granted the site; elsewhere a panel click can't reach it, so the panel
 * opens Notes with the cursor in the add box: the note still gets written, no dead end.
 * @param {() => void} showNotes
 */
async function noteOnPage(showNotes) {
  const { id: windowId } = await chrome.windows.getCurrent();
  const r = await chrome.runtime.sendMessage({ type: 'panel:openOnPage', windowId });
  if (r?.ok) { $('#noteMsg').textContent = 'The note is open on the page.'; return; }
  showNotes();
  $('#noteMsg').textContent = 'Weekly can’t reach this page from the panel. Press Alt+N on the page, or write the note here.';
}

/** @param {{ showNotes: () => void }} opts */
export function init({ showNotes }) {
  $('#noteOnPage').onclick = () => void noteOnPage(showNotes).catch(report);
  // The toggle is computed inside the settings lock, so a double click can't race itself.
  $('#pause').onclick = () => void updateSettings((s) => ({ paused: !s.paused })).catch(report);
  // Straight from the click: Chrome only shows its permission prompt during a user gesture.
  $('#trackOn').onclick = () => void allowTracking().then(() => refresh()).catch(report);
  $('#errAct').onclick = () => void openTab(SETTINGS_DATA).catch(report);
  onTrackingChanged(() => refresh().catch(report));
  refresh().catch(report);
  keyHint().then((t) => { $('#keys').textContent = t; }).catch(() => undefined);
}
