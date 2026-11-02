// Regenerates the Chrome Web Store images by driving the real, built extension in Chromium.
// Usage: PLAYWRIGHT_PATH=<dir containing node_modules/playwright or the node_modules dir itself> \
//        CHROMIUM_PATH=<chromium binary> EXT_DIR=<built extension, e.g. ../dist/weekly> \
//        [OUT_DIR=<output dir>] [SCRATCH=<temp dir>] node generate.mjs
// Needs ffmpeg on PATH (downscales 2x captures and flattens to 24-bit PNG, no alpha).
// All data is fictional (demo-data.mjs) and seeded into a throwaway browser profile; nothing real is read.
// The pages' clock is set to the most recent Friday at 16:20, so every run shows the same kind of week.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { addDays, toISODate, fromISODate } from '../src/lib/dates.js';
import { demoTasks, demoNotes, PRIVATE_NOTE, DEMO_PIN } from './demo-data.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const need = k => process.env[k] || (console.error(`Set ${k}`), process.exit(1));
const pwPath = need('PLAYWRIGHT_PATH'), exe = need('CHROMIUM_PATH');
const EXT_SRC = path.resolve(need('EXT_DIR')), OUT = path.resolve(process.env.OUT_DIR || here);
const S = process.env.SCRATCH || fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-store-'));
const { chromium } = createRequire(pwPath.endsWith('node_modules') || pwPath.endsWith('node_modules/') ? pwPath + '/' : pwPath + '/node_modules/')('playwright');

const ext = path.join(S, 'ext'), raw = path.join(S, 'raw');
fs.rmSync(ext, { recursive: true, force: true }); fs.cpSync(EXT_SRC, ext, { recursive: true });
fs.mkdirSync(raw, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
// This copy has tracking on from the start (tabs granted), so the panel shows a tracked day.
const mf = path.join(ext, 'manifest.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8'));
m.permissions = [...new Set([...m.permissions, 'tabs'])];
m.optional_permissions = m.optional_permissions.filter(p => p !== 'tabs');
fs.writeFileSync(mf, JSON.stringify(m, null, 2));
const iconUri = 'data:image/png;base64,' + fs.readFileSync(path.join(ext, 'icons/128.png')).toString('base64');
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- the fictional week -------------------------------------------------------------------
const back = (new Date().getDay() + 2) % 7;   // days since the last Friday (0 on a Friday)
const FRIDAY = addDays(toISODate(), -back), MON = addDays(FRIDAY, -4);
const NOW = /** @type {Date} */ (fromISODate(FRIDAY)); NOW.setHours(16, 20, 0, 0);
// [category, key, task, url, minutes Mon..Fri, tickets]
const WEEK = [
  ['Tickets', 'jira:ENGX-162', 'ENGX-162: Fix login timeout after idle', 'https://acme.atlassian.net/browse/ENGX-162', [95, 70, 40, 0, 25], ['ENGX-162']],
  ['Tickets', 'jira:ENGX-151', 'ENGX-151: Export report to CSV', 'https://acme.atlassian.net/browse/ENGX-151', [0, 45, 80, 95, 30], ['ENGX-151']],
  ['Merge requests', 'mr:acme/web!418', 'web !418: ENGX-162 extend session timeout', 'https://gitlab.com/acme/web/-/merge_requests/418', [20, 40, 0, 0, 10], ['ENGX-162']],
  ['Merge requests', 'mr:acme/web!421', 'web !421: ENGX-151 CSV export', 'https://gitlab.com/acme/web/-/merge_requests/421', [0, 0, 35, 50, 0], ['ENGX-151']],
  ['Merge requests', 'mr:acme/api!231', 'api #231: ENGX-151 export endpoint', 'https://github.com/acme/api/pull/231', [0, 25, 30, 0, 0], ['ENGX-151']],
  ['Docs & specs', 'doc:prd-csv', 'PRD: CSV export for 4.2', 'https://acme.atlassian.net/wiki/spaces/ENGX/pages/42', [30, 0, 40, 0, 25], []],
  ['Docs & specs', 'doc:figma', 'Export dialog (Figma)', 'https://www.figma.com/design/abc/export-dialog', [0, 0, 0, 45, 0], []],
  ['Meetings', 'meet:sprint', 'Sprint planning', 'https://meet.google.com/abc-defg-hij', [60, 0, 0, 0, 0], []],
  ['Meetings', 'meet:incident', 'Incident follow-up', 'https://meet.google.com/klm-nopq-rst', [0, 0, 0, 40, 0], []],
];
const SETTINGS = { minMinutes: 5, paused: false, role: 'general', template: 'weekly', anonymize: true, theme: 'light' };

