import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useSettingsStore();

    const cycleTheme = () => {
        // Cycle: dark -> light -> system -> dark
        const newTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
        setTheme(newTheme);

        // Determine if dark mode should be active
        let shouldBeDark = false;
        if (newTheme === 'dark') {
            shouldBeDark = true;
        } else if (newTheme === 'system') {
            shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        // newTheme === 'light' -> shouldBeDark stays false

        // Only modify classList if the actual state changes
        const isDark = document.documentElement.classList.contains('dark');
        if (shouldBeDark && !isDark) {
            document.documentElement.classList.add('dark');
        } else if (!shouldBeDark && isDark) {
            document.documentElement.classList.remove('dark');
        }
        // If shouldBeDark === isDark, do nothing (no flash)
    };

    const getIcon = () => {
        if (theme === 'dark') return <Moon className="w-4 h-4 stroke-[var(--text-secondary)]" />;
        if (theme === 'light') return <Sun className="w-4 h-4 stroke-[var(--text-secondary)]" />;
        return <Monitor className="w-4 h-4 stroke-[var(--text-secondary)]" />;
    };



    return (
        <button
            onClick={cycleTheme}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
            {getIcon()}
        </button>
    );
};

export default ThemeToggle;
