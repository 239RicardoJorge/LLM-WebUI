import { Attachment, ModelOption, Message } from "../../components/types";

export interface ILLMProvider {
    readonly id: string;

    validateKey(apiKey: string): Promise<ModelOption[]>;

    sendMessageStream(
        modelId: string,
        apiKey: string,
        message: string,
        attachment?: Attachment,
        systemInstruction?: string
    ): AsyncGenerator<string, void, unknown>;

    // Optional: Reset session state (useful for stateful providers like Google)
    resetSession?(): Promise<void>;
}
