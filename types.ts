export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type Provider = 'google' | 'groq';

// Response Profile settings for LLM response style
export interface ResponseProfile {
  // Faders (0-5 scale)
  faders: {
    comunicacao: {
      casual_formal: number;       // A: muito casual → formal/técnico
      curto_extenso: number;       // B: respostas mínimas → exaustivo
      reativo_proativo: number;    // C: responde apenas → guia ativamente
      direto_didatico: number;     // D: apenas resposta → estilo professor
      cauteloso_assertivo: number; // E: sempre qualifica → decisivo
      convencional_criativo: number; // F: só padrão → exploratório
      frio_empatico: number;       // G: técnico → altamente empático
    };
    raciocinio: {
      pragmatico_rigoroso: number; // H: resultado rápido → rigor formal
      segue_questiona: number;     // I: executa → desafia ativamente
      pede_assume: number;         // J: sempre pede info → decide e segue
    };
  };
  // Absolute rules (toggles)
  regras: {
    nuncaMencionarIA: boolean;
    nuncaEmojis: boolean;
    nuncaInventarAPIs: boolean;
    nuncaSairDominio: boolean;
    nuncaOutroIdioma: boolean;
  };
  // Role select
  papel: 'assistente' | 'revisor' | 'arquiteto' | 'tutor' | 'consultor';
  // Scope checkboxes
  escopo: {
    podeEscreverCodigo: boolean;
    podeRefatorar: boolean;
    podeExplicar: boolean;
    podeSugerirBibliotecas: boolean;
    podeOpinarArquitetura: boolean;
  };
  // Response patterns
  padroes: {
    comecarCom: 'direta' | 'resumo' | 'diagnostico';
    terminarCom: 'pergunta' | 'sugestao' | 'nada';
  };
}

// Saved profile with name and ID
export interface SavedProfile {
  id: string;
  name: string;
  data: ResponseProfile;
}

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