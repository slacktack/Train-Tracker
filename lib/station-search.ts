// Pure station search shared by the server (API) and the client (instant autocomplete).
export interface StationRow {
  code: string;
  name: string;
  lat: number;
  lng: number;
  pop: number;
}

export interface StationIndexEntry {
  s: StationRow;
  n: string;
  a: string[];
}

export const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function scoreMatch(q: string, code: string, name: string, extra: string[] = []): number {
  if (code.toLowerCase() === q) return 100;
  if (name === q) return 95;
  if (code && code.toLowerCase().startsWith(q) && q.length >= 2) return 80;
  if (name.startsWith(q)) return 70;
  if (name.split(' ').some((w) => w.startsWith(q))) return 55;
  if (extra.some((a) => a.startsWith(q) || a.includes(q))) return 45;
  if (name.includes(q)) return 30;
  const words = q.split(' ');
  if (words.length > 1 && words.every((w) => name.includes(w))) return 25;
  return 0;
}

type Row = [string, string, number, number, number];

export function buildStationIndex(rows: Row[], aliases: Record<string, string[]>): StationIndexEntry[] {
  return rows.map(([code, name, lat, lng, pop]) => ({
    s: { code, name, lat, lng, pop },
    n: normText(name),
    a: (aliases[code] ?? []).map(normText),
  }));
}

export function searchStationIndex(index: StationIndexEntry[], query: string, limit = 8): StationRow[] {
  const q = normText(query);
  if (!q) return [];
  const hits: Array<{ s: StationRow; sc: number }> = [];
  for (const { s, n, a } of index) {
    const sc = scoreMatch(q, s.code, n, a);
    if (sc > 0) hits.push({ s, sc });
  }
  // a well-used station should beat an obscure one that merely starts with the same words
  const boost = (h: { s: StationRow; sc: number }) => h.sc + Math.min(45, h.s.pop / 18);
  return hits
    .sort((x, y) => boost(y) - boost(x) || y.s.pop - x.s.pop)
    .slice(0, limit)
    .map((x) => x.s);
}
