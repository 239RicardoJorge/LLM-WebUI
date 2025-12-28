import React, { useState, useEffect } from 'react';
import { ModelOption } from '../../types';
import { Settings2, ChevronDown, ChevronRight, Zap, Box } from 'lucide-react';

interface ModelSelectorProps {
    currentModel: string;
    onModelChange: (modelId: string) => void;
    availableModels: ModelOption[];
    unavailableModels: Record<string, string>;
    isRefreshing?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
    currentModel,
    onModelChange,
    availableModels,
    unavailableModels,
    isRefreshing = false,
}) => {
    const [viewMode, setViewMode] = useState<'selected' | 'available' | 'all'>(() => {
        const saved = localStorage.getItem('ccs_sidebar_view_mode');
        return (saved as 'selected' | 'available' | 'all') || 'available';
    });

    const [animateModels, setAnimateModels] = useState(false);

    useEffect(() => {
        localStorage.setItem('ccs_sidebar_view_mode', viewMode);
    }, [viewMode]);

    const cycleViewMode = () => {
        setAnimateModels(true);
        if (viewMode === 'available') setViewMode('selected');
        else if (viewMode === 'selected') setViewMode('all');
        else setViewMode('available');
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2 w-full">
                <button
                    onClick={cycleViewMode}
                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-500 flex-1 w-full"
                >
                    <Settings2 className="w-3 h-3" />
                    <span className={`text-[10px] font-bold tracking-widest uppercase flex-1 text-left ${isRefreshing ? 'animate-pulse' : ''}`}>
                        {viewMode === 'all' ? 'ALL MODELS' : (viewMode === 'available' ? 'AVAILABLE MODELS' : 'SELECTED MODEL')}
                    </span>

                    {/* Icon Indication for Modes */}
                    <div className="flex items-center gap-1">
                        {viewMode === 'available' || viewMode === 'all' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>
                </button>
            </div>

            <div
                className={`space-y-1 ${viewMode !== 'selected' && animateModels ? 'animate-fade-up' : ''}`}
                key={viewMode}
            >
                {availableModels.length === 0 ? (
                    <div className="text-center py-6 px-4 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-glass)]">
                        <p className="text-xs text-[var(--text-secondary)] font-medium">No Models Available</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-relaxed">
                            Insert and <span className="text-[var(--text-primary)] font-semibold">Save</span> an API key above to unlock models.
                        </p>
                    </div>
                ) : (
                    availableModels
                        .filter(model => {
                            if (viewMode === 'selected') return model.id === currentModel;
                            if (viewMode === 'available') return !unavailableModels[model.id];
                            return true; // 'all'
                        })
                        .map((model) => {
                            const isActive = currentModel === model.id;
                            const errorCode = unavailableModels[model.id];
                            const isUnavailable = !!errorCode;

                            return (
                                <button
                                    key={model.id}
                                    onClick={() => onModelChange(model.id)}
                                    className={`
                              w-full p-3 rounded-xl border text-left group relative overflow-hidden transition-[background-color,color,border-color,box-shadow,opacity] duration-500
                              ${isActive
                                            ? 'bg-[var(--bg-glass)] border-[var(--border-color)] shadow-lg'
                                            : 'bg-transparent border-transparent hover:bg-[var(--bg-glass)]'}
                              ${isUnavailable ? 'border-red-500/10 bg-red-500/5' : ''}
                          `}
                                >
                                    <div className="flex items-center justify-between mb-1 relative z-10">
                                        <div className={`flex items-center gap-2 ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>
                                            <span className={`text-[13px] font-medium tracking-tight ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                                {model.name}
                                            </span>
                                            {isUnavailable ? (
                                                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1 rounded tracking-tighter">({errorCode})</span>
                                            ) : (
                                                <>
                                                    {model.provider === 'google' && <Zap className="w-3 h-3 text-blue-400" />}
                                                    {model.provider === 'openai' && <Box className="w-3 h-3 text-green-400" />}
                                                </>
                                            )}
                                        </div>
                                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--indicator-bg)] border border-[var(--indicator-border)] shadow-[0_0_8px_var(--indicator-bg)]"></div>}
                                    </div>
                                    <div className={`text-[10px] truncate ${isActive ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'} ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>
                                        {model.description}
                                    </div>
                                </button>
                            );
                        })
                )}
            </div>
        </div>
    );
};

export default ModelSelector;
