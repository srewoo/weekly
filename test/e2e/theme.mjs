// Theme: light, dark or the computer's (spec F6, L8), on every page and, as data, the on-page note.
// Dark paper and dark sheet (the side panel and the reminder window sit on the sheet); light paper.
const DARK = 'rgb(20, 23, 31)', DARK_SHEET = 'rgb(28, 32, 42)', LIGHT = 'rgb(246, 244, 238)';
const bg = (p) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
const isDark = (c) => c === DARK || c === DARK_SHEET;

export async function themeChecks(t, _rep, pan) {
  const { ctx, X, check, watch, store, wait, PAGES } = t;
  const rep = await t.toSettings();   // the theme is chosen on the Settings page
  await rep.emulateMedia({ colorScheme: 'light' });
  const opts = (await rep.locator('#theme option').allTextContents()).join(',');
  check('Theme', 'Settings offers the computer’s choice, Light or Dark; the computer’s by default (F6)', opts === 'Same as this computer,Light,Dark' && (await rep.inputValue('#theme')) === 'system', opts);
  await rep.selectOption('#theme', 'dark'); await wait(500);
  check('Theme', 'Dark applies to the page at once, whatever the computer uses (F6)', (await store()).settings.theme === 'dark' && await bg(rep) === DARK, await bg(rep));
  const app = watch(await ctx.newPage()); await app.goto(`${X}/${PAGES.app}`); await wait(600);
  check('Theme', 'the side panel follows without a reload, and the app opens dark (F6)', isDark(await bg(pan)) && await bg(app) === DARK, `${await bg(pan)} ${await bg(app)}`);
  const others = [];
  for (const path of [PAGES.welcome, `${PAGES.remind}?slot=morning`]) {
    const p = watch(await ctx.newPage()); await p.goto(`${X}/${path}`); await wait(600);
    others.push(await bg(p)); await p.close();
  }
  check('Theme', 'the welcome page and the reminder window use it too (F6)', others.every(isDark), others.join(' '));
  const r = await rep.evaluate(() => chrome.runtime.sendMessage({ type: 'notes:list' }));
  check('Theme', 'the on-page note is told the theme as data, not a stylesheet (F6)', r?.ok && r.theme === 'dark', JSON.stringify(r?.theme));
  await rep.selectOption('#theme', 'light'); await wait(400);
  await app.emulateMedia({ colorScheme: 'dark' }); await wait(200);
  check('Theme', 'Light stays light when the computer is dark (F6)', await bg(app) === LIGHT, await bg(app));
  await rep.selectOption('#theme', 'system'); await wait(400);
  const sysDark = await bg(app);
  await app.emulateMedia({ colorScheme: 'light' }); await wait(200);
  check('Theme', 'the computer’s choice follows it, dark then light (L8)', sysDark === DARK && await bg(app) === LIGHT, `${sysDark} ${await bg(app)}`);
  await app.close();
}
