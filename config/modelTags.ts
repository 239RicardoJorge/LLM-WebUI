export const MODEL_TAGS = [
    { id: 'chat', label: 'Chat' },
    { id: 'vision', label: 'Vision' },
    { id: 'stt', label: 'STT' },
    { id: 'tts', label: 'TTS' },
    { id: 'safety', label: 'Safety' },
] as const;

export type ModelTagId = typeof MODEL_TAGS[number]['id'];

export const MODEL_TAG_LABELS: Record<ModelTagId, string> =
    Object.fromEntries(MODEL_TAGS.map(t => [t.id, t.label])) as Record<ModelTagId, string>;
