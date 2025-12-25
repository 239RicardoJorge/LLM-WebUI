export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type Provider = 'google' | 'openai';

export interface Attachment {
  mimeType: string;
  data: string; // Base64
  name?: string;
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