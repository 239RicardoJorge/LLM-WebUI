import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Attachment, Provider } from "../types";

export class UnifiedService {
  private chatSession: Chat | null = null;
  private currentModel: string;
  private currentProvider: Provider;
  private apiKey: string;
  private googleClient: GoogleGenAI | null = null;
  
  // History for REST providers (OpenAI / Anthropic)
  private messageHistory: { role: string, content: any }[] = [];

  constructor(modelId: string, provider: Provider, apiKey: string) {
    this.currentModel = modelId;
    this.currentProvider = provider;
    this.apiKey = apiKey;
    
    if (this.currentProvider === 'google' && this.apiKey) {
        this.initGoogleClient();
    }
  }

  private initGoogleClient() {
    try {
        this.googleClient = new GoogleGenAI({ apiKey: this.apiKey });
        this.initGoogleChat();
    } catch (e) {
        console.error("Failed to initialize GenAI client", e);
    }
  }

  private initGoogleChat() {
    if (!this.googleClient) return;
    
    this.chatSession = this.googleClient.chats.create({
      model: this.currentModel,
      config: {
        systemInstruction: "You are a helpful AI assistant. You can analyze images and files. Be concise and accurate.",
      },
    });
  }

  public setConfig(modelId: string, provider: Provider, apiKey: string) {
    const isNewProvider = this.currentProvider !== provider;
    const isNewModel = this.currentModel !== modelId;
    const isNewKey = this.apiKey !== apiKey;

    if (isNewProvider || isNewModel || isNewKey) {
        this.currentModel = modelId;
        this.currentProvider = provider;
        this.apiKey = apiKey;
        this.messageHistory = []; // Reset history on config change

        if (this.currentProvider === 'google') {
            this.initGoogleClient();
        } else {
            this.googleClient = null;
            this.chatSession = null;
        }
    }
  }

  public async resetSession() {
    this.messageHistory = [];
    if (this.currentProvider === 'google') {
        this.initGoogleChat();
    }
  }

  public async *sendMessageStream(message: string, attachment?: Attachment): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
        throw new Error("API Key missing for " + this.currentProvider);
    }

    if (this.currentProvider === 'google') {
        yield* this.streamGoogle(message, attachment);
    } else if (this.currentProvider === 'openai') {
        yield* this.streamOpenAI(message, attachment);
    } else if (this.currentProvider === 'anthropic') {
        yield* this.streamAnthropic(message, attachment);
    } else {
        throw new Error("Provider not implemented");
    }
  }

  // --- Google Implementation ---
  private async *streamGoogle(message: string, attachment?: Attachment) {
    if (!this.googleClient) this.initGoogleClient();
    if (!this.chatSession) this.initGoogleChat();
    if (!this.chatSession) throw new Error("Google Chat Session failed");

    let result;
    if (attachment) {
        const parts = [
            { inlineData: { mimeType: attachment.mimeType, data: attachment.data } },
            { text: message }
        ];
        result = await this.chatSession.sendMessageStream({ message: parts });
    } else {
        result = await this.chatSession.sendMessageStream({ message });
    }

    for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        if (c.text) yield c.text;
    }
  }

  // --- OpenAI Implementation ---
  private async *streamOpenAI(message: string, attachment?: Attachment) {
    // Construct message payload
    let contentPayload: any = message;

    if (attachment && attachment.mimeType.startsWith('image/')) {
        contentPayload = [
            { type: "text", text: message },
            {
                type: "image_url",
                image_url: {
                    url: `data:${attachment.mimeType};base64,${attachment.data}`
                }
            }
        ];
    }

    const userMessage = { role: 'user', content: contentPayload };
    this.messageHistory.push(userMessage);

    // Prepare history for API (System prompt + history)
    const messages = [
        { role: "system", content: "You are a helpful AI assistant." },
        ...this.messageHistory
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
            model: this.currentModel,
            messages: messages,
            stream: true
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "OpenAI API Error");
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullResponse = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                
                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") continue;

                try {
                    const json = JSON.parse(dataStr);
                    const content = json.choices[0]?.delta?.content || "";
                    if (content) {
                        fullResponse += content;
                        yield content;
                    }
                } catch (e) {
                    console.warn("Error parsing chunk", e);
                }
            }
        }
    } finally {
        // Add assistant response to history
        this.messageHistory.push({ role: 'assistant', content: fullResponse });
        reader.releaseLock();
    }
  }

  // --- Anthropic Implementation ---
  private async *streamAnthropic(message: string, attachment?: Attachment) {
    let contentPayload: any = message;

    // Anthropic Image Handling
    if (attachment && attachment.mimeType.startsWith('image/')) {
        contentPayload = [
            {
                type: "image",
                source: {
                    type: "base64",
                    media_type: attachment.mimeType,
                    data: attachment.data
                }
            },
            { type: "text", text: message }
        ];
    }

    const userMessage = { role: 'user', content: contentPayload };
    this.messageHistory.push(userMessage);

    // Anthropic Messages API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            // Note: Direct browser calls may fail CORS without a proxy. 
            // In a real deployed environment, this is often routed through a backend.
        },
        body: JSON.stringify({
            model: this.currentModel,
            max_tokens: 4096,
            messages: this.messageHistory,
            stream: true
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Anthropic API Error");
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullResponse = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("event: ") && !trimmed.startsWith("data: ")) continue;
                
                // We specifically look for "data: " lines containing JSON
                if (trimmed.startsWith("data: ")) {
                     const dataStr = trimmed.slice(6);
                     if (dataStr === "[DONE]") continue;

                     try {
                        const json = JSON.parse(dataStr);
                        // Handle Content Block Delta
                        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                             const text = json.delta.text;
                             if (text) {
                                 fullResponse += text;
                                 yield text;
                             }
                        }
                     } catch (e) {
                         // ignore parse errors for non-json lines
                     }
                }
            }
        }
    } finally {
        this.messageHistory.push({ role: 'assistant', content: fullResponse });
        reader.releaseLock();
    }
  }
}