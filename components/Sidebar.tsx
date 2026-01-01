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
  onSaveConfig?: (keys: { google?: string; groq?: string }) => Promise<void>;
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
  onSaveConfig,
}) => {
  // Mount check to suppress hydration animations
  const [mounted, setMounted] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-[var(--bg-primary)]/80 backdrop-blur-sm z-40 transition-[opacity,background-color,color] duration-500 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside
        className={`
          fixed inset-y-0 left-0 w-[300px]
          flex flex-col bg-[var(--bg-primary)] lg:bg-transparent
          ${mounted ? 'transition-[transform,background-color,color,border-color] duration-500 cubic-bezier(0.19, 1, 0.22, 1)' : ''}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:static
        `}
        style={{ zIndex: isEditingTags ? 10000 : 50 }}
      >
        {/* Glass Container */}
        <div className="h-full flex flex-col lg:m-4 lg:glass-panel lg:border-[var(--border-color)] overflow-hidden shadow-2xl relative">

          {/* Top Control Area */}
          <div
            className="p-6 space-y-8 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
          >
            <ApiKeyConfig
              highlightKeys={highlightKeys}
              onRefreshModels={onRefreshModels}
              isRefreshing={isRefreshing}
              onSaveConfig={onSaveConfig}
            />

            <ModelSelector
              currentModel={currentModel}
              onModelChange={onModelChange}
              availableModels={availableModels}
              unavailableModels={unavailableModels}
              isRefreshing={isRefreshing}
              onEditingChange={setIsEditingTags}
            />

          </div>

          {/* Fixed Clear Context Button */}
          <div className="p-4 border-t border-[var(--border-color)]">
            <button
              onClick={onClearChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all duration-500 group"
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