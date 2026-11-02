// Full end-to-end run of the Weekly Work Log extension in Chromium.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.env.PLAYWRIGHT_PATH ?? '/Users/sharajrewoo/.npm/_npx/9833c18b2d85bc59/node_modules/');
const { chromium } = require('playwright');
const [ext, exe, outDir, headed] = process.argv.slice(2);
const S = outDir, shots = outDir + '/shots';
export const PAGES = { report: 'src/ui/report/report.html', panel: 'src/ui/panel/panel.html', app: 'src/ui/app/app.html', welcome: 'src/ui/welcome/welcome.html', settings: 'src/ui/settings/settings.html', remind: 'src/ui/remind/remind.html' };
fs.mkdirSync(shots, { recursive: true });

// Date helpers live on the Node side: same semantics as the extension (local calendar, Monday-start week, Mon-Fri workdays).
// Values are computed here and passed into sw.evaluate, so the suite does not depend on service-worker globals.
const isWorkday = d => { const g = new Date(d).getDay(); return g >= 1 && g <= 5; };
const pad = n => String(n).padStart(2, '0');
const dayKey = d => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const weekStart = (off = 0, from = new Date()) => { const d = new Date(from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const results = [];
const check = (area, name, ok, detail = '') => {
  results.push({ area, name, ok: !!ok, detail: String(detail).slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${area}] ${name}${detail && !ok ? ' — ' + String(detail).slice(0, 300) : ''}`);
};
const wait = ms => new Promise(r => setTimeout(r, ms));

const ctx = await chromium.launchPersistentContext('', { headless: headed !== 'headed', executablePath: exe,
  viewport: { width: 1280, height: 900 }, acceptDownloads: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });

// ---- Fake websites and APIs (served inside the browser) ----
const page = html => ({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
const SITES = {
  'https://acme.atlassian.net/browse/ENGX-1': '[ENGX-1] Fix login timeout - Jira',
  'https://gitlab.com/acme/app/-/merge_requests/4': 'ENGX-1 fix login timeout (!4) · Merge requests · acme / app · GitLab',
  'https://app.hubspot.com/contacts/42/record/0-3/777': 'Acme Corp renewal | Deal | HubSpot',
  'https://app.greenhouse.io/people/9001': 'Jane Doe - Senior QA | Greenhouse',
  'https://search.google.com/search-console/performance': 'Performance - Google Search Console',
  'https://www.youtube.com/watch?v=abc': 'Cat video - YouTube',
  'https://dev.to/some-article': 'Some article - DEV Community',
};
let slackBody = null, statusCalls = 0;
await ctx.route('**/*', async route => {
  const url = route.request().url();
  if (url.startsWith('https://acme.atlassian.net/rest/api/2/issue/ENGX-1')) { statusCalls++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fields: { status: { name: 'In Review' } } }) }); }
  if (url.startsWith('https://gitlab.com/api/v4/projects/acme%2Fapp/merge_requests/4')) { statusCalls++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state: 'merged' }) }); }
  if (url.startsWith('https://hooks.slack.com/services/')) { slackBody = route.request().postDataJSON(); return route.fulfill({ status: 200, body: 'ok' }); }
  if (SITES[url]) return route.fulfill(page(`<title>${SITES[url]}</title><h1>${SITES[url]}</h1>`));
  if (/^https?:\/\//.test(url)) return route.fulfill(page('<title>Other</title>'));
  return route.continue();
});

let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2];
const X = `chrome-extension://${id}`;
const store = () => sw.evaluate(() => chrome.storage.local.get(null));
// This machine may be running the test at the weekend. The report shows Mon–Fri only, so move today's data onto Friday.
const weekend = !isWorkday(new Date());
const workday = isWorkday(new Date()) ? dayKey(new Date()) : dayKey(addDays(weekStart(0), 4));
const toWorkday = () => isWorkday(new Date()) ? undefined : sw.evaluate(async ({ t, f }) => {
  for (const p of ['day:', 'hist:', 'meta:']) {
    const o = await chrome.storage.local.get([p + t, p + f]);
    if (!o[p + t]) continue;
    const into = o[p + f] || {};
    if (p === 'meta:') into.switches = (into.switches || 0) + (o[p + t].switches || 0);
    else for (const [k, e] of Object.entries(o[p + t])) into[k] = into[k] ? { ...e, ms: into[k].ms + e.ms } : e;
    await chrome.storage.local.set({ [p + f]: into });
    await chrome.storage.local.remove(p + t);
  }
}, { t: dayKey(new Date()), f: dayKey(addDays(weekStart(0), 4)) });
console.log('Running on a ' + (weekend ? 'weekend: today\'s data is moved to Friday for report checks' : 'weekday'));
const today = () => dayKey(new Date());
const errors = [];
const watch = p => { p.on('pageerror', e => errors.push(`${p.url()}: ${e.message}`)); p.on('console', m => m.type() === 'error' && errors.push(`${p.url()}: ${m.text()}`)); return p; };
await wait(500);
// Settings is its own page now: `set` is the tab that stays on it, and `rep` stays on the report.
let set;
const openSettings = async p => { await p.bringToFront(); await p.goto(`${X}/${PAGES.settings}`); await wait(700); return p; };

// ===== 1. Install =====
let st = await store();
check('Install', 'device ID created on install', /^[0-9a-f-]{36}$/.test(st.deviceId), st.deviceId);
const alarms = await sw.evaluate(() => chrome.alarms.getAll());
check('Install', 'one-minute tick alarm scheduled', alarms.some(a => a.name === 'tick' && a.periodInMinutes === 1), JSON.stringify(alarms));
check('Install', 'badge starts clear', (await sw.evaluate(() => chrome.action.getBadgeText({}))) === '');

// ===== 1b. First-run welcome page =====
await wait(500);
const welcome = ctx.pages().find(p => p.url().endsWith('/' + PAGES.welcome));
check('Welcome', 'opens by itself on install', !!welcome, ctx.pages().map(p => p.url()).join(', '));
if (welcome) {
  watch(welcome);
  check('Welcome', 'states what is and isn’t recorded', /never does/i.test(await welcome.textContent('.facts')) && /keystrokes/.test(await welcome.textContent('.facts')));
  await welcome.click('#trackYes'); await wait(400);
  check('Welcome', '"Track my week?" comes first; yes turns tracking on and offers the history fill (W3)', /Tracking is on/.test(await welcome.textContent('#trackMsg')) && await welcome.isVisible('#fill'), await welcome.textContent('#trackMsg'));
  const slots = async () => (await sw.evaluate(() => chrome.alarms.getAll())).filter(a => /^weekly:(morning|evening)$/.test(a.name)).length;
  check('Welcome', 'reminders start on without a checkbox here (no Friday alarm)', await slots() === 2 && !(await welcome.locator('#reminders').count())
    && !(await sw.evaluate(() => chrome.alarms.get('reminder'))));
  await welcome.click('#fill'); await wait(1500);
  check('Welcome', 'history fill gives a plain answer', /Nothing to fill in yet|filled in/.test(await welcome.textContent('#fillMsg')), await welcome.textContent('#fillMsg'));
  await welcome.screenshot({ path: shots + '/0-welcome.png', fullPage: true });
  await welcome.click('#done'); await wait(800);
  check('Welcome', '"Go to my update" goes to the report', welcome.url().endsWith('/' + PAGES.report));
  await welcome.close();
  // Reset so the history phase below starts from a clean slate.
  await sw.evaluate(async () => { const all = await chrome.storage.local.get(null); await chrome.storage.local.remove(Object.keys(all).filter(k => k.startsWith('hist:'))); });
}

// ===== 2. History backfill (before any live tracking) =====
// 14400 s (4 h) is the chrome.idle maximum: an unattended run must not count as idle because nobody touched the machine for an hour.
// Reminders stay off for the run, so a real 09:00 or 18:00 never opens a window mid-suite; reminders.mjs turns them on itself.
await sw.evaluate(() => chrome.storage.local.set({ settings: { paused: true, minMinutes: 0, idleSeconds: 14400,
  morning: { enabled: false, time: '09:00' }, evening: { enabled: false, time: '18:00' } } }));
const browse = await ctx.newPage();
for (const [url, ms] of [['https://acme.atlassian.net/browse/ENGX-1', 7000], ['https://app.hubspot.com/contacts/42/record/0-3/777', 6000], ['https://app.greenhouse.io/people/9001', 500]]) {
  await browse.goto(url); await wait(ms);
}
let rep = watch(await ctx.newPage());
await rep.goto(`${X}/${PAGES.report}`); await wait(700);
check('History', 'banner offers to fill untracked days', await rep.isVisible('#histBanner'), await rep.textContent('#histText'));
await rep.click('#histBtn'); await wait(2500);
check('History', 'fill reports one day filled', /Filled 1 day/.test(await rep.textContent('#histMsg')), await rep.textContent('#histMsg'));
check('History', 'banner hides after filling', !(await rep.isVisible('#histBanner')));
const histEntry = (await store())['hist:' + await today()];
check('History', 'Jira estimate ≈ 7 s gap (not inflated)', histEntry?.['jira:ENGX-1']?.ms >= 6000 && histEntry['jira:ENGX-1'].ms <= 9000, histEntry?.['jira:ENGX-1']?.ms);
await toWorkday(); await rep.reload(); await wait(800);
check('History', 'estimated day marked ~', (await rep.locator('.day.est .hrs').first().textContent()).startsWith('~'));
check('History', 'week strip shows Mon–Fri only', (await rep.locator('.day .name').allTextContents()).map(t => t.split(' ')[0]).join(',') === 'Mon,Tue,Wed,Thu,Fri');
const histItems = await rep.locator('.item .task').allTextContents();
check('History', 'history items classified like live tracking', histItems.some(t => t.includes('ENGX-1')) && histItems.some(t => t.includes('Acme Corp renewal')), histItems.join(' | '));
check('History', 'estimate explanation shown', await rep.isVisible('#estHint'));
await rep.screenshot({ path: shots + '/1-history.png', fullPage: true });

// ===== 3. Live tracking =====
set = watch(await ctx.newPage());
await openSettings(set);
await set.fill('#ignoreDomains', 'youtube.com');
await set.evaluate(() => { document.querySelector('#minMinutes')?.closest('details')?.setAttribute('open', ''); });
await set.fill('#minMinutes', '0');
await wait(1300);
await rep.bringToFront(); await rep.reload(); await wait(900);
await sw.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, paused: false } }); });
const tabs = {};
for (const url of ['https://acme.atlassian.net/browse/ENGX-1', 'https://gitlab.com/acme/app/-/merge_requests/4', 'https://app.hubspot.com/contacts/42/record/0-3/777', 'https://www.youtube.com/watch?v=abc', 'https://dev.to/some-article']) {
  tabs[url] = await ctx.newPage(); await tabs[url].goto(url);
}
const visit = async (url, ms) => { await tabs[url].bringToFront(); await wait(ms); };
await visit('https://acme.atlassian.net/browse/ENGX-1', 4000);
await visit('https://gitlab.com/acme/app/-/merge_requests/4', 3000);
await visit('https://app.hubspot.com/contacts/42/record/0-3/777', 3000);
await visit('https://www.youtube.com/watch?v=abc', 3000);
await visit('https://dev.to/some-article', 2000);
await visit('https://acme.atlassian.net/browse/ENGX-1', 2000);
await visit('https://app.hubspot.com/contacts/42/record/0-3/777', 1500);
st = await store();
const day = st['day:' + await today()] || {};
const sec = k => Math.round((day[k]?.ms || 0) / 1000);
check('Tracking', 'records the active tab (Jira ≈ 6 s)', sec('jira:ENGX-1') >= 5 && sec('jira:ENGX-1') <= 8, sec('jira:ENGX-1') + 's; keys: ' + Object.keys(day).join(', '));
check('Tracking', 'GitLab MR keyed by project and number', sec('mr:acme/app!4') >= 2, Object.keys(day).join(', '));
check('Tracking', 'MR carries the ticket ID from its title', day['mr:acme/app!4']?.tickets?.includes('ENGX-1'));
check('Tracking', 'HubSpot deal is its own Sales & CRM item', day['app:app.hubspot.com/contacts/42/record/0-3/777']?.category === 'Sales & CRM');
check('Tracking', 'ignored domain (youtube.com) not recorded', !Object.keys(day).some(k => k.includes('youtube')));
check('Tracking', 'dev.to is browsing, not a test environment', day['site:dev.to']?.category === 'Browsing', day['site:dev.to']?.category);
check('Tracking', 'task switches counted', (st['meta:' + await today()]?.switches || 0) >= 4, JSON.stringify(st['meta:' + await today()]));
check('Tracking', 'MR title cleaned (no GitLab suffix)', day['mr:acme/app!4']?.task === 'app !4: ENGX-1 fix login timeout', day['mr:acme/app!4']?.task);
check('Tracking', 'Jira title cleaned into "ID: summary"', day['jira:ENGX-1']?.task === 'ENGX-1: Fix login timeout', day['jira:ENGX-1']?.task);

