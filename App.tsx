import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { UnifiedService } from './services/geminiService';
import { ChatMessage, Role, AVAILABLE_MODELS, Attachment, ApiKeys } from './types';

const App: React.FC = () => {
  // Initialize messages from localStorage to survive browser close
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('ccs_chat_messages');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load chat history", e);
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);

  // Initialize currentModel from localStorage
  const [currentModel, setCurrentModel] = useState(() => {
    return localStorage.getItem('ccs_current_model') || AVAILABLE_MODELS[0].id;
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize keys from localStorage
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    const saved = localStorage.getItem('app_api_keys');
    return saved ? JSON.parse(saved) : { google: '', openai: '', anthropic: '' };
  });

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ccs_chat_messages', JSON.stringify(messages));
  }, [messages]);

  // Persist currentModel to localStorage
  useEffect(() => {
    localStorage.setItem('ccs_current_model', currentModel);
  }, [currentModel]);


  const serviceRef = useRef<UnifiedService | null>(null);

  // Get current model definition
  const activeModelDef = AVAILABLE_MODELS.find(m => m.id === currentModel) || AVAILABLE_MODELS[0];

  // Initialize service on mount and when dependencies change
  useEffect(() => {
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

    // Fallback Logic: If the current model's provider key was removed, switch to another available model
    const currentProvider = activeModelDef.provider;
    if (!newKeys[currentProvider]) {
      const firstAvailable = AVAILABLE_MODELS.find(m => newKeys[m.provider]);
      if (firstAvailable) {
        setCurrentModel(firstAvailable.id);
        setMessages([]); // Clear chat on forced switch
      }
      // If no keys left at all, we stay on current but Sidebar will show "No Models"
    }
  };

  const handleModelChange = (modelId: string) => {
    setCurrentModel(modelId);
    setSidebarOpen(false);
    // Service update is handled by useEffect
    // We clear messages on model switch for clean context (optional but safer for multi-provider)
    setMessages([]);
  };

  const handleClearChat = async () => {
    setMessages([]);
    localStorage.removeItem('ccs_chat_messages');
    if (serviceRef.current) {
      await serviceRef.current.resetSession();
    }
    setSidebarOpen(false);
  };

  const handleSendMessage = async (content: string, attachment?: Attachment) => {
    if ((!content.trim() && !attachment) || !serviceRef.current) return;

    // Check if key exists for current provider
    const currentProvider = activeModelDef.provider;
    if (!apiKeys[currentProvider]) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: Role.MODEL,
        content: `Please enter and save your API Key in the sidebar to use this model.`,
        timestamp: Date.now(),
        isError: true
      }]);
      setSidebarOpen(true);
      return;
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

    // Note: We do NOT create the empty bot message here.
    // We wait for the first chunk to ensure "Thinking" -> "Response" transition.

    try {
      let accumulatedText = '';
      let botMsgId: string | null = null;

      const stream = serviceRef.current.sendMessageStream(content, attachment);

      for await (const chunk of stream) {
        // Create the message on the first chunk
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
          msg.id === botMsgId
            ? { ...msg, content: accumulatedText }
            : msg
        ));
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      // If we failed before creating a message, create an error message now
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        content: `Error: ${error.message || "Connection Failed"}`,
        timestamp: Date.now(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full relative overflow-hidden">
      <Sidebar
        currentModel={currentModel}
        onModelChange={handleModelChange}
        onClearChat={handleClearChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        apiKeys={apiKeys}
        onApiKeysChange={handleApiKeysChange}
      />

      <main className="flex-1 h-full relative z-0">
        <ChatInterface
          messages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      </main>
    </div>
  );
};

export default App;