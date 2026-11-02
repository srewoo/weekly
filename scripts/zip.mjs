// Zips dist/weekly/ into dist/weekly-<version>.zip for the Chrome Web Store.
// manifest.json sits at the zip root (the store rejects a zip with a top-level folder).
// No dependencies: a minimal zip writer on node:zlib. Fixed timestamps make the zip reproducible.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'dist', 'weekly');
const { version } = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));
const dest = join(root, 'dist', `weekly-${version}.zip`);

const walk = dir => readdirSync(dir).sort().flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const DOS_DATE = (0 << 9) | (1 << 5) | 1;   // 1980-01-01, the zip epoch
const parts = [], central = [];
let offset = 0;
for (const file of walk(src)) {
  const data = readFileSync(file);
  const body = deflateRawSync(data, { level: 9 });
  const name = Buffer.from(relative(src, file).split(sep).join('/'));
  const crc = crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
  head.writeUInt16LE(0, 10); head.writeUInt16LE(DOS_DATE, 12); head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(body.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(name.length, 26);
  const dir = Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x0800, 8); dir.writeUInt16LE(8, 10);
  dir.writeUInt16LE(0, 12); dir.writeUInt16LE(DOS_DATE, 14); dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(body.length, 20);
  dir.writeUInt32LE(data.length, 24); dir.writeUInt16LE(name.length, 28); dir.writeUInt32LE(offset, 42);
  parts.push(head, name, body);
  central.push(dir, name);
  offset += head.length + name.length + body.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
const count = central.length / 2;
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
writeFileSync(dest, Buffer.concat([...parts, cd, end]));
console.log(`Packed ${count} files → ${relative(root, dest)} (${(statSync(dest).size / 1024).toFixed(1)} KB)`);
