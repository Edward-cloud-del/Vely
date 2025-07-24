# 🚀 FrameSense AI - Fullständig Implementation Guide

## 🎯 **Översikt**

Denna guide implementerar en komplett freemium SaaS-lösning med:
- **8 olika AI-motorer** (OpenAI, Claude, Gemini, etc.)
- **4 prenumerationsnivåer** (Free, Premium, Pro, Enterprise)
- **Svensk marknad** (SEK priser)
- **Fullständig autentisering** och kontoskapande
- **Integrerad payments-sida** på website

## 🤖 **AI-Motorer & Prenumerationsnivåer**

### **Free Tier - 0 SEK/månad**
- **GPT-3.5-turbo** (OpenAI)
- **Gemini Flash** (Google)
- **50 requests/dag**
- **Endast OCR text-extraktion**

### **Premium Tier - 99 SEK/månad**
- **GPT-4o-mini** (OpenAI)
- **Claude 3 Haiku** (Anthropic)
- **Gemini Pro** (Google)
- **1000 requests/dag**
- **Bildanalys aktiverad**

### **Pro Tier - 299 SEK/månad**
- **GPT-4o** (OpenAI)
- **Claude 3.5 Sonnet** (Anthropic)
- **Gemini Ultra** (Google)
- **Llama 3.1 70B** (Meta/Groq)
- **5000 requests/dag**
- **Prioritetsbehandling**

### **Enterprise Tier - 499 SEK/månad**
- **GPT-4o 32k context** (OpenAI)
- **Claude 3 Opus** (Anthropic)
- **Gemini Ultra Pro** (Google)
- **Llama 3.1 405B** (Meta/Groq)
- **Unlimited requests**
- **API access**
- **Dedicated support**
## 📋 **STEG 2: Website Payments Sida**

