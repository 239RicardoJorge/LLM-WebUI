import React from 'react';
import { Terminal } from 'lucide-react';

/**
 * EmptyState - Displays "System Ready" placeholder when no messages exist
 */
const EmptyState: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-glass)] border border-[var(--border-color)] flex items-center justify-center shadow-2xl">
                <Terminal className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-sm font-mono text-[var(--text-muted)] tracking-widest uppercase">
                System Ready
            </p>
        </div>
    );
};

export default EmptyState;