// Storage writes run inside the extension service worker, so this stays in step with the real format.
const seed = (sw) => sw.evaluate(async ({ WEEK, MON5, start, tasks, notes, settings }) => {
  await chrome.storage.local.clear();
  const out = { settings, tasks, notes, schemaVersion: 2 };
  MON5.forEach((iso, d) => {
    const day = {};
    for (const [category, key, task, url, mins, tickets] of WEEK) {
      if (!mins[d]) continue;
      const first = start[d] + 9 * 36e5 + (key.length % 7) * 18e5;
      day[key] = { category, task, url, ms: mins[d] * 60000, first, last: first + mins[d] * 60000, tickets };
    }
    out['day:' + iso] = day;
  });
  await chrome.storage.local.set(out);
}, { WEEK, MON5: [0, 1, 2, 3, 4].map(o => addDays(MON, o)), start: [0, 1, 2, 3, 4].map(o => fromISODate(addDays(MON, o))?.getTime()),
  tasks: demoTasks(FRIDAY), notes: demoNotes(FRIDAY), settings: SETTINGS });

// ---- image helpers --------------------------------------------------------------------------
// ffmpeg: optional downscale, always flatten to RGB so the PNG has no alpha channel.
const flatten = (src, dst, w, h) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src,
  '-vf', `scale=${w}:${h}:flags=lanczos,format=rgb24`, dst]);
const dataUri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const FONT = `--serif: Charter, "Iowan Old Style", Georgia, serif; --sans: system-ui, -apple-system, "Segoe UI", sans-serif;`;
const mark = t => `<span style="background:linear-gradient(transparent 58%,#f2cf45 58%,#f2cf45 90%,transparent 90%);padding:0 .08em">${t}</span>`;
const LIGHT = { bg: '#f6f4ee', ink: '#1c2333', muted: '#596071', rule: '#ddd8cb' };
const DARK = { bg: '#14171f', ink: '#e9e6dc', muted: '#a3a8b4', rule: '#2c3240' };

// Caption band above a real screenshot: 1280x800 canvas.
const bandPage = (head, sub, img, c = LIGHT) => `<style>:root{${FONT}} *{box-sizing:border-box;margin:0}
body{width:1280px;height:800px;background:${c.bg};color:${c.ink};overflow:hidden;position:relative}
.band{height:96px;padding:0 48px;display:flex;align-items:center;gap:20px;border-bottom:1px solid ${c.rule}}
.band img{width:44px;height:44px}
h1{font:600 34px/1.1 var(--serif);letter-spacing:-.01em}
p{font:15px/1.35 var(--sans);color:${c.muted};margin-left:auto;max-width:420px;text-align:right}
.shot{display:block;width:1280px;height:704px;object-fit:cover;object-position:top}</style>
<div class="band"><img src="${iconUri}" alt=""><h1>${head}</h1><p>${sub}</p></div><img class="shot" src="${img}" alt="">`;

// The side panel beside its caption: Chrome draws it at the right of the window, about 400 px wide.
const panelPage = img => `<style>:root{${FONT}} *{box-sizing:border-box;margin:0}
body{width:1280px;height:800px;background:${LIGHT.bg};color:${LIGHT.ink};display:flex;align-items:center;justify-content:center;gap:96px;overflow:hidden}
.pane{height:760px;width:auto;border:1px solid #8f8a7c;border-radius:10px;box-shadow:0 18px 50px rgba(28,35,51,.22);object-fit:cover;object-position:top}
.cap{width:470px}.cap img{width:56px;height:56px;margin-bottom:22px}
h1{font:600 46px/1.1 var(--serif);letter-spacing:-.01em;margin-bottom:18px}
p{font:18px/1.5 var(--sans);color:${LIGHT.muted}}p+p{margin-top:12px}</style>
<div class="cap"><img src="${iconUri}" alt=""><h1>Today, in the ${mark('side panel')}.</h1>
<p>Click the toolbar icon. Add a task in one line, tick it off, and move what is left to tomorrow.</p>
<p>Tracking is off until you turn it on. When it is on, it keeps tab addresses, titles and time, on this computer only.</p></div>
<img class="pane" src="${img}" alt="">`;

