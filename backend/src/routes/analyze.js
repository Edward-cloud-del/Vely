import { extractTextFromImage } from '../services/ocr.js';
import { analyzeWithChatGPT } from '../services/chatgpt.js';
import { analyzeImageContent } from '../services/vision.js';
export async function analyzeImage(req, res) {
    try {
        console.log('📸 Image analysis request received');
        // Check if image was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }
        const imageBuffer = req.file.buffer;
        const userQuestion = req.body.question || 'What do you see in this image?';
        console.log(`📝 User question: "${userQuestion}"`);
        console.log(`🖼️ Image size: ${Math.round(imageBuffer.length / 1024)}KB`);
        // Step 1: Extract text using OCR
        console.log('🔍 Step 1: Running OCR...');
        const ocrResult = await extractTextFromImage(imageBuffer);
        
        // Step 1.5: Analyze with Google Vision (objects, logos, faces)
        console.log('👁️ Step 1.5: Running Google Vision analysis...');
        const visionResult = await analyzeImageContent(imageBuffer);
        
        // Step 2: Convert image to base64 for ChatGPT
        const imageBase64 = imageBuffer.toString('base64');
        // Step 3: Send to ChatGPT with OCR + Vision context
        console.log('🤖 Step 3: Sending to ChatGPT...');
        
        // Build enhanced context for ChatGPT
        let enhancedQuestion = userQuestion;
        if (visionResult.success) {
            const visionContext = [];
            if (visionResult.objects.length > 0) {
                visionContext.push(`Objects detected: ${visionResult.objects.join(', ')}`);
            }
            if (visionResult.logos.length > 0) {
                visionContext.push(`Logos/brands detected: ${visionResult.logos.join(', ')}`);
            }
            if (visionResult.faces > 0) {
                visionContext.push(`${visionResult.faces} person(s) detected`);
            }
            
            if (visionContext.length > 0) {
                enhancedQuestion += `\n\nGoogle Vision detected: ${visionContext.join('; ')}`;
            }
        }
        
        const chatGPTResult = await analyzeWithChatGPT({
            text: enhancedQuestion,
            ocrText: ocrResult.success ? ocrResult.text : (visionResult.text || undefined),
            imageBase64: imageBase64
        });
        // Return comprehensive response with Vision data
        const response = {
            success: true,
            // OCR data
            text: ocrResult.text || 'No text detected',
            textConfidence: ocrResult.confidence,
            
            // Google Vision data
            vision: {
                objects: visionResult.objects || [],
                logos: visionResult.logos || [],
                faces: visionResult.faces || 0,
                confidence: visionResult.confidence || 0,
                success: visionResult.success || false
            },
            
            // ChatGPT data
            answer: chatGPTResult.answer,
            tokensUsed: chatGPTResult.tokensUsed,
            timestamp: new Date().toISOString()
        };
        console.log('✅ Analysis complete:', {
            hasOcrText: !!ocrResult.text,
            ocrConfidence: Math.round(ocrResult.confidence * 100) + '%',
            visionSuccess: visionResult.success,
            visionObjects: visionResult.objects?.length || 0,
            visionLogos: visionResult.logos?.length || 0,
            visionFaces: visionResult.faces || 0,
            chatGptSuccess: chatGPTResult.success,
            responseLength: chatGPTResult.answer.length,
            tokensUsed: chatGPTResult.tokensUsed || 0
        });
        res.json(response);
    }
    catch (error) {
        console.error('❌ Analysis failed:', error);
        res.status(500).json({
            success: false,
            message: 'Analysis failed',
            error: error.message
        });
    }
}
