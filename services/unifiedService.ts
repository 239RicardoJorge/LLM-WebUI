import { Attachment, Provider, ModelOption, ChatMessage } from "../types";
import { ILLMProvider } from "./providers/types";
import { GoogleProvider } from "./providers/GoogleProvider";
import { GroqProvider } from "./providers/GroqProvider";

// Static provider instances for validation/availability checks (avoid repeated instantiation)
const staticProviders: Record<string, ILLMProvider> = {
    'google': new GoogleProvider(),
    'groq': new GroqProvider()
};

export class UnifiedService {
    private currentModel: string;
    private currentProvider: Provider;
    private apiKey: string;

    // Instance providers for session state (message history)
    private providers: Record<string, ILLMProvider>;

    constructor(modelId: string, provider: Provider, apiKey: string) {
        this.currentModel = modelId;
        this.currentProvider = provider;
        this.apiKey = apiKey;

        // Initialize providers for session management
        this.providers = {
            'google': new GoogleProvider(),
            'groq': new GroqProvider()
        };
    }

    public setConfig(modelId: string, provider: Provider, apiKey: string) {
        const isNewProvider = this.currentProvider !== provider;
        const isNewModel = this.currentModel !== modelId;
        const isNewKey = this.apiKey !== apiKey;

        if (isNewProvider || isNewModel || isNewKey) {
            this.currentModel = modelId;
            this.currentProvider = provider;
            this.apiKey = apiKey;

            // When config changes, reset the session for the target provider
            // so it starts fresh (no mixed history from previous context if not desired)
            const p = this.getProvider();
            if (p.resetSession) {
                p.resetSession().catch(e => console.error("Failed to reset session", e));
            }
        }
    }

    public async resetSession() {
        const p = this.getProvider();
        if (p.resetSession) await p.resetSession();
    }

    public setHistory(messages: ChatMessage[]) {
        const p = this.getProvider();
        if (p.setHistory) p.setHistory(messages);
    }

    public async *sendMessageStream(message: string, attachment?: Attachment, signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
        if (!this.apiKey) {
            throw new Error("API Key missing for " + this.currentProvider);
        }

        const p = this.getProvider();
        yield* p.sendMessageStream(this.currentModel, this.apiKey, message, attachment, undefined, signal);
    }

    private getProvider(): ILLMProvider {
        const p = this.providers[this.currentProvider];
        if (!p) throw new Error(`Provider '${this.currentProvider}' not implemented`);
        return p;
    }

    /**
     * Validate API key and get available models.
     * Uses cached static provider instances to avoid repeated instantiation.
     */
    public static async validateKeyAndGetModels(provider: Provider, apiKey: string): Promise<ModelOption[]> {
        const p = staticProviders[provider];
        if (!p) return [];
        return await p.validateKey(apiKey);
    }

    /**
     * Check if a specific model is available.
     * Uses cached static provider instances to avoid repeated instantiation.
     */
    public static async checkModelAvailability(provider: string, modelId: string, apiKey: string) {
        const p = staticProviders[provider];
        if (!p) throw new Error(`Provider ${provider} not found`);
        return p.checkModelAvailability(modelId, apiKey);
    }
}
