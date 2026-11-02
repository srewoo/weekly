// The activity log: one section per category, one tickable row per item.
import { h, clear, $ } from '../components/dom.js';
import { dayKey, fmtDuration as fmt, WORK_DAYS } from '../../lib/week.js';
import { WEEKDAYS, KNOWN, recurringLabel } from '../../lib/report/draft.js';
import { getW, aboveMin, load } from './main.js';
import { updateSettings } from '../../lib/settings.js';
import { saveExcluded } from '../../lib/report-store.js';
import { refreshDraft } from './draft-panel.js';
import { doneKey } from '../../lib/tasks.js';
import { isEmptyWeek, emptyState } from './empty.js';

const EMPTY = 'Nothing recorded for this week yet. Keep Chrome open while you work and activity will show up here within a minute.';
// A Browsing row can be filed under a real category in one step: it becomes a site rule (Settings → Advanced),
// which applies to every week, so the row moves at once and the site is recognised from then on.
const MOVE_TO = KNOWN.filter(c => !['Tickets', 'Merge requests', 'Browsing', 'Outside Chrome'].includes(c));
const AWAY_HINT = 'Time you were working in other apps (IDE, terminal, desktop Slack or Zoom). Weekly sees only the minutes, not the app, so it stays out of the update. Add a note below saying what it was, and the note goes in.';

function moveTo(e) {
  const host = e.key.slice(5);
  return h('select', { class: 'move', attrs: { 'aria-label': `File ${host} under a category` },
    on: { change: async ev => {
      const cat = ev.target.value; if (!cat) return;
      await updateSettings(s => ({ rules: [...s.rules, `${host} => ${cat} | ${host}`].slice(-100) }));
      await load(false);
    } } },
  h('option', { value: '' }, 'Move to…'), MOVE_TO.map(c => h('option', { value: c }, c)));
}

const EMPTY_OFF = 'No browsing is recorded while tracking is off. Add what you did in Notes, or tick tasks off in Tasks, and it appears in your update.';

function itemRow(W, statuses, e) {
  const off = W.excluded.has(e.key);
  const chips = [...e.tickets].filter(t => !e.key.endsWith(t)).map(t => h('span', { class: 'chip' }, t));
  const status = statuses[e.key] ? h('span', { class: 'chip status' }, statuses[e.key]) : null;
  const dots = WEEKDAYS.slice(0, WORK_DAYS).map((_, i) => h('i', { class: e.days.has(i) ? 'on' : '' }));
  const link = e.url ? h('a', { href: e.url, target: '_blank', rel: 'noopener' }, e.task) : e.task;
  return h('div', { class: off ? 'item off' : 'item' },
    h('input', { type: 'checkbox', dataset: { key: e.key }, checked: !off, disabled: W.sample, attrs: { 'aria-label': 'Include in update' } }),
    h('span', { class: 'task' }, link, status, chips, e.category === 'Browsing' && e.key.startsWith('site:') && !W.sample ? moveTo(e) : null),
    // Under a minute: no "0m" and an empty meter, just nothing.
    h('span', { class: 'meta' }, e.ms < 60000 ? '' : [(e.est ? '~' : '') + fmt(e.ms), h('span', { class: 'dots', attrs: { 'aria-label': 'Days active' } }, dots)]));
}

// Tasks done this week, tickable like any other item (spec §3.2).
function doneSection(W) {
  const rows = [...W.done.oneOffs.map(t => [t, t.title]), ...W.done.recurring.map(r => [r.task, recurringLabel(r)])];
  if (!rows.length) return null;
  return h('section', { class: 'cat done' },
    h('div', { class: 'cat-head' }, h('h3', {}, 'Done'), h('span', {}, `${rows.length} task${rows.length === 1 ? '' : 's'}`)),
    rows.map(([t, label]) => {
      const off = W.excluded.has(doneKey(t));
      return h('div', { class: off ? 'item off' : 'item' },
        h('input', { type: 'checkbox', dataset: { key: doneKey(t) }, checked: !off, disabled: W.sample, attrs: { 'aria-label': 'Include in update' } }),
        h('span', { class: 'task' }, label), h('span', { class: 'meta' }));
    }));
}

export function renderCategories(W, statuses) {
  const el = $('#categories');
  clear(el);
  const items = aboveMin(W.merged);
  const done = doneSection(W);
  if (done) el.append(done);
  if (isEmptyWeek(W)) return el.append(emptyState());
  if (!items.length) return el.append(h('div', { class: 'empty' }, W.tracking === false ? EMPTY_OFF : EMPTY));
  const groups = {};
  items.forEach(e => (groups[e.category] = groups[e.category] || []).push(e));
  const order = [...KNOWN, ...Object.keys(groups).filter(c => !KNOWN.includes(c))];
  el.append(...order.filter(c => groups[c]).map(c => {
    const list = groups[c].sort((a, b) => b.ms - a.ms);
    const sum = list.reduce((s, e) => s + e.ms, 0);
    return h('section', { class: 'cat' },
      h('div', { class: 'cat-head' }, h('h3', {}, c), h('span', {}, fmt(sum))),
      c === 'Outside Chrome' ? h('p', { class: 'hint' }, AWAY_HINT, ' ', h('button', { type: 'button', class: 'link', on: { click: () => $('#noteText').focus() } }, 'Add a note')) : null,
      c === 'Outside Chrome' ? null : list.map(e => itemRow(W, statuses, e)));
  }));
}

export function init() {
  const toggle = async e => {
    const W = getW();
    const key = e.target.dataset.key; if (!key || W.sample) return;
    e.target.checked ? W.excluded.delete(key) : W.excluded.add(key);
    await saveExcluded(dayKey(W.start), W.excluded);
    e.target.closest('.item, li')?.classList.toggle('off', !e.target.checked);
    await refreshDraft();
  };
  $('#categories').addEventListener('change', toggle);
  $('#notes').addEventListener('change', toggle);   // notes are tickable too (key note:<id>)
}
