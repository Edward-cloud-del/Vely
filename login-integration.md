# 🚀 FrameSense PostgreSQL Migration - Complete Implementation Guide

## 📋 **Current State Analysis**

### **What We Have Now:**
- ✅ **Backend**: Node.js/Express with JSON file storage (`backend/data/users.json`)
- ✅ **Website**: Payment integration with Stripe webhooks
- ✅ **Tauri App**: Desktop app with auth service and AI features
- ✅ **Payment Flow**: Stripe → Webhook → JSON file update
- ❌ **Auto-login**: Complex file-based system that doesn't work reliably

### **What We're Building:**
- 🎯 **PostgreSQL Database**: Centralized user storage
- 🎯 **Optional Login**: Login button in Tauri app (no forced login)
- 🎯 **Persistent Sessions**: Stay logged in between app restarts
- 🎯 **Unified Auth**: Same credentials work on website and app

---

## 🗑️ **Phase 1: Cleanup - Remove Auto-Login Code**

### **Files to Clean Up:**

#### **1. Remove Payment File Logic from Backend**
**File:** `backend/src/routes/subscription.ts`
```typescript
// REMOVE these endpoints:
router.post('/save-payment-credentials', ...)  // Lines ~290-340
router.post('/simulate-payment-success', ...)  // Lines ~350-400

// KEEP everything else (webhooks, checkout, etc.)
```

#### **2. Remove Payment File Logic from Frontend**
**File:** `src/services/auth-service.ts`
```typescript
// REMOVE these methods:
private async checkPaymentFileAutoLogin()      // Lines ~347-372
async startPaymentPolling()                    // Lines ~391-439
stopPaymentPolling()                          // Lines ~441-451
private handlePaymentSuccess()                // Lines ~453-468
private showPaymentTimeoutMessage()           // Lines ~470-476

// REMOVE these properties:
private paymentPollingInterval: NodeJS.Timeout | null = null;
```

#### **3. Remove Payment File Logic from Tauri**
**File:** `src-tauri/src/main.rs`
```rust
// REMOVE these commands:
check_payment_file()                          // Lines ~600-630
check_payment_file_and_login()               // Lines ~632-680
clear_payment_file()                         // Lines ~682-695
```

#### **4. Remove Payment Waiting UI**
**Files to DELETE:**
- `src/components/PaymentWaiting.tsx`
- `src/components/PaymentWaiting.css`

**File:** `src/App.tsx`
```typescript
// REMOVE these imports:
import PaymentWaiting from './components/PaymentWaiting';

// REMOVE these state variables:
const [isWaitingForPayment, setIsWaitingForPayment] = useState(false);

// REMOVE these functions:
const handleUpgradeClick = async (plan?: string) => { ... }
const handleManualPaymentCheck = async () => { ... }
const handleCancelPaymentPolling = () => { ... }

// REMOVE this JSX:
<PaymentWaiting
  isVisible={isWaitingForPayment}
  onManualCheck={handleManualPaymentCheck}
  onCancel={handleCancelPaymentPolling}
/>
```

#### **5. Clean Success Page**
**File:** `website/success.html`
```html
<!-- REMOVE all JavaScript related to file saving -->
<!-- KEEP the basic success message and plan display -->
<!-- REMOVE the complex payment credentials saving logic -->
```

---

## 🗄️ **Phase 2: Setup PostgreSQL Database**

### **Step 1: Install PostgreSQL**
```bash
# macOS
brew install postgresql
brew services start postgresql

# Create database
createdb framesense

# Create user (optional)
psql framesense
CREATE USER framesense_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE framesense TO framesense_user;
```

### **Step 2: Create Database Schema**
**Create file:** `backend/database/schema.sql`
```sql
-- Users table (replaces users.json)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tier VARCHAR(50) DEFAULT 'free' CHECK (tier IN ('free', 'premium', 'pro', 'enterprise')),
    subscription_status VARCHAR(50) DEFAULT 'inactive',
    stripe_customer_id VARCHAR(255),
    usage_daily INTEGER DEFAULT 0,
    usage_total INTEGER DEFAULT 0,
    usage_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sessions for token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

### **Step 3: Run Schema Setup**
```bash
psql framesense < backend/database/schema.sql
```

---

## 🔧 **Phase 3: Backend Migration to PostgreSQL**

### **Step 1: Install Dependencies**
**File:** `backend/package.json`
```bash
cd backend
npm install pg @types/pg
```

### **Step 2: Database Connection**
**Create file:** `backend/src/database/connection.ts`
```typescript
import { Pool, PoolClient } from 'pg';

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'framesense',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getClient = (): Promise<PoolClient> => pool.connect();

