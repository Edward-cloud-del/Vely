import { invoke } from '@tauri-apps/api/core';

export interface User {
    id: string;
    email: string;
    name: string;
    tier: string;
    subscription_status: string;
    stripe_customer_id?: string;
    usage_daily: number;
    usage_total: number;
    created_at: string;
    updated_at: string;
    token?: string;
}

class AuthService {
    private currentUser: User | null = null;
    private authListeners: Array<(user: User | null) => void> = [];
    private apiUrl = 'http://localhost:8080'; // Change this to your Railway URL when deployed
    private sessionKey = 'framesense_user_session';


    async initialize() {
        // Load current user from local storage
        await this.loadCurrentUser();
    }

    async loginWithDatabase(email: string, password: string): Promise<User> {
        try {
            console.log('🔐 Logging in user with backend API:', email);
            
            // Use backend API instead of direct database call
            const response = await fetch(`${this.apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            if (!data.success || !data.user) {
                throw new Error('Invalid response from server');
            }

            const user = data.user;
            // Add the token to the user object (backend returns it separately)
            user.token = data.token;
            this.currentUser = user;
            
            console.log('🔍 DEBUG: About to save user session:', {
                email: user.email,
                tier: user.tier,
                hasToken: !!user.token,
                tokenLength: user.token ? user.token.length : 0
            });
            
            // Save user session to BOTH Tauri storage AND localStorage
            try {
                // Convert user to Tauri-compatible format
                const tauriUser = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    tier: user.tier,
                    token: user.token,
                    usage: {
                        daily: user.usage_daily || 0,
                        total: user.usage_total || 0,
                        last_reset: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
                    },
                    created_at: user.created_at,
                    subscription_status: user.subscription_status,
                    stripe_customer_id: user.stripe_customer_id,
                    usage_daily: user.usage_daily,
                    usage_total: user.usage_total,
                    updated_at: user.updated_at
                };
                
                console.log('🔍 DEBUG: Converted user for Tauri:', {
                    email: tauriUser.email,
                    tier: tauriUser.tier,
                    hasUsage: !!tauriUser.usage,
                    usageDaily: tauriUser.usage.daily
                });
                
                // @ts-ignore - invoke is available in Tauri context
                await invoke('save_user_session', { user: tauriUser });
                console.log('✅ DEBUG: User session saved to Tauri storage successfully');
            } catch (error) {
                console.error('❌ DEBUG: Failed to save to Tauri storage:', error);
                console.log('ℹ️ DEBUG: Using localStorage only as fallback');
            }
            
            this.saveUserSessionLocal(user);
            console.log('✅ DEBUG: User session saved to localStorage');
            
            // Notify listeners
            this.notifyAuthListeners(user);
            
            console.log('✅ User logged in successfully:', user.email, user.tier);
            return user;
        } catch (error) {
            console.error('❌ Login failed:', error);
            throw new Error(`Login failed: ${error}`);
        }
    }

    async logout(): Promise<void> {
        console.log('🔍 DEBUG: logout() called');
        try {
            // Clear Tauri session first
            try {
                // @ts-ignore - invoke is available in Tauri context
                await invoke('clear_user_session');
                console.log('✅ DEBUG: Tauri session cleared successfully');
            } catch (error) {
                console.log('❌ DEBUG: Tauri session clear failed:', error);
            }
            
            // Clear user session locally
            this.clearUserSessionLocal();
            this.currentUser = null;
            console.log('🔍 DEBUG: Set currentUser to null');
            
            // Notify listeners
            this.notifyAuthListeners(null);
            console.log('✅ DEBUG: Notified auth listeners with null');
            
            console.log('🚪 DEBUG: User logged out successfully');
        } catch (error) {
            console.error('❌ DEBUG: Logout failed:', error);
            throw new Error(`Logout failed: ${error}`);
        }
    }

    async loadCurrentUser(): Promise<User | null> {
        console.log('🔍 DEBUG: Starting loadCurrentUser()...');
        try {
            // First try to load from Tauri storage (more reliable)
            let user: User | null = null;
            
            console.log('🔍 DEBUG: Attempting to load from Tauri storage...');
            try {
                // @ts-ignore - invoke is available in Tauri context
                const tauriUser: any = await invoke('load_user_session');
                if (tauriUser) {
                    console.log('✅ DEBUG: Raw user from Tauri storage:', {
                        email: tauriUser.email, 
                        tier: tauriUser.tier,
                        hasToken: !!tauriUser.token,
                        hasUsage: !!tauriUser.usage,
                        usageFormat: typeof tauriUser.usage
                    });
                    
                    // Convert from Tauri format back to JavaScript format
                    user = {
                        id: tauriUser.id,
                        email: tauriUser.email,
                        name: tauriUser.name,
                        tier: tauriUser.tier,
                        token: tauriUser.token,
                        created_at: tauriUser.created_at,
                        subscription_status: tauriUser.subscription_status,
                        stripe_customer_id: tauriUser.stripe_customer_id,
                        usage_daily: tauriUser.usage?.daily || tauriUser.usage_daily || 0,
                        usage_total: tauriUser.usage?.total || tauriUser.usage_total || 0,
                        updated_at: tauriUser.updated_at
                    };
                    
                    console.log('✅ DEBUG: Converted user from Tauri:', {
                        email: user.email, 
                        tier: user.tier,
                        hasToken: !!user.token,
                        usageDaily: user.usage_daily
                    });
                    
                    // Sync to localStorage as backup
                    if (user) {
                        this.saveUserSessionLocal(user);
                    }
                } else {
                    console.log('❌ DEBUG: Tauri storage returned null/undefined');
                }
            } catch (tauriError) {
                console.log('❌ DEBUG: Tauri session failed with error:', tauriError);
                console.log('🔍 DEBUG: Trying localStorage fallback...');
                // Fallback to localStorage
                user = this.loadUserSessionLocal();
                if (user) {
                    console.log('✅ DEBUG: Loaded user session from localStorage:', {
                        email: user.email, 
                        tier: user.tier,
                        hasToken: !!user.token,
                        tokenLength: user.token ? user.token.length : 0
                    });
                } else {
                    console.log('❌ DEBUG: localStorage also returned null');
                }
            }
            
            this.currentUser = user;
            console.log('🔍 DEBUG: Set currentUser to:', user ? `${user.email} (${user.tier})` : 'null');
            
            if (user) {
                // Notify listeners
                this.notifyAuthListeners(user);
                console.log('✅ DEBUG: Notified auth listeners with user');
            } else {
                this.notifyAuthListeners(null);
                console.log('⚠️ DEBUG: Notified auth listeners with null user');
            }
            
            return user;
        } catch (error) {
            console.error('❌ DEBUG: loadCurrentUser failed with error:', error);
            return null;
        }
    }

    async refreshUserStatus(): Promise<User | null> {
        try {
            if (!this.currentUser) {
                return null;
            }

            // Verify user status with backend API
            const response = await fetch(`${this.apiUrl}/api/auth/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.currentUser.token}`, // Use JWT token for auth
                },
            });

            if (!response.ok) {
                // If verification fails, clear local session
                await this.logout();
                return null;
            }

            const data = await response.json();
            if (data.success && data.user) {
                const freshUser = data.user;
                
                // Update local session if tier changed
                if (freshUser.tier !== this.currentUser.tier) {
                    console.log('🔄 User tier updated:', this.currentUser.tier, '→', freshUser.tier);
                    // Save to BOTH Tauri storage AND localStorage when tier changes
                    try {
                        // Convert freshUser to Tauri-compatible format
                        const tauriUser = {
                            id: freshUser.id,
                            email: freshUser.email,
                            name: freshUser.name,
                            tier: freshUser.tier,
                            token: this.currentUser.token, // Keep existing token
                            usage: {
                                daily: freshUser.usage_daily || 0,
                                total: freshUser.usage_total || 0,
                                last_reset: new Date().toISOString().split('T')[0]
                            },
                            created_at: freshUser.created_at,
                            subscription_status: freshUser.subscription_status,
                            stripe_customer_id: freshUser.stripe_customer_id,
                            usage_daily: freshUser.usage_daily,
                            usage_total: freshUser.usage_total,
                            updated_at: freshUser.updated_at
                        };
                        
                        // @ts-ignore - invoke is available in Tauri context
                        await invoke('save_user_session', { user: tauriUser });
                        console.log('✅ DEBUG: Updated tier saved to Tauri storage');
                    } catch (error) {
                        console.error('❌ DEBUG: Failed to save tier update to Tauri storage:', error);
                    }
                    this.saveUserSessionLocal(freshUser);
                }
                
                this.currentUser = freshUser;
                this.notifyAuthListeners(freshUser);
                return freshUser;
            }
            
            return this.currentUser;
        } catch (error) {
            console.error('❌ Failed to refresh user status:', error);
            return null;
        }
    }

    // Local storage helper methods
    private saveUserSessionLocal(user: User): void {
        try {
            console.log('🔍 DEBUG: Saving to localStorage with key:', this.sessionKey);
            const userToSave = JSON.stringify(user);
            localStorage.setItem(this.sessionKey, userToSave);
            console.log('✅ DEBUG: User session saved to localStorage successfully:', {
                email: user.email,
                tier: user.tier,
                dataLength: userToSave.length
            });
        } catch (error) {
            console.error('❌ DEBUG: Failed to save user session to localStorage:', error);
        }
    }

    private loadUserSessionLocal(): User | null {
        try {
            console.log('🔍 DEBUG: Loading from localStorage with key:', this.sessionKey);
            const userJson = localStorage.getItem(this.sessionKey);
            console.log('🔍 DEBUG: localStorage raw data:', userJson ? 'Found data' : 'No data found');
            
            if (userJson) {
                const user: User = JSON.parse(userJson);
                console.log('✅ DEBUG: User session loaded from localStorage:', {
                    email: user.email,
                    tier: user.tier,
                    hasToken: !!user.token,
                    dataLength: userJson.length
                });
                return user;
            }
            console.log('❌ DEBUG: No user data found in localStorage');
            return null;
        } catch (error) {
            console.error('❌ DEBUG: Failed to load user session from localStorage:', error);
            return null;
        }
    }

    private clearUserSessionLocal(): void {
        try {
            console.log('🔍 DEBUG: Clearing localStorage with key:', this.sessionKey);
            localStorage.removeItem(this.sessionKey);
            console.log('✅ DEBUG: User session cleared from localStorage');
        } catch (error) {
            console.error('❌ DEBUG: Failed to clear user session from localStorage:', error);
        }
    }

    getCurrentUser(): User | null {
        return this.currentUser;
    }

    isLoggedIn(): boolean {
        return this.currentUser !== null;
    }

    getUserTier(): string {
        return this.currentUser?.tier || 'free';
    }

    async getAvailableModels(tier?: string): Promise<string[]> {
        try {
            const userTier = tier || this.getUserTier();
            const models = await invoke<string[]>('get_available_models', { userTier });
            return models;
        } catch (error) {
            console.error('❌ Failed to get available models:', error);
            return ['GPT-3.5-turbo']; // Fallback
        }
    }

    async canUseModel(model: string, tier?: string): Promise<boolean> {
        try {
            const userTier = tier || this.getUserTier();
            const canUse = await invoke<boolean>('can_use_model', { userTier, model });
            return canUse;
        } catch (error) {
            console.error('❌ Failed to check model access:', error);
            return false;
        }
    }

    // Get required tier for a specific model
    getRequiredTier(model: string): string {
        if (['GPT-4o 32k', 'Claude 3 Opus', 'Llama 3.1 405B'].includes(model)) {
            return 'enterprise';
        } else if (['GPT-4o', 'Claude 3.5 Sonnet', 'Llama 3.1 70B'].includes(model)) {
            return 'pro';
        } else if (['GPT-4o-mini', 'Claude 3 Haiku', 'Gemini Pro'].includes(model)) {
            return 'premium';
        } else {
            return 'free';
        }
    }

    // Get daily limit for user tier
    getDailyLimit(tier?: string): number {
        const userTier = tier || this.getUserTier();
        switch (userTier) {
            case 'free': return 50;
            case 'premium': return 1000;
            case 'pro': return 5000;
            case 'enterprise': return 999999; // Unlimited
            default: return 10;
        }
    }

    // Get usage percentage
    getUsagePercentage(): number {
        if (!this.currentUser) return 0;
        const daily = this.currentUser.usage_daily || 0;
        const limit = this.getDailyLimit();
        return Math.min(100, (daily / limit) * 100);
    }

    // Verify payment status (for manual checking)
    async verifyPaymentStatus(): Promise<User | null> {
        try {
            if (!this.currentUser) return null;
            
            // Refresh user status to get latest tier
            const updatedUser = await this.refreshUserStatus();
            return updatedUser;
        } catch (error) {
            console.error('❌ Failed to verify payment status:', error);
            return null;
        }
    }

    // Auth state listeners for UI updates
    addAuthListener(callback: (user: User | null) => void): void {
        this.authListeners.push(callback);
    }

    removeAuthListener(callback: (user: User | null) => void): void {
        this.authListeners = this.authListeners.filter(listener => listener !== callback);
    }

    private notifyAuthListeners(user: User | null): void {
        this.authListeners.forEach(listener => {
            try {
                listener(user);
            } catch (error) {
                console.error('❌ Error in auth listener:', error);
            }
        });
    }

    // Payment and upgrade functionality
    openUpgradePage(plan?: string): void {
        const baseUrl = 'https://framesense.vercel.app'; // Hardcoded for simplicity
        const upgradeUrl = plan 
            ? `${baseUrl}/payments?plan=${plan}`
            : `${baseUrl}/payments`;
        
        console.log('🔗 Opening upgrade page:', upgradeUrl);
        window.open(upgradeUrl, '_blank');
    }

    // DEBUG: Manual session check function
    async debugCheckSessions(): Promise<void> {
        console.log('🔍 DEBUG: === MANUAL SESSION CHECK ===');
        console.log('🔍 DEBUG: Current user in memory:', this.currentUser ? `${this.currentUser.email} (${this.currentUser.tier})` : 'null');
        
        // Check localStorage
        console.log('🔍 DEBUG: Checking localStorage...');
        const localUser = this.loadUserSessionLocal();
        console.log('🔍 DEBUG: localStorage result:', localUser ? `${localUser.email} (${localUser.tier})` : 'null');
        
        // Check Tauri storage
        console.log('🔍 DEBUG: Checking Tauri storage...');
        try {
            // @ts-ignore - invoke is available in Tauri context
            const tauriUser: any = await invoke('load_user_session');
            if (tauriUser) {
                console.log('🔍 DEBUG: Tauri storage result:', `${tauriUser.email} (${tauriUser.tier})`);
                console.log('🔍 DEBUG: Tauri user structure:', {
                    hasUsage: !!tauriUser.usage,
                    usageDaily: tauriUser.usage?.daily,
                    usageDailyField: tauriUser.usage_daily
                });
            } else {
                console.log('🔍 DEBUG: Tauri storage result: null');
            }
        } catch (error) {
            console.log('❌ DEBUG: Tauri storage error:', error);
        }
        
        console.log('🔍 DEBUG: === END SESSION CHECK ===');
    }
}

// Export singleton instance
export const authService = new AuthService();

// Initialize when imported
authService.initialize().catch(error => {
    console.error('❌ Failed to initialize auth service:', error);
});

// DEBUG: Expose debug function globally for browser console
if (typeof window !== 'undefined') {
    (window as any).debugCheckSessions = () => authService.debugCheckSessions();
    console.log('🔍 DEBUG: Global debugCheckSessions() function available in browser console');
} 