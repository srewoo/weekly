// Settings → Reminders (spec §3.2): the morning and evening times, the working
// days, the system notification and catch-up. Saved with the rest of the form;
// lib/settings.js validates what is stored. Preview asks the worker to open the
// reminder window now, without touching today's schedule.
import { $, $$ } from '../components/dom.js';
import { isValidTime } from '../../lib/dates.js';
import { msg } from '../components/msg.js';

export function fillReminders(s) {
  $('#morningOn').checked = s.morning.enabled;
  $('#morningTime').value = s.morning.time;
  $('#eveningOn').checked = s.evening.enabled;
  $('#eveningTime').value = s.evening.time;
  $$('#remindDays input').forEach(i => { i.checked = s.days.includes(Number(i.value)); });
  $('#systemNotification').checked = s.systemNotification;
  $('#reminderWindow').checked = s.reminderWindow;
  $('#catchUpOnStartup').checked = s.catchUpOnStartup;
}

/** The Reminders group as a settings patch. */
export const readReminders = () => ({
  morning: { enabled: $('#morningOn').checked, time: $('#morningTime').value },
  evening: { enabled: $('#eveningOn').checked, time: $('#eveningTime').value },
  days: $$('#remindDays input:checked').map(i => Number(i.value)),
  systemNotification: $('#systemNotification').checked,
  reminderWindow: $('#reminderWindow').checked,
  catchUpOnStartup: $('#catchUpOnStartup').checked,
});

/** What is wrong with the Reminders group, in words, or '' (a cleared time would otherwise save as the default). */
export function reminderError() {
  if (!isValidTime($('#morningTime').value)) return 'Enter a time for the morning brief, for example 09:00.';
  if (!isValidTime($('#eveningTime').value)) return 'Enter a time for the evening check, for example 18:00.';
  return '';
}

const preview = slot => chrome.runtime.sendMessage({ type: 'reminder:preview', slot })
  .catch(e => msg('#settingsMsg', `Couldn’t open the preview (${e.message}).`));

export function init() {
  $('#previewMorning').onclick = () => preview('morning');
  $('#previewEvening').onclick = () => preview('evening');
}
