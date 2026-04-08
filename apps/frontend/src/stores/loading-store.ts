import { create } from "zustand";

interface LoadingState {
  loadingCount: number;
  start: () => void;
  finish: () => void;
  isLoading: boolean;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  loadingCount: 0,
  isLoading: false,
  start: () =>
    set((state) => {
      const nextCount = state.loadingCount + 1;
      return { loadingCount: nextCount, isLoading: nextCount > 0 };
    }),
  finish: () =>
    set((state) => {
      const nextCount = Math.max(0, state.loadingCount - 1);
      return { loadingCount: nextCount, isLoading: nextCount > 0 };
    }),
}));
