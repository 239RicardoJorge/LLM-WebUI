import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiKeys } from '../types';

interface SettingsState {
    apiKeys: ApiKeys;
    setApiKeys: (keys: ApiKeys) => void;

    // Theme settings
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKeys: {
                google: '',
                groq: '',
            },
            setApiKeys: (keys) => set({ apiKeys: keys }),

            theme: 'dark',
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: 'app_settings', // unique name for localStorage key
            partialize: (state) => ({ apiKeys: state.apiKeys, theme: state.theme }),
        }
    )
);
