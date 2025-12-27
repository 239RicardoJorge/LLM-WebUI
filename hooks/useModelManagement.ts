import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ApiKeys, ModelOption } from '../types';
import { UnifiedService } from '../services/geminiService';

export const useModelManagement = (apiKeys: ApiKeys) => {
    const [currentModel, setCurrentModel] = useState(() => {
        return localStorage.getItem('ccs_current_model') || '';
    });

    const [availableModels, setAvailableModels] = useState<ModelOption[]>(() => {
        const saved = localStorage.getItem('ccs_available_models');
        return saved ? JSON.parse(saved) : [];
    });

    const [unavailableModels, setUnavailableModels] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem('ccs_unavailable_models');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    const [unavailableModelErrors, setUnavailableModelErrors] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem('ccs_unavailable_model_errors');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    // Persistence
    useEffect(() => {
        localStorage.setItem('ccs_current_model', currentModel);
    }, [currentModel]);

    useEffect(() => {
        localStorage.setItem('ccs_unavailable_models', JSON.stringify(unavailableModels));
    }, [unavailableModels]);

    useEffect(() => {
        localStorage.setItem('ccs_unavailable_model_errors', JSON.stringify(unavailableModelErrors));
    }, [unavailableModelErrors]);

    // Initial Fetch & Verification Queueing
    useEffect(() => {
        const fetchModels = async () => {
            let models: ModelOption[] = [];
            let modelsToVerify: { provider: string, modelId: string, key: string }[] = [];

            if (apiKeys.google) {
                try {
                    const googleModels = await UnifiedService.validateKeyAndGetModels('google', apiKeys.google);
                    models = [...models, ...googleModels];
                    googleModels.forEach(m => modelsToVerify.push({ provider: 'google', modelId: m.id, key: apiKeys.google }));
                } catch (e: any) {
                    toast.error(`Google API Error: ${e.message || 'Validation failed'}`);
                }
            }
            if (apiKeys.openai) {
                try {
                    const openaiModels = await UnifiedService.validateKeyAndGetModels('openai', apiKeys.openai);
                    models = [...models, ...openaiModels];
                    openaiModels.forEach(m => modelsToVerify.push({ provider: 'openai', modelId: m.id, key: apiKeys.openai }));
                } catch (e: any) {
                    toast.error(`OpenAI API Error: ${e.message || 'Validation failed'}`);
                }
            }

            setAvailableModels(models);
            localStorage.setItem('ccs_available_models', JSON.stringify(models));

            if (models.length > 0 && (!currentModel || !models.find(m => m.id === currentModel))) {
                setCurrentModel(models[0].id);
            }

            // BACKGROUND VERIFICATION (Initial)
            if (modelsToVerify.length > 0) {
                verifyModels(modelsToVerify);
            }
        };

        fetchModels();
    }, [apiKeys]); // Re-run when keys change

    // Smart Refresh: Re-verify unavailable models on load or model change
    useEffect(() => {
        if (!apiKeys.google && !apiKeys.openai) return;

        const itemsToVerify: { provider: string, modelId: string, key: string }[] = [];
        const unavailableIds = Object.keys(unavailableModels);

        if (unavailableIds.length === 0) return;

        availableModels.forEach(m => {
            if (!unavailableModels[m.id]) return;

            if (m.provider === 'google' && apiKeys.google) {
                itemsToVerify.push({ provider: 'google', modelId: m.id, key: apiKeys.google });
            } else if (m.provider === 'openai' && apiKeys.openai) {
                itemsToVerify.push({ provider: 'openai', modelId: m.id, key: apiKeys.openai });
            }
        });

        if (itemsToVerify.length > 0) {
            verifyModels(itemsToVerify);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKeys, availableModels]);


    const verifyModels = async (items: { provider: string, modelId: string, key: string }[]) => {
        const promises = items.map(async (item) => {
            try {
                const result = await UnifiedService.checkModelAvailability(item.provider, item.modelId, item.key);
                if (!result.available) {
                    const finalCode = result.errorCode === '429' ? '429' : '400';

                    setUnavailableModels(prev => {
                        if (prev[item.modelId] === finalCode) return prev;
                        return { ...prev, [item.modelId]: finalCode };
                    });
                    setUnavailableModelErrors(prev => ({ ...prev, [item.modelId]: result.error || 'Unknown Error' }));
                } else {
                    // Clear error
                    setUnavailableModels(prev => {
                        const next = { ...prev };
                        delete next[item.modelId];
                        return next;
                    });
                    setUnavailableModelErrors(prev => {
                        const next = { ...prev };
                        delete next[item.modelId];
                        return next;
                    });
                }
            } catch (e) {
                console.error(`Error verifying ${item.modelId}`, e);
            }
        });

        await Promise.all(promises);
    };

    const handleManualRefresh = async () => {
        const itemsToVerify: { provider: string, modelId: string, key: string }[] = [];
        availableModels.forEach(m => {
            if (m.provider === 'google' && apiKeys.google) {
                itemsToVerify.push({ provider: 'google', modelId: m.id, key: apiKeys.google });
            } else if (m.provider === 'openai' && apiKeys.openai) {
                itemsToVerify.push({ provider: 'openai', modelId: m.id, key: apiKeys.openai });
            }
        });

        if (itemsToVerify.length > 0) {
            toast.info(`Full Refresh: Verifying ${itemsToVerify.length} models...`);
            await verifyModels(itemsToVerify);
            toast.success("Verification Complete");
        } else {
            toast.warning("No models configured to verify.");
        }
    };

    return {
        currentModel,
        setCurrentModel,
        availableModels,
        unavailableModels,
        unavailableModelErrors,
        setUnavailableModels,
        setUnavailableModelErrors,
        handleManualRefresh
    };
};
