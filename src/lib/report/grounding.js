// Keeps an AI rewrite honest: every sentence must be backed by the draft it was given. Pure, no chrome.*.
// Tuned on real Gemini Nano output (test/report/ai.test.js): it pads thin logs, invents [statuses], says pages you
// only had open were "updated" or "tested", fills in Blockers, and adds "no issues were found" filler.

// Ticket keys (ENGX-1), MRs (!4), issues (#12), commit hashes (a1b2c3d), and plain numbers.
const ID_RE = /\b[A-Za-z][A-Za-z0-9]{1,9}-\d+\b|![0-9]+\b|#\d+\b|\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b|\b\d+(?:\.\d+)?%?/g;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
// Words that claim something happened. Each needs support from the log line the sentence is about.
const ACTION = /^(add(s|ed|ing)|updated|updating|modified|created|built|implemented|tested|deployed|shipped|released|launched|fixed|resolved|closed|merged|approved|rejected|complete|completed|finished|done|signed|hired|won|lost|cancell?ed|blocked|passed|failed|delivered|published|migrated|documented|wrote|written|developed|designed|configured|refactored|integrated|installed|improved|optimi[sz]ed|rewrote|redesigned|introduced|enabled|removed|deleted|upgraded|automated)$/;
// Ways of saying "finished": a line under the draft's Done heading supports any of them.
const DONE = /^(complet\w*|finish\w*|done|wrote|written)$/;
const NEGATION = /\b(no|not|none|nothing|never|without)\b/i;
const PREAMBLE = /^\s*(here(’|')s|here is|below is|this (week(’|')s )?(update|summary|activity log)|the following)\b/i;
// Glue a rewrite may add freely: it connects facts, it doesn't state one.
const GLUE = new Set(['this', 'that', 'with', 'from', 'into', 'also', 'were', 'have', 'been', 'some', 'more', 'other', 'various',
  'related', 'including', 'items', 'item', 'task', 'tasks', 'activity', 'activities', 'spent', 'time', 'week', 'weekly', 'during',
  'here', 'there', 'their', 'work', 'worked', 'working', 'continued', 'progress', 'progressed', 'reviewed', 'review', 'looked',
  'explored', 'researched', 'focused', 'focus', 'team', 'update', 'updates', 'status', 'today', 'yesterday', 'next', 'across',
  'several', 'multiple', 'main', 'mostly', 'about', 'around', 'well', 'made', 'make', 'used', 'using', 'blockers', 'notes',
  'note', 'summary', 'highlights', 'what', 'went', 'where', 'which', 'while', 'held', 'conducted', 'calls', 'call', 'accounts',
  'account', 'specific', 'ongoing', 'currently', 'performed', 'occurred', 'page', 'pages', 'viewed', 'visited']);

