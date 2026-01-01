import { Attachment, ModelOption } from "../../types";
import { ILLMProvider } from "./types";
import { isGoogleModelAllowed, sortGoogleModels } from "../../config/modelRules";
import { GoogleModelListSchema } from "../schemas";
import { categorizeError } from "../../utils/errorCategorization";

export class GoogleProvider implements ILLMProvider {
    readonly id = 'google';
    // Google uses 'parts' structure usually, but we can store it normalized or raw.
    // Let's store raw Google Content structure for simplicity in sending to API.
    private messageHistory: { role: string, parts: { text?: string, inlineData?: any }[] }[] = [];

    async validateKey(apiKey: string): Promise<ModelOption[]> {
        if (!apiKey) return [];

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
            if (response.status === 400 || response.status === 403) throw new Error("Invalid API Key");

            const data = await response.json();
            const parsed = GoogleModelListSchema.safeParse(data);
            if (!parsed.success) {
                console.warn("Google API Schema Validation Warning:", parsed.error);
            }

            const sourceData = parsed.success ? parsed.data : data;

            if (sourceData.models && Array.isArray(sourceData.models)) {
                return sourceData.models
                    // .filter(isGoogleModelAllowed) // Removed as requested by user
                    .map((m: any) => ({
                        id: m.name.replace('models/', ''),
                        name: m.displayName || m.name.replace('models/', ''),
                        description: m.description || "Google Gemini Model",
                        provider: 'google' as const,
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

        // Construct new user message
        let parts: any[] = [];
        if (attachment) {
            parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
        }
        parts.push({ text: message });

        const newUserMessage = { role: 'user', parts };
        this.messageHistory.push(newUserMessage);

        // Prepare full history (contents)
        // Note: System Instruction is passed in 'system_instruction' or 'systemInstruction' field, NOT in contents usually for Google REST.
        // Actually, v1beta uses 'systemInstruction' field at top level?
        // Let's put it in the body if present.

        const payload: any = {
            provider: 'google',
            model: modelId,
            contents: this.messageHistory,
            generationConfig: {
                maxOutputTokens: 8192, // Default high limit
            }
        };

        if (systemInstruction) {
            payload.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify(payload),
            signal
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || "Google API Error");
        }

        if (!response.body) throw new Error("No response body");

        // Use standard Reader (Web Stream from Proxy)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponseText = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // The Proxy blindly forwards chunks.
                // Google REST API returns JSON structure "data: " lines (SSE)?
                // Wait. server.js uses `upstreamUrl = ... &alt=sse`.
                // So Google returns SSE events.
                // My proxy forwards them as raw bytes.
                // So here in frontend we receive SSE stream `data: ...`.

                const chunkStr = decoder.decode(value, { stream: true });
                const lines = chunkStr.split('\n');

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;

                    const jsonStr = trimmed.slice(6);
                    if (jsonStr === '[DONE]') continue; // Not sure if Google sends [DONE], OpenAI does.

                    try {
                        const data = JSON.parse(jsonStr);
                        // Google SSE format: { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            fullResponseText += text;
                            yield text;
                        }
                    } catch (e) {
                        // ignore partial/invalid json
                    }
                }
            }
        } finally {
            // Update history with model response
            if (fullResponseText) {
                this.messageHistory.push({ role: 'model', parts: [{ text: fullResponseText }] });
            }
            reader.releaseLock();
        }
    }

    setHistory(messages: import("../../types").ChatMessage[]): void {
        // Convert ChatMessage[] to Google's message format
        this.messageHistory = [];
        for (const msg of messages) {
            if (msg.role === 'user') {
                const parts: any[] = [];
                // Add attachment if present and active
                if (msg.attachment && msg.attachment.data && msg.attachment.isActive !== false) {
                    parts.push({ inlineData: { mimeType: msg.attachment.mimeType, data: msg.attachment.data } });
                }
                if (msg.content) {
                    parts.push({ text: msg.content });
                }
                if (parts.length > 0) {
                    this.messageHistory.push({ role: 'user', parts });
                }
            } else if (msg.role === 'model') {
                if (msg.content) {
                    this.messageHistory.push({ role: 'model', parts: [{ text: msg.content }] });
                }
            }
        }
        console.log('[GoogleProvider] History restored:', this.messageHistory.length, 'messages');
    }

    async resetSession() {
        this.messageHistory = [];
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
            const errorMessage = error.message || 'Unknown error';
            const errorCode = categorizeError(errorMessage);
            return { available: false, error: errorMessage, errorCode };
        }
    }
}
