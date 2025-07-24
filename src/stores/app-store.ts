import { create } from 'zustand';

export interface AIResult {
  id: string;
  content: string;
  type: 'text' | 'image' | 'hybrid';
  confidence: number;
  timestamp: Date;
  position?: { x: number; y: number };
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  // Add captured image for display
  capturedImage?: string;
}

// User tier and subscription information
export interface UserTier {
  tier: 'free' | 'premium' | 'pro' | 'enterprise';
  remainingRequests: number;
  dailyLimit: number;
  customerId?: string;
  subscriptionId?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  tier: UserTier;
  token: string;
}

interface AppState {
  // Permissions
  hasPermissions: boolean;
  setPermissions: (permissions: boolean) => void;

  // User authentication and tier
  user: User | null;
  setUser: (user: User | null) => void;
  isLoggedIn: boolean;
  
  // Current selected AI model
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  // Processing state
  isProcessing: boolean;
  setProcessing: (processing: boolean) => void;
  processingStage: string;
  setProcessingStage: (stage: string) => void;

  // Results
  currentResult: AIResult | null;
  setCurrentResult: (result: AIResult | null) => void;
  
  // Recent results history
  recentResults: AIResult[];
  addResult: (result: AIResult) => void;
  clearResults: () => void;

  // Settings
  settings: {
    hotkey: string;
    aiProvider: 'openai' | 'anthropic';
    autoCapture: boolean;
    theme: 'light' | 'dark' | 'system';
  };
  updateSettings: (settings: Partial<AppState['settings']>) => void;
  

}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  hasPermissions: false,
  isProcessing: false,
  processingStage: '',
  currentResult: null,
  recentResults: [],
  
  // User state
  user: null,
  isLoggedIn: false,
  selectedModel: 'GPT-3.5-turbo', // Default free model
  
  settings: {
    hotkey: 'Alt+Space',
    aiProvider: 'openai',
    autoCapture: true,
    theme: 'system',
  },

  // Actions
  setPermissions: (permissions) => set({ hasPermissions: permissions }),
  
  setUser: (user) => set({ 
    user, 
    isLoggedIn: !!user,
    // Set default model based on tier
    selectedModel: user?.tier.tier === 'free' ? 'GPT-3.5-turbo' : 
                  user?.tier.tier === 'premium' ? 'GPT-4o-mini' :
                  user?.tier.tier === 'pro' ? 'GPT-4o' : 'GPT-4o 32k'
  }),
  
  setSelectedModel: (model) => set({ selectedModel: model }),
  
  setProcessing: (processing) => set({ isProcessing: processing }),
  
  setProcessingStage: (stage) => set({ processingStage: stage }),
  
  setCurrentResult: (result) => set({ currentResult: result }),
  
  addResult: (result) => set((state) => ({
    recentResults: [result, ...state.recentResults.slice(0, 9)] // Keep last 10 results
  })),
  
  clearResults: () => set({ recentResults: [], currentResult: null }),
  
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),
})); 