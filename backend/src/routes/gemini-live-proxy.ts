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

// Helper: create a Gemini Live session internally (does not return sensitive URLs)
async function createSessionInternal(params: { model?: string; ttsModel?: string; systemPrompt?: string; agentId?: string; }) {
  const { model, ttsModel, systemPrompt, agentId } = params;

  // Get API key from settings
  const { data: settingsData, error: settingsError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'gemini_api_key')
    .single();

  if (settingsError || !settingsData) {
    throw new Error('Gemini API key not configured');
  }

  const apiKey = settingsData.value;
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const modelToUse = model || 'gemini-2.0-flash-live-001';

  // Create WebSocket connection to Google Gemini Live API (backend-only)
  const googleWsUrl = `wss://generativelanguage.googleapis.com/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
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
          },
          temperature: 0.8
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

    try {
      googleWs.send(JSON.stringify(setupMessage));
      console.log(' Gemini Live Proxy: Setup message sent');
    } catch (e) {
      console.error(' Gemini Live Proxy: Failed to send setup message', e);
    }
  };

  googleWs.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data.toString());
      const session = activeSessions.get(sessionId);

      // 1. Handle function/tool call from Gemini Live
      const toolCall = message.serverContent?.modelToolUse;
      if (toolCall && toolCall.toolRequest) {
        const { toolRequest } = toolCall;
        // Example: { toolRequest: { toolName: 'search_fsm_rag', parameters: { query: '...' } } }
        const toolName = toolRequest.toolName;
        const params = toolRequest.parameters || {};
        console.log('🔧 Gemini Live Proxy: Tool call received:', toolName, params);

        if (toolName === 'search_fsm_rag' && params.query) {
          // Call local RAG endpoint
          try {
            const axios = require('axios');
            const ragRes = await axios.post(
              'http://localhost:3001/api/rag/search',
              { query: params.query, language: params.language || 'hy-AM', limit: 3 },
              { timeout: 10000 }
            );
            const ragResult = ragRes.data;
            let context = '';
            if (ragResult && ragResult.results && ragResult.results.length > 0) {
              context = ragResult.results.map((r: any, i: number) => `Document ${i + 1}: ${r.content}`).join('\n---\n');
            } else {
              context = 'No relevant documents found.';
            }

            // Send tool response back to Gemini Live
            const toolResponseMsg = {
              toolResponse: {
                toolName,
                response: {
                  context
                }
              }
            };
            if (session && session.googleWs && session.googleWs.readyState === WebSocket.OPEN) {
              session.googleWs.send(JSON.stringify(toolResponseMsg));
              console.log('🔧 Gemini Live Proxy: Tool response sent to Gemini:', toolResponseMsg);
            }
          } catch (err) {
            console.error('🔧 Gemini Live Proxy: RAG tool call failed:', err);
          }
        }
        return; // Do not forward tool call to client
      }

      // 2. Forward normal model/audio output to client
      if (session && session.onMessageCallback) {
        let text = '';
        let audio: Uint8Array | undefined;

        if (message.serverContent?.modelTurn?.parts) {
          for (const part of message.serverContent.modelTurn.parts) {
            if (part.text) text += part.text;
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

  return { sessionId, model: modelToUse, ttsModel: ttsModel || 'gemini-2.5-flash' };
}

/**
 * POST /api/gemini/live/session
 * Safer session creation endpoint for frontend: returns only sessionId and backend WS URL.
 * Body: { model, ttsModel, systemPrompt, agentId }
 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { model, ttsModel, systemPrompt, agentId } = req.body || {};
    const result = await createSessionInternal({ model, ttsModel, systemPrompt, agentId });

    // Build backend WS URL for clients to connect to (do not expose google API key or google WS URL)
    const backendBase = process.env.BACKEND_WS_URL || process.env.API_URL || `http://localhost:3001`;
    const wsUrl = (backendBase.startsWith('http') ? backendBase.replace(/^http/, 'ws') : backendBase).replace(/\/$/, '') + `/?sessionId=${result.sessionId}`;

    res.json({
      success: true,
      sessionId: result.sessionId,
      model: result.model,
      ttsModel: result.ttsModel,
      wsUrl // clients should connect to this WS URL on the backend
    });
  } catch (error) {
    console.error(' Gemini Live Proxy: Session create error:', error);
    res.status(500).json({ error: 'Failed to create session', details: error instanceof Error ? error.message : 'Unknown error' });
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
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: audioBase64
                  }
                }
              ]
            }
          ]
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
