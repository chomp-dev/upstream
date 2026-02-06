import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { uploadRouter } from './routes/upload';
import { feedRouter } from './routes/feed';
import { webhookRouter } from './routes/webhook';
import { restaurantsRouter } from './routes/restaurants';
import { searchRouter } from './routes/search';
import { usersRouter } from './routes/users';
import { tiktokRouter } from './routes/tiktok';
import { commentsRouter } from './routes/comments';
import { initDb } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Allowed origins for CORS
const allowedOrigins = [
  'https://www.usechomp.com',
  'https://usechomp.com',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increased for image uploads

// Request logging middleware (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip || req.connection.remoteAddress}`);
    next();
  });
}

// Routes
app.use('/api/upload', uploadRouter);
app.use('/api/feed', feedRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/restaurants', restaurantsRouter);
app.use('/api/search', searchRouter);
app.use('/api/v1/search', searchRouter); // Alias for compatibility
app.use('/api/users', usersRouter);
app.use('/api/tiktok', tiktokRouter);
app.use('/api/comments', commentsRouter);

// Root route for diagnostic testing
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chomp Media API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Debug endpoint for database connectivity
app.get('/debug/db-check', async (req, res) => {
  try {
    // @ts-ignore
    const { pool } = require('./db');
    const result = await pool.query('SELECT NOW(), current_user, session_user');
    res.json({
      status: 'connected',
      timestamp: result.rows[0].now,
      currentUser: result.rows[0].current_user,
      sessionUser: result.rows[0].session_user,
      connectionString: process.env.DATABASE_URL ? 'Defined (Hidden)' : 'Undefined'
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: error.code,
      details: error
    });
  }
});

// Initialize database and start server
// Initialize database and start server
const startServer = async () => {
  try {
    await initDb();
  } catch (error) {
    console.error('⚠️ Failed to initialize database (Server will verify connection lazily):', error);
    // We don't exit here so the server can still start and satisfy Render's port scan
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Media API running on http://localhost:${PORT}`);
  });
};

startServer();
