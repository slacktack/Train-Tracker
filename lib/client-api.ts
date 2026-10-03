import type { AvailabilityResult, PnrResult, TrendPoint } from '@/lib/sources/confirmtkt';
import type { BoardRow } from '@/lib/sources/wimt';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public provider?: string,
  ) {
    super(message);
  }
}

export async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.code, body?.provider);
  }
  return body as T;
}

export interface StationHit {
  code: string;
  name: string;
  lat: number;
  lng: number;
  pop: number;
}

export type BetweenResponse = AvailabilityResult & {
  from: StationHit | { code: string; name: string };
  to: StationHit | { code: string; name: string };
  date: string;
  quota: string;
};

export interface TrendsResponse {
  train: string;
  class: string;
  quota: string;
  points: TrendPoint[];
  tally: { confirmed: number; rac: number; waitlisted: number; unknown: number };
}

export interface BoardResponse {
  station: StationHit;
  hrs: number;
  rows: BoardRow[];
  modifiedAt: string | null;
}

export interface SeatsResponse {
  trainNo: string;
  station: string;
  date: string;
  source: 'irctc' | 'railjournal' | 'none';
  chartPrepared: boolean | null;
  coaches: Array<{ coachName: string; classCode: string; positionFromEngine: number; vacantBerths: number | null }>;
  layout: { rake: string; coaches: string[] } | null;
  notes: string[];
}

export type { PnrResult };