// ===== 4. Side panel (replaces the popup) =====
const { panelChecks } = await import('./panel.mjs');
const iso = { today: dayKey(new Date()), yesterday: dayKey(addDays(new Date(), -1)), tomorrow: dayKey(addDays(new Date(), 1)), dayAfter: dayKey(addDays(new Date(), 2)) };
const harness = { ctx, X, sw, check, watch, store, wait, shots, PAGES, iso, workday, weekend, tabs, toSettings: () => openSettings(set),
  focusTab: () => tabs['https://acme.atlassian.net/browse/ENGX-1'].bringToFront() };
const pan = await panelChecks(harness);
const { panelTaskChecks, panelBandChecks, rolloverCheck } = await import('./panel-tasks.mjs');
await panelTaskChecks(harness, pan);
await panelBandChecks(harness, pan);
const { calendarChecks, daySheetChecks } = await import('./app.mjs');
const app = await calendarChecks(harness, pan);
await daySheetChecks(harness, app, pan);
const { taskViewChecks, taskEditChecks } = await import('./app-tasks.mjs');
await taskViewChecks(harness, app);
await taskEditChecks(harness, app);
const { notesTabChecks, notesViewChecks, onPageChecks } = await import('./notes.mjs');
await notesTabChecks(harness, pan);
await notesViewChecks(harness, pan);
await onPageChecks(harness, pan);
const { statsChecks } = await import('./stats.mjs');
await statsChecks(harness);

