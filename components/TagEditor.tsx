import React, { useState, useEffect } from 'react';
import { MODEL_TAGS, ModelTagId } from '../config/modelTags';
import { X } from 'lucide-react';

interface TagEditorProps {
    modelId: string;
    modelName: string;
    currentTags: ModelTagId[];
    onSave: (modelId: string, tags: ModelTagId[]) => void;
    onClose: () => void;
}

const TagEditor: React.FC<TagEditorProps> = ({
    modelId,
    modelName,
    currentTags,
    onSave,
    onClose
}) => {
    const [selectedTags, setSelectedTags] = useState<ModelTagId[]>(currentTags);

    useEffect(() => {
        setSelectedTags(currentTags);
    }, [currentTags]);

    const toggleTag = (tagId: ModelTagId) => {
        setSelectedTags(prev =>
            prev.includes(tagId)
                ? prev.filter(t => t !== tagId)
                : [...prev, tagId]
        );
    };

    const handleSave = () => {
        onSave(modelId, selectedTags);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease-out]"
            onClick={onClose}
            style={{
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            <div
                className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-4 w-72 shadow-xl"
                onClick={e => e.stopPropagation()}
                style={{
                    animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Edit Tags</h3>
                    <button
                        onClick={onClose}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Model Name */}
                <p className="text-xs text-[var(--text-secondary)] mb-3 truncate">{modelName}</p>

                {/* Tags Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    {MODEL_TAGS.map(tag => {
                        const isSelected = selectedTags.includes(tag.id);
                        return (
                            <button
                                key={tag.id}
                                onClick={() => toggleTag(tag.id)}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${isSelected
                                    ? 'bg-[var(--accent-color)] text-white'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
                                    }`}
                            >
                                <span>{tag.emoji}</span>
                                <span>{tag.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 text-xs bg-[var(--accent-color)] text-white rounded hover:opacity-90 transition-opacity"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TagEditor;
