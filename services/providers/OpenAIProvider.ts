import { Attachment, ModelOption } from "../../types";
import { ILLMProvider } from "./types";
import { isOpenAIModelAllowed } from "../../config/modelRules";

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
            if (data.data && Array.isArray(data.data)) {
                return data.data
                    .filter(isOpenAIModelAllowed)
                    .map((m: any) => ({
                        id: m.id,
                        name: m.id, // OpenAI doesn't give display names
                        description: "OpenAI Model",
                        provider: 'openai'
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

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelId,
                messages: messages,
                stream: true
            }),
            signal
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

    async resetSession() {
        this.messageHistory = [];
    }

    async checkModelAvailability(modelId: string, apiKey: string): Promise<boolean> {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 1
                })
            });

            if (response.status === 429) {
                return false;
            }
            return true;
        } catch (e) {
            // If fetch fails (network), we assume true (or maintain current state)
            // But if we want to update the state only when we are sure it's back online...
            // If we cant connect, we probably shouldn't say it's available.
            // But the requirement is to confirm if they are STILL 429.
            // If network error, we don't know status.
            // Let's assume true, as usually 429 is explicit.
            return true;
        }
    }
}
