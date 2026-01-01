import React, { useState, useEffect } from 'react';
import { ModelOption } from '../../types';
import { Settings2, ChevronDown, ChevronRight, Zap, Sparkles } from 'lucide-react';
import { MODEL_TAGS, ModelTagId } from '../../config/modelTags';
import { useModelTags } from '../../hooks/useModelTags';
import TagEditor from '../TagEditor';

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
    const [activeTagFilters, setActiveTagFilters] = useState<ModelTagId[]>([]);
    const [editingModel, setEditingModel] = useState<{ id: string; name: string } | null>(null);
    const [hoveredModel, setHoveredModel] = useState<string | null>(null);
    const [hoveredBall, setHoveredBall] = useState<string | null>(null);

    const { getModelTags, setModelTags } = useModelTags();

    useEffect(() => {
        localStorage.setItem('ccs_sidebar_view_mode', viewMode);
    }, [viewMode]);

    const cycleViewMode = () => {
        setAnimateModels(true);
        if (viewMode === 'available') setViewMode('selected');
        else if (viewMode === 'selected') setViewMode('all');
        else setViewMode('available');
    };

    const handleSaveTags = async (modelId: string, tags: ModelTagId[]) => {
        await setModelTags(modelId, tags);
    };

    const toggleTagFilter = (tagId: ModelTagId) => {
        setActiveTagFilters(prev =>
            prev.includes(tagId)
                ? prev.filter(t => t !== tagId)
                : [...prev, tagId]
        );
    };

    // Filter models by tags (intersectional - AND logic)
    const filteredModels = availableModels
        .filter(model => {
            // View mode filter
            if (viewMode === 'selected') return model.id === currentModel;
            if (viewMode === 'available') return !unavailableModels[model.id];
            return true; // 'all'
        })
        .filter(model => {
            // Tag filter - intersectional (model must have ALL selected tags)
            if (activeTagFilters.length === 0) return true;
            const modelTags = getModelTags(model.id);
            return activeTagFilters.every(filterTag => modelTags.includes(filterTag));
        });

    const getHeaderText = () => {
        if (viewMode === 'all') return `ALL MODELS (${filteredModels.length})`;
        if (viewMode === 'available') return `AVAILABLE MODELS (${filteredModels.length})`;
        return 'SELECTED MODEL';
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2 w-full">
                <button
                    onClick={cycleViewMode}
                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex-1 transition-colors"
                >
                    <Settings2 className="w-3 h-3" />
                    <span className={`text-[10px] font-bold tracking-widest uppercase flex-1 text-left ${isRefreshing ? 'animate-pulse' : ''}`}>
                        {getHeaderText()}
                    </span>
                    <div className="flex items-center gap-1">
                        {viewMode === 'available' || viewMode === 'all' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>
                </button>
            </div>

            {/* Tag Filter - Horizontal tabs with multi-select */}
            {viewMode !== 'selected' && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {MODEL_TAGS.map(tag => (
                        <button
                            key={tag.id}
                            onClick={() => toggleTagFilter(tag.id)}
                            className={`text-[9px] font-medium tracking-wider uppercase px-2 py-1 rounded transition-all ${activeTagFilters.includes(tag.id)
                                ? 'bg-[var(--bg-glass)] text-[var(--text-primary)] border border-[var(--border-color)]'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                }`}
                        >
                            {tag.label}
                        </button>
                    ))}
                </div>
            )}

            <div
                className={`space-y-1 ${viewMode !== 'selected' && animateModels ? 'animate-fade-up' : ''}`}
                key={viewMode}
            >
                {filteredModels.length === 0 ? (
                    <div className="text-center py-6 px-4 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-glass)]">
                        <p className="text-xs text-[var(--text-secondary)] font-medium">
                            {activeTagFilters.length > 0 ? 'No models with all selected tags' : 'No Models Available'}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-relaxed">
                            {activeTagFilters.length > 0
                                ? 'Try selecting fewer tags or edit model tags.'
                                : <>Insert and <span className="text-[var(--text-primary)] font-semibold">Save</span> an API key above to unlock models.</>
                            }
                        </p>
                    </div>
                ) : (
                    filteredModels.map((model) => {
                        const isActive = currentModel === model.id;
                        const errorCode = unavailableModels[model.id];
                        const isUnavailable = !!errorCode;
                        const tags = getModelTags(model.id);
                        const isBallHovered = hoveredBall === model.id;

                        return (
                            <div
                                key={model.id}
                                onMouseEnter={() => setHoveredModel(model.id)}
                                onMouseLeave={() => setHoveredModel(null)}
                                className="relative group"
                            >
                                <button
                                    onClick={() => onModelChange(model.id)}
                                    className={`
                                      w-full p-3 rounded-xl border text-left relative overflow-hidden transition-all duration-500
                                      ${isActive
                                            ? 'bg-[var(--bg-glass)] border-[var(--border-color)] shadow-lg hover:border-[var(--button-glow)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1),inset_0_0_8px_var(--button-glow)]'
                                            : 'bg-transparent border-transparent hover:bg-[var(--bg-glass)]'}
                                      ${isUnavailable ? 'border-red-500/10 bg-red-500/5' : ''}
                                  `}
                                >
                                    {/* First row: Name + Status + Ball Container */}
                                    <div className="relative mb-1 flex items-start justify-between min-h-[1.25em]">
                                        <span style={{ lineHeight: '1.25', display: 'block' }} className={`text-[13px] font-medium tracking-tight pr-4 ${isUnavailable ? 'opacity-50 grayscale' : ''} ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                            {model.name.trim().split(' ').slice(0, -1).join(' ')}{model.name.trim().split(' ').length > 1 ? ' ' : ''}
                                            <span className="inline-flex items-center whitespace-nowrap">
                                                <span>{model.name.trim().split(' ').slice(-1)}</span>
                                                <span className={`inline-flex items-center gap-1 ml-1.5 ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>

                                                    {isUnavailable ? (
                                                        <span className={`text-[10px] font-bold px-1 rounded tracking-tighter ${errorCode === '429' ? 'text-yellow-500 bg-yellow-500/10' :
                                                            errorCode === 'TERMS' ? 'text-purple-500 bg-purple-500/10' :
                                                                errorCode === 'AUTH' ? 'text-orange-500 bg-orange-500/10' :
                                                                    errorCode === 'UNSUPPORTED' ? 'text-gray-500 bg-gray-500/10' :
                                                                        errorCode === 'BILLING' ? 'text-amber-500 bg-amber-500/10' :
                                                                            'text-red-500 bg-red-500/10'
                                                            }`}>({errorCode})</span>
                                                    ) : (
                                                        <>
                                                            {model.provider === 'google' && <Sparkles className="w-3 h-3 text-blue-400 inline" />}
                                                            {model.provider === 'groq' && <Zap className="w-3 h-3 text-orange-400 inline" />}
                                                        </>
                                                    )}
                                                </span>
                                            </span>
                                        </span>

                                        {/* Ball Container - reserved space, aligned with first line */}
                                        {/* Line height ~16.25px. 16px container centers nicely with mt-0. */}
                                        <div
                                            className="relative shrink-0 w-4 h-4 cursor-pointer z-10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingModel({ id: model.id, name: model.name });
                                            }}
                                            onMouseEnter={() => setHoveredBall(model.id)}
                                            onMouseLeave={() => setHoveredBall(null)}
                                        >
                                            <div
                                                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ease-out ${isActive
                                                        ? 'bg-[var(--indicator-bg)] border border-[var(--indicator-border)] shadow-[0_0_8px_var(--indicator-bg)]'
                                                        : 'border border-transparent'
                                                    } ${isBallHovered
                                                        ? 'w-2.5 h-2.5'
                                                        : 'w-1.5 h-1.5'
                                                    }`}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className={`text-[10px] truncate mb-2 ${isActive ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'} ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>
                                        {model.description}
                                    </div>

                                    {/* Tags - Chips below description */}
                                    {tags.length > 0 && (
                                        <div className={`flex flex-wrap gap-1 ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>
                                            {tags.map((tagId) => {
                                                const tag = MODEL_TAGS.find(t => t.id === tagId);
                                                return tag ? (
                                                    <span
                                                        key={tagId}
                                                        className={`text-[8px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded ${isActive
                                                                ? 'bg-[var(--bg-depth)] text-[var(--text-secondary)]'
                                                                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                                                            }`}
                                                    >
                                                        {tag.label}
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Tag Editor Modal */}
            {editingModel && (
                <TagEditor
                    modelId={editingModel.id}
                    modelName={editingModel.name}
                    currentTags={getModelTags(editingModel.id)}
                    onSave={handleSaveTags}
                    onClose={() => setEditingModel(null)}
                />
            )}
        </div>
    );
};

export default ModelSelector;
