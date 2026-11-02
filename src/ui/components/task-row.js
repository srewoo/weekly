// One task row: tick box, title, meta line and a ⋯ menu (spec §3.1: priority and
// due date are set from the menu, never in the add box). Text only, via h().
import { h } from './dom.js';
import { relativeLabel, clockTime } from '../../lib/dates.js';
import { isOverdue, isDoneOn, PRIORITIES, PRIORITY_LABEL } from '../../lib/tasks.js';
import { repeatLabel } from '../../lib/quickadd.js';
import * as act from './task-actions.js';

/** @typedef {import('../../lib/tasks.js').Task} Task */
/** @typedef {import('../../lib/tasks.js').Priority} Priority */

/**
 * @typedef {object} RowOptions
 * @property {string} day                   the day the row stands for: ticks and deletes apply to it
 * @property {(t: Task) => void} [onEdit]   adds "Edit…" to the menu
 * @property {boolean} [copy]               adds "Copy to" (one-offs)
 */

/** Medium is the default, so it stays quiet; High and Low say so in words (never colour alone). */
const priorityTag = (/** @type {Priority} */ p) => (p === 'medium' ? null : h('span', { class: `pri pri-${p}` }, `${PRIORITY_LABEL[p]} priority`));

/** @param {Task} t @param {string} day @param {boolean} done */
function metaParts(t, day, done) {
  if (t.repeat) return [t.repeat.days.length === 7 ? 'Every day' : `Repeats ${repeatLabel(t.repeat.days)}`, priorityTag(t.priority)];
  if (done && t.completedAt) return [`Done ${clockTime(t.completedAt)}`];
  return [t.dueDate ? relativeLabel(t.dueDate, day) : 'No date', priorityTag(t.priority)];
}

/** @param {Task} t @param {string} day @param {boolean} done */
function metaLine(t, day, done) {
  const parts = metaParts(t, day, done).filter(Boolean);
  return h('span', { class: 't-meta' }, ...parts.flatMap((p, i) => (i ? [' · ', p] : [p])));
}

/** @param {Task} t @param {string} label @param {(iso: string) => void} fn @param {string} cls */
const dateField = (t, label, fn, cls) => h('label', {}, label, h('input', {
  type: 'date', class: cls, value: cls === 'move' ? (t.dueDate ?? '') : '',
  attrs: { 'aria-label': `${label} for ${t.title}` },
  on: { change: (/** @type {Event} */ e) => { const v = /** @type {HTMLInputElement} */ (e.target).value; if (v) fn(v); } },
}));

/** @param {Task} t @param {RowOptions} o */
function menu(t, o) {
  const pri = h('select', { attrs: { 'aria-label': `Priority for ${t.title}` },
    on: { change: (/** @type {Event} */ e) => void act.setPriority(t, /** @type {Priority} */ (/** @type {HTMLSelectElement} */ (e.target).value)) } },
  PRIORITIES.map((p) => h('option', { value: p, selected: p === t.priority }, PRIORITY_LABEL[p])));
  const oneOff = t.repeat === null;
  return h('details', { class: 'more' },
    h('summary', { attrs: { 'aria-label': `More for ${t.title}` } }, '⋯'),
    h('div', { class: 'menu' },
      h('label', {}, 'Priority', pri),
      oneOff ? dateField(t, 'Due', (iso) => void act.moveTo(t, iso), 'move') : null,
      oneOff && t.status === 'open' ? h('button', { class: 'quiet tomorrow', on: { click: () => void act.moveToTomorrow([t]) } }, 'Move to tomorrow') : null,
      oneOff && t.dueDate ? h('button', { class: 'quiet', on: { click: () => void act.moveTo(t, null) } }, 'Clear date') : null,
      oneOff && o.copy ? dateField(t, 'Copy to', (iso) => void act.copyTo(t, iso), 'copy') : null,
      o.onEdit ? h('button', { class: 'quiet edit', on: { click: () => o.onEdit?.(t) } }, 'Edit…') : null,
      h('button', { class: 'quiet danger delete', on: { click: () => void act.remove(t, o.day) } },
        oneOff ? 'Delete' : 'Stop repeating')));
}

/** @param {Task} t @param {RowOptions} o @returns {HTMLLIElement} */
export function taskRow(t, o) {
  const done = isDoneOn(t, o.day);
  const late = !done && isOverdue(t, o.day);
  return h('li', { class: ['row', `p-${t.priority}`, done && 'is-done', late && 'late', t.repeat && 'daily'].filter(Boolean).join(' '), dataset: { id: t.id } },
    h('input', { type: 'checkbox', checked: done, attrs: { 'aria-label': `Done: ${t.title}` },
      on: { change: () => void act.toggle(t, o.day) } }),
    h('div', { class: 't-main' }, h('span', { class: 't-title' }, t.title), metaLine(t, o.day, done)),
    menu(t, o));
}
