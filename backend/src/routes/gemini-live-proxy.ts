/**
 * Gemini Live API Proxy
 * Proxies WebSocket connection from frontend to Google Gemini Live API
 * Frontend connects to this backend, backend connects to Google API
 * This avoids CORS/browser restrictions
 */

import express, { Request, Response } from 'express';
import WebSocket from 'ws';
import { supabase } from '../database/supabase';
import * as sessionManager from '../services/geminiLive/sessionManagerClean';
import { processFallbackAudio } from '../services/fallback/fallbackHandler';

const router = express.Router();

// Session lifecycle and Google connection handling delegated to sessionManager

/**
 * POST /api/gemini/live/session
 * Safer session creation endpoint for frontend: returns only sessionId and backend WS URL.
 * Body: { model, ttsModel, systemPrompt, agentId }
 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { model, ttsModel, systemPrompt, agentId } = req.body || {};
  const result = await sessionManager.createSession({ model, ttsModel, systemPrompt, agentId });

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
 * GET /api/gemini/live/test-handshake
 * Diagnostic endpoint: attempts a short WebSocket handshake to Google using the
 * gemini_api_key read from the settings table and returns status/details.
 * This keeps the API key on the backend while allowing you to observe upgrade
 * responses (404 bodies/headers) without exposing the key to browsers.
 */
