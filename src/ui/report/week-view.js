// The week header (label, summary line, controls) and the Mon–Fri day strip.
import { h, clear, $ } from '../components/dom.js';
import { dayKey, shiftDate, fmtDuration as fmt } from '../../lib/week.js';
import { WEEKDAYS } from '../../lib/report/draft.js';
import { fmtDate, aboveMin } from './main.js';

const EXTRAS = [['Tickets', 'ticket'], ['Merge requests', 'merge request'], ['Sales & CRM', 'CRM record'], ['Recruiting & HR', 'HR record']];

export function renderSummary(W, weekOffset) {
  const last = shiftDate(W.end, -1);
  const items = aboveMin(W.merged);
  $('#weekLabel').textContent = W.sample ? `Sample week of ${fmtDate(W.start)}` : weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : `Week of ${fmtDate(W.start)}`;
  const total = W.perDay.reduce((a, b) => a + b, 0);
  const count = c => items.filter(e => e.category === c).length;
  const extras = EXTRAS.filter(([c]) => count(c)).map(([c, label]) => `${count(c)} ${label}${count(c) > 1 ? 's' : ''}`);
  $('#summary').textContent = `${fmtDate(W.start)} to ${fmtDate(last)}: ${fmt(total)} tracked in Chrome${extras.length ? ', ' + extras.join(', ') : ''}`;
  $('#next').disabled = weekOffset >= 0;
  $('#minLabel').textContent = `${W.settings.minMinutes} minute${W.settings.minMinutes === 1 ? '' : 's'}`;
  $('#minNote').hidden = !W.settings.minMinutes;
  $('#template').value = W.settings.template;
  $('#anonymize').checked = W.settings.anonymize;
  $('#incTime').closest('label').hidden = W.settings.template === 'standup';
  $('#slackBtn').hidden = !W.settings.slackWebhook;
}

export function renderDays(W) {
  const max = Math.max(...W.perDay, 3600000);
  const todayKey = dayKey(new Date());
  clear($('#days'));
  $('#days').append(...W.days.map((d, i) => h('div', {
    class: ['day', dayKey(d) === todayKey && 'today', W.estimated[i] && 'est'].filter(Boolean).join(' '),
    attrs: W.estimated[i] ? { title: 'Estimated from Chrome history' } : {},
  },
    h('div', { class: 'name' }, `${WEEKDAYS[i]} ${d.getDate()}`),
    h('div', { class: 'hrs' }, W.perDay[i] ? (W.estimated[i] ? '~' : '') + fmt(W.perDay[i]) : '–'),
    h('div', { class: 'stroke', style: { width: `${Math.max(W.perDay[i] ? 6 : 0, (W.perDay[i] / max) * 100)}%` } }))));
}
