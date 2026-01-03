export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type Provider = 'google' | 'groq';

export interface Attachment {
  mimeType: string;
  data?: string;          // Base64 - only in session memory (not persisted)
  name?: string;
  size?: number;          // File size in bytes
  thumbnail?: string;     // Base64 data URL for preview (persisted)
  duration?: number;      // Seconds (for video/audio)
  isActive?: boolean;     // True if data is in session, false if only metadata remains
  isThumbnail?: boolean;  // True if currently displaying thumbnail instead of original
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
  attachments?: Attachment[];  // Multiple attachments supported
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
  groq: string;
}

// ============================================
// Google API Types
// ============================================

/** Google model information from the models list API */
export interface GoogleModelInfo {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
  outputTokenLimit?: number;
  inputTokenLimit?: number;
}

/** Google content part - can be text or inline data (image/video) */
export interface GoogleContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

/** Google message format for chat history */
export interface GoogleMessage {
  role: 'user' | 'model';
  parts: GoogleContentPart[];
}

/** Google API request payload */
export interface GoogleApiPayload {
  provider: 'google';
  model: string;
  contents: GoogleMessage[];
  generationConfig?: {
    maxOutputTokens?: number;
  };
  systemInstruction?: {
    parts: { text: string }[];
  };
}

// ============================================
// Groq API Types
// ============================================

/** Groq/OpenAI-compatible message format */
export interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Groq model information from models API */
export interface GroqModelInfo {
  id: string;
  context_window?: number;
}