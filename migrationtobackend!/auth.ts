import { Router, Request, Response } from 'express';
import UserService from '../../services/user-service.js';

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

// TEST ENDPOINT: Upgrade user tier for testing (remove in production)
router.post('/test-upgrade-tier', async (req: Request, res: Response) => {
  try {
    const { email, tier } = req.body;
    
    if (!email || !tier) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and tier are required' 
      });
    }
    
    // Validate tier
    const validTiers = ['free', 'premium', 'pro', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid tier. Must be: free, premium, pro, or enterprise' 
      });
    }
    
    // Update user tier
    await UserService.updateUserTier(email, tier, 'active');
    
    console.log(`🧪 TEST: User ${email} tier updated to ${tier}`);
    
    res.json({ 
      success: true, 
      message: `User ${email} tier updated to ${tier}`,
      tier: tier
    });
  } catch (error: any) {
    console.error('❌ Test tier upgrade failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router; 