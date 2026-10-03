import { fetchJson } from './http';

const BASE = 'https://www.irctc.co.in/online-charts/api';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export interface IrctcCoach {
  coachName: string;
  classCode: string;
  positionFromEngine: number;
  vacantBerths: number;
}

export interface IrctcComposition {
  trainNo: string;
  chartPrepared: boolean;
  coaches: IrctcCoach[];
}

interface RawComposition {
  cdd?: Array<{ coachName?: string; classCode?: string; positionFromEngine?: number | string; vacantBerths?: number | string }>;
  chartOneFlag?: boolean | string;
  chartTwoFlag?: boolean | string;
  chartPrepared?: boolean | string;
  error?: string;
}

const truthy = (v: unknown) => v === true || v === 'true' || v === 'Y';

// Unverified live: IRCTC refuses non-Indian networks, so callers must handle failure.
export async function getIrctcComposition(opts: { trainNo: string; date: string; boarding: string }): Promise<IrctcComposition> {
  const json = await fetchJson<RawComposition>('irctc', `${BASE}/trainComposition`, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      bmirak: 'webbm',
      greq: String(Date.now()),
      'User-Agent': UA,
    },
    body: JSON.stringify({ trainNo: opts.trainNo, jDate: opts.date, boardingStation: opts.boarding }),
    timeoutMs: 8_000,
  });
  const coaches = (json.cdd ?? []).map<IrctcCoach>((c) => ({
    coachName: c.coachName ?? '',
    classCode: c.classCode ?? '',
    positionFromEngine: Number(c.positionFromEngine ?? 0),
    vacantBerths: Number(c.vacantBerths ?? 0),
  }));
  return {
    trainNo: opts.trainNo,
    chartPrepared: truthy(json.chartPrepared) || truthy(json.chartOneFlag) || truthy(json.chartTwoFlag),
    coaches,
  };
}
