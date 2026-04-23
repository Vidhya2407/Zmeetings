import { create } from 'zustand';

interface NavigationStore {
  activeSubCategory: string;
  setSubCategory: (subCategory: string) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activeSubCategory: 'schedule',
  setSubCategory: (subCategory) => set({ activeSubCategory: subCategory }),
}));
