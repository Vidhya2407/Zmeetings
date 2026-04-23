import { create } from 'zustand';
import type { ActivityItem } from '@/types/domain/workspace';

export type ActivityFilter = 'all' | 'unread' | 'mentions';

interface ActivityState {
  items: ActivityItem[];
  filter: ActivityFilter;
  loading: boolean;
  setItems: (items: ActivityItem[]) => void;
  setFilter: (filter: ActivityFilter) => void;
  markReadLocal: (id: string) => void;
  markAllReadLocal: () => void;
  setLoading: (loading: boolean) => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  items: [],
  filter: 'all',
  loading: false,
  setItems: (items) => set({ items }),
  setFilter: (filter) => set({ filter }),
  markReadLocal: (id) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    })),
  markAllReadLocal: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, read: true })),
    })),
  setLoading: (loading) => set({ loading }),
}));

