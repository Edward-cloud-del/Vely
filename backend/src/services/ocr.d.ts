interface OCRResult {
    text: string;
    confidence: number;
    success: boolean;
}
export declare function extractTextFromImage(imageBuffer: Buffer): Promise<OCRResult>;
export {};
