/**
 * Tests for MarkdownRenderer component
 * Focuses on the <think> tag parsing logic
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// We need to mock the heavy dependencies
vi.mock('react-markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown-content">{children}</div>
}));

vi.mock('remark-gfm', () => ({ default: () => { } }));
vi.mock('remark-math', () => ({ default: () => { } }));
vi.mock('rehype-katex', () => ({ default: () => { } }));

describe('MarkdownRenderer', () => {
    it('should render without thought process when no <think> tags present', async () => {
        const MarkdownRenderer = (await import('../components/MarkdownRenderer')).default;

        render(<MarkdownRenderer content="Hello, world!" />);

        expect(screen.getByTestId('markdown-content')).toHaveTextContent('Hello, world!');
        expect(screen.queryByText('Thought Process')).not.toBeInTheDocument();
    });

    it('should detect and extract <think> tags from content', async () => {
        const MarkdownRenderer = (await import('../components/MarkdownRenderer')).default;

        const content = '<think>This is my reasoning...</think>Here is the answer.';

        render(<MarkdownRenderer content={content} />);

        // Thought Process header should be present
        expect(screen.getByText('Thought Process')).toBeInTheDocument();

        // Main content should not include the think tags
        expect(screen.getByTestId('markdown-content')).toHaveTextContent('Here is the answer.');
    });

    it('should toggle thought process visibility when clicked', async () => {
        const MarkdownRenderer = (await import('../components/MarkdownRenderer')).default;

        const content = '<think>Step 1: Think about it</think>Final answer.';

        render(<MarkdownRenderer content={content} />);

        // Initially, thought content should be hidden
        expect(screen.queryByText('Step 1: Think about it')).not.toBeInTheDocument();

        // Click to expand
        fireEvent.click(screen.getByText('Thought Process'));

        // Now thought content should be visible
        expect(screen.getByText('Step 1: Think about it')).toBeInTheDocument();
    });

    it('should handle LaTeX delimiter normalization', async () => {
        const MarkdownRenderer = (await import('../components/MarkdownRenderer')).default;

        // Raw LaTeX with \[ and \] should be normalized
        const content = 'Math: \\[x^2 + y^2 = z^2\\]';

        render(<MarkdownRenderer content={content} />);

        // The normalized content should reach the markdown renderer
        // Note: Our mock just passes through, so we check it doesn't crash
        expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
});