### **2.1 Skapa Payments Route**
```tsx
// website/src/components/PaymentsPage.tsx
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY!);

const PaymentsPage = () => {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('premium');

  const plans = {
    free: {
      name: 'Free',
      price: 0,
      priceId: null,
      features: [
        'GPT-3.5-turbo & Gemini Flash',
        '50 requests per dag',
        'OCR text-extraktion',
        'Grundläggande support'
      ]
    },
    premium: {
      name: 'Premium',
      price: 99,
      priceId: 'price_premium_monthly',
      features: [
        'GPT-4o-mini, Claude 3 Haiku, Gemini Pro',
        '1000 requests per dag',
        'Bildanalys & avancerade funktioner',
        'Prioriterad support'
      ]
    },
    pro: {
      name: 'Pro',
      price: 299,
      priceId: 'price_pro_monthly',
      features: [
        'GPT-4o, Claude 3.5 Sonnet, Gemini Ultra',
        '5000 requests per dag',
        'Prioritetsbehandling',
        'Avancerad bildanalys'
      ]
    },
    enterprise: {
      name: 'Enterprise',
      price: 499,
      priceId: 'price_enterprise_monthly',
      features: [
        'Alla premium AI-modeller',
        'Obegränsade requests',
        'API access',
        'Dedicated support & SLA'
      ]
    }
  };

  const handleUpgrade = async (priceId: string) => {
    if (!priceId) return;
    
    setLoading(true);
    
    try {
      // Check if user is logged in
      const token = localStorage.getItem('framesense_token');
      if (!token) {
        // Redirect to login with return URL
        window.location.href = `/login?return=/payments&plan=${selectedPlan}`;
        return;
      }

      // Create checkout session
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/success?plan=${selectedPlan}`,
          cancelUrl: `${window.location.origin}/payments`
        })
      });

      const { sessionId } = await response.json();
      
      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      await stripe?.redirectToCheckout({ sessionId });
      
    } catch (error) {
      console.error('Payment error:', error);
      alert('Ett fel uppstod. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payments-page">
      <div className="container">
        <h1>Välj Din AI-Plan</h1>
        <p className="subtitle">Uppgradera för tillgång till de bästa AI-modellerna</p>
        
        <div className="pricing-grid">
          {Object.entries(plans).map(([key, plan]) => (
            <div 
              key={key}
              className={`pricing-card ${selectedPlan === key ? 'selected' : ''} ${key === 'pro' ? 'popular' : ''}`}
              onClick={() => setSelectedPlan(key)}
            >
              {key === 'pro' && <div className="popular-badge">Populär</div>}
              
              <h3>{plan.name}</h3>
              <div className="price">
                <span className="amount">{plan.price}</span>
                <span className="currency">SEK/mån</span>
              </div>
              
              <ul className="features">
                {plan.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              
              <button 
                className={`plan-button ${key === 'free' ? 'current' : 'upgrade'}`}
                onClick={() => handleUpgrade(plan.priceId)}
                disabled={loading}
              >
                {loading ? 'Laddar...' : 
                 key === 'free' ? 'Nuvarande Plan' : 
                 `Uppgradera till ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
        
        <div className="ai-models-showcase">
          <h2>AI-Modeller per Plan</h2>
          <div className="models-grid">
            {Object.entries(plans).filter(([key]) => key !== 'free').map(([key, plan]) => (
              <div key={key} className="model-tier">
                <h4>{plan.name}</h4>
                <div className="model-icons">
                  {key === 'premium' && (
                    <>
                      <span>🤖 GPT-4o-mini</span>
                      <span>🧠 Claude 3 Haiku</span>
                      <span>💎 Gemini Pro</span>
                    </>
                  )}
                  {key === 'pro' && (
                    <>
                      <span>🤖 GPT-4o</span>
                      <span>🧠 Claude 3.5 Sonnet</span>
                      <span>💎 Gemini Ultra</span>
                      <span>🦙 Llama 3.1 70B</span>
                    </>
                  )}
                  {key === 'enterprise' && (
                    <>
                      <span>🤖 GPT-4o 32k</span>
                      <span>🧠 Claude 3 Opus</span>
                      <span>💎 Gemini Ultra Pro</span>
                      <span>🦙 Llama 3.1 405B</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;
```

### **2.2 Routing Setup**
```tsx
// website/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PaymentsPage from './components/PaymentsPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/success" element={<SuccessPage />} />
      </Routes>
    </Router>
  );
}
```

## 📋 **STEG 3: Authentication System**

### **3.1 Backend Auth Service**
```javascript
// backend/src/services/auth-service.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = path.join(__dirname, '../../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';

class AuthService {
  async createUser(email, password, name) {
    try {
      // Read existing users
      const userData = await this.readUsers();
      
      // Check if user exists
      if (userData.users[email]) {
        throw new Error('User already exists');
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user
      const user = {
        id: `user_${Date.now()}`,
        email,
        name,
        password: hashedPassword,
        tier: 'free',
        usage: { daily: 0, total: 0 },
        createdAt: new Date().toISOString(),
        stripeCustomerId: null
      };
      
      userData.users[email] = user;
      await this.writeUsers(userData);
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      return { user: this.sanitizeUser(user), token };
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async loginUser(email, password) {
    try {
      const userData = await this.readUsers();
      const user = userData.users[email];
      
      if (!user) {
        throw new Error('Invalid credentials');
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }
      
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      return { user: this.sanitizeUser(user), token };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userData = await this.readUsers();
      const user = userData.users[decoded.email];
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return this.sanitizeUser(user);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async readUsers() {
    try {
      const data = await fs.readFile(USERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, create it
      const initialData = { users: {}, subscriptions: {} };
      await this.writeUsers(initialData);
      return initialData;
    }
  }

  async writeUsers(userData) {
    await fs.writeFile(USERS_FILE, JSON.stringify(userData, null, 2));
  }

  sanitizeUser(user) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}

module.exports = new AuthService();
```

### **3.2 Auth Routes**
```typescript
// backend/src/routes/auth.ts
import { Router, Request, Response } from 'express';
import AuthService from '../services/auth-service';

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
    
    const result = await AuthService.createUser(email, password, name);
    res.json({ success: true, ...result });
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
    
    const result = await AuthService.loginUser(email, password);
    res.json({ success: true, ...result });
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
    
    const user = await AuthService.verifyToken(token);
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message });
  }
});

export default router;
```

### **3.3 Frontend Auth Components**
```tsx
// website/src/components/LoginPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('framesense_token', data.token);
        localStorage.setItem('framesense_user', JSON.stringify(data.user));
        
        // Redirect to return URL or payments page
        const returnUrl = searchParams.get('return') || '/payments';
        navigate(returnUrl);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Ett fel uppstod. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Logga In</h1>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Lösenord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          {error && <div className="error">{error}</div>}
          
          <button type="submit" disabled={loading}>
            {loading ? 'Loggar in...' : 'Logga In'}
          </button>
        </form>
        
        <p>
          Har du inget konto? <a href="/signup">Skapa konto</a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
```

## 📋 **STEG 4: Multi-Provider AI Integration**

### **4.1 AI Provider Services**
```javascript
// backend/src/services/ai-providers/openai-provider.js
const OpenAI = require('openai');

class OpenAIProvider {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateResponse(prompt, model = 'gpt-3.5-turbo', imageData = null) {
    const messages = [{ role: 'user', content: prompt }];
    
    if (imageData && (model.includes('gpt-4') || model.includes('gpt-4o'))) {
      messages[0].content = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageData } }
      ];
    }

    const response = await this.client.chat.completions.create({
      model,
      messages,
      max_tokens: this.getMaxTokens(model),
      temperature: 0.3
    });

    return response.choices[0].message.content;
  }

  getMaxTokens(model) {
    const tokenLimits = {
      'gpt-3.5-turbo': 1000,
      'gpt-4o-mini': 2000,
      'gpt-4o': 3000,
      'gpt-4o-32k': 8000
    };
    return tokenLimits[model] || 1000;
  }
}

module.exports = OpenAIProvider;
```

```javascript
// backend/src/services/ai-providers/claude-provider.js
const Anthropic = require('@anthropic-ai/sdk');

class ClaudeProvider {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async generateResponse(prompt, model = 'claude-3-haiku-20240307', imageData = null) {
    const messages = [{ role: 'user', content: prompt }];
    
    if (imageData) {
      const imageBase64 = imageData.split(',')[1];
      messages[0].content = [
        { type: 'text', text: prompt },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: imageBase64
          }
        }
      ];
    }

    const response = await this.client.messages.create({
      model,
      max_tokens: this.getMaxTokens(model),
      messages
    });

    return response.content[0].text;
  }

  getMaxTokens(model) {
    const tokenLimits = {
      'claude-3-haiku-20240307': 2000,
      'claude-3-5-sonnet-20241022': 4000,
      'claude-3-opus-20240229': 4000
    };
    return tokenLimits[model] || 2000;
  }
}

module.exports = ClaudeProvider;
```

### **4.2 Universal AI Service**
```javascript
// backend/src/services/universal-ai-service.js
const OpenAIProvider = require('./ai-providers/openai-provider');
const ClaudeProvider = require('./ai-providers/claude-provider');
const GeminiProvider = require('./ai-providers/gemini-provider');
const GroqProvider = require('./ai-providers/groq-provider');

class UniversalAIService {
  constructor() {
    this.providers = {
      openai: new OpenAIProvider(),
      claude: new ClaudeProvider(),
      gemini: new GeminiProvider(),
      groq: new GroqProvider()
    };

    this.modelMapping = {
      'GPT-3.5-turbo': { provider: 'openai', model: 'gpt-3.5-turbo' },
      'GPT-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
      'GPT-4o': { provider: 'openai', model: 'gpt-4o' },
      'GPT-4o 32k': { provider: 'openai', model: 'gpt-4o-32k' },
      'Claude 3 Haiku': { provider: 'claude', model: 'claude-3-haiku-20240307' },
      'Claude 3.5 Sonnet': { provider: 'claude', model: 'claude-3-5-sonnet-20241022' },
      'Claude 3 Opus': { provider: 'claude', model: 'claude-3-opus-20240229' },
      'Gemini Flash': { provider: 'gemini', model: 'gemini-1.5-flash' },
      'Gemini Pro': { provider: 'gemini', model: 'gemini-1.5-pro' },
      'Gemini Ultra': { provider: 'gemini', model: 'gemini-1.5-ultra' },
      'Llama 3.1 70B': { provider: 'groq', model: 'llama-3.1-70b-versatile' },
      'Llama 3.1 405B': { provider: 'groq', model: 'llama-3.1-405b-reasoning' }
    };
  }

  async generateResponse(modelName, prompt, imageData = null) {
    const modelConfig = this.modelMapping[modelName];
    
    if (!modelConfig) {
      throw new Error(`Model ${modelName} not supported`);
    }

    const provider = this.providers[modelConfig.provider];
    if (!provider) {
      throw new Error(`Provider ${modelConfig.provider} not available`);
    }

    try {
      return await provider.generateResponse(prompt, modelConfig.model, imageData);
    } catch (error) {
      console.error(`AI generation failed for ${modelName}:`, error);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  getAvailableModels(userTier) {
    const tierModels = {
      free: ['GPT-3.5-turbo', 'Gemini Flash'],
      premium: ['GPT-4o-mini', 'Claude 3 Haiku', 'Gemini Pro'],
      pro: ['GPT-4o', 'Claude 3.5 Sonnet', 'Gemini Ultra', 'Llama 3.1 70B'],
      enterprise: ['GPT-4o 32k', 'Claude 3 Opus', 'Gemini Ultra Pro', 'Llama 3.1 405B']
    };

    // Return all models up to user's tier
    const availableModels = [];
    const tiers = ['free', 'premium', 'pro', 'enterprise'];
    const userTierIndex = tiers.indexOf(userTier);

    for (let i = 0; i <= userTierIndex; i++) {
      availableModels.push(...tierModels[tiers[i]]);
    }

    return availableModels;
  }
}

module.exports = new UniversalAIService();
```

## 📋 **STEG 5: Stripe Dashboard Setup**

### **5.1 Produkter & Priser**
```bash
# Logga in på Stripe Dashboard (https://dashboard.stripe.com)

# Skapa Premium Product
Produktnamn: FrameSense Premium
Beskrivning: AI-analys med GPT-4o-mini, Claude 3 Haiku, Gemini Pro
Pris: 99 SEK/månad
Pris-ID: price_premium_monthly_sek

# Skapa Pro Product
Produktnamn: FrameSense Pro  
Beskrivning: Professionell AI-analys med GPT-4o, Claude 3.5 Sonnet
Pris: 299 SEK/månad
Pris-ID: price_pro_monthly_sek

# Skapa Enterprise Product
Produktnamn: FrameSense Enterprise
Beskrivning: Obegränsad AI-analys med alla premium modeller
Pris: 499 SEK/månad
Pris-ID: price_enterprise_monthly_sek
```

### **5.2 Webhook Configuration**
```bash
# Endpoint URL: https://your-backend.railway.app/api/webhooks/stripe
# Events:
- customer.subscription.created
- customer.subscription.updated  
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed
- customer.subscription.trial_will_end
```

## 📋 **STEG 6: Environment Variables**

### **6.1 Backend (.env)**
```bash
# OpenAI
OPENAI_API_KEY=sk-proj-your-openai-key

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Google Gemini
GOOGLE_API_KEY=your-google-api-key

# Groq (for Llama models)
GROQ_API_KEY=your-groq-api-key

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://framesense.se
```

### **6.2 Frontend (.env)**
```bash
# API
REACT_APP_API_URL=https://your-backend.railway.app

# Stripe
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable

# App
REACT_APP_APP_NAME=FrameSense
REACT_APP_WEBSITE_URL=https://framesense.se
```

## 📋 **STEG 7: Deployment Process**

### **7.1 Railway Backend Deployment**
```bash
# 1. Committa all kod
git add .
git commit -m "Add multi-provider AI system with authentication"
git push origin main

# 2. Skapa Railway project
railway login
railway new
railway link

# 3. Sätt environment variables i Railway dashboard
# (Kopiera alla från .env till Railway)

# 4. Deploy
railway up
```

### **7.2 Vercel Website Deployment**
```bash
# 1. Installera Vercel CLI
npm install -g vercel

# 2. Deploy website
cd website
vercel

# 3. Sätt environment variables i Vercel dashboard
# 4. Sätt custom domain: framesense.se
```

## 📋 **STEG 8: Testing Checklist**

### **8.1 Authentication Flow**
```bash
# Test user registration
curl -X POST https://your-backend.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123", "name": "Test User"}'

# Test login
curl -X POST https://your-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### **8.2 AI Model Testing**
```bash
# Test each model with authentication
curl -X POST https://your-backend.railway.app/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"message": "Test message", "selectedModel": "GPT-4o", "userId": "user123"}'
```

### **8.3 Payment Flow Testing**
```bash
# Test Stripe checkout
# Use test cards:
# Success: 4242 4242 4242 4242
# Decline: 4000 0000 0000 0002
```

## 🎯 **Fullständig Implementation Summary**

### **✅ Vad som implementeras:**
1. **Frontend UI** - Mindre capture area, upgrade-knapp, model selector
2. **Website** - Payments sida med 4 plans, authentication
3. **Backend** - 8 AI-modeller, authentication, prenumerationshantering
4. **Stripe** - Komplett betalningssystem för svensk marknad
5. **Security** - JWT tokens, bcrypt lösenord, API keys säkra

### **🚀 Revenue Potential:**
```
1000 användare:
- 50 Premium (99 SEK) = 4,950 SEK/månad
- 15 Pro (299 SEK) = 4,485 SEK/månad  
- 5 Enterprise (499 SEK) = 2,495 SEK/månad
Total: ~12,000 SEK/månad (~$1,200 USD)
```

### **📈 Next Steps:**
1. Implementera alla steg i ordning
2. Testa hela flödet
3. Lansera på svensk marknad
4. Optimera conversion rates
5. Lägg till analytics & A/B testing

**Du har nu en komplett roadmap för en multi-million SEK SaaS-business!** 🎉

---

## 📋 **STEG 9: APP INTEGRATION - Seamless Payment-to-App Flow**

### **🎯 Smart UX: En Inloggning, Inte Två**

**Problem med nuvarande flöde:**
1. Free user trycker "Upgrade" i appen
2. Öppnar payments-sida → måste logga in på HEMSIDAN
3. Betalar via Stripe → framgång!
4. Återvänder till appen → måste logga in IGEN i appen 😤

**✨ Förbättrat flöde:**
1. Free user trycker "Upgrade" i appen
2. Öppnar payments-sida → loggar in ENDAST på hemsidan
3. Stripe success → **appen öppnas automatiskt med auth token**
4. Appen får premium access direkt - ingen extra inloggning! 🚀

### **9.1 Deep Link Setup i Tauri**

```json
// src-tauri/tauri.conf.json - Lägg till deep link support
{
  "tauri": {
    "allowlist": {
      "protocol": {
        "all": true,
        "asset": true,
        "assetScope": ["**"]
      }
    },
    "bundle": {
      "identifier": "com.framesense.app",
      "category": "Productivity",
      "targets": "all",
      "externalBin": [],
      "icon": ["icons/32x32.png"],
      "resources": [],
      "copyright": "",
      "licenseFile": "",
      "longDescription": "",
      "macOS": {
        "frameworks": [],
        "minimumSystemVersion": "",
        "exceptionDomain": "",
        "signingIdentity": null,
        "providerShortName": null,
        "entitlements": null
      },
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": ""
      },
      "deb": {
        "depends": []
      },
      "rpm": {
        "depends": []
      }
    },
    "security": {
      "csp": null
    },
    "updater": {
      "active": false
    },
    "windows": [
      {
        "title": "FrameSense",
        "width": 600,
        "height": 250,
        "resizable": true,
        "fullscreen": false,
        "protocols": ["framesense"] // Deep link protocol
      }
    ]
  }
}
```

```rust
// src-tauri/src/auth.rs - Ny fil
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    pub tier: String, // "free", "premium", "pro", "enterprise"
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[tauri::command]
pub async fn login_user(email: String, password: String) -> Result<User, String> {
    let client = reqwest::Client::new();
    
    let login_data = LoginRequest { email, password };
    
    let response = client
        .post("http://localhost:3001/api/auth/login") // Railway URL i produktion
        .json(&login_data)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if response.status().is_success() {
        let auth_response: serde_json::Value = response.json().await
            .map_err(|e| format!("Parse error: {}", e))?;
        
        if auth_response["success"].as_bool().unwrap_or(false) {
            let user_data = &auth_response["user"];
            let token = auth_response["token"].as_str().unwrap_or("");
            
            let user = User {
                id: user_data["id"].as_str().unwrap_or("").to_string(),
                email: user_data["email"].as_str().unwrap_or("").to_string(),
                name: user_data["name"].as_str().unwrap_or("").to_string(),
                tier: user_data["tier"].as_str().unwrap_or("free").to_string(),
                token: token.to_string(),
            };
            
            // Spara användardata lokalt
            save_user_session(&user).await?;
            
            Ok(user)
        } else {
            Err("Invalid credentials".to_string())
        }
    } else {
        Err("Authentication failed".to_string())
    }
}

#[tauri::command]
pub async fn handle_payment_success(token: String, plan: String) -> Result<User, String> {
    // Verifiera token med backend
    let client = reqwest::Client::new();
    
    let response = client
        .get("http://localhost:3001/api/auth/verify")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Verification error: {}", e))?;
    
    if response.status().is_success() {
        let auth_response: serde_json::Value = response.json().await
            .map_err(|e| format!("Parse error: {}", e))?;
        
        if auth_response["success"].as_bool().unwrap_or(false) {
            let user_data = &auth_response["user"];
            
            let user = User {
                id: user_data["id"].as_str().unwrap_or("").to_string(),
                email: user_data["email"].as_str().unwrap_or("").to_string(),
                name: user_data["name"].as_str().unwrap_or("").to_string(),
                tier: user_data["tier"].as_str().unwrap_or("free").to_string(),
                token: token.clone(),
            };
            
            // Spara användardata lokalt
            save_user_session(&user).await?;
            
            println!("🎉 User automatically logged in after payment: {} ({})", user.email, user.tier);
            
            Ok(user)
        } else {
            Err("Token verification failed".to_string())
        }
    } else {
        Err("Authentication failed".to_string())
    }
}

#[tauri::command]
pub async fn logout_user() -> Result<(), String> {
    clear_user_session().await
}

#[tauri::command]
pub async fn get_current_user() -> Result<Option<User>, String> {
    load_user_session().await
}

// Lokala storage funktioner
async fn save_user_session(user: &User) -> Result<(), String> {
    // Implementera säker lokal lagring
    Ok(())
}

async fn clear_user_session() -> Result<(), String> {
    // Rensa lokal session
    Ok(())
}

async fn load_user_session() -> Result<Option<User>, String> {
    // Ladda sparad session
    Ok(None)
}
```

```rust
// src-tauri/src/main.rs - Uppdatera för deep links
use tauri::{Manager, api::shell};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Registrera deep link protocol handler
            let handle = app.handle();
            
            app.listen_global("deep-link://", move |event| {
                if let Some(payload) = event.payload() {
                    println!("🔗 Deep link received: {}", payload);
                    
                    // Parse deep link: framesense://success?token=abc&plan=premium
                    if let Ok(url) = url::Url::parse(payload) {
                        if url.scheme() == "framesense" && url.host_str() == Some("success") {
                            let query_pairs: std::collections::HashMap<_, _> = url.query_pairs().collect();
                            
                            if let (Some(token), Some(plan)) = (query_pairs.get("token"), query_pairs.get("plan")) {
                                println!("🎉 Payment success detected: {} plan", plan);
                                
                                // Emit till frontend för automatisk login
                                handle.emit_all("payment_success", serde_json::json!({
                                    "token": token,
                                    "plan": plan
                                })).unwrap();
                            }
                        }
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login_user,
            logout_user,
            get_current_user,
            handle_payment_success
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### **9.2 Backend Success URL Update**

```javascript
// backend/src/routes/subscription.js - Uppdatera checkout session
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    const { priceId } = req.body;
    const user = req.user;

    // Skapa Stripe checkout session med deep link success URL
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `framesense://success?token=${user.token}&plan=${getPlanFromPriceId(priceId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payments?canceled=true`,
      metadata: {
        userId: user.id,
        userEmail: user.email
      }
    });

    res.json({ 
      success: true, 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create checkout session' 
    });
  }
});

function getPlanFromPriceId(priceId) {
  const priceMap = {
    'price_1RjbPBGhaJA85Y4BoLQzZdGi': 'premium',
    'price_1RjbOGGhaJA85Y4BimHpcWHs': 'pro',
    // Lägg till fler price IDs här
  };
  return priceMap[priceId] || 'premium';
}
```

### **9.3 Frontend Deep Link Listener**

```typescript
// src/services/deep-link-service.ts
import { listen } from '@tauri-apps/api/event';
import { authService } from './auth-service';

class DeepLinkService {
    async initializeListeners() {
        // Lyssna på payment success events från Tauri
        await listen('payment_success', async (event) => {
            console.log('🎉 Payment success received:', event.payload);
            
            const { token, plan } = event.payload as { token: string; plan: string };
            
            try {
                // Automatisk inloggning med token från betalning
                const user = await invoke('handle_payment_success', { token, plan });
                
                // Uppdatera UI
                authService.setCurrentUser(user);
                
                // Visa success meddelande
                this.showPaymentSuccessMessage(plan);
                
                // Trigga UI uppdatering
                window.dispatchEvent(new CustomEvent('user_upgraded', { 
                    detail: { user, plan } 
                }));
                
            } catch (error) {
                console.error('Failed to handle payment success:', error);
                alert('Betalning lyckades men något gick fel. Kontakta support.');
            }
        });
    }
    
    private showPaymentSuccessMessage(plan: string) {
        const planNames = {
            premium: 'Premium',
            pro: 'Pro', 
            enterprise: 'Enterprise'
        };
        
        // Visa native notification
        new Notification('FrameSense - Betalning Lyckades!', {
            body: `Du har nu ${planNames[plan]} access! 🎉`,
            icon: '/favicon.ico'
        });
    }
}

export const deepLinkService = new DeepLinkService();
```

### **9.4 Model Access Control**

```rust
// src-tauri/src/ai_access.rs
use crate::auth::User;

pub struct ModelAccess;

impl ModelAccess {
    pub fn get_available_models(user_tier: &str) -> Vec<&'static str> {
        match user_tier {
            "free" => vec!["GPT-3.5-turbo", "Gemini Flash"],
            "premium" => vec![
                "GPT-3.5-turbo", "Gemini Flash",
                "GPT-4o-mini", "Claude 3 Haiku", "Gemini Pro"
            ],
            "pro" => vec![
                "GPT-3.5-turbo", "Gemini Flash",
                "GPT-4o-mini", "Claude 3 Haiku", "Gemini Pro",
                "GPT-4o", "Claude 3.5 Sonnet", "Llama 3.1 70B"
            ],
            "enterprise" => vec![
                "GPT-3.5-turbo", "Gemini Flash",
                "GPT-4o-mini", "Claude 3 Haiku", "Gemini Pro",
                "GPT-4o", "Claude 3.5 Sonnet", "Llama 3.1 70B",
                "GPT-4o 32k", "Claude 3 Opus", "Llama 3.1 405B"
            ],
            _ => vec!["GPT-3.5-turbo"] // Fallback
        }
    }
    
    pub fn can_use_model(user_tier: &str, model: &str) -> bool {
        Self::get_available_models(user_tier).contains(&model)
    }
    
    pub fn get_daily_limit(user_tier: &str) -> i32 {
        match user_tier {
            "free" => 50,
            "premium" => 1000,
            "pro" => 5000,
            "enterprise" => -1, // Unlimited
            _ => 10 // Very limited fallback
        }
    }
}
```

### **9.3 Frontend Integration**

```typescript
// src/services/auth-service.ts
interface User {
    id: string;
    email: string;
    name: string;
    tier: string;
    token: string;
}

class AuthService {
    private currentUser: User | null = null;
    
    async login(email: string, password: string): Promise<User> {
        try {
            // Kalla Tauri backend
            const user = await invoke('login_user', { email, password });
            this.currentUser = user as User;
            return user as User;
        } catch (error) {
            throw new Error(`Login failed: ${error}`);
        }
    }
    
    async logout(): Promise<void> {
        await invoke('logout_user');
        this.currentUser = null;
    }
    
    async getCurrentUser(): Promise<User | null> {
        if (!this.currentUser) {
            try {
                this.currentUser = await invoke('get_current_user') as User | null;
            } catch (error) {
                console.error('Failed to get current user:', error);
            }
        }
        return this.currentUser;
    }
    
    isLoggedIn(): boolean {
        return this.currentUser !== null;
    }
    
    getUserTier(): string {
        return this.currentUser?.tier || 'free';
    }
    
    canUseModel(model: string): boolean {
        const tier = this.getUserTier();
        const availableModels = this.getAvailableModels(tier);
        return availableModels.includes(model);
    }
    
    getAvailableModels(tier: string): string[] {
        const models = {
            free: ['GPT-3.5-turbo', 'Gemini Flash'],
            premium: ['GPT-3.5-turbo', 'Gemini Flash', 'GPT-4o-mini', 'Claude 3 Haiku', 'Gemini Pro'],
            pro: ['GPT-3.5-turbo', 'Gemini Flash', 'GPT-4o-mini', 'Claude 3 Haiku', 'Gemini Pro', 'GPT-4o', 'Claude 3.5 Sonnet', 'Llama 3.1 70B'],
            enterprise: ['GPT-3.5-turbo', 'Gemini Flash', 'GPT-4o-mini', 'Claude 3 Haiku', 'Gemini Pro', 'GPT-4o', 'Claude 3.5 Sonnet', 'Llama 3.1 70B', 'GPT-4o 32k', 'Claude 3 Opus', 'Llama 3.1 405B']
        };
        return models[tier as keyof typeof models] || models.free;
    }
}

export const authService = new AuthService();
```

### **9.4 UI Uppdateringar**

```tsx
// src/components/ModelSelector.tsx
import React, { useState, useEffect } from 'react';
import { authService } from '../services/auth-service';

interface ModelSelectorProps {
    selectedModel: string;
    onModelChange: (model: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange }) => {
    const [user, setUser] = useState(null);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    
    useEffect(() => {
        loadUserAndModels();
    }, []);
    
    const loadUserAndModels = async () => {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        
        const tier = currentUser?.tier || 'free';
        const models = authService.getAvailableModels(tier);
        setAvailableModels(models);
        
        // Om vald modell inte är tillgänglig, välj första tillgängliga
        if (!models.includes(selectedModel)) {
            onModelChange(models[0]);
        }
    };
    
    const handleUpgrade = () => {
        // Öppna upgrade sida i extern webbläsare
        window.open('http://localhost:8080/payments', '_blank');
    };
    
    return (
        <div className="model-selector">
            <div className="user-info">
                {user ? (
                    <div className="logged-in">
                        <span className="user-name">{user.name}</span>
                        <span className="user-tier tier-{user.tier}">{user.tier}</span>
                        <button onClick={() => authService.logout()}>Logout</button>
                    </div>
                ) : (
                    <div className="not-logged-in">
                        <span className="free-user">Free User</span>
                        <button onClick={() => showLoginModal()}>Login for Premium</button>
                    </div>
                )}
            </div>
            
            <div className="model-list">
                {availableModels.map(model => (
                    <div 
                        key={model}
                        className={`model-option ${selectedModel === model ? 'selected' : ''}`}
                        onClick={() => onModelChange(model)}
                    >
                        {model}
                    </div>
                ))}
            </div>
            
            {(!user || user.tier === 'free') && (
                <div className="upgrade-section">
                    <h4>Unlock Premium Models</h4>
                    <div className="premium-models">
                        <span>GPT-4o</span>
                        <span>Claude 3.5 Sonnet</span>
                        <span>Llama 3.1 70B</span>
                    </div>
                    <button onClick={handleUpgrade} className="upgrade-btn">
                        Upgrade to Premium
                    </button>
                </div>
            )}
        </div>
    );
};
```

### **9.5 AI Request Modifiering**

```typescript
// src/services/ai-service.ts
import { authService } from './auth-service';

export class AIService {
    async processRequest(message: string, imageData?: string, selectedModel?: string) {
        const user = await authService.getCurrentUser();
        const tier = user?.tier || 'free';
        
        // Kontrollera modell-access
        if (selectedModel && !authService.canUseModel(selectedModel)) {
            throw new Error(`Model ${selectedModel} requires ${this.getRequiredTier(selectedModel)} subscription`);
        }
        
        // Använd backend endpoint med auth
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        
        // Lägg till auth token för premium users
        if (user?.token) {
            headers['Authorization'] = `Bearer ${user.token}`;
        }
        
        const response = await fetch('http://localhost:3001/api/analyze', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message,
                imageData,
                selectedModel: selectedModel || this.getDefaultModel(tier),
                userTier: tier
            })
        });
        
        if (!response.ok) {
            throw new Error('AI request failed');
        }
        
        return response.json();
    }
    
    private getDefaultModel(tier: string): string {
        const defaults = {
            free: 'GPT-3.5-turbo',
            premium: 'GPT-4o-mini',
            pro: 'GPT-4o',
            enterprise: 'GPT-4o 32k'
        };
        return defaults[tier as keyof typeof defaults] || 'GPT-3.5-turbo';
    }
    
    private getRequiredTier(model: string): string {
        if (['GPT-4o 32k', 'Claude 3 Opus', 'Llama 3.1 405B'].includes(model)) return 'Enterprise';
        if (['GPT-4o', 'Claude 3.5 Sonnet', 'Llama 3.1 70B'].includes(model)) return 'Pro';
        if (['GPT-4o-mini', 'Claude 3 Haiku', 'Gemini Pro'].includes(model)) return 'Premium';
        return 'Free';
    }
}
```

### **9.6 Implementation Checklista**

**✅ Implementationsordning:**

1. **Deep Link Setup** - Uppdatera tauri.conf.json + registrera protokoll
2. **Tauri Deep Link Handler** - main.rs uppdatering för event listening  
3. **Backend Success URL** - Ändra Stripe success_url till framesense:// protokoll
4. **Frontend Deep Link Service** - Lyssna på payment_success events
5. **Auth Service Update** - Hantera automatisk token-mottagning
6. **Model Selector Update** - Visa tillgängliga modeller baserat på tier
7. **AI Service Auth** - Skicka tokens med requests
8. **Backend Model Validation** - Kontrollera användarens tier

### **🎯 Kritiska Points:**

1. **Free users** - Ingen inloggning krävd, bara basic modeller
2. **Upgrade flow** - Logga in ENDAST på hemsidan, aldrig i appen
3. **Deep Link Magic** - Stripe success → automatisk app-inloggning via framesense://
4. **Token Transfer** - JWT token följer med från web till app seamlessly
5. **Security** - Validera alla AI-requests + tokens på backend
6. **UX Priority** - En inloggning, inte två - användarvänligt!

### **📈 Business Impact:**

- **Högre Conversion Rate**: Eliminerar friction - endast en inloggning istället för två
- **Seamless User Journey**: App → Web Payment → Tillbaka till App automatiskt
- **Reduced Drop-off**: Användare slutför köp eftersom processen är smidig
- **Premium Retention**: Token-baserat system håller användare inloggade
- **Revenue Protection**: AI-modeller + tiers skyddade på backend-nivå
- **Future-Proof**: Deep link system redo för fler betalningsflows 