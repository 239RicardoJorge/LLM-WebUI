import React, { useState, useEffect, useRef } from 'react';
import { ModelOption } from '../../types';
import { Settings2, ChevronDown, ChevronRight, Zap, Sparkles, Save } from 'lucide-react';
import { MODEL_TAGS, ModelTagId } from '../../config/modelTags';
import { useModelTags } from '../../hooks/useModelTags';

interface ModelSelectorProps {
    currentModel: string;
    onModelChange: (modelId: string) => void;
    availableModels: ModelOption[];
    unavailableModels: Record<string, string>;
    isRefreshing?: boolean;
    onEditingChange?: (isEditing: boolean) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
    currentModel,
    onModelChange,
    availableModels,
    unavailableModels,
    isRefreshing = false,
    onEditingChange,
}) => {
    const [viewMode, setViewMode] = useState<'selected' | 'available' | 'all'>(() => {
        const saved = localStorage.getItem('ccs_sidebar_view_mode');
        return (saved as 'selected' | 'available' | 'all') || 'available';
    });

    const [animateModels, setAnimateModels] = useState(false);
    const [activeTagFilters, setActiveTagFilters] = useState<ModelTagId[]>([]);
    const [editingModel, setEditingModel] = useState<{ id: string; name: string } | null>(null);
    const [editingTags, setEditingTags] = useState<ModelTagId[]>([]);
    const [hoveredBall, setHoveredBall] = useState<string | null>(null);

    const { getModelTags, setModelTags } = useModelTags();

    const modelRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Scroll to model when selected or editing
    useEffect(() => {
        if (editingModel) {
            // Delay slightly to allow for expansion animation
            setTimeout(() => {
                const el = modelRefs.current.get(editingModel.id);
                el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 250);
        } else if (currentModel) {
            const el = modelRefs.current.get(currentModel);
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [currentModel, editingModel?.id]);

    useEffect(() => {
        localStorage.setItem('ccs_sidebar_view_mode', viewMode);
    }, [viewMode]);

    // Clean up invalid tags from filters (e.g. if tags are removed from config)
    useEffect(() => {
        const validTags = MODEL_TAGS.map(t => t.id);
        setActiveTagFilters(prev => prev.filter(tag => validTags.includes(tag)));
    }, []);

    // Notify parent when editing state changes
    useEffect(() => {
        onEditingChange?.(!!editingModel);
    }, [editingModel, onEditingChange]);

    // Handle global click outside to close editor
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (editingModel) {
                const target = event.target as Element;
                if (!target.closest('.editing-model-card')) {
                    setEditingModel(null);
                    setEditingTags([]);
                }
            }
        };

        if (editingModel) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editingModel]);

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
                <div className={`border border-dashed border-[var(--border-color)]/30 rounded-lg p-1.5 mb-2 bg-[var(--bg-glass)]/5 ${animateModels ? 'animate-fade-up' : ''}`}>
                    <div className="flex flex-wrap gap-1">
                        {MODEL_TAGS.map(tag => {
                            const isActive = activeTagFilters.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    onClick={() => toggleTagFilter(tag.id)}
                                    className={`text-[8px] font-medium tracking-wide uppercase px-1 py-[1px] rounded-[3px] border transition-all ${isActive
                                        ? 'bg-[var(--bg-depth)] text-[var(--text-secondary)] border-[var(--border-color)]'
                                        : 'bg-transparent text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
                                        }`}
                                >
                                    {tag.label}
                                </button>
                            );
                        })}
                    </div>
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
                        const tags = getModelTags(model.id).sort((a, b) => {
                            const aIndex = MODEL_TAGS.findIndex(t => t.id === a);
                            const bIndex = MODEL_TAGS.findIndex(t => t.id === b);
                            return aIndex - bIndex;
                        });
                        const isBallHovered = hoveredBall === model.id;
                        const isEditing = editingModel?.id === model.id;

                        // Pre-compute name parts for efficiency
                        const nameParts = model.name.trim().split(' ');
                        const namePrefix = nameParts.slice(0, -1).join(' ');
                        const nameSuffix = nameParts.slice(-1)[0];

                        return (
                            <div
                                key={model.id}
                                ref={(el: HTMLDivElement | null) => {
                                    if (el) modelRefs.current.set(model.id, el);
                                    else modelRefs.current.delete(model.id);
                                }}
                                className={`relative group ${isEditing ? 'editing-model-card' : ''}`}
                                style={isEditing ? {
                                    backgroundColor: 'var(--bg-primary)',
                                    borderRadius: '12px'
                                } : {}}
                            >
                                <div
                                    onClick={() => !isEditing && onModelChange(model.id)}
                                    className={`
                                      w-full p-3 rounded-xl border text-left relative transition-all duration-300 ease-out cursor-pointer
                                      ${isActive
                                            ? 'bg-[var(--bg-glass)] border-[var(--border-color)] shadow-lg hover:border-[var(--button-glow)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1),inset_0_0_8px_var(--button-glow)]'
                                            : 'bg-transparent border-transparent hover:bg-[var(--bg-glass)]'}
                                      ${isUnavailable ? 'border-red-500/10 bg-red-500/5' : ''}
                                      ${isEditing ? 'bg-[var(--bg-glass)] border-[var(--border-color)] shadow-none cursor-default' : ''}
                                  `}
                                    style={{ overflow: 'visible' }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            if (!isEditing) onModelChange(model.id);
                                        }
                                    }}
                                >
                                    {/* First row: Name + Status + Ball Container */}
                                    <div className="relative mb-1 flex items-start justify-between min-h-[1.25em]">
                                        <span style={{ lineHeight: '1.25', display: 'block' }} className={`text-[13px] font-medium tracking-tight pr-4 ${isUnavailable ? 'opacity-50 grayscale' : ''} ${isActive || isEditing ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                            {namePrefix}{nameParts.length > 1 ? ' ' : ''}
                                            <span className="inline-flex items-center whitespace-nowrap">
                                                <span>{nameSuffix}</span>
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

                                        {/* Ball Container - aligned with first line */}
                                        <div
                                            className={`relative shrink-0 w-4 h-4 cursor-pointer z-10 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isEditing) {
                                                    setEditingModel(null);
                                                    setEditingTags([]);
                                                } else {
                                                    setEditingModel({ id: model.id, name: model.name });
                                                    setEditingTags(tags);
                                                }
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
                                    <div className={`text-[10px] mb-2 ${isActive || isEditing ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'} ${isUnavailable ? 'opacity-50 grayscale' : ''} ${isEditing ? '' : 'truncate'}`}>
                                        {model.description}
                                    </div>

                                    {/* Tags - Show ALL tags when editing, only selected tags otherwise */}
                                    <div className={`flex flex-wrap gap-0.5 ${isEditing ? 'mb-2' : ''} ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>
                                        {isEditing ? (
                                            MODEL_TAGS.map((tag, index) => {
                                                const isSelected = editingTags.includes(tag.id);
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newTags = isSelected
                                                                ? editingTags.filter(t => t !== tag.id)
                                                                : [...editingTags, tag.id];
                                                            setEditingTags(newTags);
                                                        }}
                                                        className={`text-[8px] font-medium tracking-wide uppercase px-1 py-[1px] rounded-[3px] border transition-all ${isSelected
                                                            ? 'bg-[var(--bg-depth)] text-[var(--text-secondary)] border-[var(--border-color)]'
                                                            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
                                                            }`}
                                                        style={{ animation: isSelected ? 'none' : `fadeIn 0.2s ease-out ${index * 0.03}s both` }}
                                                    >
                                                        {tag.label}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            tags.length > 0 && tags.map((tagId) => {
                                                const tag = MODEL_TAGS.find(t => t.id === tagId);
                                                return tag ? (
                                                    <span
                                                        key={tagId}
                                                        className={`text-[8px] font-medium tracking-wide uppercase px-1 py-[1px] rounded-[3px] border ${isActive
                                                            ? 'bg-[var(--bg-depth)] text-[var(--text-secondary)] border-[var(--border-color)]'
                                                            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-transparent'
                                                            }`}
                                                    >
                                                        {tag.label}
                                                    </span>
                                                ) : null;
                                            })
                                        )}
                                    </div>

                                    {/* Action buttons when editing - Animated container */}
                                    <div
                                        className={`grid transition-[grid-template-rows] duration-200 ease-out ${isEditing
                                            ? 'grid-rows-[1fr]'
                                            : 'grid-rows-[0fr]'
                                            }`}
                                    >
                                        <div className="overflow-hidden">
                                            <div
                                                className={`flex justify-end gap-3 pt-2 border-t border-[var(--border-color)] transition-opacity duration-300 ${isEditing ? 'opacity-100' : 'opacity-0'
                                                    }`}
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingModel(null);
                                                        setEditingTags([]);
                                                    }}
                                                    className="px-2 py-1.5 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        await handleSaveTags(model.id, editingTags);
                                                        setEditingModel(null);
                                                        setEditingTags([]);
                                                    }}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg-glass)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--button-glow)] hover:shadow-[inset_0_0_8px_var(--button-glow)] border border-[var(--border-color)] transition-all duration-300"
                                                >
                                                    <Save className="w-3 h-3" />
                                                    <span>Save Tags</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ModelSelector;
