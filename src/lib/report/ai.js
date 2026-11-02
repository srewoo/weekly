import { ground, isEmptyDraft } from './grounding.js';

/** The Prompt API global; typed loosely (no lib typings yet). @returns {any} */
const LM = () => /** @type {any} */ (self).LanguageModel;
// Rewrites the draft with Chrome's built-in Gemini Nano (Prompt API, Chrome 138+).
// Runs fully on-device: the log never leaves the machine.
export const AI_LANG = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
// ponytail: fixed char cap keeps us inside Nano's context window; use session.measureContextUsage() if drafts get truncated.
export const AI_MAX_INPUT = 12000;

/** @type {Record<string, string>} */
export const ROLE_HINTS = {
  general: 'a professional. Focus on what got done and what moved forward',
  engineering: 'a software engineer or QA. Keep ticket IDs and MR numbers exactly',
  product: 'a product manager. Focus on decisions, specs, launches and progress',
  sales: 'a salesperson. Focus on deals, accounts, customer calls and pipeline movement',
  hr: 'an HR or recruiting professional. Focus on candidates, hiring stages and people programs',
  marketing: 'an SEO or marketing professional. Focus on campaigns, content, rankings and analytics',
  support: 'a customer support professional. Focus on customer issues handled and escalations',
};

/** @returns {Promise<string>} */
export async function aiAvailability() {
  if (!('LanguageModel' in self)) return 'unsupported';
  try { return await LM().availability(AI_LANG); } catch (e) { return 'unavailable'; }
}

/** @param {string} role @param {string} template @returns {string} */
export function aiSystemPrompt(role, template) {
  const kind = template === 'standup' ? 'a daily standup note (yesterday, today, blockers)' : 'a weekly status update for a manager';
  return `You turn an auto-tracked activity log into ${kind}, written for ${ROLE_HINTS[role] || ROLE_HINTS.general}.
Rules: use only facts in the log; never invent names, numbers, IDs, commits, statuses or outcomes; group related items by outcome; lead with the most important work; keep IDs exactly as written.
Describe each log item once, starting with a verb such as Reviewed, Investigated, Prepared or Worked on; never repeat an item under two headings. (Never copy wording from these instructions: they are not part of the log.) Never say an item was updated, added, created, tested, completed or merged unless the log says so; items under "Done" were completed.
Items in [brackets] are live statuses: mention them, and never write a [bracketed] status the log doesn't have.
Never write what didn't happen ("no issues", "none", "no changes"). ${template === 'standup' ? 'Leave the Blockers line empty for the person to fill in. ' : ''}Never write more bullets than the log has; a short log gives a short update.
Output Markdown bullet points under the log's own headings, under 220 words, with no title and no preamble.`;
}

// Must be called from a click: the first call may trigger the model download.
/**
 * @param {string} draft
 * @param {{role: string, template: string, onText: (t: string) => void, onProgress?: (n: number) => void, signal?: AbortSignal}} opts
 * @returns {Promise<{ text: string, dropped: string[] }>}
 */
export async function aiRewrite(draft, { role, template, onText, onProgress, signal }) {
  // Nothing to rewrite: a model asked anyway writes a plausible week that never happened.
  if (isEmptyDraft(draft)) throw Object.assign(new Error('Nothing to polish yet: this draft has no work in it.'), { name: 'UngroundedError' });
  // Extensions can set sampling: greedy decoding keeps a small model from making things up.
  const sampling = await LM().params?.().then(() => ({ temperature: 0, topK: 1 }), () => ({}));
  const session = await LM().create({
    ...AI_LANG, ...sampling, signal,
    monitor(/** @type {any} */ m) { m.addEventListener('downloadprogress', (/** @type {any} */ e) => onProgress?.(e.loaded)); },
    initialPrompts: [{ role: 'system', content: aiSystemPrompt(role, template) }],
  });
  try {
    let out = '';
    const stream = session.promptStreaming(`Activity log:\n\n${draft.slice(0, AI_MAX_INPUT)}`, { signal });
    for await (const chunk of stream) {
      out = out && chunk.startsWith(out) ? chunk : out + chunk;   // older Chrome streamed cumulative text
      onText(out);
    }
    // Lines the draft doesn't back are dropped; if nothing is left, the draft is kept.
    const g = ground(draft, out);
    if (!g.text) throw Object.assign(new Error('Kept your draft: everything the AI wrote added details that aren’t in your log.'), { name: 'UngroundedError' });
    return g;
  } finally {
    session.destroy();
  }
}