// ===== 5. Report and draft =====
await toWorkday();
await rep.reload(); await wait(1500);
// Browsing done while tracking was paused happened before live tracking began: its estimate is kept, live time added on top.
check('Report', 'history estimate kept for the hours before tracking began; live time added on top', await rep.locator('.day.est').count() === 1
  && /~/.test(await rep.locator('.day.est .hrs').first().textContent()), await rep.locator('.day.est').count());
check('Report', 'summary counts tickets, MRs and CRM records', /1 ticket, 1 merge request, 1 CRM record/.test(await rep.textContent('#summary')), await rep.textContent('#summary'));
let md = await rep.inputValue('#md');
check('Report', 'MR folded under its ticket', /- ENGX-1: Fix login timeout.*\n  - MR: app !4/.test(md), md);
check('Report', 'live Jira status fetched', md.includes('[In Review]') && statusCalls >= 1, md);
check('Report', 'live MR state fetched', md.includes('[merged]'), md);
check('Report', 'sales section present', md.includes('### Sales and customers\n- Acme Corp renewal'), md);
check('Report', 'note appears in the draft', md.includes('- Phone screen with 2 candidates'));
check('Report', 'no "Allow" banner when hosts are already allowed', !(await rep.isVisible('#connect')));
await rep.check('#incTime'); await wait(300);
check('Report', 'show time spent adds durations (~ where part is estimated)', /\(~?\d+m/.test(await rep.inputValue('#md')), await rep.inputValue('#md'));
await rep.uncheck('#incTime'); await wait(200);

// Exclusion is per week
await rep.uncheck('input[data-key="site:dev.to"]'); await wait(300);
await rep.uncheck('input[data-key="app:app.hubspot.com/contacts/42/record/0-3/777"]'); await wait(300);
md = await rep.inputValue('#md');
check('Report', 'unticked item leaves the draft', !md.includes('Acme Corp renewal'));
st = await store();
check('Report', 'exclusion stored for this week only', Object.keys(st).filter(k => k.startsWith('excluded')).length === 1 && Object.keys(st).some(k => k.startsWith('excluded:')));
await rep.check('input[data-key="app:app.hubspot.com/contacts/42/record/0-3/777"]'); await wait(300);

// Edits persist
await rep.click('#viewEdit'); await rep.click('#md'); await rep.keyboard.press('End'); await rep.keyboard.type('\nShipped the login fix to staging.');
await wait(200);
await visit('https://gitlab.com/acme/app/-/merge_requests/4', 1500); await visit('https://acme.atlassian.net/browse/ENGX-1', 1200);
await rep.bringToFront(); await wait(1200);
check('Draft', 'edit survives new activity', (await rep.inputValue('#md')).includes('Shipped the login fix'));
await rep.reload(); await wait(1200);
check('Draft', 'edit survives a page reload', (await rep.inputValue('#md')).includes('Shipped the login fix'));
check('Draft', '"Rebuild draft" offered', await rep.isVisible('#regen'));
await rep.click('#regen'); await wait(500);
check('Draft', 'rebuild drops the edit', !(await rep.inputValue('#md')).includes('Shipped the login fix'));

// Formats
await rep.selectOption('#template', 'standup'); await wait(700);
md = await rep.inputValue('#md');
check('Draft', 'standup format, blockers left blank', md.startsWith('## Standup') && md.includes('### Today') && /### Blockers\n- \n$/.test(md) && !/None/.test(md), md);
check('Draft', '"show time" hidden in standup', !(await rep.isVisible('#incTime')));
await rep.selectOption('#template', 'weekly'); await wait(700);
check('Draft', 'back to weekly', (await rep.inputValue('#md')).startsWith('## Weekly update'));

// Copy
await rep.evaluate(() => { navigator.clipboard.writeText = async t => { window.__clip = t; }; navigator.clipboard.readText = async () => window.__clip; });
await rep.click('#copyMd'); await wait(200);
check('Draft', 'copy puts the draft on the clipboard', (await rep.evaluate(() => navigator.clipboard.readText())).startsWith('## Weekly update'));
await rep.selectOption('#copyAs', 'ai'); await rep.click('#copyMd'); await wait(300);
check('Draft', 'asks before copying for an AI chat (inline, no dialog)', await rep.isVisible('#shareAsk'));
await rep.click('#askOk'); await wait(300);
check('Draft', 'copy for ChatGPT/Claude includes instructions and log', /never invent/.test(await rep.evaluate(() => navigator.clipboard.readText())));
await rep.click('#copyMd'); await wait(300);
check('Draft', 'asks only once', !(await rep.isVisible('#shareAsk')));
await rep.check('#anonymize'); await wait(400);
md = await rep.inputValue('#md');
// Hiding names covers tracked items; tasks and notes (Next week, Other work) stay as the person wrote them.
const sales = md.split('### Sales and customers')[1]?.split('###')[0] ?? '';
check('Draft', 'hide names: customer replaced, ticket kept', !sales.includes('Acme Corp') && sales.includes('- Customer 1') && md.includes('ENGX-1'), md);
check('Draft', 'hide names is remembered', (await store()).settings.anonymize === true);
await rep.uncheck('#anonymize'); await wait(400);
check('Report', 'privacy line visible on the report', /keeps everything on this computer/.test(await rep.textContent('.privacy')));

// Week navigation
await rep.click('#prev'); await wait(600);
check('Weeks', 'previous week', (await rep.textContent('#weekLabel')) === 'Last week' && !(await rep.isDisabled('#next')));
check('Weeks', 'previous week has its own (empty) draft', (await rep.inputValue('#md')).includes('No work-related activity'));
await rep.click('#thisWeek'); await wait(600);
check('Weeks', 'back to this week; next disabled', (await rep.textContent('#weekLabel')) === 'This week' && await rep.isDisabled('#next'));

// Notes in report
await rep.fill('#noteText', 'Ran the Q4 hiring sync'); await rep.click('#addNote'); await wait(500);
check('Notes', 'add from report', (await rep.locator('#notes li').allTextContents()).some(t => t.includes('Q4 hiring sync')));
await rep.locator('#notes li', { hasText: 'Q4 hiring sync' }).locator('button').click(); await wait(500);
check('Notes', 'delete note', !(await rep.locator('#notes li').allTextContents()).some(t => t.includes('Q4 hiring sync')));
const { legacyNoteChecks } = await import('./notes.mjs');
await legacyNoteChecks(harness, rep);
const { pinSetChecks, privateNoteChecks, pinChangeChecks } = await import('./notes.mjs');
await pinSetChecks(harness, rep, pan);
await privateNoteChecks(harness, rep, pan);
await pinChangeChecks(harness, rep, pan);
await rep.screenshot({ path: shots + '/3-report.png', fullPage: true });

// ===== 5b. Done section =====
const { doneChecks } = await import('./done.mjs');
await doneChecks(harness, rep, pan);

// ===== 5c. Reminders =====
const { reminderWindowChecks, reminderEngineChecks, reminderSettingsChecks, commandChecks } = await import('./reminders.mjs');
await reminderWindowChecks(harness);
await reminderEngineChecks(harness);
await reminderSettingsChecks(harness);
await commandChecks(harness);
const { themeChecks } = await import('./theme.mjs');
await themeChecks(harness, rep, pan);

// ===== 6. Settings =====
check('Nav', 'the report has no Settings button of its own: Update, Tasks, Calendar, Notes, Settings in one nav', (await rep.locator('#mainNav a').allTextContents()).join() === 'Update,Tasks,Calendar,Notes,Settings'
  && await rep.getAttribute('#nav-update', 'aria-current') === 'page' && !(await rep.isVisible('#openSettings')));
await rep.click('#nav-settings'); await wait(900);
check('Settings', 'the Settings nav item opens the settings page, with its sections', rep.url().endsWith(PAGES.settings) && await rep.isVisible('#role')
  && await rep.getAttribute('#nav-settings', 'aria-current') === 'page' && (await rep.locator('main > section.sec').evaluateAll(els => els.map(e => e.id).join())) === 'tracking,reminders,privacy,integrations,data,appearance,advanced');
await rep.goto(`${X}/${PAGES.report}`); await wait(700);
await openSettings(set);
await set.selectOption('#role', 'marketing');
await set.evaluate(() => { document.querySelector('#rules')?.closest('details')?.setAttribute('open', ''); });
await set.fill('#rules', 'acme.atlassian.net/browse => Client work | Acme ticket');
await set.fill('#slackWebhook', 'https://evil.example.com/hook'); await wait(1300);
check('Settings', 'non-Slack webhook rejected', /isn’t a Slack webhook/.test(await set.textContent('#slackWebhookErr')));
await set.fill('#slackWebhook', 'https://hooks.slack.com/services/T000/B000/XXXX'); await wait(1300);
st = await store();
check('Settings', 'saved', st.settings.role === 'marketing' && st.settings.rules.length === 1, JSON.stringify(st.settings));
await visit('https://acme.atlassian.net/browse/ENGX-1', 2500); await visit('https://dev.to/some-article', 1200);
st = await store();
const d2 = st['day:' + await today()];
check('Settings', 'custom rule applies to new activity', d2['rule:Client work:Acme ticket']?.category === 'Client work', Object.keys(d2).join(', '));
await toWorkday(); await rep.bringToFront(); await rep.reload(); await wait(1200);
check('Settings', 'custom category listed in the report', (await rep.locator('.cat h3').allTextContents()).includes('Client work'));
check('Settings', 'custom category goes under "Other" in the draft', /### Other\n- Acme ticket/.test(await rep.inputValue('#md')), await rep.inputValue('#md'));

// Slack
check('Slack', 'button appears once a webhook is set', await rep.isVisible('#slackBtn'));
await rep.click('#slackBtn'); await wait(300);
check('Slack', 'asks before the first post', await rep.isVisible('#shareAsk'));
await rep.click('#askOk'); await wait(800);
check('Slack', 'posts the draft as Slack formatting', slackBody?.text?.startsWith('*Weekly update') && /\n\*Tickets\*\n/.test(slackBody.text), JSON.stringify(slackBody)?.slice(0, 200));
check('Slack', 'confirms', (await rep.textContent('#copyMsg')) === 'Posted to Slack.', await rep.textContent('#copyMsg'));

// ===== 7. On-device AI (stand-in model: Gemini Nano is not in test browsers) =====
const ai = watch(await ctx.newPage());
await ai.addInitScript(() => {
  window.__aiLog = [];
  class FakeLM {
    static async availability() { return 'downloadable'; }
    static async create(o) {
      window.__aiLog.push({ system: o.initialPrompts[0].content, langs: o.expectedOutputs });
      const t = new EventTarget(); o.monitor?.(t);
      for (const p of [0.5, 1]) { const e = new Event('downloadprogress'); e.loaded = p; t.dispatchEvent(e); }
      return { destroy() { window.__aiLog.push('destroyed'); },
        promptStreaming(text, { signal } = {}) {
          window.__aiLog.push({ input: text });
          const parts = ['**This week**\n', '- Moved ENGX-1 (login timeout) to review; ', 'MR !4 merged.\n'];
          return (async function* () { for (const p of parts) { if (window.__slow) await new Promise(r => setTimeout(r, 1500)); if (signal?.aborted) throw new DOMException('aborted', 'AbortError'); yield p; } })();
        } };
    }
  }
  window.LanguageModel = FakeLM;
});
await ai.goto(`${X}/${PAGES.report}`); await wait(1200);
check('AI', 'availability shown (first use downloads the model)', /downloads Chrome’s AI model/.test(await ai.textContent('#aiMsg')), await ai.textContent('#aiMsg'));
const before = await ai.inputValue('#md');
await ai.click('#aiBtn'); await wait(800);
const log = await ai.evaluate(() => window.__aiLog);
check('AI', 'system prompt uses the chosen role', log[0]?.system?.includes('SEO or marketing'), log[0]?.system);
check('AI', 'asks for English output', log[0]?.langs?.[0]?.languages?.[0] === 'en');
check('AI', 'sends the draft as input', log.find(x => x.input)?.input?.includes(before.slice(0, 40)));
check('AI', 'streamed deltas are joined correctly', (await ai.inputValue('#md')) === '**This week**\n- Moved ENGX-1 (login timeout) to review; MR !4 merged.\n', await ai.inputValue('#md'));
check('AI', 'session destroyed after use', log.includes('destroyed'));
check('AI', 'result saved as an edit', (await store())['draft:weekly:' + dayKey(weekStart(0))]?.startsWith('**This week**'));
await ai.click('#aiUndo'); await wait(300);
check('AI', 'Undo AI restores the previous draft', (await ai.inputValue('#md')) === before);
await ai.evaluate(() => (window.__slow = true));
await ai.click('#aiBtn'); await wait(300);
check('AI', 'button turns into Stop while writing', (await ai.textContent('#aiBtn')) === 'Stop' && await ai.evaluate(() => document.querySelector('#md').readOnly));
await ai.click('#aiBtn'); await wait(2000);
check('AI', 'Stop cancels and keeps the draft', (await ai.textContent('#aiMsg')) === 'Stopped.' && (await ai.inputValue('#md')) === before, await ai.textContent('#aiMsg'));
check('AI', 'without Chrome AI the whole AI block is hidden, silently', !(await rep.isVisible('#aiBtn')) && (await rep.textContent('#aiMsg')) === '', await rep.textContent('#aiMsg'));
await ai.close();

// ===== 8. Trends =====
await rep.reload(); await wait(900);
check('Trends', 'hidden until Stats and Trends are switched on (Settings → Advanced)', !(await rep.isVisible('#trendsPanel')));
await openSettings(set); await set.check('#showStats'); await wait(1300);
await rep.bringToFront(); await rep.reload(); await wait(900);
if (!await rep.isVisible('#trends')) await rep.click('summary:has-text("Trends")'); await wait(600);
const rows = await rep.locator('.trends tbody tr').count();
const lastRow = await rep.locator('.trends tbody tr').last().textContent();
check('Trends', '8 weeks shown, this week has time and switches', rows === 8 && /\d/.test(lastRow), lastRow);

// ===== 9. Export / import =====
await openSettings(set);
const [dl] = await Promise.all([set.waitForEvent('download'), set.click('#export')]);
const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
check('Data', 'the export is timestamped: Settings says when the last backup was made', /Last backup: today/.test(await set.textContent('#lastBackup')) && typeof (await store()).lastExportAt === 'number');
check('Data', 'export contains device ID, days and notes', exported.deviceId && Object.keys(exported).some(k => k.startsWith('day:')) && exported.notes?.length, Object.keys(exported).join(', '));
check('Data', 'export carries tasks and settings, but never the Slack webhook (F7)', Array.isArray(exported.tasks) && exported.settings?.role && !('slackWebhook' in exported.settings), JSON.stringify(exported.settings).slice(0, 200));
const ownFile = S + '/own.json'; fs.writeFileSync(ownFile, JSON.stringify(exported));
const importFile = async f => { await set.setInputFiles('#import', f); await wait(700); await set.click('#importGo'); await wait(1200); await rep.bringToFront(); await rep.reload(); await wait(1000); await set.bringToFront(); };
await set.setInputFiles('#import', ownFile); await wait(700);
check('Data', 'this browser’s own export is a backup: its activity is already here, so it is left out', /from this browser/.test(await set.textContent('#importWhat')) && /activity is already here/.test(await set.textContent('#importWhat')), await set.textContent('#importWhat'));
await set.click('#importCancel'); await wait(200);
const other = { deviceId: 'work-laptop-2', notes: [{ id: 5, ts: Date.now(), text: 'Laptop note' }],
  ['day:' + workday]: { 'app:app.greenhouse.io/people/9001': { category: 'Recruiting & HR', task: 'Jane Doe - Senior QA', url: 'https://app.greenhouse.io/people/9001', ms: 1800000, first: 1, last: 2, tickets: [] },
    'evil': { category: '<img src=x onerror=alert(1)>', task: '<script>alert(1)</script>', url: 'javascript:alert(1)', ms: 60000 } } };
const otherFile = S + '/other.json'; fs.writeFileSync(otherFile, JSON.stringify(other));
await rep.bringToFront(); await rep.reload(); await wait(800);
const total0 = await rep.textContent('#summary');
await importFile(otherFile);
check('Data', 'import from another device', /Imported 1 day of activity, 0 tasks and 1 note\./.test(await set.textContent('#settingsMsg')), await set.textContent('#settingsMsg'));
const total1 = await rep.textContent('#summary');
check('Data', 'imported time is added to the week', total1 !== total0 && (await rep.locator('.item .task').allTextContents()).some(t => t.includes('Jane Doe')), total1);
await importFile(otherFile);
check('Data', 're-import replaces, does not double count', (await rep.textContent('#summary')) === total1, await rep.textContent('#summary'));
const evil = rep.locator('.item', { hasText: '<script>' });
check('Security', 'imported HTML is shown as text, not run', await evil.count() === 1 && await rep.evaluate(() => !document.querySelector('.cat img')));
check('Security', 'javascript: URL from import is dropped', await evil.locator('a').count() === 0);
fs.writeFileSync(S + '/bad.json', '{not json');
await set.setInputFiles('#import', S + '/bad.json'); await wait(400);
check('Data', 'broken file rejected with a clear message', /Not a valid export file/.test(await set.textContent('#settingsMsg')));
const { daybookImportChecks, forgetMeNotImportChecks, pinImportChecks, replaceImportChecks } = await import('./data.mjs');
await daybookImportChecks(harness, set);
await forgetMeNotImportChecks(harness, set);
await pinImportChecks({ ...harness, S }, set);
await replaceImportChecks(harness, set);

// ===== 10. Layout =====
await rep.emulateMedia({ colorScheme: 'dark' }); await rep.reload(); await wait(1000);
await rep.screenshot({ path: shots + '/4-dark.png', fullPage: false });
const bg = await rep.evaluate(() => getComputedStyle(document.body).backgroundColor);
check('Layout', 'dark mode applies', bg === 'rgb(20, 23, 31)', bg);
await rep.emulateMedia({ colorScheme: 'light' });
await rep.setViewportSize({ width: 400, height: 900 }); await wait(300);
check('Layout', 'no sideways scrolling at phone width', await rep.evaluate(() => document.documentElement.scrollWidth <= 400));
await rep.screenshot({ path: shots + '/5-narrow.png', fullPage: true });
await rep.setViewportSize({ width: 1280, height: 900 });
const unlabeled = await rep.evaluate(() => [...document.querySelectorAll('input,select,textarea,button')].filter(el => el.type !== 'file' && !el.hidden && !(el.labels?.length) && !el.getAttribute('aria-label') && !el.textContent.trim() && !el.placeholder).map(el => el.id || el.outerHTML.slice(0, 60)));
check('Layout', 'every control has a label', unlabeled.length === 0, unlabeled.join(', '));

// ===== 11. Remove history, delete all =====
await openSettings(set);
await set.click('#histRemove'); await wait(600);
check('History', 'remove estimates', !Object.keys(await store()).some(k => k.startsWith('hist:')), await set.textContent('#settingsMsg'));
await set.click('#clear'); await wait(300);
check('Data', 'Delete everything asks in the page first, and nothing is deleted yet', await set.isVisible('#clearConfirm') && (await store()).notes.length > 0);
await set.click('#clearNo'); await wait(200);
check('Data', 'Cancel closes the question and keeps everything', !(await set.isVisible('#clearConfirm')) && (await store()).notes.length > 0);
await set.click('#clear'); await set.click('#clearYes'); await wait(800);
await rep.bringToFront(); await rep.reload(); await wait(900);
st = await store();
// The first task read writes `tasks` and `schemaVersion`; delete-all empties tasks and notes through their locks.
check('Data', 'delete all keeps only settings and device ID (tasks and notes emptied)', Object.keys(st).sort().join(',') === 'deviceId,notes,schemaVersion,settings,tasks' && st.tasks.length === 0 && st.notes.length === 0, Object.keys(st).join(','));
check('Data', 'report empty after delete', (await rep.textContent('#categories')).includes('Nothing recorded'));

await rolloverCheck(harness);
check('Errors', 'no page errors or console errors anywhere', errors.length === 0, errors.join(' || '));
check('Errors', 'background badge clear (no recording failures)', (await sw.evaluate(() => chrome.action.getBadgeText({}))) === '');

fs.writeFileSync(S + '/results.json', JSON.stringify(results, null, 1));
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
await ctx.close();
process.exit(fails.length ? 1 : 0);