router.get('/test-handshake', async (req: Request, res: Response) => {
  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (settingsError || !settingsData || !settingsData.value) {
      return res.status(500).json({ error: 'Gemini API key not configured in settings' });
    }

    const apiKey = settingsData.value;
    const googleWsUrl = `wss://generativelanguage.googleapis.com/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    // Attempt a short handshake and capture unexpected-response / error
    const testWs = new WebSocket(googleWsUrl);
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { testWs.terminate(); } catch (e) {}
        return res.status(504).json({ status: 'timeout', message: 'No response from Google during handshake (5s)' });
      }
    }, 5000);

    testWs.on('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { testWs.close(); } catch (e) {}
      return res.json({ status: 'open', message: 'WebSocket opened successfully' });
    });

    testWs.on('unexpected-response', (req2: any, resp2: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        const status = resp2 && resp2.statusCode;
        const statusMessage = resp2 && resp2.statusMessage;
        const headers = resp2 && resp2.headers;
        let body = '';
        resp2.on && resp2.on('data', (chunk: any) => { body += chunk.toString(); });
        resp2.on && resp2.on('end', () => {
          if (!res.headersSent) {
            return res.status(502).json({ status: 'unexpected-response', statusCode: status, statusMessage, headers, body: String(body).slice(0, 200) });
          }
        });

        // If no 'end' event, return basic info after short delay (only if not already responded)
        setTimeout(() => {
          if (!res.headersSent) {
            return res.status(502).json({ status: 'unexpected-response', statusCode: status, statusMessage, headers, body: (body || '').slice(0,200) });
          }
        }, 250);
      } catch (err) {
        return res.status(502).json({ status: 'unexpected-response', error: String(err) });
      }
    });

    testWs.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      return res.status(502).json({ status: 'error', message: err && err.message ? err.message : String(err) });
    });

  } catch (error) {
    console.error(' Gemini Live Proxy: handshake test error:', error);
    return res.status(500).json({ error: 'Handshake test failed', details: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/gemini/live/check-rest
 * Diagnostic: try several Generative Language REST endpoints using the gemini_api_key
 * and return HTTP status / body snippets to help determine whether the API key works
 * for REST calls (this narrows whether the problem is WebSocket-specific).
 */
router.get('/check-rest', async (req: Request, res: Response) => {
  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (settingsError || !settingsData || !settingsData.value) {
      return res.status(500).json({ error: 'Gemini API key not configured in settings' });
    }

    const apiKey = settingsData.value;
    const axios = require('axios');

    const candidates = [
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta2/models?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1alpha/models?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models:generateText?key=${apiKey}`
    ];

    const results: any[] = [];
    for (const url of candidates) {
      try {
        const r = await axios.get(url, { timeout: 5000 });
        results.push({ url, status: r.status, statusText: r.statusText, snippet: JSON.stringify(r.data).slice(0, 500) });
      } catch (err: any) {
        if (err.response) {
          results.push({ url, status: err.response.status, statusText: err.response.statusText, snippet: (err.response.data && JSON.stringify(err.response.data).slice(0,500)) || '' });
        } else {
          results.push({ url, error: err.message });
        }
      }
    }

    return res.json({ results });
  } catch (error) {
    console.error(' Gemini Live Proxy: check-rest error:', error);
    return res.status(500).json({ error: 'check-rest failed', details: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/gemini/live/probe-ws
 * Try multiple candidate WebSocket endpoints and report their handshake results.
 */
router.get('/probe-ws', async (req: Request, res: Response) => {
  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (settingsError || !settingsData || !settingsData.value) {
      return res.status(500).json({ error: 'Gemini API key not configured in settings' });
    }

    const apiKey = settingsData.value;
    const candidates = [
      // current URL used in code
      `wss://generativelanguage.googleapis.com/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`,
      // possible variant without the google.ai namespace
      `wss://generativelanguage.googleapis.com/v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`,
      // older style endpoints
      `wss://generativelanguage.googleapis.com/v1beta2/stream?key=${apiKey}`,
      `wss://generativelanguage.googleapis.com/v1/stream?key=${apiKey}`
    ];

    const results: any[] = [];
    const WebSocketClient = WebSocket;

    const probeOne = (url: string) => new Promise<any>((resolve) => {
      let settled = false;
      try {
        const ws = new WebSocketClient(url);
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          try { ws.terminate(); } catch (e) {}
          resolve({ url, status: 'timeout' });
        }, 5000);

        ws.on('open', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          try { ws.close(); } catch (e) {}
          resolve({ url, status: 'open' });
        });

        ws.on('unexpected-response', (req2: any, resp2: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          try {
            const status = resp2 && resp2.statusCode;
            const statusMessage = resp2 && resp2.statusMessage;
            const headers = resp2 && resp2.headers;
            let body = '';
            resp2.on && resp2.on('data', (chunk: any) => { body += chunk.toString(); });
            resp2.on && resp2.on('end', () => {
              resolve({ url, status: 'unexpected-response', statusCode: status, statusMessage, headers, body: String(body).slice(0,200) });
            });
            // fallback if no end
            setTimeout(() => {
              resolve({ url, status: 'unexpected-response', statusCode: status, statusMessage, headers, body: (body||'').slice(0,200) });
            }, 200);
          } catch (err) {
            resolve({ url, status: 'unexpected-response', error: String(err) });
          }
        });

        ws.on('error', (err: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve({ url, status: 'error', message: err && err.message ? err.message : String(err) });
        });
      } catch (err) {
        resolve({ url, status: 'exception', error: String(err) });
      }
    });

    for (const url of candidates) {
      // eslint-disable-next-line no-await-in-loop
      // probe sequentially to avoid parallel sockets overload
      // but each probe has its own timeout
      // eslint-disable-next-line no-await-in-loop
      const r = await probeOne(url);
      results.push(r);
    }

    return res.json({ results });
  } catch (error) {
    console.error(' Gemini Live Proxy: probe-ws error:', error);
    return res.status(500).json({ error: 'probe-ws failed', details: error instanceof Error ? error.message : String(error) });
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

    // Delegate to sessionManager which encapsulates google ws handling
    try {
      if (audioBase64) {
        // Forward any audio MIME type (e.g., audio/webm, audio/ogg) to session manager.
        // sessionManager will decide how to encode/send depending on SDK/raw WS.
        await sessionManager.sendAudio(sessionId, audioBase64, contentType || undefined);
        console.log(' Gemini Live Proxy: Audio forwarded to sessionManager');
      }
    } catch (err: any) {
      console.error(' Gemini Live Proxy: send failed:', err && err.message ? err.message : err);
      return res.status(500).json({ error: 'Failed to send audio', details: err && err.message ? err.message : String(err) });
    }

    // If upstream (SDK/raw WS) is not ready, send a quick fallback text response to the client
    try {
      const session = sessionManager.getSession(sessionId);
      const upstreamReady = session && ((session.sdkSession) || (session.googleWs && session.googleWs.readyState === WebSocket.OPEN));
      if (!upstreamReady && session && session.onMessageCallback) {
        // If OpenAI key is configured we will run an async STT->generate->TTS fallback.
        // In that case avoid sending an immediately spoken fallback text — send a small non‑spoken processing notice instead.
        let hasOpenAI = false;
        try {
          const { data: openaiData } = await supabase.from('settings').select('value').eq('key', 'openai_api_key').single();
          hasOpenAI = !!(openaiData && openaiData.value);
        } catch (e) { /* ignore DB read errors and treat as no key */ }

        if (hasOpenAI) {
          // Send a processing placeholder that the client will ignore for TTS
          try {
            session.onMessageCallback(`[PROCESSING] Processing audio, please wait...`);
            console.log(' Gemini Live Proxy: Sent processing placeholder to client for session', sessionId);
          } catch (e) { console.warn(' Gemini Live Proxy: failed to send processing placeholder', (e as any)?.message || e); }

          // Start async fallback pipeline (STT -> generate -> TTS)
          try { processFallbackAudio(session, audioBase64, contentType).catch((err:any) => console.warn('fallback processing failed', err)); } catch (e) { console.warn('fallback processing scheduling failed', (e as any)?.message || e); }
        } else {
          // No OpenAI available — send the friendly textual fallback immediately (will be spoken by client TTS)
          const fallbackText = `[FALLBACK] ${session.systemPrompt || 'I received your audio. I am currently unable to stream to the upstream model, but I will respond here.'}`;
          try {
            session.onMessageCallback(fallbackText);
            console.log(' Gemini Live Proxy: Sent fallback text to client for session', sessionId);
          } catch (e) {
            console.warn(' Gemini Live Proxy: failed to send fallback text', e && (e as any).message ? (e as any).message : e);
          }
          // Still attempt processing (will no-op if no key)
          try { processFallbackAudio(session, audioBase64, contentType).catch((err:any) => console.warn('fallback processing failed', err)); } catch (e) { console.warn('fallback processing scheduling failed', (e as any)?.message || e); }
        }
      }
    } catch (e) { console.warn(' Gemini Live Proxy: fallback send check failed', (e as any)?.message || e); }

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
 * POST /api/gemini/live/send-text
 * Body: { sessionId, text }
 * Helper for simple test clients to send text turns into the Live session.
 */
router.post('/send-text', async (req: Request, res: Response) => {
  try {
    const { sessionId, text } = req.body || {};
    if (!sessionId || !text) return res.status(400).json({ error: 'sessionId and text required' });

    try {
      await sessionManager.sendText(sessionId, text);
      return res.json({ success: true, message: 'Text sent' });
    } catch (err: any) {
      console.error(' Gemini Live Proxy: send-text failed:', err);
      return res.status(500).json({ error: 'Failed to send text', details: err && err.message ? err.message : String(err) });
    }
  } catch (error) {
    console.error(' Gemini Live Proxy: send-text error:', error);
    return res.status(500).json({ error: 'send-text failed', details: error instanceof Error ? error.message : String(error) });
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

    // Delegate cleanup to sessionManager
    try {
      sessionManager.cleanupSession(sessionId);
    } catch (err) {
      console.error(' Gemini Live Proxy: cleanup failed', err);
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
  const sessions = sessionManager.listSessions();

  res.json({
    activeSessions: sessions.length,
    sessions
  });
});

export default router;

/**
 * GET /api/gemini/live/session-debug
 * Return the internal session object for debugging (keeps API key on backend).
 * Query: ?sessionId=...
 */
router.get('/session-debug', (req: Request, res: Response) => {
  try {
    const sessionId = String(req.query.sessionId || '');
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const s = sessionManager.getSession(sessionId);
    if (!s) return res.status(404).json({ error: 'Session not found' });

    // Avoid sending any sensitive objects (like sdkSession with credentials); redact functions and sockets
    const safe: any = {
      sessionId: s.sessionId,
      model: s.model,
      ttsModel: s.ttsModel,
      agentId: s.agentId,
      systemPrompt: s.systemPrompt,
      createdAt: new Date(s.createdAt).toISOString(),
      state: s.state || null,
      lastError: s.lastError || null,
      retryCount: s.retryCount || 0,
      pendingMsgsCount: (s.pendingMsgs && s.pendingMsgs.length) || 0,
      pendingMsgPreview: (s.pendingMsgs || []).slice(0,5).map(p => ({ type: p.type, preview: p.type === 'text' ? String(p.payload).slice(0,120) : `${Math.round((p.payload?.data?.length||0)/1024)}KB` }))
    };

    return res.json({ success: true, session: safe });
  } catch (err) {
    console.error('Gemini Live Proxy: session-debug error', err);
    return res.status(500).json({ error: 'session-debug failed', details: err instanceof Error ? err.message : String(err) });
  }
});