const TILE_CSS = `:root{${FONT}} *{box-sizing:border-box;margin:0}
body{background:#f6f4ee;color:#1c2333;overflow:hidden;position:relative;font-family:var(--serif)}
.t{font-weight:600;letter-spacing:-.01em}.sw{background:linear-gradient(transparent 56%,#f2cf45 56%,#f2cf45 92%,transparent 92%);padding:0 .06em}`;
const smallTile = `<style>${TILE_CSS}
body{width:440px;height:280px;padding:38px 36px}
img.i{width:76px;height:76px;display:block;margin-bottom:22px}
.n{font-size:44px;line-height:1}.tag{font-size:32px;line-height:1.15;margin-top:14px}</style>
<img class="i" src="${iconUri}" alt=""><div class="t n">Weekly</div><div class="t tag">Your week,<br><span class="sw">written up.</span></div>`;
const marqueeTile = img => `<style>${TILE_CSS}
body{width:1400px;height:560px;padding:76px 80px}
img.i{width:120px;height:120px;display:block;margin-bottom:30px}
.n{font-size:76px;line-height:1}.tag{font-size:58px;line-height:1.1;margin-top:18px}
.sub{font:22px/1.45 system-ui,-apple-system,sans-serif;color:#596071;margin-top:26px;max-width:560px}
.shot{position:absolute;left:760px;top:72px;width:760px;border:1px solid #8f8a7c;border-radius:8px;box-shadow:0 20px 50px rgba(28,35,51,.25);transform:rotate(1.2deg)}</style>
<img class="i" src="${iconUri}" alt=""><div class="t n">Weekly</div><div class="t tag">Your week, <span class="sw">written up.</span></div>
<div class="sub">Your Friday update, drafted from your tasks, notes and (optionally) the tabs you worked in. Stays on your computer.</div>
<img class="shot" src="${img}" alt="">`;

// ---- run ------------------------------------------------------------------------------------
const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: exe, deviceScaleFactor: 2,
  viewport: { width: 1280, height: 704 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const X = `chrome-extension://${sw.url().split('/')[2]}`;
for (const p of ctx.pages()) if (p.url().includes('welcome.html')) await p.close();
await ctx.clock.setFixedTime(NOW);
const P = { report: 'src/ui/report/report.html', panel: 'src/ui/panel/panel.html', app: 'src/ui/app/app.html' };
const open = async (file, w, h) => { const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: h }); await p.goto(`${X}/${file}`); await wait(900); return p; };
const out = (name, w, h, src) => { flatten(src, path.join(OUT, name), w, h); console.log('wrote', name); };
const compose = async (html, name, w, h) => {
  const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: h });
  await p.setContent(html); await wait(300);
  const f = path.join(raw, name); await p.screenshot({ path: f }); await p.close(); out(name, w, h, f);
};
const shot = async (p, name) => { const f = path.join(raw, name); await p.screenshot({ path: f }); await p.close(); return f; };
// Both places a page reads the theme from: the setting, and theme-boot.js's pre-paint mirror (localStorage, per origin).
const theme = async (t) => {
  await sw.evaluate(async (t) => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, theme: t } }); }, t);
  const p = await open(P.report, 400, 300); await p.evaluate((t) => localStorage.setItem('weekly:theme', t), t); await p.close();
};

