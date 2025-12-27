import React, { useState, useRef, useEffect } from 'react';
import { Toaster } from 'sonner';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { ApiKeys } from './types';
import { APP_VERSION } from './config/version';
import { useModelManagement } from './hooks/useModelManagement';
import { useChatSession } from './hooks/useChatSession';

const App: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    const saved = localStorage.getItem('app_api_keys');
    return saved ? JSON.parse(saved) : { google: '', openai: '' };
  });

  const handleApiKeysChange = (newKeys: ApiKeys) => {
    setApiKeys(newKeys);
    localStorage.setItem('app_api_keys', JSON.stringify(newKeys));
  };

  // 1. Model Management Hook
  const {
    currentModel,
    setCurrentModel,
    availableModels,
    unavailableModels,
    unavailableModelErrors,
    setUnavailableModels,
    setUnavailableModelErrors,
    handleManualRefresh
  } = useModelManagement(apiKeys);

  // 2. Chat Session Hook
  const {
    messages,
    setMessages,
    isLoading,
    handleSendMessage,
    handleStopGeneration,
    handleClearChat
  } = useChatSession({
    apiKeys,
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
    <div ref={wrapperRef} className="flex h-screen w-full relative overflow-hidden">
      <Toaster position="top-right" theme="dark" richColors closeButton />
      <Sidebar
        currentModel={currentModel}
        onModelChange={handleModelChange}
        onClearChat={handleClearChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        apiKeys={apiKeys}
        onApiKeysChange={handleApiKeysChange}
        availableModels={availableModels}
        highlightKeys={highlightKeys}
        unavailableModels={unavailableModels}
        onRefreshModels={handleManualRefresh}
      />

      <main className="flex-1 h-full relative z-0">
        {/* Version Display */}
        <div className="absolute top-4 right-4 z-50 pointer-events-none opacity-30 select-none text-[10px] font-mono text-white">
          {APP_VERSION}
        </div>
        <ChatInterface
          messages={messages}
          isLoading={isLoading}
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