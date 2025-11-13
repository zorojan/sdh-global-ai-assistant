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
    // Buffer audio chunks and send in batches to reduce POST frequency.
    const pendingChunks: string[] = [];
    const FLUSH_INTERVAL_MS = 250; // flush every 250ms
    const MAX_CHUNKS_PER_BATCH = 8; // or flush when exceeded

    const base64ToUint8 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const uint8ToBase64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));

    const combineBase64Chunks = (chunks: string[]) => {
      if (!chunks || chunks.length === 0) return '';
      if (chunks.length === 1) return chunks[0];
      const parts = chunks.map(base64ToUint8);
      const totalLen = parts.reduce((s, p) => s + p.length, 0);
      const out = new Uint8Array(totalLen);
      let offset = 0;
      for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
      }
      return uint8ToBase64(out);
    };

    const flushChunks = async (isFinal = false) => {
      if (pendingChunks.length === 0) return;
      // take up to MAX_CHUNKS_PER_BATCH
      const batch = pendingChunks.splice(0, MAX_CHUNKS_PER_BATCH);
      const combined = combineBase64Chunks(batch);
      if (!combined) return;

      try {
        const sampleRate = audioRecorder?.audioContext?.sampleRate || 16000;
        if (sessionId) {
          // send combined payload to backend; include actual sample rate in contentType
          await fetch(`${apiBase}/api/gemini/live/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, audioBase64: combined, contentType: `audio/pcm;rate=${sampleRate}` })
          });
        } else if (ws && (ws as WebSocket).readyState === WebSocket.OPEN) {
          const msg = { type: 'input_audio_buffer', mimeType: `audio/pcm;rate=${sampleRate}`, data: combined };
          (ws as WebSocket).send(JSON.stringify(msg));
        }
      } catch (e) {
        console.warn('ControlTray: failed to POST batched audio', e);
      }

      // If there are more chunks queued, schedule next immediate flush
      if (pendingChunks.length > 0) setTimeout(() => flushChunks(), 0);
    };

    const flushTimer = setInterval(() => flushChunks(false), FLUSH_INTERVAL_MS);

    const onData = (base64: string) => {
      // enqueue incoming chunk
      try {
        pendingChunks.push(base64);
      } catch (e) {
        console.warn('ControlTray: failed to queue audio chunk', e);
      }
      // flush if exceeded
      if (pendingChunks.length >= MAX_CHUNKS_PER_BATCH) {
        flushChunks();
      }
    };
    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData).start();
    } else {
      audioRecorder.stop();
    }

    return () => {
      // flush remaining chunks before cleanup
      clearInterval(flushTimer);
      try { audioRecorder.off('data', onData); } catch (e) {}
      // final flush
      flushChunks(true).catch(() => {});
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