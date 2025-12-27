import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ModelOption } from '../types';
import { UnifiedService } from '../services/geminiService';
import { useSettingsStore } from '../store/settingsStore';
import { APP_CONFIG } from '../config/constants';

export const useModelManagement = () => {
    const { apiKeys } = useSettingsStore();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [currentModel, setCurrentModel] = useState(() => {
        return localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CURRENT_MODEL) || '';
    });

    const [availableModels, setAvailableModels] = useState<ModelOption[]>(() => {
        const saved = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.AVAILABLE_MODELS);
        return saved ? JSON.parse(saved) : [];
    });

    const [unavailableModels, setUnavailableModels] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.UNAVAILABLE_MODELS);
            return saved ? JSON.parse(saved) : {};
        } catch (e) { return {}; }
    });

    const [unavailableModelErrors, setUnavailableModelErrors] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.UNAVAILABLE_MODEL_ERRORS);
            return saved ? JSON.parse(saved) : {};
        } catch (e) { return {}; }
    });

    // Persistence
    useEffect(() => {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.CURRENT_MODEL, currentModel);
    }, [currentModel]);

    useEffect(() => {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.UNAVAILABLE_MODELS, JSON.stringify(unavailableModels));
    }, [unavailableModels]);

    useEffect(() => {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.UNAVAILABLE_MODEL_ERRORS, JSON.stringify(unavailableModelErrors));
    }, [unavailableModelErrors]);

    // BATCH UPDATE LOGIC (Gradual Population)
    const refreshModels = async (manual = false) => {
        if (!apiKeys.google && !apiKeys.openai) {
            setAvailableModels([]);
            return;
        }

        setIsRefreshing(true);
        if (manual) toast.info("Refreshing models...");

        try {
            // 1. Fetch ALL models from providers (structure only)
            const [googleModels, openaiModels] = await Promise.all([
                apiKeys.google ? UnifiedService.validateKeyAndGetModels('google', apiKeys.google).catch(() => []) : Promise.resolve([]),
                apiKeys.openai ? UnifiedService.validateKeyAndGetModels('openai', apiKeys.openai).catch(() => []) : Promise.resolve([])
            ]);

            const allModels = [...(googleModels as ModelOption[]), ...(openaiModels as ModelOption[])];

            // 2. Set Available Models IMMEDIATELY (Gradual Population)
            setAvailableModels(allModels);
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(allModels));

            // Select first if needed
            if (!currentModel && allModels.length > 0) {
                if (!allModels.find(m => m.id === currentModel)) {
                    setCurrentModel(allModels[0].id);
                }
            }

            // 3. Background Verification (Gradual - Updates as they fail)
            // We await the array of promises to keep 'isRefreshing' true for UI feedback, but they run in parallel
            const verifyPromises = allModels.map(async (m) => {
                const key = m.provider === 'google' ? apiKeys.google : apiKeys.openai;
                if (!key) return;

                const result = await UnifiedService.checkModelAvailability(m.provider, m.id, key);

                if (!result.available) {
                    const finalCode = result.errorCode === '429' ? '429' : '400';
                    setUnavailableModels(prev => ({ ...prev, [m.id]: finalCode }));
                    setUnavailableModelErrors(prev => ({ ...prev, [m.id]: result.error || 'Unknown Error' }));
                } else {
                    // Clear error if it existed
                    setUnavailableModels(prev => {
                        const next = { ...prev };
                        delete next[m.id];
                        return next;
                    });
                    setUnavailableModelErrors(prev => {
                        const next = { ...prev };
                        delete next[m.id];
                        return next;
                    });
                }
            });

            await Promise.all(verifyPromises);

            if (manual) toast.success(`Refreshed: ${allModels.length} models found.`);

        } catch (error) {
            console.error("Model Refresh Error", error);
            if (manual) toast.error("Failed to refresh models");
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-refresh on key change
    useEffect(() => {
        refreshModels(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKeys]);

    return {
        currentModel,
        setCurrentModel,
        availableModels,
        unavailableModels,
        unavailableModelErrors,
        setUnavailableModels,
        setUnavailableModelErrors,
        isRefreshing,
        refreshModels
    };
};
