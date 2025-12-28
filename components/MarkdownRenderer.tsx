import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface MarkdownRendererProps {
  content: string;
}

const CodeBlock = ({ language, children, className, ...props }: any) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    const textToCopy = String(children).replace(/\n$/, '');
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code to clipboard');
    }
  };

  return (
    <div className="my-6 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl group">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-glass)]">
        <span className="text-xs font-bold tracking-widest text-[var(--text-muted)] uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-[10px] font-medium tracking-wider uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-md hover:bg-[var(--bg-glass)]"
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400 font-bold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-6 overflow-x-auto">
        <code className={`${className} text-[14px] font-mono leading-relaxed text-[var(--text-primary)]`} {...props}>
          {children}
        </code>
      </div>
    </div>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-lg max-w-none text-[var(--text-primary)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <CodeBlock language={match[1]} className={className} {...props}>
                {children}
              </CodeBlock>
            ) : (
              <code className="bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-0.5 rounded-md text-[0.9em] font-medium border border-[var(--border-color)]" {...props}>
                {children}
              </code>
            )
          },
          p: ({ children }) => <p className="mb-6 last:mb-0 leading-8 text-[17px] font-light tracking-wide text-[var(--text-primary)]">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-6 space-y-2 text-[var(--text-primary)] marker:text-[var(--text-muted)]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-6 space-y-2 text-[var(--text-primary)] marker:text-[var(--text-muted)]">{children}</ol>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] border-b border-[var(--text-muted)] hover:border-[var(--text-primary)] pb-0.5 transition-colors">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l border-[var(--text-muted)] pl-6 italic text-[var(--text-secondary)] my-8">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => <h1 className="text-3xl font-semibold mb-6 mt-8 text-[var(--text-primary)] tracking-tight">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-semibold mb-4 mt-8 text-[var(--text-primary)] tracking-tight">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-medium mb-3 mt-6 text-[var(--text-primary)] tracking-tight">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;