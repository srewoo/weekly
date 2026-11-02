// Open a Weekly page in a tab and get the side panel out of its way: once the
// person moves to the app, settings or the full update, the panel closes.
// window.close() in a side panel closes the panel. chrome.tabs.getCurrent() is
// undefined there and a tab anywhere else, so the same page opened as a tab
// (tests, a pinned panel.html) never closes itself.

/** @param {string} path extension-relative, e.g. 'src/ui/app/app.html' */
export async function openTab(path) {
  await chrome.tabs.create({ url: chrome.runtime.getURL(path) });
  if (!(await chrome.tabs.getCurrent())) window.close();
}
