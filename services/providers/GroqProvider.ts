import { ILLMProvider } from "./types";
import { ChatMessage, Attachment, ModelOption, Provider, GroqModelInfo, GroqMessage } from "../../types";
import { categorizeError } from "../../utils/errorCategorization";

export class GroqProvider implements ILLMProvider {
    public readonly id: Provider = 'groq';
    private readonly BASE_URL = 'https://api.groq.com/openai/v1';
    private history: ChatMessage[] = [];

    async validateKey(apiKey: string): Promise<ModelOption[]> {
        if (!apiKey) return [];
        try {
            // Groq uses standard OpenAI-compatible implementation for models
            const res = await fetch(`${this.BASE_URL}/models`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (!res.ok) throw new Error('Invalid Key');

            const data = await res.json();

            // Return all models - filtering is now done via user tags
            return data.data
                .map((m: GroqModelInfo) => ({
                    id: m.id,
                    name: this.formatModelName(m.id),
                    description: `Groq - ${m.id}`,
                    provider: 'groq',
                    outputTokenLimit: m.context_window || 8192
                }));

        } catch (e) {
            console.warn("Groq validation failed", e);
            throw new Error("Invalid API Key");
        }
    }

    private formatModelName(id: string): string {
        const parts = id.split('-');

        const nameParts = parts.map(p => {
            if (p === 'llama3' || p === 'llama') return 'Llama';
            if (p === 'mixtral') return 'Mixtral';
            if (p === 'gemma') return 'Gemma';
            if (p === 'gemma2') return 'Gemma 2';
            if (p === 'deepseek') return 'DeepSeek';
            if (p === 'qwen') return 'Qwen';
            return p.charAt(0).toUpperCase() + p.slice(1);
        });

        return nameParts.join(' ');
    }

    async checkModelAvailability(modelId: string, apiKey: string): Promise<{ available: boolean; error?: string; errorCode?: string }> {
        try {
            // Do a REAL ping test (like Google) - actually call the model
            const res = await fetch(`${this.BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 1
                })
            });

            if (res.ok) {
                return { available: true };
            }

            // Parse error response
            let errorMessage = 'Model unavailable';
            try {
                const errData = await res.json();
                errorMessage = errData.error?.message || errorMessage;
            } catch { /* ignore parse errors */ }

            const errorCode = categorizeError(errorMessage, res.status);
            return { available: false, error: errorMessage, errorCode };
        } catch (error: unknown) {
            const err = error as Error;
            const errorCode = categorizeError(err.message || '');
            return { available: false, error: err.message, errorCode };
        }
    }

    async *sendMessageStream(
        modelId: string,
        apiKey: string,
        message: string,
        attachments?: Attachment[],
        systemInstruction?: string,
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown> {

        const messages: GroqMessage[] = [];

        // 1. System Prompt
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        // 2. History (Prepend)
        if (this.history.length > 0) {
            this.history.forEach(msg => {
                if (!msg.content && (!msg.attachments || msg.attachments.length === 0)) return;
                const role = msg.role === 'model' ? 'assistant' : msg.role;
                messages.push({ role, content: msg.content });
            });
        }

        // 3. Current Message
        messages.push({ role: 'user', content: message });

        try {
            const res = await fetch(`${this.BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: messages,
                    stream: true
                }),
                signal
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error?.message || `Groq Error ${res.status}`);
            }

            if (!res.body) throw new Error("No response body");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(trimmed.slice(6));
                            const delta = json.choices[0]?.delta;

                            const content = delta?.content || '';
                            const reasoning = delta?.reasoning_content || '';

                            if (content) yield content;
                            if (reasoning) yield `\n<think>${reasoning}</think>\n`;
                        } catch (e) {
                            console.warn("Parse error", e);
                        }
                    }
                }
            }
        } catch (error: unknown) {
            throw error;
        }
    }

    async resetSession(): Promise<void> {
        this.history = [];
    }

    setHistory(messages: ChatMessage[]): void {
        this.history = messages;
    }
}