export default pool;
```

### **Step 3: Environment Variables**
**File:** `backend/.env`
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=framesense
DB_USER=postgres
DB_PASSWORD=your_password

# Existing variables
JWT_SECRET=your-super-secret-key-change-this
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### **Step 4: New User Service**
**Create file:** `backend/src/services/user-service.ts`
```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection.js';

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
        // Check if user exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            throw new Error('User already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Insert user
        const result = await query(
            `INSERT INTO users (email, name, password_hash) 
             VALUES ($1, $2, $3) 
             RETURNING id, email, name, tier, subscription_status, stripe_customer_id, 
                       usage_daily, usage_total, created_at, updated_at`,
            [email, name, passwordHash]
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

    private async saveSession(userId: string, token: string): Promise<void> {
        const tokenHash = jwt.sign({ token }, JWT_SECRET);
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
```

### **Step 5: Update Auth Routes**
**File:** `backend/src/routes/auth.ts`
```typescript
import { Router, Request, Response } from 'express';
import UserService from '../services/user-service.js';

const router = Router();

// Register new user
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;
        
        if (!email || !password || !name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, password, and name are required' 
            });
        }

        // Basic validation
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 6 characters' 
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid email format' 
            });
        }
        
        const userWithToken = await UserService.createUser(email, password, name);
        
        res.json({ 
            success: true, 
            user: userWithToken,
            token: userWithToken.token 
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Login user
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password are required' 
            });
        }
        
        const userWithToken = await UserService.loginUser(email, password);
        
        res.json({ 
            success: true, 
            user: userWithToken,
            token: userWithToken.token 
        });
    } catch (error: any) {
        res.status(401).json({ success: false, message: error.message });
    }
});

// Verify token
router.get('/verify', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        
        const user = await UserService.verifyToken(token);
        res.json({ success: true, user });
    } catch (error: any) {
        res.status(401).json({ success: false, message: error.message });
    }
});

// Logout user
router.post('/logout', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
            await UserService.logoutUser(token);
        }
        
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
```

### **Step 6: Update Subscription Routes**
**File:** `backend/src/routes/subscription.ts`
```typescript
// Replace the existing auth service imports with:
import UserService from '../services/user-service.js';

// Update the authenticateUser middleware:
const authenticateUser = async (req: Request, res: Response, next: any) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        
        const user = await UserService.verifyToken(token);
        (req as any).user = user;
        next();
    } catch (error: any) {
        res.status(401).json({ success: false, message: error.message });
    }
};

