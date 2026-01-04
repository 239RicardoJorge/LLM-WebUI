import React, { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { UnifiedService } from '../services/unifiedService';
import { ChatMessage, Role, ModelOption } from '../types';
import { X, Zap, Square, ArrowUp, Terminal } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface QuickChatProps {
    currentModel: string;
    availableModels: ModelOption[];
}

const QuickChat: React.FC<QuickChatProps> = ({ currentModel, availableModels }) => {
    const {
        isQuickChatOpen,
        setQuickChatOpen,
        quickChatPosition,
        setQuickChatPosition,
        apiKeys
    } = useSettingsStore();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const serviceRef = useRef<UnifiedService | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    // Handle Open State
    useEffect(() => {
        if (isQuickChatOpen) {
            setMessages([]);
            setInput('');
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    }, [isQuickChatOpen]);

    // Initialize service CORRECTLY using availableModels to find provider
    useEffect(() => {
        // Find the model object to get the exact provider
        const modelData = availableModels.find(m => m.id === currentModel);

        // precise provider lookup (fallback to 'groq' if unknown but ID implies it, else 'google')
        let provider = modelData?.provider;
        if (!provider) {
            const isGroq = currentModel.startsWith('gemma') || currentModel.startsWith('llama') || currentModel.startsWith('mixtral');
            provider = isGroq ? 'groq' : 'google';
        }

        // Get key
        let key = '';
        if (provider === 'google') {
            key = apiKeys.google || import.meta.env.VITE_GOOGLE_API_KEY || '';
        } else {
            key = apiKeys.groq || import.meta.env.VITE_GROQ_API_KEY || '';
        }

        console.log(`QuickChat Init: Model=${currentModel}, Provider=${provider}, KeyFound=${!!key}`);

        if (provider) {
            serviceRef.current = new UnifiedService(currentModel, provider, key);
        }

    }, [apiKeys, currentModel, availableModels]);

    // Scroll to bottom
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isQuickChatOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        console.log('[QuickChat] Sending message...', {
            currentModel,
            modelsCount: availableModels.length,
            serviceReady: !!serviceRef.current
        });

        if (!serviceRef.current) {
            console.log("[QuickChat] Service not ready, re-initializing...");
            const modelData = availableModels.find(m => m.id === currentModel);
            const provider = modelData?.provider || (currentModel.startsWith('gemma') || currentModel.startsWith('llama') ? 'groq' : 'google');
            let key = '';
            if (provider === 'google') key = apiKeys.google || import.meta.env.VITE_GOOGLE_API_KEY || '';
            else key = apiKeys.groq || import.meta.env.VITE_GROQ_API_KEY || '';

            console.log('[QuickChat] Re-init Check:', { provider, hasKey: !!key });

            if (provider && key) {
                serviceRef.current = new UnifiedService(currentModel, provider, key);
            } else {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: Role.MODEL,
                    content: `System Error: Missing API Key for ${provider || 'provider'}. Check logs.`,
                    isError: true,
                    timestamp: Date.now()
                }]);
                return;
            }
        }

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: Role.USER,
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        const botMsgId = (Date.now() + 1).toString();

        try {
            // Add placeholder message FIRST
            setMessages(prev => [...prev, {
                id: botMsgId,
                role: Role.MODEL,
                content: '',
                timestamp: Date.now()
            }]);

            if (!serviceRef.current) throw new Error("Service failed to initialize");

            serviceRef.current.setHistory([...messages, userMsg]);
            const stream = serviceRef.current.sendMessageStream(userMsg.content);

            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk;
                setMessages(prev => prev.map(m =>
                    m.id === botMsgId ? { ...m, content: fullResponse } : m
                ));
            }
        } catch (error: any) {
            console.error("[QuickChat] CRITICAL ERROR during stream:", error);
            // ATOMIC UPDATE: Replace the empty placeholder with error text
            setMessages(prev => prev.map(m =>
                m.id === botMsgId
                    ? { ...m, content: `Error: ${error.message || "Unknown error."}`, isError: true }
                    : m
            ));
        } finally {
            setIsLoading(false);
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleDragStart = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - quickChatPosition.x,
            y: e.clientY - quickChatPosition.y
        });
    };

    const handleDrag = (e: MouseEvent) => {
        if (isDragging) {
            setQuickChatPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDrag);
            window.addEventListener('mouseup', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('mouseup', handleDragEnd);
        };
    }, [isDragging]);

    if (!isQuickChatOpen) return null;

    return (
        <div
            className="fixed z-[99999] flex flex-col shadow-2xl overflow-hidden backdrop-blur-2xl"
            style={{
                left: quickChatPosition.x,
                top: quickChatPosition.y,
                width: '380px',
                height: '500px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 30px 60px -12px rgba(0,0,0,0.5)'
            }}
        >
            {/* Header / Drag Handle */}
            <div
                className="flex items-center justify-between p-3 cursor-grab active:cursor-grabbing border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30"
                onMouseDown={handleDragStart}
            >
                <div className="flex items-center gap-2 font-medium text-xs select-none text-[var(--text-primary)] uppercase tracking-wider">
                    <Terminal size={14} className="fill-current" />
                    QUICK CC
                </div>
                <button
                    onClick={() => setQuickChatOpen(false)}
                    className="p-1.5 hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-red-500 rounded-full transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Chat Area */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-6 font-sans scrollbar-hide"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] opacity-50 gap-2 select-none">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-glass)] border border-[var(--border-color)] flex items-center justify-center shadow-2xl">
                            <Terminal className="w-8 h-8 text-[var(--text-muted)]" />
                        </div>
                        <div className="text-xs uppercase tracking-widest">Quick Clear Context</div>
                    </div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`group flex flex-col ${msg.role === Role.USER ? 'items-end' : 'items-start'}`}
                    >
                        {/* Replicating UserMessage/ModelMessage generic structure for visual consistency */}
                        {msg.role === Role.USER ? (
                            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2rem] px-5 py-3 text-[15px] text-[var(--text-primary)] leading-relaxed shadow-sm break-words hyphens-auto whitespace-pre-wrap max-w-[90%] rounded-tr-sm">
                                {msg.content}
                            </div>
                        ) : (
                            <div className="w-full text-[var(--text-primary)] pl-4 px-4 md:pl-0 md:px-0">
                                <div className="flex items-center gap-3 mb-4 opacity-30">
                                    <div className="h-[1px] w-8 bg-[var(--text-primary)]"></div>
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-primary)]">Response</span>
                                </div>
                                <div className="prose-container break-words hyphens-auto text-sm">
                                    <MarkdownRenderer content={msg.content} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="w-full animate-pulse pl-4 px-4 md:pl-0 md:px-0">
                        <div className="flex items-center gap-3 mb-4 opacity-50">
                            <div className="h-[1px] w-8 bg-[var(--text-primary)]"></div>
                            <span className="text-[10px] font-bold tracking-widest uppercase">Thinking</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-transparent">
                <div className="relative bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[2rem] shadow-sm overflow-hidden flex items-end p-1.5 transition-all duration-300 focus-within:border-[var(--text-muted)] focus-within:shadow-md hover:shadow-lg focus-within:ring-1 focus-within:ring-[var(--border-color)]">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Input command quickly..."
                        rows={1}
                        className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] px-4 py-3 focus:outline-none resize-none max-h-32"
                        disabled={isLoading}
                    />

                    <button
                        onClick={() => handleSend()}
                        disabled={(!input.trim() && !isLoading)}
                        className={`
                            m-1 p-2 rounded-full flex items-center justify-center min-w-[2.5rem] min-h-[2.5rem] transition-all duration-300
                            ${isLoading
                                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                                : input.trim()
                                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:scale-105 active:scale-95 shadow-md'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed opacity-50'}
                        `}
                    >
                        {isLoading ? (
                            <Square className="w-4 h-4 fill-current" />
                        ) : (
                            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickChat;
