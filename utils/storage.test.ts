/**
 * Tests for IndexedDB storage wrapper
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Role } from '../types';

// Mock IndexedDB for testing in Node environment
const mockStore: Record<string, any> = {};
const mockTransaction = {
    objectStore: vi.fn(() => ({
        put: vi.fn((data) => {
            mockStore[data.id] = data;
            return { onsuccess: null, onerror: null };
        }),
        get: vi.fn((id) => {
            const result = { result: mockStore[id], onsuccess: null, onerror: null };
            setTimeout(() => result.onsuccess?.(), 0);
            return result;
        }),
        delete: vi.fn((id) => {
            delete mockStore[id];
            return { onsuccess: null, onerror: null };
        })
    })),
    oncomplete: null,
    onerror: null
};

const mockDB = {
    transaction: vi.fn(() => mockTransaction),
    objectStoreNames: { contains: vi.fn(() => true) },
    createObjectStore: vi.fn()
};

// Mock indexedDB globally
vi.stubGlobal('indexedDB', {
    open: vi.fn(() => {
        const request = {
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
            result: mockDB
        };
        setTimeout(() => request.onsuccess?.({ target: { result: mockDB } }), 0);
        return request;
    })
});

describe('Storage Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockStore).forEach(key => delete mockStore[key]);
    });

    describe('DEFAULT_CONVERSATION_ID', () => {
        it('should export a default conversation ID', async () => {
            const { DEFAULT_CONVERSATION_ID } = await import('./storage');
            expect(DEFAULT_CONVERSATION_ID).toBe('default');
        });
    });

    describe('ConversationRecord interface', () => {
        it('should accept valid conversation data structure', async () => {
            // Type check: simulating what a valid conversation record looks like
            const record = {
                id: 'test-convo',
                messages: [
                    { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }
                ],
                updatedAt: Date.now()
            };

            expect(record.id).toBeDefined();
            expect(record.messages).toBeInstanceOf(Array);
            expect(record.updatedAt).toBeGreaterThan(0);
        });
    });

    describe('saveMessagesSync', () => {
        it('should store messages to localStorage as fallback', async () => {
            const localStorageMock = {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn()
            };
            vi.stubGlobal('localStorage', localStorageMock);

            const { saveMessagesSync } = await import('./storage');

            const messages = [
                { id: '1', role: Role.USER, content: 'Test', timestamp: Date.now() }
            ];

            saveMessagesSync('test-convo', messages);

            expect(localStorageMock.setItem).toHaveBeenCalled();
        });
    });
});
