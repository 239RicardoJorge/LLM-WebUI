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
        const googleKey = apiKeys.google?.trim();
        const openaiKey = apiKeys.openai?.trim();

        if (!googleKey && !openaiKey) {
            setAvailableModels([]);
            if (manual) {
                toast.error("Please enter and save an API Key first.");
            }
            return;
        }

        setIsRefreshing(true);

        try {
            // 1. Fetch ALL models from providers (structure only)
            const [googleModels, openaiModels] = await Promise.all([
                googleKey ? UnifiedService.validateKeyAndGetModels('google', googleKey).catch(() => []) : Promise.resolve([]),
                openaiKey ? UnifiedService.validateKeyAndGetModels('openai', openaiKey).catch(() => []) : Promise.resolve([])
            ]);

            const allModels = [...(googleModels as ModelOption[]), ...(openaiModels as ModelOption[])];

            if (manual) toast.info(`Refreshing ${allModels.length} models...`);

            // 2. Set Available Models IMMEDIATELY (Gradual Population)
            // Note: We do NOT auto-select here anymore, to avoid "selecting unavailability".
            // We wait for verification to finish before auto-selecting.
            setAvailableModels(allModels);
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(allModels));

            // 3. Background Verification (Gradual - Updates as they fail)
            const currentUnavailableModels: Record<string, string> = {};
            const currentUnavailableErrors: Record<string, string> = {};

            const verifyPromises = allModels.map(async (m) => {
                const key = m.provider === 'google' ? googleKey : openaiKey;
                if (!key) return;

                const result = await UnifiedService.checkModelAvailability(m.provider, m.id, key);

                if (!result.available) {
                    const finalCode = result.errorCode === '429' ? '429' : '400';
                    currentUnavailableModels[m.id] = finalCode;
                    currentUnavailableErrors[m.id] = result.error || 'Unknown Error';

                    // Update State Gradual
                    setUnavailableModels(prev => ({ ...prev, [m.id]: finalCode }));
                    setUnavailableModelErrors(prev => ({ ...prev, [m.id]: result.error || 'Unknown Error' }));
                } else {
                    // Clear error immediately if valid
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

            const availableCount = allModels.length - Object.keys(currentUnavailableModels).length;

            // Auto-Select Logic: Ensure we have a valid selected model
            // This runs AFTER population/verification is complete.
            const firstValid = allModels.find(m => !currentUnavailableModels[m.id]);

            if (firstValid) {
                // If no current selection, or currently selected is invalid (unavailable)
                if (!currentModel || currentUnavailableModels[currentModel]) {
                    setCurrentModel(firstValid.id);
                }
            }

            if (manual) {
                if (availableCount > 0) {
                    toast.success(`Success: ${availableCount} models available.`);
                } else {
                    toast.error("No models available. Check API keys or Quota.");
                }
            }

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
