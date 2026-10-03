import type { AvailabilityTrain, ClassAvailability } from '@/lib/sources/confirmtkt';

const RANK = { confirm: 3, probable: 2, unknown: 1, 'no-chance': 0, closed: -1 } as const;

/** The class most worth showing for a train: best seat chance, then cheapest. */
export function bestClassOf(t: AvailabilityTrain): ClassAvailability | null {
  return [...t.classes].filter((c) => c.verdict !== 'closed').sort((a, b) => RANK[b.verdict] - RANK[a.verdict] || (a.fare ?? 1e9) - (b.fare ?? 1e9))[0] ?? null;
}
