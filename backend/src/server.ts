import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase, getDatabase } from './database/init';
import settingsRoutes from './routes/settings';
import agentsRoutes from './routes/agents';
import authRoutes from './routes/auth';
import realtimeRoutes from './routes/realtime';

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
app.use('/api/realtime', realtimeRoutes);

// Public endpoint for API key (needed by frontend)
app.get('/api/public/apikey', async (req, res) => {
  try {
    const { promisify } = require('util');
    
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;

    const setting = await get('SELECT value FROM settings WHERE key = ?', ['gemini_api_key']) as any;

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
    const { promisify } = require('util');
    
    const db = getDatabase();
    const all = promisify(db.all.bind(db)) as any;

    const agents = await all('SELECT * FROM agents ORDER BY created_at DESC') as any[];

    res.json(agents);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Public endpoint for basic settings (needed by frontend)
app.get('/api/public/settings', async (req, res) => {
  try {
    const { promisify } = require('util');
    
    const db = getDatabase();
    const all = promisify(db.all.bind(db)) as any;

    // Only return non-sensitive settings
    const publicSettings = await all(`
      SELECT key, value 
      FROM settings 
      WHERE key IN ('ai_provider', 'enable_audio', 'max_conversation_length')
    `) as any[];

    res.json(publicSettings);
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve widget.js dynamically
app.get('/widget.js', async (req, res) => {
  try {
    // Read ai_provider from DB so widget iframe can receive it as a param
    const { promisify } = require('util');
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;

    let aiProviderValue = 'gemini';
    try {
      const row = await get('SELECT value FROM settings WHERE key = ?', ['ai_provider']);
      if (row && row.value) aiProviderValue = row.value;
    } catch (err) {
      // ignore and fallback to gemini
      console.warn('Could not read ai_provider from DB, defaulting to gemini', err);
    }

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
    widgetUrl: '${process.env.WIDGET_URL || 'http://localhost:5173'}',
    ai_provider: '${aiProviderValue}'
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
  } catch (err) {
    console.error('Error generating widget.js:', err);
    res.status(500).send('// Failed to generate widget script');
  }
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
