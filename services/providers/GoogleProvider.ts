import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Attachment, ModelOption } from "../../types"; // Adjusted path
import { ILLMProvider } from "./types";
import { isGoogleModelAllowed, sortGoogleModels } from "../../config/modelRules";

export class GoogleProvider implements ILLMProvider {
    readonly id = 'google';
    private googleClient: GoogleGenAI | null = null;
    private chatSession: Chat | null = null;
    private currentModel: string | null = null;
    private currentApiKey: string | null = null;

    private initClient(apiKey: string) {
        if (this.googleClient && this.currentApiKey === apiKey) return;

        try {
            this.googleClient = new GoogleGenAI({ apiKey });
            this.currentApiKey = apiKey;
            this.chatSession = null; // Reset chat when client changes
        } catch (e) {
            console.error("Failed to initialize Google Client", e);
            throw e;
        }
    }

    private initChat(modelId: string) {
        if (!this.googleClient) throw new Error("Google Client not initialized");

        // precise session reuse check
        if (this.chatSession && this.currentModel === modelId) return;

        this.chatSession = this.googleClient.chats.create({
            model: modelId,
            config: {
                systemInstruction: "You are a helpful AI assistant. You can analyze images and files. Be concise and accurate.",
            },
        });
        this.currentModel = modelId;
    }

    async validateKey(apiKey: string): Promise<ModelOption[]> {
        if (!apiKey) return [];

        try {
            // We use the REST API for validation/listing as per original implementation
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
            if (response.status === 400 || response.status === 403) throw new Error("Invalid API Key");

            const data = await response.json();
            if (data.models && Array.isArray(data.models)) {
                return data.models
                    .filter(isGoogleModelAllowed)
                    .map((m: any) => ({
                        id: m.name.replace('models/', ''),
                        name: m.displayName || m.name.replace('models/', ''),
                        description: m.description || "Google Gemini Model",
                        provider: 'google',
                        outputTokenLimit: m.outputTokenLimit
                    }))
                    .sort(sortGoogleModels);
            }
        } catch (e: any) {
            console.warn(`Validation failed for google:`, e);
            if (e.message === "Invalid API Key") throw e;
        }
        return [];
    }

    async *sendMessageStream(
        modelId: string,
        apiKey: string,
        message: string,
        attachment?: Attachment,
        systemInstruction?: string,
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown> {
        this.initClient(apiKey);

        // Initial setup
        if (!this.chatSession || this.currentModel !== modelId) {
            this.initChat(modelId);
        }

        if (!this.chatSession) throw new Error("Google Chat Session failed");

        // Helper to perform the actual send
        const performSend = async () => {
            if (attachment) {
                const parts = [
                    { inlineData: { mimeType: attachment.mimeType, data: attachment.data } },
                    { text: message }
                ];
                // @ts-ignore
                return await this.chatSession.sendMessageStream({ message: parts });
            } else {
                // @ts-ignore
                return await this.chatSession.sendMessageStream({ message });
            }
        };

        let result;
        try {
            result = await performSend();
        } catch (error: any) {
            // Fallback for models that don't support system instructions (e.g. Gemma)
            if (error.message && (error.message.includes("Developer instruction") || error.message.includes("System instruction"))) {
                console.warn(`[GoogleProvider] Model ${modelId} rejected system instruction. Retrying without it.`);

                // Re-initialize without config
                this.chatSession = this.googleClient!.chats.create({
                    model: modelId,
                    // No config (systemInstruction)
                });
                this.currentModel = modelId;

                // Retry send
                result = await performSend();
            } else {
                throw error;
            }
        }

        for await (const chunk of result) {
            if (signal?.aborted) {
                break;
            }
            const c = chunk as GenerateContentResponse;
            if (c.text) yield c.text;
        }
    }

    async resetSession() {
        this.chatSession = null;
        this.currentModel = null;
    }

    async checkModelAvailability(modelId: string, apiKey: string): Promise<{ available: boolean; error?: string; errorCode?: string }> {
        try {
            // Use REST API to avoid SDK version incompatibilities
            // normalize modelId if it doesn't start with 'models/' (though API usually accepts short names, safer to check)
            // Actually, the API prefers 'models/gemini-pro', but usually works. 
            // The `validateKey` stores IDs without 'models/', e.g. 'gemini-pro'.
            // The generation endpoint usually expects `models/{modelId}:generateContent`.

            const cleanModelId = modelId.startsWith('models/') ? modelId.slice(7) : modelId;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelId}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
                    generationConfig: { maxOutputTokens: 1 }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || response.statusText || 'Unknown Error';
                throw new Error(`${response.status} ${message}`);
            }

            return { available: true };
        } catch (error: any) {
            console.warn(`[GoogleProvider] Availability check failed for ${modelId}:`, error);
            let errorCode = "Error";
            let errorMessage = error.message || 'Unknown error';

            if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit')) {
                errorCode = "429";
            } else if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('invalid')) {
                errorCode = "400";
            }
            return { available: false, error: errorMessage, errorCode };
        }
    }
}
