import { Attachment, ModelOption } from "../../types";

export interface ILLMProvider {
    readonly id: string;

    validateKey(apiKey: string): Promise<boolean>;
    checkModelAvailability(modelId: string, apiKey: string): Promise<{ available: boolean; error?: string; errorCode?: string }>;

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




}
