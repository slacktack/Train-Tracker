import { NextRequest, NextResponse } from 'next/server';
import { badRequest, cached, isIsoDate, isStationCode, isTrainNo } from '@/lib/api';
import { getCoachChart } from '@/lib/railjournal';
import { getIrctcComposition } from '@/lib/sources/irctc';
import { getCoachLayout } from '@/lib/sources/offline';

type Source = 'irctc' | 'railjournal' | 'none';

interface SeatsPayload {
  trainNo: string;
  station: string;
  date: string;
  source: Source;
  chartPrepared: boolean | null;
  coaches: Array<{ coachName: string; classCode: string; positionFromEngine: number; vacantBerths: number | null }>;
  layout: { rake: string; coaches: string[] } | null;
  notes: string[];
}

// Occupancy: IRCTC first, then railjournal's open chart; offline rake layout is always attached.
async function load(trainNo: string, station: string, date: string): Promise<SeatsPayload> {
  const layout = getCoachLayout(trainNo);
  const notes: string[] = [];

  try {
    const irctc = await getIrctcComposition({ trainNo, date, boarding: station });
    if (irctc.coaches.length > 0) {
      return { trainNo, station, date, source: 'irctc', chartPrepared: irctc.chartPrepared, coaches: irctc.coaches, layout, notes };
    }
    notes.push('IRCTC returned no coach data (chart may not be prepared yet).');
  } catch {
    notes.push('IRCTC is unreachable from this network.');
  }

  try {
    const chart = await getCoachChart(trainNo, station, date);
    if (chart && chart.coaches.length > 0) {
      return { trainNo, station, date, source: 'railjournal', chartPrepared: true, coaches: chart.coaches, layout, notes };
    }
    notes.push('No public chart for this journey yet.');
  } catch {
    notes.push('Backup chart source is unavailable.');
  }

  const coaches = (layout?.coaches ?? []).map((c, i) => ({ coachName: c, classCode: '', positionFromEngine: i + 1, vacantBerths: null }));
  return { trainNo, station, date, source: 'none', chartPrepared: null, coaches, layout, notes };
}

export async function GET(req: NextRequest, { params }: { params: { trainNumber: string } }) {
  const { trainNumber } = params;
  const station = req.nextUrl.searchParams.get('station')?.toUpperCase() ?? null;
  const date = req.nextUrl.searchParams.get('date');
  if (!isTrainNo(trainNumber)) return badRequest('train must be a 5-digit number');
  if (!isStationCode(station)) return badRequest('station must be a station code');
  if (!isIsoDate(date)) return badRequest('date must be YYYY-MM-DD');

  const payload = await cached(`seats:${trainNumber}:${station}:${date}`, 180, () => load(trainNumber, station, date));
  return NextResponse.json(payload);
}
