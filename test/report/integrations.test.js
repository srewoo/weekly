import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusTargets } from '../../src/lib/report/integrations.js';

test('status lookups go to Jira, GitHub and GitLab only, never to a host that has no such API', () => {
  const t = statusTargets([
    { key: 'jira:ENGX-1', url: 'https://acme.atlassian.net/browse/ENGX-1' },
    { key: 'mr:acme/app!4', url: 'https://gitlab.com/acme/app/-/merge_requests/4' },
    { key: 'mr:acme/app!5', url: 'https://github.com/acme/app/pull/5' },
    { key: 'mr:bitbucket.org/acme/app!7', url: 'https://bitbucket.org/acme/app/pull-requests/7' },
  ]);
  assert.deepEqual(t.map(x => x.origin), ['https://acme.atlassian.net', 'https://gitlab.com', 'https://api.github.com']);
});
