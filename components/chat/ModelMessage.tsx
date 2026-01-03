import React, { Suspense } from 'react';
import ErrorBoundary from '../ErrorBoundary';

// Lazy load MarkdownRenderer to split heavy dependencies
const MarkdownRenderer = React.lazy(() => import('../MarkdownRenderer'));

interface ModelMessageProps {
    content: string;
}

/**
 * ModelMessage - Renders model response with markdown formatting
 */
const ModelMessage: React.FC<ModelMessageProps> = ({ content }) => {
    return (
        <div className="w-full text-[var(--text-primary)] pl-4 md:pl-0">
            <div className="flex items-center gap-3 mb-4 opacity-30">
                <div className="h-[1px] w-8 bg-[var(--text-primary)]"></div>
                <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-primary)]">Response</span>
            </div>
            <div className="prose-container break-words hyphens-auto">
                <ErrorBoundary fallback={
                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm">
                        <p>Failed to render message content</p>
                    </div>
                }>
                    <Suspense fallback={
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-[var(--bg-secondary)] rounded w-3/4"></div>
                            <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/2"></div>
                            <div className="h-4 bg-[var(--bg-secondary)] rounded w-5/6"></div>
                        </div>
                    }>
                        <MarkdownRenderer content={content} />
                    </Suspense>
                </ErrorBoundary>
            </div>
        </div>
    );
};

export default ModelMessage;
