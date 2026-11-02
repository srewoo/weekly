// Copies the extension into dist/weekly/ (only what Chrome needs) and checks every referenced file exists.
// The version in package.json is the single source of truth: it is stamped into the built manifest.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist', 'weekly');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

if (!/^\d+(\.\d+){0,3}$/.test(pkg.version)) throw new Error(`Chrome needs a numeric version like 2.0.0, got "${pkg.version}"`);
manifest.version = pkg.version;

const shipped = readdirSync(root).filter(f => /\.(js|html|css)$/.test(f));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of shipped) cpSync(join(root, f), join(out, f));
cpSync(join(root, 'icons'), join(out, 'icons'), { recursive: true, filter: src => !src.endsWith('.DS_Store') });
cpSync(join(root, 'src'), join(out, 'src'), { recursive: true, filter: p => !p.endsWith('.DS_Store') && !p.endsWith('package.json') });
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// Every file the manifest, pages and worker point at must be in the build.
const refs = [
  manifest.background.service_worker, manifest.side_panel.default_path,
  ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
];
// Walk static imports from the worker and every <script type="module">, so a missing module fails the build.
const seen = new Set();
const walk = file => {
  if (seen.has(file)) return;
  seen.add(file);
  refs.push(file);
  if (!existsSync(join(root, file))) return;   // reported as missing below
  const src = readFileSync(join(root, file), 'utf8');
  for (const [, spec] of src.matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) walk(join(dirname(file), spec));
  // Scripts the worker injects with chrome.scripting (the on-page note) are named by path, not imported.
  for (const [, injected] of src.matchAll(/['"](src\/content\/[\w./-]+\.js)['"]/g)) refs.push(injected);
};
walk(manifest.background.service_worker);
const htmlFiles = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : []);
const external = /^(#|[a-z][a-z0-9+.-]*:|\/)/i;   // absolute URLs, #anchors, mailto:, chrome-extension:, data:
for (const f of [...shipped.filter(f => f.endsWith('.html')), ...htmlFiles('src')]) {
  const html = readFileSync(join(root, f), 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) if (!external.test(ref)) refs.push(join(dirname(f), ref.replace(/[?#].*$/, '')));
  for (const [, ref] of html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) if (!external.test(ref)) walk(join(dirname(f), ref));
}
const missing = [...new Set(refs)].filter(f => !existsSync(join(out, f)));
if (missing.length) throw new Error('Missing from build: ' + missing.join(', '));

console.log(`Built Weekly ${pkg.version} → dist/weekly (${shipped.length + 1} files + icons, ${new Set(refs).size} references checked)`);
