import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase, getDatabase } from './database/init';
import settingsRoutes from './routes/settings';
import agentsRoutes from './routes/agents';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5180', 'http://localhost:3000'], // Frontend ports and Admin Panel
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/agents', agentsRoutes);

// Public endpoint for API key (needed by frontend)
app.get('/api/public/apikey', async (req, res) => {
  try {
    const db = getDatabase();
    // Prisma client: settings stored in `setting` model
    const setting = await db.setting.findUnique({ where: { key: 'gemini_api_key' } });
    if (!setting || !setting.value) {
      return res.status(404).json({ error: 'API key not configured' });
    }
    res.json({ apiKey: setting.value });
  } catch (error) {
    console.error('Get API key error:', error);
    res.status(500).json({ error: 'Failed to fetch API key' });
  }
});

// Public endpoint for agents (needed by frontend)
app.get('/api/public/agents', async (req, res) => {
  try {
  const db = getDatabase();
  const agents = await db.agent.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(agents);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve widget.js dynamically
app.get('/widget.js', (req, res) => {
  const widgetScript = `
(function() {
  // Default configuration
  var defaultConfig = {
    agentId: 'ai-advisor',
    theme: 'light',
    position: 'bottom-right',
    title: 'AI Assistant',
    placeholder: 'Type your message...',
    primaryColor: '#007bff',
    apiUrl: '${process.env.API_URL || 'http://localhost:3001'}',
    widgetUrl: '${process.env.WIDGET_URL || 'http://localhost:5173'}'
  };

  // Merge with any global SDH config
  var config = window.SDH_WIDGET_CONFIG ? 
    Object.assign({}, defaultConfig, window.SDH_WIDGET_CONFIG) : 
    defaultConfig;
  
  // Create iframe
  var iframe = document.createElement('iframe');
  var params = new URLSearchParams(config);
  iframe.src = config.widgetUrl + '/widget.html?' + params.toString();
  iframe.width = '400';
  iframe.height = '600';
  iframe.frameBorder = '0';
  iframe.title = config.title;
  iframe.allow = 'microphone';
  iframe.style.cssText = 'position: fixed; ' + 
    (config.position.includes('bottom') ? 'bottom' : 'top') + ': 20px; ' +
    (config.position.includes('right') ? 'right' : 'left') + ': 20px; ' +
    'z-index: 9999; border-radius: 12px; box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);';
  
  // Add to DOM when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(iframe);
    });
  } else {
    document.body.appendChild(iframe);
  }
})();
`;

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(widgetScript);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  });
}).catch((error: any) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

export default app;
