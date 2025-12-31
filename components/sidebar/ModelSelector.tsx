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
                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex-1 w-full"
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
                              w-full p-3 rounded-xl border text-left group relative overflow-hidden transition-all duration-500
                              ${isActive
                                            ? 'bg-[var(--bg-glass)] border-[var(--border-color)] shadow-lg hover:border-[var(--button-glow)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1),inset_0_0_8px_var(--button-glow)]'
                                            : 'bg-transparent border-transparent hover:bg-[var(--bg-glass)]'}
                              ${isUnavailable ? 'border-red-500/10 bg-red-500/5' : ''}
                          `}
                                >
                                    {/* First row: Name + Status (inline flow) + Ball (flex aligned) */}
                                    <div className="relative mb-1 flex items-start justify-between min-h-[1.25em]">
                                        {/* Name: first words flow normally, last word + status stay together */}
                                        <span style={{ lineHeight: '1.25', display: 'block' }} className={`text-[13px] font-medium tracking-tight pr-4 ${isUnavailable ? 'opacity-50 grayscale' : ''} ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                            {model.name.trim().split(' ').slice(0, -1).join(' ')}{model.name.trim().split(' ').length > 1 ? ' ' : ''}
                                            {/* Last word + status in nowrap container with flex alignment */}
                                            <span className="inline-flex items-center whitespace-nowrap">
                                                <span>{model.name.trim().split(' ').slice(-1)}</span>
                                                {/* Status icon - inline, right after last word */}
                                                <span className={`inline-flex items-center gap-1 ml-1.5 ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>
                                                    {isUnavailable ? (
                                                        <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1 rounded tracking-tighter">({errorCode})</span>
                                                    ) : (
                                                        <>
                                                            {model.provider === 'google' && <Zap className="w-3 h-3 text-blue-400 inline" />}
                                                            {model.provider === 'openai' && <Box className="w-3 h-3 text-green-400 inline" />}
                                                        </>
                                                    )}
                                                </span>
                                            </span>
                                        </span>
                                        {/* Ball - centered with first line using margin-top to offset line-height center */}
                                        <div className={`shrink-0 w-1.5 h-1.5 rounded-full mt-[6px] ${isActive ? 'bg-[var(--indicator-bg)] border border-[var(--indicator-border)] shadow-[0_0_8px_var(--indicator-bg)]' : ''}`}></div>
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
