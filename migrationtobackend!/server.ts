import dotenv from 'dotenv';
dotenv.config();
// Import modules (environment variables will be loaded by database connection)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { analyzeImageRoute } from './routes/ai.js';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscription.js';
import aiEnhancedRoutes from './routes/ai-enhanced.js';
import { query } from './database/connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { webhookRouter } from './routes/subscription.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet());

// CORS configuration for Vercel frontend
app.use(cors({
  origin: [
    'http://localhost:5173', // Local development
    'http://localhost:3000', // Website server
    'http://localhost:3001', // Local development
    'http://localhost:8080', // Payments server
    'https://framesense.vercel.app', // Production Vercel URL
    process.env.FRONTEND_URL || '', // Additional frontend URL from env
  ],
  credentials: true
}));

// Register Stripe webhook route BEFORE body parsers (separate path)
app.use('/webhooks', webhookRouter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'FrameSense API'
  });
});

// Database migration endpoint (admin only)
app.post('/admin/migrate', async (req, res) => {
  try {
    console.log('🔄 Running database migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../railway-setup.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await query(sqlContent);
    
    console.log('✅ Database migration completed successfully');
    
    res.json({
      success: true,
      message: 'Database migration completed successfully'
    });
  } catch (error: any) {
    console.error('❌ Database migration failed:', error);
    res.status(500).json({
      success: false,
      message: `Migration failed: ${error.message}`
    });
  }
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Subscription management routes (all others)
app.use('/api', subscriptionRoutes);

// Enhanced AI API v2 endpoints (NEW)
app.use('/api/v2', aiEnhancedRoutes);

// Authentication middleware for legacy route
const authenticateUserLegacy = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication token required' 
      });
    }
    
    const { default: UserService } = await import('../services/user-service.js');
    const user = await UserService.verifyToken(token);
    
    console.log(`🔍 === LEGACY AI ROUTE AUTHENTICATION ===`);
    console.log(`User ID: ${user.id}`);
    console.log(`User Email: ${user.email}`);
    console.log(`User Tier: ${user.tier}`);
    console.log(`User subscription_status: ${user.subscription_status}`);
    console.log(`=========================================`);
    
    (req as any).user = user;
    next();
  } catch (error: any) {
    console.error(`❌ Legacy AI route authentication failed:`, error.message);
    res.status(401).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Legacy AI analysis endpoint (v1 - backwards compatibility) - NOW WITH AUTHENTICATION
app.post('/api/analyze', authenticateUserLegacy, upload.single('image'), analyzeImageRoute);

// Health check for optimization services
app.get('/api/health/optimizations', async (req, res) => {
  try {
    const { AIProcessor } = await import('../services/ai-processor.js');
    const healthStatus = await AIProcessor.healthCheck();
    
    res.json({
      status: healthStatus.overall ? 'healthy' : 'degraded',
      services: healthStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 FrameSense API running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
  console.log(`💳 Subscription endpoints: http://localhost:${PORT}/api/*`);
    });

export default app; 