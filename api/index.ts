import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDatabase } from '../backend/src/database/init';
import settingsRoutes from '../backend/src/routes/settings';
import agentsRoutes from '../backend/src/routes/agents';
import authRoutes from '../backend/src/routes/auth';
import realtimeRoutes from '../backend/src/routes/realtime';

// Initialize database
initDatabase();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins in production, configure as needed
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/settings', settingsRoutes);
app.use('/agents', agentsRoutes);
app.use('/auth', authRoutes);
app.use('/realtime', realtimeRoutes);

// Export for Vercel
export default app;