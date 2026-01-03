import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { UnifiedService } from '../services/unifiedService';
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
import { categorizeError } from '../utils/errorCategorization';

interface UseChatSessionProps {
    currentModel: string;
    availableModels: ModelOption[];
    unavailableModels: Record<string, string>;
    setUnavailableModels: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setUnavailableModelErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setSidebarOpen: (open: boolean) => void;
    setHighlightKeys: (highlight: boolean) => void;
    fallbackToPreviousModel: () => boolean;
}

export const useChatSession = ({
    currentModel,
    availableModels,
    unavailableModels,
    setUnavailableModels,
    setUnavailableModelErrors,
    setSidebarOpen,
    setHighlightKeys,
    fallbackToPreviousModel
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

    // Hydrate from IndexedDB on mount
    useEffect(() => {
        const hydrate = async () => {
            // Apply any pending sync saves first
            await applyPendingSaves(DEFAULT_CONVERSATION_ID);

            // Try to load from IndexedDB
            let loaded = await loadMessages(DEFAULT_CONVERSATION_ID);

            // Migrate from old localStorage if IndexedDB is empty
            if (loaded.length === 0) {
                loaded = await migrateFromLocalStorage(
                    APP_CONFIG.STORAGE_KEYS.CHAT_MESSAGES,
                    DEFAULT_CONVERSATION_ID
                );
            }

            // Restore implicit data for active attachments (persistence restoration)
            // Helper to restore a single attachment
            // NOTE: We do NOT copy thumbnail to data anymore - that was causing issues!
            // The data field should be undefined after reload, and thumbnail should be used for display.
            const restoreAttachment = (att: Attachment): Attachment => {
                if (att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/')) {
                    // If data is missing, the original was not persisted (as expected)
                    // Mark as thumbnail mode for display logic
                    if (!att.data && att.thumbnail) {
                        return {
                            ...att,
                            isActive: false,  // Mark as inactive (original not in memory)
                            isThumbnail: true // Flag that we're showing thumbnail
                            // Note: data remains undefined - do NOT copy thumbnail here!
                        };
                    }
                }
                return att;
            };

            const processed = loaded.map((msg: ChatMessage) => {
                // Handle attachments array - restore isActive/isThumbnail flags
                if (!msg.attachments || !Array.isArray(msg.attachments)) return msg;
                return {
                    ...msg,
                    attachments: msg.attachments.map(restoreAttachment)
                };
            });

            setMessages(processed);
            hasHydratedRef.current = true;
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
    // Uses lightweight change detection instead of JSON.stringify on every render
    const lastSavedCountRef = useRef(0);
    const lastSavedTimestampRef = useRef(0);

    useEffect(() => {
        // Skip if hydration hasn't completed yet
        if (!hasHydratedRef.current) return;

        // Lightweight change detection: check count and last message timestamp
        const currentCount = messages.length;
        const currentLastTimestamp = messages.length > 0
            ? messages[messages.length - 1].timestamp
            : 0;

        // Skip if nothing changed (same count and same last timestamp)
        if (currentCount === lastSavedCountRef.current &&
            currentLastTimestamp === lastSavedTimestampRef.current) {
            return;
        }

        // Clear any existing timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        // Schedule new write to IndexedDB
        debounceTimeoutRef.current = setTimeout(() => {
            saveMessages(DEFAULT_CONVERSATION_ID, messages);
            lastSavedCountRef.current = currentCount;
            lastSavedTimestampRef.current = currentLastTimestamp;
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

    // Sync history to LLM provider after hydration completes, service is ready, or model changes
    useEffect(() => {
        if (!isHydrating && serviceRef.current && messages.length > 0) {
            serviceRef.current.setHistory(messages);
        }
    }, [isHydrating, messages.length, currentModel]);


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

    const handleSendMessage = async (content: string, attachments?: Attachment[]): Promise<boolean> => {
        // 1. Basic Content Check
        if (!content.trim() && (!attachments || attachments.length === 0)) return false;

        // 2. Generic API Key Check
        const hasAnyKey = !!apiKeys.google || !!apiKeys.groq;

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

        // Note: We don't pre-check attachment support here. If a model doesn't support
        // attachments, the API will return an appropriate error that we handle below.

        const newUserMsg: ChatMessage = {
            id: Date.now().toString(),
            role: Role.USER,
            content,
            timestamp: Date.now(),
            attachments: attachments && attachments.length > 0 ? attachments : undefined
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

            const stream = serviceRef.current.sendMessageStream(content, attachments, controller.signal);


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
        } catch (error: unknown) {
            const err = error as Error & { name?: string };
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                return; // Silent exit
            }
            console.error("Chat error:", error);

            const errorMessage = err.message || 'Connection interrupted';

            // Rollback
            setMessages(prev => prev.filter(msg => msg.id !== newUserMsg.id));

            // Use centralized error categorization
            const errorCode = categorizeError(errorMessage);

            // Disable model ONLY for 429 (rate limit) errors, not 400
            if (errorCode === "429") {
                setUnavailableModels(prev => ({ ...prev, [currentModel]: errorCode }));
                setUnavailableModelErrors(prev => ({ ...prev, [currentModel]: errorMessage }));
            }

            // Toast
            if (errorCode === "429") {
                toast.error("Oops! Rate limit exceeded (429). Please try again later.");
                // Try to fallback to previous working model
                fallbackToPreviousModel();
            } else if (errorCode === "400") {
                // 400 = user error (bad input), don't fallback
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
