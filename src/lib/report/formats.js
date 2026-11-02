// Pure converters from the draft Markdown (see draft.js) to what people paste into Slack, email, Docs/Notion/Confluence.
// The draft only emits: ##/###/#### headings, "- " bullets (nested by 2 spaces), a _italic_ line, **bold**, [text](url), plain text.
/** @typedef {{ kind: 'h', level: number, text: string } | { kind: 'li', depth: number, text: string } | { kind: 'p', text: string }} Block */
/** @typedef {{ id: string, label: string, done: string }} Format */

/** @type {Format[]} */
export const FORMATS = [
  { id: 'markdown', label: 'Markdown', done: 'Copied as Markdown.' },
  { id: 'slack', label: 'Slack', done: 'Copied for Slack — paste it into your channel.' },
  { id: 'email', label: 'Email', done: 'Copied for email — the first line is the subject. Paste it into a new message.' },
  { id: 'rich', label: 'Rich text (Docs, Notion)', done: 'Copied with formatting — paste it into Docs, Notion or Confluence.' },
  { id: 'ai', label: 'With AI prompt (ChatGPT, Claude…)', done: 'Prompt copied. Paste it into your AI assistant.' },
];

/** @param {string} md @returns {Block[]} */
export function parse(md) {
  /** @type {Block[]} */
  const out = [];
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if (!line.trim()) continue;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) out.push({ kind: 'h', level: /** @type {string} */ (m[1]).length, text: /** @type {string} */ (m[2]) });
    else if ((m = /^(\s*)[-*•]\s+(.*)$/.exec(line))) out.push({ kind: 'li', depth: Math.floor(/** @type {string} */ (m[1]).replace(/\t/g, '  ').length / 2), text: /** @type {string} */ (m[2]) });
    else if (/^\s*[-*•]$/.test(line)) continue;           // empty placeholder bullet (Blockers)
    else out.push({ kind: 'p', text: line.trim() });
  }
  return out;
}

/** @typedef {{ t: 'text' | 'bold' | 'link', text: string, url?: string }} Span */
/** @param {string} s @returns {Span[]} */
export function inline(s) {
  /** @type {Span[]} */
  const out = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(.+?)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: 'text', text: s.slice(last, m.index) });
    out.push(m[2] ? { t: 'link', text: /** @type {string} */ (m[1]), url: m[2] } : { t: 'bold', text: /** @type {string} */ (m[3]) });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: 'text', text: s.slice(last) });
  return out;
}

/** A whole line wrapped in _underscores_ (the "no activity" note). @param {string} s */
export const italicLine = s => /^_[^_].*_$/.test(s) ? s.slice(1, -1) : null;

/** @param {Block[]} blocks @returns {Block[]} li depth can't jump more than one level */
export function clampDepth(blocks) {
  let prev = -1;
  return blocks.map(b => {
    if (b.kind !== 'li') { prev = -1; return b; }
    prev = Math.min(b.depth, prev + 1);
    return { ...b, depth: prev };
  });
}

/** Splits plain text on "[In Review]"-style status tags (links are already gone by then). @param {string} s @returns {{ tag: boolean, text: string }[]} */
export function splitTags(s) {
  return s.split(/(\[[^\]]+\])/).filter(Boolean).map(t => /^\[[^\]]+\]$/.test(t) ? { tag: true, text: t.slice(1, -1) } : { tag: false, text: t });
}

/** @param {string} s */
const slackEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** @param {string} u */
const slackUrl = u => u.replace(/[<>|]/g, c => encodeURIComponent(c));
/** @param {string} s */
const slackInline = s => inline(s).map(p => p.t === 'link' ? `<${slackUrl(/** @type {string} */ (p.url))}|${slackEsc(p.text)}>`
  : p.t === 'bold' ? `*${slackEsc(p.text)}*` : slackEsc(p.text)).join('');

