import { Attachment, ModelOption } from "../../types";
import { ILLMProvider } from "./types";
import { isOpenAIModelAllowed } from "../../config/modelRules";
import { OpenAIModelListSchema } from "../schemas";

export class OpenAIProvider implements ILLMProvider {
    readonly id = 'openai';
    private messageHistory: { role: string, content: any }[] = [];

    async validateKey(apiKey: string): Promise<ModelOption[]> {
        if (!apiKey) return [];

        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
            });

            if (response.status === 401) throw new Error("Invalid API Key");
            if (response.status === 429) throw new Error("Rate Limit Exceeded (Quota)");

            const data = await response.json();

            const parsed = OpenAIModelListSchema.safeParse(data);
            if (!parsed.success) {
                console.warn("OpenAI API Schema Validation Warning:", parsed.error);
            }

            const sourceData = parsed.success ? parsed.data : data;

            if (sourceData.data && Array.isArray(sourceData.data)) {
                return sourceData.data
                    .filter(isOpenAIModelAllowed)
                    .map((m: any) => ({
                        id: m.id,
                        name: m.id, // OpenAI doesn't give display names
                        description: "OpenAI Model",
                        provider: 'openai' as const
                    }))
                    .sort((a: any, b: any) => b.id.localeCompare(a.id));
            }
        } catch (e: any) {
            console.warn(`Validation failed for openai:`, e);
            if (e.message === "Invalid API Key" || e.message.includes("Rate Limit")) throw e;
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

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify({
                provider: 'openai',
                model: modelId,
                messages: messages,
                stream: true
            }),
            signal
        });

        if (!response.ok) {
            const err = await response.text(); // Proxy returns text error usually
            throw new Error(err || "OpenAI API Error");
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

    async resetSession() {
        this.messageHistory = [];
    }

    async checkModelAvailability(modelId: string, apiKey: string): Promise<{ available: boolean; error?: string; errorCode?: string }> {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 1
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "OpenAI API Error");
            }
            return { available: true };
        } catch (error: any) {
            console.warn(`[OpenAIProvider] Availability check failed for ${modelId}:`, error);
            let errorCode = "Error";
            let errorMessage = error.message || 'Unknown error';

            if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit')) {
                errorCode = "429";
            } else if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('invalid')) {
                errorCode = "400";
            } else if (errorMessage.includes('404') || errorMessage.toLowerCase().includes('not found')) {
                errorCode = "400";
                errorMessage = "Model not found or not accessible with this key.";
            }

            return { available: false, error: errorMessage, errorCode };
        }
    }
}
