// Builds compact offline indexes from the Find-My-Train APK exports.
// Usage: node scripts/build-offline-data.mjs [path/to/Find-My-Train]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(process.argv[2] ?? join(root, '../../Ai-AGent/Find-My-Train'));
const out = join(root, 'data');
mkdirSync(out, { recursive: true });

const read = (p) => JSON.parse(readFileSync(join(src, 'data', p), 'utf8'));
const round = (n) => Math.round(n * 1e5) / 1e5;

const stations = read('database/station_info.json')
  .filter((s) => s.station_code && s.title)
  .map((s) => [s.station_code, s.title, round(s.lat ?? 0), round(s.lng ?? 0), s.pop ?? 0])
  .sort((a, b) => b[4] - a[4]);

const aliases = {};
for (const a of read('database/station_aka_info.json')) {
  (aliases[a.station_code] ??= []).push(a.title);
}

const trains = read('database/train_info.json')
  .filter((t) => /^\d{5}$/.test(t.train_no))
  .map((t) => [t.train_no, t.train_name, t.train_type, t.pop ?? 0]);

const coaches = Object.fromEntries(
  Object.entries(read('offline/coach-layouts.json')).map(([no, v]) => [no, { rake: v.rake, coaches: v.coaches }])
);

writeFileSync(join(out, 'stations.json'), JSON.stringify(stations));
writeFileSync(join(out, 'station-aliases.json'), JSON.stringify(aliases));
writeFileSync(join(out, 'trains.json'), JSON.stringify(trains));
writeFileSync(join(out, 'coach-layouts.json'), JSON.stringify(coaches));
console.log(`stations=${stations.length} aliases=${Object.keys(aliases).length} trains=${trains.length} layouts=${Object.keys(coaches).length}`);
