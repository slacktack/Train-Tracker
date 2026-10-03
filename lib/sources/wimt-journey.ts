import type { TrainSchedule } from '@/lib/rail-schedule-types';
import type { RailJournalTrainInfo, RailJournalTimetableRow } from '@/lib/railjournal';
import { getStation } from './offline';
import type { WimtLive, WimtStop } from './wimt';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "03-10-2026" -> "03-Oct-2026" and back.
export function wimtDateToJourney(d: string): string {
  const [dd, mm, yyyy] = d.split('-');
  return `${dd}-${MONTHS[Number(mm) - 1] ?? mm}-${yyyy}`;
}

export function journeyDateToWimt(d: string): string {
  const [dd, mon, yyyy] = d.split('-');
  const mm = String(MONTHS.indexOf(mon) + 1).padStart(2, '0');
  return `${dd}-${mm}-${yyyy}`;
}

const delayStr = (n: number | undefined) => String(Math.max(0, Math.round(n ?? 0)));

function nameFor(code: string, schedule?: TrainSchedule | null): string {
  const fromSchedule = schedule?.stationList.find((s) => s.stationCode === code)?.stationName?.trim();
  return getStation(code)?.name || fromSchedule || code;
}

export interface AdaptOptions {
  trainNo: string;
  schedule?: TrainSchedule | null;
  displayName?: string;
}

// Maps WIMT live_status onto the timetable shape the journey normaliser consumes.
export function wimtToTrainInfo(live: WimtLive, opts: AdaptOptions): RailJournalTrainInfo | null {
  const stops: WimtStop[] = (live.days_schedule ?? []).filter((s) => s.station_code && s.stops !== false);
  if (stops.length === 0) return null;

  const status = live.running_status ?? null;
  const cancelled = status === 'cancelled';
  const finished = status === 'end' || status === 'finished';
  const started = status === 'running' || status === 'started' || finished;

  // Pass-through stations carry departure flags too, so read progress from every entry.
  const everyStop = live.days_schedule ?? [];
  const lastDepSno = everyStop.reduce((max, s, i) => (s.departed ? Math.max(max, s.sno ?? i) : max), -1);
  const snoOf = (s: WimtStop) => s.sno ?? everyStop.indexOf(s);
  const curIdx = live.curStn ? stops.findIndex((s) => s.station_code === live.curStn) : -1;
  // Source stops are never flagged departed, so also infer progress from the current station.
  let lastPassed = -1;
  stops.forEach((s, i) => {
    if (snoOf(s) <= lastDepSno) lastPassed = i;
  });
  if (started && live.departed) lastPassed = Math.max(lastPassed, 0);
  if (started && curIdx >= 0) lastPassed = Math.max(lastPassed, live.departedCurStn ? curIdx : curIdx - 1);
  const atCur = started && !finished && !live.departedCurStn && curIdx > lastPassed ? curIdx : -1;
  const lastIdx = stops.length - 1;
  const schedDist = new Map(opts.schedule?.stationList.map((s) => [s.stationCode, s.distance]) ?? []);

  const rows: RailJournalTimetableRow[] = stops.map((s, i) => {
    const passed = finished ? i < lastIdx || !!s.departed : i <= lastPassed;
    const arrived = passed || i === atCur || (finished && i === lastIdx);
    const km = Number(schedDist.get(s.station_code));
    return {
      sr: String(i + 1),
      station_code: s.station_code,
      station_name: nameFor(s.station_code, opts.schedule),
      distance: String(Number.isFinite(km) ? km : i === 0 ? 0 : Math.round(s.distance ?? 0)),
      sta: s.sch_arrival_time ?? s.sch_departure_time ?? '',
      eta: started ? (s.actual_arrival_time ?? '') : '',
      std: s.sch_departure_time ?? s.sch_arrival_time ?? '',
      etd: started ? (s.actual_departure_time ?? s.actual_arrival_time ?? '') : '',
      has_arrived: arrived ? (s.actual_arrival_time ?? 'Y') : '-',
      has_departed: passed ? (s.actual_departure_time ?? s.actual_arrival_time ?? 'Y') : '-',
      delay_arrival: delayStr(s.delay_in_arrival),
      delay_departure: delayStr(s.delay_in_departure ?? s.delay_in_arrival),
      pf: s.platform ?? '*',
      lat: s.lat,
      lng: s.lng,
    };
  });

  const first = rows[0];
  const last = rows[lastIdx];
  const lastPassedIdx = rows.reduce((acc, r, i) => (r.has_departed !== '-' ? i : acc), -1);
  const cur = atCur >= 0 ? rows[atCur] : lastPassedIdx >= 0 ? rows[lastPassedIdx] : null;
  let message: string;
  if (cancelled) message = 'Cancelled';
  else if (!started) message = 'Yet to start';
  else if (finished) message = `Arrived at ${last.station_name}(${last.station_code})`;
  else if (atCur >= 0 && cur) message = `Arrived at ${cur.station_name}(${cur.station_code})`;
  else message = `Departed from ${cur?.station_name ?? first.station_name}(${cur?.station_code ?? first.station_code})`;

  return {
    status: true,
    train_no: opts.trainNo,
    train_name: opts.displayName ?? opts.schedule?.trainName ?? live.train_name ?? opts.trainNo,
    train_sub_type: live.train_type ?? '',
    start_date: live.start_date ? wimtDateToJourney(live.start_date) : '',
    current_location: cur?.station_code ?? null,
    loco_speed: 0,
    live_delay_min: started ? Math.max(0, Math.round(live.delay ?? 0)) : undefined,
    current_position: {
      description: '',
      train_source: first.station_code,
      train_destination: last.station_code,
      train_status_last_location: message,
    },
    train_public_time_table: rows,
  };
}
