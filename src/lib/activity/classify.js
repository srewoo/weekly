// Turns a URL + tab title into a "task": { key, category, task, tickets }.
// Add your own rules in the report page (Settings), or edit this file for built-in ones.
const TICKET_RE = /\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/g;
// Things shaped like ticket IDs that never are.
const NOT_TICKETS = new Set(['UTF', 'ISO', 'SHA', 'COVID', 'CVE', 'RFC', 'MP3', 'MP4', 'TLS', 'SSL', 'AES', 'RSA', 'IPV4', 'IPV6',
  'GPT', 'PEP', 'HTTP', 'ECMA', 'IEEE', 'WCAG', 'ES', 'MD5', 'PS', 'COM', 'WIN', 'ARM', 'ARM64']);

const APP_SUFFIX = /\s+[-–|·]\s+(Jira|Confluence|Google (Docs|Sheets|Slides|Drive|Search Console|Analytics|Ads)|GitLab|GitHub|Slack|Figma|Metabase|Mixpanel|Datadog|Gmail|Google Calendar|PagerDuty|Postman|Notion|Claude|Granola|Salesforce|HubSpot|LinkedIn|Asana|Trello|monday\.com|Linear|ClickUp|Miro|Canva|Zendesk|Freshdesk|Intercom|Greenhouse|Lever|Workday|Ahrefs|Semrush|Gong|Outreach|Apollo)\b.*$/i;

// Business apps for every role. Each record (deal, candidate, campaign, task) becomes its own item.
/** @type {[string, string[]][]} */
const APPS = [
  ['Sales & CRM', ['salesforce.com', 'force.com', 'hubspot.com', 'pipedrive.com', 'gong.io', 'outreach.io', 'apollo.io',
    'salesloft.com', 'close.com', 'zoominfo.com', 'myfreshworks.com', 'copper.com', 'clari.com', 'docusign.net', 'pandadoc.com']],
  ['Recruiting & HR', ['greenhouse.io', 'lever.co', 'workday.com', 'myworkdayjobs.com', 'bamboohr.com', 'darwinbox.in', 'darwinbox.com',
    'ashbyhq.com', 'smartrecruiters.com', 'keka.com', 'naukri.com', 'indeed.com', 'rippling.com', 'gusto.com', 'deel.com', 'lattice.com', 'cultureamp.com']],
  ['SEO & marketing', ['search.google.com', 'analytics.google.com', 'ads.google.com', 'tagmanager.google.com', 'ahrefs.com', 'semrush.com',
    'moz.com', 'similarweb.com', 'adsmanager.facebook.com', 'business.facebook.com', 'mailchimp.com', 'hotjar.com', 'webflow.com',
    'marketo.com', 'buffer.com', 'hootsuite.com', 'surferseo.com', 'clarity.microsoft.com', 'business.google.com']],
  ['Customer support', ['zendesk.com', 'freshdesk.com', 'intercom.com', 'helpscout.net', 'service-now.com', 'gorgias.com', 'front.com']],
  ['Planning', ['asana.com', 'trello.com', 'monday.com', 'linear.app', 'clickup.com', 'productboard.com', 'airtable.com',
    'smartsheet.com', 'basecamp.com', 'aha.io', 'wrike.com', 'height.app']],
  ['Design', ['miro.com', 'canva.com', 'lucid.app', 'whimsical.com', 'framer.com']],
  ['Docs & specs', ['coda.io', 'quip.com', 'sharepoint.com', 'dropbox.com', 'box.com']],
  ['CI/CD', ['circleci.com', 'buildkite.com', 'travis-ci.com', 'jenkins', 'argocd', 'app.netlify.com', 'vercel.com', 'render.com']],
  ['Cloud & infra', ['console.aws.amazon.com', 'aws.amazon.com', 'console.cloud.google.com', 'portal.azure.com', 'dash.cloudflare.com',
    'dashboard.heroku.com', 'cloud.digitalocean.com', 'app.terraform.io', 'cloud.mongodb.com', 'supabase.com', 'firebase.google.com', 'rancher']],
  ['Research', ['stackoverflow.com', 'stackexchange.com', 'serverfault.com', 'superuser.com', 'developer.mozilla.org', 'readthedocs.io',
    'devdocs.io', 'npmjs.com', 'pypi.org', 'pkg.go.dev', 'mvnrepository.com', 'crates.io', 'rubygems.org', 'arxiv.org', 'w3.org']],
  ['Communication', ['discord.com', 'web.whatsapp.com', 'chat.google.com', 'mattermost', 'rocket.chat']],
  ['Meetings', ['webex.com', 'whereby.com', 'gotomeeting.com', 'around.co']],
];

