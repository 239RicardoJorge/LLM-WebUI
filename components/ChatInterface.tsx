import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Menu, Terminal, Paperclip, X } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { ChatMessage, Role, Attachment } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string, attachment?: Attachment) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isLoading,
  onSendMessage,
  sidebarOpen,
  setSidebarOpen
}) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Auto-focus removed to prevent mobile keyboard popping and layout shifts
  // useEffect(() => {
  //   textareaRef.current?.focus();
  // }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachment) || isLoading) return;

    onSendMessage(input, attachment);
    setInput('');
    setAttachment(undefined);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Content = base64Data.split(',')[1];

      setAttachment({
        mimeType: file.type,
        data: base64Content,
        name: file.name
      });
    };
    reader.readAsDataURL(file);

    // Reset value to allow selecting same file again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = () => {
    setAttachment(undefined);
  };

  return (
    <div className="h-full flex flex-col relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,application/pdf"
      />

      {/* Mobile Toggle */}
      <div className="lg:hidden absolute top-4 left-4 z-30">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/10"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth">
        <div className="max-w-3xl mx-auto pt-24 pb-48 min-h-full flex flex-col justify-center">

          {/* Hero / Empty State */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center space-y-8 animate-fade-up opacity-60">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
                <Terminal className="w-8 h-8 text-white/40" />
              </div>
              <p className="text-sm font-mono text-gray-500 tracking-widest uppercase">
                System Ready
              </p>
            </div>
          )}

          {/* Conversation Feed */}
          <div className="space-y-12">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`animate-fade-up group ${msg.role === Role.USER ? 'flex justify-end' : ''}`}
              >
                {/* User Message */}
                {msg.role === Role.USER ? (
                  <div className="flex flex-col items-end max-w-[80%]">
                    {msg.attachment && (
                      <div className="mb-2 rounded-xl overflow-hidden border border-white/10 shadow-lg max-w-[200px]">
                        {msg.attachment.mimeType.startsWith('image/') ? (
                          <img
                            src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`}
                            alt="User Upload"
                            className="w-full h-auto"
                          />
                        ) : (
                          <div className="p-4 bg-[#1A1A1A] text-xs text-white/70">
                            {msg.attachment.mimeType}
                          </div>
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <div className="bg-[#1A1A1A] border border-white/10 rounded-[2rem] px-8 py-5 text-[17px] text-white/90 leading-relaxed shadow-lg break-words hyphens-auto whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Model Message */
                  <div className="w-full text-gray-200 pl-4 md:pl-0">
                    <div className="flex items-center gap-3 mb-4 opacity-30">
                      <div className="h-[1px] w-8 bg-white"></div>
                      <span className="text-[10px] font-bold tracking-widest uppercase">Response</span>
                    </div>
                    <div className="prose-container break-words hyphens-auto">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (messages.length === 0 || messages[messages.length - 1].role !== Role.MODEL) && (
              <div className="w-full animate-pulse pl-4 md:pl-0">
                <div className="flex items-center gap-3 mb-4 opacity-50">
                  <div className="h-[1px] w-8 bg-white"></div>
                  <span className="text-[10px] font-bold tracking-widest uppercase">Thinking</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Floating Input Dock */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 pointer-events-none z-20">
        <div className="max-w-3xl mx-auto pointer-events-auto">

          <div className="relative group">

            {/* Attachment Preview - Glass Panel popping up */}
            {attachment && (
              <div className="absolute bottom-full left-0 mb-4 p-2 bg-[#0d0d0d]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-up">
                <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden flex items-center justify-center relative">
                  {attachment.mimeType.startsWith('image/') ? (
                    <img
                      src={`data:${attachment.mimeType};base64,${attachment.data}`}
                      className="w-full h-full object-cover"
                      alt="preview"
                    />
                  ) : (
                    <Paperclip className="w-5 h-5 text-white/50" />
                  )}
                </div>
                <div className="pr-2">
                  <p className="text-xs text-white max-w-[150px] truncate">{attachment.name || 'File'}</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider">{attachment.mimeType.split('/')[1]}</p>
                </div>
                <button onClick={removeAttachment} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>
            )}

            {/* Input Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 via-white/10 to-blue-500/10 rounded-[2.5rem] blur opacity-0 group-hover:opacity-100 transition duration-1000"></div>

            <div className="relative bg-[#0d0d0d]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex items-end p-2 transition-all duration-300 focus-within:bg-[#0d0d0d] focus-within:border-white/20">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="m-2 p-3 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Input command..."
                rows={1}
                className="w-full bg-transparent text-lg text-white placeholder-gray-600 px-2 py-4 focus:outline-none resize-none max-h-48"
                disabled={isLoading}
              />

              <button
                onClick={() => handleSubmit()}
                disabled={(!input.trim() && !attachment) || isLoading}
                className={`
                    m-2 p-3 rounded-full transition-all duration-300 flex-shrink-0
                    ${(input.trim() || attachment) && !isLoading
                    ? 'bg-white text-black hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                    : 'bg-white/5 text-gray-600 cursor-not-allowed'}
                    `}
              >
                <ArrowUp className="w-6 h-6 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;