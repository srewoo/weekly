// Report page: owns the loaded week and orchestrates loading and rendering. Panels wire their own controls.
import '../components/theme.js';
import { $ } from '../components/dom.js';
import { getSettings } from '../../lib/settings.js';
import { weekStart, shiftDate, dayKey, WORK_DAYS } from '../../lib/week.js';
import { loadRange } from '../../lib/activity/range.js';
import { missingOrigins, requestOrigins, fetchStatuses } from '../../lib/report/integrations.js';
import { latest } from '../../lib/latest.js';
import { renderSummary, renderDays } from './week-view.js';
import { renderCategories } from './categories-view.js';
import { renderNotes } from './notes-panel.js';
import { renderHistBanner } from './history-panel.js';
import { renderNotices } from './notices.js';
import { mountNav } from '../components/nav.js';
import { msg } from '../components/msg.js';
import { sampleWeek } from '../../lib/sample-week.js';
import { trackingAllowed } from '../../lib/activity/status.js';
import { showDraft, refreshDraft } from './draft-panel.js';
import { getTasks, doneInRange, doneRange } from '../../lib/tasks.js';
import { onTasksChanged } from '../../lib/storage.js';
import { getNotes, otherWork, onNotesChanged } from '../../lib/notes.js';
import { getExcluded, getReportPrefs, hideStatusNudge, dropLegacyExcluded, onActivityChanged } from '../../lib/report-store.js';

let weekOffset = 0;
/** @type {any} */
let W = null;            // loaded week
let statuses = {};       // live Jira/MR statuses, by item key
let pendingOrigins = [];

export const getW = () => W;
export const getStatuses = () => statuses;
export const getWeekOffset = () => weekOffset;
export { msg };
/** report.html?sample=1 shows a made-up week and never writes to storage. */
const SAMPLE = new URLSearchParams(location.search).get('sample') === '1';
export const isSample = () => SAMPLE;
export const fmtDate = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const aboveMin = merged => Object.values(merged).filter(e => e.ms >= W.settings.minMinutes * 60000);
export const included = e => !W.excluded.has(e.key);

const loadGuard = latest();

/** Every caller goes through here, so a failed load is said on the page, never an unhandled rejection. */
export const load = (fetchStatus = true) => loadWeek(fetchStatus)
  .catch(e => msg('#copyMsg', `Couldn’t load this week (${e instanceof Error ? e.message : e}). Reload the page to try again.`));

async function loadWeek(fetchStatus) {
  const mine = loadGuard();   // Prev, Prev: only the last call may assign W and render
  const start = weekStart(weekOffset);
  if (SAMPLE) return loadSample(mine);
  const [range, settings, excluded, prefs, tasks, allNotes, tracking] = await Promise.all([loadRange(start, WORK_DAYS), getSettings(), getExcluded(dayKey(start)), getReportPrefs(), getTasks(), getNotes(), trackingAllowed().catch(() => true)]);
  if (!mine()) return;
  const end = shiftDate(start, WORK_DAYS);
  const { from, to } = doneRange(dayKey(start));
  // Other work: the week's day notes over the whole Mon–Sun span, so a Saturday note still lands in that week's update.
  // Private notes never come back from otherWork, so they never reach the draft or the AI prompt.
  const notes = otherWork(allNotes, dayKey(start), dayKey(shiftDate(start, 6)));
  // Tasks done this week (spec §3.2): the Done section and its tickable rows.
  const done = to < from ? { oneOffs: [], recurring: [] } : doneInRange(tasks, from, to);
  W = { ...range, end, notes, done, tasks, settings, excluded: new Set(excluded), shareOk: prefs.shareOk,
    tracking, lastExportAt: prefs.lastExportAt, hasData: !!(tasks.length || allNotes.length || Object.keys(range.merged).length) };
  render();
  await showDraft();
  if (fetchStatus) refreshStatuses();
}

async function loadSample(mine) {
  const settings = await getSettings();
  if (!mine()) return;
  // Sample: the weekly template, no Slack button, nothing to save.
  W = { ...sampleWeek(), settings: { ...settings, template: 'weekly', slackWebhook: '' }, sample: true, tracking: true, hasData: false };
  render();
  await showDraft();
}

export function render() {
  renderSummary(W, weekOffset);
  renderDays(W);
  renderHistBanner(W);
  renderCategories(W, statuses);
  renderNotes(W);
  renderNotices(W);
  $('#trendsPanel').hidden = !W.settings.showStats;
  if (W.sample) lockSample();
}

// A sample can be read, not changed: week controls and the draft's format and name options stay put.
const lockSample = () => ['#prev', '#next', '#thisWeek', '#template', '#anonymize'].forEach(s => { $(s).disabled = true; });

// ---- Live statuses ----
async function refreshStatuses() {
  const items = Object.values(W.merged);
  pendingOrigins = await missingOrigins(items);
  const later = (await getReportPrefs()).statusNudgeOff;   // "Not now" is remembered
  $('#connect').hidden = !pendingOrigins.length || later;
  msg('#connectText', `Allow Weekly to check ticket and MR status on ${pendingOrigins.map(o => new URL(o).host).join(', ')} (uses your existing login).`);
  const found = await fetchStatuses(items);
  if (Object.keys(found).length) { statuses = { ...statuses, ...found }; render(); await refreshDraft(); }
}

function init() {
  $('#prev').onclick = () => { weekOffset--; load(); };
  $('#next').onclick = () => { if (weekOffset < 0) { weekOffset++; load(); } };
  $('#thisWeek').onclick = () => { weekOffset = 0; load(); };
  // requestOrigins runs synchronously in the click: the permission prompt needs the user gesture.
  $('#connectBtn').onclick = () => requestOrigins(pendingOrigins)
    .then(ok => ok ? refreshStatuses() : msg('#connectText', 'Not allowed, so statuses stay off.'))
    .catch(e => msg('#connectText', `Couldn’t ask for access (${e.message}). If you just updated the extension, reload it at chrome://extensions.`));
  $('#connectLater').onclick = () => { $('#connect').hidden = true; void hideStatusNudge(); };
  let reloadT;
  onActivityChanged(() => { clearTimeout(reloadT); reloadT = setTimeout(() => load(false), 500); });
  onTasksChanged(() => { clearTimeout(reloadT); reloadT = setTimeout(() => load(false), 300); });
  onNotesChanged(() => { clearTimeout(reloadT); reloadT = setTimeout(() => load(false), 300); });
  void mountNav('update');
  if (!SAMPLE) void dropLegacyExcluded();
}

import * as categories from './categories-view.js';
import * as draft from './draft-panel.js';
import * as aiPanel from './ai-panel.js';
import * as share from './share-panel.js';
import * as notes from './notes-panel.js';
import * as notices from './notices.js';
import * as trends from './trends-panel.js';
import * as history from './history-panel.js';
init();
[categories, draft, aiPanel, share, notes, notices, trends, history].forEach((m) => m.init());
load();
