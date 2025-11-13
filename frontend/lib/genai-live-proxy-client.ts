/**
 * Lightweight Gemini Live Proxy client for widget mode.
 * When frontend does not have a public API key this client
 * uses backend proxy endpoints to create a server-side session
 * and communicate via backend WebSocket + REST send endpoints.
 */
import EventEmitter from 'eventemitter3';

export type ProxyClientEvents = {
  open: () => void;
  close: (e: any) => void;
  audio: (data: ArrayBuffer | { data: ArrayBuffer; mimeType?: string }) => void;
  content: (data: any) => void;
  error: (e: any) => void;
  setupcomplete: () => void;
  log: (msg: any) => void;
};

export class GenAILiveProxyClient {
  public model: string;
  private ee = new EventEmitter<ProxyClientEvents>();
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private backendBase = (window as any).__SDH_BACKEND_URL__ || 'http://localhost:3001';

  constructor(apiKey?: string, model?: string) {
    this.model = model || 'gemini-2.5-flash-native-audio-preview-09-2025';
  }

  public on<E extends keyof ProxyClientEvents>(event: E, fn: ProxyClientEvents[E]) {
    this.ee.on(event, fn as any);
  }
  public off<E extends keyof ProxyClientEvents>(event: E, fn: ProxyClientEvents[E]) {
    this.ee.off(event, fn as any);
  }

  // connect: create session on backend and open websocket to backend
  public async connect(config: any): Promise<boolean> {
    try {
      // Build request body from config
      const ttsModel = config?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName || config?.ttsModel || '';
      const systemPrompt = (config?.systemInstruction?.parts && config.systemInstruction.parts[0] && config.systemInstruction.parts[0].text) || '';
      const model = config?.model || this.model;

      const resp = await fetch(`${this.backendBase}/api/gemini/live/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, ttsModel, systemPrompt })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        this.ee.emit('error', new Error(`Proxy session create failed: ${resp.status} ${txt}`));
        return false;
      }

      const data = await resp.json();
      this.sessionId = data.sessionId;
      const wsUrl = data.wsUrl;

      // Ensure wsUrl is ws:// or wss://; if backend returned http(s) map accordingly
      let finalWs = wsUrl;
      if (finalWs.startsWith('http://')) finalWs = finalWs.replace(/^http:/, 'ws:');
      if (finalWs.startsWith('https://')) finalWs = finalWs.replace(/^https:/, 'wss:');

      this.ws = new WebSocket(finalWs);

      this.ws.onopen = () => {
        this.ee.emit('open');
      };

      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          // Server sends { type: 'message', text, audio }
          if (msg && msg.type === 'message') {
            const text = msg.text || '';
            if (msg.audio && Array.isArray(msg.audio)) {
              const arr = new Uint8Array(msg.audio);
              // Helpful debug log for audio arrival
              try { console.debug('GenAILiveProxyClient: audio message received, bytes=', arr.length, 'mime=', msg.audioMimeType); } catch (e) {}
              if (msg.audioMimeType) {
                this.ee.emit('audio', { data: arr.buffer, mimeType: msg.audioMimeType });
              } else {
                this.ee.emit('audio', arr.buffer);
              }
            }
            this.ee.emit('content', { serverContent: { modelTurn: { parts: [{ text }] } } });
          } else {
            this.ee.emit('log', msg);
          }
        } catch (err) {
          // Non-JSON or other messages
          try { this.ee.emit('log', ev.data); } catch (e) {}
        }
      };

      this.ws.onerror = (e) => {
        this.ee.emit('error', e);
      };

      this.ws.onclose = (e) => {
        this.ee.emit('close', e);
      };

      return true;
    } catch (err) {
      this.ee.emit('error', err as any);
      return false;
    }
  }

  public disconnect() {
    try {
      if (this.ws) this.ws.close();
    } catch (e) {}
    this.ws = null;
    this.sessionId = null;
    return true;
  }

  // Send realtime audio chunks to backend proxy which forwards to Google
  public async sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (!this.sessionId) {
      this.ee.emit('error', new Error('No sessionId')); return;
    }
    try {
      for (const c of chunks) {
        await fetch(`${this.backendBase}/api/gemini/live/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: this.sessionId, audioBase64: c.data, contentType: c.mimeType })
        });
      }
    } catch (err) {
      this.ee.emit('error', err as any);
    }
  }

  // Send plain text
  public async sendClientContent(turns: any) {
    if (!this.sessionId) return;
    try {
      const text = (turns && turns[0] && turns[0].parts && turns[0].parts[0] && turns[0].parts[0].text) || '';
      await fetch(`${this.backendBase}/api/gemini/live/send-text`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: this.sessionId, text })
      });
    } catch (err) { this.ee.emit('error', err as any); }
  }
}

export default GenAILiveProxyClient;
