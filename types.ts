export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type Provider = 'google' | 'openai';

export interface Attachment {
  mimeType: string;
  data?: string;          // Base64 - only in session memory (not persisted)
  name?: string;
  size?: number;          // File size in bytes
  thumbnail?: string;     // Base64 data URL for preview (persisted)
  duration?: number;      // Seconds (for video/audio)
  isActive?: boolean;     // True if data is in session, false if only metadata remains
  dimensions?: {          // For images/video
    width: number;
    height: number;
  };
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isError?: boolean;
  attachment?: Attachment;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  provider: Provider;
  outputTokenLimit?: number;
}

export interface ApiKeys {
  google: string;
  openai: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [];