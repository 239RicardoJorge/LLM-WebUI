import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ModelOption } from '../types';
import { UnifiedService } from '../services/geminiService';
import { useSettingsStore } from '../store/settingsStore';
import { APP_CONFIG } from '../config/constants';

export const useModelManagement = () => {
    const { apiKeys } = useSettingsStore();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const refreshIdRef = useRef(0); // Abort pattern: track current refresh ID

    const [currentModel, setCurrentModel] = useState(() => {
        return localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CURRENT_MODEL) || '';
    });

    const [previousModel, setPreviousModel] = useState<string>('');

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
    const refreshModels = async (manual = false, full = false, keys?: { google?: string; groq?: string }, silent = false) => {
        // Abort pattern: increment ID and capture for this execution
        const thisRefreshId = ++refreshIdRef.current;

        const googleKey = (keys?.google ?? apiKeys.google)?.trim() || '';
        const groqKey = (keys?.groq ?? apiKeys.groq)?.trim() || '';

        if (!googleKey && !groqKey) {
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
            const [googleModels, groqModels] = await Promise.all([
                googleKey ? UnifiedService.validateKeyAndGetModels('google', googleKey).catch(() => []) : Promise.resolve([]),
                groqKey ? UnifiedService.validateKeyAndGetModels('groq', groqKey).catch(() => []) : Promise.resolve([])
            ]);

            const allModels = [...(googleModels as ModelOption[]), ...(groqModels as ModelOption[])];

            // Abort check after fetch
            if (refreshIdRef.current !== thisRefreshId) return;

            // IMMEDIATELY store all models (UI shows full list right away)
            setAvailableModels(allModels);
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(allModels));

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

            // PESSIMISTIC: Mark all models to verify as 'pending' (unavailable until proven otherwise)
            const pendingUnavailable: Record<string, string> = {};
            const pendingErrors: Record<string, string> = {};
            modelsToVerify.forEach(m => {
                pendingUnavailable[m.id] = 'pending';
                pendingErrors[m.id] = 'Verifying...';
            });

            // Merge with existing unavailable (keep models we're not re-verifying)
            setUnavailableModels(prev => ({ ...prev, ...pendingUnavailable }));
            setUnavailableModelErrors(prev => ({ ...prev, ...pendingErrors }));

            // 4. Background Verification
            const currentUnavailableModels: Record<string, string> = { ...prevUnavailable, ...pendingUnavailable };
            const currentUnavailableErrors: Record<string, string> = { ...unavailableModelErrors, ...pendingErrors };

            // Track if we've already selected a default in this refresh
            let defaultSelectedInThisRefresh = !!(currentModel && !currentUnavailableModels[currentModel]);

            const verifyPromises = modelsToVerify.map(async (m) => {
                const key = m.provider === 'google' ? googleKey : groqKey;
                if (!key) return;

                const result = await UnifiedService.checkModelAvailability(m.provider, m.id, key);

                // Abort check: if a newer refresh started, skip this update
                if (refreshIdRef.current !== thisRefreshId) return;

                if (!result.available) {
                    const finalCode = result.errorCode === '429' ? '429' : (result.errorCode === 'TERMS' ? 'TERMS' : '400');
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

                    // IMMEDIATE DEFAULT: Select ONLY if no default has been selected yet
                    if (!defaultSelectedInThisRefresh) {
                        defaultSelectedInThisRefresh = true;
                        setCurrentModel(m.id);
                    }
                }
            });

            await Promise.all(verifyPromises);

            // Abort check: if a newer refresh started, skip all final updates
            if (refreshIdRef.current !== thisRefreshId) {
                return;
            }

            // 5. Calculate Stats for Toasts
            const actuallyAvailableModels = allModels.filter(m => !currentUnavailableModels[m.id]);
            const newAvailableIds = actuallyAvailableModels.map(m => m.id);

            // "Added" means it is now available but wasn't before
            const addedModels = newAvailableIds.filter(id => !prevAvailableIds.has(id));
            const availableCount = actuallyAvailableModels.length;


            // 6. Toasts (skip if silent)
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

        } catch (error) {
            console.error("Model Refresh Error", error);
            if (manual) toast.error("Failed to refresh models");
        } finally {
            // Only reset refreshing if this is still the current refresh
            if (refreshIdRef.current === thisRefreshId) {
                setIsRefreshing(false);
            }
        }
    };

    // Auto-refresh DISABLED - Models only refresh on manual trigger or API key save

    // Helper to change model while tracking the previous one
    const changeModel = (newModelId: string) => {
        if (newModelId !== currentModel && currentModel) {
            setPreviousModel(currentModel);
        }
        setCurrentModel(newModelId);
    };

    // Fallback to previous model (used when new model errors)
    const fallbackToPreviousModel = () => {
        if (previousModel && previousModel !== currentModel) {
            // Delay the fallback toast so user can read the error first
            setTimeout(() => {
                toast.info(`Falling back to previous model: ${previousModel}`);
            }, 1500);
            setCurrentModel(previousModel);
            return true;
        }
        return false;
    };

    return {
        currentModel,
        setCurrentModel: changeModel, // Use changeModel instead of raw setter
        availableModels,
        unavailableModels,
        unavailableModelErrors,
        setUnavailableModels,
        setUnavailableModelErrors,
        isRefreshing,
        refreshModels,
        fallbackToPreviousModel
    };
};