/** @param {string} title @returns {string} */
export function cleanTitle(title) {
  return (title || '').replace(APP_SUFFIX, '').replace(/^\(\d+\)\s*/, '').trim();
}

/** @param {string} text @param {string[]} [allowed] @returns {string[]} */
export function findTickets(text, allowed = []) {
  const all = (text.match(TICKET_RE) || []).filter(t => {
    const prefix = t.split('-')[0] ?? '';
    return allowed.length ? allowed.includes(prefix) : !NOT_TICKETS.has(prefix);
  });
  return [...new Set(all)];
}

// Custom rule lines look like:  "mindtickle.com/admin => Test environments | Admin console"
/** @param {string[] | undefined} lines @returns {{ pattern: string, category: string, label: string }[]} */
export function parseRules(lines) {
  return /** @type {{ pattern: string, category: string, label: string }[]} */ ((lines || []).map(l => {
    const [pattern, rest = ''] = String(l).split('=>').map(s => s.trim());
    const [category, label] = rest.split('|').map(s => s.trim());
    return pattern && category ? { pattern: pattern.toLowerCase(), category, label: label || '' } : null;
  }).filter(Boolean));
}

/** @typedef {{ key: string, category: string, task: string, tickets: string[] }} Item */
/**
 * What every matcher needs, computed once per URL.
 * @typedef {object} Ctx
 * @property {URL} u
 * @property {string} host       hostname without www.
 * @property {string} path
 * @property {string[]} seg      non-empty path segments
 * @property {string} title      the raw tab title, or ''
 * @property {string} t          the cleaned title, or the host
 * @property {string[]} tickets
 * @property {string[] | undefined} rules
 * @property {(category: string, key: string, task: string) => Item} r
 * @property {(...names: string[]) => boolean} has
 */

/** @param {URL} u @param {string} rawUrl @param {string} title @param {{ rules?: string[], ticketPrefixes?: string[] }} opts @returns {Ctx} */
function context(u, rawUrl, title, opts) {
  const host = u.hostname.replace(/^www\./, '');
  const tickets = findTickets(title + ' ' + rawUrl, opts.ticketPrefixes);
  const labels = host.split(/[.-]/);
  return {
    u, host, path: u.pathname, seg: u.pathname.split('/').filter(Boolean), title,
    t: cleanTitle(title) || host, tickets, rules: opts.rules,
    r: (category, key, task) => ({ category, key, task, tickets }),
    // "gitlab" matches gitlab.com and gitlab.acme.io but not mygitlabblog.com
    has: (...names) => names.some(n => host === n || host.endsWith('.' + n) || (!n.includes('.') && labels.includes(n))),
  };
}

/** The user's own rules win over everything built in. @param {Ctx} c @returns {Item | null} */
function byRule(c) {
  for (const rule of parseRules(c.rules)) {
    if ((c.host + c.path).toLowerCase().includes(rule.pattern))
      return c.r(rule.category, `rule:${rule.category}:${rule.label || c.host}`, rule.label || c.t);
  }
  return null;
}

