import React, { useState, useEffect } from 'react';
import { MODEL_TAGS, ModelTagId } from '../config/modelTags';
import { Save } from 'lucide-react';

interface TagEditorProps {
    modelId: string;
    modelName: string;
    modelDescription: string;
    currentTags: ModelTagId[];
    onSave: (modelId: string, tags: ModelTagId[]) => void;
    onClose: () => void;
}

const TagEditor: React.FC<TagEditorProps> = ({
    modelId,
    modelName,
    modelDescription,
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
        <div className="w-full p-3 rounded-xl border bg-[var(--bg-glass)] border-[var(--border-color)] shadow-lg animate-[slideDown_0.2s_ease-out]">
            {/* Model Name */}
            <div className="text-[13px] font-medium tracking-tight text-[var(--text-primary)] mb-1">
                {modelName}
            </div>

            {/* Description */}
            <div className="text-[10px] text-[var(--text-secondary)] mb-3">
                {modelDescription}
            </div>

            {/* Tags Grid - Full width for all tags */}
            <div className="flex flex-wrap gap-1 mb-3">
                {MODEL_TAGS.map(tag => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                        <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            className={`text-[8px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded transition-all border ${isSelected
                                ? 'bg-[var(--bg-glass)] text-[var(--text-primary)] border-[var(--border-color)]'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
                                }`}
                        >
                            {tag.label}
                        </button>
                    );
                })}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-500 bg-[var(--bg-glass)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--button-glow)] hover:shadow-[inset_0_0_8px_var(--button-glow)] border border-[var(--border-color)]"
                >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Tags</span>
                </button>
            </div>
        </div>
    );
};

export default TagEditor;