// A fresh install writes the default settings (onInstalled → updateSettings({})); seeding before that
// lands would let the defaults overwrite ours. Wait for it, seed, then check the seed stuck.
const settingsNow = () => sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings ?? null);
const expectSettings = async (want) => {
  const s = await settingsNow();
  for (const [k, v] of Object.entries(want)) if (s?.[k] !== v) throw new Error(`settings.${k} is ${JSON.stringify(s?.[k])}, want ${JSON.stringify(v)}`);
};
for (let t = 0; !(await settingsNow()); t += 100) { if (t >= 5000) throw new Error('the install never wrote settings'); await wait(100); }
await wait(300);
await seed(sw);
await expectSettings({ minMinutes: SETTINGS.minMinutes, theme: 'light' });
// The private note goes through the worker's own PIN code (crypto:save seals and stores it), as one written in Weekly would; then it is locked.
{
  const p = await open(P.report, 1280, 704);
  const r = await p.evaluate(async ({ pin, n }) => {
    const set = await chrome.runtime.sendMessage({ type: 'crypto:setPin', pin });
    const saved = await chrome.runtime.sendMessage({ type: 'crypto:save', id: null, title: n.title, body: n.body, category: n.category, day: null });
    const lock = await chrome.runtime.sendMessage({ type: 'crypto:lock' });
    return { set, saved, lock };
  }, { pin: DEMO_PIN, n: PRIVATE_NOTE });
  if (!r.set?.ok || !r.saved?.ok || !r.lock?.ok) throw new Error('private note not sealed: ' + JSON.stringify(r));
  // The worker stamps the note with real time; date it Wednesday afternoon like the rest of the week.
  const at = NOW.getTime() - 2 * 864e5;
  await sw.evaluate(async ({ id, at }) => { const { notes } = await chrome.storage.local.get('notes');
    await chrome.storage.local.set({ notes: notes.map((n) => (n.id === id ? { ...n, createdAt: at, updatedAt: at } : n)) }); }, { id: r.saved.note.id, at });
  await p.close();
}

// 1: the week report, Done first, light
{
  const f = await shot(await open(P.report, 1280, 704), '1-report.png');
  await compose(bandPage(`Your week, ${mark('written up')}.`, 'What you finished leads, then tickets with their merge requests. Untick anything, then copy.', dataUri(f)), 'screenshot-1-report.png', 1280, 800);
}
// 2: the side panel's Today tab, with a tab being tracked
{
  const p = await open(P.panel, 400, 900);
  await sw.evaluate((start) => chrome.storage.session.set({ current: { tabId: 1, url: 'https://acme.atlassian.net/browse/ENGX-151', title: 'ENGX-151: Export report to CSV - Jira', start } }), NOW.getTime() - 12 * 60000);
  await wait(500);
  // The whole panel, footer and privacy line included, must fit the window it is drawn in.
  const tall = await p.evaluate(() => document.documentElement.scrollHeight);
  if (tall > 900) throw new Error(`the panel is ${tall}px tall; raise its window height`);
  await compose(panelPage(dataUri(await shot(p, '2-panel.png'))), 'screenshot-2-panel.png', 1280, 800);
}
// 3: the calendar with today's sheet open, light
{
  const f = await shot(await open(`${P.app}#day=${FRIDAY}`, 1280, 704), '3-calendar.png');
  await compose(bandPage(`Plan the month, ${mark('one day')} at a time.`, 'Each day is shaded by how much got done. Click a day for its daily tasks, extra tasks and notes.', dataUri(f)), 'screenshot-3-calendar.png', 1280, 800);
}
// 4: notes, dark. Stats is no longer shown: it is not the core job. Order matters: the report (the aha) is first.
await theme('dark');
await expectSettings({ minMinutes: SETTINGS.minMinutes, theme: 'dark' });
{
  const f = await shot(await open(`${P.app}#notes`, 1280, 704), '4-notes.png');
  await compose(bandPage(`Notes beside your tasks, ${mark('in one week')}.`, 'Alt+N writes a note on the page you are on. It lands in your week and your update.', dataUri(f), DARK), 'screenshot-4-notes-dark.png', 1280, 800);
}

// promo tiles (the marquee uses the report as its backdrop)
await compose(smallTile, 'promo-small-440x280.png', 440, 280);
await compose(marqueeTile(dataUri(path.join(raw, '1-report.png'))), 'promo-marquee-1400x560.png', 1400, 560);
fs.copyFileSync(path.join(ext, 'icons/128.png'), path.join(OUT, 'icon-128.png'));
await ctx.close();
console.log('done');
