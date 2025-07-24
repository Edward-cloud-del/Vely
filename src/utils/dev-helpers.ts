import UserService from '../services/user-service';
import { useAppStore } from '../stores/app-store';

// Development helper functions for testing the new UI features
export class DevHelpers {
  
  // Test different subscription tiers
  static async testTier(tier: 'free' | 'premium' | 'pro' | 'enterprise') {
    try {
      const updatedUser = await UserService.upgradeUserTier(tier);
      const { setUser } = useAppStore.getState();
      setUser(updatedUser);
      
      console.log(`🧪 DEV: Switched to ${tier} tier`);
      console.log(`🎯 Available models: ${this.getAvailableModels(tier).join(', ')}`);
      console.log(`📊 Daily limit: ${updatedUser.tier.dailyLimit} requests`);
      console.log(`⏳ Remaining: ${updatedUser.tier.remainingRequests} requests`);
      
      return updatedUser;
    } catch (error) {
      console.error('❌ DEV: Failed to switch tier:', error);
      throw error;
    }
  }
  
  // Get available models for a tier
  static getAvailableModels(tier: 'free' | 'premium' | 'pro' | 'enterprise'): string[] {
    const modelsByTier = {
      free: ['GPT-3.5-turbo', 'Gemini Flash'],
      premium: ['GPT-4o-mini', 'Claude 3 Haiku', 'Gemini Pro'],
      pro: ['GPT-4o', 'Claude 3.5 Sonnet', 'Gemini Ultra', 'Llama 3.1 70B'],
      enterprise: ['GPT-4o 32k', 'Claude 3 Opus', 'Gemini Ultra Pro', 'Llama 3.1 405B']
    };
    
    // Return cumulative models (all tiers up to current)
    const tiers = ['free', 'premium', 'pro', 'enterprise'];
    const tierIndex = tiers.indexOf(tier);
    const availableModels: string[] = [];
    
    for (let i = 0; i <= tierIndex; i++) {
      availableModels.push(...modelsByTier[tiers[i] as keyof typeof modelsByTier]);
    }
    
    return availableModels;
  }
  
  // Test the upgrade flow
  static testUpgradeFlow() {
    console.log('🧪 DEV: Testing upgrade flow...');
    	  console.log('🔗 Opening payment page: https://framesense.vercel.app/payments');
  window.open('https://framesense.vercel.app/payments', '_blank');
  }
  
  // Test model selector
  static testModelSelector() {
    const { setShowModelSelector } = useAppStore.getState();
    setShowModelSelector(true);
    console.log('🧪 DEV: Model selector opened');
  }
  
  // Reset user usage for testing
  static async resetUsage() {
    try {
      const { user, setUser } = useAppStore.getState();
      if (user) {
        const updatedUser = { 
          ...user, 
          tier: { 
            ...user.tier, 
            remainingRequests: user.tier.dailyLimit 
          } 
        };
        await UserService.upgradeUserTier(updatedUser.tier.tier);
        setUser(updatedUser);
        console.log('🧪 DEV: Usage reset to full limit');
      }
    } catch (error) {
      console.error('❌ DEV: Failed to reset usage:', error);
    }
  }
  
  // Log current state for debugging
  static logCurrentState() {
    const { user, selectedModel, isLoggedIn } = useAppStore.getState();
    console.log('🧪 DEV: Current App State');
    console.log('=========================');
    console.log(`👤 User: ${user?.name} (${user?.email})`);
    console.log(`🎯 Tier: ${user?.tier.tier}`);
    console.log(`🤖 Model: ${selectedModel}`);
    console.log(`📊 Usage: ${user?.tier.remainingRequests}/${user?.tier.dailyLimit}`);
    console.log(`🔐 Logged In: ${isLoggedIn}`);
    console.log(`🔑 Token: ${user?.token?.substring(0, 20)}...`);
  }
}

// Make available in global scope for console testing
if (typeof window !== 'undefined') {
  (window as any).DevHelpers = DevHelpers;
}

export default DevHelpers; 