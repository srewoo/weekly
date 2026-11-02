// The no-tabs path (W3, spec §1 success criterion 2): the build exactly as shipped,
// nothing pre-granted. Tracking stays off and records nothing; tasks, notes, the
// report and the app all work. Run by run.mjs after full.mjs, in its own browser.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.env.PLAYWRIGHT_PATH ?? '/Users/sharajrewoo/.npm/_npx/9833c18b2d85bc59/node_modules/');
const { chromium } = require('playwright');
const [ext, exe, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const PAGES = { settings: 'src/ui/settings/settings.html', report: 'src/ui/report/report.html', panel: 'src/ui/panel/panel.html', app: 'src/ui/app/app.html', welcome: 'src/ui/welcome/welcome.html' };

const results = [];
const check = (area, name, ok, detail = '') => {
  results.push({ area, name, ok: !!ok, detail: String(detail).slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${area}] ${name}${detail && !ok ? ' — ' + String(detail).slice(0, 300) : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const watch = (p) => { p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`)); p.on('console', (m) => m.type() === 'error' && errors.push(`${p.url()}: ${m.text()}`)); return p; };

const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: exe, viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
await ctx.route('**/*', (route) => (/^https?:\/\//.test(route.request().url())
  ? route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ENGX-9 Fix it - Jira</title><h1>Jira</h1>' }) : route.continue()));
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const X = `chrome-extension://${sw.url().split('/')[2]}`;
const store = () => sw.evaluate(() => chrome.storage.local.get(null));
await wait(800);
// Reminders off, so a real 09:00 or 18:00 never opens a window mid-run.
await sw.evaluate(() => chrome.storage.local.set({ settings: { morning: { enabled: false, time: '09:00' }, evening: { enabled: false, time: '18:00' }, showStats: true } }));

const [manifest, granted] = await sw.evaluate(() => Promise.all([chrome.runtime.getManifest(), chrome.permissions.contains({ permissions: ['tabs'] })]));
check('No tabs', 'the install asks for no tabs permission, and Chrome has not granted it (W3, spec §3.6)',
  !manifest.permissions.includes('tabs') && manifest.optional_permissions.includes('tabs') && granted === false, JSON.stringify(manifest.permissions));

const welcome = ctx.pages().find((p) => p.url().endsWith('/' + PAGES.welcome));
if (welcome) watch(welcome);
check('No tabs', 'the welcome page opens on "Track my week?"; the history step waits for a yes (spec §3.5)', !!welcome
  && (await welcome.isVisible('#trackStep')) && !(await welcome.isVisible('#fill')));
await welcome?.click('#trackNo'); await wait(300);
check('No tabs', '"No thanks" leaves tracking off and says so', /Tracking is off/.test(await welcome?.textContent('#trackMsg') ?? '')
  && !(await sw.evaluate(() => chrome.permissions.contains({ permissions: ['tabs'] }))));
await welcome?.close();

const site = await ctx.newPage(); await site.goto('https://acme.atlassian.net/browse/ENGX-9'); await wait(4000);
await site.goto('https://acme.atlassian.net/browse/ENGX-10'); await wait(2000);
const st = await store();
const session = await sw.evaluate(() => chrome.storage.session.get('current'));
check('No tabs', 'browsing records nothing: no day of activity, nothing being timed', !Object.keys(st).some((k) => /^(day|meta):/.test(k)) && !session.current,
  Object.keys(st).join(','));

const pan = watch(await ctx.newPage());
await pan.setViewportSize({ width: 360, height: 800 });
await pan.goto(`${X}/${PAGES.panel}`); await wait(800);
check('No tabs', 'the side panel says tracking is off and offers no Pause', /Tracking is off/.test(await pan.textContent('#now')) && !(await pan.isVisible('#pause')),
  await pan.textContent('#now'));
await pan.fill('#addTitle', 'Plan without tracking'); await pan.press('#addTitle', 'Enter'); await wait(500);
check('No tabs', 'tasks work: one-line add in the panel', ((await store()).tasks ?? []).some((t) => t.title === 'Plan without tracking')
  && await pan.locator('#todayList li.row', { hasText: 'Plan without tracking' }).count() === 1);
await pan.click('#tab-notes'); await pan.fill('#noteBody', 'Notes need no tabs'); await pan.click('#panel-notes .note-add button.primary'); await wait(500);
check('No tabs', 'notes work: quick add in the Notes tab', ((await store()).notes ?? []).some((n) => n.body === 'Notes need no tabs'));

const rep = watch(await ctx.newPage());
await rep.goto(`${X}/${PAGES.report}`); await wait(1200);
const set = watch(await ctx.newPage());
await set.goto(`${X}/${PAGES.settings}`); await wait(1200);
const app = watch(await ctx.newPage());
await app.goto(`${X}/${PAGES.app}#stats`); await wait(800);
check('No tabs', 'the report and the app open; Settings show tracking off', !(await set.isChecked('#trackingOn')) && await rep.isVisible('#preview')
  && await app.isVisible('#view-stats'), await set.textContent('#trackingMsg'));
check('No tabs', 'the report says tracking is off, offers to turn it on, and leads with the Notes box', await rep.isVisible('#trackingBanner') && /Tracking is off, so this update is built from your tasks and notes/.test(await rep.textContent('#trackingBanner'))
  && await rep.isVisible('#trackOn') && /prominent/.test(await rep.getAttribute('#notesSection', 'class')));
// T5-c: the Settings box re-reads the permission when tracking state changes elsewhere. Chrome grants need a gesture, so
// stand in for the grant by answering contains(); the listener's storage trigger then makes the box follow, and follow back.
await set.evaluate(() => { chrome.permissions.contains = async () => true; return chrome.storage.local.set({ 'hist:probe': 1 }); }); await wait(500);
const followed = await set.isChecked('#trackingOn');
await set.reload(); await wait(1000);
check('No tabs', 'the Settings tracking box follows a permission change made elsewhere (T5-c)', followed && !(await set.isChecked('#trackingOn')));
await set.evaluate(() => chrome.storage.local.remove('hist:probe')); await wait(300);
// The sample week: made up, read-only, and it writes nothing.
const keysBefore = Object.keys(await store()).sort().join();
const smp = watch(await ctx.newPage());
await smp.goto(`${X}/${PAGES.report}?sample=1`); await wait(1200);
check('Sample', 'the sample week says so, offers the way back, and drafts a real update from made-up work', await smp.isVisible('#sampleBanner') && /This is a sample week/.test(await smp.textContent('#sampleBanner'))
  && (await smp.getAttribute('#realUpdate', 'href')) === 'report.html' && /ENGX-151/.test(await smp.inputValue('#md')) && !(await smp.isVisible('#connect')) && !(await smp.isVisible('#trackingBanner')));
check('Sample', 'it cannot be edited and nothing is stored', await smp.isDisabled('#addNote') && await smp.locator('#categories input[type=checkbox]:not([disabled])').count() === 0
  && Object.keys(await store()).sort().join() === keysBefore, keysBefore);
check('Errors', 'no page errors or console errors (no tabs)', errors.length === 0, errors.join(' || '));

fs.writeFileSync(outDir + '/results.json', JSON.stringify(results, null, 1));
const fails = results.filter((r) => !r.ok);
console.log(`\nNo tabs: ${results.length - fails.length}/${results.length} passed`);
await ctx.close();
process.exit(fails.length ? 1 : 0);
