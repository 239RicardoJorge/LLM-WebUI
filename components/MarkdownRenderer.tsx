import React, { useState, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface MarkdownRendererProps {
  content: string;
}

interface CodeBlockProps {
  language: string;
  children: ReactNode;
  className?: string;
}

const CodeBlock = ({ language, children, className, ...props }: CodeBlockProps) => {
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
    <div className="my-6 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl group transition-all duration-500">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-glass)]">
        <span className="text-xs font-bold tracking-widest text-[var(--text-muted)] uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-[10px] font-medium tracking-wider uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md hover:bg-[var(--bg-glass)]"
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

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content }) => {
  // Parse for <think> tags (Common in DeepSeek/CoT models)
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  const thought = thinkMatch ? thinkMatch[1].trim() : null;
  const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);

  const components = React.useMemo(() => ({
    code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: ReactNode }) {
      const match = /language-(\w+)/.exec(className || '')
      return !inline && match ? (
        <CodeBlock language={match[1]} className={className} {...props}>
          {children}
        </CodeBlock>
      ) : (
        <code className="bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-0.5 rounded-md text-[0.9em] font-medium border border-[var(--border-color)] transition-all duration-500" {...props}>
          {children}
        </code>
      )
    },
    p: ({ children }: { children?: ReactNode }) => <p className="mb-6 last:mb-0 leading-8 text-[17px] font-light tracking-wide text-[var(--text-primary)] transition-colors duration-500">{children}</p>,
    ul: ({ children }: { children?: ReactNode }) => <ul className="list-disc pl-4 mb-6 space-y-2 text-[var(--text-primary)] marker:text-[var(--text-muted)]">{children}</ul>,
    ol: ({ children }: { children?: ReactNode }) => <ol className="list-decimal pl-4 mb-6 space-y-2 text-[var(--text-primary)] marker:text-[var(--text-muted)]">{children}</ol>,
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] border-b border-[var(--text-muted)] hover:border-[var(--text-primary)] pb-0.5">
        {children}
      </a>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="border-l border-[var(--text-muted)] pl-6 italic text-[var(--text-secondary)] my-8 transition-colors duration-500">
        {children}
      </blockquote>
    ),
    h1: ({ children }: { children?: ReactNode }) => <h1 className="text-3xl font-semibold mb-6 mt-8 text-[var(--text-primary)] tracking-tight transition-colors duration-500">{children}</h1>,
    h2: ({ children }: { children?: ReactNode }) => <h2 className="text-2xl font-semibold mb-4 mt-8 text-[var(--text-primary)] tracking-tight transition-colors duration-500">{children}</h2>,
    h3: ({ children }: { children?: ReactNode }) => <h3 className="text-xl font-medium mb-3 mt-6 text-[var(--text-primary)] tracking-tight transition-colors duration-500">{children}</h3>,
    strong: ({ children }: { children?: ReactNode }) => <strong className="font-semibold text-[var(--text-primary)] transition-colors duration-500">{children}</strong>
  }), []);

  return (
    <div className="prose prose-lg max-w-none text-[var(--text-primary)]">
      {thought && (
        <div className="mb-6 group">
          <button
            onClick={() => setIsThinkingOpen(!isThinkingOpen)}
            className="flex items-center gap-3 opacity-30 cursor-pointer w-full pl-4 select-none"
          >
            <div className="h-[1px] w-4 bg-[var(--text-primary)]"></div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-primary)]">Thought Process</span>
            {isThinkingOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {isThinkingOpen && (
            <div className="ml-4 pl-6 border-l border-[var(--text-primary)] text-sm text-[var(--text-primary)] italic leading-relaxed whitespace-pre-wrap animate-fade-in opacity-30 pt-2 pb-2">
              {thought}
            </div>
          )}
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {
          (cleanContent || content)
            .replace(/\\\[/g, '$$$$') // Replace \[ with $$ (for block math)
            .replace(/\\\]/g, '$$$$') // Replace \] with $$ 
            .replace(/\\\(/g, '$$')   // Replace \( with $  (for inline math)
            .replace(/\\\)/g, '$$')   // Replace \) with $
        }
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;