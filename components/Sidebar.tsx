import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Trash2, Key, Settings2, ChevronDown, ChevronRight, Zap, Box, ExternalLink, Save, CheckCircle2, Cpu, Activity } from 'lucide-react';
import { ApiKeys, ModelOption } from '../types';
import { UnifiedService } from '../services/geminiService';


interface SidebarProps {
  currentModel: string;
  onModelChange: (modelId: string) => void;
  onClearChat: () => void;
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKeys;
  onApiKeysChange: (keys: ApiKeys) => void;
  availableModels: ModelOption[];
  highlightKeys?: boolean;
  rateLimitedModels?: Set<string>;
}

const PROVIDER_URLS = {
  google: 'https://aistudio.google.com/app/apikey',
  openai: 'https://platform.openai.com/api-keys'
};

const Sidebar: React.FC<SidebarProps> = ({
  currentModel,
  onModelChange,
  onClearChat,
  isOpen,
  onClose,
  apiKeys, // These are the SAVED keys from App
  onApiKeysChange,
  availableModels,
  highlightKeys = false,
  rateLimitedModels = new Set(),
}) => {
  // Simulated System Stats (Raspberry Pi 4-core simulation)
  const [cpuCores, setCpuCores] = useState<number[]>(() => {
    const saved = localStorage.getItem('ccs_stats_cpu');
    return saved ? JSON.parse(saved) : [12, 15, 8, 20];
  });
  const [ramUsage, setRamUsage] = useState(() => {
    const saved = localStorage.getItem('ccs_stats_ram');
    return saved ? Number(saved) : 45;
  });
  const [keysExpanded, setKeysExpanded] = useState(() => {
    const saved = localStorage.getItem('ccs_sidebar_keys_expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Force expansion if highlighted
  useEffect(() => {
    if (highlightKeys) {
      setKeysExpanded(true);
    }
  }, [highlightKeys]);

  // User Interaction flags to suppress animations on initial load
  const [animateKeys, setAnimateKeys] = useState(false);
  const [animateModels, setAnimateModels] = useState(false);

  useEffect(() => {
    localStorage.setItem('ccs_sidebar_keys_expanded', JSON.stringify(keysExpanded));
  }, [keysExpanded]);

  const [modelsExpanded, setModelsExpanded] = useState(() => {
    const saved = localStorage.getItem('ccs_sidebar_models_expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('ccs_sidebar_models_expanded', JSON.stringify(modelsExpanded));
  }, [modelsExpanded]);



  // Validate Google Keys


  // Local draft state for inputs. We don't push to App until user clicks Save.
  const [draftKeys, setDraftKeys] = useState<ApiKeys>(apiKeys);
  const [isSaved, setIsSaved] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync draft if parent updates (initial load)
  useEffect(() => {
    setDraftKeys(apiKeys);
  }, [apiKeys]);

  const handleDraftChange = (provider: keyof ApiKeys, value: string) => {
    setDraftKeys(prev => ({ ...prev, [provider]: value }));
    setIsSaved(false);
    // setValidationError(null); // REMOVED: Keep error/retry state visible while user fixes the key
  };

  const handleSaveKeys = async () => {
    // Optimistic UI: Don't show "Validating" immediately.
    // Only show it if the request takes longer than 1000ms.
    // setValidationError(null); // REMOVED: Keep error visible during retry

    let loadingTimer: NodeJS.Timeout;

    // Start timer to show loading state ONLY after 1s
    loadingTimer = setTimeout(() => {
      setIsValidating(true);
      // Only clear error if we enter the long-running validation state
      setValidationError(null);
    }, 1000);

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

      // Success! Now we clear the error.
      setValidationError(null);
      onApiKeysChange(draftKeys);
      setIsSaved(true);
      toast.success(validCount > 0 ? "API Keys Verified & Saved" : "Configuration Saved");
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error: any) {
      const msg = error.message || "Validation Failed. Please check your keys.";
      setValidationError(msg);
      toast.error(msg);
      setIsSaved(false);
    } finally {
      // Clear the timer. If finished < 1s, isValidating never became true.
      clearTimeout(loadingTimer!);
      setIsValidating(false);
    }
  };

  // Strict filtering: Only show models if the corresponding API Key is SAVED (un parent prop)
  // Simple List: Just show the models defined in types.ts (User requested specific list)


  // Poll System Stats from Backend
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          // Ensure we have 4 cores for UI consistency (filling with avg if less, checking length if more)
          const coreData = data.cpu.cores.length > 0 ? data.cpu.cores : [data.cpu.avg, data.cpu.avg, data.cpu.avg, data.cpu.avg];
          const finalCores = coreData.slice(0, 4);

          setCpuCores(finalCores);
          setRamUsage(data.memory.percentage);

          // Persist latest stats
          localStorage.setItem('ccs_stats_cpu', JSON.stringify(finalCores));
          localStorage.setItem('ccs_stats_ram', String(data.memory.percentage));
        }
      } catch (err) {
        // Silent fail, keep previous or default
        console.warn("Stats fetch failed");
      }
    };

    const interval = setInterval(fetchStats, 2000); // Poll every 2s
    fetchStats(); // Initial
    return () => clearInterval(interval);
  }, []);

  // Mount check to suppress hydration animations
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[300px]
        flex flex-col bg-[#050505] lg:bg-transparent
        transform ${mounted ? 'transition-transform duration-500 cubic-bezier(0.19, 1, 0.22, 1)' : ''}
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:static
      `}>
        {/* Glass Container */}
        <div className="h-full flex flex-col lg:m-4 lg:glass-panel lg:border-white/5 overflow-hidden shadow-2xl relative">

          {/* Top Control Area */}
          <div
            className="p-6 space-y-8 flex-1 overflow-y-auto [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-white/20"
          >

            {/* API Keys Section */}
            <div className="space-y-3">
              <button
                onClick={() => { setAnimateKeys(true); setKeysExpanded(!keysExpanded); }}
                className="flex items-center gap-2 text-white/40 mb-2 w-full hover:text-white/60 transition-colors"
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
                      <label className="text-[9px] text-gray-500 uppercase tracking-wider">Google Gemini</label>
                      <a href={PROVIDER_URLS.google} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300 transition-colors">
                        Get Key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <input
                      type="password"
                      value={draftKeys.google}
                      onChange={(e) => handleDraftChange('google', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveKeys()}
                      placeholder="AIzaSy..."
                      className={`w-full bg-black/40 border text-white text-xs p-2.5 rounded-lg focus:outline-none focus:border-blue-500/50 transition-all font-mono
                         ${highlightKeys && !draftKeys.google ? 'animate-blink-2' : 'border-white/10'}
                      `}
                    />
                  </div>

                  {/* OpenAI Key */}
                  <div className="group">
                    <div className="flex justify-between items-center mb-1 pl-1">
                      <label className="text-[9px] text-gray-500 uppercase tracking-wider">OpenAI</label>
                      <a href={PROVIDER_URLS.openai} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-green-400 hover:text-green-300 transition-colors">
                        Get Key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <input
                      type="password"
                      value={draftKeys.openai}
                      onChange={(e) => handleDraftChange('openai', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveKeys()}
                      placeholder="sk-..."
                      className={`w-full bg-black/40 border text-white text-xs p-2.5 rounded-lg focus:outline-none focus:border-green-500/50 transition-all font-mono
                         ${highlightKeys && !draftKeys.openai ? 'animate-blink-2' : 'border-white/10'}
                       `}
                    />
                  </div>

                  {/* Save Button */}
                  <div className="space-y-2">
                    {validationError && (
                      <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                        <span className="flex-1 font-medium">{validationError}</span>
                      </div>
                    )}
                    <button
                      onClick={handleSaveKeys}
                      disabled={isValidating}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all
                                    ${validationError ? 'duration-0' : 'duration-300'}
                                    ${isSaved
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : validationError
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                            : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'}
                            ${isValidating ? 'opacity-50 cursor-wait' : ''}
                                `}
                    >
                      {isValidating ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                </div>
              )}
            </div>

            {/* Model Selection */}
            <div className="space-y-3">
              <button
                onClick={() => { setAnimateModels(true); setModelsExpanded(!modelsExpanded); }}
                className="flex items-center gap-2 text-white/40 mb-2 w-full hover:text-white/60 transition-colors"
              >
                <Settings2 className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-widest uppercase flex-1 text-left">Available Models</span>
                {modelsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>

              <div
                className={`space-y-1 ${modelsExpanded && animateModels ? 'animate-fade-up' : ''}`}
                key={modelsExpanded ? 'expanded' : 'collapsed'}
              >
                {availableModels.length === 0 ? (
                  <div className="text-center py-6 px-4 border border-dashed border-white/10 rounded-xl bg-white/5">
                    <p className="text-xs text-gray-400 font-medium">No Models Available</p>
                    <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                      Insert and <span className="text-white font-semibold">Save</span> an API key above to unlock models.
                    </p>
                  </div>
                ) : (
                  // If collapsed, only show the currently selected model. If expanded, show all.
                  availableModels
                    .filter(model => modelsExpanded || model.id === currentModel)
                    .map((model) => {
                      const isActive = currentModel === model.id;
                      const isRateLimited = rateLimitedModels.has(model.id);

                      return (
                        <button
                          key={model.id}
                          onClick={() => onModelChange(model.id)}
                          className={`
                              w-full p-3 rounded-xl transition-colors duration-300 border text-left group relative overflow-hidden
                              ${isActive
                              ? 'bg-white/5 border-white/10 shadow-lg'
                              : 'bg-transparent border-white/0 hover:bg-white/5'}
                              ${isRateLimited ? 'border-red-500/10 bg-red-500/5' : ''}
                          `}
                        >
                          <div className="flex items-center justify-between mb-1 relative z-10">
                            <div className={`flex items-center gap-2 ${isRateLimited ? 'opacity-50 grayscale' : ''}`}>
                              <span className={`text-[13px] font-medium tracking-tight ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                {model.name}
                              </span>
                              {isRateLimited ? (
                                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1 rounded tracking-tighter">429</span>
                              ) : (
                                <>
                                  {model.provider === 'google' && <Zap className="w-3 h-3 text-blue-400" />}
                                  {model.provider === 'openai' && <Box className="w-3 h-3 text-green-400" />}
                                </>
                              )}
                            </div>
                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"></div>}
                          </div>
                          <div className={`text-[10px] truncate ${isActive ? 'text-gray-400' : 'text-gray-700'} ${isRateLimited ? 'opacity-50 grayscale' : ''}`}>
                            {model.description}
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={onClearChat}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 text-gray-500 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all duration-300 group"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium tracking-wide">CLEAR CONTEXT</span>
              </button>
            </div>
          </div>

          {/* System Monitor (Bottom) */}
          <div className="p-6 bg-black/40 border-t border-white/5 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-3 h-3 text-green-500" />
              <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">System Status (Host)</span>
            </div>

            <div className="space-y-4">
              {/* CPU Cores Grid */}
              <div className="space-y-2">
                <div className="flex justify-between items-end text-[10px] font-mono text-gray-400">
                  <span>CPU LOAD (4 CORES)</span>
                  <span>AVG {Math.round(cpuCores.reduce((a, b) => a + b, 0) / 4)}%</span>
                </div>
                <div className="grid grid-cols-4 gap-1 h-8">
                  {cpuCores.map((load, idx) => (
                    <div key={idx} className="relative bg-white/5 rounded-md overflow-hidden flex items-end group">
                      <div
                        className={`w-full bg-white/80 ease-out hover:bg-white ${mounted ? 'transition-all duration-1000' : ''}`}
                        style={{ height: `${load}%` }}
                      />
                      {/* Tooltip for specific core */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/60 transition-opacity">
                        <span className="text-[8px] font-mono">{Math.round(load)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System RAM Monitor */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-end text-[10px] font-mono text-gray-400">
                  <span>SYSTEM RAM USAGE</span>
                  <span>{Math.round(ramUsage)}%</span>
                </div>
                <div className="h-1 w-full bg-blue-500/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-blue-400 rounded-full ease-out shadow-[0_0_10px_rgba(96,165,250,0.3)] ${mounted ? 'transition-all duration-1000' : ''}`}
                    style={{ width: `${ramUsage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;