// Day-1 empty state: a week with nothing in it says what will appear and how to get started.
import { h, $ } from '../components/dom.js';

/** @param {any} W */
export const isEmptyWeek = W => !W.sample && !Object.keys(W.merged).length && !W.notes.length && !W.done.oneOffs.length && !W.done.recurring.length;

export function emptyState() {
  return h('div', { class: 'empty first' },
    h('strong', {}, 'Nothing recorded for this week yet'),
    h('p', {}, 'Pages you work in, tasks you tick off and notes you add will show up here, grouped by type of work, and turn into a ready-to-send update.'),
    h('div', { class: 'row' },
      h('a', { class: 'btn primary', href: 'report.html?sample=1' }, 'See a sample update'),
      h('button', { on: { click: () => $('#noteText').focus() } }, 'Add a note')),
    h('p', { class: 'hint' }, 'Or add tasks in the side panel (Alt+T).'));
}
