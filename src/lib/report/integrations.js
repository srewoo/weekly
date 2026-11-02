import { toSlack } from './formats.js';
// Optional live status from Jira / GitLab / GitHub (using your existing browser login) and posting to Slack.
// Every host needs a one-time permission grant from you; nothing is fetched without it.
export const MAX_STATUS_LOOKUPS = 60;

/** @typedef {{key: string, url: string}} Item */
/** @param {Item[]} items */
export function statusTargets(items) {
  /** @type {{key: string, origin: string, api: string, parse: (j: any) => unknown}[]} */
  const out = [];
  for (const e of items) {
    let u; try { u = new URL(e.url); } catch (err) { continue; }
    if (e.key.startsWith('jira:')) {
      out.push({ key: e.key, origin: u.origin, api: `${u.origin}/rest/api/2/issue/${encodeURIComponent(e.key.slice(5))}?fields=status`,
        parse: (/** @type {any} */ j) => j?.fields?.status?.name });
    } else if (e.key.startsWith('mr:')) {
      const [project, iid] = e.key.slice(3).split('!');
      if (!/^\d+$/.test(iid ?? '')) continue;
      if (u.hostname === 'github.com') {
        out.push({ key: e.key, origin: 'https://api.github.com', api: `https://api.github.com/repos/${project}/pulls/${iid}`,
          parse: j => j?.merged_at ? 'merged' : j?.state });
      } else if (/(^|[.-])gitlab([.-]|$)/.test(u.hostname)) {   // Bitbucket / Azure DevOps: no status lookup
        out.push({ key: e.key, origin: u.origin, api: `${u.origin}/api/v4/projects/${encodeURIComponent(/** @type {string} */ (project))}/merge_requests/${iid}`,
          parse: j => j?.state });
      }
    }
  }
  return out.slice(0, MAX_STATUS_LOOKUPS);
}

/** @param {string} o */
export const originPattern = o => o + '/*';

/** @param {Item[]} items */
export async function missingOrigins(items) {
  const origins = [...new Set(statusTargets(items).map(t => t.origin))];
  const granted = await Promise.all(origins.map(o => chrome.permissions.contains({ origins: [originPattern(o)] })));
  return origins.filter((o, i) => !granted[i]);
}

// Call straight from a click handler (permission prompts need a user gesture).
/** @param {string[]} origins */
export function requestOrigins(origins) {
  return chrome.permissions.request({ origins: origins.map(originPattern) });
}

/** @param {Item[]} items @returns {Promise<Record<string, string>>} */
export async function fetchStatuses(items) {
  const targets = statusTargets(items);
  const allowed = new Map();
  for (const o of new Set(targets.map(t => t.origin)))
    allowed.set(o, await chrome.permissions.contains({ origins: [originPattern(o)] }));
  /** @type {Record<string, string>} */
  const result = {};
  await Promise.all(targets.filter(t => allowed.get(t.origin)).map(async t => {
    try {
      const res = await fetch(t.api, { credentials: 'include', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;                       // not logged in / no access: just skip the status
      const s = t.parse(await res.json());
      if (typeof s === 'string' && s) result[t.key] = s.slice(0, 40);
    } catch (e) { console.warn('[worklog] status lookup failed', t.api, /** @type {Error} */ (e).message); }
  }));
  return result;
}

/** @param {string} url */
export function validSlackWebhook(url) {
  try { const u = new URL(url); return u.origin === 'https://hooks.slack.com' && u.pathname.startsWith('/services/'); } catch (e) { return false; }
}

export { toSlack };

/** @param {string} webhook @param {string} md */
export async function postToSlack(webhook, md) {
  if (!validSlackWebhook(webhook)) throw new Error('Add a Slack webhook URL (https://hooks.slack.com/services/...) in Settings.');
  if (!await chrome.permissions.request({ origins: ['https://hooks.slack.com/*'] })) throw new Error('Slack permission was not granted.');
  const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: toSlack(md) }) });
  if (!res.ok) throw new Error(`Slack returned ${res.status}.`);
}
