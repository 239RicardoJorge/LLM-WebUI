import React, { useState, useEffect } from 'react';
import { Trash2, Key, Settings2, ChevronDown, ChevronRight, Zap, Box, ExternalLink, Save, CheckCircle2, Cpu, Activity } from 'lucide-react';
import { AVAILABLE_MODELS, ApiKeys } from '../types';

interface SidebarProps {
  currentModel: string;
  onModelChange: (modelId: string) => void;
  onClearChat: () => void;
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKeys;
  onApiKeysChange: (keys: ApiKeys) => void;
}

const PROVIDER_URLS = {
  google: 'https://aistudio.google.com/app/apikey',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys'
};

const Sidebar: React.FC<SidebarProps> = ({
  currentModel,
  onModelChange,
  onClearChat,
  isOpen,
  onClose,
  apiKeys, // These are the SAVED keys from App
  onApiKeysChange
}) => {
  // Simulated System Stats (Raspberry Pi 4-core simulation)
  const [cpuCores, setCpuCores] = useState<number[]>([12, 15, 8, 20]);
  const [ramUsage, setRamUsage] = useState(45);
  const [keysExpanded, setKeysExpanded] = useState(true);

  // Local draft state for inputs. We don't push to App until user clicks Save.
  const [draftKeys, setDraftKeys] = useState<ApiKeys>(apiKeys);
  const [isSaved, setIsSaved] = useState(false);

  // Sync draft if parent updates (initial load)
  useEffect(() => {
    setDraftKeys(apiKeys);
  }, [apiKeys]);

  const handleDraftChange = (provider: keyof ApiKeys, value: string) => {
    setDraftKeys(prev => ({ ...prev, [provider]: value }));
    setIsSaved(false);
  };

  const handleSaveKeys = () => {
    onApiKeysChange(draftKeys);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Strict filtering: Only show models if the corresponding API Key is SAVED (in parent prop)
  const availableModels = AVAILABLE_MODELS.filter(model => {
    if (model.provider === 'google' && apiKeys.google?.trim()) return true;
    if (model.provider === 'openai' && apiKeys.openai?.trim()) return true;
    if (model.provider === 'anthropic' && apiKeys.anthropic?.trim()) return true;
    return false;
  });

  // Poll System Stats from Backend
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          // Ensure we have 4 cores for UI consistency (filling with avg if less, checking length if more)
          const coreData = data.cpu.cores.length > 0 ? data.cpu.cores : [data.cpu.avg, data.cpu.avg, data.cpu.avg, data.cpu.avg];
          // Take first 4 cores or slice
          setCpuCores(coreData.slice(0, 4));
          setRamUsage(data.memory.percentage);
        }
      } catch (err) {
        // Silent fail, keep previous or default
        console.warn("Stats fetch failed");
      }
    };

    fetchStats(); // Initial
    const interval = setInterval(fetchStats, 2000); // Poll every 2s
    return () => clearInterval(interval);
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
        transform transition-transform duration-500 cubic-bezier(0.19, 1, 0.22, 1)
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:static
      `}>
        {/* Glass Container */}
        <div className="h-full flex flex-col lg:m-4 lg:rounded-3xl lg:glass-panel lg:border-white/5 overflow-hidden shadow-2xl relative">

          {/* Top Control Area */}
          <div className="p-6 space-y-8 flex-1 overflow-y-auto scrollbar-hide">

            {/* API Keys Section */}
            <div className="space-y-3">
              <button
                onClick={() => setKeysExpanded(!keysExpanded)}
                className="flex items-center gap-2 text-white/40 mb-2 w-full hover:text-white/60 transition-colors"
              >
                <Key className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-widest uppercase flex-1 text-left">Provider Keys</span>
                {keysExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>

              {keysExpanded && (
                <div className="space-y-4 animate-fade-up">
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
                      placeholder="AIzaSy..."
                      className="w-full bg-black/40 border border-white/10 text-white text-xs p-2.5 rounded-lg focus:outline-none focus:border-blue-500/50 transition-all font-mono"
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
                      placeholder="sk-..."
                      className="w-full bg-black/40 border border-white/10 text-white text-xs p-2.5 rounded-lg focus:outline-none focus:border-green-500/50 transition-all font-mono"
                    />
                  </div>

                  {/* Anthropic Key */}
                  <div className="group">
                    <div className="flex justify-between items-center mb-1 pl-1">
                      <label className="text-[9px] text-gray-500 uppercase tracking-wider">Anthropic</label>
                      <a href={PROVIDER_URLS.anthropic} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-orange-400 hover:text-orange-300 transition-colors">
                        Get Key <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <input
                      type="password"
                      value={draftKeys.anthropic}
                      onChange={(e) => handleDraftChange('anthropic', e.target.value)}
                      placeholder="sk-ant..."
                      className="w-full bg-black/40 border border-white/10 text-white text-xs p-2.5 rounded-lg focus:outline-none focus:border-orange-500/50 transition-all font-mono"
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveKeys}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300
                                ${isSaved
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'}
                            `}
                  >
                    {isSaved ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Saved & Verified</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Configuration</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Model Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/40">
                <Settings2 className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Available Models</span>
              </div>
              <div className="space-y-1">
                {availableModels.length === 0 ? (
                  <div className="text-center py-6 px-4 border border-dashed border-white/10 rounded-xl bg-white/5">
                    <p className="text-xs text-gray-400 font-medium">No Models Available</p>
                    <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                      Insert and <span className="text-white font-semibold">Save</span> an API key above to unlock models.
                    </p>
                  </div>
                ) : (
                  availableModels.map((model) => {
                    const isActive = currentModel === model.id;
                    return (
                      <button
                        key={model.id}
                        onClick={() => onModelChange(model.id)}
                        className={`
                            w-full p-3 rounded-xl transition-all duration-300 border text-left group relative overflow-hidden
                            ${isActive
                            ? 'bg-white/5 border-white/10 shadow-lg'
                            : 'bg-transparent border-transparent hover:bg-white/5'}
                        `}
                      >
                        <div className="flex items-center justify-between mb-1 relative z-10">
                          <div className="flex items-center gap-2">
                            <span className={`text-[13px] font-medium tracking-tight ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                              {model.name}
                            </span>
                            {model.provider === 'google' && <Zap className="w-3 h-3 text-blue-400" />}
                            {model.provider === 'openai' && <Box className="w-3 h-3 text-green-400" />}
                            {model.provider === 'anthropic' && <Activity className="w-3 h-3 text-orange-400" />}
                          </div>
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"></div>}
                        </div>
                        <div className={`text-[10px] truncate ${isActive ? 'text-gray-400' : 'text-gray-700'}`}>
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
                        className="w-full bg-white/80 transition-all duration-1000 ease-out hover:bg-white"
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
                    className="h-full bg-blue-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(96,165,250,0.3)]"
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