import WebSocket from 'ws';
import { supabase } from '../../database/supabase';

interface GeminiLiveSession {
  sessionId: string;
  googleWs: WebSocket | null;
  sdkSession?: any;
  clientWs: WebSocket | null;
  systemPrompt: string;
  model: string;
  ttsModel: string;
  agentId?: string;
  createdAt: number;
  onMessageCallback?: (text: string, audio?: Uint8Array, mimeType?: string) => void;
  pendingMsgs?: Array<{ type: 'text' | 'audio'; payload: any }>;
  initialMessages?: Array<{ text?: string; audioBase64?: string; mime?: string }>;
  state?: string | null;
  lastError?: string | null;
  retryCount?: number;
}

const activeSessions = new Map<string, GeminiLiveSession>();

// Loaded marker to help verify the running backend uses this file/version
try {
  console.log('sessionManagerClean: LOADED', new Date().toISOString());
} catch (e) {}

async function createSession(opts: { model?: string; ttsModel?: string; systemPrompt?: string; agentId?: string } = {}) {
  const { model, ttsModel, systemPrompt, agentId } = opts;

  const { data: settingsData, error: settingsError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'gemini_api_key')
    .single();

  if (settingsError || !settingsData || !settingsData.value) {
    throw new Error('Gemini API key not configured');
  }

  const apiKey = settingsData.value;
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const modelToUse = model || 'gemini-2.0-flash-live-001';

  const session: GeminiLiveSession = {
    sessionId,
    googleWs: null,
    sdkSession: undefined,
    clientWs: null,
    systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
    model: modelToUse,
    ttsModel: ttsModel || 'gemini-2.5-flash',
    agentId,
    createdAt: Date.now()
    , pendingMsgs: [], initialMessages: []
  };

  activeSessions.set(sessionId, session);
  startGoogleConnection(sessionId, apiKey).catch((err) => console.error('sessionManager: startGoogleConnection failed', err));

  return { sessionId, model: modelToUse, ttsModel: ttsModel || 'gemini-2.5-flash' };
}

