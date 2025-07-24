import OpenAI from 'openai';
export async function analyzeWithChatGPT(request) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
        return {
            answer: '❌ OpenAI API key not configured. Please set OPENAI_API_KEY in .env file.',
            success: false
        };
    }
    try {
        const openai = new OpenAI({ apiKey });
        console.log('🤖 Sending request to ChatGPT-4...');
        // Build context message
        let contextMessage = `User question: ${request.text}`;
        if (request.ocrText) {
            contextMessage += `\n\nText found in image (OCR): "${request.ocrText}"`;
        }
        const messages = [
            {
                role: 'system',
                content: 'You are a helpful AI assistant that analyzes images and text. Provide clear, concise answers based on the content provided.'
            },
            {
                role: 'user',
                content: contextMessage
            }
        ];
        // If image is provided, add it to the message
        if (request.imageBase64) {
            messages[messages.length - 1].content = [
                { type: 'text', text: contextMessage },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/png;base64,${request.imageBase64}`
                    }
                }
            ];
        }
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Cheaper and faster than gpt-4o
            messages,
            max_tokens: 1000,
            temperature: 0.7
        });
        const answer = response.choices[0]?.message?.content || 'No response generated';
        const tokensUsed = response.usage?.total_tokens || 0;
        console.log(`✅ ChatGPT response received (${tokensUsed} tokens)`);
        return {
            answer,
            success: true,
            tokensUsed
        };
    }
    catch (error) {
        console.error('❌ ChatGPT API error:', error);
        let errorMessage = '❌ Failed to get response from ChatGPT.';
        if (error.code === 'invalid_api_key') {
            errorMessage = '❌ Invalid OpenAI API key. Please check your configuration.';
        }
        else if (error.code === 'rate_limit_exceeded') {
            errorMessage = '❌ Rate limit exceeded. Please try again later.';
        }
        else if (error.code === 'insufficient_quota') {
            errorMessage = '❌ OpenAI quota exceeded. Please check your billing.';
        }
        return {
            answer: errorMessage,
            success: false
        };
    }
}
