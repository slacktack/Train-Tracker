import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// A partner hand-off the user may come back from with a PNR.
export interface PendingBooking {
  trainNo: string;
  trainName: string;
  from: string;
  to: string;
  date: string;
  provider: string;
  at: number;
}

const TTL_MS = 6 * 3600_000;

interface PendingStore {
  pending: PendingBooking | null;
  start: (b: Omit<PendingBooking, 'at'>) => void;
  dismiss: () => void;
}

export const usePendingBooking = create<PendingStore>()(
  persist(
    (set) => ({
      pending: null,
      start: (b) => set({ pending: { ...b, at: Date.now() } }),
      dismiss: () => set({ pending: null }),
    }),
    {
      name: 'train-tracker-pending-booking',
      onRehydrateStorage: () => (state) => {
        if (state?.pending && Date.now() - state.pending.at > TTL_MS) state.dismiss();
      },
    },
  ),
);
