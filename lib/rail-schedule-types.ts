// Server-free types + date helpers shared between API routes and client
// components. Keep this module free of any Node-only imports (fs/os/path)
// so it can be bundled into client components.

export interface ScheduleStation {
  stationCode: string;
  stationName: string;
  arrivalTime: string;
  departureTime: string;
  routeNumber: string;
  haltTime: string;
  distance: string;
  dayCount: string;
  stnSerialNumber: string;
  status: string;
}

export interface TrainSchedule {
  trainNumber: string;
  trainName: string;
  stationFrom: string;
  stationTo: string;
  trainRunsOn: string[];
  duration: string;
  stationList: ScheduleStation[];
}

export interface CoachEntry {
  coachName: string;
  classCode: string;
  positionFromEngine: number;
  vacantBerths: number;
}

export interface CoachChart {
  trainNo: string;
  trainName: string;
  from: string;
  to: string;
  coaches: CoachEntry[];
}

/** Today's date in the exact `DD-Mmm-YYYY` format check_train_info expects. */
export function todayInIST(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date());
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return `${day}-${month}-${year}`;
}

/** Today's date in ISO `YYYY-MM-DD` — the format chart.php (coach chart) requires. */
export function todayInISTISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}
