import { fetchJson } from './http';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

interface RawTbs {
  success?: boolean;
  train_between_stations?: Array<{ train_number?: string; on_time_rating?: number | null; from_on_time_rating?: number | null; to_on_time_rating?: number | null }>;
}

export interface Punctuality {
  // 0-10, RailYatri's score from past runs: overall, leaving the boarding station, reaching the destination.
  overall: number;
  from: number | null;
  to: number | null;
}

const score = (v: unknown): number | null => (typeof v === 'number' && v >= 0 && v <= 10 ? v : null);

export function parsePunctuality(json: RawTbs): Record<string, Punctuality> {
  const out: Record<string, Punctuality> = {};
  for (const t of json.train_between_stations ?? []) {
    const overall = score(t.on_time_rating);
    if (!t.train_number || overall === null) continue;
    out[t.train_number] = { overall, from: score(t.from_on_time_rating), to: score(t.to_on_time_rating) };
  }
  return out;
}

/** On-time ratings per train for a route. Dates are DD-MM-YYYY. */
export async function getPunctuality(from: string, to: string, dmy: string): Promise<Record<string, Punctuality>> {
  const qs = new URLSearchParams({ from, to, dateOfJourney: dmy });
  const json = await fetchJson<RawTbs>('railyatri', `https://trainticketapi.railyatri.in/api/trains-between-station-with-sa.json?${qs}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json', Origin: 'https://www.railyatri.in', Referer: 'https://www.railyatri.in/' },
    timeoutMs: 6_000,
  });
  return parsePunctuality(json);
}
