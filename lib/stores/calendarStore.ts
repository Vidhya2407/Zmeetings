import { create } from 'zustand';
import type { CalendarEvent } from '@/types/domain/workspace';

export type CalendarView = 'month' | 'week';

interface CalendarState {
  events: CalendarEvent[];
  currentDate: string;
  view: CalendarView;
  scheduleModalOpen: boolean;
  loading: boolean;
  setEvents: (events: CalendarEvent[]) => void;
  setCurrentDate: (isoDate: string) => void;
  setView: (view: CalendarView) => void;
  setScheduleModalOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useCalendarStore = create<CalendarState>((set) => ({
  events: [],
  currentDate: new Date().toISOString(),
  view: 'month',
  scheduleModalOpen: false,
  loading: false,
  setEvents: (events) => set({ events }),
  setCurrentDate: (currentDate) => set({ currentDate }),
  setView: (view) => set({ view }),
  setScheduleModalOpen: (scheduleModalOpen) => set({ scheduleModalOpen }),
  setLoading: (loading) => set({ loading }),
}));

