import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../src/database/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';

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
}

export interface UserWithToken extends User {
    token: string;
}

class UserService {
    async createUser(email: string, password: string, name: string): Promise<UserWithToken> {
        console.log('🔍 Creating user:', email, name);
        console.log('🔍 Email length:', email.length);
        console.log('🔍 Name length:', name.length);
        console.log('🔍 Password length:', password.length);
        
        // Check if user exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        console.log('🔍 Existing user check result:', existingUser.rows.length, 'rows');
        
        if (existingUser.rows.length > 0) {
            throw new Error('User already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);
        console.log('🔍 Password hash length:', passwordHash.length);

        // Determine tier based on email - NEVER CREATE FREE ACCOUNTS
        let tier = 'premium'; // Default to premium tier (no more free accounts)
        
        if (email.includes('pro-user') || email.includes('pro@') || email.includes('test.dev')) {
            tier = 'pro';
            console.log('🎯 AUTO-ASSIGNED PRO TIER for test user:', email);
        } else if (email.includes('premium') || email.includes('admin') || email.includes('celebrity') || email.includes('vision')) {
            tier = 'premium';
            console.log('🎯 AUTO-ASSIGNED PREMIUM TIER for test user:', email);
        } else {
            // Default all new accounts to premium for testing premium features
            tier = 'premium';
            console.log('🎯 AUTO-ASSIGNED PREMIUM TIER (default) for user:', email);
        }

        // Insert user with proper tier
        console.log('🔍 Attempting to insert user with email length:', email.length, 'name length:', name.length, 'tier:', tier);
        const result = await query(
            `INSERT INTO users (email, name, password_hash, tier) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, email, name, tier, subscription_status, stripe_customer_id, 
                       usage_daily, usage_total, created_at, updated_at`,
            [email, name, passwordHash, tier]
        );

        const user = result.rows[0];

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Save session
        await this.saveSession(user.id, token);

        return { ...user, token };
    }

    async loginUser(email: string, password: string): Promise<UserWithToken> {
        // Get user
        const result = await query(
            `SELECT id, email, name, password_hash, tier, subscription_status, 
                    stripe_customer_id, usage_daily, usage_total, created_at, updated_at
             FROM users WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            throw new Error('Invalid credentials');
        }

        const user = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Save session
        await this.saveSession(user.id, token);

        // Remove password_hash from response
        const { password_hash, ...userWithoutPassword } = user;
        return { ...userWithoutPassword, token };
    }

    async verifyToken(token: string): Promise<User> {
        try {
            // Verify JWT
            const decoded = jwt.verify(token, JWT_SECRET) as any;

            // Check if session exists and is not expired
            const sessionResult = await query(
                `SELECT s.id FROM user_sessions s 
                 WHERE s.user_id = $1 AND s.expires_at > NOW()`,
                [decoded.userId]
            );

            if (sessionResult.rows.length === 0) {
                throw new Error('Session expired');
            }

            // Get fresh user data
            const userResult = await query(
                `SELECT id, email, name, tier, subscription_status, stripe_customer_id,
                        usage_daily, usage_total, created_at, updated_at
                 FROM users WHERE id = $1`,
                [decoded.userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            return userResult.rows[0];
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    async updateUserTier(email: string, tier: string, subscriptionStatus?: string): Promise<void> {
        const updates = ['tier = $2'];
        const params = [email, tier];

        if (subscriptionStatus) {
            updates.push('subscription_status = $3');
            params.push(subscriptionStatus);
        }

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE email = $1`,
            params
        );
    }

    async updateUserStripeCustomerId(email: string, stripeCustomerId: string): Promise<void> {
        await query(
            'UPDATE users SET stripe_customer_id = $2 WHERE email = $1',
            [email, stripeCustomerId]
        );
    }

    async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
        const result = await query(
            `SELECT id, email, name, tier, subscription_status, stripe_customer_id,
                    usage_daily, usage_total, created_at, updated_at
             FROM users WHERE stripe_customer_id = $1`,
            [stripeCustomerId]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    async getUserById(userId: string): Promise<User | null> {
        const result = await query(
            `SELECT id, email, name, tier, subscription_status, stripe_customer_id,
                    usage_daily, usage_total, created_at, updated_at
             FROM users WHERE id = $1`,
            [userId]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    async getUserByEmail(email: string): Promise<User | null> {
        const result = await query(
            `SELECT id, email, name, tier, subscription_status, stripe_customer_id,
                    usage_daily, usage_total, created_at, updated_at
             FROM users WHERE email = $1`,
            [email]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    async saveSession(userId: string, token: string): Promise<void> {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await query(
            'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [userId, tokenHash, expiresAt]
        );
    }

    async logoutUser(token: string): Promise<void> {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            await query(
                'DELETE FROM user_sessions WHERE user_id = $1',
                [decoded.userId]
            );
        } catch (error) {
            // Token might be invalid, but that's okay for logout
        }
    }

    async cleanupExpiredSessions(): Promise<void> {
        await query('DELETE FROM user_sessions WHERE expires_at < NOW()');
    }
}

export default new UserService(); 