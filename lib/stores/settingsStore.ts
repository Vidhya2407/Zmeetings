import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  pushNotifications: boolean;
  carbonMilestoneAlerts: boolean;
  setPushNotifications: (value: boolean) => void;
  setCarbonMilestoneAlerts: (value: boolean) => void;
  reset: () => void;
}

const defaultSettings = {
  pushNotifications: true,
  carbonMilestoneAlerts: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setPushNotifications: (pushNotifications) => set({ pushNotifications }),
      setCarbonMilestoneAlerts: (carbonMilestoneAlerts) => set({ carbonMilestoneAlerts }),
      reset: () => set(defaultSettings),
    }),
    {
      name: 'zstream-settings',
    }
  )
);
