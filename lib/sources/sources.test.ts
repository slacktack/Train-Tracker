import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { adler32, parseBoard, parseDelay, signParams } from './wimt';
import { humanizeStatus, outcomeOf, parseAvailability, parsePnr } from './confirmtkt';
import { projectRow, type RadarRow } from './projection';
import { mapRjRow, normalizeType } from './rj-map';
import { wimtDateToJourney, journeyDateToWimt } from './wimt-journey';
import { searchStations } from './offline';

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, '../../test/fixtures', name), 'utf8'));

describe('WIMT signing', () => {
  it('matches the reference Adler-32 vectors', () => {
    expect(adler32('abc123xyz')).toBe(251069224);
    expect(adler32('Wikipedia')).toBe(0x11e60398);
  });
  it('signs user+appVersion+qid+suffix with no separators', () => {
    const p = { user: 'u', appVersion: 'v', qid: 'q' };
    expect(signParams(p, 'S').wid).toBe(String(adler32('uvqS')));
  });
  it('converts journey dates both ways', () => {
    expect(wimtDateToJourney('03-10-2026')).toBe('03-Oct-2026');
    expect(journeyDateToWimt('03-Oct-2026')).toBe('03-10-2026');
  });
});

describe('WIMT board', () => {
  it('parses a real NDLS board', () => {
    const raw = JSON.parse(fixture('wimt-station-ndls.json').response.body);
    const { rows } = parseBoard(raw, 'NDLS');
    expect(rows.length).toBeGreaterThan(10);
    expect(rows[0].trainNo).toMatch(/^\d{5}$/);
    expect(rows.some((r) => r.delayDepMin !== null)).toBe(true);
  });
  it('reads delay strings', () => {
    expect(parseDelay('RIGHT TIME')).toBe(0);
    expect(parseDelay('06:35')).toBe(395);
    expect(parseDelay('')).toBeNull();
  });
});

describe('ConfirmTkt', () => {
  it('parses real availability with fares and verdicts', () => {
    const res = parseAvailability(fixture('confirmtkt-availability-sbc-mas.json'));
    expect(res.trains.length).toBeGreaterThan(5);
    const t = res.trains[0];
    expect(t.classes.length).toBeGreaterThan(0);
    expect(t.runsOn.length).toBeGreaterThan(0);
    expect(res.trains.some((x) => x.classes.some((c) => c.fare))).toBe(true);
  });
  it('speaks plain English', () => {
    expect(humanizeStatus('CURR_AVL 17')).toBe('AVL 17');
    expect(humanizeStatus('RLWL 2/WL 2')).toBe('WL 2');
    expect(humanizeStatus('Train Departed')).toBe('Departed');
    expect(humanizeStatus('No more booking')).toBe('Booking closed');
  });
  it('classifies how past waitlists ended', () => {
    expect(outcomeOf('CNF S9 20')).toBe('confirmed');
    expect(outcomeOf('RLWL 1')).toBe('waitlisted');
    expect(outcomeOf('RAC 4')).toBe('rac');
  });
  it('turns an unknown PNR into a not-found error', () => {
    const body = { data: { pnrResponse: { error: 'Flushed PNR /PNR not yet generated', trainNo: null } } };
    expect(() => parsePnr(body, '1234567890')).toThrow(/not yet generated/);
  });
});

describe('live positions', () => {
  it('maps the open snapshot and keeps type codes valid', () => {
    expect(normalizeType('HMSF')).toBe('SUF');
    expect(normalizeType('nonsense')).toBe('MEX');
    const t = mapRjRow(
      { train_no: '12951', train_name: 'X', train_type: 'RAJ', start_date: '03 Oct', actual_time: '', lat: 19.2, lon: 72.8, speed: 97, gps_time: null, heading: 10, event_type: 'T' },
      Date.now(),
    );
    expect(t?.source).toBe('GPS');
    expect(t?.speedKmh).toBe(97);
  });
  it('projects a RailRadar row between its two stations', () => {
    const row: RadarRow = {
      train_number: '12028', train_name: 'T', type: 'Shatabdi Express', mins_since_dep: 30, current_station: 'A', current_station_name: 'A',
      current_lat: 12, current_lng: 77, departure_minutes: 360, current_day: 1, next_station: 'B', next_station_name: 'B', next_lat: 13, next_lng: 78,
      next_arrival_minutes: 420, curr_distance: 0, next_distance: 100,
    };
    const snap = Date.parse('2026-10-03T06:30:00+05:30');
    const p = projectRow(row, snap, snap + 10 * 60_000);
    expect(p.lat).toBeGreaterThan(12);
    expect(p.lat).toBeLessThan(13);
  });
});

describe('offline station search', () => {
  it('finds stations by code, name and alias', () => {
    expect(searchStations('ndls')[0].code).toBe('NDLS');
    expect(searchStations('bangalore').some((s) => s.code === 'SBC')).toBe(true);
  });
});

import { isNoTrains } from './confirmtkt';
describe('empty routes', () => {
  it('recognises every way ConfirmTkt says there is nothing', () => {
    expect(isNoTrains('No trains found')).toBe(true);
    expect(isNoTrains('No direct trains found....')).toBe(true);
    expect(isNoTrains('confirmtkt: No direct trains found....')).toBe(true);
    expect(isNoTrains('Service unavailable')).toBe(false);
  });
});

describe('ConfirmTkt monthly availability', () => {
  it('uses the current waitlist position and skips errored days', async () => {
    const { parseMonthly } = await import('./confirmtkt');
    const days = parseMonthly(
      [
        { SL: { Doj: '2026-10-25T00:00:00', CurrentStatus: 'RLWL62/WL46', Prediction: '78% Chance', ConfirmTktStatus: 'Confirm', CacheTime: '2026-10-11T20:50:07.001' } },
        { SL: { Doj: '2026-10-26T00:00:00', CurrentStatus: 'CURR_AVL 17', Prediction: 'Available', ConfirmTktStatus: 'Confirm' } },
        { SL: { Doj: '2026-10-27T00:00:00', Error: 'boom' } },
      ],
      'SL',
    );
    expect(days).toEqual([
      { date: '2026-10-25', status: 'WL 46', prediction: '78% Chance', verdict: 'confirm', cachedAt: '2026-10-11T20:50:07.001' },
      { date: '2026-10-26', status: 'AVL 17', prediction: '', verdict: 'confirm', cachedAt: null },
    ]);
  });
});

describe('humanizeStatus availability forms', () => {
  it('reads AVAILABLE-0015 as AVL 15', async () => {
    const { humanizeStatus } = await import('./confirmtkt');
    expect(humanizeStatus('AVAILABLE-0015')).toBe('AVL 15');
    expect(humanizeStatus('CURR_AVL-0017')).toBe('AVL 17');
  });
});
