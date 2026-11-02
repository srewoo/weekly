// Builds the extension, copies it, pre-grants the permissions headless Chromium
// cannot click through, and runs the end-to-end suite against the copy. A second,
// untouched copy runs the no-tabs checks: tracking off, everything else working (W3).
// With --zip it builds nothing: both runs use dist/weekly-<version>.zip, unzipped, as uploaded to the store.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const root = new URL('../..', import.meta.url).pathname;
const work = join(root, '.e2e');
const ext = join(work, 'ext');

const fromZip = process.argv.includes('--zip');
if (!fromZip) execFileSync('node', [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const built = fromZip ? unzipRelease() : join(root, 'dist/weekly');
cpSync(built, ext, { recursive: true });
const noTabs = join(work, 'ext-notabs');
cpSync(built, noTabs, { recursive: true });

/** The store zip, unpacked: manifest.json at its root, carrying the version the zip is named after. */
function unzipRelease() {
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const zip = join(root, 'dist', `weekly-${version}.zip`);
  if (!existsSync(zip)) throw new Error(`${zip} is missing: run npm run package first`);
  const dir = join(work, 'zip');
  execFileSync('unzip', ['-q', zip, '-d', dir]);
  const shipped = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).version;
  if (shipped !== version) throw new Error(`the zip's manifest says ${shipped}, package.json ${version}`);
  console.log(`End-to-end on ${zip.slice(root.length)} (manifest ${shipped})`);
  return dir;
}

const manifestPath = join(ext, 'manifest.json');
const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
// tabs (tracking) and history are optional in the build; this copy has them from the start.
m.permissions = [...new Set([...(m.permissions ?? []), 'history', 'tabs'])];
m.optional_permissions = (m.optional_permissions ?? []).filter((p) => !m.permissions.includes(p));
m.host_permissions = ['https://acme.atlassian.net/*', 'https://gitlab.com/*', 'https://hooks.slack.com/*'];
writeFileSync(manifestPath, JSON.stringify(m, null, 2));

const pwDir = join(homedir(), 'Library/Caches/ms-playwright');
// Newest Playwright Chromium build that actually contains a binary.
const findChromium = () => {
  const dirs = readdirSync(pwDir).filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const dir of dirs) {
    for (const app of readdirSync(join(pwDir, dir)).filter((d) => d.startsWith('chrome-mac'))) {
      for (const bundle of readdirSync(join(pwDir, dir, app)).filter((d) => d.endsWith('.app'))) {
        const bin = join(pwDir, dir, app, bundle, 'Contents/MacOS');
        if (existsSync(bin) && readdirSync(bin).length) return join(bin, readdirSync(bin)[0]);
      }
    }
  }
  throw new Error('No Playwright Chromium found; set CHROMIUM_PATH');
};
const chromium = process.env.CHROMIUM_PATH ?? findChromium();

execFileSync('node', [join(root, 'test/e2e/full.mjs'), ext, chromium, work], { stdio: 'inherit' });
execFileSync('node', [join(root, 'test/e2e/no-tabs.mjs'), noTabs, chromium, join(work, 'no-tabs')], { stdio: 'inherit' });
