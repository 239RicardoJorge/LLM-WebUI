export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type Provider = 'google' | 'openai' | 'anthropic';

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
  anthropic: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // Google Models
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Stable, cost-effective, fast.',
    provider: 'google'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Balanced performance and latency.',
    provider: 'google'
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3.0 Flash (Preview)',
    description: 'Next-gen high speed preview.',
    provider: 'google'
  },
  // OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'High intelligence, multimodal.',
    provider: 'openai'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast, cost-efficient.',
    provider: 'openai'
  },
  // Anthropic Models
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    description: 'Highest capability, coding & reasoning.',
    provider: 'anthropic'
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    description: 'Fastest, most cost-effective.',
    provider: 'anthropic'
  }
];