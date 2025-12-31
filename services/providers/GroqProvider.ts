import { ILLMProvider } from "./types";
import { ChatMessage, Attachment, ModelOption, Provider } from "../../types";

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

            // Allow all text models, excluding known audio/guardrails
            // This ensures new models like Qwen appear automatically.
            return data.data
                .filter((m: any) => {
                    const id = m.id.toLowerCase();
                    return !id.includes('whisper') &&
                        !id.includes('tts') &&
                        // !id.includes('vision') && // Re-enable vision if we want to support it (or let user try)
                        !id.includes('guard');
                })
                .map((m: any) => ({
                    id: m.id,
                    name: this.formatModelName(m.id),
                    description: `Groq - ${m.id}`,
                    provider: 'groq',
                    // Use context_window if available, else default safe 8k
                    outputTokenLimit: m.context_window || 8192
                }));

        } catch (e) {
            console.warn("Groq validation failed", e);
            throw new Error("Invalid API Key");
        }
    }

    private formatModelName(id: string): string {
        // Generic formatter to make IDs prettier
        // llama-3.1-70b-versatile -> Llama 3.1 70B Versatile
        // mixtral-8x7b-32768 -> Mixtral 8x7B

        const parts = id.split('-');

        const nameParts = parts.map(p => {
            if (p === 'llama3' || p === 'llama') return 'Llama';
            if (p === 'mixtral') return 'Mixtral';
            if (p === 'gemma') return 'Gemma';
            if (p === 'gemma2') return 'Gemma 2';
            if (p === 'deepseek') return 'DeepSeek';
            if (p === 'qwen') return 'Qwen';
            // Capitalize generic words
            return p.charAt(0).toUpperCase() + p.slice(1);
        });

        return nameParts.join(' ');
    }

    async checkModelAvailability(modelId: string, apiKey: string): Promise<{ available: boolean; error?: string; errorCode?: string }> {
        try {
            const res = await fetch(`${this.BASE_URL}/models/${modelId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (res.ok) return { available: true };
            return { available: false, error: 'Model unavailable', errorCode: res.status.toString() };
        } catch (error: any) {
            const msg = error.message.toLowerCase();
            if (msg.includes('terms') && msg.includes('acceptance')) {
                return { available: false, error: error.message, errorCode: 'TERMS' };
            }
            return { available: false, error: error.message };
        }
    }

    async *sendMessageStream(
        modelId: string,
        apiKey: string,
        message: string,
        attachment?: Attachment,
        systemInstruction?: string,
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown> {

        const messages: any[] = [];

        // 1. System Prompt
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        // 2. History (Prepend)
        // Convert ChatMessage[] to OpenAI format
        if (this.history.length > 0) {
            this.history.forEach(msg => {
                // Skip failed messages or empty ones if necessary
                // Also skip 'system' roles in history if we are handling system instruction separately,
                // but usually history just contains user/model.
                if (!msg.content && !msg.attachment) return;

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
                    // temperature removed: use model default to avoid conflicts with reasoning models
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

                            // Support both standard content and reasoning_content (DeepSeek/R1)
                            const content = delta?.content || '';
                            const reasoning = delta?.reasoning_content || '';

                            // If we have reasoning but no <think> tags yet, we might want to wrap it? 
                            // Usually Groq/DeepSeek handles this, but let's just yield what we get.

                            if (content) yield content;
                            if (reasoning) yield `\n<think>${reasoning}</think>\n`;
                        } catch (e) {
                            console.warn("Parse error", e);
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error("Groq Stream Error:", error);
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
