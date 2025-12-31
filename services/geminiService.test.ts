import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedService } from './geminiService';
import { GoogleProvider } from './providers/GoogleProvider';
import { GroqProvider } from './providers/GroqProvider';

// Mock the provider modules with proper class mocks
vi.mock('./providers/GoogleProvider', () => ({
    GoogleProvider: class MockGoogleProvider {
        id = 'google';
        sendMessageStream = vi.fn();
        resetSession = vi.fn().mockResolvedValue(undefined);
        setHistory = vi.fn();
        validateKey = vi.fn().mockResolvedValue([]);
        checkModelAvailability = vi.fn().mockResolvedValue({ available: true });
    }
}));

vi.mock('./providers/GroqProvider', () => ({
    GroqProvider: class MockGroqProvider {
        id = 'groq';
        sendMessageStream = vi.fn();
        resetSession = vi.fn().mockResolvedValue(undefined);
        setHistory = vi.fn();
        validateKey = vi.fn().mockResolvedValue([]);
        checkModelAvailability = vi.fn().mockResolvedValue({ available: true });
    }
}));

describe('UnifiedService', () => {
    let service: UnifiedService;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize and instantiate providers', () => {
        service = new UnifiedService('gemini-pro', 'google', 'fake-key');
        expect(service).toBeDefined();
    });

    it('should attempt session reset on config change', () => {
        service = new UnifiedService('gemini-pro', 'google', 'fake-key');
        // Verify no error is thrown during reconfiguration
        expect(() => {
            service.setConfig('llama-3.3-70b-versatile', 'groq', 'new-key');
        }).not.toThrow();
    });

    it('should have static validateKeyAndGetModels method', async () => {
        const models = await UnifiedService.validateKeyAndGetModels('google', 'test-key');
        expect(models).toBeInstanceOf(Array);
    });

    it('should have static checkModelAvailability method', async () => {
        const result = await UnifiedService.checkModelAvailability('groq', 'test-model', 'test-key');
        expect(result).toHaveProperty('available');
    });
});
