// First-run page: one decision (track my week?), optional history backfill, then a way to see value now
// (sample update, side panel, report). Reminders and name hiding live in Settings.
import '../components/theme.js';
import { $ } from '../components/dom.js';
import { requestHistory, backfillFromHistory } from '../../lib/activity/history.js';
import { trackingAllowed, allowTracking } from '../../lib/activity/status.js';


// Track my week? (W3): yes asks Chrome for "tabs" inside the click; no leaves it off. Filling from history needs tracking.
const tracking = (on, already = false) => {
  $('#fillStep').hidden = !on;
  $('#trackMsg').textContent = on ? (already ? 'Tracking is already on.' : 'Tracking is on. Weekly notes the tab in front while you work.')
    : 'Tracking is off, so nothing is recorded. You can turn it on later in Settings → Tracking.';
};
trackingAllowed().then(on => { if (on) tracking(true, true); }).catch(() => {});  // can't tell: leave it shown as off
$('#trackYes').onclick = async () => {
  try { tracking(await allowTracking()); } catch (e) { $('#trackMsg').textContent = `Couldn’t ask Chrome (${e.message}). Tracking stays off.`; }
};
$('#trackNo').onclick = () => tracking(false);

$('#fill').onclick = async () => {
  const out = t => ($('#fillMsg').textContent = t);
  let granted;
  try { granted = await requestHistory(); } catch (e) { return out(`Couldn’t ask for history access (${e.message}).`); }
  if (!granted) return out('No problem. Your report will fill up as you work.');
  out('Reading your Chrome history on this computer…');
  try {
    const n = await backfillFromHistory();
    out(n ? `Done: ${n} day${n > 1 ? 's' : ''} filled in. They’re marked ~ in your report.` : 'Nothing to fill in yet. Your report will fill up as you work.');
    $('#fill').disabled = true;
  } catch (e) { out(`Couldn’t read history: ${e.message}`); }
};

// Open the side panel inside the click (Chrome needs a user gesture). Say the shortcut if it can't.
$('#panel').onclick = async () => {
  try { await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id }); $('#panelMsg').textContent = ''; }
  catch (e) { console.error('[weekly] welcome panel', e); $('#panelMsg').textContent = 'Couldn’t open it from here. Press Alt+T to open it.'; }
};

// Show the real shortcuts, since people can remap them; the page's defaults stay if Chrome has none or can't say.
chrome.commands.getAll().then(cmds => {
  for (const c of cmds) { const k = document.getElementById('k-' + c.name); if (k && c.shortcut) k.textContent = c.shortcut; }
}).catch(() => {});