async function startGoogleConnection(sessionId: string, apiKey: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const useSdk = process.env.USE_GENAI_SDK === 'true';
  const forceRaw = process.env.FORCE_RAW_WS === 'true';
  if (forceRaw) console.log('sessionManager: FORCE_RAW_WS=true -> forcing raw WebSocket (SDK disabled)');
  // Use the documented Live API websocket path (v1beta, /ws/ prefix)
  const googleWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  const attachUnexpectedResponseHandler = (ws: WebSocket) => {
    ws.on('unexpected-response', (req: any, res: any) => {
      try {
        const status = res && res.statusCode;
        const statusMessage = res && res.statusMessage;
        const headers = res && res.headers;
        let body = '';
        res.on && res.on('data', (chunk: any) => { body += chunk.toString(); });
        res.on && res.on('end', () => {
          // Also include some request details if available for easier debugging
          let reqInfo: any = {};
          try {
            if (req && typeof req.getHeaders === 'function') {
              reqInfo = { method: req.method, path: req.path, headers: req.getHeaders ? req.getHeaders() : req._headers };
            } else if (req) {
              reqInfo = { method: req.method || req.method, headers: req.headers || req._headers };
            }
          } catch (e) { reqInfo = { error: 'failed to read request headers' }; }

          console.error('sessionManager: unexpected-response during upgrade', { status, statusMessage, req: reqInfo, headers, body: body.slice(0, 200) });
          try {
            // mark session error and notify client if connected
            const s = activeSessions.get(sessionId);
            if (s) {
              s.state = 'error';
              s.lastError = `upgrade ${status} ${statusMessage}`;
              if (s.onMessageCallback) s.onMessageCallback(`[SYSTEM] Upstream upgrade failed: ${status} ${statusMessage}`);
            }
          } catch (e) {
            console.warn('sessionManager: notify client on unexpected-response failed', (e as any)?.message || String(e));
          }
        });
      } catch (err) {
        console.error('sessionManager: unexpected-response handler failed', err);
      }
    });
  };

  if (useSdk) {
    try {
      const genai = require('@google/genai');
      const exportedKeys = Object.keys(genai || {});
      console.log('sessionManager: genai exports keys sample:', exportedKeys.slice(0, 80));

      // Heuristic to find a usable client or connect entrypoint
      const tryConstructClient = () => {
        const constructorsToTry: any[] = [genai, genai?.Client, genai?.default, genai?.GoogleGenAI, genai?.GoogleGenAIClient, genai?.Live, genai?.LiveClient, genai?.Live?.Client, genai?.GoogleGenAI?.Client];
        for (const c of constructorsToTry) {
          if (!c) continue;
          try {
            if (typeof c === 'function') {
              const inst = new c({ vertexai: true, project: process.env.GCP_PROJECT, location: process.env.GCP_LOCATION });
              if (inst) return inst;
            }
          } catch (e) {
            // ignore
          }
        }
        // fallback: look for any exported object with a connect() function
        const genaiExports = genai || {};
        for (const k of Object.keys(genaiExports)) {
          try {
            const v = (genaiExports as any)[k];
            if (!v) continue;
            if (typeof v.connect === 'function') return v;
            if (v && typeof v === 'object' && typeof v.Live === 'object' && typeof (v.Live as any).connect === 'function') return (v as any).Live;
            if (typeof v === 'function') {
              try {
                const inst = new (v as any)({ vertexai: true, project: process.env.GCP_PROJECT, location: process.env.GCP_LOCATION });
                if (inst && typeof inst.connect === 'function') return inst;
              } catch (e) { }
            }
          } catch (e) { }
        }
        return null;
      };

      const client = tryConstructClient();
      if (!client) {
        console.warn('sessionManager: Unrecognized @google/genai module shape, keys:', exportedKeys);
        console.warn('sessionManager: Skipping SDK path and falling back to raw websocket connection');
      } else {
        (async () => {
          try {
            const connectPayload = {
              model: session.model,
              config: {
                response_modalities: ['AUDIO'],
                speech_config: { voice_config: { prebuilt_voice_config: { voice_name: session.ttsModel || 'Puck' } } },
                system_instruction: { parts: [{ text: session.systemPrompt }] }
              }
            };

            let sdkSession: any = null;
            if (client.aio && client.aio.live && typeof client.aio.live.connect === 'function') {
              sdkSession = await client.aio.live.connect(connectPayload);
            } else if (typeof client.connect === 'function') {
              sdkSession = await client.connect(connectPayload);
            } else if (client.Live && typeof client.Live.connect === 'function') {
              sdkSession = await client.Live.connect(connectPayload);
            } else if (typeof genai !== 'undefined' && genai && typeof genai.connect === 'function') {
              sdkSession = await genai.connect(connectPayload);
            } else if (typeof client === 'function') {
              sdkSession = await client(connectPayload);
            } else {
              console.warn('sessionManager: SDK client constructed but no connect() entrypoint found — falling back to raw WS');
              return;
            }

            session.sdkSession = sdkSession;
            console.log('sessionManager: Connected to GenAI Live via SDK for', session.sessionId);
            session.state = 'sdk-connected';
            if (session.onMessageCallback) session.onMessageCallback('[SYSTEM] Connected to GenAI Live via SDK');

            // flush pending messages (if any)
            if (session.pendingMsgs && session.pendingMsgs.length > 0) {
              const pending = session.pendingMsgs.splice(0);
              console.log('sessionManager: flushing', pending.length, 'pending msgs (SDK) for', session.sessionId);
              try { if (session.onMessageCallback) session.onMessageCallback(`[SYSTEM] Flushing ${pending.length} pending messages to SDK`); } catch (e) {}
              for (const m of pending) {
                try {
                  if (m.type === 'text') await sendText(session.sessionId, m.payload);
                  else if (m.type === 'audio') await sendAudio(session.sessionId, m.payload.data, m.payload.contentType);
                } catch (e) { console.warn('sessionManager: error flushing pending msg (SDK)', e); }
              }
            }

            for await (const message of sdkSession.receive()) {
              try {
                const toolCall = message.server_content?.model_tool_use || message.serverContent?.modelToolUse;
                if (toolCall && (toolCall.toolRequest || toolCall.tool_request)) {
                  try { console.log('sessionManager: SDK toolCall received:', JSON.stringify(toolCall).slice(0, 2000)); } catch (e) { console.log('sessionManager: SDK toolCall received (non-serializable)'); }
                  const tr = toolCall.toolRequest || toolCall.tool_request;
                  const toolName = tr.toolName || tr.tool_name;
                  const params = tr.parameters || tr.parametersJson || {};
                  console.log('sessionManager: SDK tool call parsed:', toolName, params);

                  if (toolName === 'search_fsm_rag' && params.query) {
                    try {
                      const axios = require('axios');
                      const ragRes = await axios.post('http://localhost:3001/api/rag/search', { query: params.query, language: params.language || 'hy-AM', limit: 3 }, { timeout: 10000 });
                      const ragResult = ragRes.data;
                      let context = '';
                      if (ragResult && ragResult.results && ragResult.results.length > 0) context = ragResult.results.map((r: any, i: number) => `Document ${i + 1}: ${r.content}`).join('\n---\n');

                      const toolResponsePayload: any = {
                        toolName,
                        tool_name: toolName,
                        response: { context },
                        response_text: context,
                        metadata: { source: 'rag', resultsCount: (ragResult && ragResult.results) ? ragResult.results.length : 0 },
                        original_request: params || {}
                      };
                      try { console.log('sessionManager: SDK sending toolResponse payload:', JSON.stringify(toolResponsePayload).slice(0,2000)); } catch (e) { console.log('sessionManager: SDK sending toolResponse payload (non-serializable)'); }

                      try {
                        if (typeof sdkSession.send_tool_response === 'function') await sdkSession.send_tool_response(toolResponsePayload);
                        else if (typeof sdkSession.sendToolResponse === 'function') await sdkSession.sendToolResponse(toolResponsePayload);
                        else if (typeof sdkSession.sendClientContent === 'function') await sdkSession.sendClientContent({ toolResponse: toolResponsePayload });
                        else if (typeof sdkSession.send_client_content === 'function') await sdkSession.send_client_content({ tool_response: toolResponsePayload });
                        else if (typeof sdkSession.sendClientContent === 'function') await sdkSession.sendClientContent({ turns: [{ role: 'tool', parts: [{ text: JSON.stringify(toolResponsePayload) }] }] });
                        else console.warn('sessionManager: No known SDK send method found for toolResponse');
                      } catch (e) { console.error('sessionManager: SDK send toolResponse failed', e); }

                      try { const s = activeSessions.get(session.sessionId); if (s && s.onMessageCallback) s.onMessageCallback(`[SYSTEM] RAG provided ${toolResponsePayload.metadata.resultsCount} documents`); } catch (e) {}
                    } catch (err) { console.error('sessionManager: SDK RAG call failed', err); }
                  }

                  continue;
                }

                const active = activeSessions.get(session.sessionId);
                if (active && active.onMessageCallback) {
                  let text = '';
                  let audio: Uint8Array | undefined;
                  const parts = message.server_content?.model_turn?.parts || message.serverContent?.modelTurn?.parts || [];
                  let incomingMime: string | undefined = undefined;
                  for (const part of parts) {
                    if (part.text) text += part.text;
                    const base64 = part.inline_data?.data || part.inlineData?.data;
                    const mime = part.inline_data?.mimeType || part.inlineData?.mimeType;
                    if (base64) audio = Uint8Array.from(Buffer.from(base64, 'base64'));
                    if (base64 && mime) incomingMime = mime;
                  }
                  if (text || audio) active.onMessageCallback(text, audio, incomingMime);
                }
              } catch (err) { console.error('sessionManager: Error processing SDK message', err); }
            }
          } catch (err) {
            console.warn('sessionManager: SDK live.connect error', (err as any)?.message || err);
            // fall through to raw WS path
          }
        })();
        return;
      }
    } catch (err) {
      console.error('sessionManager: failed to init SDK, falling back to raw WS', (err as any)?.message || err);
      try {
        const s = activeSessions.get(sessionId);
        if (s) {
          s.state = 'error';
          s.lastError = (err as any)?.message || String(err);
          s.retryCount = (s.retryCount || 0) + 1;
          if (s.onMessageCallback) s.onMessageCallback(`[SYSTEM] SDK init failed: ${(err as any)?.message || String(err)} - falling back to raw WS (retry ${s.retryCount})`);
          const retry = Math.min(6, s.retryCount);
          const delay = 5000 * Math.pow(2, retry - 1);
          console.log('sessionManager: scheduling reconnect attempt in', delay, 'ms for', sessionId);
          setTimeout(() => {
            const ss = activeSessions.get(sessionId);
            if (ss && (ss.retryCount || 0) < 7) {
              console.log('sessionManager: retrying startGoogleConnection for', sessionId);
              startGoogleConnection(sessionId, apiKey).catch((e) => console.error('sessionManager: retry start failed', e));
            }
          }, delay);
        }
      } catch (e) { }
    }
  }

  console.log('sessionManager: attempting websocket upgrade to', googleWsUrl);
  try {
    // log any default headers that will be used by ws (if accessible)
    try {
      const tmpReq = { project: process.env.GCP_PROJECT, location: process.env.GCP_LOCATION };
      console.log('sessionManager: upgrade metadata', tmpReq);
    } catch (e) {}
  } catch (e) {}

  const ws = new WebSocket(googleWsUrl);
  attachUnexpectedResponseHandler(ws);

  // Log the first incoming message separately for easier debugging of the initial exchange
  let _firstResponseLogged = false;

  ws.onopen = () => {
    const setupMessage = {
      setup: {
        model: `models/${session.model}`,
        generationConfig: { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: session.ttsModel || 'Puck' } } }, temperature: 0.8 },
        systemInstruction: { parts: [{ text: session.systemPrompt }] }
      }
    };
    try {
      const payload = JSON.stringify(setupMessage);
      console.log('sessionManager: sending initial setup payload to Google (length=', payload.length, ')', payload.slice(0, 1000));
      ws.send(payload);
      try { session.state = 'raw-ws'; if (session.onMessageCallback) session.onMessageCallback('[SYSTEM] Raw websocket opened to Google (fallback)'); } catch (e) {}

      // flush pending messages (if any)
      if (session.pendingMsgs && session.pendingMsgs.length > 0) {
        const pending = session.pendingMsgs.splice(0);
        console.log('sessionManager: flushing', pending.length, 'pending msgs (raw WS) for', session.sessionId);
        try { if (session.onMessageCallback) session.onMessageCallback(`[SYSTEM] Flushing ${pending.length} pending messages to raw WS`); } catch (e) {}
        (async () => {
          for (const m of pending) {
            try {
              if (m.type === 'text') await sendText(session.sessionId, m.payload);
              else if (m.type === 'audio') await sendAudio(session.sessionId, m.payload.data, m.payload.contentType);
            } catch (err) {
              console.warn('sessionManager: failed flushing pending msg', err);
            }
          }
        })();
      }
    } catch (e) { console.error('sessionManager: send setup failed', e); }
  };

  ws.onmessage = async (event) => {
    try {
      // Log first response in full (truncated) to help debugging handshake/initial exchange
      if (!_firstResponseLogged) {
        try { console.log('sessionManager: initial raw response from Google (truncated 2000 chars):', String(event.data).slice(0, 2000)); } catch (e) {}
        try {
          // Also forward the raw initial response to the connected UI for quick-test debugging
          const s = activeSessions.get(sessionId);
          if (s && s.onMessageCallback) {
            try { s.onMessageCallback(`[RAW] ${String(event.data).slice(0, 2000)}`); } catch (e) { /* ignore */ }
          }
        } catch (e) {}
        _firstResponseLogged = true;
      }
      const message = JSON.parse(event.data.toString());
      const toolCall = message.serverContent?.modelToolUse || message.server_content?.model_tool_use;
      if (toolCall && toolCall.toolRequest) {
        // Log the incoming raw toolCall for debugging
        try { console.log('sessionManager: raw WS toolCall received:', JSON.stringify(toolCall).slice(0,2000)); } catch (e) { console.log('sessionManager: raw WS toolCall received (non-serializable)'); }
        const { toolRequest } = toolCall;
        const toolName = toolRequest.toolName || toolRequest.tool_name;
        const params = toolRequest.parameters || toolRequest.parametersJson || {};
        if (toolName === 'search_fsm_rag' && params.query) {
          try {
            const axios = require('axios');
            const ragRes = await axios.post('http://localhost:3001/api/rag/search', { query: params.query, language: params.language || 'hy-AM', limit: 3 }, { timeout: 10000 });
            const ragResult = ragRes.data;
            let context = '';
            if (ragResult && ragResult.results && ragResult.results.length > 0) context = ragResult.results.map((r: any, i: number) => `Document ${i + 1}: ${r.content}`).join('\n---\n');

            // Build a robust toolResponse that includes both snake_case and camelCase variants
            const toolResponseBody: any = {
              toolResponse: { toolName, response: { context } },
              tool_response: { tool_name: toolName, response: { context } },
              metadata: { source: 'rag', resultsCount: (ragResult && ragResult.results) ? ragResult.results.length : 0 },
              original_request: params || {}
            };
            try { console.log('sessionManager: raw WS sending toolResponseMsg:', JSON.stringify(toolResponseBody).slice(0,2000)); } catch (e) { console.log('sessionManager: raw WS sending toolResponseMsg (non-serializable)'); }
            try { ws.send(JSON.stringify(toolResponseBody)); } catch (e) { console.error('sessionManager: send tool response failed', e); }

            // Notify connected client UI
            try {
              const s = activeSessions.get(session.sessionId);
              if (s && s.onMessageCallback) s.onMessageCallback(`[SYSTEM] RAG provided ${toolResponseBody.metadata.resultsCount} documents`);
            } catch (e) {}
          } catch (err) { console.error('sessionManager: RAG call failed', err); }
        }
        return;
      }

      const active = activeSessions.get(session.sessionId);
      if (active && active.onMessageCallback) {
        let text = '';
        let audio: Uint8Array | undefined;
        let incomingMime: string | undefined = undefined;
        if (message.serverContent?.modelTurn?.parts) {
          for (const part of message.serverContent.modelTurn.parts) {
            if (part.text) text += part.text;
            if (part.inlineData?.mimeType?.includes('audio')) {
              const base64 = part.inlineData.data;
              audio = Uint8Array.from(Buffer.from(base64, 'base64'));
              incomingMime = part.inlineData.mimeType;
            }
          }
        }
                if (text || audio) {
                  console.log('sessionManager: forwarding SDK message to client for', session.sessionId, 'textLen=', text.length, 'audioBytes=', audio ? audio.length : 0);
                  active.onMessageCallback(text, audio, incomingMime);
                }
      }
    } catch (err) {
      console.error('sessionManager: parse message failed', err);
    }
  };

  ws.onerror = (err) => console.error('sessionManager: google ws error', err && (err as any).message ? (err as any).message : err);
  ws.onclose = () => { const s = activeSessions.get(session.sessionId); if (s) s.googleWs = null; };
  session.googleWs = ws;
}

