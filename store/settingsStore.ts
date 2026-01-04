import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiKeys } from '../types';

interface SettingsState {
    apiKeys: ApiKeys;
    setApiKeys: (keys: ApiKeys) => void;

    // Theme settings
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;

    // Quick Chat settings
    isQuickChatOpen: boolean;
    setQuickChatOpen: (open: boolean) => void;
    quickChatPosition: { x: number; y: number };
    setQuickChatPosition: (pos: { x: number; y: number }) => void;
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

            isQuickChatOpen: false,
            setQuickChatOpen: (open) => set({ isQuickChatOpen: open }),
            quickChatPosition: { x: window.innerWidth - 400, y: window.innerHeight - 500 }, // Default bottom-right-ish
            setQuickChatPosition: (pos) => set({ quickChatPosition: pos }),
        }),
        {
            name: 'app_settings', // unique name for localStorage key
            partialize: (state) => ({
                apiKeys: state.apiKeys,
                theme: state.theme,
                quickChatPosition: state.quickChatPosition // persist position
            }),
        }
    )
);
