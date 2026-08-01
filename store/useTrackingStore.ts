import { create } from 'zustand';

export type SheetState = 'peek' | 'half' | 'full';

interface TrackingStore {
  sheetState: SheetState;
  setSheetState: (state: SheetState) => void;
}

export const useTrackingStore = create<TrackingStore>((set) => ({
  sheetState: 'peek',
  setSheetState: (state) => set({ sheetState: state }),
}));
