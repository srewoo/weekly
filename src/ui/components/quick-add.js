// Quick-add for a task input: a live one-line hint under it ("Tomorrow · High ·
// Repeats Mon, Wed") and a submit that creates the task the parser described.
import { h } from './dom.js';
import { parseQuickAdd, describeQuickAdd } from '../../lib/quickadd.js';
import { getSettings } from '../../lib/settings.js';
import { PRIORITY_LABEL } from '../../lib/tasks.js';
import { today } from '../../lib/dates.js';
import { add } from './task-actions.js';

export const QUICK_PLACEHOLDER = 'Add a task… try “Call Sam tomorrow !high”';

/**
 * @param {HTMLInputElement} input
 * @param {HTMLElement} [hint] defaults to a new element; the caller places it
 * @returns {{ hint: HTMLElement, submit: () => Promise<void> }}
 */
export function quickAdd(input, hint = h('p', {})) {
  hint.classList.add('qa-hint');
  hint.setAttribute('aria-live', 'polite');
  let def = 'medium';
  const show = () => {
    // The placeholder already teaches the syntax; the hint only appears while typing.
    const line = input.value.trim() ? describeQuickAdd(parseQuickAdd(input.value, today()), today(), def) : '';
    hint.textContent = line || (input.value.trim() ? `Priority: ${PRIORITY_LABEL[/** @type {'medium'} */ (def)] ?? 'Medium'}. Add !high or !low to change it.` : '');
    hint.classList.toggle('parsed', Boolean(line));
  };
  getSettings().then((s) => { def = s.defaultPriority; show(); }, () => {});
  input.addEventListener('input', show);
  show();
  return {
    hint,
    async submit() {
      if (!input.value.trim()) return;
      const q = parseQuickAdd(input.value, today());
      const ok = await add({ title: q.title, priority: q.priority, dueDate: q.dueDate ?? today(), repeat: q.repeatDays ? { days: q.repeatDays } : null });
      if (ok) { input.value = ''; show(); hint.textContent = `Added “${q.title}”.`; }
    },
  };
}
