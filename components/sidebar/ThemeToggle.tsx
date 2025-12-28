import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useSettingsStore();

    const cycleTheme = () => {
        // Cycle: dark -> light -> system -> dark
        const newTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
        setTheme(newTheme);

        // Apply theme class to document
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            // System: check prefers-color-scheme
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    };

    const getIcon = () => {
        if (theme === 'dark') return <Moon className="w-4 h-4" />;
        if (theme === 'light') return <Sun className="w-4 h-4" />;
        return <Monitor className="w-4 h-4" />;
    };



    return (
        <button
            onClick={cycleTheme}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-500"
        >
            {getIcon()}
        </button>
    );
};

export default ThemeToggle;