function getSession(sessionId: string) { return activeSessions.get(sessionId) || null; }

function listSessions() { return Array.from(activeSessions.values()).map(s => ({ sessionId: s.sessionId, model: s.model, agentId: s.agentId, age: Date.now() - s.createdAt, createdAt: new Date(s.createdAt).toISOString() })); }

async function sendAudio(sessionId: string, audioBase64: string, contentType?: string) {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  if (!audioBase64) return;

  if (session.sdkSession) {
    try {
      const sdk = session.sdkSession;
      console.log('sessionManager: sendAudio using SDK for', sessionId, 'sizeKB=', Math.round((audioBase64.length||0)/1024), 'contentType=', contentType);
      if (sdk.send_realtime_input) { await sdk.send_realtime_input({ audio: { data: Buffer.from(audioBase64, 'base64'), mime_type: contentType || 'audio/pcm;rate=16000' } }); return; }
      if (sdk.sendRealtimeInput) { await sdk.sendRealtimeInput({ audio: { data: Buffer.from(audioBase64, 'base64'), mimeType: contentType || 'audio/pcm;rate=16000' } }); return; }
      if (sdk.sendClientContent) { await sdk.sendClientContent({ turns: [{ role: 'user', parts: [{ inlineData: { mimeType: contentType || 'audio/pcm;rate=16000', data: audioBase64 } }] }] }); return; }
    } catch (err) { console.warn('sessionManager: SDK send failed', err); }
  }

  const audioMessage = { clientContent: { turns: [{ role: 'user', parts: [{ inlineData: { mimeType: contentType || 'audio/pcm;rate=16000', data: audioBase64 } }] }] } };
  if (session.googleWs && session.googleWs.readyState === WebSocket.OPEN) {
    console.log('sessionManager: sendAudio sending raw WS message for', sessionId, 'sizeKB=', Math.round((audioBase64.length||0)/1024));
    try { if (session.onMessageCallback) session.onMessageCallback('[SYSTEM] Sending audio to upstream (raw WS)'); } catch (e) {}
    session.googleWs.send(JSON.stringify(audioMessage));
    return;
  }

  // If not connected, enqueue audio to send when ready
  session.pendingMsgs = session.pendingMsgs || [];
  session.pendingMsgs.push({ type: 'audio', payload: { data: audioBase64, contentType } });
  console.log('sessionManager: queued audio for session', sessionId, 'sizeKB=', Math.round((audioBase64.length||0)/1024));
  return; // queued
}

