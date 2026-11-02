// Copy the draft in the format the reader's tool wants, and post to Slack when a webhook is set.
import { saveShareOk, getReportPrefs, saveCopyAs } from '../../lib/report-store.js';
import { $, h } from '../components/dom.js';
import { aiSystemPrompt } from '../../lib/report/ai.js';
import { postToSlack } from '../../lib/report/integrations.js';
import { FORMATS, convert } from '../../lib/report/formats.js';
import { getW, msg } from './main.js';


/** The trigger to put focus back on when the question is dismissed. @type {HTMLElement | null} */
let asker = null;
const closeAsk = () => { $('#shareAsk').hidden = true; asker?.focus(); };

// Asked once per destination, inline in the draft panel. `go` runs inside the confirm click, so Slack's permission
// prompt still has its user gesture.
function okToShare(kind, question, okLabel, go) {
  const W = getW();
  if (W.shareOk[kind]) return go();
  asker = /** @type {HTMLElement} */ (document.activeElement);
  msg('#askText', question); msg('#askOk', okLabel);
  $('#shareAsk').hidden = false;
  $('#askOk').focus();
  $('#askOk').onclick = () => {
    W.shareOk[kind] = true;
    void saveShareOk(W.shareOk);
    closeAsk();
    return go();
  };
}

/** Rich text goes as HTML + plain; browsers without ClipboardItem (or that refuse it) get the plain text. */
async function write({ text, html }) {
  if (html && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      return;
    } catch (e) { console.warn('[worklog] rich copy failed, using plain text', e); }
  }
  await navigator.clipboard.writeText(text);
}

const AI_SHARE = 'This copies your update draft (page titles, ticket and customer names) so you can paste it into an AI chat like ChatGPT or Claude. Once pasted, it leaves this computer. Tip: tick “Hide names” first.';

function copyUpdate() {
  const id = $('#copyAs').value;
  const fmt = FORMATS.find(f => f.id === id) ?? FORMATS[0];
  if (id !== 'ai') return doCopy(convert(id, $('#md').value), fmt);
  const W = getW();
  return okToShare('ai', AI_SHARE, 'Copy anyway', () => doCopy(
    { text: `${aiSystemPrompt(W.settings.role, W.settings.template)} Ask me if something is unclear.\n\nActivity log:\n\n${$('#md').value}` }, fmt));
}

/** @param {{ text: string, html?: string }} out @param {{ done: string }} fmt */
async function doCopy(out, fmt) {
  try { await write(out); msg('#copyMsg', fmt.done); }
  catch (e) { msg('#copyMsg', `Couldn’t copy: ${e.message}`); return; }
  setTimeout(() => msg('#copyMsg', ''), 4000);
}

export async function init() {
  const sel = $('#copyAs');
  FORMATS.forEach(f => sel.append(h('option', { value: f.id }, f.label)));
  const saved = (await getReportPrefs()).copyAs;
  if (FORMATS.some(f => f.id === saved)) sel.value = saved;
  sel.onchange = () => saveCopyAs(sel.value);
  $('#copyMd').onclick = copyUpdate;
  $('#askCancel').onclick = closeAsk;
  $('#shareAsk').addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeAsk(); } });
  $('#slackBtn').onclick = () => okToShare('slack', 'This posts your update to the Slack channel behind your webhook.', 'Post', async () => {
    try { await postToSlack(getW().settings.slackWebhook, $('#md').value); msg('#copyMsg', 'Posted to Slack.'); }
    catch (e) { msg('#copyMsg', e.message); }
  });
}
