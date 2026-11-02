import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, findTickets, parseRules } from '../../src/lib/activity/classify.js';

const cat = (url, title = '', opts) => classify(url, title, opts).category;

test('engineering tools', () => {
  const j = classify('https://acme.atlassian.net/browse/ENGX-151', '[ENGX-151] Fix login - Jira');
  assert.equal(j.key, 'jira:ENGX-151');
  assert.equal(j.task, 'ENGX-151: Fix login');
  const mr = classify('https://gitlab.com/acme/hermes/-/merge_requests/42', 'ENGX-151 fix login (!42) · Merge requests · hermes · GitLab');
  assert.equal(mr.key, 'mr:acme/hermes!42');
  assert.deepEqual(mr.tickets, ['ENGX-151']);
  assert.equal(cat('https://gitlab.acme.io/a/b'), 'Code');
});

test('sales, HR, SEO, support, PM tools', () => {
  assert.equal(cat('https://acme.lightning.force.com/lightning/r/Opportunity/006xx/view', 'Acme renewal | Salesforce'), 'Sales & CRM');
  assert.equal(cat('https://app.hubspot.com/contacts/123/record/0-3/999'), 'Sales & CRM');
  assert.equal(cat('https://www.linkedin.com/sales/lead/abc'), 'Sales & CRM');
  assert.equal(cat('https://www.linkedin.com/talent/hire/1/discover'), 'Recruiting & HR');
  assert.equal(cat('https://app.greenhouse.io/people/42'), 'Recruiting & HR');
  assert.equal(cat('https://search.google.com/search-console/performance'), 'SEO & marketing');
  assert.equal(cat('https://app.ahrefs.com/site-explorer'), 'SEO & marketing');
  assert.equal(cat('https://blog.acme.com/wp-admin/post.php'), 'SEO & marketing');
  assert.equal(cat('https://acme.zendesk.com/agent/tickets/77'), 'Customer support');
  assert.equal(cat('https://app.asana.com/0/123/456'), 'Planning');
  assert.equal(cat('https://www.linkedin.com/feed/'), 'Browsing');
});

test('each CRM record is its own item', () => {
  const a = classify('https://app.hubspot.com/contacts/123/record/0-3/1').key;
  const b = classify('https://app.hubspot.com/contacts/123/record/0-3/2').key;
  assert.notEqual(a, b);
});

test('no false positives from loose host matching', () => {
  assert.equal(cat('https://dev.to/post'), 'Browsing');
  assert.equal(cat('https://myjiraguide.blogspot.com/x'), 'Browsing');
  assert.equal(cat('https://dropbox.com/home'), 'Docs & specs');
  assert.equal(cat('https://app.staging.acme.com/'), 'Test environments');
});

test('ticket IDs skip look-alikes and honour an allow-list', () => {
  assert.deepEqual(findTickets('UTF-8 COVID-19 SHA-256 CVE-2024 ENGX-1'), ['ENGX-1']);
  assert.deepEqual(findTickets('ENGX-1 MKT-2', ['MKT']), ['MKT-2']);
});

test('custom rules win and ignore malformed lines', () => {
  const rules = ['acme.com/partners => Sales & CRM | Partner portal', 'garbage line', ' => nothing'];
  assert.equal(parseRules(rules).length, 1);
  const r = classify('https://www.acme.com/partners/x', 'X', { rules });
  assert.equal(r.category, 'Sales & CRM');
  assert.equal(r.task, 'Partner portal');
});

test('reference reading, cloud consoles, CI and other code hosts are recognised', async () => {
  const { classify } = await import('../../src/lib/activity/classify.js');
  const cat = (u, t = '') => classify(u, t).category;
  assert.equal(cat('https://stackoverflow.com/questions/1/x'), 'Research');
  assert.equal(cat('https://developer.chrome.com/docs/ai/prompt-api'), 'Research');
  assert.equal(cat('https://docs.python.org/3/library/re.html'), 'Research');
  assert.equal(cat('https://docs.google.com/a/b'), 'Browsing');
  assert.equal(cat('https://us-east-1.console.aws.amazon.com/ec2/home'), 'Cloud & infra');
  assert.equal(cat('https://app.circleci.com/pipelines/gh/acme'), 'CI/CD');
  assert.equal(classify('https://bitbucket.org/acme/app/pull-requests/7', 'Fix ENGX-9').key, 'mr:bitbucket.org/acme/app!7');
  assert.deepEqual(classify('https://bitbucket.org/acme/app/pull-requests/7', 'Fix ENGX-9').tickets, ['ENGX-9']);
  assert.equal(cat('https://dev.azure.com/org/proj/_git/repo/pullrequest/12'), 'Merge requests');
});
