# 🏛️ SocialMe Backend Engine (VPS)

This is the standalone processing engine for SocialMe AI. It handles intensive tasks like web crawling, document parsing, and vector embedding generation, offloading them from Vercel to a persistent VPS environment.

## 🚀 Features
- **Unlimited Crawling**: Bypass Vercel's 10s execution limit.
- **Transformers.js Integration**: Run CPU-heavy vectorization locally on your VPS.
- **OpenAI Fallback**: Automatically switches to OpenAI embeddings if local processing is under heavy load.
- **SSE Status Updates**: Real-time progress streaming.
- **Persistent State**: Training jobs aren't reset by serverless cold starts.

## 🛠️ Setup on VPS

1. **Clone & Install**:
   ```bash
   cd backend-vps
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Turso and AI credentials
   ```

3. **Run with PM2 (Recommended for Production)**:
   ```bash
   npm install -g pm2
   pm2 start npm --name "socialme-backend" -- run start
   ```

## 🔗 Connection to Frontend

In your main Next.js application, set the following environment variable:
```env
NEXT_PUBLIC_BACKEND_URL=http://your-vps-ip:3001
```

## 📡 API Endpoints
- `POST /train`: Starts a crawler or manual training job.
- `GET /status/:jobId`: Real-time SSE progress stream.
- `POST /stop`: Aborts an active job.
- `GET /health`: Server health check.
