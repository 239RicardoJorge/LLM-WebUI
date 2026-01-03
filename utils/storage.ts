/**
 * IndexedDB Storage Wrapper for CCS
 * 
 * Provides async storage for conversations (large data)
 * while localStorage is still used for small settings
 */

const DB_NAME = 'ccs_storage';
const DB_VERSION = 1;
const STORE_CONVERSATIONS = 'conversations';

// Default conversation ID (for now, single conversation)
export const DEFAULT_CONVERSATION_ID = 'default';

import { ChatMessage, Attachment } from '../types';

interface ConversationRecord {
    id: string;
    messages: ChatMessage[];
    updatedAt: number;
}

/**
 * Strip attachment data for storage.
 * Images keep isActive:true (have displayable thumbnail).
 * Other files get isActive:false (no displayable content after data stripped).
 */
const stripAttachmentData = (attachment: Attachment): Attachment => {
    const { data, ...attachmentMeta } = attachment;
    return {
        ...attachmentMeta,
        isActive: attachment.mimeType.startsWith('image/')
    };
};

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize and get the IndexedDB instance
 */
const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create conversations store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
                db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });
            }
        };
    });
};

/**
 * Save messages for a conversation
 * Note: Strips attachment.data (base64 content) to keep storage small
 * Only thumbnails and metadata are persisted
 */
export const saveMessages = async (conversationId: string, messages: ChatMessage[]): Promise<void> => {
    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_CONVERSATIONS, 'readwrite');
        const store = transaction.objectStore(STORE_CONVERSATIONS);

        // Strip attachment data before saving (only keep thumbnail + metadata)
        const messagesForStorage = messages.map(msg => {
            let result = { ...msg };

            // Handle new attachments array
            if (msg.attachments && Array.isArray(msg.attachments)) {
                result.attachments = msg.attachments.map(stripAttachmentData);
            }

            // Handle legacy single attachment
            if (msg.attachment) {
                result.attachment = stripAttachmentData(msg.attachment);
            }

            return result;
        });

        const record: ConversationRecord = {
            id: conversationId,
            messages: messagesForStorage,
            updatedAt: Date.now()
        };

        store.put(record);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        // Fallback to localStorage (also strip data using the same helper)
        const stripFallback = (attachment: Attachment): Attachment => {
            if (attachment.mimeType.startsWith('image/')) {
                const { data, ...meta } = attachment;
                return { ...meta, isActive: true };
            } else {
                const { data, ...meta } = attachment;
                return { ...meta, isActive: false };
            }
        };

        const stripped = messages.map(msg => {
            let result = { ...msg };

            if (msg.attachments && Array.isArray(msg.attachments)) {
                result.attachments = msg.attachments.map(stripFallback);
            }

            if (msg.attachment) {
                result.attachment = stripFallback(msg.attachment);
            }

            return result;
        });
        localStorage.setItem(`ccs_messages_${conversationId}`, JSON.stringify(stripped));
    }
};

/**
 * Load messages for a conversation
 */
export const loadMessages = async (conversationId: string): Promise<ChatMessage[]> => {
    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_CONVERSATIONS, 'readonly');
        const store = transaction.objectStore(STORE_CONVERSATIONS);
        const request = store.get(conversationId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const record = request.result as ConversationRecord | undefined;
                resolve(record?.messages || []);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        // Fallback to localStorage
        try {
            const saved = localStorage.getItem(`ccs_messages_${conversationId}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (conversationId: string): Promise<void> => {
    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_CONVERSATIONS, 'readwrite');
        const store = transaction.objectStore(STORE_CONVERSATIONS);
        store.delete(conversationId);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        // Fallback: remove from localStorage
        localStorage.removeItem(`ccs_messages_${conversationId}`);
    }
};

/**
 * Migrate localStorage messages to IndexedDB (one-time migration)
 */
export const migrateFromLocalStorage = async (oldKey: string, conversationId: string): Promise<ChatMessage[]> => {
    try {
        const saved = localStorage.getItem(oldKey);
        if (saved) {
            const messages = JSON.parse(saved);
            if (messages.length > 0) {
                await saveMessages(conversationId, messages);
                localStorage.removeItem(oldKey); // Clean up old data
            }
            return messages;
        }
    } catch (error) {
        // Migration failed silently
    }
    return [];
};

/**
 * Sync save (for beforeunload) - uses localStorage as fallback
 * IndexedDB is async and may not complete before page unload
 */
export const saveMessagesSync = (conversationId: string, messages: ChatMessage[]): void => {
    // Use localStorage for immediate sync save (beforeunload fallback)
    // Strip attachment data to prevent quota errors and ensure originals are not persisted
    const stripped = messages.map(msg => {
        let result = { ...msg };

        // Handle new attachments array
        if (msg.attachments && Array.isArray(msg.attachments)) {
            result.attachments = msg.attachments.map(stripAttachmentData);
        }

        // Handle legacy single attachment
        if (msg.attachment) {
            result.attachment = stripAttachmentData(msg.attachment);
        }

        return result;
    });
    localStorage.setItem(`ccs_messages_pending_${conversationId}`, JSON.stringify(stripped));
};

/**
 * Check for pending sync saves and apply them to IndexedDB
 */
export const applyPendingSaves = async (conversationId: string): Promise<void> => {
    try {
        const pendingKey = `ccs_messages_pending_${conversationId}`;
        const pending = localStorage.getItem(pendingKey);
        if (pending) {
            const messages = JSON.parse(pending);
            await saveMessages(conversationId, messages);
            localStorage.removeItem(pendingKey);
        }
    } catch (error) {
        // Failed to apply pending saves silently
    }
};
