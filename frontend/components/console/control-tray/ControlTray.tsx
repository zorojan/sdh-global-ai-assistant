/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
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

import cn from 'classnames';

import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import genaiLogger from '../../../lib/genai-logger';
import { useUI } from '@/lib/state';

export type ControlTrayProps = {
  children?: ReactNode;
};

function ControlTray({ children }: ControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const { showAgentEdit, showUserConfig } = useUI();
  const liveApiContext = useLiveAPIContext();
  // liveApiContext may provide different shapes depending on provider (client or ws)
  const { client, ws, connected, connect, disconnect, sessionId } = (liveApiContext as any) || {};

  // Backend API base: prefer VITE_API_URL, fallback to localhost backend used during dev
  // Always use base without trailing /api
  const apiBase = ((import.meta as any).env?.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '').replace(/\/api$/, '');

  // Stop the current agent if the user is editing the agent or user config
  // NOTE: UserConfig should NOT disconnect voice connection
  // useEffect(() => {
  //   if (showAgentEdit || showUserConfig) {
  //     if (connected) disconnect();
  //   }
  // }, [showUserConfig, showAgentEdit, connected, disconnect]);

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    const onData = (base64: string) => {
      try { genaiLogger.log('audio', { direction: 'outbound', sizeKB: Math.round(base64.length / 1024) }); } catch(e){}
      // Prefer client.sendRealtimeInput when available (legacy genai-live client)
      if (client && typeof client.sendRealtimeInput === 'function') {
        client.sendRealtimeInput([
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64,
          },
        ]);
        return;
      }

      // If using backend proxy session, prefer sending audio via backend POST /api/gemini/live/send
      try {
        if (sessionId) {
          // send audio chunk to backend send endpoint
          try { genaiLogger.log('audio', { direction: 'outbound', via: 'backend-send', sessionId, sizeKB: Math.round(base64.length / 1024) }); } catch(e){}
          fetch(`${apiBase}/api/gemini/live/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, audioBase64: base64, contentType: 'audio' })
          }).then(async (r) => {
            try {
              const json = await r.json().catch(() => null);
              try { genaiLogger.logRaw({ direction: 'outbound', sessionId, data: { endpoint: `${apiBase}/api/gemini/live/send`, body: { audioSizeKB: Math.round(base64.length / 1024) }, response: json } }); } catch(e){}
            } catch (err) {
              console.warn('ControlTray: /api/gemini/live/send response parse failed', err);
            }
          }).catch((err) => {
            console.warn('ControlTray: failed to POST audio to backend /api/gemini/live/send', err);
          });
          return;
        }

        // If using backend WS proxy and no sessionId available, fall back to trying ws send
        if (ws && (ws as WebSocket).readyState === WebSocket.OPEN) {
          const msg = { type: 'input_audio_buffer', mimeType: 'audio/pcm;rate=16000', data: base64 };
          (ws as WebSocket).send(JSON.stringify(msg));
          try { genaiLogger.logRaw({ direction: 'outbound', sessionId: undefined, data: msg }); } catch(e){}
          return;
        }
      } catch (e) {
        console.warn('ControlTray: failed to send audio via backend-send/ws/client', e);
      }
    };
    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData).start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off('data', onData);
    };
  }, [connected, client, muted, audioRecorder]);

  return (
    <section className="control-tray">
      <nav className={cn('actions-nav', { disabled: !connected })}>
        <button
          className={cn('action-button mic-button')}
          onClick={() => setMuted(!muted)}
        >
          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
        </button>
        {children}
      </nav>

      <div className={cn('connection-container', { connected })}>
        <div className="connection-button-container">
                    <button
            ref={connectButtonRef}
            className={cn('action-button connect-toggle', { connected })}
            onClick={() => {
              // Play button clicked
              if (connected) {
                // Disconnecting...
                disconnect();
              } else {
                // Connecting...
                connect();
              }
            }}
            // Allow connecting even if legacy `client` object is not present (we may be using ws proxy)
            disabled={false}
          >
            <span className="material-symbols-outlined filled">
              {connected ? 'pause' : 'play_arrow'}
            </span>
          </button>
        </div>
        <span className="text-indicator">Streaming</span>
      </div>

      <div className="actions-nav-placeholder" />
    </section>
  );
}

export default memo(ControlTray);