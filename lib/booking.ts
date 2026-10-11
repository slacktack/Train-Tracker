// Partner hand-off links. Payment and tickets stay on the partner's site.
export interface BookingTarget {
  from: string;
  to: string;
  // YYYY-MM-DD
  date: string;
  train?: string;
  cls?: string;
  quota?: string;
}

export interface BookingProvider {
  id: 'confirmtkt' | 'ixigo' | 'paytm' | 'railyatri' | 'makemytrip' | 'irctc';
  name: string;
  url: (b: BookingTarget) => string;
}

const dmy = (iso: string) => iso.split('-').reverse().join('-');
const enc = encodeURIComponent;

export const CONFIRMTKT: BookingProvider = {
  id: 'confirmtkt',
  name: 'ConfirmTkt',
  // With a train and class it opens that train's seat calendar; otherwise the route listing.
  url: (b) =>
    b.train && b.cls
      ? `https://www.confirmtkt.com/rbooking/seat-availability/${enc(b.train)}/${enc(b.from)}/${enc(b.to)}/${enc(b.cls)}/${enc(b.quota ?? 'GN')}/${dmy(b.date)}`
      : `https://www.confirmtkt.com/rbooking/trains/from/${enc(b.from)}/to/${enc(b.to)}/${dmy(b.date)}`,
};

export const IXIGO: BookingProvider = {
  id: 'ixigo',
  name: 'ixigo',
  url: (b) => `https://www.ixigo.com/search/result/train/${enc(b.from)}/${enc(b.to)}/${b.date.split('-').reverse().join('')}//1/0/0/0/${enc(b.cls ?? 'ALL')}`,
};

export const PAYTM: BookingProvider = {
  id: 'paytm',
  name: 'Paytm',
  url: (b) => `https://tickets.paytm.com/trains/searchTrains/${enc(b.from)}/${enc(b.to)}/${b.date}`,
};

export const RAILYATRI: BookingProvider = {
  id: 'railyatri',
  name: 'RailYatri',
  url: (b) => `https://www.railyatri.in/booking/trains-between-stations?from_code=${enc(b.from)}&to_code=${enc(b.to)}&journey_date=${dmy(b.date)}`,
};

export const MAKEMYTRIP: BookingProvider = {
  id: 'makemytrip',
  name: 'MakeMyTrip',
  url: (b) => `https://www.makemytrip.com/railways/listing?from=${enc(b.from)}&to=${enc(b.to)}&date=${b.date.replace(/-/g, '')}&classCode=${enc(b.cls ?? '')}`,
};

// IRCTC has no prefill URL; this opens its empty search form.
export const IRCTC: BookingProvider = {
  id: 'irctc',
  name: 'IRCTC',
  url: () => 'https://www.irctc.co.in/nget/train-search',
};

export const PRIMARY_BOOKING = CONFIRMTKT;
export const OTHER_BOOKING = [IXIGO, PAYTM, RAILYATRI, MAKEMYTRIP, IRCTC];

// Official IRCTC eCatering: meal delivery to a seat on this train at this station.
export const ecateringUrl = (train: string, station?: string) =>
  station ? `https://www.ecatering.irctc.co.in/train/${enc(train)}/${enc(station)}/outlets` : 'https://www.ecatering.irctc.co.in/';
