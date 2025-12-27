import React, { useState, useRef, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { UnifiedService } from './services/geminiService';
import { ChatMessage, Role, Attachment, ApiKeys, ModelOption } from './types';
import { APP_VERSION } from './config/version';

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

  const abortControllerRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('ccs_chat_messages');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);

  const [currentModel, setCurrentModel] = useState(() => {
    return localStorage.getItem('ccs_current_model') || '';
  });

  const [availableModels, setAvailableModels] = useState<ModelOption[]>(() => {
    const saved = localStorage.getItem('ccs_available_models');
    return saved ? JSON.parse(saved) : [];
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlightKeys, setHighlightKeys] = useState(false);

  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    const saved = localStorage.getItem('app_api_keys');
    return saved ? JSON.parse(saved) : { google: '', openai: '' };
  });

  useEffect(() => {
    const fetchModels = async () => {
      let models: ModelOption[] = [];

      // We will collect models to verify here
      let modelsToVerify: { provider: string, modelId: string, key: string }[] = [];

      if (apiKeys.google) {
        try {
          const googleModels = await UnifiedService.validateKeyAndGetModels('google', apiKeys.google);
          models = [...models, ...googleModels];
          // Queue for verification
          googleModels.forEach(m => modelsToVerify.push({ provider: 'google', modelId: m.id, key: apiKeys.google }));
        } catch (e: any) {
          toast.error(`Google API Error: ${e.message || 'Validation failed'}`);
        }
      }
      if (apiKeys.openai) {
        try {
          const openaiModels = await UnifiedService.validateKeyAndGetModels('openai', apiKeys.openai);
          models = [...models, ...openaiModels];
          // Queue for verification
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

      // BACKGROUND VERIFICATION
      // This initial fetchModels effect should only verify newly discovered models or models that were previously unavailable.
      // The `unavailableModels` state is used to filter which models need re-verification.
      if (modelsToVerify.length > 0) {
        // Run in background, don't await
        verifyModels(modelsToVerify);
      }
    };

    fetchModels();
  }, [apiKeys]);

  // This effect is for "smart refresh" - only re-verifying models that are currently marked unavailable.
  useEffect(() => {
    // Only verify models if we have keys
    const itemsToVerify: { provider: string, modelId: string, key: string }[] = [];
    const unavailableIds = Object.keys(unavailableModels);

    // If no models are unavailable, we skip auto-verification on load/key-change
    // This assumes "Available" status is sticky until proven otherwise by a manual chat failure.
    if (unavailableIds.length === 0) {
      console.log("[Smart Refresh] All models currently marked Available. Skipping background check.");
      return;
    }

    availableModels.forEach(m => {
      // STRICT MODE: Only add to verification list if it is currently marked unavailable
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
    // Checking unavailableModels in dependencies could cause loops if verifyModels updates it.
    // We rely on the fact that this effect runs on Mount (when unavailableModels is init from storage)
    // or when Keys/Models change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeys, availableModels]);

  const verifyModels = async (items: { provider: string, modelId: string, key: string }[]) => {

    // We can do this in parallel batches to be faster
    const promises = items.map(async (item) => {
      try {
        const result = await UnifiedService.checkModelAvailability(item.provider, item.modelId, item.key);
        if (!result.available) {
          // Update state
          // User requested specific codes: (400) or (429).
          // If it's not 429, we assume it's a validation/availability error (400).
          const finalCode = result.errorCode === '429' ? '429' : '400';

          setUnavailableModels(prev => {
            if (prev[item.modelId] === finalCode) return prev;
            return { ...prev, [item.modelId]: finalCode };
          });
          setUnavailableModelErrors(prev => ({ ...prev, [item.modelId]: result.error || 'Unknown Error' }));
        } else {
          // Explicitly clear if it becomes available (e.g. if we had a persistent error saved)
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
    console.log("Background verification complete.");
  };

  const handleManualRefresh = async () => {
    // Collect all models we currently have loaded
    const itemsToVerify: { provider: string, modelId: string, key: string }[] = [];
    // Manual Refresh = Full Refresh. We verify EVERYTHING to give the user peace of mind.

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


  useEffect(() => {
    localStorage.setItem('ccs_chat_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('ccs_current_model', currentModel);
  }, [currentModel]);


  const serviceRef = useRef<UnifiedService | null>(null);


  const [activeModelDef, setActiveModelDef] = useState<ModelOption | undefined>(undefined);
  // Store error codes: { [modelId]: "429" | "400" | "Error" }
  const [unavailableModels, setUnavailableModels] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ccs_unavailable_models');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Store full error messages: { [modelId]: "Full error message with link..." }
  const [unavailableModelErrors, setUnavailableModelErrors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ccs_unavailable_model_errors');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('ccs_unavailable_models', JSON.stringify(unavailableModels));
  }, [unavailableModels]);

  useEffect(() => {
    localStorage.setItem('ccs_unavailable_model_errors', JSON.stringify(unavailableModelErrors));
  }, [unavailableModelErrors]);

  useEffect(() => {
    if (currentModel) {
      const def = availableModels.find(m => m.id === currentModel) || availableModels[0];
      setActiveModelDef(def);
    }
  }, [currentModel, availableModels]);



  useEffect(() => {
    if (!activeModelDef) return;
    const activeKey = apiKeys[activeModelDef.provider];
    if (!serviceRef.current) {
      serviceRef.current = new UnifiedService(currentModel, activeModelDef.provider, activeKey);
    } else {
      serviceRef.current.setConfig(currentModel, activeModelDef.provider, activeKey);
    }
  }, [currentModel, apiKeys, activeModelDef]);

  const handleApiKeysChange = (newKeys: ApiKeys) => {
    setApiKeys(newKeys);
    localStorage.setItem('app_api_keys', JSON.stringify(newKeys));
  };

  const handleModelChange = (modelId: string) => {
    setCurrentModel(modelId);
    setSidebarOpen(false);
    setMessages([]);
  };

  const handleClearChat = async () => {
    setMessages([]);
    localStorage.removeItem('ccs_chat_messages');
    if (serviceRef.current) {
      await serviceRef.current.resetSession();
    }
    toast.success('Conversation cleared');
    setSidebarOpen(false);
  };

  const handleSendMessage = async (content: string, attachment?: Attachment): Promise<boolean> => {
    // 1. Basic Content Check
    if (!content.trim() && !attachment) return false;

    // 2. Generic API Key Check
    // Check if user has AT LEAST one key saved
    const hasAnyKey = !!apiKeys.google || !!apiKeys.openai;

    if (!hasAnyKey) {
      toast.error("Please connect an API Key to start chatting");

      setSidebarOpen(true);
      setHighlightKeys(true);
      setTimeout(() => setHighlightKeys(false), 3800); // 1.8s * 2 = 3.6s + buffer
      return false;
    }

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 3. Provider Specific Check (only if specific model is active)
    const currentProvider = activeModelDef?.provider || 'google';

    if (!apiKeys[currentProvider]) {
      toast.error(`Missing API Key for ${currentProvider.toUpperCase()}`);

      setSidebarOpen(true);
      setHighlightKeys(true);
      setTimeout(() => setHighlightKeys(false), 3800);
      return false;
    }

    // 4. Service Availability Check
    if (!serviceRef.current) {
      console.error("DEBUG: Service not initialized");
      toast.error("Critical Error: Service not initialized. Refresh page.");
      return false;
    }

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: Role.USER,
      content,
      timestamp: Date.now(),
      attachment: attachment
    };

    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      let accumulatedText = '';
      let botMsgId: string | null = null;

      // Auto-recover logic: If this model was unavailable but we are trying again,
      // and we got this far (stream starting), clear the limit flag.
      if (unavailableModels[currentModel]) {
        setUnavailableModels(prev => {
          const next = { ...prev };
          delete next[currentModel];
          return next;
        });
        // Also clear specific error message
        setUnavailableModelErrors(prev => {
          const next = { ...prev };
          delete next[currentModel];
          return next;
        });
      }

      const stream = serviceRef.current.sendMessageStream(content, attachment, controller.signal);

      for await (const chunk of stream) {
        if (!botMsgId) {
          botMsgId = (Date.now() + 1).toString();
          setMessages(prev => [...prev, {
            id: botMsgId!,
            role: Role.MODEL,
            content: '',
            timestamp: Date.now()
          }]);
        }
        accumulatedText += chunk;
        setMessages(prev => prev.map(msg =>
          msg.id === botMsgId ? { ...msg, content: accumulatedText } : msg
        ));
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log('Generation stopped by user');
        return; // Silent exit on abort
      }
      console.error("Chat error:", error);

      // General Error Handling for ALL errors
      let errorMessage = error.message || 'Connection interrupted';

      // 1. Rollback: Remove the user message
      setMessages(prev => prev.filter(msg => msg.id !== newUserMsg.id));

      // Determine error code
      let errorCode = "Error";
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit')) {
        errorCode = "429";
      } else if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('invalid request')) {
        errorCode = "400";
      }

      // 2. Disable the model visually with specific code
      setUnavailableModels(prev => ({
        ...prev,
        [currentModel]: errorCode
      }));
      setUnavailableModelErrors(prev => ({
        ...prev,
        [currentModel]: errorMessage
      }));

      // 3. Show specific toast tailored to the error type
      if (errorCode === "429") {
        toast.error("Oops! Rate limit exceeded (429). Please try again later.");
      } else if (errorCode === "400") {
        toast.error("Oops! Invalid request (400). Please check the model or parameters.");
      } else {
        toast.error(errorMessage);
      }
      return true; // Return TRUE to clear input box

    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
    return true;
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      toast.info("Generation stopped");
    }
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