/**
 * Gemini Live API Proxy
 * Proxies WebSocket connection from frontend to Google Gemini Live API
 * Frontend connects to this backend, backend connects to Google API
 * This avoids CORS/browser restrictions
 */

import express, { Request, Response } from 'express';
import { supabase } from '../database/supabase';

const router = express.Router();

// Store active sessions keyed by sessionId
interface GeminiLiveSession {
  sessionId: string;
  googleWs: any; // WebSocket connection to Google API
  clientWs: any; // Reference to client connection
  systemPrompt: string;
  model: string;
  ttsModel: string;
  agentId?: string;
  createdAt: number;
}

const activeSessions = new Map<string, GeminiLiveSession>();

/**
 * POST /api/gemini/live/setup
 * Initialize a new Gemini Live session and establish WebSocket proxy
 * Body: { model, ttsModel, systemPrompt, agentId }
 * Returns: { sessionId, wsUrl }
 * 
 * Supported models:
 * - gemini-2.5-flash-native-audio-preview-09-2025 (Default, supports Armenian and other languages)
 * - gemini-live-2.5-flash-preview-native-audio-09-2025
 * - gemini-live-2.5-flash-preview
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { model, ttsModel, systemPrompt, agentId } = req.body;

    console.log('🎙️ Gemini Live Proxy: Setting up new session');
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
      console.error('🎙️ Gemini Live Proxy: API key not found');
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const apiKey = settingsData.value;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const modelToUse = model || 'gemini-2.5-flash-native-audio-preview-09-2025';

    console.log('🎙️ Gemini Live Proxy: Session ID:', sessionId);
    console.log('🎙️ Gemini Live Proxy: Model:', modelToUse);

    // Create session object
    const session: GeminiLiveSession = {
      sessionId,
      googleWs: null,
      clientWs: null,
      systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
      model: modelToUse,
      ttsModel: ttsModel || 'gemini-2.5-flash',
      agentId,
      createdAt: Date.now()
    };

    activeSessions.set(sessionId, session);

    console.log('🎙️ Gemini Live Proxy: Session created successfully');
    console.log('   Active sessions:', activeSessions.size);

    res.json({
      success: true,
      sessionId,
      model: modelToUse,
      ttsModel: ttsModel || 'gemini-2.5-flash',
      endpoint: `wss://generativelanguage.googleapis.com/google.ai.generativelanguage.v1alpha.GenerativeService/BidiGenerateContent?key=${apiKey}`
    });

  } catch (error) {
    console.error('🎙️ Gemini Live Proxy: Setup error:', error);
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

    console.log('🎙️ Gemini Live Proxy: Sending message');
    console.log('   Session ID:', sessionId);
    console.log('   Content type:', contentType);
    console.log('   Audio size:', audioBase64 ? Math.round(audioBase64.length / 1024) + 'KB' : 'none');

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get API key
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (settingsError || !settingsData) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const apiKey = settingsData.value;

    // Prepare client message for Gemini Live API
    const clientMessage = {
      setup: {
        model: `models/${session.model}`,
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
              text: session.systemPrompt
            }
          ]
        }
      }
    };

    if (audioBase64 && contentType === 'audio') {
      Object.assign(clientMessage, {
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
      });
    }

    // Call Gemini Live API using fetch (simulating WebSocket behavior)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/google.ai.generativelanguage.v1alpha.GenerativeService/BidiGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(clientMessage)
      }
    );

    const result = (await response.json()) as any;

    if (!response.ok) {
      console.error('🎙️ Gemini Live Proxy: API error:', result);
      return res.status(response.status).json({
        error: result.error?.message || 'Gemini API error',
        details: result.error
      });
    }

    console.log('🎙️ Gemini Live Proxy: Response received');

    // Extract text and audio from response
    let textResponse = '';
    let audioResponse: string | null = null;

    if (result.serverContent?.modelTurn?.parts) {
      for (const part of result.serverContent.modelTurn.parts) {
        if (part.text) {
          textResponse += part.text;
          console.log('🎙️ Gemini Live Proxy: Text response:', textResponse.substring(0, 100));
        }
        if (part.inlineData?.mimeType?.includes('audio')) {
          audioResponse = part.inlineData.data;
          console.log('🎙️ Gemini Live Proxy: Audio response received');
        }
      }
    }

    res.json({
      success: true,
      text: textResponse || '',
      audio: audioResponse || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🎙️ Gemini Live Proxy: Send error:', error);
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

    console.log('🎙️ Gemini Live Proxy: Cleaning up session:', sessionId);

    const session = activeSessions.get(sessionId);
    if (session) {
      if (session.googleWs) {
        session.googleWs.close();
      }
      activeSessions.delete(sessionId);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('🎙️ Gemini Live Proxy: Cleanup error:', error);
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
