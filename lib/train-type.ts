/** Shared train-type → color/label helpers used by the map and detail cards. */

export const TRAIN_TYPE_COLORS: Record<string, string> = {
  RAJ: '#0A84FF',   // Rajdhani
  SHT: '#34C759',   // Shatabdi
  VNDB: '#AF52DE',  // Vande Bharat
  TEJ: '#BF5AF2',   // Tejas
  DRNT: '#FF2D55',  // Duronto
  JSH: '#00C7BE',   // Jan Shatabdi
  GBR: '#FFD60A',   // Garib Rath
  AMTB: '#FF453A',  // Amrit Bharat
  MEX: '#FF9F0A',   // Mail/Express
  SUF: '#FF375F',   // Superfast
  PEXP: '#8E8E93',  // Parcel/Cargo
  TOD: '#A2845E',   // Special (train on demand)
  PAS: '#5E5CE6',   // Passenger
  MEMU: '#32ADE6',  // MEMU
  DMU: '#64D2FF',   // DMU/DEMU
  SUB: '#5AC8FA',   // Suburban local
  EMU: '#30D158',   // EMU
  PILT: '#8E8E93',  // Pilot/works
};

const TYPE_LABELS: Record<string, string> = {
  RAJ: 'Rajdhani',
  SHT: 'Shatabdi',
  VNDB: 'Vande Bharat',
  TEJ: 'Tejas',
  DRNT: 'Duronto',
  JSH: 'Jan Shatabdi',
  GBR: 'Garib Rath',
  AMTB: 'Amrit Bharat',
  MEX: 'Express',
  SUF: 'Superfast',
  PEXP: 'Cargo',
  TOD: 'Special',
  PAS: 'Passenger',
  MEMU: 'MEMU',
  DMU: 'DMU',
  SUB: 'Local',
  EMU: 'EMU',
  PILT: 'Pilot',
};

export function trainTypeColor(type: string): string {
  return TRAIN_TYPE_COLORS[type] ?? '#30D158';
}

const TYPE_LABELS_HI: Record<string, string> = {
  RAJ: 'राजधानी', SHT: 'शताब्दी', VNDB: 'वंदे भारत', TEJ: 'तेजस', DRNT: 'दुरंतो', JSH: 'जन शताब्दी',
  GBR: 'गरीब रथ', AMTB: 'अमृत भारत', MEX: 'एक्सप्रेस', SUF: 'सुपरफास्ट', PEXP: 'पार्सल', TOD: 'स्पेशल',
  PAS: 'पैसेंजर', MEMU: 'मेमू', DMU: 'डीएमयू', SUB: 'लोकल', EMU: 'ईएमयू', PILT: 'पायलट',
};

export function trainTypeLabel(type: string, lang: 'en' | 'hi' = 'en'): string {
  return (lang === 'hi' ? TYPE_LABELS_HI[type] : TYPE_LABELS[type]) ?? (lang === 'hi' ? 'ट्रेन' : 'Train');
}

/** Canonical ordering for filter chips — premium classes first. */
export const TRAIN_TYPE_ORDER: string[] = [
  'VNDB', 'RAJ', 'SHT', 'TEJ', 'DRNT', 'JSH', 'GBR', 'AMTB',
  'SUF', 'MEX', 'PEXP', 'TOD', 'PAS', 'MEMU', 'DMU', 'SUB', 'EMU', 'PILT',
];

export function sortTrainTypes(types: string[]): string[] {
  const order = new Map(TRAIN_TYPE_ORDER.map((t, i) => [t, i]));
  return [...types].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}
