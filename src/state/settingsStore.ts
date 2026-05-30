import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type State = {
  hasHydrated: boolean;
  hasOnboarded: boolean;
  useNerdFont: boolean;
  autoFocusTerminal: boolean;
  demoMode: boolean;
  voiceEnabled: boolean;
  sttLocale: string;
  ttsRate: number;
  voiceButtonPosition: 'left' | 'right';
};

type Actions = {
  setHasHydrated: (value: boolean) => void;
  setOnboarded: (value: boolean) => void;
  setUseNerdFont: (value: boolean) => void;
  setAutoFocusTerminal: (value: boolean) => void;
  setDemoMode: (value: boolean) => void;
  setVoiceEnabled: (value: boolean) => void;
  setSttLocale: (value: string) => void;
  setTtsRate: (value: number) => void;
  setVoiceButtonPosition: (value: 'left' | 'right') => void;
};

export type SettingsStore = State & Actions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      hasHydrated: false,
      hasOnboarded: false,
      useNerdFont: true,
      autoFocusTerminal: false,
      demoMode: false,
      voiceEnabled: false,
      sttLocale: '',
      ttsRate: 1.0,
      voiceButtonPosition: 'right',
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setOnboarded: (value) => set({ hasOnboarded: value }),
      setUseNerdFont: (value) => set({ useNerdFont: value }),
      setAutoFocusTerminal: (value) => set({ autoFocusTerminal: value }),
      setDemoMode: (value) => set({ demoMode: value }),
      setVoiceEnabled: (value) => set({ voiceEnabled: value }),
      setSttLocale: (value) => set({ sttLocale: value }),
      setTtsRate: (value) => set({ ttsRate: value }),
      setVoiceButtonPosition: (value) => set({ voiceButtonPosition: value }),
    }),
    {
      name: 'muxy.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        useNerdFont: state.useNerdFont,
        autoFocusTerminal: state.autoFocusTerminal,
        hasOnboarded: state.hasOnboarded,
        demoMode: state.demoMode,
        voiceEnabled: state.voiceEnabled,
        sttLocale: state.sttLocale,
        ttsRate: state.ttsRate,
        voiceButtonPosition: state.voiceButtonPosition,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