/** Slack mrkdwn: bold headings, • bullets, <url|text> links. @param {string} md */
export function toSlack(md) {
  return clampDepth(parse(md)).map(b => {
    if (b.kind === 'h') return `\n*${slackInline(b.text)}*`;
    if (b.kind === 'li') return `${'    '.repeat(b.depth)}${b.depth ? '◦' : '•'} ${slackInline(b.text)}`;
    const it = italicLine(b.text);
    return it === null ? slackInline(b.text) : `_${slackEsc(it)}_`;
  }).join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n') + '\n';
}

/** @param {string} s */
const plainInline = s => inline(s).map(p => p.t === 'link' ? (p.text === p.url ? p.text : `${p.text} (${p.url})`) : p.text).join('');

/** Plain text: no markup at all, bullets as "- ", links as "text (url)". @param {string} md */
export function toPlain(md) {
  return clampDepth(parse(md)).map(b => {
    if (b.kind === 'h') return `\n${plainInline(b.text)}`;
    if (b.kind === 'li') return `${'  '.repeat(b.depth)}- ${plainInline(b.text)}`;
    return plainInline(italicLine(b.text) ?? b.text);
  }).join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n') + '\n';
}

/** "## Weekly update: Oct 27 to Oct 31" → "Weekly update – week of Oct 27"; "## Standup" → "Standup". @param {string} md */
export function emailSubject(md) {
  const h = parse(md).find(b => b.kind === 'h');
  const text = h ? plainInline(h.text) : 'Weekly update';
  const m = /^(.*?):\s*(.+?)\s+to\s+.+$/.exec(text);
  return m ? `${m[1]} – week of ${m[2]}` : text;
}

/** Email: subject on the first line, then the body (the heading is the subject, so it's dropped from the body). @param {string} md */
export function toEmail(md) {
  const first = parse(md)[0];
  const body = toPlain(first?.kind === 'h' && first.level <= 2 ? md.slice(md.indexOf('\n') + 1) : md).trim();
  return `Subject: ${emailSubject(md)}\n\n${body}\n`;
}

/** @param {string} s */
export const htmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** @param {string} s */
const htmlInline = s => inline(s).map(p => p.t === 'link' ? `<a href="${htmlEsc(/** @type {string} */ (p.url))}">${htmlEsc(p.text)}</a>`
  : p.t === 'bold' ? `<strong>${htmlEsc(p.text)}</strong>` : htmlEsc(p.text)).join('');

/** Rich text for Docs / Notion / Confluence. Every piece of text and every URL is escaped. @param {string} md */
export function toHtml(md) {
  let out = '', cur = -1;
  const closeList = () => { if (cur < 0) return; out += '</li>'; while (cur-- > 0) out += '</ul></li>'; out += '</ul>'; cur = -1; };
  for (const b of clampDepth(parse(md))) {
    if (b.kind !== 'li') {
      closeList();
      if (b.kind === 'h') { const n = Math.min(Math.max(b.level, 2), 4); out += `<h${n}>${htmlInline(b.text)}</h${n}>`; }
      else { const it = italicLine(b.text); out += `<p>${it === null ? htmlInline(b.text) : `<em>${htmlEsc(it)}</em>`}</p>`; }
      continue;
    }
    if (cur < 0) { out += '<ul>'; cur = 0; }
    else if (b.depth > cur) { out += '<ul>'; cur++; }
    else { out += '</li>'; while (cur > b.depth) { out += '</ul></li>'; cur--; } }
    out += `<li>${htmlInline(b.text)}`;
  }
  closeList();
  return out;
}

/**
 * What goes on the clipboard for a non-AI format.
 * @param {string} id @param {string} md @returns {{ text: string, html?: string }}
 */
export function convert(id, md) {
  if (id === 'slack') return { text: toSlack(md) };
  if (id === 'email') return { text: toEmail(md) };
  if (id === 'rich') return { text: toPlain(md), html: toHtml(md) };
  return { text: md };
}