/** Jira & Confluence. @param {Ctx} c @returns {Item | null} */
function atlassian(c) {
  const { u, host, path, seg, title, t, tickets, r, has } = c;
  if (!host.endsWith('atlassian.net') && !has('jira', 'confluence')) return null;
  if (path.startsWith('/wiki') || has('confluence')) {
    const m = path.match(/\/pages\/(\d+)/);
    return r('Docs & specs', 'confluence:' + (m ? m[1] : path), t);
  }
  const issue = (path.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/) || [])[1] || u.searchParams.get('selectedIssue');
  if (issue) {
    const summary = !title.includes(issue) ? '' : t.replace(/\[?\b[A-Z][A-Z0-9]+-\d+\b\]?/, '').replace(/^[\s:–-]+/, '').trim();
    return { ...r('Tickets', 'jira:' + issue, summary ? `${issue}: ${summary}` : issue), tickets: [...new Set([issue, ...tickets])] };
  }
  return r('Planning', 'jira-board:' + seg.slice(0, 4).join('/'), 'Jira: ' + t);
}

/** GitLab / GitHub. @param {Ctx} c @returns {Item | null} */
function codeHost(c) {
  const { host, path, seg, title, t, r, has } = c;
  // Bitbucket (/ws/repo/pull-requests/7) and Azure DevOps (/org/proj/_git/repo/pullrequest/7).
  if (has('bitbucket.org', 'dev.azure.com', 'visualstudio.com')) {
    const pr = path.match(/^\/(.+?)\/(?:pull-requests|pullrequest)\/(\d+)/);
    if (pr?.[1]) return r('Merge requests', `mr:${host}/${pr[1]}!${pr[2]}`, `${pr[1].split('/').pop()} !${pr[2]}: ${t}`);
    return seg.length >= 2 ? r('Code', 'repo:' + host + '/' + seg.slice(0, 2).join('/'), seg.slice(0, 2).join('/')) : r('Code', 'code:' + host, host);
  }
  if (!has('gitlab', 'github.com')) return null;
  const gl = path.match(/^\/(.+?)\/-\/(merge_requests|issues|pipelines|jobs|commit)\/([\w]+)/);
  const gh = path.match(/^\/([^/]+\/[^/]+)\/(pull|issues|actions\/runs|commit)\/([\w]+)/);
  const m = gl || gh;
  const nice = (title.split(' · ')[0] || t).trim();
  if (m) {
    const project = m[1] ?? '', kind = m[2], id = m[3];
    const short = project.split('/').pop();
    if (kind === 'merge_requests' || kind === 'pull')
      return r('Merge requests', `mr:${project}!${id}`, `${short} !${id}: ${nice.replace(/\s*\(!\d+\)\s*$/, '')}`);
    if (kind === 'issues') return r('Planning', `issue:${project}#${id}`, `${short} #${id}: ${nice}`);
    return r('CI/CD', `ci:${project}`, `${short} pipelines & jobs`);
  }
  if (seg.length >= 2) return r('Code', 'repo:' + seg.slice(0, 2).join('/'), seg.slice(0, 2).join('/'));
  return r('Code', 'code:' + host, host);
}

/** Google Workspace & communication. @param {Ctx} c @returns {Item | null} */
function workspace(c) {
  const { host, path, t, r, has } = c;
  if (host === 'docs.google.com') {
    const m = path.match(/\/(document|spreadsheets|presentation|forms)\/d\/([\w-]+)/);
    if (m) return r('Docs & specs', 'gdoc:' + m[2], t);
  }
  if (host === 'meet.google.com' || has('zoom.us', 'teams.microsoft.com')) {
    return r('Meetings', 'meet:' + host + path, t.replace(/^Meet\s*[-–]\s*/, '') || 'Call');
  }
  if (host === 'calendar.google.com') return r('Meetings', 'calendar', 'Calendar');
  if (host === 'mail.google.com' || has('outlook.office.com', 'outlook.office365.com', 'outlook.live.com')) return r('Communication', 'email', 'Email');
  if (has('slack.com')) return r('Communication', 'slack', 'Slack');
  return null;
}

