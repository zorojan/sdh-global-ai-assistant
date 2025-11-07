import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import { supabase, initSupabaseDatabase } from './database/supabase';
import settingsRoutes from './routes/settings';
import agentsRoutes from './routes/agents';
import authRoutes from './routes/auth';
import realtimeRoutes from './routes/realtime';
import validationRoutes from './routes/validation';
import geminiAudioRoutes from './routes/gemini-audio';
import geminiLiveProxyRoutes, { activeSessions } from './routes/gemini-live-proxy';
import configRoutes from './routes/config';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = require('http').createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// WebSocket connection handling for Gemini Live
wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', 'http://localhost');
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    ws.close(1008, 'Session ID required');
    return;
  }

  console.log('🎙️ WebSocket client connected for session:', sessionId);

  const session = activeSessions.get(sessionId);
  if (session) {
    session.onMessageCallback = (text: string, audio?: Uint8Array) => {
      ws.send(JSON.stringify({
        type: 'message',
        text,
        audio: audio ? Array.from(audio) : null
      }));
    };
  } else {
    ws.close(1008, 'Session not found');
    return;
  }

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      // Handle client messages if needed
      console.log('🎙️ Received message from client:', message);
    } catch (error) {
      console.error('🎙️ Failed to parse client message:', error);
    }
  });

  ws.on('close', () => {
    console.log('🎙️ WebSocket client disconnected for session:', sessionId);
  });

  ws.on('error', (error) => {
    console.error('🎙️ WebSocket error for session:', sessionId, error);
  });
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5180', 'http://localhost:3000'], // Frontend ports and Admin Panel
  credentials: true
}));

// Routes - realtime needs to be before express.json() to handle raw SDP
app.use('/api/realtime', realtimeRoutes);

// JSON middleware after realtime routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Other routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/gemini/audio', geminiAudioRoutes);
app.use('/api/gemini/live', geminiLiveProxyRoutes);
app.use('/api', validationRoutes);

// Public endpoint for API key (needed by frontend)
app.get('/api/public/apikey', async (req, res) => {
  try {
    const { data: setting, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (error || !setting?.value) {
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
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json(agents || []);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Public endpoint for basic settings (needed by frontend)
app.get('/api/public/settings', async (req, res) => {
  try {
    // Only return non-sensitive settings
    const { data: publicSettings, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['ai_provider', 'enable_audio', 'max_conversation_length']);

    if (error) {
      throw error;
    }

    res.json(publicSettings || []);
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Public endpoint for Live API config (needed by frontend)
app.get('/api/public/config/live-connection/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    // Get agent data
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get Live API settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'gemini_live_model',
        'gemini_live_response_modalities', 
        'gemini_live_input_transcription',
        'gemini_live_output_transcription',
        'default_system_instruction_prefix'
      ]);

    if (settingsError) {
      console.error('Settings error:', settingsError);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }

    // Build settings object
    const settingsObj: any = {};
    settings?.forEach((setting: any) => {
      let value = setting.value;
      if (setting.key === 'gemini_live_response_modalities') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = ['AUDIO'];
        }
      }
      if (setting.key.includes('transcription')) {
        value = value === 'true';
      }
      settingsObj[setting.key] = value;
    });

    // Build system instruction
    const baseInstruction = agent.system_prompt || agent.personality || 'You are a helpful AI assistant.';
    const prefix = settingsObj.default_system_instruction_prefix || 'You are a conversational AI. Your tone should be բարյացակամ. You should express ուրախ.';
    
    const language = agent.language || agent.voice_language || 'hy-AM';
    let languageInstruction = '';
    
    switch (language) {
      case 'hy-AM':
        languageInstruction = 'Start the conversation immediately with a short welcome message in Armenian without waiting for the user to speak first. All your subsequent responses must be in Armenian.';
        break;
      case 'ru-RU':
        languageInstruction = 'Start the conversation immediately with a short welcome message in Russian without waiting for the user to speak first. All your subsequent responses must be in Russian.';
        break;
      case 'en-US':
      default:
        languageInstruction = 'Start the conversation immediately with a short welcome message in English without waiting for the user to speak first. All your subsequent responses must be in English.';
        break;
    }

    const systemInstruction = `${prefix} ${baseInstruction} ${languageInstruction}`;

    // Build full connectionConfig
    const connectionConfig = {
      model: settingsObj.gemini_live_model || 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: settingsObj.gemini_live_response_modalities || ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: agent.voice || 'Orus'
            }
          }
        },
        ...(settingsObj.gemini_live_input_transcription && {
          inputAudioTranscription: {}
        }),
        ...(settingsObj.gemini_live_output_transcription && {
          outputAudioTranscription: {}
        }),
        systemInstruction
      }
    };

    res.json({
      connectionConfig,
      agentInfo: {
        id: agent.id,
        name: agent.name,
        personality: agent.personality,
        language: agent.language,
        voice: agent.voice,
        voice_language: agent.voice_language
      }
    });

  } catch (error) {
    console.error('Public Live config error:', error);
    res.status(500).json({ error: 'Failed to build Live API configuration' });
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
    let aiProviderValue = 'gemini';
    try {
      const { data: setting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'ai_provider')
        .single();
      
      if (setting?.value) aiProviderValue = setting.value;
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
initSupabaseDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🗄️ Connected to Supabase database`);
    console.log(`🔌 WebSocket server ready for Gemini Live`);
  });
}).catch((error: any) => {
  console.error('Failed to initialize Supabase database:', error);
  process.exit(1);
});

export default app;
