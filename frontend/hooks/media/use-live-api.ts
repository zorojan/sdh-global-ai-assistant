/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024      // Connection closede LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveConnectConfig } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { DEFAULT_LIVE_API_MODEL } from '../../lib/constants';
import genaiLogger from '../../lib/genai-logger';

export type UseLiveApiResults = {
  ws: WebSocket | null;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  connect: () => Promise<void>;
  disconnect: () => void;
  reset: () => void;
  connected: boolean;
  lastError: string | null;
  volume: number;
  sessionId: string | null;
  wsUrl: string | null;
};

export function useLiveApi({ agentId, model = DEFAULT_LIVE_API_MODEL }: { agentId: string; model?: string }): UseLiveApiResults {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, [audioStreamerRef]);

  // Connect to backend session
  const connect = useCallback(async () => {
    try {
      // 1. Request session from backend
      const res = await fetch('http://localhost:3001/api/gemini/live/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, model })
      });
      if (!res.ok) throw new Error('Failed to create backend session');
      const { sessionId: sid, wsUrl: wurl } = await res.json();
      setSessionId(sid);
      setWsUrl(wurl);

      // 2. Ensure any previous socket is closed before creating a new one
      if (ws) {
        try {
          ws.close();
        } catch (err) {
          console.warn('useLiveApi: failed to close existing ws before reconnect', err);
        }
        setWs(null);
        // small pause to allow browser to tear down
        await new Promise((r) => setTimeout(r, 150));
      }

      // 3. Connect to backend WebSocket and wait until open
      await new Promise<void>((resolve, reject) => {
        try {
          const socket = new WebSocket(wurl);
          let settled = false;

          const cleanup = () => {
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
          };

          socket.onopen = () => {
            setWs(socket);
            setConnected(true);
            setLastError(null);
            settled = true;
            try { genaiLogger.log('ws', { event: 'open', sessionId: sid, wsUrl: wurl }); } catch(e){}
            resolve();
          };

          socket.onclose = (event) => {
            // use numeric code if reason is empty
            const codeOrReason = event?.reason || event?.code || 'unknown';
            setConnected(false);
            setLastError(`Connection closed: ${codeOrReason}`);
            try { genaiLogger.log('ws', { event: 'close', sessionId: sid, code: event?.code, reason: event?.reason }); } catch(e){}
            if (!settled) {
              settled = true;
              reject(new Error(`WebSocket closed before open: ${codeOrReason}`));
            }
            cleanup();
          };

          socket.onerror = (ev) => {
            setLastError('WebSocket error');
            try { genaiLogger.log('ws', { event: 'error', sessionId: sid, info: ev }); } catch(e){}
            if (!settled) {
              settled = true;
              reject(new Error('WebSocket error'));
            }
          };

          socket.onmessage = (event) => {
            // handle incoming audio/text from backend
            try { genaiLogger.logRaw({ direction: 'inbound', sessionId: sid, data: typeof event.data === 'string' ? event.data : '[binary]' }); } catch(e){}
            // Example: if (audioStreamerRef.current) audioStreamerRef.current.addPCM16(...)
          };
        } catch (err) {
          reject(err);
        }
      });
    } catch (err: any) {
      setLastError(err.message || 'Failed to connect');
    }
  }, [agentId, model]);

  const disconnect = useCallback(() => {
    if (ws) {
      ws.close();
      setWs(null);
    }
    setConnected(false);
    setVolume(0);
  }, [ws]);

  const reset = useCallback(() => {
    disconnect();
    setSessionId(null);
    setWsUrl(null);
    setLastError(null);
    setVolume(0);
    if (audioStreamerRef.current) {
      audioStreamerRef.current.stop();
      audioStreamerRef.current = null;
    }
  }, [disconnect]);

  return {
    ws,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    reset,
    lastError,
    volume,
    sessionId,
    wsUrl,
  };
}
