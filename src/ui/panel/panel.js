// The side panel (spec §3.1). Tabs are a list, in the spec's order: Today, Notes, Update (the week's update; the id stays 'week'). Each tab mounts once into its own tabpanel and keeps
// itself current from storage changes.
import '../components/theme.js';
import { $, h } from '../components/dom.js';
import { bindKeys, onNewDay } from '../components/keys.js';
import { report } from '../components/undo.js';
import * as todayTab from './today-tab.js';
import * as weekTab from './week-tab.js';
import * as notesTab from './notes-tab.js';
import * as footer from './footer.js';
import { getSettings, onSettingsChanged } from '../../lib/settings.js';
import { openTab } from './open-tab.js';

/** @typedef {{ id: string, label: string, mount: (host: HTMLElement, api: { showToday: () => void }) => void, refresh: () => void }} Tab */

/** @type {Tab[]} */
export const TABS = [
  { id: 'today', label: 'Today', mount: todayTab.mount, refresh: todayTab.refresh },
  { id: 'notes', label: 'Notes', mount: notesTab.mount, refresh: notesTab.refresh },
  { id: 'week', label: 'Update', mount: weekTab.mount, refresh: weekTab.refresh },
];

export const openApp = () => openTab('src/ui/app/app.html');

// The app's pages the panel has no tab for, one click each (Stats only when switched on in Settings → Advanced).
async function appLinks() {
  const showStats = await getSettings().then((s) => s.showStats, () => false);
  const views = [['tasks', 'Tasks'], ['calendar', 'Calendar'], ...(showStats ? [['stats', 'Stats']] : [])];
  $('#appLinks').replaceChildren('Open: ', ...views.flatMap(([id, label], i) => [i ? ' · ' : '',
    h('button', { id: `open-${id}`, type: 'button', class: 'quiet link', attrs: { title: `Open ${label} in the full app` },
      on: { click: () => void openTab(`src/ui/app/app.html#${id}`).catch(report) } }, label)]), ' ↗');
}

/** Select a tab; only it is in the tab order (roving tabindex). @param {string} id */
function select(id) {
  for (const t of TABS) {
    const tab = $(`#tab-${t.id}`);
    tab.setAttribute('aria-selected', String(t.id === id));
    tab.tabIndex = t.id === id ? 0 : -1;
    $(`#panel-${t.id}`).hidden = t.id !== id;
  }
}

/** ARIA tabs pattern: Left/Right wrap, Home/End jump, and the tab you land on is selected. @param {KeyboardEvent} e */
function tabKeys(e) {
  const i = TABS.findIndex((t) => `tab-${t.id}` === document.activeElement?.id);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
  if (i < 0 || next === undefined) return;
  e.preventDefault();
  const t = /** @type {Tab} */ (TABS[(next + TABS.length) % TABS.length]);
  select(t.id);
  $(`#tab-${t.id}`).focus();
}

function init() {
  for (const t of TABS) {
    $('#tabs').append(h('button', { id: `tab-${t.id}`, tabIndex: -1, attrs: { role: 'tab', 'aria-selected': 'false', 'aria-controls': `panel-${t.id}` }, on: { click: () => select(t.id) } }, t.label));
    const host = h('section', { id: `panel-${t.id}`, attrs: { role: 'tabpanel', 'aria-labelledby': `tab-${t.id}` } });
    $('#tabPanels').append(host);
    t.mount(host, { showToday: () => { select('today'); todayTab.focusAdd(); } });
  }
  select('today');
  $('#tabs').addEventListener('keydown', (e) => tabKeys(/** @type {KeyboardEvent} */ (e)));
  const openSettings = () => openTab('src/ui/settings/settings.html').catch(report);
  $('#openSettings').onclick = openSettings;
  $('#openSettings2').onclick = openSettings;
  void appLinks();
  onSettingsChanged(() => void appLinks());
  footer.init({ showNotes: () => { select('notes'); notesTab.focusAdd(); } });
  // Alt+N where Chrome keeps scripts out opens the panel on Notes (spec §3.4): an open
  // panel is told at once; a panel that is just opening asks the worker which tab.
  // Only the worker sends panel:show: anything carrying sender.tab is a content script or a page.
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!sender.tab && msg?.type === 'panel:show' && TABS.some((t) => t.id === msg.tab)) select(msg.tab);
    return false;
  });
  void chrome.runtime.sendMessage({ type: 'panel:hello' }).then((r) => { if (TABS.some((t) => t.id === r?.tab)) select(r.tab); }, () => undefined);
  bindKeys({
    n: () => { select('today'); todayTab.focusAdd(); },
    o: () => openApp().catch(report),
  });
  onNewDay(() => { TABS.forEach((t) => t.refresh()); footer.refresh().catch(report); });
}

init();
