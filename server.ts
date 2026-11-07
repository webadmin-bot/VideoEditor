import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.BIND_HOST || '127.0.0.1';
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';

// Read or initialize session token for localhost API authentication
const tokenFilePath = path.join(__dirname, 'storage', '.session_token');
let studioToken = process.env.STUDIO_SESSION_TOKEN || '';
try {
  if (fs.existsSync(tokenFilePath)) {
    studioToken = fs.readFileSync(tokenFilePath, 'utf-8').trim();
  }
} catch {}

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

  if (studioToken) {
    headers['x-studio-token'] = studioToken;
  }

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
  app.listen(portNum, HOST, () => {
    console.log(`[AI Video Studio] Local Web Application bound strictly to http://${HOST}:${portNum}`);
  });
}

startServer();
