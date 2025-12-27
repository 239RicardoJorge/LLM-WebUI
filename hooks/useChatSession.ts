import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { UnifiedService } from '../services/geminiService';
import { ChatMessage, Role, Attachment, ApiKeys, ModelOption } from '../types';

interface UseChatSessionProps {
    apiKeys: ApiKeys;
    currentModel: string;
    availableModels: ModelOption[];
    unavailableModels: Record<string, string>;
    setUnavailableModels: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setUnavailableModelErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setSidebarOpen: (open: boolean) => void;
    setHighlightKeys: (highlight: boolean) => void;
}

export const useChatSession = ({
    apiKeys,
    currentModel,
    availableModels,
    unavailableModels,
    setUnavailableModels,
    setUnavailableModelErrors,
    setSidebarOpen,
    setHighlightKeys
}: UseChatSessionProps) => {

    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try {
            const saved = localStorage.getItem('ccs_chat_messages');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const [isLoading, setIsLoading] = useState(false);
    const serviceRef = useRef<UnifiedService | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Persist messages
    useEffect(() => {
        localStorage.setItem('ccs_chat_messages', JSON.stringify(messages));
    }, [messages]);

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


    const handleClearChat = async () => {
        setMessages([]);
        localStorage.removeItem('ccs_chat_messages');
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

            // Disable model
            setUnavailableModels(prev => ({ ...prev, [currentModel]: errorCode }));
            setUnavailableModelErrors(prev => ({ ...prev, [currentModel]: errorMessage }));

            // Toast
            if (errorCode === "429") {
                toast.error("Oops! Rate limit exceeded (429). Please try again later.");
            } else if (errorCode === "400") {
                toast.error("Oops! Invalid request (400). Please check the model or parameters.");
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
        handleSendMessage,
        handleStopGeneration,
        handleClearChat
    };
};
