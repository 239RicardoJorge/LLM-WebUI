import React, { useState, useEffect } from 'react';
import { Key, ChevronDown, ChevronRight, ExternalLink, RotateCw, CheckCircle2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ApiKeys } from '../../types';
import { UnifiedService } from '../../services/geminiService';
import { useSettingsStore } from '../../store/settingsStore';
import { APP_CONFIG } from '../../config/constants';

interface ApiKeyConfigProps {
    highlightKeys?: boolean;
    onRefreshModels?: () => Promise<void>;
    isRefreshing?: boolean;
    onSaveConfig?: (keys: { google?: string; openai?: string }) => Promise<void>;
}

const ApiKeyConfig: React.FC<ApiKeyConfigProps> = ({
    highlightKeys = false,
    onRefreshModels,
    isRefreshing = false,
    onSaveConfig,
}) => {
    const { apiKeys, setApiKeys } = useSettingsStore();

    const [keysExpanded, setKeysExpanded] = useState(() => {
        const saved = localStorage.getItem('ccs_sidebar_keys_expanded');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const [animateKeys, setAnimateKeys] = useState(false);
    const [draftKeys, setDraftKeys] = useState<ApiKeys>(apiKeys);
    const [isSaved, setIsSaved] = useState(false);
    const [isSavingKeys, setIsSavingKeys] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Force expansion if highlighted
    useEffect(() => {
        if (highlightKeys && !keysExpanded) {
            setKeysExpanded(true);
            setAnimateKeys(true);
        }
    }, [highlightKeys, keysExpanded]);

    // Persist expansion state
    useEffect(() => {
        localStorage.setItem('ccs_sidebar_keys_expanded', JSON.stringify(keysExpanded));
    }, [keysExpanded]);

    // Sync draft if global store updates (e.g. initial load)
    useEffect(() => {
        setDraftKeys(apiKeys);
    }, [apiKeys]);

    const handleDraftChange = (provider: keyof ApiKeys, value: string) => {
        setDraftKeys(prev => ({ ...prev, [provider]: value }));
        setIsSaved(false);
    };

    const handleSaveKeys = async () => {
        // Show Validating immediately
        setIsSavingKeys(true);
        setValidationError(null);

        try {
            let validCount = 0;
            if (draftKeys.google) {
                await UnifiedService.validateKeyAndGetModels('google', draftKeys.google);
                validCount++;
            }
            if (draftKeys.openai) {
                await UnifiedService.validateKeyAndGetModels('openai', draftKeys.openai);
                validCount++;
            }

            setValidationError(null);

            // Update Global Store
            setApiKeys(draftKeys);

            // Trigger full model refresh and WAIT for it to complete
            if (onSaveConfig) {
                await onSaveConfig(draftKeys);
            }

            // Only show success AFTER all models are verified
            setIsSavingKeys(false);
            setIsSaved(true);
            toast.success(validCount > 0 ? "API Keys Verified & Saved" : "Configuration Saved", { duration: 2000 });

            // Reset to default state after 2 seconds
            setTimeout(() => setIsSaved(false), 2000);
        } catch (error: any) {
            const msg = error.message || "Validation Failed. Please check your keys.";
            setValidationError(msg);
            toast.error(msg, { duration: 2000 });
            setIsSaved(false);
            setIsSavingKeys(false);
        }
    };

    return (
        <div className="space-y-3">
            <button
                onClick={() => {
                    if (!keysExpanded) setAnimateKeys(true);
                    setKeysExpanded(!keysExpanded);
                }}
                className="flex items-center gap-2 text-[var(--text-secondary)] mb-2 w-full hover:text-[var(--text-primary)]"
            >
                <Key className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-widest uppercase flex-1 text-left">Provider Keys</span>
                {keysExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>

            {keysExpanded && (
                <div className={`space-y-4 ${animateKeys ? 'animate-fade-up' : ''}`}>
                    {/* Google Key */}
                    <div className="group">
                        <div className="flex justify-between items-center mb-1 pl-1">
                            <label className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Google Gemini</label>
                            <a href={APP_CONFIG.PROVIDER_URLS.google} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300">
                                Get Key <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                        </div>
                        <input
                            type="password"
                            value={draftKeys.google}
                            onChange={(e) => handleDraftChange('google', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveKeys()}
                            placeholder="AIzaSy..."
                            className={`w-full bg-[var(--bg-secondary)] border text-[var(--text-primary)] text-xs p-2.5 rounded-lg focus:outline-none focus:border-blue-500/50 font-mono
                 ${highlightKeys && !draftKeys.google ? 'animate-blink-2' : 'border-[var(--border-color)]'}
              `}
                        />
                    </div>

                    {/* OpenAI Key */}
                    <div className="group">
                        <div className="flex justify-between items-center mb-1 pl-1">
                            <label className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">OpenAI</label>
                            <a href={APP_CONFIG.PROVIDER_URLS.openai} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-green-400 hover:text-green-300">
                                Get Key <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                        </div>
                        <input
                            type="password"
                            value={draftKeys.openai}
                            onChange={(e) => handleDraftChange('openai', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveKeys()}
                            placeholder="sk-..."
                            className={`w-full bg-[var(--bg-secondary)] border text-[var(--text-primary)] text-xs p-2.5 rounded-lg focus:outline-none focus:border-green-500/50 font-mono
                 ${highlightKeys && !draftKeys.openai ? 'animate-blink-2' : 'border-[var(--border-color)]'}
               `}
                        />
                    </div>

                    {/* Save Button & Refresh */}
                    <div className="space-y-2">
                        {validationError && (
                            <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-500">
                                <span className="flex-1 font-medium">{validationError}</span>
                            </div>
                        )}
                        <div className="flex gap-2">
                            {/* Manual Refresh Button */}
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (onRefreshModels) await onRefreshModels();
                                }}
                                className={`
                        flex items-center justify-center w-10 min-w-[2.5rem] rounded-lg border transition-all duration-500
                        ${validationError
                                        ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                                        : 'bg-[var(--bg-glass)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--button-glow)] hover:shadow-[inset_0_0_8px_var(--button-glow)] border-[var(--border-color)]'}
                        ${isRefreshing ? 'opacity-50 cursor-wait' : ''}
                    `}
                                title="Refresh Models"
                                disabled={isRefreshing}
                            >
                                <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>

                            <button
                                onClick={handleSaveKeys}
                                disabled={isSavingKeys}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-500
                                ${isSaved
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : validationError
                                            ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                                            : 'bg-[var(--bg-glass)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--button-glow)] hover:shadow-[inset_0_0_8px_var(--button-glow)] border border-[var(--border-color)]'}
                        ${isSavingKeys ? 'opacity-50 cursor-wait' : ''}
                            `}
                            >
                                {isSavingKeys ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-[var(--text-muted)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                                        <span>Validating...</span>
                                    </>
                                ) : isSaved ? (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Saved & Verified</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{validationError ? 'Retry Save' : 'Save Configuration'}</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Privacy Tagline */}
                        <div className="text-center pt-4">
                            <p className="text-[9px] text-[var(--text-primary)] uppercase tracking-widest opacity-40 leading-loose">
                                Your keys. Your data.<br />
                                Everything local.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiKeyConfig;
