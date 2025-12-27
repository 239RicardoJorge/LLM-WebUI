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

    // BATCH UPDATE LOGIC (Gradual Population) & SMART TOASTS
    // keys parameter allows passing fresh keys directly (avoids race condition after save)
    // silent = true: no toasts, no spinner animation (used by Save Config)
    const refreshModels = async (manual = false, full = false, keys?: { google?: string; openai?: string }, silent = false) => {
        const googleKey = (keys?.google ?? apiKeys.google)?.trim() || '';
        const openaiKey = (keys?.openai ?? apiKeys.openai)?.trim() || '';

        if (!googleKey && !openaiKey) {
            // Clear ALL models when no keys
            setAvailableModels([]);
            setUnavailableModels({});
            setUnavailableModelErrors({});
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify([]));
            if (!silent) {
                toast.error("Please enter and save an API Key first.", { duration: 2000 });
            }
            return;
        }

        if (!silent) {
            setIsRefreshing(true);
        }

        try {
            // 1. Initial Snapshot
            const prevUnavailable = unavailableModels;
            const prevAvailableIds = new Set(
                availableModels
                    .filter(m => !prevUnavailable[m.id])
                    .map(m => m.id)
            );

            // 2. Fetch Structure (Always fetch list to detect NEW models)
            const [googleModels, openaiModels] = await Promise.all([
                googleKey ? UnifiedService.validateKeyAndGetModels('google', googleKey).catch(() => []) : Promise.resolve([]),
                openaiKey ? UnifiedService.validateKeyAndGetModels('openai', openaiKey).catch(() => []) : Promise.resolve([])
            ]);

            const allModels = [...(googleModels as ModelOption[]), ...(openaiModels as ModelOption[])];

            // 3. Determine Verification Scope (Smart vs Full)
            let modelsToVerify = allModels;

            if (!full) {
                // Smart Refresh: Only verify if it was Unavailable previously OR it is a New model we haven't seen
                // (If it was available, we assume it stays available to save time/quota)
                modelsToVerify = allModels.filter(m => {
                    const isPreviouslyUnavailable = !!prevUnavailable[m.id];
                    const isNew = !prevAvailableIds.has(m.id);
                    return isPreviouslyUnavailable || isNew;
                });
            }

            // 4. Background Verification
            const currentUnavailableModels: Record<string, string> = { ...prevUnavailable }; // Start with previous
            const currentUnavailableErrors: Record<string, string> = { ...unavailableModelErrors };

            const verifyPromises = modelsToVerify.map(async (m) => {
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
                    // It is available. Remove from unavailable list.
                    delete currentUnavailableModels[m.id];
                    delete currentUnavailableErrors[m.id];

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

            // 5. Store ALL Models (let UI handle filtering by unavailableModels)
            setAvailableModels(allModels);
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(allModels));


            // 6. Calculate Stats for Toasts
            const actuallyAvailableModels = allModels.filter(m => !currentUnavailableModels[m.id]);
            const newAvailableIds = actuallyAvailableModels.map(m => m.id);

            // "Added" means it is now available but wasn't before
            const addedModels = newAvailableIds.filter(id => !prevAvailableIds.has(id));
            const availableCount = actuallyAvailableModels.length;


            // 7. Toasts (skip if silent)
            if (!silent) {
                if (availableCount === 0) {
                    if (manual) toast.error("No models available. Check API keys or Quota.", { duration: 2000 });
                } else if (addedModels.length > 0) {
                    // Models Added (Blue)
                    toast.success(`${addedModels.length} new models online`, {
                        className: 'text-blue-400 bg-black border border-blue-500/20',
                        description: 'Your available model list has been updated.',
                        duration: 2000
                    });
                } else {
                    // Unchanged (Grey Text, Success Icon)
                    toast.success("Model status unchanged", {
                        className: "bg-black text-gray-400 border border-white/10",
                        duration: 2000
                    });
                }
            }

            // Auto-Select Logic
            const firstValid = actuallyAvailableModels.find(m => !currentUnavailableModels[m.id]);

            if (firstValid) {
                if (!currentModel || currentUnavailableModels[currentModel]) {
                    setCurrentModel(firstValid.id);
                }
            }

        } catch (error) {
            console.error("Model Refresh Error", error);
            if (manual) toast.error("Failed to refresh models");
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-refresh DISABLED - Models only refresh on manual trigger or API key save

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
