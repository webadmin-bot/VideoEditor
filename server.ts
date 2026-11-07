import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

const app = express();
const PORT = process.env.PORT || 3000;
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';

// Restrict CORS to local frontend origins (No wildcard)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Studio-Token');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});



// Single authoritative processing engine: Stream all /api and /media requests to Python FastAPI
const proxyToPython = (req: Request, res: Response) => {
  const targetUrl = new URL(req.originalUrl, PYTHON_BACKEND_URL);

  const headers = { ...req.headers };
  delete headers.host;

  const proxyReq = http.request(
    targetUrl.toString(),
    {
      method: req.method,
      headers: {
        ...headers,
        host: targetUrl.host,
      },
    },
    (proxyRes) => {
      // In cloud container environments, port 8000 is intercepted by the internal control plane
      // which returns 401 for unauthenticated requests when Python is not running.
      if (proxyRes.statusCode === 401 && !req.headers.authorization) {
        res.status(503).json({
          error: 'LOCAL BACKEND DISCONNECTED',
          detail: 'Python FastAPI backend engine is offline. Start the backend with START_AI_VIDEO_STUDIO.bat on http://127.0.0.1:8000.',
          connected: false,
        });
        proxyRes.resume();
        return;
      }

      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', () => {
    res.status(503).json({
      error: 'LOCAL BACKEND DISCONNECTED',
      detail: 'Python FastAPI backend engine is offline. Start the backend with START_AI_VIDEO_STUDIO.bat on http://127.0.0.1:8000.',
      connected: false,
    });
  });

  req.pipe(proxyReq);
};

app.use('/api', proxyToPython);
app.use('/media', proxyToPython);

// ----------------- Vite Integration -----------------
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const portNum = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  app.listen(portNum, '0.0.0.0', () => {
    console.log(`[AI Video Studio] Master server running at http://0.0.0.0:${portNum}`);
  });
}

startServer();
