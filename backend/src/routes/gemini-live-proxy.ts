/**
 * Gemini Live API Proxy
 * Proxies WebSocket connection from frontend to Google Gemini Live API
 * Frontend connects to this backend, backend connects to Google API
 * This avoids CORS/browser restrictions
 */

import express, { Request, Response } from 'express';
import WebSocket from 'ws';
import { supabase } from '../database/supabase';

const router = express.Router();

// Store active sessions keyed by sessionId
interface GeminiLiveSession {
  sessionId: string;
  googleWs: WebSocket | null; // WebSocket connection to Google API
  clientWs: WebSocket | null; // Reference to client connection
  systemPrompt: string;
  model: string;
  ttsModel: string;
  agentId?: string;
  createdAt: number;
  onMessageCallback?: (text: string, audio?: Uint8Array) => void;
}

const activeSessions = new Map<string, GeminiLiveSession>();

/**
 * POST /api/gemini/live/setup
 * Initialize a new Gemini Live session and establish WebSocket proxy
 * Body: { model, ttsModel, systemPrompt, agentId }
 * Returns: { sessionId, wsUrl }
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { model, ttsModel, systemPrompt, agentId } = req.body;

    console.log('??? Gemini Live Proxy: Setting up new session');
    console.log('   Model:', model);
    console.log('   TTS Model:', ttsModel);
    console.log('   Agent:', agentId);

    // Get API key from settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (settingsError || !settingsData) {
      console.error(' Gemini Live Proxy: API key not found');
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const apiKey = settingsData.value;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const modelToUse = model || 'gemini-2.5-flash-native-audio-preview-09-2025';

    console.log('??? Gemini Live Proxy: Session ID:', sessionId);
    console.log('??? Gemini Live Proxy: Model:', modelToUse);

    // Create WebSocket connection to Google Gemini Live API
    const googleWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const googleWs = new WebSocket(googleWsUrl);

    googleWs.onopen = () => {
      console.log('??? Gemini Live Proxy: Connected to Google WebSocket');

      // Send setup message
      const setupMessage = {
        setup: {
          model: `models/${modelToUse}`,
          generationConfig: {
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Puck'
                }
              }
            }
          },
          systemInstruction: {
            parts: [
              {
                text: systemPrompt || 'You are a helpful AI assistant.'
              }
            ]
          }
        }
      };

      googleWs.send(JSON.stringify(setupMessage));
      console.log(' Gemini Live Proxy: Setup message sent');
    };

    googleWs.onmessage = (event) => {
      console.log('🎙️ Gemini Live Proxy: Received message from Google');

      try {
        const message = JSON.parse(event.data.toString());
        console.log('🎙️ Gemini Live Proxy: Parsed message:', JSON.stringify(message, null, 2));

        // Forward to client via callback if available
        const session = activeSessions.get(sessionId);
        if (session && session.onMessageCallback) {
          let text = '';
          let audio: Uint8Array | undefined;

          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              if (part.text) {
                text += part.text;
              }
              if (part.inlineData?.mimeType?.includes('audio')) {
                const base64 = part.inlineData.data;
                audio = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
              }
            }
          }

          if (text || audio) {
            session.onMessageCallback(text, audio);
          }
        }
      } catch (error) {
        console.error('🎙️ Gemini Live Proxy: Failed to parse Google message:', error);
      }
    };

    googleWs.onerror = (error) => {
      console.error(' Gemini Live Proxy: Google WebSocket error:', error);
    };

    googleWs.onclose = (event) => {
      console.log(' Gemini Live Proxy: Google WebSocket closed:', event.code, event.reason);
    };

    // Create session object
    const session: GeminiLiveSession = {
      sessionId,
      googleWs,
      clientWs: null,
      systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
      model: modelToUse,
      ttsModel: ttsModel || 'gemini-2.5-flash',
      agentId,
      createdAt: Date.now()
    };

    activeSessions.set(sessionId, session);

    console.log(' Gemini Live Proxy: Session created successfully');
    console.log('   Active sessions:', activeSessions.size);

    res.json({
      success: true,
      sessionId,
      model: modelToUse,
      ttsModel: ttsModel || 'gemini-2.5-flash',
      endpoint: googleWsUrl
    });

  } catch (error) {
    console.error(' Gemini Live Proxy: Setup error:', error);
    res.status(500).json({
      error: 'Failed to setup session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/gemini/live/send
 * Send audio/content to Gemini and get response
 * Body: { sessionId, audioBase64, contentType }
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { sessionId, audioBase64, contentType } = req.body;

    console.log(' Gemini Live Proxy: Sending message');
    console.log('   Session ID:', sessionId);
    console.log('   Content type:', contentType);
    console.log('   Audio size:', audioBase64 ? Math.round(audioBase64.length / 1024) + 'KB' : 'none');

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (audioBase64 && contentType === 'audio') {
      // Send audio message to Google
      const audioMessage = {
        clientContent: {
          turns: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: audioBase64
                  }
                }
              ]
            }
          ],
          turnComplete: true
        }
      };

      if (session.googleWs && session.googleWs.readyState === WebSocket.OPEN) {
        session.googleWs.send(JSON.stringify(audioMessage));
        console.log(' Gemini Live Proxy: Audio message sent to Google');
      } else {
        console.error(' Gemini Live Proxy: Google WebSocket not connected');
        return res.status(500).json({ error: 'Google WebSocket not connected' });
      }
    }

    // Response will come via WebSocket
    res.json({
      success: true,
      message: 'Audio sent successfully'
    });

  } catch (error) {
    console.error(' Gemini Live Proxy: Send error:', error);
    res.status(500).json({
      error: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/gemini/live/cleanup
 * Clean up a session
 * Body: { sessionId }
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    console.log(' Gemini Live Proxy: Cleaning up session:', sessionId);

    const session = activeSessions.get(sessionId);
    if (session) {
      if (session.googleWs) {
        session.googleWs.close();
      }
      activeSessions.delete(sessionId);
    }

    res.json({ success: true });

  } catch (error) {
    console.error(' Gemini Live Proxy: Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup session' });
  }
});

/**
 * GET /api/gemini/live/status
 * Get status of all active sessions
 */
router.get('/status', (req: Request, res: Response) => {
  const sessions = Array.from(activeSessions.values()).map(s => ({
    sessionId: s.sessionId,
    model: s.model,
    agentId: s.agentId,
    age: Date.now() - s.createdAt,
    createdAt: new Date(s.createdAt).toISOString()
  }));

  res.json({
    activeSessions: sessions.length,
    sessions
  });
});

export default router;
export { activeSessions };
