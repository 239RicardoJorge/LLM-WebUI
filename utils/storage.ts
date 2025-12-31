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

interface ConversationRecord {
    id: string;
    messages: any[];
    updatedAt: number;
}

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
            console.error('IndexedDB error:', request.error);
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
export const saveMessages = async (conversationId: string, messages: any[]): Promise<void> => {
    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_CONVERSATIONS, 'readwrite');
        const store = transaction.objectStore(STORE_CONVERSATIONS);

        // Strip attachment data before saving (only keep thumbnail + metadata)
        const messagesForStorage = messages.map(msg => {
            if (msg.attachment) {
                // Determine if we should preserve isActive
                // Logic:
                // 1. If we are using the Original File (data != thumbnail), it should NOT persist as active. 
                //    (User rule: "Original exits context on refresh")
                // 2. If we are using the Thumbnail (data == thumbnail), it SHOULD persist as active.
                //    (User rule: "Persistence is only about the thumb")

                const { data, ...attachmentMeta } = msg.attachment;
                let shouldPersistActive = msg.attachment.isActive;

                // If currently active with data, check source
                if (msg.attachment.isActive && msg.attachment.data && msg.attachment.thumbnail) {
                    try {
                        const thumbData = msg.attachment.thumbnail.split(',')[1];
                        // If data is NOT the thumbnail (meaning it's the original), inactive on save
                        if (msg.attachment.data !== thumbData) {
                            shouldPersistActive = false;
                        }
                    } catch (e) {
                        // Fallback: if error parsing, safer to set inactive
                        shouldPersistActive = false;
                    }
                }

                return {
                    ...msg,
                    attachment: { ...attachmentMeta, isActive: shouldPersistActive }
                };
            }
            return msg;
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
        console.error('Failed to save messages to IndexedDB:', error);
        // Fallback to localStorage (also strip data)
        const stripped = messages.map(msg => {
            if (msg.attachment) {
                const { data, ...meta } = msg.attachment;
                // Replicate logic for fallback
                let shouldPersistActive = msg.attachment.isActive;
                if (msg.attachment.isActive && msg.attachment.data && msg.attachment.thumbnail) {
                    try {
                        const thumbData = msg.attachment.thumbnail.split(',')[1];
                        if (msg.attachment.data !== thumbData) {
                            shouldPersistActive = false;
                        }
                    } catch (e) { shouldPersistActive = false; }
                }
                return { ...msg, attachment: { ...meta, isActive: shouldPersistActive } };
            }
            return msg;
        });
        localStorage.setItem(`ccs_messages_${conversationId}`, JSON.stringify(stripped));
    }
};

/**
 * Load messages for a conversation
 */
export const loadMessages = async (conversationId: string): Promise<any[]> => {
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
        console.error('Failed to load messages from IndexedDB:', error);
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
        console.error('Failed to delete conversation from IndexedDB:', error);
        // Fallback: remove from localStorage
        localStorage.removeItem(`ccs_messages_${conversationId}`);
    }
};

/**
 * Migrate localStorage messages to IndexedDB (one-time migration)
 */
export const migrateFromLocalStorage = async (oldKey: string, conversationId: string): Promise<any[]> => {
    try {
        const saved = localStorage.getItem(oldKey);
        if (saved) {
            const messages = JSON.parse(saved);
            if (messages.length > 0) {
                await saveMessages(conversationId, messages);
                localStorage.removeItem(oldKey); // Clean up old data
                console.log('Migrated messages from localStorage to IndexedDB');
            }
            return messages;
        }
    } catch (error) {
        console.error('Migration failed:', error);
    }
    return [];
};

/**
 * Sync save (for beforeunload) - uses localStorage as fallback
 * IndexedDB is async and may not complete before page unload
 */
export const saveMessagesSync = (conversationId: string, messages: any[]): void => {
    // Use localStorage for immediate sync save (beforeunload fallback)
    // CRITICAL: Strip attachment data to prevent quota errors and ensure originals are not persisted
    const stripped = messages.map(msg => {
        if (msg.attachment) {
            // Determine isActive state using the same logic as saveMessages
            let shouldPersistActive = msg.attachment.isActive;
            if (msg.attachment.isActive && msg.attachment.data && msg.attachment.thumbnail) {
                try {
                    const thumbData = msg.attachment.thumbnail.split(',')[1];
                    if (msg.attachment.data !== thumbData) {
                        shouldPersistActive = false;
                    }
                } catch (e) { shouldPersistActive = false; }
            }

            const { data, ...attachmentMeta } = msg.attachment;
            return {
                ...msg, // Keep other properties
                attachment: { ...attachmentMeta, isActive: shouldPersistActive }
            };
        }
        return msg;
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
            console.log('Applied pending sync save to IndexedDB');
        }
    } catch (error) {
        console.error('Failed to apply pending saves:', error);
    }
};
