/**
 * Available model capability tags
 */
export const MODEL_TAGS = [
    { id: 'chat', emoji: '💬', label: 'Chat' },
    { id: 'vision', emoji: '👁️', label: 'Vision' },
    { id: 'search', emoji: '🔍', label: 'Search' },
    { id: 'reasoning', emoji: '🧠', label: 'Reasoning' },
    { id: 'stt', emoji: '🎤', label: 'STT' },
    { id: 'tts', emoji: '🔊', label: 'TTS' },
    { id: 'safety', emoji: '🛡️', label: 'Safety' },
] as const;

export type ModelTagId = typeof MODEL_TAGS[number]['id'];

export type ModelTagsMap = Record<string, ModelTagId[]>;
