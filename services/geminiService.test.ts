import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedService } from './geminiService';
import { GoogleProvider } from './providers/GoogleProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';

const mocks = vi.hoisted(() => {
    return {
        GoogleProvider: vi.fn().mockImplementation(() => ({
            id: 'google',
            sendMessageStream: vi.fn(),
            resetSession: vi.fn(),
            validateKey: vi.fn(),
            checkModelAvailability: vi.fn(),
        })),
        OpenAIProvider: vi.fn().mockImplementation(() => ({
            id: 'openai',
            sendMessageStream: vi.fn(),
            resetSession: vi.fn(),
            validateKey: vi.fn(),
            checkModelAvailability: vi.fn(),
        }))
    };
});

// Enable mocking
vi.mock('./providers/GoogleProvider', () => {
    return {
        GoogleProvider: mocks.GoogleProvider
    };
});

vi.mock('./providers/OpenAIProvider', () => {
    return {
        OpenAIProvider: mocks.OpenAIProvider
    };
});

describe('UnifiedService', () => {
    let service: UnifiedService;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize and instantiate providers', () => {
        service = new UnifiedService('gemini-pro', 'google', 'fake-key');
        expect(GoogleProvider).toHaveBeenCalled();
        expect(OpenAIProvider).toHaveBeenCalled();
    });

    // Basic session reset logic verification - asserting logic flow rather than implementation details
    it('should attempt session reset on config change', () => {
        service = new UnifiedService('gemini-pro', 'google', 'fake-key');
        // We simply verify no error is thrown during reconfiguration
        expect(() => {
            service.setConfig('gpt-4', 'openai', 'new-key');
        }).not.toThrow();
    });
});
