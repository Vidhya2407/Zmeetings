import { create } from 'zustand';
import type { WorkspaceUser } from '@/types/domain/workspace';

interface PeopleState {
  people: WorkspaceUser[];
  searchQuery: string;
  selectedUserId: string | null;
  loading: boolean;
  setPeople: (people: WorkspaceUser[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedUserId: (userId: string | null) => void;
  setLoading: (value: boolean) => void;
}

export const usePeopleStore = create<PeopleState>((set) => ({
  people: [],
  searchQuery: '',
  selectedUserId: null,
  loading: false,
  setPeople: (people) => set({ people }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedUserId: (selectedUserId) => set({ selectedUserId }),
  setLoading: (loading) => set({ loading }),
}));

