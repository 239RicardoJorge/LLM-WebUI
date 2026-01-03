import React from 'react';
import { ExternalLink } from 'lucide-react';

interface ErrorDisplayProps {
    code: string;
    message?: string;
}

/**
 * ErrorDisplay - Shows error codes (429, 400, TERMS) with action links
 */
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ code, message }) => {
    // Parse URLs from error message
    const parseActionLinks = (msg: string | undefined) => {
        if (!msg) return null;

        const urlRegex = /(https?:\/\/[^\s"'()<>\[\]{}|\\^`]+)/g;
        const matches = msg.match(urlRegex);

        if (!matches) return null;

        // Clean and deduplicate URLs
        const uniqueUrls = Array.from(new Set(
            matches.map(url => {
                let clean = url.trim();
                clean = clean.replace(/[.,;?!]+$/, "");
                clean = clean.replace(/\/+$/, "");
                return clean;
            })
        )).filter(u => u.length > 0);

        return uniqueUrls;
    };

    const getErrorLabel = (errorCode: string) => {
        switch (errorCode) {
            case '429': return 'Rate Limit Exceeded';
            case 'TERMS': return 'Terms Acceptance Required';
            case '400': return 'Invalid Request';
            default: return 'Connection Failed';
        }
    };

    const getLinkLabel = (url: string) => {
        if (url.includes('docs') || url.includes('documentation')) {
            return 'View Documentation';
        } else if (url.includes('rate-limit') || url.includes('quota') || url.includes('usage') || url.includes('billing')) {
            return 'Manage Quota';
        }
        return 'View Details';
    };

    const actionLinks = parseActionLinks(message);

    return (
        <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-8xl font-bold font-mono tracking-tighter select-none text-[var(--error-text)] opacity-80">
                {code}
            </h1>

            <div className="flex flex-col gap-2">
                <p className="text-sm font-mono text-[var(--error-text)] opacity-60 tracking-[0.2em] uppercase">
                    Model Unavailable
                </p>
                <p className="text-xs font-mono text-[var(--error-text)] opacity-60 tracking-widest uppercase">
                    {getErrorLabel(code)}
                </p>
            </div>

            {actionLinks && actionLinks.length > 0 && (
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                    {actionLinks.map((url, idx) => (
                        <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-full border border-blue-400/30 bg-blue-500/5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 hover:border-blue-400/50 transition-colors duration-500 flex items-center gap-2"
                        >
                            <span>{getLinkLabel(url)}</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ErrorDisplay;
