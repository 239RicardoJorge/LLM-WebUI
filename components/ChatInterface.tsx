import React, { useRef, useEffect, useState, Suspense } from 'react';
import { ArrowUp, Menu, Terminal, Paperclip, X, Square, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
// Lazy load MarkdownRenderer to split heavy dependencies (react-markdown, remark, katex)
const MarkdownRenderer = React.lazy(() => import('./MarkdownRenderer'));
import { ChatMessage, Role, Attachment } from '../types';
import {
  validateFileSize,
  processAttachment,
  formatFileSize,
  formatDuration,
  getFileTypeIcon
} from '../utils/thumbnails';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isHydrating?: boolean;
  onSendMessage: (message: string, attachment?: Attachment) => Promise<boolean>;
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
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);

  // Track initial message count to only animate NEW messages
  const [initialMessageCount] = useState(messages.length);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const isHypdrating = useRef(true);

  // 1. RESTORE SCROLL ON CONTENT UPDATE
  // We monitor messages.length because the container height depends on it.
  React.useLayoutEffect(() => {
    // Only attempt to restore if we are hydrating (initial load of messages)
    if (isHypdrating.current && messages.length > 0) {
      const savedScroll = localStorage.getItem('ccs_chat_scroll_pos');

      if (savedScroll && scrollContainerRef.current) {
        // If we have a saved position, restore it
        scrollContainerRef.current.scrollTop = Number(savedScroll);
        isHypdrating.current = false; // Hydration done
      } else if (scrollContainerRef.current) {
        // No saved position, default to bottom
        scrollToBottom('auto');
        isHypdrating.current = false;
      }
    }
  }, [messages.length]);

  // 2. AUTO-SCROLL ON NEW MESSAGES (Live interactions)
  useEffect(() => {
    // Only scroll if message count INCREASED AND we are not hydrating
    if (!isHypdrating.current && messages.length > prevMessagesLength.current) {
      scrollToBottom('smooth');
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);



  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log("ChatInterface: handleSubmit called", { input, attachment, isLoading });

    if ((!input.trim() && !attachment) || isLoading) {
      console.warn("ChatInterface: Submission blocked", { inputEmpty: !input.trim(), attachmentMissing: !attachment, isLoading });
      return;
    }

    console.log("ChatInterface: Calling onSendMessage");
    const success = await onSendMessage(input, attachment);
    if (success) {
      setInput('');
      setAttachment(undefined);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input immediately to allow re-selecting same file
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Validate file size
    const validation = validateFileSize(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    if (validation.warning) {
      toast.warning(validation.warning);
    }

    try {
      // Process file and generate thumbnail
      const meta = await processAttachment(file);

      // Read file content as base64 for API
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        const base64Content = base64Data.split(',')[1];

        setAttachment({
          mimeType: file.type,
          data: base64Content,
          name: meta.name,
          size: meta.size,
          thumbnail: meta.thumbnail,
          duration: meta.duration,
          dimensions: meta.dimensions,
          isActive: true
        });
      };
      reader.onerror = () => {
        toast.error('Failed to read file. Please try again.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File processing error:', error);
      toast.error('Failed to process file. Please try a different file.');
    }
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
        accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt,.md"
      />

      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-3 bg-[var(--bg-glass)] backdrop-blur-md rounded-full text-[var(--text-secondary)] border border-[var(--border-color)]"
        >
          <Menu className="w-5 h-5 stroke-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 overflow-y-auto px-4 md:px-0"
      >
        <div className="max-w-3xl mx-auto pt-16 md:pt-24 pb-16 md:pb-32 min-h-full flex flex-col justify-center">

          {messages.length === 0 && !isHydrating && (
            <div className="flex flex-col items-center justify-center space-y-6">
              {unavailableCode ? (
                <div
                  key={unavailableCode}
                  className="flex flex-col items-center gap-4 text-center"
                >
                  <h1
                    className="text-8xl font-bold font-mono tracking-tighter select-none text-[var(--error-text)] opacity-80"
                  >
                    {unavailableCode}
                  </h1>

                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-mono text-[var(--error-text)] opacity-60 tracking-[0.2em] uppercase">
                      Model Unavailable
                    </p>
                    <p className="text-xs font-mono text-[var(--error-text)] opacity-60 tracking-widest uppercase">
                      {unavailableCode === '429' ? 'Rate Limit Exceeded' :
                        unavailableCode === '400' ? 'Invalid Request' :
                          'Connection Failed'}
                    </p>
                  </div>
                  {unavailableMessage && (() => {
                    // improved regex to exclude common trailing chars and delimiters
                    const urlRegex = /(https?:\/\/[^\s"'()<>\[\]{}|\\^`]+)/g;
                    const matches = unavailableMessage.match(urlRegex);

                    if (matches) {
                      // Multi-step cleaning to ensure robust deduplication
                      const uniqueUrls = Array.from(new Set(
                        matches.map(url => {
                          let clean = url.trim();
                          clean = clean.replace(/[.,;?!]+$/, ""); // Remove punctuation
                          clean = clean.replace(/\/+$/, "");      // Remove trailing slashes
                          return clean;
                        })
                      ));

                      // Filter out any empty strings preventing empty buttons
                      const validUrls = uniqueUrls.filter(u => u.length > 0);

                      return (
                        <div className="flex flex-wrap justify-center gap-3 mt-6">
                          {validUrls.map((url, idx) => {
                            let label = 'View Details';
                            if (url.includes('docs') || url.includes('documentation')) {
                              label = 'View Documentation';
                            } else if (url.includes('rate-limit') || url.includes('quota') || url.includes('usage') || url.includes('billing')) {
                              label = 'Manage Quota';
                            }

                            return (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-full border border-blue-400/30 bg-blue-500/5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 hover:border-blue-400/50 transition-colors duration-500 flex items-center gap-2"
                              >
                                <span>{label}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <>
                  <div
                    className="w-16 h-16 rounded-2xl bg-[var(--bg-glass)] border border-[var(--border-color)] flex items-center justify-center shadow-2xl"
                  >
                    <Terminal className="w-8 h-8 text-[var(--text-muted)]" />
                  </div>
                  <p className="text-sm font-mono text-[var(--text-muted)] tracking-widest uppercase">
                    System Ready
                  </p>
                </>
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
                {/* User Message */}
                {msg.role === Role.USER ? (
                  <div className="flex flex-col items-end max-w-[80%]">
                    {msg.attachment && (
                      <>
                        {/* Visual media (images/videos) with thumbnails */}
                        {(msg.attachment.thumbnail || (msg.attachment.mimeType.startsWith('image/') && msg.attachment.data)) ? (
                          <div className="flex gap-2 mb-2">
                            {/* Card with thumbnail + description */}
                            <div
                              className={`rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-lg max-w-[200px] bg-[var(--bg-primary)]/90 backdrop-blur-2xl cursor-pointer`}
                              onClick={async () => {
                                const src = msg.attachment?.thumbnail || (msg.attachment?.data ? `data:${msg.attachment.mimeType};base64,${msg.attachment.data}` : null);
                                if (src) {
                                  try {
                                    const blob = await (await fetch(src)).blob();
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                    // setTimeout(() => URL.revokeObjectURL(url), 1000); // Clean up after a delay
                                  } catch (e) {
                                    console.error("Failed to open image", e);
                                  }
                                }
                              }}
                            >
                              <div className="relative">
                                <img
                                  src={msg.attachment.thumbnail || `data:${msg.attachment.mimeType};base64,${msg.attachment.data}`}
                                  className="w-full h-auto"
                                  alt="preview"
                                />
                                {msg.attachment.mimeType.startsWith('video/') && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <span className="text-white text-2xl">▶</span>
                                  </div>
                                )}
                              </div>
                              <div className="px-3 pt-2 pb-3">
                                <div className="text-slide-hover overflow-hidden whitespace-nowrap">
                                  <p className={`text-slide-inner text-xs text-[var(--text-primary)] inline-block ${msg.attachment.name && msg.attachment.name.length > 28 ? 'needs-scroll' : ''}`}>
                                    {msg.attachment.name || 'File'}
                                    {msg.attachment.name && msg.attachment.name.length > 28 && (
                                      <span className="pl-8">{msg.attachment.name}</span>
                                    )}
                                  </p>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                                  {msg.attachment.mimeType.split('/')[1]}
                                  {/* Show thumbnail size if using thumbnail/inactive, otherwise original size */}
                                  {(msg.attachment.thumbnail && !msg.attachment.data)
                                    ? ` • ${formatFileSize(Math.round(msg.attachment.thumbnail.length * 0.75))} (thumb)`
                                    : (msg.attachment.size && ` • ${formatFileSize(msg.attachment.size)}`)
                                  }
                                  {msg.attachment.duration && ` • ${formatDuration(msg.attachment.duration)}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Non-visual files (PDF, audio, docs) - compact bubble */
                          <div className="flex items-center gap-2 mb-2">
                            {/* Inactive indicator (Danger Icon) for persisted files with no data */}
                            {msg.attachment.isActive === false && (
                              <div className="flex-shrink-0 text-[var(--error-text)] opacity-60" title="File data not persisted">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                            )}

                            <div
                              className={`p-2 bg-[var(--bg-primary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl shadow-lg flex items-center gap-3 max-w-[280px] ${msg.attachment.isActive === false ? 'opacity-50 grayscale' : ''} ${msg.attachment.data ? 'cursor-pointer' : ''}`}
                              onClick={async () => {
                                if (msg.attachment?.data) {
                                  try {
                                    const src = `data:${msg.attachment.mimeType};base64,${msg.attachment.data}`;
                                    const blob = await (await fetch(src)).blob();
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                  } catch (e) {
                                    console.error("Failed to open file", e);
                                  }
                                } else if (msg.attachment.isActive === false) {
                                  toast.info('File not found in context (cleaned up).');
                                }
                              }}
                            >
                              <div className="w-12 h-12 rounded-lg bg-[var(--bg-secondary)] overflow-hidden flex items-center justify-center flex-shrink-0">
                                <span className="text-xl">{getFileTypeIcon(msg.attachment.mimeType)}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-slide-hover overflow-hidden whitespace-nowrap">
                                  <p className={`text-slide-inner text-xs text-[var(--text-primary)] inline-block ${msg.attachment.name && msg.attachment.name.length > 28 ? 'needs-scroll' : ''}`}>
                                    {msg.attachment.name || 'File'}
                                    {msg.attachment.name && msg.attachment.name.length > 28 && (
                                      <span className="pl-8">{msg.attachment.name}</span>
                                    )}
                                  </p>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                                  {msg.attachment.mimeType.split('/')[1]}
                                  {msg.attachment.size && ` • ${formatFileSize(msg.attachment.size)}`}
                                  {msg.attachment.duration && ` • ${formatDuration(msg.attachment.duration)}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {msg.content && (
                      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2rem] px-8 py-5 text-[17px] text-[var(--text-primary)] leading-relaxed shadow-lg break-words hyphens-auto whitespace-pre-wrap transition-all duration-500">
                        {msg.content}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Model Message */
                  <div className="w-full text-[var(--text-primary)] pl-4 md:pl-0">
                    <div className="flex items-center gap-3 mb-4 opacity-30">
                      <div className="h-[1px] w-8 bg-[var(--text-primary)]"></div>
                      <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-primary)]">Response</span>
                    </div>
                    <div className="prose-container break-words hyphens-auto">
                      <Suspense fallback={
                        <div className="space-y-3 animate-pulse">
                          <div className="h-4 bg-[var(--bg-secondary)] rounded w-3/4"></div>
                          <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/2"></div>
                          <div className="h-4 bg-[var(--bg-secondary)] rounded w-5/6"></div>
                        </div>
                      }>
                        <MarkdownRenderer content={msg.content} />
                      </Suspense>
                    </div>
                  </div>
                )}
              </div>
            ))}

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
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 pointer-events-none z-20">
        <div className="max-w-3xl mx-auto pointer-events-auto">

          <div className="relative group">

            {/* Attachment Preview - Glass Panel popping up */}
            {attachment && (
              <div className="absolute bottom-full left-0 mb-4 p-2 bg-[var(--bg-primary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-up">
                <div className="w-12 h-12 rounded-lg bg-[var(--bg-secondary)] overflow-hidden flex items-center justify-center">
                  {attachment.thumbnail ? (
                    <img src={attachment.thumbnail} className="w-full h-full object-cover" alt="preview" />
                  ) : attachment.mimeType.startsWith('image/') && attachment.data ? (
                    <img src={`data:${attachment.mimeType};base64,${attachment.data}`} className="w-full h-full object-cover" alt="preview" />
                  ) : (
                    <span className="text-lg">{getFileTypeIcon(attachment.mimeType)}</span>
                  )}
                </div>
                <div className="pr-2">
                  <p className="text-xs text-[var(--text-primary)] max-w-[150px] truncate">{attachment.name || 'File'}</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    {attachment.mimeType.split('/')[1]}
                    {attachment.size && ` • ${formatFileSize(attachment.size)}`}
                    {attachment.duration && ` • ${formatDuration(attachment.duration)}`}
                  </p>
                </div>
                <button onClick={removeAttachment} className="p-1 hover:bg-[var(--bg-secondary)] rounded-full transition-colors duration-500">
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>
            )}

            {/* Input Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[var(--input-glow)] via-white/10 to-[var(--input-glow)] rounded-[2.5rem] blur opacity-0 group-hover:opacity-100 transition duration-1000"></div>

            <div className="relative bg-[var(--bg-primary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-[2rem] shadow-2xl overflow-hidden flex items-end p-2 transition-all duration-500 focus-within:bg-[var(--bg-primary)] focus-within:border-[var(--text-muted)]">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="m-2 p-3 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-500"
              >
                <Paperclip className="w-5 h-5 stroke-[var(--text-secondary)]" />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Input command..."
                rows={1}
                className="w-full bg-transparent text-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] px-2 py-4 focus:outline-none resize-none max-h-48"
                disabled={isLoading}
              />

              <button
                onClick={() => isLoading ? onStop() : handleSubmit()}
                disabled={(!input.trim() && !attachment && !isLoading)}
                className={`
                    m-2 p-3 rounded-full flex items-center justify-center min-w-[3rem] min-h-[3rem] transition-all duration-500
                    ${isLoading
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:scale-105 hover:shadow-[0_0_20px_var(--input-glow)]'
                    : (input.trim() || attachment) && !unavailableCode
                      ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:scale-105 hover:shadow-[0_0_20px_var(--input-glow)] active:scale-95'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed opacity-50'}
                    `}
                style={{}}
              >
                {isLoading ? (
                  <Square className="w-5 h-5 fill-current" />
                ) : (
                  <ArrowUp className="w-6 h-6 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;