/** Words of 4+ letters, lowercased. @param {string} s */
const words = (s) => s.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
/** Every word, any length, lowercased. @param {string} s */
const allWords = (s) => s.toLowerCase().match(/[a-z]+/g) || [];
/** adding, added, adds, add → add; merged, merge → merg. @param {string} w */
const stem = (w) => w.replace(/(ing|ed|es|s|e)$/, '').replace(/(.)\1$/, '$1').slice(0, 4);
const isHeading = (/** @type {string} */ l) => /^\s*(#{1,6}\s|\*\*[^*]+\*\*:?\s*$|[A-Z][^.!?]{0,60}:\s*$)/.test(l);
/** Markdown # depth; bold or "Label:" headings rank below all of them. @param {string} l */
const level = (l) => (l.match(/^\s*(#{1,6})\s/)?.[1]?.length ?? 7);
/** [Status] tags, not Markdown links. @param {string} s */
const tags = (s) => (s.match(/\[[^\]\n]+\](?!\()/g) || []).map((t) => t.toLowerCase());
const indent = (/** @type {string} */ l) => l.match(/^\s*/)?.[0].length ?? 0;

/** @typedef {{ text: string, section: string, block: string }} Source */
/** @typedef {{ lower: string, vocab: Set<string>, short: string[], src: Source[], draftTags: Set<string>, negates: boolean }} Draft */

/** Each draft line with its section heading and its block (the top-level bullet and what's nested under it). @param {string} draft @returns {Source[]} */
function sources(draft) {
  const lines = draft.split('\n');
  /** @type {Source[]} */ const out = [];
  let section = '';
  lines.forEach((l, i) => {
    if (/^\s*#/.test(l)) { section = l.toLowerCase(); return; }
    if (!l.trim()) return;
    let top = i;
    while (top > 0 && indent(lines[top] ?? '') > 0 && !/^\s*#/.test(lines[top - 1] ?? '')) top--;
    let end = top + 1;
    while (end < lines.length && indent(lines[end] ?? '') > 0) end++;
    out.push({ text: l.toLowerCase(), section, block: lines.slice(top, end).join('\n').toLowerCase() });
  });
  return out;
}

/** The draft lines a sentence is about: the ones sharing its IDs (weighted) and the most words with it. @param {string} plain @param {Source[]} src */
function about(plain, src) {
  const ids = (plain.match(ID_RE) || []).map((x) => x.toLowerCase()).filter((x) => !/^\d/.test(x));
  const w = words(plain).filter((x) => !GLUE.has(x) && !ACTION.test(x));
  const score = (/** @type {Source} */ s) => 3 * ids.filter((x) => s.text.includes(x)).length + w.filter((x) => s.text.includes(x)).length;
  const best = Math.max(0, ...src.map(score));
  return best ? src.filter((s) => score(s) === best) : [];
}

/** An action word the sentence's own log lines don't back, or undefined. @param {string} plain @param {Source[]} ctx */
function unbackedAction(plain, ctx) {
  // The line's own block only: a section name like "Merge requests and code" is a category, not an outcome.
  const where = ctx.map((s) => s.block).join('\n');
  const there = new Set(allWords(where).map(stem));
  const underDone = ctx.some((s) => /\bdone\b/.test(s.section));
  return allWords(plain).find((x) => ACTION.test(x) && !(DONE.test(x) && underDone) && !there.has(stem(x)));
}

/**
 * Why one sentence isn't backed by the draft, or '' when it is.
 * @param {string} sentence @param {Draft} d @param {string} [label] the bullet's bold label, if any
 */
export function sentenceProblem(sentence, d, label = '') {
  const plain = sentence.replace(/`([^`]*)`/g, '$1');
  // The model's own label ("**ENGX-151: CSV export**") tells which log line a sentence is about; its claims are in the sentence.
  const scope = label ? `${label} ${plain}` : plain;
  if (PREAMBLE.test(plain)) return 'preamble';
  if (/^[\s*_-]*(none|n\/a|nothing)[\s.*_]*(identified|reported|so far)?[\s.*_]*$/i.test(plain)) return 'fills in Blockers';
  const id = (scope.match(ID_RE) || []).find((x) => !d.lower.includes(x.toLowerCase()));
  if (id) return `invented ${id}`;
  const counted = allWords(plain).find((x) => NUMBER_WORDS.includes(x) && !d.lower.includes(x) && !d.lower.includes(String(NUMBER_WORDS.indexOf(x))));
  if (counted) return `invented “${counted}”`;
  const tag = tags(plain).find((t) => !d.draftTags.has(t));
  if (tag) return `invented ${tag}`;
  if (NEGATION.test(plain) && !d.negates) return 'claims something didn’t happen';
  const w = words(scope);
  const action = unbackedAction(plain, about(scope, d.src));
  if (action) return `claims “${action}”`;
  const content = w.filter((x) => !GLUE.has(x) && !ACTION.test(x));
  // Every ID left in the sentence is verified by now: each one counts as a known word ("Address QA-77").
  const ids = (plain.match(ID_RE) || []).filter((x) => !/^\d/.test(x)).length;
  if (!content.length) return '';
  // The log abbreviates ("spec", "Doc"): a log word that starts this one counts.
  const spelled = (/** @type {string} */ x) => NUMBER_WORDS.includes(x) && d.lower.includes(String(NUMBER_WORDS.indexOf(x)));
  const known = ids + content.filter((x) => d.vocab.has(x) || d.lower.includes(x) || spelled(x) || d.short.some((v) => x.startsWith(v))).length;
  return known * 2 >= content.length + ids ? '' : 'not in your log';
}

/** A line's bullet and bold label, then its sentences (a trailing [tag] counts as one). @param {string} line */
function split(line) {
  const m = line.match(/^(\s*(?:[-*+]|\d+\.)\s+(?:\*\*[^*]+\*\*:?\s*)?)?(.*)$/) ?? [];
  const parts = (m[2] ?? '').split(/(?<=[.!?;])\s+|\s+(?=\[[^\]]+\]\s*$)/).filter((s) => s.trim());
  return { prefix: m[1] ?? '', parts };
}

/** True when a draft has nothing for a model to rewrite: no point asking, it only invents. @param {string} draft */
export const isEmptyDraft = (draft) => !draft.split('\n').some((l) => /^\s*[-*+]\s+\S/.test(l) && !/^\s*-\s+Nothing tracked/.test(l));

/**
 * Keep only what the draft supports, sentence by sentence; drop headings left with nothing under them.
 * @param {string} draft @param {string} out
 * @returns {{ text: string, dropped: string[] }}
 */
export function ground(draft, out) {
  /** @type {Draft} */
  const d = { lower: draft.toLowerCase(), vocab: new Set(words(draft)), short: [...new Set(allWords(draft).filter((w) => w.length >= 3))], src: sources(draft), draftTags: new Set(tags(draft)), negates: NEGATION.test(draft) };
  /** @type {string[]} */ const kept = [];
  /** @type {string[]} */ const dropped = [];
  const seen = new Set();
  for (const line of out.split('\n')) {
    if (!line.trim()) { kept.push(line); continue; }
    if (isHeading(line)) {
      const why = PREAMBLE.test(line) ? 'preamble' : tags(line).find((t) => !d.draftTags.has(t));
      if (why) { dropped.push(`${line.trim()} (${why})`); continue; }
      // A heading can claim too: "**Done**" over work the log never marked done becomes "Other".
      const claim = allWords(line).find((x) => (ACTION.test(x) || DONE.test(x)) && !d.lower.includes(x));
      if (claim) { dropped.push(`${line.trim()} (claims “${claim}”)`); kept.push(line.replace(/[A-Za-z][^*#:]*[A-Za-z]/, 'Other')); continue; }
      kept.push(line);
      continue;
    }
    // An invented ID makes the whole line's subject fake: "Bug-456: Testing completed; status is Open."
    const fake = (line.match(ID_RE) || []).find((x) => !d.lower.includes(x.toLowerCase()));
    if (fake) { dropped.push(`${line.trim()} (invented ${fake})`); continue; }
    const { prefix, parts } = split(line);
    const label = prefix.match(/\*\*([^*]+)\*\*/)?.[1] ?? '';
    const good = parts.filter((p) => {
      const why = sentenceProblem(p, d, label);
      if (why) dropped.push(`${p.trim()} (${why})`);
      return !why;
    });
    // The same item twice ("Worked on Customer 1" / "Reviewed Customer 1") is padding, not news.
    const key = (label + ' ' + good.join(' ')).toLowerCase().replace(/^\W*(worked on|reviewed|review of|focused on|prepared)\s+/, '').replace(/\W+/g, ' ').trim();
    if (good.length && seen.has(key)) { dropped.push(`${line.trim()} (repeats an item)`); continue; }
    seen.add(key);
    if (good.length) kept.push(prefix + good.join(' '));
    // Every sentence invented, but the label is a real log item (**Figma: Onboarding flow:**): keep the item, not the claim.
    else if (label && !sentenceProblem(label, d)) kept.push(prefix.replace(/\*\*([^*]+?):?\*\*:?\s*$/, '**$1**'));
  }
  // A heading survives only if a content line follows before the next heading of the same or a higher level.
  const lines = kept.filter((l, i) => {
    if (!isHeading(l)) return true;
    for (const n of kept.slice(i + 1)) {
      if (!n.trim()) continue;
      if (!isHeading(n)) return true;
      if (level(n) <= level(l)) return false;
    }
    return false;
  });
  if (!lines.some((l) => l.trim() && !isHeading(l))) return { text: '', dropped };
  let text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // A standup's Blockers line is left blank for the person: a filled-in "None" gets pasted unread.
  if (/^#+\s*Blockers\s*\n-\s*$/m.test(draft) && !/blockers/i.test(text)) text += '\n\n### Blockers\n- ';
  return { text: text + '\n', dropped };
}
