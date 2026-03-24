import { create } from 'zustand';

type AppContextType = 'levis' | 'bounty' | 'admin';

interface AppState {
  appContext: AppContextType;
  selectedStore: string;
  dateRangeDays: number;
  setAppContext: (context: AppContextType) => void;
  setSelectedStore: (store: string) => void;
  setDateRangeDays: (days: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  appContext: 'admin',
  selectedStore: 'All Stores',
  dateRangeDays: 30,
  setAppContext: (context) => set({ appContext: context }),
  setSelectedStore: (store) => set({ selectedStore: store }),
  setDateRangeDays: (days) => set({ dateRangeDays: days }),
}));
