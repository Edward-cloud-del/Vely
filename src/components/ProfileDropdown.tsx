import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { authService, type User } from '../services/auth-service-db';

interface ProfileDropdownProps {
    currentUser: User | null;
    debugMode: boolean;
    onLoginSuccess: (user: User) => void | Promise<void>;
    onLogout: () => void;
    onUserUpdate: (user: User) => void;
    clearUserSession: () => void;
    refreshUserSession: () => void;
    clearPaymentFile: () => void;
    testStatusCheck: () => void;
    testPaymentsPage: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
    currentUser,
    debugMode,
    onLoginSuccess,
    onLogout,
    onUserUpdate,
    clearUserSession,
    refreshUserSession,
    clearPaymentFile,
    testStatusCheck,
    testPaymentsPage,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showLoginForm, setShowLoginForm] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle window resizing when dropdown opens/closes
    useEffect(() => {
        const resizeWindow = async () => {
            try {
                if (isOpen && dropdownRef.current) {
                    // Calculate required height based on dropdown content
                    const dropdownHeight = dropdownRef.current.scrollHeight;
                    const minHeight = Math.max(600, dropdownHeight + 100); // Add padding
                    
                    await invoke('resize_window', { 
                        width: 600, 
                        height: minHeight 
                    });
                    console.log('✅ Window resized for ProfileDropdown:', minHeight);
                } else if (!isOpen) {
                    // Reset to small size when closed
                    await invoke('resize_window', { 
                        width: 600, 
                        height: 50
                    });
                    console.log('✅ Window reset to small size');
                }
            } catch (error) {
                console.error('❌ Failed to resize window:', error);
            }
        };

        // Small delay to ensure DOM is updated
        const timer = setTimeout(resizeWindow, 100);
        return () => clearTimeout(timer);
    }, [isOpen, showLoginForm, currentUser]);

    const handleToggleOpen = () => {
        const newIsOpen = !isOpen;
        setIsOpen(newIsOpen);
        if (newIsOpen) {
            setShowLoginForm(false);
            setError('');
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const user = await authService.loginWithDatabase(email, password);
            await Promise.resolve(onLoginSuccess(user));
            setShowLoginForm(false);
            setEmail('');
            setPassword('');
            setIsOpen(false);
        } catch (error) {
            setError(error as string);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await authService.logout();
            onLogout();
            setIsOpen(false);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const handleRefreshStatus = async () => {
        try {
            const updatedUser = await authService.refreshUserStatus();
            if (updatedUser && currentUser && updatedUser.tier !== currentUser.tier) {
                onUserUpdate(updatedUser);
                alert(`🎉 Status updated! You now have ${updatedUser.tier} access!`);
            }
        } catch (error) {
            console.error('Failed to refresh status:', error);
        }
    };

    const openRegistrationPage = () => {
        window.open('https://api.finalyze.pro', '_blank');
    };

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'premium': return 'text-blue-300 bg-blue-500/20';
            case 'pro': return 'text-purple-300 bg-purple-500/20';
            case 'enterprise': return 'text-yellow-300 bg-yellow-500/20';
            default: return 'text-gray-300 bg-gray-500/20';
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleToggleOpen}
                className="flex items-center space-x-1 p-0.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title={currentUser ? `${currentUser.name} (${currentUser.tier})` : 'Profile & Settings'}
            >
                <span className="text-lg">👤</span>
                {currentUser && (
                    <span className={`px-1 py-0.2 rounded text-xs font-medium ${getTierColor(currentUser.tier)}`}>
                        {currentUser.tier.charAt(0).toUpperCase() + currentUser.tier.slice(1)}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div ref={dropdownRef} className="absolute left-1/1 transform -translate-x-3/3 top-full mt-2 w-80 bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 shadow-xl z-50">
                        {currentUser ? (
                            // Logged in user view
                            <>
                                <div className="p-4 border-b border-white/10">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                            {currentUser.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">{currentUser.name}</div>
                                            <div className="text-white/60 text-sm">{currentUser.email}</div>
                                        </div>
                                    </div>
                                    <div className={`mt-2 px-2 py-1 rounded text-xs font-medium ${getTierColor(currentUser.tier)} text-center`}>
                                        {currentUser.tier.charAt(0).toUpperCase() + currentUser.tier.slice(1)} Plan
                                    </div>
                                </div>

                                <div className="p-2">
                                    <button
                                        onClick={handleRefreshStatus}
                                        className="w-full flex items-center space-x-2 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <span>🔄</span>
                                        <span>Refresh Status</span>
                                    </button>

                                    <button
                                        onClick={() => window.open('https://api.finalyze.pro/account', '_blank')}
                                        className="w-full flex items-center space-x-2 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <span>🌐</span>
                                        <span>Manage Subscription</span>
                                    </button>

                                    {debugMode && (
                                        <>
                                            <hr className="my-2 border-white/10" />
                                            <div className="text-white/60 text-xs px-2 py-1">Debug Tools</div>
                                            
                                            <button
                                                onClick={clearUserSession}
                                                className="w-full flex items-center space-x-2 p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition-colors"
                                            >
                                                <span>🗑️</span>
                                                <span>Clear Session</span>
                                            </button>

                                            <button
                                                onClick={testStatusCheck}
                                                className="w-full flex items-center space-x-2 p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
                                            >
                                                <span>💳</span>
                                                <span>Test Status Check</span>
                                            </button>

                                            <button
                                                onClick={testPaymentsPage}
                                                className="w-full flex items-center space-x-2 p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                            >
                                                <span>🌐</span>
                                                <span>Test Payments</span>
                                            </button>
                                        </>
                                    )}

                                    <hr className="my-2 border-white/10" />

                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center space-x-2 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <span>🚪</span>
                                        <span>Logout</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            // Not logged in view
                            <>
                                <div className="p-4 border-b border-white/10">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gray-500/30 rounded-full flex items-center justify-center text-white/60">
                                            👤
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">Not Logged In</div>
                                            <div className="text-white/60 text-sm">Free tier access</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4">
                                    {!showLoginForm ? (
                                        <>
                                            <button
                                                onClick={() => setShowLoginForm(true)}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors mb-3"
                                            >
                                                🔑 Login to Premium
                                            </button>
                                            
                                            <button
                                                onClick={openRegistrationPage}
                                                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                                            >
                                                📝 Create Account
                                            </button>

                                            {debugMode && (
                                                <>
                                                    <hr className="my-3 border-white/10" />
                                                    <div className="text-white/60 text-xs mb-2">Debug Tools</div>
                                                    
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={refreshUserSession}
                                                            className="flex items-center justify-center space-x-1 p-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                        >
                                                            <span>🔄</span>
                                                            <span>Refresh</span>
                                                        </button>

                                                        <button
                                                            onClick={clearPaymentFile}
                                                            className="flex items-center justify-center space-x-1 p-2 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition-colors"
                                                        >
                                                            <span>🗑️</span>
                                                            <span>Clear</span>
                                                        </button>

                                                        <button
                                                            onClick={testStatusCheck}
                                                            className="flex items-center justify-center space-x-1 p-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
                                                        >
                                                            <span>💳</span>
                                                            <span>Status</span>
                                                        </button>

                                                        <button
                                                            onClick={testPaymentsPage}
                                                            className="flex items-center justify-center space-x-1 p-2 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                                                        >
                                                            <span>🌐</span>
                                                            <span>Payments</span>
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        // Login form
                                        <form onSubmit={handleLogin} className="space-y-3">
                                            <div>
                                                <label className="block text-white/80 text-sm mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm"
                                                    placeholder="your@email.com"
                                                    required
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="block text-white/80 text-sm mb-1">Password</label>
                                                <input
                                                    type="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm"
                                                    placeholder="Password"
                                                    required
                                                />
                                            </div>
                                            
                                            {error && (
                                                <div className="text-red-400 text-sm">{error}</div>
                                            )}
                                            
                                            <div className="flex space-x-2">
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                                                >
                                                    {loading ? 'Logging in...' : 'Login'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowLoginForm(false)}
                                                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ProfileDropdown; 