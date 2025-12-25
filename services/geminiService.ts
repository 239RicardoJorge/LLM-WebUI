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

    // --- Dynamic Validation ---
    public static async validateKeyAndGetModels(provider: Provider, apiKey: string): Promise<import("../types").ModelOption[]> {
        if (!apiKey) return [];

        try {
            if (provider === 'google') {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
                if (response.status === 400 || response.status === 403) throw new Error("Invalid API Key");

                const data = await response.json();
                if (data.models && Array.isArray(data.models)) {
                    return data.models
                        .filter((m: any) => {
                            const name = m.name.toLowerCase();
                            const hasGenerateContent = m.supportedGenerationMethods?.includes("generateContent");
                            const isNotGemma = !name.includes("gemma");
                            const isNotTTS = !name.includes("tts");
                            const isNotImage = !name.includes("image") && !name.includes("nano"); // Exclude "Nano Banana"
                            const isNot2_0 = !name.includes("2.0");
                            const isNotComputer = !name.includes("computer");
                            const isNot2_5FlashPreview = !(name.includes("2.5") && name.includes("flash") && name.includes("preview"));

                            // User-specific inclusions
                            const isVersion001 = name.includes("001");
                            const isVersion2_5 = name.includes("2.5");
                            const isLatest = name.includes("latest");
                            const isVersion3 = name.includes("3"); // Includes "gemini-3-..."

                            return hasGenerateContent && isNotGemma && isNotTTS && isNotImage && isNot2_0 && isNotComputer && isNot2_5FlashPreview && (isVersion001 || isVersion2_5 || isLatest || isVersion3);
                        })
                        .map((m: any) => ({
                            id: m.name.replace('models/', ''),
                            name: m.displayName || m.name.replace('models/', ''),
                            description: m.description || "Google Gemini Model",
                            provider: 'google',
                            outputTokenLimit: m.outputTokenLimit
                        }))
                        .sort((a, b) => {
                            const nameA = a.name.toLowerCase();
                            const nameB = b.name.toLowerCase();
                            const isLatestA = nameA.includes("latest");
                            const isLatestB = nameB.includes("latest");

                            if (isLatestA && !isLatestB) return -1;
                            if (!isLatestA && isLatestB) return 1;

                            return b.name.localeCompare(a.name); // Descending order
                        });
                }
            }
            else if (provider === 'openai') {
                const response = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
                });

                if (response.status === 401) throw new Error("Invalid API Key");
                if (response.status === 429) throw new Error("Rate Limit Exceeded (Quota)");

                const data = await response.json();
                if (data.data && Array.isArray(data.data)) {
                    return data.data
                        .filter((m: any) => {
                            const id = m.id.toLowerCase();
                            // Inclusive: Must start with known text model prefixes
                            const isTextModel = id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('chatgpt');
                            // Exclusive: Must NOT contain non-text/legacy keywords
                            const isNotAudio = !id.includes('tts') && !id.includes('whisper') && !id.includes('audio');
                            const isNotImage = !id.includes('dall-e');
                            const isNotEmbedding = !id.includes('embedding');
                            const isNotLegacy = !id.includes('davinci') && !id.includes('babbage') && !id.includes('curie') && !id.includes('ada');

                            return isTextModel && isNotAudio && isNotImage && isNotEmbedding && isNotLegacy;
                        })
                        .map((m: any) => ({
                            id: m.id,
                            name: m.id, // OpenAI doesn't give display names
                            description: "OpenAI Model",
                            provider: 'openai'
                        }))
                        .sort((a: any, b: any) => b.id.localeCompare(a.id));
                }
            }
        } catch (e: any) {
            console.warn(`Validation failed for ${provider}:`, e);
            // Re-throw if it's a known auth error so UI can show it
            if (e.message === "Invalid API Key" || e.message.includes("Rate Limit")) throw e;
        }
        return [];
    }
}
