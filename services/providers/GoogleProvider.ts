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
        this.initChat(modelId);

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
}
