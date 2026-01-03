import React, { useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, X, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Attachment } from '../../types';
import { validateFileSize, processAttachment, formatFileSize, getFileTypeIcon } from '../../utils/thumbnails';

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    attachments: Attachment[];
    setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
    isLoading: boolean;
    unavailableCode?: string;
    onSubmit: () => void;
    onStop: () => void;
}

/**
 * ChatInput - Floating input dock with text area, file attachments, and send button
 */
const ChatInput: React.FC<ChatInputProps> = ({
    input,
    setInput,
    attachments,
    setAttachments,
    isLoading,
    unavailableCode,
    onSubmit,
    onStop
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawFiles = e.target.files;
        if (!rawFiles || rawFiles.length === 0) return;

        const fileArray = Array.from(rawFiles);
        if (fileInputRef.current) fileInputRef.current.value = '';

        const processFile = async (file: File): Promise<Attachment | null> => {
            const validation = validateFileSize(file);
            if (!validation.valid) {
                toast.error(`${file.name}: ${validation.error}`);
                return null;
            }
            if (validation.warning) {
                toast.warning(`${file.name}: ${validation.warning}`);
            }

            try {
                const meta = await processAttachment(file);

                const base64Content = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64Data = event.target?.result as string;
                        resolve(base64Data.split(',')[1]);
                    };
                    reader.onerror = () => reject(new Error('Failed to read file'));
                    reader.readAsDataURL(file);
                });

                return {
                    mimeType: file.type || 'application/octet-stream',
                    data: base64Content,
                    name: meta.name,
                    size: meta.size,
                    thumbnail: meta.thumbnail,
                    duration: meta.duration,
                    dimensions: meta.dimensions,
                    isActive: true
                };
            } catch (error) {
                console.error('File processing error:', error);
                toast.error(`Failed to process ${file.name}.`);
                return null;
            }
        };

        const results = await Promise.allSettled(fileArray.map(processFile));

        const newAttachments: Attachment[] = [];
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                newAttachments.push(result.value);
            }
        }

        if (newAttachments.length > 0) {
            setAttachments(prev => [...prev, ...newAttachments]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 pointer-events-none z-20">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
                accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt,.md"
            />

            <div className="max-w-3xl mx-auto pointer-events-auto">
                <div className="relative group">
                    {/* Attachments Preview */}
                    {attachments.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-4 p-2 bg-[var(--bg-primary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-wrap gap-2 animate-fade-up max-h-40 overflow-y-auto max-w-full w-max">
                            {attachments.map((att, index) => (
                                <div key={index} className="flex items-center gap-2 p-1 pr-2 bg-[var(--bg-secondary)]/50 rounded-lg">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] overflow-hidden flex items-center justify-center flex-shrink-0">
                                        {att.thumbnail ? (
                                            <img src={att.thumbnail} className="w-full h-full object-cover" alt="preview" />
                                        ) : att.mimeType.startsWith('image/') && att.data ? (
                                            <img src={`data:${att.mimeType};base64,${att.data}`} className="w-full h-full object-cover" alt="preview" />
                                        ) : (
                                            <span className="text-sm">{getFileTypeIcon(att.mimeType)}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 max-w-[100px]">
                                        <p className="text-[10px] text-[var(--text-primary)] truncate">{att.name || 'File'}</p>
                                        <p className="text-[8px] text-[var(--text-muted)] uppercase">
                                            {att.mimeType.split('/')[1]}
                                            {att.size && ` • ${formatFileSize(att.size)}`}
                                        </p>
                                    </div>
                                    <button onClick={() => removeAttachment(index)} className="p-1 hover:bg-[var(--bg-secondary)] rounded-full transition-colors duration-500 flex-shrink-0">
                                        <X className="w-3 h-3 text-[var(--text-secondary)]" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Input Glow */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-[var(--input-glow)] via-white/10 to-[var(--input-glow)] rounded-[2.5rem] blur opacity-0 group-hover:opacity-100 transition duration-1000"></div>

                    <div className="relative bg-[var(--bg-primary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-[2rem] shadow-2xl overflow-hidden flex items-end p-2 transition-all duration-500 focus-within:bg-[var(--bg-primary)] focus-within:border-[var(--text-muted)]">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="m-2 p-3 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-500 relative"
                        >
                            <Paperclip className="w-5 h-5 stroke-[var(--text-secondary)] transition-[stroke] duration-500" />
                            {attachments.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-[10px] font-bold flex items-center justify-center">
                                    {attachments.length}
                                </span>
                            )}
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
                            onClick={() => isLoading ? onStop() : onSubmit()}
                            disabled={(!input.trim() && attachments.length === 0 && !isLoading)}
                            className={`
                  m-2 p-3 rounded-full flex items-center justify-center min-w-[3rem] min-h-[3rem] transition-[background-color,color,opacity,box-shadow] duration-500
                  ${isLoading
                                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:scale-105 hover:shadow-[0_0_20px_var(--input-glow)]'
                                    : (input.trim() || attachments.length > 0) && !unavailableCode
                                        ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:scale-105 hover:shadow-[0_0_20px_var(--input-glow)] active:scale-95'
                                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed opacity-50'}
                  `}
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
    );
};

export default ChatInput;
