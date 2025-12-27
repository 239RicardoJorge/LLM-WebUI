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

    // BATCH UPDATE LOGIC (Anti-Jitter)
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

            // 2. Verify Availability (Ping check)
            const verifyPromises = allModels.map(async (m) => {
                const key = m.provider === 'google' ? apiKeys.google : apiKeys.openai;
                if (!key) return { id: m.id, available: false, error: 'No Key' };

                const result = await UnifiedService.checkModelAvailability(m.provider, m.id, key);
                return { id: m.id, ...result };
            });

            const results = await Promise.all(verifyPromises);

            // 3. Prepare Batch State Updates
            const newUnavailableModels: Record<string, string> = {};
            const newUnavailableErrors: Record<string, string> = {};

            results.forEach(r => {
                if (!r.available) {
                    const finalCode = r.errorCode === '429' ? '429' : '400';
                    newUnavailableModels[r.id] = finalCode;
                    newUnavailableErrors[r.id] = r.error || 'Unknown Error';
                }
            });

            // 4. Update ALL State at once
            setAvailableModels(allModels);
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(allModels));

            setUnavailableModels(newUnavailableModels);
            setUnavailableModelErrors(newUnavailableErrors);

            // 5. Auto-Select First Available Valid Model
            const isCurrentValid = currentModel && allModels.find(m => m.id === currentModel) && !newUnavailableModels[currentModel];

            if (!isCurrentValid && allModels.length > 0) {
                // Find first model that is NOT in newUnavailableModels
                const firstValid = allModels.find(m => !newUnavailableModels[m.id]);
                if (firstValid) {
                    setCurrentModel(firstValid.id);
                } else {
                    // Fallback to first even if error (user can see error)
                    if (allModels[0]) setCurrentModel(allModels[0].id);
                }
            }

            if (manual) toast.success(`Refreshed: ${allModels.length} models found.`);

        } catch (error) {
            console.error("Model Refresh Error", error);
            if (manual) toast.error("Failed to refresh models");
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-refresh on key change (debounced or effect)
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
        isRefreshing, // Exported for UI
        refreshModels // Exported for Manual Button
    };
};