/** Design, data, monitoring. @param {Ctx} c @returns {Item | null} */
function tools(c) {
  const { host, path, seg, t, r, has } = c;
  if (has('figma.com')) return r('Design', 'figma:' + (seg[1] || path), t);
  if (has('metabase', 'mixpanel.com', 'datadoghq.com', 'datadoghq.eu', 'grafana', 'pagerduty.com', 'snowflakecomputing.com', 'snowflake.com', 'kibana', 'sentry.io'))
    return r('Analysis & monitoring', 'data:' + host + '/' + seg.slice(0, 2).join('/'), t);
  if (has('postman.com', 'postman.co')) return r('Local dev & testing', 'postman', 'Postman');
  if (has('notion.so')) return r('Docs & specs', 'notion:' + path, t);
  return null;
}

/** LinkedIn's work areas, WordPress admin, then the business-app list. @param {Ctx} c @returns {Item | null} */
function businessApps(c) {
  const { host, seg, t, r, has } = c;
  // LinkedIn: Sales Navigator and Recruiter are work; the feed is browsing.
  if (has('linkedin.com')) {
    if (seg[0] === 'sales') return r('Sales & CRM', 'app:linkedin/' + seg.slice(0, 3).join('/'), t);
    if (seg[0] === 'talent') return r('Recruiting & HR', 'app:linkedin/' + seg.slice(0, 4).join('/'), t);
    if (seg[0] === 'messaging') return r('Communication', 'linkedin-messaging', 'LinkedIn messages');
  }
  if (seg[0] === 'wp-admin') return r('SEO & marketing', 'app:' + host + '/wp-admin', `WordPress (${host})`);
  for (const [category, hosts] of APPS) {
    if (has(...hosts)) return r(category, 'app:' + host + '/' + seg.slice(0, 5).join('/'), t);
  }
  return null;
}

/** AI assistants, then local and test environments. @param {Ctx} c @returns {Item | null} */
function aiAndEnvironments(c) {
  const { u, host, path, t, r, has } = c;
  if (has('claude.ai', 'chatgpt.com', 'gemini.google.com', 'perplexity.ai', 'copilot.microsoft.com'))
    return r('AI assistants', 'ai:' + host + path, t);
  // docs.python.org, developer.chrome.com, learn.microsoft.com: reference reading, one item per site.
  if (host !== 'docs.google.com' && /^(docs|developer|developers|devdocs|learn|reference)\./.test(host)) return r('Research', 'research:' + host, t);
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname) || /\.(localhost|test)$/.test(u.hostname))
    return r('Local dev & testing', 'local:' + u.host, `Local app (${u.host})`);
  // Needs 3+ labels so a public site like dev.to isn't mistaken for an environment.
  if (host.split('.').length >= 3 && /(^|[.-])(staging|integration|qa|dev|sandbox|preprod|uat)([.-]|$)/.test(host))
    return r('Test environments', 'env:' + host, host);
  return null;
}

/** First match wins, in this order. */
const MATCHERS = [byRule, atlassian, codeHost, workspace, tools, businessApps, aiAndEnvironments];

/**
 * @param {string} rawUrl
 * @param {string} rawTitle
 * @param {{ rules?: string[], ticketPrefixes?: string[] }} [opts]
 * @returns {Item}
 */
export function classify(rawUrl, rawTitle, opts = {}) {
  const title = rawTitle || '';
  let u;
  try { u = new URL(rawUrl); } catch {
    return { key: 'other:' + rawUrl, category: 'Browsing', task: title || rawUrl, tickets: [] };
  }
  const c = context(u, rawUrl, title, opts);
  for (const match of MATCHERS) {
    const hit = match(c);
    if (hit) return hit;
  }
  return c.r('Browsing', 'site:' + c.host, c.host);
}
