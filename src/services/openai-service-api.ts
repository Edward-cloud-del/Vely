import type { IAIService, AIRequest, AIResponse } from '../types/ai-types';

export class OpenAIServiceAPI implements IAIService {
  private apiUrl: string;

  constructor(config: { apiUrl?: string } = {}) {
    this.apiUrl = config.apiUrl || this.getAPIUrl();
    console.log('🔧 OpenAI API Service - Calling backend at:', this.apiUrl);
  }

  private getAPIUrl(): string {
          // Try different possible API URLs
      const possibleUrls = [
        'https://api.finalyze.pro/api/analyze', // Railway backend endpoint
        'http://localhost:8080/api/analyze',   // Local backend fallback
        'http://localhost:3001/api/analyze'    // Alternative local
      ];
    
    // Use Railway backend as primary
    return possibleUrls[0] || 'http://localhost:8080/api/analyze';
  }

  private getAuthToken(): string | null {
    try {
      // Try multiple possible storage keys for backward compatibility
      const sessionKeys = [
        'framesense_user_session',  // auth-service-db.ts format
        'framesense_token',         // user-service.ts format
        'framesense_user'           // fallback format
      ];
      
      for (const key of sessionKeys) {
        console.log(`🔍 Checking localStorage key: ${key}`);
        const storedData = localStorage.getItem(key);
        
        if (storedData) {
          try {
            // Try to parse as JSON first (user session object)
            const parsed = JSON.parse(storedData);
            if (parsed.token) {
              console.log(`✅ Found token in ${key} (JSON format)`);
              return parsed.token;
            }
          } catch {
            // If parsing fails, treat as direct token string
            console.log(`✅ Found token in ${key} (string format)`);
            return storedData;
          }
        }
      }
      
      console.warn('❌ No authentication token found in any storage key');
      return null;
    } catch (error) {
      console.error('❌ Error retrieving auth token:', error);
      return null;
    }
  }

  async analyzeImageWithText(request: AIRequest): Promise<AIResponse> {
    console.log('🔄 Making backend API request...');
    
    try {
      // 🔥 DEBUG: No auth needed for simple backend
      console.log('🔥 DEBUG: Calling simple backend - NO AUTH REQUIRED');
      
      // Convert base64 image to blob for multipart upload
      const formData = new FormData();
      formData.append('question', request.message);
      
      if (request.imageData) {
        // Convert base64 data URL to blob
        const base64Data = request.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const byteString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }
        
        const blob = new Blob([arrayBuffer], { type: 'image/png' });
        formData.append('image', blob, 'screenshot.png');
      }

             const response = await fetch(this.apiUrl, {
         method: 'POST',
         headers: {
           // 🔥 DEBUG: No auth headers for simple backend
         },
         body: formData
       });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        
        // 🔥 DEBUG: Simple backend errors
        console.error('🔥 DEBUG: Backend response error:', response.status, error);
        
        if (response.status === 401) {
          throw new Error('🔥 DEBUG: 401 error from simple backend (should not happen)');
        }
        
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      console.log('✅ Backend API request successful');
      
      // Convert backend response to frontend format
      return {
        content: result.answer || result.message || 'No response',
        tokensUsed: result.tokensUsed,
        model: 'gpt-4o-mini',
        timestamp: Date.now()
      };

    } catch (error: any) {
      console.error('❌ Backend API error:', error);
      throw new Error(`Backend API error: ${error.message}`);
    }
  }

  getRemainingRequests(): number {
    return 100; // Mock value for now
  }

  getUsageStats() {
    return {
      requestCount: 0,
      dailyLimit: 100,
      remaining: 100,
      lastReset: new Date().toDateString()
    };
  }
} 