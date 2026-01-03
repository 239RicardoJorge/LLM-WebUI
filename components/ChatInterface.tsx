import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { toast } from 'sonner';
import { ChatMessage, Role, Attachment } from '../types';

// Import decomposed components
import { EmptyState, ErrorDisplay, ModelMessage, UserMessage, ChatInput } from './chat';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isHydrating?: boolean;
  onSendMessage: (message: string, attachments?: Attachment[]) => Promise<boolean>;
  onStop: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  unavailableCode?: string;
  unavailableMessage?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isLoading,
  isHydrating = false,
  onSendMessage,
  onStop,
  sidebarOpen,
  setSidebarOpen,
  unavailableCode,
  unavailableMessage
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Track initial message count to only animate NEW messages
  const [initialMessageCount] = useState(messages.length);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<NodeJS.Timeout>(null);

  const handleScroll = () => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      if (scrollContainerRef.current) {
        localStorage.setItem('ccs_chat_scroll_pos', String(scrollContainerRef.current.scrollTop));
      }
    }, 100);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Track previous message length to detect NEW messages
  const prevMessagesLength = useRef(messages.length);
  const isHydratingRef = useRef(true);

  // 1. RESTORE SCROLL ON CONTENT UPDATE
  React.useLayoutEffect(() => {
    if (isHydratingRef.current && messages.length > 0) {
      const savedScroll = localStorage.getItem('ccs_chat_scroll_pos');

      if (savedScroll && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = Number(savedScroll);
        isHydratingRef.current = false;
      } else if (scrollContainerRef.current) {
        scrollToBottom('auto');
        isHydratingRef.current = false;
      }
    }
  }, [messages.length]);

  // 2. AUTO-SCROLL ON NEW MESSAGES
  useEffect(() => {
    if (!isHydratingRef.current && messages.length > prevMessagesLength.current) {
      scrollToBottom('smooth');
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  // Handler: Open attachment in new tab
  const openAttachment = useCallback(async (mimeType: string, data?: string, thumbnail?: string) => {
    const src = data
      ? `data:${mimeType};base64,${data}`
      : (thumbnail || null);

    if (src) {
      try {
        const blob = await (await fetch(src)).blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (e) {
        console.error("Failed to open attachment", e);
        toast.error('Failed to open attachment');
      }
    } else {
      toast.info('Original file not available (only thumbnail remains).');
    }
  }, []);

  // Handler: Open file attachment
  const openFileAttachment = useCallback(async (attachment: Attachment) => {
    if (attachment.data) {
      try {
        const src = `data:${attachment.mimeType};base64,${attachment.data}`;
        const blob = await (await fetch(src)).blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (e) {
        console.error("Failed to open file", e);
        toast.error('Failed to open file');
      }
    } else if (attachment.isActive === false) {
      toast.info('File not found in context (cleaned up).');
    }
  }, []);

  const handleSubmit = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) {
      return;
    }

    const success = await onSendMessage(input, attachments);
    if (success) {
      setInput('');
      setAttachments([]);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-3 bg-[var(--bg-glass)] backdrop-blur-md rounded-full text-[var(--text-secondary)] border border-[var(--border-color)]"
        >
          <Menu className="w-5 h-5 stroke-[var(--text-secondary)] transition-[stroke] duration-500" />
        </button>
      </div>

      {/* Main Content Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-0 [scrollbar-gutter:stable]"
      >
        <div className="max-w-3xl mx-auto pt-16 md:pt-24 pb-16 md:pb-32 min-h-full flex flex-col justify-center">
          {/* Empty State or Error Display */}
          {messages.length === 0 && !isHydrating && (
            <div className="flex flex-col items-center justify-center space-y-6">
              {unavailableCode ? (
                <ErrorDisplay code={unavailableCode} message={unavailableMessage} />
              ) : (
                <EmptyState />
              )}
            </div>
          )}

          {/* Conversation Feed */}
          <div className="space-y-12">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`group ${idx >= initialMessageCount ? 'animate-fade-up' : ''} ${msg.role === Role.USER ? 'flex justify-end' : ''}`}
              >
                {msg.role === Role.USER ? (
                  <UserMessage
                    message={msg}
                    onOpenAttachment={openAttachment}
                    onOpenFileAttachment={openFileAttachment}
                  />
                ) : (
                  <ModelMessage content={msg.content} />
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (messages.length === 0 || messages[messages.length - 1].role !== Role.MODEL) && (
              <div className="w-full animate-pulse pl-4 md:pl-0">
                <div className="flex items-center gap-3 mb-4 opacity-50">
                  <div className="h-[1px] w-8 bg-[var(--text-primary)]"></div>
                  <span className="text-[10px] font-bold tracking-widest uppercase">Thinking</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Floating Input Dock */}
      <ChatInput
        input={input}
        setInput={setInput}
        attachments={attachments}
        setAttachments={setAttachments}
        isLoading={isLoading}
        unavailableCode={unavailableCode}
        onSubmit={handleSubmit}
        onStop={onStop}
      />
    </div>
  );
};

export default ChatInterface;