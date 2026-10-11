import { describe, expect, it } from 'vitest';
import { CONFIRMTKT, IXIGO, MAKEMYTRIP, PAYTM, RAILYATRI, ecateringUrl } from './booking';

const b = { from: 'NDLS', to: 'MMCT', date: '2026-10-25' };

describe('booking links', () => {
  it('ConfirmTkt: route listing, or the train seat calendar when class is known', () => {
    expect(CONFIRMTKT.url(b)).toBe('https://www.confirmtkt.com/rbooking/trains/from/NDLS/to/MMCT/25-10-2026');
    expect(CONFIRMTKT.url({ ...b, train: '12952', cls: '3A', quota: 'TQ' })).toBe('https://www.confirmtkt.com/rbooking/seat-availability/12952/NDLS/MMCT/3A/TQ/25-10-2026');
  });
  it('other partners use their own date formats', () => {
    expect(IXIGO.url({ ...b, cls: '3A' })).toBe('https://www.ixigo.com/search/result/train/NDLS/MMCT/25102026//1/0/0/0/3A');
    expect(PAYTM.url(b)).toBe('https://tickets.paytm.com/trains/searchTrains/NDLS/MMCT/2026-10-25');
    expect(RAILYATRI.url(b)).toBe('https://www.railyatri.in/booking/trains-between-stations?from_code=NDLS&to_code=MMCT&journey_date=25-10-2026');
    expect(MAKEMYTRIP.url(b)).toContain('date=20261025');
  });
  it('eCatering links to the train at a station', () => {
    expect(ecateringUrl('12952', 'KOTA')).toBe('https://www.ecatering.irctc.co.in/train/12952/KOTA/outlets');
  });
});
