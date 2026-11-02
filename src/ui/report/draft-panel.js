// The update draft: saved edits always win over the generated text.
import { getDraft, saveDraft as storeDraft, removeDraft } from '../../lib/report-store.js';
import { $, h, clear } from '../components/dom.js';
import { updateSettings } from '../../lib/settings.js';
import { dayKey, shiftDate, isWorkday } from '../../lib/week.js';
import { loadRange } from '../../lib/activity/range.js';
import { buildWeekly, buildStandup, withoutExcludedNotes, nextWeekTasks } from '../../lib/report/draft.js';
import { withoutExcluded } from '../../lib/tasks.js';
import { addDays } from '../../lib/dates.js';
import { getNotes, otherWork } from '../../lib/notes.js';
import { getW, getWeekOffset, getStatuses, msg, fmtDate, aboveMin, included, isSample } from './main.js';
import { aiBusy } from './ai-panel.js';
import { renderPreview } from './preview.js';
import { isEmptyWeek } from './empty.js';

const draftKey = () => { const W = getW(); return W.settings.template === 'standup' ? `draft:standup:${dayKey(new Date())}` : `draft:weekly:${dayKey(W.start)}`; };

async function standupInput() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lastWeek = await loadRange(shiftDate(today, -7), 7);
  // Previous working day with activity; on Monday that's Friday, never the weekend.
  const i = lastWeek.days.findLastIndex((d, j) => isWorkday(d) && lastWeek.perDay[j] > 0);
  let prevDay = shiftDate(today, -1);
  while (!isWorkday(prevDay)) prevDay = shiftDate(prevDay, -1);
  if (i >= 0) prevDay = lastWeek.days[i];
  const [prev, now, notes] = await Promise.all([loadRange(prevDay, 1), loadRange(today, 1), getNotes()]);
  const prevLabel = dayKey(prevDay) === dayKey(shiftDate(today, -1)) ? 'Yesterday' : prevDay.toLocaleDateString(undefined, { weekday: 'long' });
  return { prevLabel, prevItems: aboveMin(prev.merged).filter(included), todayItems: aboveMin(now.merged).filter(included),
    notes: withoutExcludedNotes(otherWork(notes, dayKey(prevDay), dayKey(today)), getW().excluded) };
}

export async function generateDraft() {
  const W = getW();
  if (W.settings.template !== 'standup') {
    return buildWeekly({ rangeLabel: `${fmtDate(W.start)} to ${fmtDate(shiftDate(W.end, -1))}`, items: aboveMin(W.merged).filter(included),
      notes: withoutExcludedNotes(W.notes, W.excluded), next: getWeekOffset() === 0 ? nextWeekTasks(W.tasks ?? [], addDays(dayKey(W.start), 7)) : [], done: withoutExcluded(W.done, W.excluded), showTime: $('#incTime').checked, status: getStatuses(), hideNames: W.settings.anonymize });
  }
  return buildStandup({ ...(await standupInput()), status: getStatuses(), hideNames: W.settings.anonymize });
}

/** Every write to the draft goes through here so the rendered preview follows. @param {string} v */
export function setMd(v) {
  if ($('#md').value !== v) $('#md').value = v;   // same value keeps the caret where it is
  const W = getW();
  if (W && isEmptyWeek(W) && $('#regen').hidden) {
    clear($('#preview'));
    $('#preview').append(h('p', { class: 'empty-draft' }, 'Nothing to show yet. As you work, this fills in with a ready-to-send update. Add a note or a task to see it.'));
  } else renderPreview($('#preview'), v);
}

/** Preview (rendered, default) or Edit (the Markdown). @param {boolean} edit */
export function setView(edit) {
  $('#md').hidden = !edit; $('#preview').hidden = edit;
  $('#viewEdit').setAttribute('aria-pressed', String(edit)); $('#viewPreview').setAttribute('aria-pressed', String(!edit));
}

export function setEdited(on) {
  $('#regen').hidden = !on;
  msg('#draftState', on ? 'Your edits are saved. New activity won’t overwrite them.' : '');
}

export async function showDraft() {
  const k = draftKey();
  // The sample week is in memory only: it never reads or writes a saved draft.
  const saved = isSample() ? undefined : await getDraft(k);
  const next = saved ?? await generateDraft();
  if (!aiBusy()) setMd(next);
  setEdited(saved != null);
}

export async function refreshDraft() {
  if (!$('#regen').hidden || aiBusy()) return;
  const next = await generateDraft();
  if ($('#md').value !== next) setMd(next);
}

export const saveDraft = () => (isSample() ? Promise.resolve() : storeDraft(draftKey(), $('#md').value));

export function init() {
  $('#incTime').onchange = refreshDraft;
  $('#anonymize').onchange = async e => {
    getW().settings.anonymize = e.target.checked;
    await updateSettings({ anonymize: e.target.checked });
    await refreshDraft();
  };
  $('#template').onchange = async e => {
    const W = getW();
    W.settings.template = e.target.value;
    $('#incTime').closest('label').hidden = W.settings.template === 'standup';
    await updateSettings({ template: W.settings.template });
    await showDraft();
  };
  $('#viewPreview').onclick = () => setView(false);
  $('#viewEdit').onclick = () => { setView(true); $('#md').focus(); };
  $('#md').addEventListener('input', () => { if (!aiBusy() && !isSample()) { void saveDraft(); setEdited(true); } setMd($('#md').value); });
  $('#regen').onclick = async () => {
    await removeDraft(draftKey());
    setEdited(false); $('#aiUndo').hidden = true;
    setMd(await generateDraft());
  };
}
