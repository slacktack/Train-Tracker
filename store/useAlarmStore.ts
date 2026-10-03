import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Alarm {
  id: string;
  trainNumber: string;
  trainName: string;
  stationCode: string;
  stationName: string;
  leadMin: number;
  createdAt: number;
  firedAt?: number;
}

interface AlarmStore {
  alarms: Alarm[];
  add: (a: Omit<Alarm, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
  markFired: (id: string) => void;
  prune: () => void;
}

export const alarmId = (train: string, station: string) => `${train}-${station}`;
const TTL_MS = 48 * 3600_000;

export const useAlarmStore = create<AlarmStore>()(
  persist(
    (set) => ({
      alarms: [],
      add: (a) =>
        set((s) => {
          const id = alarmId(a.trainNumber, a.stationCode);
          return { alarms: [{ ...a, id, createdAt: Date.now() }, ...s.alarms.filter((x) => x.id !== id)] };
        }),
      remove: (id) => set((s) => ({ alarms: s.alarms.filter((x) => x.id !== id) })),
      markFired: (id) => set((s) => ({ alarms: s.alarms.map((x) => (x.id === id ? { ...x, firedAt: Date.now() } : x)) })),
      prune: () => set((s) => ({ alarms: s.alarms.filter((x) => Date.now() - x.createdAt < TTL_MS) })),
    }),
    { name: 'train-tracker-alarms' },
  ),
);

interface AlarmUi {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useAlarmUiStore = create<AlarmUi>((set) => ({ open: false, setOpen: (open) => set({ open }) }));
