// Settings form: fill, then save on every change. Settings are read by every other page when it loads, so nothing here reloads a week.
import { $ } from '../components/dom.js';
import { getSettings, updateSettings } from '../../lib/settings.js';
import { validSlackWebhook } from '../../lib/report/integrations.js';
import { msg } from '../components/msg.js';
import { mountNav } from '../components/nav.js';
import { fillReminders, readReminders, reminderError } from './reminder-settings.js';
import { trackingAllowed, allowTracking, stopTracking, onTrackingChanged } from '../../lib/activity/status.js';

const ROLES = ['general', 'engineering', 'product', 'sales', 'hr', 'marketing', 'support'];

export function fillSettings(s) {
  $('#role').value = s.role;
  $('#idleSeconds').value = s.idleSeconds;
  $('#minMinutes').value = s.minMinutes;
  $('#ignoreDomains').value = s.ignoreDomains.join('\n');
  $('#rules').value = s.rules.join('\n');
  $('#ticketPrefixes').value = s.ticketPrefixes.join(', ');
  $('#slackWebhook').value = s.slackWebhook;
  $('#theme').value = s.theme;
  $('#hideNames').checked = s.anonymize;
  $('#showStats').checked = s.showStats;
  $('#trackAway').checked = s.trackAway;
  fillReminders(s);
}

/** Shows (or clears) the error next to a field. @param {string} errSel @param {string} text @param {string[]} fields */
function fieldError(errSel, text, fields) {
  msg(errSel, text);
  for (const f of fields) $(f).setAttribute('aria-invalid', String(Boolean(text)));
}

// Save on change: every field is checked first; a bad one shows its error beside it and is left out of the patch.
async function saveSettings() {
  const lines = v => v.split('\n').map(s => s.trim()).filter(Boolean);
  const webhook = $('#slackWebhook').value.trim();
  const badHook = webhook !== '' && !validSlackWebhook(webhook);
  fieldError('#slackWebhookErr', badHook ? 'That isn’t a Slack webhook URL (https://hooks.slack.com/services/...).' : '', ['#slackWebhook']);
  const re = reminderError();
  fieldError('#reminderErr', re, ['#morningTime', '#eveningTime']);
  const { morning, evening, ...rest } = readReminders();
  let settings;
  try {
    settings = await updateSettings({
      role: ROLES.includes($('#role').value) ? $('#role').value : 'general',
      idleSeconds: Math.max(15, Number($('#idleSeconds').value) || 120),
      minMinutes: Math.max(0, Number($('#minMinutes').value) || 0),
      ignoreDomains: lines($('#ignoreDomains').value).map(s => s.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()),
      rules: lines($('#rules').value).filter(l => l.includes('=>')).slice(0, 100).map(l => l.slice(0, 300)),
      ticketPrefixes: $('#ticketPrefixes').value.toUpperCase().split(/[\s,]+/).filter(p => /^[A-Z][A-Z0-9]{1,9}$/.test(p)),
      anonymize: $('#hideNames').checked,
      showStats: $('#showStats').checked,
      trackAway: $('#trackAway').checked,
      ...(badHook ? {} : { slackWebhook: webhook }),
      ...(re ? {} : { morning, evening }),
      ...rest,
    });
  } catch (e) {
    console.error('[weekly] save settings', e);
    return say('Couldn’t save your settings. Please try again.');
  }
  void mountNav('settings');  // the Stats link follows the switch
  if (badHook || re) return say('');
  say(settings.days.length ? 'Saved' : 'Saved. No working days are ticked, so no reminders will show.');
}

/** Status line that clears itself a few seconds later, unless something else has been said since. @param {string} text */
function say(text) {
  msg('#settingsMsg', text);
  if (text) setTimeout(() => { if ($('#settingsMsg').textContent === text) msg('#settingsMsg', ''); }, 4000);
}

/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;
/** Checkboxes, selects and times save at once; text boxes save when you pause typing, or leave the box. @param {Event} e */
function onEdit(e) {
  if (!(e.target instanceof Element) || !e.target.closest('[data-save]')) return;
  clearTimeout(timer);
  if (e.type === 'input' && e.target.matches('input[type=text], input[type=number], textarea')) timer = setTimeout(() => void saveSettings(), 700);
  else if (e.type === 'change') void saveSettings();
}

// Tracking on/off grants or gives back the "tabs" permission (spec §3.2, W3). Saved at once.
async function setTracking(e) {
  const want = e.target.checked;
  let why = '';
  let on = !want;  // the state before the click, if Chrome can't say
  try { await (want ? allowTracking() : stopTracking()); } catch (err) { why = ` (${err.message})`; }
  try { on = await trackingAllowed(); } catch (err) { why ||= ` (${err.message})`; }
  e.target.checked = on;
  $('#trackingMsg').textContent = on === want
    ? (on ? 'Tracking is on.' : 'Tracking is off. Nothing new is recorded; what is already here stays.')
    : `Chrome didn’t allow that, so tracking is still ${on ? 'on' : 'off'}${why}.`;
}

export function init() {
  document.addEventListener('input', onEdit);
  document.addEventListener('change', onEdit);
  $('#trackingOn').onchange = e => void setTracking(e);
  const syncTracking = () => trackingAllowed().then(on => { $('#trackingOn').checked = on; }).catch(() => { $('#trackingOn').checked = false; });
  void syncTracking();
  // Granted or revoked elsewhere (chrome://extensions, the welcome page): the box follows.
  onTrackingChanged(() => void syncTracking());
  // The theme saves like the rest, then every page follows settings.
  $('#theme').onchange = e => updateSettings({ theme: e.target.value }).then(() => say('Saved')).catch(err => say(err.message));
  getSettings().then(fillSettings).catch(e => say(e.message));
}
