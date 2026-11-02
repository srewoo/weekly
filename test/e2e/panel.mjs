// Side panel checks (spec §3.1). The panel page is opened directly as an extension URL.
// `t` is the harness context built in full.mjs.

/** Visible controls with no label, aria-label, text or placeholder. */
export const unlabeled = page => page.evaluate(() => [...document.querySelectorAll('input,select,textarea,button')]
  .filter(el => el.offsetParent && !(el.labels?.length) && !el.getAttribute('aria-label') && !el.textContent.trim() && !el.placeholder)
  .map(el => el.id || el.outerHTML.slice(0, 60)));

export async function panelChecks(t) {
  const { ctx, X, sw, check, watch, store, wait, shots, PAGES, focusTab } = t;
  const manifest = await sw.evaluate(() => chrome.runtime.getManifest());
  check('Panel', 'toolbar icon opens the side panel, no popup', manifest.side_panel?.default_path === PAGES.panel && !manifest.action.default_popup && manifest.permissions.includes('sidePanel'), JSON.stringify(manifest.action));
  const behavior = await sw.evaluate(() => chrome.sidePanel.getPanelBehavior());
  check('Panel', 'panel opens on toolbar click', behavior.openPanelOnActionClick === true, JSON.stringify(behavior));

  const pan = watch(await ctx.newPage());
  await pan.setViewportSize({ width: 360, height: 800 });
  await pan.goto(`${X}/${PAGES.panel}`); await focusTab(); await wait(1200); await pan.reload(); await wait(500);
  check('Panel', 'footer shows time tracked today', /\d+m|\d+h/.test(await pan.textContent('#todayTotal')), await pan.textContent('#todayTotal'));
  check('Panel', 'shows what is being tracked now', /^Now: /.test(await pan.textContent('#now')), await pan.textContent('#now'));
  await pan.click('#pause'); await wait(400);
  check('Panel', 'pause works', (await pan.textContent('#now')) === 'Tracking is paused.' && (await store()).settings.paused === true);
  await pan.click('#pause'); await wait(400);
  check('Panel', 'resume works', (await store()).settings.paused === false && (await pan.textContent('#pause')) === 'Pause');
  await pan.click('#tab-notes'); await pan.fill('#noteBody', 'Phone screen with 2 candidates'); await pan.press('#noteBody', 'Control+Enter'); await wait(300);
  check('Panel', 'note for today added from the Notes tab', (await store()).notes?.some(n => n.body === 'Phone screen with 2 candidates' && n.day === t.iso.today));
  await sw.evaluate(() => chrome.storage.session.set({ error: 'QUOTA_BYTES quota exceeded' })); await wait(300);
  check('Panel', 'storage-full error explained in plain words, live', /Storage is full/.test(await pan.textContent('#err')), await pan.textContent('#err'));
  await sw.evaluate(() => chrome.storage.session.remove('error')); await wait(300);
  check('Panel', 'error banner clears when the error does', !(await pan.isVisible('#err')));
  check('Panel', 'privacy line shown', /Stays on this computer/.test(await pan.textContent('.privacy')));
  await pan.click('#tab-week'); await wait(500);
  check('Panel', 'Week tab: Mon–Fri strip', (await pan.locator('#weekDays .wday .name').allTextContents()).map(s => s.split(' ')[0]).join(',') === 'Mon,Tue,Wed,Thu,Fri');
  check('Panel', 'Week tab: today’s top work', (await pan.locator('#top li').allTextContents()).some(s => s.includes('ENGX-1')));
  const [reportTab] = await Promise.all([ctx.waitForEvent('page'), pan.click('#openReport')]);
  await reportTab.waitForLoadState();
  check('Panel', '"Open full report" opens the report', reportTab.url().endsWith('/' + PAGES.report), reportTab.url());
  await reportTab.close();
  check('Panel', 'Tasks and Calendar are one click away; Stats only when switched on', await pan.isVisible('#open-tasks') && await pan.isVisible('#open-calendar') && !(await pan.isVisible('#open-stats')));
  const [calTab] = await Promise.all([ctx.waitForEvent('page'), pan.click('#open-calendar')]);
  await calTab.waitForLoadState();
  check('Panel', '"Calendar" opens the app on its calendar', calTab.url().endsWith('/src/ui/app/app.html#calendar'), calTab.url());
  await calTab.close();
  check('Layout', 'every panel control has a label', (await unlabeled(pan)).length === 0, (await unlabeled(pan)).join(', '));
  check('Layout', 'panel: no sideways scrolling at 360 px', await pan.evaluate(() => document.documentElement.scrollWidth <= 360));
  await pan.screenshot({ path: shots + '/2-panel.png' });
  return pan;
}
