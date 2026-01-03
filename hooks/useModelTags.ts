import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ModelTagId, ModelTagsMap } from '../config/modelTags';

const API_URL = '/api/model-tags';

export function useModelTags() {
    const [tags, setTags] = useState<ModelTagsMap>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch tags on mount
    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch(API_URL);
            if (!res.ok) throw new Error('Failed to fetch tags');
            const data = await res.json();
            setTags(data);
            setError(null);
        } catch (e: unknown) {
            const err = e as Error;
            console.error('Error fetching model tags:', err);
            toast.error('Failed to load model tags');
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const setModelTags = useCallback(async (modelId: string, modelTags: ModelTagId[]) => {
        try {
            const res = await fetch(API_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, tags: modelTags })
            });

            if (!res.ok) throw new Error('Failed to update tags');

            // Update local state
            setTags(prev => {
                const next = { ...prev };
                if (modelTags.length === 0) {
                    delete next[modelId];
                } else {
                    next[modelId] = modelTags;
                }
                return next;
            });

            return true;
        } catch (e: unknown) {
            const err = e as Error;
            console.error('Error updating model tags:', err);
            toast.error('Failed to save model tags');
            setError(err.message);
            return false;
        }
    }, []);

    const getModelTags = useCallback((modelId: string): ModelTagId[] => {
        return tags[modelId] || [];
    }, [tags]);

    const hasTag = useCallback((modelId: string, tag: ModelTagId): boolean => {
        return (tags[modelId] || []).includes(tag);
    }, [tags]);

    return {
        tags,
        isLoading,
        error,
        fetchTags,
        setModelTags,
        getModelTags,
        hasTag
    };
}
