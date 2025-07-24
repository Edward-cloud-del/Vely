import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { analyzeImage } from './routes/analyze.js';
// Load environment variables
dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;
// CORS - allow all origins for simplicity
app.use(cors());
// Body parsing
app.use(express.json({ limit: '50mb' }));
// Configure multer for image uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'FrameSense Simple Backend',
        timestamp: new Date().toISOString()
    });
});
// THE ONLY ENDPOINT: Image analysis with OCR + ChatGPT
app.post('/api/analyze', upload.single('image'), analyzeImage);
// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});
app.listen(PORT, () => {
    console.log(`🚀 FrameSense Simple Backend running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📸 Analyze endpoint: POST http://localhost:${PORT}/api/analyze`);
});
export default app;
