import { createWorker } from 'tesseract.js';
export async function extractTextFromImage(imageBuffer) {
    console.log('🔍 Starting OCR extraction...');
    try {
        const worker = await createWorker('eng');
        console.log('⚙️ OCR worker created, processing image...');
        const { data: { text, confidence } } = await worker.recognize(imageBuffer);
        await worker.terminate();
        const cleanText = text.trim();
        const hasText = cleanText.length > 0;
        console.log(`✅ OCR completed: ${hasText ? 'Text found' : 'No text'}, confidence: ${Math.round(confidence)}%`);
        return {
            text: cleanText,
            confidence: confidence / 100, // Convert to 0-1 scale
            success: true
        };
    }
    catch (error) {
        console.error('❌ OCR failed:', error);
        return {
            text: '',
            confidence: 0,
            success: false
        };
    }
}
