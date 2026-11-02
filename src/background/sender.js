// Who sent a runtime message (Phase 3 m4, spec §5). onMessage only hears this extension,
// but a content script injected into a web page (the on-page note) is this extension too:
// it may ask only for plain notes (notes:*). Everything else is for Weekly's own pages.

/** This extension: one of its pages, or its content script. @param {chrome.runtime.MessageSender | undefined} s */
export const isOurs = (s) => s?.id === chrome.runtime.id;

/** One of Weekly's own pages (panel, app, report, reminder window), never a web page. @param {chrome.runtime.MessageSender | undefined} s */
export const isOwnPage = (s) => isOurs(s) && typeof s?.url === 'string' && s.url.startsWith(chrome.runtime.getURL(''));
