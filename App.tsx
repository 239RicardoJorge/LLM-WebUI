import React, { useState, useRef, useEffect } from 'react';
import { Toaster } from 'sonner';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ThemeToggle from './components/sidebar/ThemeToggle';
import { APP_VERSION } from './config/version';
import { useModelManagement } from './hooks/useModelManagement';
import { useChatSession } from './hooks/useChatSession';
import { useSettingsStore } from './store/settingsStore';

const App: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { theme } = useSettingsStore();

  // Apply theme class on mount and when theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System: check prefers-color-scheme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    if (wrapperRef.current) {
      wrapperRef.current.scrollTop = 0;
    }
    const timer = setTimeout(() => {
      document.body.classList.remove('preload');
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlightKeys, setHighlightKeys] = useState(false);

  // 1. Model Management Hook
  const {
    currentModel,
    setCurrentModel,
    availableModels,
    unavailableModels,
    unavailableModelErrors,
    setUnavailableModels,
    setUnavailableModelErrors,
    refreshModels,
    isRefreshing
  } = useModelManagement();

  // 2. Chat Session Hook
  const {
    messages,
    setMessages,
    isLoading,
    isHydrating,
    handleSendMessage,
    handleStopGeneration,
    handleClearChat,

  } = useChatSession({
    currentModel,
    availableModels,
    unavailableModels,
    setUnavailableModels,
    setUnavailableModelErrors,
    setSidebarOpen,
    setHighlightKeys
  });

  // Derived Handlers
  const handleModelChange = (modelId: string) => {
    setCurrentModel(modelId);
    setSidebarOpen(false);
    setMessages([]);
  };

  return (
    <div ref={wrapperRef} className={`flex h-screen w-full relative overflow-hidden transition-opacity duration-300 ${isHydrating ? 'opacity-0' : 'opacity-100'}`}>
      <Toaster position="top-right" theme={theme === 'dark' ? 'dark' : 'light'} richColors closeButton />
      <Sidebar
        currentModel={currentModel}
        onModelChange={handleModelChange}
        onClearChat={handleClearChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        availableModels={availableModels}
        highlightKeys={highlightKeys}
        unavailableModels={unavailableModels}
        onRefreshModels={() => refreshModels(true)}
        isRefreshing={isRefreshing}
        onSaveConfig={(keys) => refreshModels(true, true, keys, true)}
      />

      <main className="flex-1 h-full relative z-0">
        {/* Top Right: Version + Theme Toggle */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
          <div className="opacity-30 select-none text-[10px] font-mono text-[var(--text-primary)] pointer-events-none">
            {APP_VERSION}
          </div>
          <ThemeToggle />
        </div>
        <ChatInterface
          messages={messages}
          isLoading={isLoading}
          isHydrating={isHydrating}
          onSendMessage={handleSendMessage}
          onStop={handleStopGeneration}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          unavailableCode={unavailableModels[currentModel]}
          unavailableMessage={unavailableModelErrors[currentModel]}

        />
      </main>
    </div>
  );
};

export default App;