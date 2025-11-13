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
  onMessageCallback?: (text: string, audio?: Uint8Array) => void;
  // diagnostic state
  state?: 'connecting' | 'sdk-connected' | 'raw-ws' | 'error' | 'ready';
  lastError?: string;
  retryCount?: number;
  pendingMsgs?: Array<{ type: 'text' | 'audio'; payload: any }>;
}

const activeSessions = new Map<string, GeminiLiveSession>();

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
    , pendingMsgs: []
  };

  activeSessions.set(sessionId, session);
  startGoogleConnection(sessionId, apiKey).catch((err) => console.error('sessionManager: startGoogleConnection failed', err));

  return { sessionId, model: modelToUse, ttsModel: ttsModel || 'gemini-2.5-flash' };
}

async function startGoogleConnection(sessionId: string, apiKey: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const useSdk = process.env.USE_GENAI_SDK === 'true';
  const googleWsUrl = `wss://generativelanguage.googleapis.com/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  const attachUnexpectedResponseHandler = (ws: WebSocket) => {
    ws.on('unexpected-response', (req: any, res: any) => {
      try {
        const status = res && res.statusCode;
        const statusMessage = res && res.statusMessage;
        const headers = res && res.headers;
        let body = '';
        res.on && res.on('data', (chunk: any) => { body += chunk.toString(); });
        res.on && res.on('end', () => {
          console.error('sessionManager: unexpected-response during upgrade', { status, statusMessage, headers, body: body.slice(0, 200) });
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
      let client: any = null;
      const exportedKeys = Object.keys(genai || {});
      console.log('sessionManager: genai exports keys sample:', exportedKeys.slice(0, 80));

      // Attempt several heuristics to construct a usable client or identify a static connect entrypoint
      const tryConstructClient = () => {
        const constructorsToTry: any[] = [];

        // direct module (callable)
        constructorsToTry.push(genai);
  // common named exports (include GoogleGenAI and variants)
  constructorsToTry.push(genai?.Client, genai?.default, genai?.GoogleGenAI, genai?.GoogleGenAIClient, genai?.Live, genai?.LiveClient, genai?.Live?.Client, genai?.GoogleGenAI?.Client);

        for (const c of constructorsToTry) {
          if (!c) continue;
          try {
            if (typeof c === 'function') {
              // try new C({ ... })
              const inst = new c({ vertexai: true, project: process.env.GCP_PROJECT, location: process.env.GCP_LOCATION });
              return inst;
            }
          } catch (e) {
            // ignore and try next
            console.warn('sessionManager: genai constructor attempt failed:', (e as any)?.message || String(e));
          }
        }

        // Some shapes expose a static connect on the module or on genai.Live
        if (genai && typeof genai.connect === 'function') return genai;
        if (genai && genai.Live && typeof genai.Live.connect === 'function') return genai.Live;
        // Some shapes expose GoogleGenAI as a constructor that has .live.connect or .connect
        if (genai && typeof genai.GoogleGenAI === 'function') {
          try {
            const inst = new (genai as any).GoogleGenAI({ project: process.env.GCP_PROJECT, location: process.env.GCP_LOCATION });
            if (inst && typeof inst.connect === 'function') return inst;
            if (inst && inst.live && typeof inst.live.connect === 'function') return inst;
          } catch (e) {}
        }

        return null;
      };

      client = tryConstructClient();
      // If still not found, try scanning exports for any object/function that exposes a connect() we can use
      if (!client) {
        const genaiExports = genai || {};
        for (const k of Object.keys(genaiExports)) {
          try {
            const v = (genaiExports as any)[k];
            if (!v) continue;
            // If object with connect() method
            if (typeof v.connect === 'function') {
              console.log('sessionManager: using export', k, 'as connect entrypoint');
              client = v; break;
            }
            // If nested Live has connect
            if (v && typeof v === 'object') {
              if (typeof v.Live === 'object' && typeof (v.Live as any).connect === 'function') { client = (v as any).Live; console.log('sessionManager: using', k + '.Live as connect entrypoint'); break; }
              if (typeof v.Live === 'function' && typeof (v.Live as any).connect === 'function') { client = (v as any).Live; console.log('sessionManager: using', k + '.Live as connect entrypoint'); break; }
            }
            // If it's a constructor that when instantiated has a connect method
            if (typeof v === 'function') {
              try {
                const inst = new (v as any)({ vertexai: true, project: process.env.GCP_PROJECT, location: process.env.GCP_LOCATION });
                if (inst && typeof inst.connect === 'function') { client = inst; console.log('sessionManager: instantiated', k, 'and found connect'); break; }
                if (inst && inst.aio && inst.aio.live && typeof inst.aio.live.connect === 'function') { client = inst; console.log('sessionManager: instantiated', k, 'and found aio.live.connect'); break; }
              } catch (e) {
                // ignore
              }
            }
          } catch (e) {
            // ignore and continue
          }
        }
      }
      if (!client) {
        console.warn('sessionManager: Unrecognized @google/genai module shape, keys:', exportedKeys);
        throw new Error('Could not construct @google/genai client - unsupported package shape');
      }

      (async () => {
        try {
          // Attempt to call the appropriate connect API depending on client shape
          let sdkSession: any = null;
          const connectPayload = {
            model: session.model,
            config: {
              response_modalities: ['AUDIO'],
              speech_config: { voice_config: { prebuilt_voice_config: { voice_name: session.ttsModel || 'Puck' } } },
              system_instruction: { parts: [{ text: session.systemPrompt }] }
            }
          };

          try {
            if (client.aio && client.aio.live && typeof client.aio.live.connect === 'function') {
              sdkSession = await client.aio.live.connect(connectPayload);
            } else if (client.connect && typeof client.connect === 'function') {
              sdkSession = await client.connect(connectPayload);
            } else if (client.Live && typeof client.Live.connect === 'function') {
              sdkSession = await client.Live.connect(connectPayload);
            } else if (typeof genai !== 'undefined' && genai && typeof genai.connect === 'function') {
              sdkSession = await genai.connect(connectPayload);
            } else if (typeof client === 'function') {
              // some packages export a callable that returns a client/session
              sdkSession = await client(connectPayload);
            } else {
              throw new Error('No known connect() method on constructed genai client');
            }
          } catch (e) {
            throw e;
          }

          session.sdkSession = sdkSession;
          console.log('sessionManager: Connected to GenAI Live via SDK for', session.sessionId);
          // mark session ready and notify client
          try {
            session.state = 'sdk-connected';
            if (session.onMessageCallback) session.onMessageCallback('[SYSTEM] Connected to GenAI Live via SDK');
          } catch (e) {
            console.warn('sessionManager: failed to notify client about SDK connection', (e as any)?.message || String(e));
          }

          // flush pending messages (if any)
          try {
            if (session.pendingMsgs && session.pendingMsgs.length > 0) {
              const pending = session.pendingMsgs.splice(0);
              console.log('sessionManager: flushing', pending.length, 'pending msgs (SDK) for', session.sessionId);
              try { if (session.onMessageCallback) session.onMessageCallback(`[SYSTEM] Flushing ${pending.length} pending messages to SDK`); } catch (e) {}
              for (const m of pending) {
                try {
                  if (m.type === 'text') await sendText(session.sessionId, m.payload);
                  else if (m.type === 'audio') await sendAudio(session.sessionId, m.payload.data, m.payload.contentType);
                } catch (e) {
                  console.warn('sessionManager: error flushing pending msg (SDK)', e);
                }
              }
            }
          } catch (err) {
            console.warn('sessionManager: flushing pending messages failed', err);
          }

          for await (const message of sdkSession.receive()) {
            try {
              const toolCall = message.server_content?.model_tool_use || message.serverContent?.modelToolUse;
              if (toolCall && (toolCall.toolRequest || toolCall.tool_request)) {
                const tr = toolCall.toolRequest || toolCall.tool_request;
                const toolName = tr.toolName || tr.tool_name;
                const params = tr.parameters || tr.parametersJson || {};
                console.log('sessionManager: SDK tool call', toolName, params);

                if (toolName === 'search_fsm_rag' && params.query) {
                  try {
                    const axios = require('axios');
                    const ragRes = await axios.post('http://localhost:3001/api/rag/search', { query: params.query, language: params.language || 'hy-AM', limit: 3 }, { timeout: 10000 });
                    const ragResult = ragRes.data;
                    let context = '';
                    if (ragResult && ragResult.results && ragResult.results.length > 0) context = ragResult.results.map((r: any, i: number) => `Document ${i + 1}: ${r.content}`).join('\n---\n');

                    if (sdkSession.send_tool_response) await sdkSession.send_tool_response({ toolName, response: { context } });
                    else if (sdkSession.sendClientContent) await sdkSession.sendClientContent({ toolResponse: { toolName, response: { context } } });
                  } catch (err) {
                    console.error('sessionManager: SDK RAG call failed', err);
                  }
                }

                continue;
              }

              const active = activeSessions.get(session.sessionId);
              if (active && active.onMessageCallback) {
                let text = '';
                let audio: Uint8Array | undefined;
                const parts = message.server_content?.model_turn?.parts || message.serverContent?.modelTurn?.parts || [];
                for (const part of parts) {
                  if (part.text) text += part.text;
                  const base64 = part.inline_data?.data || part.inlineData?.data;
                  if (base64) audio = Uint8Array.from(Buffer.from(base64, 'base64'));
                }
                if (text || audio) active.onMessageCallback(text, audio);
              }
            } catch (err) {
              console.error('sessionManager: Error processing SDK message', err);
            }
          }
        } catch (err) {
          console.error('sessionManager: SDK live.connect error', err);
        }
      })();

      return;
      } catch (err) {
      console.error('sessionManager: failed to init SDK, falling back to raw WS', (err as any)?.message || err);
      try {
        const s = activeSessions.get(sessionId);
        if (s) {
          s.state = 'error';
          s.lastError = (err as any)?.message || String(err);
          s.retryCount = (s.retryCount || 0) + 1;
          if (s.onMessageCallback) s.onMessageCallback(`[SYSTEM] SDK init failed: ${(err as any)?.message || String(err)} - falling back to raw WS (retry ${s.retryCount})`);
          // schedule a retry with exponential backoff (max 6 attempts)
          const retry = Math.min(6, s.retryCount);
          const delay = 5000 * Math.pow(2, retry - 1); // 5s,10s,20s,...
          console.log('sessionManager: scheduling reconnect attempt in', delay, 'ms for', sessionId);
          setTimeout(() => {
            const ss = activeSessions.get(sessionId);
            if (ss && (ss.retryCount || 0) < 7) {
              console.log('sessionManager: retrying startGoogleConnection for', sessionId);
              startGoogleConnection(sessionId, apiKey).catch((e) => console.error('sessionManager: retry start failed', e));
            }
          }, delay);
        }
      } catch (e) {}
    }
  }

  const ws = new WebSocket(googleWsUrl);
  attachUnexpectedResponseHandler(ws);

  ws.onopen = () => {
    const setupMessage = {
      setup: {
        model: `models/${session.model}`,
        generationConfig: { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: session.ttsModel || 'Puck' } } }, temperature: 0.8 },
        systemInstruction: { parts: [{ text: session.systemPrompt }] }
      }
    };
    try {
      ws.send(JSON.stringify(setupMessage));
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
      const message = JSON.parse(event.data.toString());
      const toolCall = message.serverContent?.modelToolUse || message.server_content?.model_tool_use;
      if (toolCall && toolCall.toolRequest) {
        const { toolRequest } = toolCall;
        const toolName = toolRequest.toolName;
        const params = toolRequest.parameters || {};
        if (toolName === 'search_fsm_rag' && params.query) {
          try {
            const axios = require('axios');
            const ragRes = await axios.post('http://localhost:3001/api/rag/search', { query: params.query, language: params.language || 'hy-AM', limit: 3 }, { timeout: 10000 });
            const ragResult = ragRes.data;
            let context = '';
            if (ragResult && ragResult.results && ragResult.results.length > 0) context = ragResult.results.map((r: any, i: number) => `Document ${i + 1}: ${r.content}`).join('\n---\n');
            const toolResponseMsg = { toolResponse: { toolName, response: { context } } };
            try { ws.send(JSON.stringify(toolResponseMsg)); } catch (e) { console.error('sessionManager: send tool response failed', e); }
          } catch (err) { console.error('sessionManager: RAG call failed', err); }
        }
        return;
      }

      const active = activeSessions.get(session.sessionId);
      if (active && active.onMessageCallback) {
        let text = '';
        let audio: Uint8Array | undefined;
        if (message.serverContent?.modelTurn?.parts) {
          for (const part of message.serverContent.modelTurn.parts) {
            if (part.text) text += part.text;
            if (part.inlineData?.mimeType?.includes('audio')) {
              const base64 = part.inlineData.data;
              audio = Uint8Array.from(Buffer.from(base64, 'base64'));
            }
          }
        }
                if (text || audio) {
                  console.log('sessionManager: forwarding SDK message to client for', session.sessionId, 'textLen=', text.length, 'audioBytes=', audio ? audio.length : 0);
                  active.onMessageCallback(text, audio);
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
      if (sdk.sendClientContent) {
        await sdk.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }] });
        return;
      }
      if (sdk.send_client_content) {
        await sdk.send_client_content({ turns: [{ role: 'user', parts: [{ text }] }] });
        return;
      }
    } catch (err) {
      console.warn('sessionManager: SDK sendText failed, falling back to raw WS', err);
    }
  }

  // Raw WS fallback
  const msg = { clientContent: { turns: [{ role: 'user', parts: [{ text }] }] } };
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
