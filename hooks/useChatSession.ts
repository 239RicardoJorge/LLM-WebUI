import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { UnifiedService } from '../services/geminiService';
import { ChatMessage, Role, Attachment, ModelOption } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { APP_CONFIG } from '../config/constants';
import {
    saveMessages,
    loadMessages,
    deleteConversation,
    migrateFromLocalStorage,
    saveMessagesSync,
    applyPendingSaves,
    DEFAULT_CONVERSATION_ID
} from '../utils/storage';

interface UseChatSessionProps {
    currentModel: string;
    availableModels: ModelOption[];
    unavailableModels: Record<string, string>;
    setUnavailableModels: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setUnavailableModelErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setSidebarOpen: (open: boolean) => void;
    setHighlightKeys: (highlight: boolean) => void;
}

export const useChatSession = ({
    currentModel,
    availableModels,
    unavailableModels,
    setUnavailableModels,
    setUnavailableModelErrors,
    setSidebarOpen,
    setHighlightKeys
}: UseChatSessionProps) => {
    const { apiKeys } = useSettingsStore();

    // Start with empty, hydrate from IndexedDB
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isHydrating, setIsHydrating] = useState(true);

    const [isLoading, setIsLoading] = useState(false);
    const serviceRef = useRef<UnifiedService | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const messagesRef = useRef(messages); // Keep ref in sync for beforeunload
    const hasHydratedRef = useRef(false); // Track if hydration is complete
    const lastSavedMessagesRef = useRef<string>('[]'); // Track last saved state to avoid redundant saves

    // Hydrate from IndexedDB on mount
    useEffect(() => {
        const hydrate = async () => {
            // Apply any pending sync saves first
            await applyPendingSaves(DEFAULT_CONVERSATION_ID);

            // Try to load from IndexedDB
            let loaded = await loadMessages(DEFAULT_CONVERSATION_ID);
            console.log('[CCS] Loaded from IndexedDB:', loaded.length, 'messages');

            // Migrate from old localStorage if IndexedDB is empty
            if (loaded.length === 0) {
                loaded = await migrateFromLocalStorage(
                    APP_CONFIG.STORAGE_KEYS.CHAT_MESSAGES,
                    DEFAULT_CONVERSATION_ID
                );
            }

            // Restore implicit data for active attachments (persistence restoration)
            // Restore implicit data for active attachments (persistence restoration)
            const processed = loaded.map((msg: ChatMessage) => {
                // If attachment exists...
                if (msg.attachment) {
                    // Check if it is an image
                    if (msg.attachment.mimeType.startsWith('image/')) {
                        // Restore thumbnail to data if data is missing
                        if (!msg.attachment.data && msg.attachment.thumbnail) {
                            try {
                                const thumbnailBase64 = msg.attachment.thumbnail.split(',')[1];
                                return {
                                    ...msg,
                                    attachment: {
                                        ...msg.attachment,
                                        isActive: true, // Always active for thumbs
                                        isThumbnail: true, // Flag to indicate we're using thumbnail
                                        data: thumbnailBase64
                                    }
                                };
                            } catch (e) {
                                console.error('Failed to restore thumbnail context:', e);
                                return msg;
                            }
                        }
                    } else {
                        // Non-image attachments:
                        // They are Active=False and Data is stripped in storage.
                        // We just pass them through so UI can show the "greyed out" metadata.
                        return msg;
                    }
                }
                return msg;
            });

            setMessages(processed);
            console.log('[CCS] Hydration complete:', processed.length, 'messages');
            hasHydratedRef.current = true;
            lastSavedMessagesRef.current = JSON.stringify(processed);
            setIsHydrating(false);
        };
        hydrate();
    }, []);

    // Keep messagesRef in sync
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Flush function - saves immediately
    const flushMessages = () => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = null;
        }
        // Only flush if hydration is complete
        if (hasHydratedRef.current) {
            saveMessagesSync(DEFAULT_CONVERSATION_ID, messagesRef.current);
        }
    };

    // Debounced persist to IndexedDB (2000ms)
    useEffect(() => {
        // Skip if hydration hasn't completed yet
        if (!hasHydratedRef.current) return;

        // Skip if messages haven't actually changed since last save
        const currentMessagesJson = JSON.stringify(messages);
        if (currentMessagesJson === lastSavedMessagesRef.current) return;

        // Clear any existing timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        // Schedule new write to IndexedDB
        debounceTimeoutRef.current = setTimeout(() => {
            console.log('[CCS] Saving', messages.length, 'messages to IndexedDB');
            saveMessages(DEFAULT_CONVERSATION_ID, messages);
            lastSavedMessagesRef.current = JSON.stringify(messages);
            debounceTimeoutRef.current = null;
        }, 2000);

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [messages]);

    // Flush on page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            flushMessages();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            flushMessages(); // Also flush on unmount
        };
    }, []);

    // Update Service Instance
    const activeModelDef = availableModels.find(m => m.id === currentModel);

    useEffect(() => {
        if (!activeModelDef) return;
        const activeKey = apiKeys[activeModelDef.provider];
        if (!serviceRef.current) {
            serviceRef.current = new UnifiedService(currentModel, activeModelDef.provider, activeKey);
        } else {
            serviceRef.current.setConfig(currentModel, activeModelDef.provider, activeKey);
        }
    }, [currentModel, apiKeys, activeModelDef]);

    // Sync history to LLM provider after hydration completes and service is ready
    useEffect(() => {
        if (!isHydrating && serviceRef.current && messages.length > 0) {
            serviceRef.current.setHistory(messages);
        }
    }, [isHydrating, messages.length]);


    const handleClearChat = async () => {
        // Abort any ongoing generation
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);

        setMessages([]);
        // Clear from IndexedDB and any pending localStorage
        await deleteConversation(DEFAULT_CONVERSATION_ID);
        localStorage.removeItem(`ccs_messages_pending_${DEFAULT_CONVERSATION_ID}`);

        if (serviceRef.current) {
            await serviceRef.current.resetSession();
        }
        toast.success('Conversation cleared');
        setSidebarOpen(false);
    };

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            toast.info("Generation stopped");
        }
    };

    const handleSendMessage = async (content: string, attachment?: Attachment): Promise<boolean> => {
        // 1. Basic Content Check
        if (!content.trim() && !attachment) return false;

        // 2. Generic API Key Check
        const hasAnyKey = !!apiKeys.google || !!apiKeys.openai;

        if (!hasAnyKey) {
            toast.error("Please connect an API Key to start chatting");
            setSidebarOpen(true);
            setHighlightKeys(true);
            setTimeout(() => setHighlightKeys(false), 3800);
            return false;
        }

        // Abort any previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // 3. Provider Specific Check
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

            // Auto-recover logic
            if (unavailableModels[currentModel]) {
                setUnavailableModels(prev => {
                    const next = { ...prev };
                    delete next[currentModel];
                    return next;
                });
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
                return; // Silent exit
            }
            console.error("Chat error:", error);

            let errorMessage = error.message || 'Connection interrupted';

            // Rollback
            setMessages(prev => prev.filter(msg => msg.id !== newUserMsg.id));

            // Determine error code
            let errorCode = "Error";
            if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit')) {
                errorCode = "429";
            } else if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('invalid request')) {
                errorCode = "400";
            }

            // Disable model ONLY for 429 (rate limit) errors, not 400
            if (errorCode === "429") {
                setUnavailableModels(prev => ({ ...prev, [currentModel]: errorCode }));
                setUnavailableModelErrors(prev => ({ ...prev, [currentModel]: errorMessage }));
            }

            // Toast
            if (errorCode === "429") {
                toast.error("Oops! Rate limit exceeded (429). Please try again later.");
            } else if (errorCode === "400") {
                toast.error("Oops! Invalid request (400). Please check your input.");
            } else {
                toast.error(errorMessage);
            }
            return true;

        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
        return true;
    };



    return {
        messages,
        setMessages,
        isLoading,
        isHydrating,
        handleSendMessage,
        handleStopGeneration,
        handleClearChat
    };
};
