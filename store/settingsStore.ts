import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiKeys } from '../types';

interface SettingsState {
    apiKeys: ApiKeys;
    setApiKeys: (keys: ApiKeys) => void;
    setApiKey: (provider: keyof ApiKeys, key: string) => void;

    // Potential future settings
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKeys: {
                google: '',
                openai: '',
            },
            setApiKeys: (keys) => set({ apiKeys: keys }),
            setApiKey: (provider, key) =>
                set((state) => ({
                    apiKeys: { ...state.apiKeys, [provider]: key }
                })),

            theme: 'dark',
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: 'app_settings', // unique name for localStorage key
            partialize: (state) => ({ apiKeys: state.apiKeys, theme: state.theme }),
        }
    )
);
