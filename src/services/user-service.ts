import { User } from '../../../src/stores/app-store';

class UserService {
  private static instance: UserService;
  
  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  // Mock user for testing - will be replaced with real authentication
  getMockUser(): User {
    return {
      id: 'mock-user-id',
      email: 'test@framesense.se',
      name: 'Test User',
      tier: {
        tier: 'free',
        remainingRequests: 42,
        dailyLimit: 50,
        customerId: undefined,
        subscriptionId: undefined
      },
      token: 'mock-jwt-token'
    };
  }

  // Initialize mock user (temporary)
  async initializeMockUser(): Promise<User> {
    const user = this.getMockUser();
    
    // Store in localStorage for persistence across app restarts
    localStorage.setItem('framesense_user', JSON.stringify(user));
    localStorage.setItem('framesense_token', user.token);
    
    return user;
  }

  // Load user from localStorage
  async loadStoredUser(): Promise<User | null> {
    try {
      const storedUser = localStorage.getItem('framesense_user');
      const storedToken = localStorage.getItem('framesense_token');
      
      if (storedUser && storedToken) {
        const user = JSON.parse(storedUser);
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading stored user:', error);
      return null;
    }
  }

  // Clear user session
  async logout(): Promise<void> {
    localStorage.removeItem('framesense_user');
    localStorage.removeItem('framesense_token');
  }

  // Simulate different subscription tiers for testing
  async upgradeUserTier(newTier: 'free' | 'premium' | 'pro' | 'enterprise'): Promise<User> {
    const user = this.getMockUser();
    
    // Update tier and limits
    switch (newTier) {
      case 'free':
        user.tier = { tier: 'free', remainingRequests: 42, dailyLimit: 50 };
        break;
      case 'premium':
        user.tier = { tier: 'premium', remainingRequests: 856, dailyLimit: 1000 };
        break;
      case 'pro':
        user.tier = { tier: 'pro', remainingRequests: 4234, dailyLimit: 5000 };
        break;
      case 'enterprise':
        user.tier = { tier: 'enterprise', remainingRequests: 999999, dailyLimit: 999999 };
        break;
    }
    
    // Store updated user
    localStorage.setItem('framesense_user', JSON.stringify(user));
    
    return user;
  }

  // Simulate usage tracking
  async updateUsage(requestsUsed: number = 1): Promise<User> {
    const storedUser = await this.loadStoredUser();
    if (!storedUser) return this.getMockUser();
    
    storedUser.tier.remainingRequests = Math.max(0, storedUser.tier.remainingRequests - requestsUsed);
    
    localStorage.setItem('framesense_user', JSON.stringify(storedUser));
    
    return storedUser;
  }
}

export default UserService.getInstance(); 