import React from 'react';
import { AlertTriangle, Maximize2 } from 'lucide-react';
import { ChatMessage, Attachment } from '../../types';
import MediaStack from '../MediaStack';
import ErrorBoundary from '../ErrorBoundary';
import { formatFileSize, formatDuration, getFileTypeIcon } from '../../utils/thumbnails';

interface UserMessageProps {
    message: ChatMessage;
    onOpenAttachment: (mimeType: string, data?: string, thumbnail?: string) => void;
    onOpenFileAttachment: (attachment: Attachment) => void;
}

/**
 * UserMessage - Renders a user message bubble with attachments
 */
const UserMessage: React.FC<UserMessageProps> = ({
    message,
    onOpenAttachment,
    onOpenFileAttachment
}) => {
    // Get attachments from message
    const getMessageAttachments = (msg: ChatMessage): Attachment[] => {
        return msg.attachments || [];
    };

    const allAtts = getMessageAttachments(message);
    const visualAtts = allAtts.filter(a => a.mimeType.startsWith('image/') || a.mimeType.startsWith('video/'));
    const otherAtts = allAtts.filter(a => !a.mimeType.startsWith('image/') && !a.mimeType.startsWith('video/'));

    return (
        <div className="flex flex-col items-end max-w-[80%] gap-6">
            {allAtts.length > 0 && (
                <div className="flex flex-col gap-6 items-end">
                    {/* Visual attachments section */}
                    {visualAtts.length > 0 && (
                        <div className="flex flex-col gap-6 items-end">
                            {/* Visual Stack for > 1 items */}
                            {visualAtts.length > 1 && (
                                <ErrorBoundary fallback={
                                    <div className="p-2 text-xs text-orange-400">Failed to load media</div>
                                }>
                                    <MediaStack
                                        attachments={visualAtts}
                                        onOpen={(att) => onOpenAttachment(att.mimeType, att.data, att.thumbnail)}
                                        messageId={message.id}
                                    />
                                </ErrorBoundary>
                            )}

                            {/* Individual Visual Item if exactly 1 */}
                            {visualAtts.length === 1 && visualAtts.map((att, attIdx) => {
                                const hasData = !!att.data;
                                const showOriginal = hasData;

                                const imgSrc = showOriginal
                                    ? `data:${att.mimeType};base64,${att.data}`
                                    : (att.thumbnail || '');

                                const ext = att.mimeType.split('/')[1]?.toUpperCase() || 'FILE';
                                let sizeStr = '';
                                if (showOriginal) {
                                    sizeStr = formatFileSize(att.size || 0);
                                } else {
                                    const src = att.thumbnail || '';
                                    const base64Content = src.split(',')[1] || '';
                                    const byteSize = base64Content ? Math.round((base64Content.length * 3) / 4) : 0;
                                    const finalSize = byteSize || (att.size || 0);
                                    sizeStr = `${formatFileSize(finalSize)} (THUMB)`;
                                }

                                const nameNeedsScroll = att.name && att.name.length > 20;

                                return (
                                    <div key={`vis-${attIdx}`}
                                        className="w-48 h-auto flex flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-lg overflow-hidden cursor-pointer transition-[transform,shadow] duration-500 group/footer hover:shadow-2xl"
                                    >
                                        {/* Image Area - Fixed height like MediaStack */}
                                        <div className="relative w-full h-40 overflow-hidden">
                                            <img
                                                src={imgSrc}
                                                className="w-full h-full object-cover"
                                                alt="preview"
                                            />
                                            {att.mimeType.startsWith('video/') && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                    <div className="p-1.5 bg-white/20 backdrop-blur-md rounded-full">
                                                        <svg className="w-4 h-4 text-white fill-white" viewBox="0 0 24 24">
                                                            <polygon points="5,3 19,12 5,21" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* Footer / Description Area */}
                                        <div className="px-3 pt-2 pb-3 bg-[var(--bg-primary)] flex items-center justify-between gap-2">
                                            <div className="min-w-0 flex-1 overflow-hidden relative">
                                                <div className="text-slide-hover w-full">
                                                    <span className={`text-slide-inner text-xs font-medium text-[var(--text-primary)] leading-tight ${nameNeedsScroll ? 'needs-scroll' : ''}`}>
                                                        {att.name || 'File'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                                                    {`${ext} • ${sizeStr}`}
                                                    {att.duration && ` • ${formatDuration(att.duration)}`}
                                                </p>
                                            </div>
                                            <button
                                                className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors duration-500 text-[var(--text-primary)]"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onOpenAttachment(att.mimeType, att.data, att.thumbnail);
                                                }}
                                                title="Open Fullscreen"
                                            >
                                                <Maximize2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Non-visual files section */}
                    {otherAtts.length > 0 && (
                        <div className="flex flex-col gap-6 items-end">
                            {otherAtts.map((att, attIdx) => (
                                <div key={`file-${attIdx}`} className="flex items-center gap-2">
                                    {att.isActive === false && (
                                        <div className="flex-shrink-0 text-[var(--error-text)] opacity-60" title="File data not persisted">
                                            <AlertTriangle className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div
                                        className={`p-2 border border-[var(--border-color)] rounded-2xl shadow-lg flex items-center gap-3 max-w-[280px] ${att.isActive === false ? 'opacity-50 grayscale' : 'bg-[var(--bg-primary)] backdrop-blur-2xl'} ${att.data ? 'cursor-pointer' : ''}`}
                                        onClick={() => onOpenFileAttachment(att)}
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-[var(--bg-secondary)] overflow-hidden flex items-center justify-center flex-shrink-0">
                                            <span className="text-xl">{getFileTypeIcon(att.mimeType)}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-slide-hover overflow-hidden whitespace-nowrap">
                                                <p className={`text-slide-inner text-xs text-[var(--text-primary)] inline-block ${att.name && att.name.length > 28 ? 'needs-scroll' : ''}`}>
                                                    {att.name || 'File'}
                                                    {att.name && att.name.length > 28 && (
                                                        <span className="pl-8">{att.name}</span>
                                                    )}
                                                </p>
                                            </div>
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                                                {att.mimeType.split('/')[1]}
                                                {att.size && ` • ${formatFileSize(att.size)}`}
                                                {att.duration && ` • ${formatDuration(att.duration)}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {message.content && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2rem] px-8 py-5 text-[17px] text-[var(--text-primary)] leading-relaxed shadow-lg break-words hyphens-auto whitespace-pre-wrap transition-all duration-500">
                    {message.content}
                </div>
            )}
        </div>
    );
};

export default UserMessage;
