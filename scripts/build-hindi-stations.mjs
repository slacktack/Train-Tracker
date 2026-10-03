// Fetches Hindi station labels from Wikidata (CC0) keyed by Indian Railways station code.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const query = 'SELECT ?code ?hi WHERE { ?s wdt:P5696 ?code . ?s rdfs:label ?hi . FILTER(LANG(?hi)="hi") }';
const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
  headers: { 'User-Agent': 'TrainTracker/0.1 (localhost personal project)', Accept: 'application/sparql-results+json' },
});
if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
const rows = (await res.json()).results.bindings;

const clean = (s) => s.replace(/\s*रेलवे\s*(स्टेशन|स्थानक)\s*$/u, '').replace(/\s*(स्टेशन|स्थानक)\s*$/u, '').trim();
const out = {};
for (const r of rows) {
  const code = r.code.value.trim().toUpperCase();
  const name = clean(r.hi.value);
  if (code && name && !out[code]) out[code] = name;
}
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data/station-names-hi.json'), JSON.stringify(out));
console.log(`hindi station names: ${Object.keys(out).length}`);
