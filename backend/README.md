# FrameSense Backend API

Express.js backend for FrameSense AI-powered screen capture analysis.

## Quick Deploy to Railway

1. **Connect Repository**:
   - Go to [Railway](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository
   - Set root directory to: `backend`

2. **Environment Variables**:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   NODE_ENV=production
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```

3. **Deploy**:
   - Railway will automatically detect package.json
   - Build command: `npm run build`
   - Start command: `npm start`

## Local Development

```bash
cd backend
npm install
cp env.example .env
# Add your OpenAI API key to .env
npm run dev
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/analyze` - Analyze image with AI
  - Body: `{ message: string, imageData: string }`
  - Response: `{ message: string, success: boolean }`

## Features

- ✅ OpenAI GPT-4 Vision integration
- ✅ Image upload support (base64 + file upload)
- ✅ CORS configured for Vercel
- ✅ Error handling & rate limiting
- ✅ Security headers (Helmet)
- ✅ Railway deployment ready 