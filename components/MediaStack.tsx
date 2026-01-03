import React, { useState, useEffect, useRef } from 'react';
import { Play, Maximize2 } from 'lucide-react';
import { Attachment } from '../types';
import { formatFileSize } from '../utils/thumbnails';

interface MediaStackProps {
    attachments: Attachment[];
    onOpen: (att: Attachment) => void;
    align?: 'left' | 'right';
    messageId?: string; // Optional: used for persistence key
}

const MarqueeText: React.FC<{ text: string }> = ({ text }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [needsScroll, setNeedsScroll] = useState(false);

    useEffect(() => {
        if (containerRef.current && textRef.current) {
            setNeedsScroll(textRef.current.scrollWidth > containerRef.current.clientWidth);
        }
    }, [text]);

    return (
        <div ref={containerRef} className="text-slide-hover w-full">
            <span
                ref={textRef}
                className={`text-slide-inner text-xs font-medium text-[var(--text-primary)] leading-tight ${needsScroll ? 'needs-scroll' : ''}`}
            >
                {text}
            </span>
        </div>
    );
};

// Generate a stable key for stack order persistence
const getStackKey = (messageId?: string, attachments?: Attachment[]) => {
    if (messageId) return `ccs_stack_order_${messageId}`;
    // Fallback: use first attachment names concatenated
    if (attachments && attachments.length > 0) {
        const names = attachments.map(a => a.name || '').join('_');
        return `ccs_stack_order_${names.slice(0, 50)}`;
    }
    return null;
};

const MediaStack: React.FC<MediaStackProps> = ({ attachments, onOpen, align = 'right', messageId }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [stackItems, setStackItems] = useState<Attachment[]>([]);
    const [initialized, setInitialized] = useState(false);

    // Generate persistent key for this stack
    const stackKey = getStackKey(messageId, attachments);

    useEffect(() => {
        const visuals = attachments.filter(att =>
            att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/')
        );

        if (visuals.length === 0) {
            setStackItems([]);
            setInitialized(true);
            return;
        }

        // On first load, try to restore order from localStorage
        if (!initialized && stackKey) {
            try {
                const saved = localStorage.getItem(stackKey);
                if (saved) {
                    const savedOrder: string[] = JSON.parse(saved);
                    // Reorder visuals according to saved order (by name)
                    const ordered = [...visuals].sort((a, b) => {
                        const aIdx = savedOrder.indexOf(a.name || '');
                        const bIdx = savedOrder.indexOf(b.name || '');
                        if (aIdx === -1 && bIdx === -1) return 0;
                        if (aIdx === -1) return -1;
                        if (bIdx === -1) return 1;
                        return aIdx - bIdx;
                    });
                    setStackItems(ordered);
                    setInitialized(true);
                    return;
                }
            } catch {
                // Ignore parse errors
            }
        }

        // Fallback: if lengths differ, reset to incoming order
        if (visuals.length !== stackItems.length) {
            setStackItems(visuals);
        }
        setInitialized(true);
    }, [attachments, stackItems.length, initialized, stackKey]);

    if (stackItems.length === 0) return null;

    const handleCardClick = (clickedAtt: Attachment) => {
        // Reorder and persist
        setStackItems(prev => {
            const others = prev.filter(p => p !== clickedAtt);
            const newOrder = [...others, clickedAtt];

            // Persist new order to localStorage
            if (stackKey) {
                try {
                    const orderNames = newOrder.map(a => a.name || '');
                    localStorage.setItem(stackKey, JSON.stringify(orderNames));
                } catch {
                    // Ignore storage errors
                }
            }

            return newOrder;
        });
    };

    // Dynamic height: base card height (208px) + offset per additional item (3px each)
    // Plus some padding for the stack effect
    const baseHeight = 208; // h-40 (160px) + footer (~48px)
    const stackPadding = Math.max(0, (stackItems.length - 1) * 6); // Extra space for stacked cards
    const containerHeight = baseHeight + stackPadding;

    return (
        <div
            className={`relative w-[300px] select-none ${align === 'right' ? 'ml-auto' : 'mr-auto'}`}
            style={{ height: `${containerHeight}px` }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {stackItems.map((att, index) => {
                const total = stackItems.length;
                const isTopCard = index === total - 1;

                const hasData = !!att.data;
                // Show original ONLY if we actually have the full base64 data in memory
                // After page reload, data is stripped but thumbnail remains
                const showOriginal = hasData;

                const imgSrc = showOriginal
                    ? `data:${att.mimeType};base64,${att.data}`
                    : (att.thumbnail || '');


                const stackOffset = index * 3;
                const centerIdx = (total - 1) / 2;
                let rotate = 0;
                let x = 0;
                let y = 0;

                if (isHovered) {
                    rotate = (index - centerIdx) * 10;
                    y = Math.abs(index - centerIdx) * 5;
                    x = align === 'right' ? -((total - 1 - index) * 40) : index * 40;
                } else {
                    if (isTopCard) {
                        rotate = 0;
                    } else {
                        rotate = ((index % 2 === 0 ? 1 : -1) * (2 + index));
                    }
                    x = align === 'right' ? -stackOffset : stackOffset;
                    y = stackOffset;
                }

                const style: React.CSSProperties = {
                    zIndex: index,
                    transform: `translateX(${x}px) translateY(${y}px) rotate(${rotate}deg)`,
                    transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    [align]: 0,
                };

                return (
                    <div
                        key={att.name + att.size}
                        className={`
              absolute top-0 w-48 h-auto flex flex-col
              rounded-2xl border border-[var(--border-color)]
              bg-[var(--bg-primary)] shadow-lg overflow-hidden cursor-pointer
              transition-[transform,shadow] duration-500 group/footer
              ${isTopCard ? 'shadow-lg' : 'hover:shadow-2xl'}
            `}
                        style={style}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCardClick(att);
                        }}
                    >
                        {/* Image Area */}
                        <div className="relative w-full h-40 overflow-hidden">
                            <img
                                src={imgSrc}
                                alt={att.name}
                                className="w-full h-full object-cover"
                            />
                            {att.mimeType.startsWith('video/') && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <div className="p-1.5 bg-white/20 backdrop-blur-md rounded-full">
                                        <Play className="w-4 h-4 text-white fill-white" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer / Description Area - Solid BG for stack clarity */}
                        <div className="px-3 pt-2 pb-3 bg-[var(--bg-primary)] flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 overflow-hidden relative">
                                <div className="w-full overflow-hidden">
                                    <MarqueeText text={att.name || 'File'} />
                                </div>

                                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                                    {(() => {
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
                                        return `${ext} • ${sizeStr}`;
                                    })()}
                                </p>
                            </div>

                            <button
                                className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors duration-500 text-[var(--text-primary)]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpen(att);
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
    );
};

export default MediaStack;

