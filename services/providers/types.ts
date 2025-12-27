import { Attachment, ModelOption } from "../../types";

export interface ILLMProvider {
    readonly id: string;

    validateKey(apiKey: string): Promise<ModelOption[]>;

    sendMessageStream(
        modelId: string,
        apiKey: string,
        message: string,
        attachment?: Attachment,
        systemInstruction?: string,
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown>;

    // Optional: Reset session state (useful for stateful providers like Google)
    resetSession?(): Promise<void>;

    // Check if a specific model is available (not rate limited)
    checkModelAvailability?(modelId: string, apiKey: string): Promise<boolean>;
}
