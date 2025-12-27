import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { ApiKeys, ModelOption } from '../types';
import ApiKeyConfig from './sidebar/ApiKeyConfig';
import ModelSelector from './sidebar/ModelSelector';
import SystemStatus from './sidebar/SystemStatus';

interface SidebarProps {
  currentModel: string;
  onModelChange: (modelId: string) => void;
  onClearChat: () => void;
  isOpen: boolean;
  onClose: () => void;
  availableModels: ModelOption[];
  highlightKeys?: boolean;
  unavailableModels?: Record<string, string>;
  onRefreshModels?: () => Promise<void>;
  isRefreshing?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentModel,
  onModelChange,
  onClearChat,
  isOpen,
  onClose,
  availableModels,
  highlightKeys = false,
  unavailableModels = {},
  onRefreshModels,
  isRefreshing = false,
}) => {
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
            <ApiKeyConfig
              highlightKeys={highlightKeys}
              onRefreshModels={onRefreshModels}
            />

            <ModelSelector
              currentModel={currentModel}
              onModelChange={onModelChange}
              availableModels={availableModels}
              unavailableModels={unavailableModels}
              isRefreshing={isRefreshing}
            />

          </div>

          {/* Fixed Clear Context Button */}
          <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-sm">
            <button
              onClick={onClearChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/5 text-gray-500 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all duration-300 group"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium tracking-wide">CLEAR CONTEXT</span>
            </button>
          </div>

          {/* System Monitor (Bottom) */}
          <SystemStatus mounted={mounted} />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;