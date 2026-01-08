import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { uploadRouter } from './routes/upload';
import { feedRouter } from './routes/feed';
import { webhookRouter } from './routes/webhook';
import { restaurantsRouter } from './routes/restaurants';
import { initDb } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL || 'http://localhost:8081')
    : true, // Allow all origins in development for mobile testing
  credentials: true
}));
app.use(express.json());

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

// Initialize database and start server
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Media API running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
