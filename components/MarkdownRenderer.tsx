import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert prose-lg max-w-none text-gray-200">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          code({node, inline, className, children, ...props}: any) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <div className="my-6 rounded-2xl overflow-hidden border border-white/10 bg-black/50 shadow-2xl">
                <div className="flex items-center px-4 py-3 border-b border-white/5 bg-white/5">
                    <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">{match[1]}</span>
                </div>
                <div className="p-6 overflow-x-auto">
                  <code className={`${className} text-[14px] font-mono leading-relaxed text-blue-100`} {...props}>
                    {children}
                  </code>
                </div>
              </div>
            ) : (
              <code className="bg-white/10 text-white px-2 py-0.5 rounded-md text-[0.9em] font-medium border border-white/5" {...props}>
                {children}
              </code>
            )
          },
          p: ({children}) => <p className="mb-6 last:mb-0 leading-8 text-[17px] font-light tracking-wide text-gray-300">{children}</p>,
          ul: ({children}) => <ul className="list-disc pl-4 mb-6 space-y-2 text-gray-300 marker:text-gray-600">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal pl-4 mb-6 space-y-2 text-gray-300 marker:text-gray-600">{children}</ol>,
          a: ({href, children}) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-white border-b border-white/30 hover:border-white pb-0.5 transition-colors">
              {children}
            </a>
          ),
          blockquote: ({children}) => (
            <blockquote className="border-l border-white/30 pl-6 italic text-gray-400 my-8">
              {children}
            </blockquote>
          ),
          h1: ({children}) => <h1 className="text-3xl font-semibold mb-6 mt-8 text-white tracking-tight">{children}</h1>,
          h2: ({children}) => <h2 className="text-2xl font-semibold mb-4 mt-8 text-white tracking-tight">{children}</h2>,
          h3: ({children}) => <h3 className="text-xl font-medium mb-3 mt-6 text-white tracking-tight">{children}</h3>,
          strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;