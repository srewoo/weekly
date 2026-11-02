// Report-page controls for the Chrome built-in AI tidy-up (see lib/report/ai.js).
import { $ } from '../components/dom.js';
import { aiAvailability, aiRewrite } from '../../lib/report/ai.js';
import { getW, msg } from './main.js';
import { saveDraft, setEdited, setMd } from './draft-panel.js';

const AI_LABEL = 'Polish with on-device AI';
/** @type {AbortController | null} */
let aiAbort = null;
let beforeAi = null;

/** True while a rewrite streams into the draft: the draft must not be overwritten or saved meanwhile. */
export const aiBusy = () => !!aiAbort;

async function updateAiState() {
  const a = await aiAvailability();
  // Can't run here: hide the whole block, silently ("Copy as → With AI prompt" still works anywhere).
  const off = a === 'unsupported' || a === 'unavailable';
  /** @type {HTMLElement} */ ($('.ai')).hidden = off;
  msg('#aiMsg', off ? '' : {
    downloadable: 'Runs on this computer. The first use downloads Chrome’s AI model (about 2 GB, once).',
    downloading: 'Chrome’s AI model is downloading in the background…',
  }[a] ?? 'Runs on this computer; nothing is sent anywhere.');
}

async function tidyUp() {
  if (aiAbort) { aiAbort.abort(); return; }          // second click stops it
  aiAbort = new AbortController();
  const W = getW();
  const original = $('#md').value;
  $('#md').readOnly = true;
  $('#aiBtn').textContent = 'Stop';
  msg('#aiMsg', 'Writing on this computer…');
  try {
    const { text, dropped } = await aiRewrite(original, {
      role: W.settings.role, template: W.settings.template, signal: aiAbort.signal,
      onProgress: p => msg('#aiMsg', `Downloading Gemini Nano… ${Math.round(p * 100)}%`),
      onText: t => setMd(t),
    });
    setMd(text);
    beforeAi = original; $('#aiUndo').hidden = false;
    await saveDraft(); setEdited(true);
    msg('#aiMsg', dropped.length
      ? `Done. Removed ${dropped.length} line${dropped.length === 1 ? '' : 's'} that added details not in your log. Read it before sending.`
      : 'Done. Every line matches your log; still read it before sending.');
    if (dropped.length) console.info('[weekly] AI lines removed:', dropped);
  } catch (e) {
    setMd(original);
    msg('#aiMsg', e.name === 'AbortError' ? 'Stopped.' : e.name === 'UngroundedError' ? e.message : `On-device AI failed: ${e.message}`);
  } finally {
    aiAbort = null; $('#md').readOnly = false; $('#aiBtn').textContent = AI_LABEL;
  }
}

export function init() {
  $('#aiBtn').onclick = tidyUp;
  $('#aiUndo').onclick = async () => {
    setMd(beforeAi); beforeAi = null; $('#aiUndo').hidden = true;
    await saveDraft(); msg('#aiMsg', 'Restored the draft from before the AI rewrite.');
  };
  updateAiState();
}
