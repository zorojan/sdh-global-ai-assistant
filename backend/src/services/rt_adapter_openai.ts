/**
 * Realtime adapter (OpenAI) - TypeScript port of the Python skeleton.
 *
 * This module provides helper functions to interact with OpenAI Realtime API.
 * It's intentionally minimal and synchronous/illustrative. For production you
 * should implement proper async streaming, authentication refresh and binary
 * audio framing (WebRTC or WebSocket connection to OpenAI Realtime).
 */
import fetch from 'node-fetch';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_REALTIME_MOCK = (process.env.OPENAI_REALTIME_MOCK || 'false').toLowerCase() === 'true';

export async function createRealtimeSession(sessionId: string, model = 'gpt-4o-realtime-preview') {
  // Lightweight descriptor for upper layers. Real session creation is done
  // via createSessionFromOffer which performs the HTTP call to OpenAI.
  return {
    sessionId,
    model,
    wsUrl: 'wss://api.openai.example/realtime',
    token: OPENAI_API_KEY || null,
  };
}

export async function sendAudioChunk(sessionInfo: any, chunkBytes: Buffer, seq: number) {
  // Placeholder: real implementation should send framed audio over WebRTC/DataChannel/WS
  await new Promise((r) => setTimeout(r, 0));
  return { sent: true, seq };
}

export async function closeSession(sessionInfo: any) {
  // Placeholder: perform cleanup with the realtime provider
  await new Promise((r) => setTimeout(r, 0));
  return true;
}

/**
 * Create a realtime session by forwarding an SDP offer to OpenAI Realtime API.
 * - offerSdp: SDP offer string from the browser
 * - sessionConfig: object with model/voice/instructions
 * - apiKey: optional override key
 *
 * Returns the parsed JSON response from OpenAI which is expected to include
 * an `sdp` (answer) or `sdp_answer` field and other call metadata.
 */
export async function createSessionFromOffer(offerSdp: string, sessionConfig: any, apiKey?: string) {
  const key = apiKey || OPENAI_API_KEY;

  if (!key) {
    if (OPENAI_REALTIME_MOCK) {
      // Helpful for local dev: return a mock answer that the server can forward
      return {
        call_id: 'mock-call-id',
        sdp: 'v=0\n...mock-sdp-answer...',
      };
    }
    throw new Error('OPENAI_API_KEY is not configured. Set OPENAI_API_KEY or enable OPENAI_REALTIME_MOCK=true for local development.');
  }

  const requestBody = {
    sdp: offerSdp,
    session: sessionConfig,
  };

  const url = 'https://api.openai.com/v1/realtime/calls';

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      // keep a reasonable timeout handling at caller level if needed
    });
  } catch (err: any) {
    throw new Error(`Network error while calling OpenAI Realtime API: ${err.message || err}`);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '<no-body>');
    throw new Error(`OpenAI Realtime API error: ${resp.status} ${text}`);
  }

  let data: any;
  try {
    data = await resp.json();
  } catch (err: any) {
    const text = await resp.text().catch(() => '<unreadable-body>');
    throw new Error(`Failed to parse OpenAI response as JSON: ${err.message}. Body: ${text}`);
  }

  return data;
}
