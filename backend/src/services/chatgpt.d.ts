interface ChatGPTRequest {
    text: string;
    ocrText?: string;
    imageBase64?: string;
}
interface ChatGPTResponse {
    answer: string;
    success: boolean;
    tokensUsed?: number;
}
export declare function analyzeWithChatGPT(request: ChatGPTRequest): Promise<ChatGPTResponse>;
export {};
