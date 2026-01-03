import { Attachment, ModelOption, ChatMessage } from "../../types";

export interface ILLMProvider {
    readonly id: string;

    validateKey(apiKey: string): Promise<ModelOption[]>;
    checkModelAvailability(modelId: string, apiKey: string): Promise<{ available: boolean; error?: string; errorCode?: string }>;

    sendMessageStream(
        modelId: string,
        apiKey: string,
        message: string,
        attachments?: Attachment[],
        systemInstruction?: string,
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown>;

    // Optional: Reset session state (useful for stateful providers like Google)
    resetSession?(): Promise<void>;

    // Optional: Set history from loaded messages (for restoring context after page reload)
    setHistory?(messages: ChatMessage[]): void;
}
