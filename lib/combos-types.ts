import type { AvailabilityTrain } from '@/lib/sources/confirmtkt';

export interface ComboLeg {
  train: AvailabilityTrain;
  depIso: string;
  depTime: string;
  arrIso: string;
  arrTime: string;
  durationMin: number;
}

export type ChangeRisk = 'tight' | 'ok' | 'long';

/** One change between two legs. */
export interface ComboStop {
  hub: { code: string; name: string };
  layoverMin: number;
  risk: ChangeRisk;
  /** the same train continues: two tickets on one train, only the booking is split */
  sameTrain?: boolean;
}

export interface Combo {
  id: string;
  /** two or more trains, in travel order */
  legs: ComboLeg[];
  /** one entry per change, so stops.length === legs.length - 1 */
  stops: ComboStop[];
  /** total time spent waiting at changes */
  layoverMin: number;
  totalMin: number;
  /** the worst change in the trip */
  risk: ChangeRisk;
  bookable: boolean;
  tags?: Array<'fastest' | 'bestSeats' | 'safest'>;
  depIso: string;
  depTime: string;
  arrIso: string;
  arrTime: string;
}

export interface AlternativesResponse {
  mode: 'connect' | 'route';
  combos: Combo[];
  searched: number;
  /** for a planned route: how many trains each leg has on the day, so an empty leg can be named */
  legCounts?: number[];
  /** when nothing connects: a nearby station that does */
  suggestions?: Array<{ stopIndex: number; code: string; name: string; trains: number }>;
}