// Update webhook handler to use UserService:
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    try {
        // ... existing webhook verification code ...

        // Handle checkout session completed (payment success)
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const userId = session.client_reference_id;
            const customerId = session.customer;
            
            if (userId) {
                console.log('💳 Payment successful for user:', userId);
                
                // Find user by ID and update tier
                const user = await UserService.getUserById(userId);
                
                if (user) {
                    // Update user tier to premium (can be enhanced based on price)
                    await UserService.updateUserTier(user.email, 'premium', 'active');
                    await UserService.updateUserStripeCustomerId(user.email, customerId);
                    
                    console.log(`✅ User ${user.email} upgraded to premium tier via webhook`);
                }
            }
        }
        
        res.json({ success: true, received: true });
    } catch (error: any) {
        console.error('❌ Webhook error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});

// Update check-status endpoint:
router.get('/check-status', authenticateUser, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        
        // Get fresh user data from database
        const currentUser = await UserService.getUserById(user.id);
        
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        console.log('✅ Status check for user:', user.email, 'tier:', currentUser.tier);
        
        res.json({
            success: true,
            user: currentUser
        });
    } catch (error: any) {
        console.error('❌ Status check error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Remove the old save-payment-credentials and simulate-payment-success endpoints
// They are no longer needed with the new architecture
```

---

## 🖥️ **Phase 4: Tauri App Integration**

### **Step 1: Add PostgreSQL Dependencies**
**File:** `src-tauri/Cargo.toml`
```toml
[dependencies]
# ... existing dependencies ...
tokio-postgres = "0.7"
deadpool-postgres = "0.10"
bcrypt = "0.14"
chrono = { version = "0.4", features = ["serde"] }
```

### **Step 2: Database Connection in Tauri**
**Create file:** `src-tauri/src/database/mod.rs`
```rust
use deadpool_postgres::{Config, Pool, Runtime};
use tokio_postgres::NoTls;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    pub tier: String,
    pub subscription_status: String,
    pub stripe_customer_id: Option<String>,
    pub usage_daily: i32,
    pub usage_total: i32,
    pub created_at: String,
    pub updated_at: String,
}

pub struct Database {
    pool: Pool,
}

impl Database {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let mut cfg = Config::new();
        cfg.host = Some("localhost".to_string());
        cfg.port = Some(5432);
        cfg.dbname = Some("framesense".to_string());
        cfg.user = Some("postgres".to_string());
        cfg.password = Some("password".to_string());
        
        let pool = cfg.create_pool(Some(Runtime::Tokio1), NoTls)?;
        
        Ok(Database { pool })
    }
    
    pub async fn verify_user(&self, email: &str, password: &str) -> Result<Option<User>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;
        
        let row = client
            .query_opt(
                "SELECT id, email, name, password_hash, tier, subscription_status, 
                        stripe_customer_id, usage_daily, usage_total, 
                        created_at, updated_at 
                 FROM users WHERE email = $1",
                &[&email],
            )
            .await?;
        
        if let Some(row) = row {
            let password_hash: String = row.get("password_hash");
            
            // Verify password
            if bcrypt::verify(password, &password_hash).unwrap_or(false) {
                let user = User {
                    id: row.get("id"),
                    email: row.get("email"),
                    name: row.get("name"),
                    tier: row.get("tier"),
                    subscription_status: row.get("subscription_status"),
                    stripe_customer_id: row.get("stripe_customer_id"),
                    usage_daily: row.get("usage_daily"),
                    usage_total: row.get("usage_total"),
                    created_at: row.get::<_, chrono::DateTime<chrono::Utc>>("created_at").to_rfc3339(),
                    updated_at: row.get::<_, chrono::DateTime<chrono::Utc>>("updated_at").to_rfc3339(),
                };
                
                return Ok(Some(user));
            }
        }
        
        Ok(None)
    }
    
    pub async fn get_user_by_id(&self, user_id: &str) -> Result<Option<User>, Box<dyn std::error::Error>> {
        let client = self.pool.get().await?;
        
        let row = client
            .query_opt(
                "SELECT id, email, name, tier, subscription_status, 
                        stripe_customer_id, usage_daily, usage_total, 
                        created_at, updated_at 
                 FROM users WHERE id = $1",
                &[&user_id],
            )
            .await?;
        
        if let Some(row) = row {
            let user = User {
                id: row.get("id"),
                email: row.get("email"),
                name: row.get("name"),
                tier: row.get("tier"),
                subscription_status: row.get("subscription_status"),
                stripe_customer_id: row.get("stripe_customer_id"),
                usage_daily: row.get("usage_daily"),
                usage_total: row.get("usage_total"),
                created_at: row.get::<_, chrono::DateTime<chrono::Utc>>("created_at").to_rfc3339(),
                updated_at: row.get::<_, chrono::DateTime<chrono::Utc>>("updated_at").to_rfc3339(),
            };
            
            return Ok(Some(user));
        }
        
        Ok(None)
    }
}
```

### **Step 3: Update Tauri Auth Commands**
**File:** `src-tauri/src/main.rs`
```rust
// Add these imports at the top
mod database;
use database::{Database, User};

// Add database to app state
type SharedDatabase = Arc<Mutex<Database>>;

// Replace the existing auth commands with:

#[tauri::command]
async fn login_user_db(
    email: String, 
    password: String,
    db: tauri::State<'_, SharedDatabase>,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<User, String> {
    println!("🔐 Attempting database login for: {}", email);
    
    let database = db.lock().unwrap();
    
    match database.verify_user(&email, &password).await {
        Ok(Some(user)) => {
            println!("✅ Database login successful: {} ({})", user.email, user.tier);
            
            // Save user session locally
            let service = {
                let guard = auth_service.lock().unwrap();
                guard.clone()
            };
            
            if let Err(e) = service.save_user_session(&user).await {
                println!("⚠️ Failed to save user session: {}", e);
            }
            
            Ok(user)
        },
        Ok(None) => {
            println!("❌ Invalid credentials for: {}", email);
            Err("Invalid email or password".to_string())
        },
        Err(e) => {
            println!("❌ Database error during login: {}", e);
            Err("Database connection error".to_string())
        }
    }
}

#[tauri::command]
async fn get_current_user_db(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<Option<User>, String> {
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    
    // Try to load from local session first
    match service.load_user_session().await {
        Ok(Some(user)) => {
            println!("📖 Loaded user session: {} ({})", user.email, user.tier);
            Ok(Some(user))
        },
        Ok(None) => {
            println!("ℹ️ No local user session found");
            Ok(None)
        },
        Err(e) => {
            println!("❌ Failed to load user session: {}", e);
            Ok(None)
        }
    }
}

#[tauri::command]
async fn logout_user_db(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<(), String> {
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    
    service.clear_user_session().await?;
    println!("🚪 User logged out");
    Ok(())
}

#[tauri::command]
async fn refresh_user_status_db(
    db: tauri::State<'_, SharedDatabase>,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<Option<User>, String> {
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    
    // Get current user from local session
    if let Ok(Some(local_user)) = service.load_user_session().await {
        let database = db.lock().unwrap();
        
        // Get fresh data from database
        match database.get_user_by_id(&local_user.id).await {
            Ok(Some(fresh_user)) => {
                // Check if tier changed
                if local_user.tier != fresh_user.tier {
                    println!("🔄 User tier updated: {} → {}", local_user.tier, fresh_user.tier);
                    
                    // Update local session
                    if let Err(e) = service.save_user_session(&fresh_user).await {
                        println!("⚠️ Failed to update local session: {}", e);
                    }
                }
                
                Ok(Some(fresh_user))
            },
            Ok(None) => {
                println!("⚠️ User not found in database, clearing local session");
                let _ = service.clear_user_session().await;
                Ok(None)
            },
            Err(e) => {
                println!("❌ Database error during refresh: {}", e);
                Err("Failed to refresh user status".to_string())
            }
        }
    } else {
        Ok(None)
    }
}

// In the main function, initialize the database:
fn main() {
    // ... existing code ...
    
    // Initialize database
    let database = Database::new().expect("Failed to initialize database");
    let shared_database: SharedDatabase = Arc::new(Mutex::new(database));
    
    tauri::Builder::default()
        .manage(shared_state)
        .manage(shared_overlay_manager)
        .manage(shared_permission_cache)
        .manage(shared_screenshot_cache)
        .manage(shared_auth_service)
        .manage(shared_database)  // Add this line
        // ... rest of the builder ...
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...
            
            // Replace old auth commands with new ones:
            login_user_db,
            get_current_user_db,
            logout_user_db,
            refresh_user_status_db,
            
            // ... rest of commands ...
        ])
        // ... rest of the configuration ...
}
```

---

## 🎨 **Phase 5: Frontend UI Updates**

### **Step 1: Create Login Dialog Component**
**Create file:** `src/components/LoginDialog.tsx`
```typescript
import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { User } from '../services/auth-service';

interface LoginDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: User) => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const user = await invoke<User>('login_user_db', { email, password });
            onLoginSuccess(user);
            onClose();
            setEmail('');
            setPassword('');
        } catch (error) {
            setError(error as string);
        } finally {
            setLoading(false);
        }
    };

    const openRegistrationPage = () => {
        window.open('http://localhost:3000/register', '_blank');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold text-white mb-4">Login to Premium</h2>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-white/80 text-sm mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                            placeholder="your@email.com"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-white/80 text-sm mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                            placeholder="Password"
                            required
                        />
                    </div>
                    
                    {error && (
                        <div className="text-red-400 text-sm">{error}</div>
                    )}
                    
                    <div className="flex space-x-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
                
                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-white/60 text-sm text-center">
                        Don't have an account?{' '}
                        <button
                            onClick={openRegistrationPage}
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            Register on website
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginDialog;
```

### **Step 2: Create User Menu Component**
**Create file:** `src/components/UserMenu.tsx`
```typescript
import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { User } from '../services/auth-service';

interface UserMenuProps {
    user: User;
    onLogout: () => void;
    onUserUpdate: (user: User) => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout, onUserUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const handleRefreshStatus = async () => {
        setRefreshing(true);
        try {
            const updatedUser = await invoke<User | null>('refresh_user_status_db');
            if (updatedUser) {
                onUserUpdate(updatedUser);
                if (updatedUser.tier !== user.tier) {
                    alert(`🎉 Status updated! You now have ${updatedUser.tier} access!`);
                }
            }
        } catch (error) {
            console.error('Failed to refresh status:', error);
            alert('Failed to refresh status. Please try again.');
        } finally {
            setRefreshing(false);
        }
    };

    const handleLogout = async () => {
        try {
            await invoke('logout_user_db');
            onLogout();
            setIsOpen(false);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const openManageSubscription = () => {
        window.open('http://localhost:3000/account', '_blank');
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
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title={`${user.name} (${user.tier})`}
            >
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTierColor(user.tier)}`}>
                    {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
                </span>
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 shadow-xl z-50">
                        <div className="p-4 border-b border-white/10">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-white font-medium">{user.name}</div>
                                    <div className="text-white/60 text-sm">{user.email}</div>
                                </div>
                            </div>
                            <div className={`mt-2 px-2 py-1 rounded text-xs font-medium ${getTierColor(user.tier)} text-center`}>
                                {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)} Plan
                            </div>
                        </div>

                        <div className="p-2">
                            <button
                                onClick={handleRefreshStatus}
                                disabled={refreshing}
                                className="w-full flex items-center space-x-2 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
                                <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
                            </button>

                            <button
                                onClick={openManageSubscription}
                                className="w-full flex items-center space-x-2 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <span>🌐</span>
                                <span>Manage Subscription</span>
                            </button>

                            <hr className="my-2 border-white/10" />

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center space-x-2 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <span>🚪</span>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default UserMenu;
```

### **Step 3: Update Auth Service for Database**
**File:** `src/services/auth-service.ts`
```typescript
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
}

class AuthService {
    private currentUser: User | null = null;
    private authListeners: Array<(user: User | null) => void> = [];

    async initialize() {
        // Load current user from Tauri storage
        await this.loadCurrentUser();
    }

    async loginWithDatabase(email: string, password: string): Promise<User> {
        try {
            console.log('🔐 Logging in user with database:', email);
            
            const user = await invoke<User>('login_user_db', { email, password });
            this.currentUser = user;
            
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
        try {
            await invoke('logout_user_db');
            this.currentUser = null;
            
            // Notify listeners
            this.notifyAuthListeners(null);
            
            console.log('🚪 User logged out');
        } catch (error) {
            console.error('❌ Logout failed:', error);
            throw new Error(`Logout failed: ${error}`);
        }
    }

    async loadCurrentUser(): Promise<User | null> {
        try {
            const user = await invoke<User | null>('get_current_user_db');
            this.currentUser = user;
            
            if (user) {
                console.log('📖 Loaded user session:', user.email, user.tier);
                // Notify listeners
                this.notifyAuthListeners(user);
            }
            
            return user;
        } catch (error) {
            console.error('❌ Failed to load current user:', error);
            return null;
        }
    }

    async refreshUserStatus(): Promise<User | null> {
        try {
            const user = await invoke<User | null>('refresh_user_status_db');
            if (user) {
                this.currentUser = user;
                this.notifyAuthListeners(user);
            }
            return user;
        } catch (error) {
            console.error('❌ Failed to refresh user status:', error);
            return null;
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
        const baseUrl = 'http://localhost:3000';
        const upgradeUrl = plan 
            ? `${baseUrl}/payments?plan=${plan}`
            : `${baseUrl}/payments`;
        
        console.log('🔗 Opening upgrade page:', upgradeUrl);
        window.open(upgradeUrl, '_blank');
    }
}

// Export singleton instance
export const authService = new AuthService();

// Initialize when imported
authService.initialize().catch(error => {
    console.error('❌ Failed to initialize auth service:', error);
});
```

### **Step 4: Update Main App Component**
**File:** `src/App.tsx`
```typescript
// Add these imports
import LoginDialog from './components/LoginDialog';
import UserMenu from './components/UserMenu';

// In the App component, add these state variables:
const [showLoginDialog, setShowLoginDialog] = useState(false);

// Replace the user change handler:
const handleUserChange = (user: User | null) => {
    setCurrentUser(user);
    console.log('🔍 User changed:', user ? `${user.email} (${user.tier})` : 'No user');
};

// Add login handlers:
const handleLoginClick = () => {
    setShowLoginDialog(true);
};

const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    alert(`🎉 Welcome back, ${user.name}!\n\nYou now have ${user.tier} access!`);
};

const handleLogout = () => {
    setCurrentUser(null);
    alert('👋 You have been logged out. You now have free access.');
};

const handleUserUpdate = (user: User) => {
    setCurrentUser(user);
};

// In the JSX, replace the user display section:
{/* User Authentication Section */}
<div className="flex items-center space-x-2">
    {currentUser ? (
        <UserMenu 
            user={currentUser}
            onLogout={handleLogout}
            onUserUpdate={handleUserUpdate}
        />
    ) : (
        <button
            onClick={handleLoginClick}
            className="flex items-center space-x-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Login with premium account"
        >
            <span>🔑</span>
            <span className="text-white/80 text-sm">Login</span>
        </button>
    )}
</div>

{/* Login Dialog */}
<LoginDialog
    isOpen={showLoginDialog}
    onClose={() => setShowLoginDialog(false)}
    onLoginSuccess={handleLoginSuccess}
/>
```

---

## 🧪 **Phase 6: Testing and Migration**

### **Step 1: Database Migration Script**
**Create file:** `backend/scripts/migrate-users.js`
```javascript
// Script to migrate existing users.json to PostgreSQL
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'framesense',
    user: 'postgres',
    password: 'password',
});

async function migrateUsers() {
    try {
        // Read existing users.json
        const usersFile = path.join(__dirname, '../data/users.json');
        if (!fs.existsSync(usersFile)) {
            console.log('No users.json file found, skipping migration');
            return;
        }

        const userData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        const users = userData.users || {};

        console.log(`Found ${Object.keys(users).length} users to migrate`);

        for (const [email, user] of Object.entries(users)) {
            // Check if user already exists
            const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
            
            if (existingUser.rows.length > 0) {
                console.log(`User ${email} already exists, skipping`);
                continue;
            }

            // Hash password (use default if not set)
            const password = user.password || 'defaultpassword123';
            const passwordHash = await bcrypt.hash(password, 12);

            // Insert user
            await pool.query(
                `INSERT INTO users (email, name, password_hash, tier, subscription_status, stripe_customer_id, usage_daily, usage_total, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    email,
                    user.name || 'User',
                    passwordHash,
                    user.tier || 'free',
                    user.subscriptionStatus || 'inactive',
                    user.stripeCustomerId || null,
                    user.usage?.daily || 0,
                    user.usage?.total || 0,
                    user.createdAt || new Date().toISOString()
                ]
            );

            console.log(`✅ Migrated user: ${email} (${user.tier || 'free'})`);
        }

        console.log('🎉 Migration completed successfully!');
        
        // Backup original file
        const backupFile = usersFile + '.backup.' + Date.now();
        fs.copyFileSync(usersFile, backupFile);
        console.log(`📦 Original file backed up to: ${backupFile}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrateUsers();
```

### **Step 2: Test Flow**
```bash
# 1. Setup database
psql framesense < backend/database/schema.sql

# 2. Migrate existing users
cd backend && node scripts/migrate-users.js

# 3. Start backend
cd backend && npm run dev

# 4. Start website
cd website && npm run dev

# 5. Start Tauri app
npm run tauri dev

# 6. Test complete flow:
# - Register new user on website
# - Make payment
# - Login to Tauri app with same credentials
# - Verify premium access
```

---

## 🎯 **Final Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                     │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │    users    │  │ user_sessions   │  │   (future)      │ │
│  │             │  │                 │  │                 │ │
│  └─────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           ▲                    ▲                    ▲
           │                    │                    │
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │   Website   │     │   Backend   │     │ Tauri App   │
    │             │     │             │     │             │
    │ Register    │────▶│ User Service│◀────│ Login UI    │
    │ Payment     │     │ Auth Routes │     │ User Menu   │
    │ Success     │     │ Webhooks    │     │ Session     │
    └─────────────┘     └─────────────┘     └─────────────┘
```

### **User Journey:**
1. **Website**: User registers → PostgreSQL
2. **Website**: User pays → Webhook updates tier → PostgreSQL  
3. **Tauri**: User clicks login → Database auth → Local session
4. **Tauri**: User gets premium features → Based on database tier
5. **Tauri**: User closes/opens app → Auto-loads session

---

## ✅ **Success Criteria**

- [ ] PostgreSQL database setup and schema created
- [ ] Backend migrated to use PostgreSQL instead of JSON files
- [ ] Website registration saves to PostgreSQL
- [ ] Payment webhook updates PostgreSQL user tier
- [ ] Tauri app can login with database credentials
- [ ] Tauri app saves persistent sessions
- [ ] User can logout and login again
- [ ] Premium features work based on database tier
- [ ] Status refresh works (payment → tier update → app refresh)

**When complete, you'll have a robust, scalable authentication system with centralized user management!** 