function cleanupSession(sessionId: string) { const session = activeSessions.get(sessionId); if (session) { try { session.googleWs && session.googleWs.close(); } catch (e) {} try { session.sdkSession && (session.sdkSession.close ? session.sdkSession.close() : null); } catch (e) {} activeSessions.delete(sessionId); } }

export { createSession, getSession, listSessions, sendAudio, cleanupSession }

// Send plain text as a user turn into the Live session (SDK or raw WS)
async function sendText(sessionId: string, text: string) {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  if (!text) return;

  // SDK path
  if (session.sdkSession) {
    try {
      const sdk = session.sdkSession;
      const payload = { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true };
      if (sdk.sendClientContent) {
        await sdk.sendClientContent(payload);
        return;
      }
      if (sdk.send_client_content) {
        await sdk.send_client_content(payload);
        return;
      }
    } catch (err) {
      console.warn('sessionManager: SDK sendText failed, falling back to raw WS', err);
    }
  }

  // Raw WS fallback
  const msg = { clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } };
  if (session.googleWs && session.googleWs.readyState === WebSocket.OPEN) {
    session.googleWs.send(JSON.stringify(msg));
    return;
  }

  // If the connection is not ready, enqueue the message to be flushed later
  session.pendingMsgs = session.pendingMsgs || [];
  session.pendingMsgs.push({ type: 'text', payload: text });
    console.log('sessionManager: queued text for session', sessionId, 'textPreview=', text && text.slice(0,60));
  return; // queued
}

export { sendText };
